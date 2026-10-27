from pydantic import BaseModel, Field


class Profile(BaseModel):
    """Medical info a patient shares so the care team has context. All fields optional."""
    age: int | None = Field(default=None, ge=0, le=120)
    blood_group: str = Field(default="", max_length=5)
    allergies: str = Field(default="", max_length=300)
    conditions: str = Field(default="", max_length=300)
    medications: str = Field(default="", max_length=300)
    emergency_contact_name: str = Field(default="", max_length=80)
    emergency_contact_phone: str = Field(default="", max_length=20)
