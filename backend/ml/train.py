import json
import os
import sys
from pathlib import Path

import numpy as np
import tensorflow as tf
from tensorflow.keras import layers
from tensorflow.keras.models import Model, Sequential

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.utils.features import (  # noqa: E402
    FEATURES_PER_HAND, NUM_LANDMARKS, NORMALIZED_FEATURES, RAW_FEATURES, normalize_frame, order_hands,
)

DATA_DIR = Path("processed_data")
MODEL_OUT = Path("model")
MODEL_OUT.mkdir(exist_ok=True)

FRAME_CAP = 4000         # raw frames per class used for training (hot has thousands, most have ~300)
TARGET_PER_CLASS = 4000  # augmented training samples per class, so every sign carries equal weight
TRAIN_STRENGTH = 1.0
ENSEMBLE = 4
PREV_MODEL = sys.argv[1] if len(sys.argv) > 1 else None  # optional older model to compare on the stress test
BLEND = bool(os.environ.get("BLEND"))
rng = np.random.default_rng(42)

X = np.load(DATA_DIR / "X.npy")
y = np.load(DATA_DIR / "y.npy")
groups = np.load(DATA_DIR / "groups.npy")

# Recordings made through the live camera (Teach MedHear page): same numbers the detector sends, one take = one group
LIVE_DIR = Path("live_data")
live_frames, live_labels, live_groups = [], [], []
next_group = int(groups.max()) + 1
LIVE_START = next_group  # groups at or above this id are live-camera takes
for path in sorted(LIVE_DIR.glob("*.jsonl")) if LIVE_DIR.exists() else []:
    label = path.stem.replace("_", " ")
    for line in path.read_text(encoding="utf-8").splitlines():
        take = np.array(json.loads(line), dtype=np.float32)
        live_frames.append(take)
        live_labels += [label] * len(take)
        live_groups += [next_group] * len(take)
        next_group += 1
if live_frames:
    X = np.concatenate([X] + live_frames)
    y = np.concatenate([y, np.array(live_labels)])
    groups = np.concatenate([groups, np.array(live_groups)])
    print(f"Added live recordings: {len(live_groups)} frames, signs {sorted(set(live_labels))}")

classes = sorted(set(y.tolist()))
y_idx =np.array([classes.index(c) for c in y])
num_classes = len(classes)
print(f"Loaded X={X.shape}, classes={classes}")


# ---- split by source file so near-identical frames never straddle train/test ----
def split_groups():
    train, val, test = [], [], []
    for c in range(num_classes):
        g = np.unique(groups[(y_idx == c) & (groups < LIVE_START)])
        rng.shuffle(g)
        n_val = max(1, int(len(g) * 0.15))
        n_test = max(1, int(len(g) * 0.15))
        test += list(g[:n_test])
        val += list(g[n_test:n_test + n_val])
        train += list(g[n_test + n_val:])
    # live takes are too few to hold out, and they are the data that matches the real camera: always train on them
    return np.isin(groups, train) | (groups >= LIVE_START), np.isin(groups, val), np.isin(groups, test)


tr, va, te = split_groups()
print(f"Train {tr.sum()}  Val {va.sum()}  Test {te.sum()}")
aug_rng = np.random.default_rng(7)


# ---- augmentation on raw landmarks (before normalization) ----
def hands_of(raw):
    return [raw[i * FEATURES_PER_HAND:(i + 1) * FEATURES_PER_HAND].reshape(NUM_LANDMARKS, 3)
            for i in range(2) if np.any(raw[i * FEATURES_PER_HAND:(i + 1) * FEATURES_PER_HAND])]


