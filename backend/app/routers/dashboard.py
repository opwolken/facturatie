from fastapi import APIRouter, Depends
from firebase_admin import firestore
from google.cloud.firestore_v1 import FieldFilter
from datetime import datetime, timezone
from collections import defaultdict

from app.auth import get_current_user

router = APIRouter()


def get_db():
    return firestore.client()


@router.get("")
async def get_dashboard(user: dict = Depends(get_current_user)):
    db = get_db()
    uid = user["uid"]

    # Fetch all invoices
    invoices = list(
        db.collection("invoices")
        .where(filter=FieldFilter("user_id", "==", uid))
        .stream()
    )
    invoice_data = [doc.to_dict() for doc in invoices]

    # Fetch all expenses
    expenses = list(
        db.collection("expenses")
        .where(filter=FieldFilter("user_id", "==", uid))
        .stream()
    )
    expense_data = [doc.to_dict() for doc in expenses]

    # Calculate totals
    totaal_omzet = sum(
        inv.get("totaal", 0)
        for inv in invoice_data
        if inv.get("status") in ("verzonden", "betaald")
    )
    totaal_betaald = sum(
        inv.get("totaal", 0)
        for inv in invoice_data
        if inv.get("status") == "betaald"
    )
    totaal_openstaand = sum(
        inv.get("totaal", 0)
        for inv in invoice_data
        if inv.get("status") == "verzonden"
    )
    totaal_uitgaven = sum(exp.get("totaal", 0) for exp in expense_data)
    winst = totaal_betaald - totaal_uitgaven

    # Monthly revenue (last 12 months)
    omzet_per_maand = defaultdict(float)
    uitgaven_per_maand = defaultdict(float)

    for inv in invoice_data:
        if inv.get("status") in ("verzonden", "betaald") and inv.get("factuurdatum"):
            try:
                datum = inv["factuurdatum"][:7]  # YYYY-MM
                omzet_per_maand[datum] += inv.get("totaal", 0)
            except (ValueError, TypeError):
                pass

    for exp in expense_data:
        if exp.get("datum"):
            try:
                datum = exp["datum"][:7]
                uitgaven_per_maand[datum] += exp.get("totaal", 0)
            except (ValueError, TypeError):
                pass

    # Combine and sort months
    all_months = sorted(set(list(omzet_per_maand.keys()) + list(uitgaven_per_maand.keys())))[-12:]
    maandoverzicht = [
        {
            "maand": m,
            "omzet": round(omzet_per_maand.get(m, 0), 2),
            "uitgaven": round(uitgaven_per_maand.get(m, 0), 2),
        }
        for m in all_months
    ]

    # Expense categories
    categorie_totalen = defaultdict(float)
    for exp in expense_data:
        cat = exp.get("categorie", "Overig") or "Overig"
        categorie_totalen[cat] += exp.get("totaal", 0)
    categorieën = [
        {"categorie": k, "totaal": round(v, 2)}
        for k, v in sorted(categorie_totalen.items(), key=lambda x: -x[1])
    ]

    # Recent invoices
    recente_facturen = sorted(
        [{"id": doc.id, **doc.to_dict()} for doc in invoices],
        key=lambda x: x.get("created_at", ""),
        reverse=True,
    )[:5]

    # Recent expenses
    recente_uitgaven = sorted(
        [{"id": doc.id, **doc.to_dict()} for doc in expenses],
        key=lambda x: x.get("created_at", ""),
        reverse=True,
    )[:5]

    # Invoice status distribution
    status_verdeling = defaultdict(int)
    for inv in invoice_data:
        status_verdeling[inv.get("status", "concept")] += 1

    return {
        "totaal_omzet": round(totaal_omzet, 2),
        "totaal_betaald": round(totaal_betaald, 2),
        "totaal_openstaand": round(totaal_openstaand, 2),
        "totaal_uitgaven": round(totaal_uitgaven, 2),
        "winst": round(winst, 2),
        "aantal_facturen": len(invoice_data),
        "aantal_klanten": len(
            set(
                inv.get("klant_id")
                for inv in invoice_data
                if inv.get("klant_id")
            )
        ),
        "maandoverzicht": maandoverzicht,
        "categorieën": categorieën,
        "status_verdeling": dict(status_verdeling),
        "recente_facturen": recente_facturen,
        "recente_uitgaven": recente_uitgaven,
    }
