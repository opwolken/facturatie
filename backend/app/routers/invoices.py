from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from firebase_admin import firestore, storage
from google.cloud.firestore_v1 import FieldFilter
from datetime import datetime, timezone
import io

from app.auth import get_current_user
from app.models.invoice import InvoiceCreate, InvoiceUpdate
from app.services.pdf_generator import generate_invoice_pdf
from app.services.email_service import send_invoice_email

router = APIRouter()


def get_db():
    return firestore.client()


def calculate_totals(regels: list[dict]) -> tuple[float, float, float]:
    subtotaal = 0
    btw_totaal = 0
    for regel in regels:
        regel_totaal = regel["aantal"] * regel["tarief"]
        regel["totaal"] = round(regel_totaal, 2)
        subtotaal += regel_totaal
        btw_totaal += regel_totaal * (regel["btw_percentage"] / 100)
    return round(subtotaal, 2), round(btw_totaal, 2), round(subtotaal + btw_totaal, 2)


def generate_factuurnummer(db, user_id: str) -> str:
    settings_ref = db.collection("company_settings").document(user_id)
    settings = settings_ref.get()
    if settings.exists:
        data = settings.to_dict()
        prefix = data.get("factuur_prefix", "F")
        nummer = data.get("volgende_factuurnummer", 1)
        settings_ref.update({"volgende_factuurnummer": nummer + 1})
    else:
        prefix = "F"
        nummer = 1
        settings_ref.set(
            {
                "factuur_prefix": prefix,
                "volgende_factuurnummer": 2,
                "user_id": user_id,
            }
        )
    return f"{prefix}{str(nummer).zfill(4)}"


@router.get("")
async def list_invoices(user: dict = Depends(get_current_user)):
    db = get_db()
    docs = (
        db.collection("invoices")
        .where(filter=FieldFilter("user_id", "==", user["uid"]))
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .stream()
    )
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


@router.get("/{invoice_id}")
async def get_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = db.collection("invoices").document(invoice_id).get()
    if not doc.exists or doc.to_dict().get("user_id") != user["uid"]:
        raise HTTPException(status_code=404, detail="Factuur niet gevonden")
    return {"id": doc.id, **doc.to_dict()}


@router.post("")
async def create_invoice(
    invoice: InvoiceCreate, user: dict = Depends(get_current_user)
):
    db = get_db()
    regels = [r.model_dump() for r in invoice.regels]
    subtotaal, btw_totaal, totaal = calculate_totals(regels)

    now = datetime.now(timezone.utc).isoformat()
    factuurnummer = generate_factuurnummer(db, user["uid"])

    data = {
        **invoice.model_dump(),
        "regels": regels,
        "factuurnummer": factuurnummer,
        "subtotaal": subtotaal,
        "btw_totaal": btw_totaal,
        "totaal": totaal,
        "user_id": user["uid"],
        "pdf_url": None,
        "verzonden_op": None,
        "betaald_op": None,
        "created_at": now,
        "updated_at": now,
    }
    doc_ref = db.collection("invoices").add(data)
    return {"id": doc_ref[1].id, **data}


@router.put("/{invoice_id}")
async def update_invoice(
    invoice_id: str,
    invoice: InvoiceUpdate,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    doc_ref = db.collection("invoices").document(invoice_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("user_id") != user["uid"]:
        raise HTTPException(status_code=404, detail="Factuur niet gevonden")

    update_data = invoice.model_dump(exclude_none=True)

    if "regels" in update_data:
        regels = update_data["regels"]
        subtotaal, btw_totaal, totaal = calculate_totals(regels)
        update_data["subtotaal"] = subtotaal
        update_data["btw_totaal"] = btw_totaal
        update_data["totaal"] = totaal

    if update_data.get("status") == "betaald":
        update_data["betaald_op"] = datetime.now(timezone.utc).isoformat()

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    doc_ref.update(update_data)

    updated = doc_ref.get()
    return {"id": invoice_id, **updated.to_dict()}


@router.delete("/{invoice_id}")
async def delete_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc_ref = db.collection("invoices").document(invoice_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("user_id") != user["uid"]:
        raise HTTPException(status_code=404, detail="Factuur niet gevonden")
    doc_ref.delete()
    return {"ok": True}


@router.post("/{invoice_id}/pdf")
async def generate_pdf(invoice_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = db.collection("invoices").document(invoice_id).get()
    if not doc.exists or doc.to_dict().get("user_id") != user["uid"]:
        raise HTTPException(status_code=404, detail="Factuur niet gevonden")

    invoice_data = doc.to_dict()

    # Get company settings
    settings_doc = db.collection("company_settings").document(user["uid"]).get()
    company = settings_doc.to_dict() if settings_doc.exists else {}

    pdf_bytes = generate_invoice_pdf(invoice_data, company)

    # Upload to Firebase Storage
    bucket = storage.bucket()
    blob = bucket.blob(f"invoices/{user['uid']}/{invoice_id}.pdf")
    blob.upload_from_string(pdf_bytes, content_type="application/pdf")
    blob.make_public()

    # Update invoice with PDF URL
    db.collection("invoices").document(invoice_id).update({"pdf_url": blob.public_url})

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{invoice_data["factuurnummer"]}.pdf"'
        },
    )


@router.post("/{invoice_id}/send")
async def send_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = db.collection("invoices").document(invoice_id).get()
    if not doc.exists or doc.to_dict().get("user_id") != user["uid"]:
        raise HTTPException(status_code=404, detail="Factuur niet gevonden")

    invoice_data = doc.to_dict()

    # Get customer email
    if not invoice_data.get("klant_id"):
        raise HTTPException(status_code=400, detail="Geen klant gekoppeld")

    klant_doc = db.collection("customers").document(invoice_data["klant_id"]).get()
    if not klant_doc.exists:
        raise HTTPException(status_code=404, detail="Klant niet gevonden")

    klant = klant_doc.to_dict()
    if not klant.get("email"):
        raise HTTPException(status_code=400, detail="Klant heeft geen e-mailadres")

    # Get company settings
    settings_doc = db.collection("company_settings").document(user["uid"]).get()
    company = settings_doc.to_dict() if settings_doc.exists else {}

    # Generate PDF if not exists
    pdf_bytes = generate_invoice_pdf(invoice_data, company)

    # Send email
    send_invoice_email(
        to_email=klant["email"],
        to_name=klant.get("contactpersoon", klant["bedrijfsnaam"]),
        invoice_data=invoice_data,
        company=company,
        pdf_bytes=pdf_bytes,
    )

    # Update status
    now = datetime.now(timezone.utc).isoformat()
    db.collection("invoices").document(invoice_id).update(
        {"status": "verzonden", "verzonden_op": now, "updated_at": now}
    )

    return {"ok": True, "message": "Factuur verzonden"}
