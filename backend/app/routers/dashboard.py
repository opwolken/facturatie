from fastapi import APIRouter, Depends, Query
from firebase_admin import firestore
from google.cloud.firestore_v1 import FieldFilter
from datetime import datetime, timezone
from collections import defaultdict
from typing import Optional
import math

from app.auth import get_current_user

router = APIRouter()


def get_db():
    return firestore.client()


def get_quarter(date_str: str) -> int:
    """Get quarter (1-4) from a date string YYYY-MM-DD."""
    try:
        month = int(date_str[5:7])
        return (month - 1) // 3 + 1
    except (ValueError, IndexError):
        return 0


def get_year(date_str: str) -> int:
    """Get year from a date string YYYY-MM-DD."""
    try:
        return int(date_str[:4])
    except (ValueError, IndexError):
        return 0


@router.get("")
async def get_dashboard(
    jaar: Optional[int] = Query(None),
    user: dict = Depends(get_current_user),
):
    db = get_db()
    uid = user["uid"]

    # Get settings for default year
    settings_doc = db.collection("company_settings").document(uid).get()
    settings = settings_doc.to_dict() if settings_doc.exists else {}

    if jaar is None:
        jaar = settings.get("dashboard_jaar") or datetime.now(timezone.utc).year

    # Fetch all invoices
    invoices = list(
        db.collection("invoices")
        .where(filter=FieldFilter("user_id", "==", uid))
        .stream()
    )
    all_invoice_data = [doc.to_dict() for doc in invoices]

    # Filter invoices by year
    invoice_data = [
        inv for inv in all_invoice_data
        if get_year(inv.get("factuurdatum", "")) == jaar
    ]

    # Fetch all expenses
    expenses = list(
        db.collection("expenses")
        .where(filter=FieldFilter("user_id", "==", uid))
        .stream()
    )
    all_expense_data = [doc.to_dict() for doc in expenses]

    # Filter expenses by year
    expense_data = [
        exp for exp in all_expense_data
        if get_year(exp.get("datum", "")) == jaar
    ]

    # Calculate totals (excl BTW for financial reporting)
    totaal_omzet = sum(
        inv.get("subtotaal", 0)
        for inv in invoice_data
        if inv.get("status") in ("verzonden", "betaald")
    )
    totaal_betaald = sum(
        inv.get("subtotaal", 0)
        for inv in invoice_data
        if inv.get("status") == "betaald"
    )
    totaal_openstaand = sum(
        inv.get("totaal", 0)
        for inv in invoice_data
        if inv.get("status") == "verzonden"
    )
    totaal_uitgaven = sum(exp.get("subtotaal", 0) for exp in expense_data)
    winst = totaal_betaald - totaal_uitgaven

    # Monthly revenue (last 12 months)
    omzet_per_maand = defaultdict(float)
    uitgaven_per_maand = defaultdict(float)

    for inv in invoice_data:
        if inv.get("status") in ("verzonden", "betaald") and inv.get("factuurdatum"):
            try:
                datum = inv["factuurdatum"][:7]  # YYYY-MM
                omzet_per_maand[datum] += inv.get("subtotaal", 0)
            except (ValueError, TypeError):
                pass

    for exp in expense_data:
        if exp.get("datum"):
            try:
                datum = exp["datum"][:7]
                uitgaven_per_maand[datum] += exp.get("subtotaal", 0)
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
        categorie_totalen[cat] += exp.get("subtotaal", 0)
    categorieën = [
        {"categorie": k, "totaal": round(v, 2)}
        for k, v in sorted(categorie_totalen.items(), key=lambda x: -x[1])
    ]

    # Recent invoices (filtered by year)
    recente_facturen = sorted(
        [
            {"id": doc.id, **doc.to_dict()}
            for doc in invoices
            if get_year(doc.to_dict().get("factuurdatum", "")) == jaar
        ],
        key=lambda x: x.get("created_at", ""),
        reverse=True,
    )[:5]

    # Recent expenses (filtered by year)
    recente_uitgaven = sorted(
        [
            {"id": doc.id, **doc.to_dict()}
            for doc in expenses
            if get_year(doc.to_dict().get("datum", "")) == jaar
        ],
        key=lambda x: x.get("created_at", ""),
        reverse=True,
    )[:5]

    # Invoice status distribution
    status_verdeling = defaultdict(int)
    for inv in invoice_data:
        status_verdeling[inv.get("status", "concept")] += 1

    # Collect available years from all data
    beschikbare_jaren = sorted(set(
        [get_year(inv.get("factuurdatum", "")) for inv in all_invoice_data if get_year(inv.get("factuurdatum", "")) > 0] +
        [get_year(exp.get("datum", "")) for exp in all_expense_data if get_year(exp.get("datum", "")) > 0]
    ), reverse=True)

    return {
        "jaar": jaar,
        "beschikbare_jaren": beschikbare_jaren,
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


@router.get("/financieel")
async def get_financieel_dashboard(
    jaar: Optional[int] = Query(None),
    kwartaal: Optional[int] = Query(None),
    user: dict = Depends(get_current_user),
):
    db = get_db()
    uid = user["uid"]

    # Get settings for default year/quarter
    settings_doc = db.collection("company_settings").document(uid).get()
    settings = settings_doc.to_dict() if settings_doc.exists else {}

    if jaar is None:
        jaar = settings.get("dashboard_jaar") or datetime.now(timezone.utc).year
    if kwartaal is None:
        kwartaal = settings.get("dashboard_kwartaal") or get_quarter(
            datetime.now(timezone.utc).strftime("%Y-%m-%d")
        )

    # Fetch all invoices (inkomsten)
    invoices = list(
        db.collection("invoices")
        .where(filter=FieldFilter("user_id", "==", uid))
        .stream()
    )
    invoice_data = [doc.to_dict() for doc in invoices]

    # Fetch all expenses (uitgaven)
    expenses = list(
        db.collection("expenses")
        .where(filter=FieldFilter("user_id", "==", uid))
        .stream()
    )
    expense_data = [doc.to_dict() for doc in expenses]

    # === WINST & VERLIES (filtered by year) ===
    wv_inkomsten = 0.0
    wv_uitgaven = 0.0

    for inv in invoice_data:
        datum = inv.get("factuurdatum", "")
        if get_year(datum) == jaar and inv.get("status") in ("verzonden", "betaald"):
            wv_inkomsten += inv.get("subtotaal", 0)

    for exp in expense_data:
        datum = exp.get("datum", "")
        if get_year(datum) == jaar:
            wv_uitgaven += exp.get("subtotaal", 0)

    wv_winst = wv_inkomsten - wv_uitgaven

    # === BTW (filtered by year AND quarter) ===
    btw_omzet = 0.0  # 1a - omzet excl btw
    btw_omzet_btw = 0.0  # btw over 1a
    btw_inkoop = 0.0  # 5b - inkoop excl btw
    btw_inkoop_btw = 0.0  # btw over 5b

    for inv in invoice_data:
        datum = inv.get("factuurdatum", "")
        if (
            get_year(datum) == jaar
            and get_quarter(datum) == kwartaal
            and inv.get("status") in ("verzonden", "betaald")
        ):
            btw_omzet += inv.get("subtotaal", 0)
            btw_omzet_btw += inv.get("btw_totaal", 0)

    for exp in expense_data:
        datum = exp.get("datum", "")
        if get_year(datum) == jaar and get_quarter(datum) == kwartaal:
            btw_inkoop += exp.get("subtotaal", 0)
            btw_inkoop_btw += exp.get("btw", 0)

    btw_verschil = math.floor(btw_omzet_btw) - math.ceil(btw_inkoop_btw)

    # === INKOMSTENBELASTING (filtered by year, split by daan_of_wim) ===
    ink_daan = 0.0
    ink_wim = 0.0
    uit_daan = 0.0
    uit_wim = 0.0

    for inv in invoice_data:
        datum = inv.get("factuurdatum", "")
        if get_year(datum) == jaar and inv.get("status") in ("verzonden", "betaald"):
            subtotaal = inv.get("subtotaal", 0)
            eigenaar = inv.get("daan_of_wim") or "Beiden"
            if eigenaar == "Beiden":
                ink_daan += subtotaal / 2
                ink_wim += subtotaal / 2
            elif eigenaar == "Daan":
                ink_daan += subtotaal
            elif eigenaar == "Wim":
                ink_wim += subtotaal

    for exp in expense_data:
        datum = exp.get("datum", "")
        if get_year(datum) == jaar:
            subtotaal = exp.get("subtotaal", 0)
            eigenaar = exp.get("daan_of_wim") or "Beiden"
            if eigenaar == "Beiden":
                uit_daan += subtotaal / 2
                uit_wim += subtotaal / 2
            elif eigenaar == "Daan":
                uit_daan += subtotaal
            elif eigenaar == "Wim":
                uit_wim += subtotaal

    winst_daan = math.floor(ink_daan) - math.ceil(uit_daan)
    winst_wim = math.floor(ink_wim) - math.ceil(uit_wim)

    # Belasting: winst * 0.86 (MKB winstvrijstelling) * (0.495 + 0.0532) (IB + premies)
    belasting_factor = 0.86 * (0.495 + 0.0532)
    bel_daan = round(winst_daan * belasting_factor)
    bel_wim = round(winst_wim * belasting_factor)

    return {
        "winst_verlies": {
            "jaar": jaar,
            "inkomsten": round(wv_inkomsten, 2),
            "uitgaven": round(wv_uitgaven, 2),
            "winst": round(wv_winst, 2),
        },
        "btw": {
            "jaar": jaar,
            "kwartaal": kwartaal,
            "omzet": math.floor(btw_omzet),
            "omzet_btw": math.floor(btw_omzet_btw),
            "inkoop": math.ceil(btw_inkoop),
            "inkoop_btw": math.ceil(btw_inkoop_btw),
            "verschil": btw_verschil,
        },
        "inkomstenbelasting": {
            "jaar": jaar,
            "ink_daan": math.floor(ink_daan),
            "ink_wim": math.floor(ink_wim),
            "uit_daan": math.ceil(uit_daan),
            "uit_wim": math.ceil(uit_wim),
            "winst_daan": winst_daan,
            "winst_wim": winst_wim,
            "bel_daan": bel_daan,
            "bel_wim": bel_wim,
        },
    }