def augment(raw, r, strength=1.0):
    hs = [h.copy() for h in hands_of(raw)]
    if len(hs) == 2 and r.random() < 0.12 * strength:  # a hand the camera missed
        hs.pop(int(r.integers(2)))
    if r.random() < 0.5:  # mirror (webcam preview vs. recorded data)
        width = max(h[:, 0].max() for h in hs)
        for h in hs:
            h[:, 0] = width - h[:, 0]
    angle = np.deg2rad(r.uniform(-18, 18) * strength)  # camera / body tilt (kept modest: hand tilt separates hot from doctor)
    c, s = np.cos(angle), np.sin(angle)
    rot = np.array([[c, -s], [s, c]], dtype=np.float32)
    sx, sy = r.uniform(1 - 0.15 * strength, 1 + 0.15 * strength, 2)
    shear = r.uniform(-0.08, 0.08) * strength
    out = []
    for h in hs:
        h = h.copy()
        origin = h[0, :2].copy()
        local = np.deg2rad(r.uniform(-4, 4) * strength)  # each hand tilts a little on its own
        lc, ls = np.cos(local), np.sin(local)
        h[:, :2] = (h[:, :2] - origin) @ np.array([[lc, -ls], [ls, lc]], dtype=np.float32).T + origin
        h[:, :2] = (h[:, :2] - origin) @ rot.T * [sx, sy] + origin
        h[:, 0] += (h[:, 1] - origin[1]) * shear
        size = np.linalg.norm(h[9, :2] - h[0, :2]) + 1e-6
        h += r.normal(0, 0.025 * strength * size, h.shape)  # landmark jitter
        h[:, 2] *= r.uniform(0.6, 1.4)  # depth is the noisiest MediaPipe axis
        out.append(h)
    return order_hands(out)


def build(mask, copies_for_class, r, strength=1.0, cap=None):
    feats, labels, live = [], [], []
    idx = np.where(mask)[0]
    for c in range(num_classes):
        ci = idx[y_idx[idx] == c]
        own = ci[groups[ci] >= LIVE_START]  # live frames are never dropped by the cap
        rest = ci[groups[ci] < LIVE_START]
        if cap is not None and len(rest) > cap:
            rest = r.choice(rest, cap, replace=False)
        ci = np.concatenate([rest, own])
        copies = copies_for_class(len(ci))
        for i in ci:
            flag = int(groups[i] >= LIVE_START)
            feats.append(normalize_frame(X[i]))
            labels.append(c)
            live.append(flag)
            for _ in range(copies):
                feats.append(normalize_frame(augment(X[i], r, strength)))
                labels.append(c)
                live.append(flag)
    return np.array(feats, dtype=np.float32), np.array(labels), np.array(live)


X_train, y_train, live_train = build(tr, lambda n: max(1, int(np.ceil(TARGET_PER_CLASS / max(n, 1))) - 1), aug_rng, TRAIN_STRENGTH, FRAME_CAP)


# hot is a motion (point -> open hand): live webcam frames land on in-between shapes the recordings rarely hold,
# and those look like thirsty. Blend frames of the same video to cover the transitions.
def transitions(mask, label, n, r):
    c = classes.index(label)
    idx = np.where(mask & (y_idx == c))[0]
    by_file = {}
    for i in idx:
        by_file.setdefault(groups[i], []).append(i)
    files = [f for f in by_file.values() if len(f) >= 6]
    feats = []
    for _ in range(n):
        f = files[int(r.integers(len(files)))]
        a, b = r.choice(f, 2, replace=False)
        t = r.uniform(0.15, 0.85)
        ha, hb = hands_of(X[a]), hands_of(X[b])
        if len(ha) != len(hb) or not ha:
            continue
        mixed = [(1 - t) * u + t * v for u, v in zip(ha, hb)]
        feats.append(normalize_frame(augment(order_hands(mixed), r, 0.6)))
    return np.array(feats, dtype=np.float32), np.full(len(feats), c)


