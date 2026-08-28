import os
import cv2
import numpy as np
import urllib.request
from pathlib import Path
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

RAW_DATA_DIR = Path("raw_data")
OUTPUT_DIR = Path("processed_data")
OUTPUT_DIR.mkdir(exist_ok=True)

MODEL_PATH = Path("hand_landmarker.task")
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"

SEQUENCE_LENGTH = 30
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
    """Return a 126-length vector: [Left hand 63 values][Right hand 63 values].
    Missing hand is zero-padded. Returns None if NO hand at all is detected."""
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    result = landmarker.detect(mp_image)

    if not result.hand_landmarks:
        return None

    left = np.zeros(FEATURES_PER_HAND, dtype=np.float32)
    right = np.zeros(FEATURES_PER_HAND, dtype=np.float32)

    for hand_landmarks, handedness in zip(result.hand_landmarks, result.handedness):
        coords = []
        for lm in hand_landmarks:
            coords.extend([lm.x, lm.y, lm.z])
        coords = np.array(coords, dtype=np.float32)

        label = handedness[0].category_name  # "Left" or "Right"
        if label == "Left":
            left = coords
        else:
            right = coords

    return np.concatenate([left, right])


def resample_sequence(frames):
    n = len(frames)
    if n == SEQUENCE_LENGTH:
        return frames
    indices = np.linspace(0, n - 1, SEQUENCE_LENGTH).astype(int)
    return frames[indices]


def process_video(path):
    cap = cv2.VideoCapture(str(path))
    frame_landmarks = []
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        lm = extract_landmarks_from_frame(frame)
        if lm is not None:
            frame_landmarks.append(lm)
    cap.release()

    if len(frame_landmarks) == 0:
        return None

    frame_landmarks = np.array(frame_landmarks)
    return resample_sequence(frame_landmarks)


def process_image(path):
    frame = cv2.imread(str(path))
    if frame is None:
        return None
    lm = extract_landmarks_from_frame(frame)
    if lm is None:
        return None
    return np.tile(lm, (SEQUENCE_LENGTH, 1))


def main():
    X = []
    y = []
    labels = sorted([d.name for d in RAW_DATA_DIR.iterdir() if d.is_dir()])
    print(f"Found {len(labels)} word classes: {labels}")

    for label in labels:
        word_dir = RAW_DATA_DIR / label
        files = list(word_dir.iterdir())
        print(f"\nProcessing '{label}' ({len(files)} files)...")

        success_count = 0
        for f in files:
            ext = f.suffix.lower()
            sequence = None

            if ext in VIDEO_EXTENSIONS:
                sequence = process_video(f)
            elif ext in IMAGE_EXTENSIONS:
                sequence = process_image(f)
            else:
                continue

            if sequence is not None:
                X.append(sequence)
                y.append(label)
                success_count += 1

        print(f"  -> {success_count}/{len(files)} files yielded valid hand landmarks")

    X = np.array(X, dtype=np.float32)
    y = np.array(y)

    print(f"\nFinal dataset shape: X={X.shape}, y={y.shape}")

    np.save(OUTPUT_DIR / "X.npy", X)
    np.save(OUTPUT_DIR / "y.npy", y)

    label_list = sorted(set(y.tolist()))
    with open(OUTPUT_DIR / "labels.txt", "w") as f:
        f.write("\n".join(label_list))

    print(f"\nSaved to {OUTPUT_DIR}/ (X.npy, y.npy, labels.txt)")


if __name__ == "__main__":
    main()