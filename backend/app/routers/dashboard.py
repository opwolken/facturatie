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


def get_month(date_str: str) -> str:
    """Get YYYY-MM from a date string YYYY-MM-DD."""
    try:
        return date_str[:7]
    except (ValueError, IndexError):
        return ""


def get_expense_amount_for_year(exp: dict, target_year: int) -> float:
    """Calculate the expense amount attributable to a given year.

    For normal expenses: full subtotaal if the expense year matches.
    For depreciated expenses: annual depreciation portion for each applicable year.
    """
    datum = exp.get("datum", "")
    exp_year = get_year(datum)

    if not exp.get("afschrijving"):
        # Normal expense: only counts in its own year
        return exp.get("subtotaal", 0) if exp_year == target_year else 0.0

    # Depreciation: spread over multiple years
    jaren = exp.get("afschrijving_jaren") or 1
    restwaarde = exp.get("afschrijving_restwaarde") or 0
    subtotaal = exp.get("subtotaal", 0)
    jaarlijks = (subtotaal - restwaarde) / jaren

    # Depreciation starts in the year of purchase and runs for `jaren` years
    if exp_year <= target_year < exp_year + jaren:
        return jaarlijks
    return 0.0


def get_expense_amount_for_month(exp: dict, target_year: int, target_month: str) -> float:
    """Calculate the expense amount attributable to a given month.

    For normal expenses: full subtotaal if the expense month matches.
    For depreciated expenses: monthly depreciation portion (annual / 12) for applicable months.
    """
    datum = exp.get("datum", "")
    exp_year = get_year(datum)
    exp_month = get_month(datum)

    if not exp.get("afschrijving"):
        return exp.get("subtotaal", 0) if exp_month == target_month else 0.0

    # Depreciation: spread evenly across months over multiple years
    jaren = exp.get("afschrijving_jaren") or 1
    restwaarde = exp.get("afschrijving_restwaarde") or 0
    subtotaal = exp.get("subtotaal", 0)
    maandelijks = (subtotaal - restwaarde) / jaren / 12

    if exp_year <= target_year < exp_year + jaren:
        return maandelijks
    return 0.0


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

    # Filter expenses by year (include all for depreciation calculation)
    expense_data = [
        exp for exp in all_expense_data
        if get_year(exp.get("datum", "")) == jaar and not exp.get("afschrijving")
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
    # Normal expenses + depreciation portions for this year
    totaal_uitgaven = sum(exp.get("subtotaal", 0) for exp in expense_data)
    totaal_uitgaven += sum(
        get_expense_amount_for_year(exp, jaar)
        for exp in all_expense_data
        if exp.get("afschrijving")
    )
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

    # Add depreciation portions per month
    for exp in all_expense_data:
        if exp.get("afschrijving"):
            for m in range(1, 13):
                month_key = f"{jaar}-{m:02d}"
                amount = get_expense_amount_for_month(exp, jaar, month_key)
                if amount > 0:
                    uitgaven_per_maand[month_key] += amount

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
    # Add depreciation portions
    for exp in all_expense_data:
        if exp.get("afschrijving"):
            amount = get_expense_amount_for_year(exp, jaar)
            if amount > 0:
                cat = exp.get("categorie", "Afschrijvingen") or "Afschrijvingen"
                categorie_totalen[cat] += amount
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
        # Use depreciation-aware amount for each expense
        wv_uitgaven += get_expense_amount_for_year(exp, jaar)

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
        # Use depreciation-aware amount for inkomstenbelasting
        subtotaal = get_expense_amount_for_year(exp, jaar)
        if subtotaal == 0:
            continue
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


@router.get("/winst-verlies")
async def winst_verlies_detail(
    jaar: Optional[int] = Query(None),
    user: dict = Depends(get_current_user),
):
    """Detailed profit & loss breakdown per person and category."""
    db = get_db()
    uid = user["uid"]

    if jaar is None:
        settings_doc = db.collection("company_settings").document(uid).get()
        settings = settings_doc.to_dict() if settings_doc.exists else {}
        jaar = settings.get("dashboard_jaar") or datetime.now(timezone.utc).year

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

    # Available years (include depreciation years)
    all_years = set()
    for inv in invoice_data:
        y = get_year(inv.get("factuurdatum", ""))
        if y:
            all_years.add(y)
    for exp in expense_data:
        y = get_year(exp.get("datum", ""))
        if y:
            all_years.add(y)
            if exp.get("afschrijving"):
                jaren = exp.get("afschrijving_jaren") or 1
                for offset in range(jaren):
                    all_years.add(y + offset)
    beschikbare_jaren = sorted(all_years, reverse=True)

    # Per-person income by client
    ink_per_klant_daan = defaultdict(float)
    ink_per_klant_wim = defaultdict(float)

    for inv in invoice_data:
        datum = inv.get("factuurdatum", "")
        if get_year(datum) != jaar or inv.get("status") not in ("verzonden", "betaald"):
            continue
        subtotaal = inv.get("subtotaal", 0)
        klant = inv.get("klant_naam", "Onbekend") or "Onbekend"
        eigenaar = inv.get("daan_of_wim") or "Beiden"
        if eigenaar == "Beiden":
            ink_per_klant_daan[klant] += subtotaal / 2
            ink_per_klant_wim[klant] += subtotaal / 2
        elif eigenaar == "Daan":
            ink_per_klant_daan[klant] += subtotaal
        elif eigenaar == "Wim":
            ink_per_klant_wim[klant] += subtotaal

    # Per-person expenses by category (depreciation-aware)
    uit_per_cat_daan = defaultdict(float)
    uit_per_cat_wim = defaultdict(float)

    for exp in expense_data:
        subtotaal = get_expense_amount_for_year(exp, jaar)
        if subtotaal == 0:
            continue
        categorie = exp.get("categorie", "Overig") or "Overig"
        if exp.get("afschrijving"):
            categorie = f"Afschrijving: {categorie}"
        eigenaar = exp.get("daan_of_wim") or "Beiden"
        if eigenaar == "Beiden":
            uit_per_cat_daan[categorie] += subtotaal / 2
            uit_per_cat_wim[categorie] += subtotaal / 2
        elif eigenaar == "Daan":
            uit_per_cat_daan[categorie] += subtotaal
        elif eigenaar == "Wim":
            uit_per_cat_wim[categorie] += subtotaal

    # Per-person monthly breakdown
    maand_daan = defaultdict(lambda: {"omzet": 0.0, "uitgaven": 0.0})
    maand_wim = defaultdict(lambda: {"omzet": 0.0, "uitgaven": 0.0})

    for inv in invoice_data:
        datum = inv.get("factuurdatum", "")
        if get_year(datum) != jaar or inv.get("status") not in ("verzonden", "betaald"):
            continue
        maand = datum[:7]  # YYYY-MM
        subtotaal = inv.get("subtotaal", 0)
        eigenaar = inv.get("daan_of_wim") or "Beiden"
        if eigenaar == "Beiden":
            maand_daan[maand]["omzet"] += subtotaal / 2
            maand_wim[maand]["omzet"] += subtotaal / 2
        elif eigenaar == "Daan":
            maand_daan[maand]["omzet"] += subtotaal
        elif eigenaar == "Wim":
            maand_wim[maand]["omzet"] += subtotaal

    for exp in expense_data:
        # Use depreciation-aware monthly amounts
        eigenaar = exp.get("daan_of_wim") or "Beiden"
        for m in range(1, 13):
            month_key = f"{jaar}-{m:02d}"
            subtotaal = get_expense_amount_for_month(exp, jaar, month_key)
            if subtotaal == 0:
                continue
            if eigenaar == "Beiden":
                maand_daan[month_key]["uitgaven"] += subtotaal / 2
                maand_wim[month_key]["uitgaven"] += subtotaal / 2
            elif eigenaar == "Daan":
                maand_daan[month_key]["uitgaven"] += subtotaal
            elif eigenaar == "Wim":
                maand_wim[month_key]["uitgaven"] += subtotaal

    # Build sorted lists
    def sorted_breakdown(d):
        return sorted(
            [{"naam": k, "bedrag": round(v, 2)} for k, v in d.items()],
            key=lambda x: x["bedrag"],
            reverse=True,
        )

    def sorted_maanden(d):
        all_months = []
        for m in range(1, 13):
            key = f"{jaar}-{m:02d}"
            vals = d.get(key, {"omzet": 0.0, "uitgaven": 0.0})
            all_months.append({
                "maand": key,
                "omzet": round(vals["omzet"], 2),
                "uitgaven": round(vals["uitgaven"], 2),
            })
        return all_months

    totaal_ink_daan = sum(ink_per_klant_daan.values())
    totaal_ink_wim = sum(ink_per_klant_wim.values())
    totaal_uit_daan = sum(uit_per_cat_daan.values())
    totaal_uit_wim = sum(uit_per_cat_wim.values())
    winst_daan = math.floor(totaal_ink_daan) - math.ceil(totaal_uit_daan)
    winst_wim = math.floor(totaal_ink_wim) - math.ceil(totaal_uit_wim)

    belasting_factor = 0.86 * (0.495 + 0.0532)
    bel_daan = round(winst_daan * belasting_factor)
    bel_wim = round(winst_wim * belasting_factor)

    return {
        "jaar": jaar,
        "beschikbare_jaren": beschikbare_jaren,
        "daan": {
            "omzet": math.floor(totaal_ink_daan),
            "uitgaven": math.ceil(totaal_uit_daan),
            "winst": winst_daan,
            "belasting": bel_daan,
            "netto": winst_daan - bel_daan,
            "omzet_per_klant": sorted_breakdown(ink_per_klant_daan),
            "uitgaven_per_categorie": sorted_breakdown(uit_per_cat_daan),
            "maandoverzicht": sorted_maanden(maand_daan),
        },
        "wim": {
            "omzet": math.floor(totaal_ink_wim),
            "uitgaven": math.ceil(totaal_uit_wim),
            "winst": winst_wim,
            "belasting": bel_wim,
            "netto": winst_wim - bel_wim,
            "omzet_per_klant": sorted_breakdown(ink_per_klant_wim),
            "uitgaven_per_categorie": sorted_breakdown(uit_per_cat_wim),
            "maandoverzicht": sorted_maanden(maand_wim),
        },
    }
