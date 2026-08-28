import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel
from pathlib import Path
import tensorflow as tf
import json

router = APIRouter(prefix="/predict", tags=["predict"])

MODEL_DIR = Path(__file__).parent.parent / "ml_model"
model = tf.keras.models.load_model(MODEL_DIR / "sign_model.keras")

with open(MODEL_DIR / "labels.json") as f:
    LABELS = json.load(f)

SEQUENCE_LENGTH = 30
FEATURES_PER_FRAME = 126


class LandmarkSequence(BaseModel):
    # A list of 30 frames, each frame a flat list of 63 floats (21 landmarks x,y,z)
    sequence: list[list[float]]


@router.post("/")
async def predict_sign(data: LandmarkSequence):
    X = np.array(data.sequence, dtype=np.float32)

    if X.shape != (SEQUENCE_LENGTH, FEATURES_PER_FRAME):
        return {
            "error": f"Expected shape ({SEQUENCE_LENGTH}, {FEATURES_PER_FRAME}), got {X.shape}"
        }

    X = np.expand_dims(X, axis=0)  # add batch dimension
    predictions = model.predict(X, verbose=0)[0]

    top_index = int(np.argmax(predictions))
    confidence = float(predictions[top_index])

    return {
        "sign": LABELS[top_index],
        "confidence": round(confidence, 4),
        "all_scores": {LABELS[i]: round(float(p), 4) for i, p in enumerate(predictions)},
    }