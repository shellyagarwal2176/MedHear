import numpy as np

NUM_LANDMARKS = 21
FEATURES_PER_HAND = NUM_LANDMARKS * 3  # 63
RAW_FEATURES = FEATURES_PER_HAND * 2  # 126: two hand slots, zero-padded
KEY_POINTS = [0, 4, 8, 12, 16, 20]  # wrist + fingertips
CROSS_FEATURES = 3 + len(KEY_POINTS) ** 2 + 2  # wrist offset, key-point distances, relative rotation
NORMALIZED_FEATURES = RAW_FEATURES + CROSS_FEATURES

WRIST = 0
MIDDLE_MCP = 9


def _normalize_hand(hand):
    """hand: (21, 3). Translate wrist to origin and scale by wrist->middle-MCP distance."""
    pts = hand - hand[WRIST]
    scale = np.linalg.norm(pts[MIDDLE_MCP, :2])
    if scale < 1e-6:
        scale = 1.0
    return pts / scale, scale


def normalize_frame(raw):
    """raw: (126,) landmarks in pixel-like units, hands ordered by wrist x, single hand in slot 0.
    Returns (NORMALIZED_FEATURES,) features invariant to hand position and size in the frame."""
    raw = np.asarray(raw, dtype=np.float32)
    hands = [raw[:FEATURES_PER_HAND].reshape(NUM_LANDMARKS, 3),
             raw[FEATURES_PER_HAND:].reshape(NUM_LANDMARKS, 3)]
    present = [bool(np.any(h)) for h in hands]

    out = np.zeros(NORMALIZED_FEATURES, dtype=np.float32)
    scales = []
    for i, h in enumerate(hands):
        if present[i]:
            norm, scale = _normalize_hand(h)
            out[i * FEATURES_PER_HAND:(i + 1) * FEATURES_PER_HAND] = norm.reshape(-1)
            scales.append(scale)

    if present[0] and present[1]:
        ref = max(scales)
        a, b = hands[0], hands[1]
        offset = (b[WRIST] - a[WRIST]) / ref
        dists = np.linalg.norm(a[KEY_POINTS][:, None, :] - b[KEY_POINTS][None, :, :], axis=-1) / ref
        # rotation of hand B relative to hand A, from their wrist->middle-MCP directions
        va = a[MIDDLE_MCP, :2] - a[WRIST, :2]
        vb = b[MIDDLE_MCP, :2] - b[WRIST, :2]
        angle = np.arctan2(vb[1], vb[0]) - np.arctan2(va[1], va[0])
        out[RAW_FEATURES:] = np.concatenate([offset, dists.reshape(-1), [np.cos(angle), np.sin(angle)]])
    return out


def normalize_sequence(seq):
    """seq: (T, 126) -> (T, NORMALIZED_FEATURES)."""
    return np.stack([normalize_frame(f) for f in seq])


def order_hands(hands):
    """hands: list of (21, 3) arrays. Sort by wrist x so slot order doesn't depend on
    MediaPipe's handedness label (which flips with camera mirroring). Returns (126,)."""
    hands = sorted(hands, key=lambda h: h[WRIST][0])[:2]
    out = np.zeros(RAW_FEATURES, dtype=np.float32)
    for i, h in enumerate(hands):
        out[i * FEATURES_PER_HAND:(i + 1) * FEATURES_PER_HAND] = np.asarray(h, dtype=np.float32).reshape(-1)
    return out
