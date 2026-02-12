from fastapi import APIRouter, Depends
from firebase_admin import firestore
from pydantic import BaseModel
from typing import Optional

from app.auth import get_current_user

router = APIRouter()


class CompanySettings(BaseModel):
    bedrijfsnaam: Optional[str] = ""
    adres: Optional[str] = ""
    postcode: Optional[str] = ""
    plaats: Optional[str] = ""
    kvk_nummer: Optional[str] = ""
    btw_nummer: Optional[str] = ""
    iban: Optional[str] = ""
    email: Optional[str] = ""
    telefoon: Optional[str] = ""
    website: Optional[str] = ""
    factuur_prefix: Optional[str] = "F"


def get_db():
    return firestore.client()


@router.get("")
async def get_settings(user: dict = Depends(get_current_user)):
    db = get_db()
    doc = db.collection("company_settings").document(user["uid"]).get()
    if not doc.exists:
        return {}
    return doc.to_dict()


@router.put("")
async def update_settings(
    settings: CompanySettings, user: dict = Depends(get_current_user)
):
    db = get_db()
    data = {**settings.model_dump(), "user_id": user["uid"]}
    db.collection("company_settings").document(user["uid"]).set(data, merge=True)
    return data
