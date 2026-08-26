from pydantic import BaseModel, EmailStr
from typing import Literal
from datetime import datetime
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Literal["patient", "doctor"]
class UserLogin(BaseModel):
    email: EmailStr
    password: str
class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    created_at: datetime
