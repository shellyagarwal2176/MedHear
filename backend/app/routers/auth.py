from fastapi import APIRouter, HTTPException
from datetime import datetime
from app.models.user import UserRegister, UserLogin
from app.database import users_collection
from app.utils.security import hash_password, verify_password, create_access_token
router = APIRouter(prefix="/auth", tags=["auth"])
@router.post("/register")
async def register(user: UserRegister):
    existing = await users_collection.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "name": user.name,
        "email": user.email,
        "password": hash_password(user.password),
        "role": user.role,
        "created_at": datetime.utcnow(),
    }
    result = await users_collection.insert_one(doc)
    token = create_access_token({"sub": str(result.inserted_id), "role": user.role})
    return {"access_token": token, "token_type": "bearer", "role": user.role}
@router.post("/login")
async def login(credentials: UserLogin):
    user = await users_collection.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": str(user["_id"]), "role": user["role"]})
    return {"access_token": token, "token_type": "bearer", "role": user["role"]}