X_tr_hot, y_tr_hot = transitions(tr, "hot", 5000, aug_rng)
X_train = np.concatenate([X_train, X_tr_hot]); y_train = np.concatenate([y_train, y_tr_hot])
live_train = np.concatenate([live_train, np.zeros(len(y_tr_hot), dtype=int)])
X_val, y_val, _ = build(va, lambda n: 0, aug_rng)
X_test, y_test, _ = build(te, lambda n: 0, aug_rng)
# stress set: held-out files with harsher tilt / scale / noise / missing hands than training ever sees
X_stress, y_stress, _ = build(te, lambda n: 3, np.random.default_rng(99), 1.6)
_counts = np.bincount(y_train, minlength=num_classes)
# hot is a movement sign judged from single frames, and its mid-motion poses resemble doctor: count it extra
sample_weight = np.where(y_train == classes.index("hot"), 2.0, 1.0) * np.where(live_train == 1, 3.0, 1.0)
print(f"train samples {len(y_train)}  (per class {_counts.min()}-{_counts.max()})  stress {len(y_stress)}")


def make_member(seed):
    tf.keras.utils.set_random_seed(seed)
    return Sequential([
        layers.Input(shape=(NORMALIZED_FEATURES,)),
        layers.GaussianNoise(0.02),
        layers.Dense(256, activation="relu"),
        layers.BatchNormalization(),
        layers.Dropout(0.4),
        layers.Dense(128, activation="relu"),
        layers.BatchNormalization(),
        layers.Dropout(0.3),
        layers.Dense(64, activation="relu"),
        layers.Dense(num_classes, activation="softmax"),
    ], name=f"member_{seed}")


members = []
for seed in range(ENSEMBLE):
    m = make_member(seed)
    m.compile(optimizer=tf.keras.optimizers.Adam(1e-3),
              loss=tf.keras.losses.SparseCategoricalCrossentropy(), metrics=["accuracy"])
    m.fit(X_train, y_train, sample_weight=sample_weight, validation_data=(X_val, y_val), epochs=60, batch_size=128,
          callbacks=[tf.keras.callbacks.EarlyStopping(patience=8, restore_best_weights=True),
                     tf.keras.callbacks.ReduceLROnPlateau(patience=4, factor=0.5)], verbose=0)
    print(f"member {seed}: val acc {m.evaluate(X_val, y_val, verbose=0)[1]:.3f}")
    members.append(m)

inp = layers.Input(shape=(NORMALIZED_FEATURES,))
model = Model(inp, layers.Average()([m(inp) for m in members]), name="medhear_ensemble")


if PREV_MODEL and BLEND:  # the older model is very strong on hot; give it one vote alongside the new ensemble
    prev_for_blend = tf.keras.models.load_model(PREV_MODEL)
    prev_for_blend.trainable = False
    model = Model(inp, layers.Average()([model(inp), prev_for_blend(inp)]), name="medhear_blend")


def report(name, mdl, Xs, ys):
    pred = np.argmax(mdl.predict(Xs, verbose=0), axis=1)
    recalls = [(pred[ys == c] == c).mean() if (ys == c).any() else float("nan") for c in range(num_classes)]
    print(f"{name}: per-sign avg {np.nanmean(recalls):.3f}  frame acc {(pred == ys).mean():.3f}  worst: " +
          ", ".join(f"{classes[c]} {recalls[c]:.2f}" for c in np.argsort(recalls)[:4]))
    return pred


report("NEW  clean test ", model, X_test, y_test)
report("NEW  stress test", model, X_stress, y_stress)
if PREV_MODEL:
    prev = tf.keras.models.load_model(PREV_MODEL)
    report("PREV clean test ", prev, X_test, y_test)
    report("PREV stress test", prev, X_stress, y_stress)

pred = np.argmax(model.predict(X_test, verbose=0), axis=1)
cm = np.zeros((num_classes, num_classes), dtype=int)
for t, p in zip(y_test, pred):
    cm[t, p] += 1
print("\nPer-class recall (clean test):")
for i, c in enumerate(classes):
    wrong = [f"{classes[j]}x{cm[i, j]}" for j in range(num_classes) if j != i and cm[i, j]]
    print(f"{c:>12} recall={cm[i, i] / max(cm[i].sum(), 1):.2f} {' '.join(wrong)}")

model.save(MODEL_OUT / "sign_model.keras")
with open(MODEL_OUT / "labels.json", "w") as f:
    json.dump(classes, f)
print(f"\nSaved to {MODEL_OUT}/")
