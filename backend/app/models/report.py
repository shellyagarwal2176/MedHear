from typing import Literal

from pydantic import BaseModel, Field, model_validator


class ReportItem(BaseModel):
    part: str | None = Field(default=None, max_length=40)  # body part id, e.g. "right-hand"; None = general
    level: int | None = Field(default=None, ge=1, le=5)  # 1 = mild ... 5 = unbearable
    sign: str | None = Field(default=None, max_length=40)  # recognised or tapped sign, e.g. "pain"
    confidence: float | None = Field(default=None, ge=0, le=1)  # model confidence; None if the patient tapped it

    @model_validator(mode="after")
    def needs_part_or_sign(self):
        if not self.part and not self.sign:
            raise ValueError("an item needs a body part or a sign")
        return self


class ReportCreate(BaseModel):
    items: list[ReportItem] = Field(min_length=1, max_length=40)


class ReportReview(BaseModel):
    doctor_notes: str | None = Field(default=None, max_length=2000)
    status: Literal["pending", "confirmed"] | None = None


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=200)
