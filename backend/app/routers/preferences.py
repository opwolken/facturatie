from fastapi import APIRouter, Depends
from firebase_admin import firestore
from pydantic import BaseModel
from typing import Dict, List, Optional

from app.auth import get_current_user

router = APIRouter()


class Preferences(BaseModel):
    columns_facturen: Optional[List[str]] = None
    columns_uitgaven: Optional[List[str]] = None
    columns_klanten: Optional[List[str]] = None


def get_db():
    return firestore.client()


@router.get("")
async def get_preferences(user: dict = Depends(get_current_user)):
    db = get_db()
    doc = db.collection("user_preferences").document(user["uid"]).get()
    if not doc.exists:
        return {}
    return doc.to_dict()


@router.put("")
async def update_preferences(
    preferences: Preferences, user: dict = Depends(get_current_user)
):
    db = get_db()
    data = {k: v for k, v in preferences.model_dump().items() if v is not None}
    data["user_id"] = user["uid"]
    db.collection("user_preferences").document(user["uid"]).set(data, merge=True)
    return data
