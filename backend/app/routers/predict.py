import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel
from pathlib import Path
import tensorflow as tf
import json

from app.utils.features import RAW_FEATURES, normalize_sequence

router = APIRouter(prefix="/predict", tags=["predict"])

MODEL_DIR = Path(__file__).parent.parent / "ml_model"
model = tf.keras.models.load_model(MODEL_DIR / "sign_model.keras")

with open(MODEL_DIR / "labels.json") as f:
    LABELS = json.load(f)

MIN_FRAMES = 5


class LandmarkSequence(BaseModel):
    # A list of frames, each a flat list of 126 floats: 2 hand slots x 21 landmarks x (x, y, z),
    # in pixel units (x, y by video size; z by video width), hands ordered by wrist x,
    # a single hand in slot 0, unused slot zero-padded.
    sequence: list[list[float]]


@router.post("")
async def predict_sign(data: LandmarkSequence):
    X = np.array(data.sequence, dtype=np.float32)

    if X.ndim != 2 or X.shape[1] != RAW_FEATURES or X.shape[0] < MIN_FRAMES:
        return {
            "error": f"Expected (>={MIN_FRAMES}, {RAW_FEATURES}), got {X.shape}"
        }

    # Frame-level model: classify each frame, then average so one noisy frame can't flip the result.
    frame_probs = model.predict(normalize_sequence(X), verbose=0)
    predictions = frame_probs.mean(axis=0)

    top_index = int(np.argmax(predictions))
    confidence = float(predictions[top_index])

    per_frame = [LABELS[i] for i in np.argmax(frame_probs, axis=1)]
    top3 = sorted(zip(LABELS, predictions), key=lambda t: -t[1])[:3]
    print(f"[predict] frames={len(X)} top3={[(l, round(float(p), 2)) for l, p in top3]} per_frame={per_frame}", flush=True)

    return {
        "sign": LABELS[top_index],
        "confidence": round(confidence, 4),
        "all_scores": {LABELS[i]: round(float(p), 4) for i, p in enumerate(predictions)},
    }
