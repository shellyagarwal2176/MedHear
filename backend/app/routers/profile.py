from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.database import users_collection
from app.models.profile import Profile
from app.utils.security import get_current_user

router = APIRouter(prefix="/profile", tags=["profile"])


def _require_patient(user: dict):
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Only patients have a medical profile")


@router.get("")
async def get_profile(user: dict = Depends(get_current_user)):
    _require_patient(user)
    doc = await users_collection.find_one({"_id": ObjectId(user["id"])})
    return Profile(**(doc or {}).get("profile", {})).model_dump()


@router.put("")
async def save_profile(profile: Profile, user: dict = Depends(get_current_user)):
    _require_patient(user)
    await users_collection.update_one({"_id": ObjectId(user["id"])}, {"$set": {"profile": profile.model_dump()}})
    return profile.model_dump()
