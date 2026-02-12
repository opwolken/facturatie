from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import firestore
from google.cloud.firestore_v1 import FieldFilter
from datetime import datetime, timezone

from app.auth import get_current_user
from app.models.customer import CustomerCreate, CustomerUpdate

router = APIRouter()


def get_db():
    return firestore.client()


@router.get("")
async def list_customers(user: dict = Depends(get_current_user)):
    db = get_db()
    docs = (
        db.collection("customers")
        .where(filter=FieldFilter("user_id", "==", user["uid"]))
        .order_by("bedrijfsnaam")
        .stream()
    )
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


@router.get("/{customer_id}")
async def get_customer(customer_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = db.collection("customers").document(customer_id).get()
    if not doc.exists or doc.to_dict().get("user_id") != user["uid"]:
        raise HTTPException(status_code=404, detail="Klant niet gevonden")
    return {"id": doc.id, **doc.to_dict()}


@router.post("")
async def create_customer(
    customer: CustomerCreate, user: dict = Depends(get_current_user)
):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    data = {
        **customer.model_dump(),
        "user_id": user["uid"],
        "created_at": now,
        "updated_at": now,
    }
    doc_ref = db.collection("customers").add(data)
    return {"id": doc_ref[1].id, **data}


@router.put("/{customer_id}")
async def update_customer(
    customer_id: str,
    customer: CustomerUpdate,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    doc_ref = db.collection("customers").document(customer_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("user_id") != user["uid"]:
        raise HTTPException(status_code=404, detail="Klant niet gevonden")

    now = datetime.now(timezone.utc).isoformat()
    data = {**customer.model_dump(), "updated_at": now}
    doc_ref.update(data)
    return {"id": customer_id, **doc.to_dict(), **data}


@router.delete("/{customer_id}")
async def delete_customer(customer_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc_ref = db.collection("customers").document(customer_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("user_id") != user["uid"]:
        raise HTTPException(status_code=404, detail="Klant niet gevonden")
    doc_ref.delete()
    return {"ok": True}
