import os
import re
import cv2
import numpy as np
import urllib.request
from pathlib import Path
import sys
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

RAW_DATA_DIR = Path("raw_data")
OUTPUT_DIR = Path("processed_data")
OUTPUT_DIR.mkdir(exist_ok=True)

MODEL_PATH = Path("hand_landmarker.task")
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.utils.features import order_hands  # noqa: E402

NUM_HAND_LANDMARKS = 21
FEATURES_PER_HAND = NUM_HAND_LANDMARKS * 3  # 63
FEATURES_PER_FRAME = FEATURES_PER_HAND * 2  # 126 (both hands, zero-padded if missing)

VIDEO_EXTENSIONS = {".mov", ".mp4", ".avi"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}

if not MODEL_PATH.exists():
    print("Downloading hand landmark model...")
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    print("Done.")

base_options = mp_python.BaseOptions(model_asset_path=str(MODEL_PATH))
options = mp_vision.HandLandmarkerOptions(
    base_options=base_options,
    running_mode=mp_vision.RunningMode.IMAGE,
    num_hands=2,
    min_hand_detection_confidence=0.5,
)
landmarker = mp_vision.HandLandmarker.create_from_options(options)


def extract_landmarks_from_frame(frame_bgr):
    """Return a raw 126-vector (pixel-like units, hands ordered by wrist x), or None if no hand."""
    h, w = frame_bgr.shape[:2]
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    result = landmarker.detect(mp_image)

    if not result.hand_landmarks:
        return None

    hands = []
    for hand_landmarks in result.hand_landmarks:
        coords = np.array([[lm.x * w, lm.y * h, lm.z * w] for lm in hand_landmarks], dtype=np.float32)
        hands.append(coords)
    return order_hands(hands)


def process_video(path):
    """One sample per frame that has a hand."""
    cap = cv2.VideoCapture(str(path))
    samples = []
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        lm = extract_landmarks_from_frame(frame)
        if lm is not None:
            samples.append(lm)
    cap.release()
    return samples


def process_image(path):
    frame = cv2.imread(str(path))
    if frame is None:
        return []
    lm = extract_landmarks_from_frame(frame)
    return [] if lm is None else [lm]


def signer_of(name):
    m = re.match(r"U(\d+)_", name) or re.search(r"User_?(\d+)", name)
    return int(m.group(1)) if m else -1


def main():
    X = []
    y = []
    groups = []  # source file index, so train/test can be split by file
    users = []  # signer id parsed from the file name (U3_..., ..._User2_...), -1 when unknown
    labels = sorted([d.name for d in RAW_DATA_DIR.iterdir() if d.is_dir()])
    print(f"Found {len(labels)} word classes: {labels}")

    file_id = 0
    for label in labels:
        word_dir = RAW_DATA_DIR / label
        files = sorted(word_dir.iterdir())
        print(f"\nProcessing '{label}' ({len(files)} files)...")

        success_count = 0
        for f in files:
            ext = f.suffix.lower()
            if ext in VIDEO_EXTENSIONS:
                samples = process_video(f)
            elif ext in IMAGE_EXTENSIONS:
                samples = process_image(f)
            else:
                continue

            if samples:
                success_count += 1
                for s_ in samples:
                    X.append(s_)
                    y.append(label)
                    groups.append(file_id)
                    users.append(signer_of(f.name))
            file_id += 1

        print(f"  -> {success_count}/{len(files)} files yielded valid hand landmarks")

    X = np.array(X, dtype=np.float32)
    y = np.array(y)
    groups = np.array(groups)

    print(f"\nFinal dataset shape: X={X.shape}, y={y.shape}")

    np.save(OUTPUT_DIR / "X.npy", X)
    np.save(OUTPUT_DIR / "y.npy", y)
    np.save(OUTPUT_DIR / "groups.npy", groups)
    np.save(OUTPUT_DIR / "users.npy", np.array(users))

    label_list = sorted(set(y.tolist()))
    with open(OUTPUT_DIR / "labels.txt", "w") as f:
        f.write("\n".join(label_list))

    print(f"\nSaved to {OUTPUT_DIR}/ (X.npy, y.npy, groups.npy, labels.txt)")


if __name__ == "__main__":
    main()
