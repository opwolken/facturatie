from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from firebase_admin import firestore, storage
from google.cloud.firestore_v1 import FieldFilter
from datetime import datetime, timezone

from app.auth import get_current_user
from app.models.expense import ExpenseCreate, ExpenseUpdate
from app.services.pdf_parser import extract_expense_data

router = APIRouter()


def get_db():
    return firestore.client()


@router.get("")
async def list_expenses(user: dict = Depends(get_current_user)):
    db = get_db()
    docs = (
        db.collection("expenses")
        .where(filter=FieldFilter("user_id", "==", user["uid"]))
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .stream()
    )
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


@router.get("/{expense_id}")
async def get_expense(expense_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = db.collection("expenses").document(expense_id).get()
    if not doc.exists or doc.to_dict().get("user_id") != user["uid"]:
        raise HTTPException(status_code=404, detail="Uitgave niet gevonden")
    return {"id": doc.id, **doc.to_dict()}


@router.post("/upload")
async def upload_expense(
    file: UploadFile = File(...), user: dict = Depends(get_current_user)
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Alleen PDF bestanden toegestaan")

    contents = await file.read()

    # Upload to Firebase Storage
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    bucket = storage.bucket()
    blob = bucket.blob(f"expenses/{user['uid']}/{now}_{file.filename}")
    blob.upload_from_string(contents, content_type="application/pdf")
    blob.make_public()

    # Extract data from PDF
    extracted = extract_expense_data(contents)

    # Create expense record
    data = {
        "leverancier": extracted.get("leverancier", ""),
        "factuurnummer": extracted.get("factuurnummer", ""),
        "datum": extracted.get("datum", ""),
        "categorie": extracted.get("categorie", ""),
        "beschrijving": extracted.get("beschrijving", ""),
        "subtotaal": extracted.get("subtotaal", 0),
        "btw": extracted.get("btw", 0),
        "totaal": extracted.get("totaal", 0),
        "status": "nieuw",
        "pdf_url": blob.public_url,
        "user_id": user["uid"],
        "created_at": now,
        "updated_at": now,
    }
    doc_ref = db.collection("expenses").add(data)
    return {"id": doc_ref[1].id, **data, "methode": extracted.get("methode", "regex")}


@router.post("")
async def create_expense(
    expense: ExpenseCreate, user: dict = Depends(get_current_user)
):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    data = {
        **expense.model_dump(),
        "pdf_url": None,
        "user_id": user["uid"],
        "created_at": now,
        "updated_at": now,
    }
    doc_ref = db.collection("expenses").add(data)
    return {"id": doc_ref[1].id, **data}


@router.put("/{expense_id}")
async def update_expense(
    expense_id: str,
    expense: ExpenseUpdate,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    doc_ref = db.collection("expenses").document(expense_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("user_id") != user["uid"]:
        raise HTTPException(status_code=404, detail="Uitgave niet gevonden")

    now = datetime.now(timezone.utc).isoformat()
    data = {**expense.model_dump(), "updated_at": now}
    doc_ref.update(data)
    return {"id": expense_id, **doc.to_dict(), **data}


@router.delete("/{expense_id}")
async def delete_expense(expense_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc_ref = db.collection("expenses").document(expense_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("user_id") != user["uid"]:
        raise HTTPException(status_code=404, detail="Uitgave niet gevonden")
    doc_ref.delete()
    return {"ok": True}
