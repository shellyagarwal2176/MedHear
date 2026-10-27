from datetime import datetime

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException

from app.database import reports_collection, users_collection
from app.models.report import MessageIn, ReportCreate, ReportReview
from app.utils.insights import analyze
from app.utils.security import get_current_user

router = APIRouter(prefix="/reports", tags=["reports"])


def _serialize(doc: dict) -> dict:
    # Reports saved before the AI-assisted summary existed are analysed on the fly
    if "priority" not in doc:
        analysis = analyze(doc["items"])
        doc = {**doc, "message": doc.get("message") or analysis["message"], "insights": analysis["insights"],
               "priority": analysis["priority"], "priority_reasons": analysis["priority_reasons"]}
    return {
        "id": str(doc["_id"]),
        "patient_name": doc.get("patient_name", "Unknown"),
        "items": doc["items"],
        "message": doc.get("message", ""),
        "insights": doc.get("insights", []),
        "priority": doc.get("priority", "routine"),
        "priority_reasons": doc.get("priority_reasons", []),
        "sos": doc.get("sos", False),
        "profile": doc.get("profile"),
        "messages": doc.get("messages", []),
        "status": doc.get("status", "pending"),
        "doctor_notes": doc.get("doctor_notes", ""),
        "confirmed_by": doc.get("confirmed_by"),
        "confirmed_at": doc.get("confirmed_at"),
        "created_at": doc["created_at"],
    }


def _require_role(user: dict, role: str):
    if user["role"] != role:
        raise HTTPException(status_code=403, detail=f"Only {role}s can do this")


async def _save_report(user: dict, items: list[dict], sos: bool = False) -> dict:
    patient = await users_collection.find_one({"_id": ObjectId(user["id"])})
    analysis = analyze(items, sos=sos)
    doc = {
        "patient_id": user["id"],
        "patient_name": patient["name"] if patient else "Unknown",
        "profile": (patient or {}).get("profile"),  # snapshot, so the doctor sees what the patient shared then
        "items": items,
        "message": analysis["message"],
        "insights": analysis["insights"],
        "priority": analysis["priority"],
        "priority_reasons": analysis["priority_reasons"],
        "sos": sos,
        "status": "pending",
        "doctor_notes": "",
        "created_at": datetime.utcnow(),
    }
    result = await reports_collection.insert_one(doc)
    return {"id": str(result.inserted_id), "message": analysis["message"], "priority": analysis["priority"]}


@router.post("/preview")
async def preview_report(data: ReportCreate, user: dict = Depends(get_current_user)):
    """What the care team will read for these items. Nothing is saved."""
    _require_role(user, "patient")
    return analyze([item.model_dump() for item in data.items])


@router.post("")
async def create_report(data: ReportCreate, user: dict = Depends(get_current_user)):
    _require_role(user, "patient")
    return await _save_report(user, [item.model_dump() for item in data.items])


@router.post("/sos")
async def send_sos(user: dict = Depends(get_current_user)):
    """One-tap emergency alert for the care team."""
    _require_role(user, "patient")
    items = [{"part": None, "level": None, "sign": "help", "confidence": None},
             {"part": None, "level": None, "sign": "assistance", "confidence": None}]
    return await _save_report(user, items, sos=True)


@router.get("/mine")
async def my_reports(user: dict = Depends(get_current_user)):
    _require_role(user, "patient")
    cursor = reports_collection.find({"patient_id": user["id"]}).sort("created_at", -1).limit(100)
    return [_serialize(d) async for d in cursor]


@router.get("")
async def all_reports(user: dict = Depends(get_current_user)):
    _require_role(user, "doctor")
    cursor = reports_collection.find().sort("created_at", -1).limit(200)
    return [_serialize(d) async for d in cursor]


@router.patch("/{report_id}")
async def review_report(report_id: str, review: ReportReview, user: dict = Depends(get_current_user)):
    _require_role(user, "doctor")
    try:
        oid = ObjectId(report_id)
    except InvalidId:
        raise HTTPException(status_code=404, detail="Report not found")

    updates: dict = {}
    if review.doctor_notes is not None:
        updates["doctor_notes"] = review.doctor_notes.strip()
    if review.status is not None:
        updates["status"] = review.status
        if review.status == "confirmed":
            doctor = await users_collection.find_one({"_id": ObjectId(user["id"])})
            updates["confirmed_by"] = doctor["name"] if doctor else "Healthcare professional"
            updates["confirmed_at"] = datetime.utcnow()
        else:
            updates["confirmed_by"] = None
            updates["confirmed_at"] = None
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")

    result = await reports_collection.update_one({"_id": oid}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")

    return _serialize(await reports_collection.find_one({"_id": oid}))


async def _report_for(report_id: str, user: dict) -> dict:
    """The report, if this user may take part in its conversation (the owning patient, or any doctor)."""
    try:
        oid = ObjectId(report_id)
    except InvalidId:
        raise HTTPException(status_code=404, detail="Report not found")
    report = await reports_collection.find_one({"_id": oid})
    if not report or (user["role"] == "patient" and report["patient_id"] != user["id"]):
        raise HTTPException(status_code=404, detail="Report not found")
    return report


async def _mark_seen(oid, reader_role: str):
    other = "doctor" if reader_role == "patient" else "patient"
    # "messages.0" must exist or MongoDB rejects the array update (a report's first message has nothing to mark)
    await reports_collection.update_one(
        {"_id": oid, "messages.0": {"$exists": True}},
        {"$set": {"messages.$[m].seen": True}},
        array_filters=[{"m.from": other}],
    )


@router.post("/{report_id}/messages")
async def send_message(report_id: str, data: MessageIn, user: dict = Depends(get_current_user)):
    """Doctor <-> patient conversation on a report. Replying also marks the other side's messages as seen."""
    report = await _report_for(report_id, user)
    sender = await users_collection.find_one({"_id": ObjectId(user["id"])})
    message = {
        "id": str(ObjectId()),
        "from": user["role"],
        "name": sender["name"] if sender else user["role"],
        "text": data.text.strip(),
        "at": datetime.utcnow(),
        "seen": False,
    }
    await _mark_seen(report["_id"], user["role"])
    await reports_collection.update_one({"_id": report["_id"]}, {"$push": {"messages": message}})
    return _serialize(await reports_collection.find_one({"_id": report["_id"]}))


@router.post("/{report_id}/messages/seen")
async def mark_messages_seen(report_id: str, user: dict = Depends(get_current_user)):
    report = await _report_for(report_id, user)
    await _mark_seen(report["_id"], user["role"])
    return _serialize(await reports_collection.find_one({"_id": report["_id"]}))
