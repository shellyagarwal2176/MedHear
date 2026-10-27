import json
import re
from pathlib import Path

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.utils.features import RAW_FEATURES
from app.utils.security import get_current_user

router = APIRouter(prefix="/teach", tags=["teach"])

# Recordings captured through the live camera, kept as raw landmark frames (the same numbers /predict receives)
# so training sees exactly what the detector will see. backend/ml/train.py reads these.
LIVE_DIR = Path(__file__).resolve().parent.parent.parent / "ml" / "live_data"
LABEL_RE = re.compile(r"^[a-z][a-z ]{1,30}$")


class Take(BaseModel):
    label: str
    sequence: list[list[float]] = Field(min_length=10, max_length=600)


@router.post("")
async def save_take(take: Take, user: dict = Depends(get_current_user)):
    if not LABEL_RE.match(take.label):
        raise HTTPException(status_code=422, detail="Invalid sign name")
    frames = np.array(take.sequence, dtype=np.float32)
    if frames.ndim != 2 or frames.shape[1] != RAW_FEATURES:
        raise HTTPException(status_code=422, detail=f"Each frame needs {RAW_FEATURES} numbers")
    LIVE_DIR.mkdir(exist_ok=True)
    path = LIVE_DIR / f"{take.label.replace(' ', '_')}.jsonl"
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(frames.round(3).tolist()) + "\n")
    takes = sum(1 for _ in open(path, encoding="utf-8"))
    return {"label": take.label, "frames": len(frames), "takes": takes}
