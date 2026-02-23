"""Bank matching router - match bank transactions to invoices for payment dates & IBANs."""

import re
from datetime import datetime, timezone
from difflib import SequenceMatcher

from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import firestore
from google.cloud.firestore_v1 import FieldFilter
from pydantic import BaseModel
from typing import Optional

from app.auth import get_current_user

router = APIRouter()


def get_db():
    return firestore.client()


# === Normalization helpers ===

def normalize_factuurnummer(nr: str) -> str:
    """
    Normalize a factuurnummer for matching:
    Remove dots, spaces, dashes, leading zeros after prefix.
    E.g. "F.2024.001" -> "f2024001", "F 2024-001" -> "f2024001"
    """
    if not nr:
        return ""
    # Lowercase, strip whitespace
    s = nr.strip().lower()
    # Remove dots, spaces, dashes, slashes
    s = re.sub(r'[\s.\-/]', '', s)
    return s


def extract_factuurnummers_from_text(text: str) -> list[str]:
    """
    Extract potential invoice numbers from bank transaction text (mededelingen/omschrijving).
    Looks for patterns like F0001, F.2024.001, 2024-001, etc.
    Returns normalized versions.
    """
    if not text:
        return []

    results = []
    # Match typical invoice number patterns:
    # F0001, F.0001, F-0001, F 0001
    # F2024.001, F.2024.001
    # 2024-001, 2024.001
    # Also bare numbers like 0001
    patterns = [
        r'[A-Za-z]{1,3}[\s.\-/]?\d{4}[\s.\-/]?\d{1,4}',  # F2024001, F.2024.001
        r'[A-Za-z]{1,3}[\s.\-/]?\d{1,6}',                   # F0001, F001
        r'\d{4}[\s.\-/]\d{1,4}',                              # 2024-001, 2024.001
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text):
            results.append(normalize_factuurnummer(match.group()))

    return results


def compute_match_score(invoice: dict, transaction: dict) -> float:
    """
    Compute a matching score (0-100) between an invoice and a bank transaction.
    Considers: amount match, factuurnummer in mededelingen, customer name in omschrijving, date proximity.
    """
    score = 0.0

    inv_totaal = abs(invoice.get("totaal", 0))
    tx_bedrag = abs(transaction.get("bedrag", 0))

    # --- Amount match (max 40 points) ---
    if inv_totaal > 0 and tx_bedrag > 0:
        ratio = min(inv_totaal, tx_bedrag) / max(inv_totaal, tx_bedrag)
        if abs(inv_totaal - tx_bedrag) < 0.01:
            score += 40  # exact match
        elif ratio > 0.95:
            score += 35
        elif ratio > 0.8:
            score += 20
        elif ratio > 0.5:
            score += 10

    # --- Factuurnummer in mededelingen/omschrijving (max 35 points) ---
    inv_nr = normalize_factuurnummer(invoice.get("factuurnummer", ""))
    mededelingen = (transaction.get("mededelingen", "") or "").lower()
    omschrijving = (transaction.get("omschrijving", "") or "").lower()
    combined_text = f"{mededelingen} {omschrijving}"

    extracted_nrs = extract_factuurnummers_from_text(combined_text)
    if inv_nr and inv_nr in extracted_nrs:
        score += 35
    elif inv_nr and inv_nr in normalize_factuurnummer(combined_text):
        score += 30
    elif inv_nr:
        # Fuzzy match on the invoice number
        best_ratio = 0
        for ex_nr in extracted_nrs:
            r = SequenceMatcher(None, inv_nr, ex_nr).ratio()
            best_ratio = max(best_ratio, r)
        # Also try against the full normalized text
        norm_text = normalize_factuurnummer(combined_text)
        if inv_nr in norm_text:
            best_ratio = max(best_ratio, 0.9)
        score += best_ratio * 25

    # --- Customer name in omschrijving (max 15 points) ---
    klant_naam = (invoice.get("klant_naam", "") or "").lower().strip()
    if klant_naam and len(klant_naam) > 2:
        if klant_naam in omschrijving:
            score += 15
        else:
            # Try partial name matching
            name_parts = klant_naam.split()
            matches = sum(1 for part in name_parts if len(part) > 2 and part in omschrijving)
            if name_parts:
                score += (matches / len(name_parts)) * 12

    # --- Date proximity (max 20 points) ---
    # Smooth curve: closer payment dates score much higher.
    # Typical payment is 14-30 days after invoice. Payment before invoice = unlikely.
    inv_date = invoice.get("factuurdatum", "")
    tx_date = transaction.get("datum", "")
    if inv_date and tx_date:
        try:
            d_inv = datetime.strptime(inv_date, "%Y-%m-%d")
            d_tx = datetime.strptime(tx_date, "%Y-%m-%d")
            days_diff = (d_tx - d_inv).days  # positive = payment after invoice

            if days_diff < -7:
                # Payment well before invoice date — very unlikely match
                score += 0
            elif days_diff < 0:
                # Payment slightly before invoice (up to 7 days) — rare but possible
                score += 3
            elif days_diff <= 90:
                # Smooth decay: 20 points at 0 days, ~17 at 14d, ~13 at 30d, ~5 at 90d
                score += max(0, 20 * (1 - (days_diff / 120) ** 0.8))
            elif days_diff <= 365:
                # Long overdue but still possible
                score += max(0, 4 * (1 - (days_diff - 90) / 275))
            # > 365 days: 0 points
        except ValueError:
            pass

    return round(score, 1)


# === Pydantic models ===

class ManualMatchRequest(BaseModel):
    invoice_id: str
    transaction_ids: list[str]  # Support multiple transactions for partial payments


class PartialPaymentRequest(BaseModel):
    invoice_id: str
    transaction_ids: list[str]


class MatchResult(BaseModel):
    invoice_id: str
    factuurnummer: str
    klant_naam: str
    totaal: float
    status: str  # "matched", "partial", "unmatched"
    matched_transactions: list[dict] = []
    suggestions: list[dict] = []  # top 5 suggestions for unmatched
    matched_amount: float = 0
    remaining_amount: float = 0


# === Endpoints ===

@router.post("/run")
async def run_matching(user: dict = Depends(get_current_user)):
    """
    Run automatic matching of bank transactions to invoices.
    Returns matched, partially matched, and unmatched invoices with suggestions.
    Also updates customer IBANs from matched transactions.
    """
    db = get_db()
    uid = user["uid"]

    # Load all invoices (only verzonden/betaald - not concept)
    inv_docs = list(
        db.collection("invoices")
        .where(filter=FieldFilter("user_id", "==", uid))
        .stream()
    )
    all_invoices = [{"id": doc.id, **doc.to_dict()} for doc in inv_docs]

    # Filter to invoices that are not yet paid (verzonden status) or betaald without betaald_op date
    matchable_invoices = [
        inv for inv in all_invoices
        if inv.get("status") in ("verzonden", "betaald") and not inv.get("betaald_op")
    ]

    # Load all incoming bank transactions (Bij = credit = incoming payment)
    tx_docs = list(
        db.collection("bank_transactions")
        .where(filter=FieldFilter("user_id", "==", uid))
        .where(filter=FieldFilter("af_bij", "==", "Bij"))
        .stream()
    )
    all_transactions = [{"id": doc.id, **doc.to_dict()} for doc in tx_docs]

    # Load already matched transaction IDs
    match_docs = list(
        db.collection("invoice_bank_matches")
        .where(filter=FieldFilter("user_id", "==", uid))
        .stream()
    )
    already_matched_tx_ids = set()
    already_matched_inv_ids = set()
    for doc in match_docs:
        d = doc.to_dict()
        for tx_id in d.get("transaction_ids", []):
            already_matched_tx_ids.add(tx_id)
        already_matched_inv_ids.add(d.get("invoice_id", ""))

    # Filter out already matched
    available_transactions = [
        tx for tx in all_transactions if tx["id"] not in already_matched_tx_ids
    ]
    matchable_invoices = [
        inv for inv in matchable_invoices if inv["id"] not in already_matched_inv_ids
    ]

    # Load customers for IBAN updates
    cust_docs = list(
        db.collection("customers")
        .where(filter=FieldFilter("user_id", "==", uid))
        .stream()
    )
    customers = {doc.id: {"id": doc.id, **doc.to_dict()} for doc in cust_docs}

    results = []
    auto_matched = []
    used_tx_ids = set()

    # === Phase 1: Auto-match by factuurnummer ===
    for inv in matchable_invoices:
        inv_nr = normalize_factuurnummer(inv.get("factuurnummer", ""))
        if not inv_nr:
            continue

        inv_totaal = abs(inv.get("totaal", 0))
        best_match = None
        best_score = 0

        for tx in available_transactions:
            if tx["id"] in used_tx_ids:
                continue

            mededelingen = (tx.get("mededelingen", "") or "")
            omschrijving = (tx.get("omschrijving", "") or "")
            combined = f"{mededelingen} {omschrijving}"

            # Check if factuurnummer appears in transaction text
            extracted = extract_factuurnummers_from_text(combined)
            norm_combined = normalize_factuurnummer(combined)

            if inv_nr in extracted or inv_nr in norm_combined:
                tx_bedrag = abs(tx.get("bedrag", 0))
                # Check amount match (allow small rounding differences)
                if abs(inv_totaal - tx_bedrag) < 0.05:
                    score = compute_match_score(inv, tx)
                    if score > best_score:
                        best_score = score
                        best_match = tx

        if best_match and best_score >= 50:
            used_tx_ids.add(best_match["id"])
            auto_matched.append({
                "invoice": inv,
                "transaction": best_match,
                "score": best_score,
            })

    # Apply auto matches
    now = datetime.now(timezone.utc).isoformat()
    iban_updates = {}  # klant_id -> iban

    for match in auto_matched:
        inv = match["invoice"]
        tx = match["transaction"]

        # Store match
        db.collection("invoice_bank_matches").add({
            "invoice_id": inv["id"],
            "transaction_ids": [tx["id"]],
            "match_type": "auto",
            "user_id": uid,
            "matched_at": now,
        })

        # Update invoice betaald_op
        db.collection("invoices").document(inv["id"]).update({
            "betaald_op": tx["datum"],
            "status": "betaald",
            "updated_at": now,
        })

        # Collect IBAN for customer
        tegenrekening = tx.get("tegenrekening", "")
        klant_id = inv.get("klant_id", "")
        if tegenrekening and klant_id and klant_id in customers:
            existing_iban = customers[klant_id].get("iban", "")
            if not existing_iban:
                iban_updates[klant_id] = tegenrekening

        results.append({
            "invoice_id": inv["id"],
            "factuurnummer": inv.get("factuurnummer", ""),
            "klant_naam": inv.get("klant_naam", ""),
            "onderwerp": inv.get("onderwerp", ""),
            "factuurdatum": inv.get("factuurdatum", ""),
            "totaal": inv.get("totaal", 0),
            "status": "matched",
            "matched_transactions": [{
                "id": tx["id"],
                "datum": tx["datum"],
                "bedrag": tx["bedrag"],
                "omschrijving": tx["omschrijving"],
                "tegenrekening": tx.get("tegenrekening", ""),
            }],
            "matched_amount": abs(tx["bedrag"]),
            "remaining_amount": 0,
        })

    # Update customer IBANs
    for klant_id, iban in iban_updates.items():
        db.collection("customers").document(klant_id).update({
            "iban": iban,
            "updated_at": now,
        })

    # === Phase 2: Find suggestions for unmatched invoices ===
    matched_inv_ids = {m["invoice"]["id"] for m in auto_matched}
    unmatched_invoices = [
        inv for inv in matchable_invoices if inv["id"] not in matched_inv_ids
    ]

    remaining_transactions = [
        tx for tx in available_transactions if tx["id"] not in used_tx_ids
    ]

    for inv in unmatched_invoices:
        # Compute scores for all remaining transactions
        scored = []
        for tx in remaining_transactions:
            score = compute_match_score(inv, tx)
            if score > 5:  # minimum threshold
                scored.append({
                    "id": tx["id"],
                    "datum": tx["datum"],
                    "bedrag": tx["bedrag"],
                    "omschrijving": tx["omschrijving"],
                    "mededelingen": tx.get("mededelingen", ""),
                    "tegenrekening": tx.get("tegenrekening", ""),
                    "score": score,
                })

        # Sort by score descending, take top 5
        scored.sort(key=lambda x: x["score"], reverse=True)
        top_5 = scored[:5]

        results.append({
            "invoice_id": inv["id"],
            "factuurnummer": inv.get("factuurnummer", ""),
            "klant_naam": inv.get("klant_naam", ""),
            "onderwerp": inv.get("onderwerp", ""),
            "factuurdatum": inv.get("factuurdatum", ""),
            "totaal": inv.get("totaal", 0),
            "status": "unmatched",
            "matched_transactions": [],
            "suggestions": top_5,
            "matched_amount": 0,
            "remaining_amount": inv.get("totaal", 0),
        })

    # Sort results: unmatched first, then matched
    results.sort(key=lambda r: (0 if r["status"] == "unmatched" else 1, r.get("factuurnummer", "")))

    return {
        "results": results,
        "summary": {
            "total_matchable": len(matchable_invoices),
            "auto_matched": len(auto_matched),
            "unmatched": len(unmatched_invoices),
            "iban_updates": len(iban_updates),
        },
    }


@router.post("/manual")
async def manual_match(
    request: ManualMatchRequest,
    user: dict = Depends(get_current_user),
):
    """Manually match an invoice to one or more bank transactions (supports partial payments)."""
    db = get_db()
    uid = user["uid"]
    now = datetime.now(timezone.utc).isoformat()

    # Verify invoice
    inv_doc = db.collection("invoices").document(request.invoice_id).get()
    if not inv_doc.exists or inv_doc.to_dict().get("user_id") != uid:
        raise HTTPException(404, "Factuur niet gevonden")

    inv_data = inv_doc.to_dict()

    # Verify transactions
    matched_txs = []
    total_matched = 0
    first_tegenrekening = ""

    for tx_id in request.transaction_ids:
        tx_doc = db.collection("bank_transactions").document(tx_id).get()
        if not tx_doc.exists or tx_doc.to_dict().get("user_id") != uid:
            raise HTTPException(404, f"Transactie {tx_id} niet gevonden")
        tx_data = tx_doc.to_dict()
        matched_txs.append(tx_data)
        total_matched += abs(tx_data.get("bedrag", 0))
        if not first_tegenrekening and tx_data.get("tegenrekening"):
            first_tegenrekening = tx_data["tegenrekening"]

    inv_totaal = abs(inv_data.get("totaal", 0))
    is_partial = abs(total_matched - inv_totaal) > 0.05

    # Determine payment date (latest transaction date)
    payment_dates = [tx.get("datum", "") for tx in matched_txs if tx.get("datum")]
    betaald_op = max(payment_dates) if payment_dates else now

    # Store match
    match_type = "manual_partial" if is_partial else "manual"
    db.collection("invoice_bank_matches").add({
        "invoice_id": request.invoice_id,
        "transaction_ids": request.transaction_ids,
        "match_type": match_type,
        "total_matched": round(total_matched, 2),
        "user_id": uid,
        "matched_at": now,
    })

    # Update invoice
    update_data = {
        "betaald_op": betaald_op,
        "updated_at": now,
    }
    # Only mark as betaald if fully paid (within tolerance)
    if not is_partial or total_matched >= inv_totaal * 0.99:
        update_data["status"] = "betaald"

    db.collection("invoices").document(request.invoice_id).update(update_data)

    # Update customer IBAN
    klant_id = inv_data.get("klant_id", "")
    if first_tegenrekening and klant_id:
        cust_doc = db.collection("customers").document(klant_id).get()
        if cust_doc.exists:
            cust_data = cust_doc.to_dict()
            if not cust_data.get("iban"):
                db.collection("customers").document(klant_id).update({
                    "iban": first_tegenrekening,
                    "updated_at": now,
                })

    return {
        "ok": True,
        "match_type": match_type,
        "total_matched": round(total_matched, 2),
        "invoice_total": inv_totaal,
        "betaald_op": betaald_op,
    }


@router.post("/partial")
async def partial_payment_match(
    request: PartialPaymentRequest,
    user: dict = Depends(get_current_user),
):
    """
    Match multiple bank transactions to a single invoice (partial payments).
    This is for cases like Herbert van Hoogdalem who pays in installments.
    """
    # Delegate to manual match which already supports multiple transactions
    manual_req = ManualMatchRequest(
        invoice_id=request.invoice_id,
        transaction_ids=request.transaction_ids,
    )
    return await manual_match(manual_req, user)


@router.get("/suggestions/{invoice_id}")
async def get_suggestions(
    invoice_id: str,
    user: dict = Depends(get_current_user),
):
    """Get top-5 matching bank transaction suggestions for a specific invoice."""
    db = get_db()
    uid = user["uid"]

    # Get invoice
    inv_doc = db.collection("invoices").document(invoice_id).get()
    if not inv_doc.exists or inv_doc.to_dict().get("user_id") != uid:
        raise HTTPException(404, "Factuur niet gevonden")
    inv = {"id": inv_doc.id, **inv_doc.to_dict()}

    # Get all incoming transactions
    tx_docs = list(
        db.collection("bank_transactions")
        .where(filter=FieldFilter("user_id", "==", uid))
        .where(filter=FieldFilter("af_bij", "==", "Bij"))
        .stream()
    )
    all_transactions = [{"id": doc.id, **doc.to_dict()} for doc in tx_docs]

    # Exclude already matched transactions
    match_docs = list(
        db.collection("invoice_bank_matches")
        .where(filter=FieldFilter("user_id", "==", uid))
        .stream()
    )
    matched_tx_ids = set()
    for doc in match_docs:
        for tx_id in doc.to_dict().get("transaction_ids", []):
            matched_tx_ids.add(tx_id)

    available = [tx for tx in all_transactions if tx["id"] not in matched_tx_ids]

    # Score all available transactions
    scored = []
    for tx in available:
        score = compute_match_score(inv, tx)
        if score > 3:
            scored.append({
                "id": tx["id"],
                "datum": tx["datum"],
                "bedrag": tx["bedrag"],
                "omschrijving": tx["omschrijving"],
                "mededelingen": tx.get("mededelingen", ""),
                "tegenrekening": tx.get("tegenrekening", ""),
                "score": score,
            })

    scored.sort(key=lambda x: x["score"], reverse=True)

    return {
        "invoice": {
            "id": inv["id"],
            "factuurnummer": inv.get("factuurnummer", ""),
            "klant_naam": inv.get("klant_naam", ""),
            "totaal": inv.get("totaal", 0),
            "factuurdatum": inv.get("factuurdatum", ""),
        },
        "suggestions": scored[:10],  # Return more for partial payment selection
    }


@router.get("/transactions")
async def get_available_transactions(
    search: str = "",
    user: dict = Depends(get_current_user),
):
    """Get all available incoming bank transactions, optionally filtered by search query."""
    db = get_db()
    uid = user["uid"]

    # Get all incoming transactions
    tx_docs = list(
        db.collection("bank_transactions")
        .where(filter=FieldFilter("user_id", "==", uid))
        .where(filter=FieldFilter("af_bij", "==", "Bij"))
        .stream()
    )
    all_transactions = [{"id": doc.id, **doc.to_dict()} for doc in tx_docs]

    # Exclude already matched transactions
    match_docs = list(
        db.collection("invoice_bank_matches")
        .where(filter=FieldFilter("user_id", "==", uid))
        .stream()
    )
    matched_tx_ids = set()
    for doc in match_docs:
        for tx_id in doc.to_dict().get("transaction_ids", []):
            matched_tx_ids.add(tx_id)

    available = [tx for tx in all_transactions if tx["id"] not in matched_tx_ids]

    # Apply search filter
    if search:
        search_lower = search.lower()
        available = [
            tx for tx in available
            if search_lower in (tx.get("omschrijving", "") or "").lower()
            or search_lower in (tx.get("mededelingen", "") or "").lower()
            or search_lower in (tx.get("tegenrekening", "") or "").lower()
            or search_lower in str(abs(tx.get("bedrag", 0)))
            or search_lower in (tx.get("datum", "") or "")
        ]

    # Sort by date descending
    available.sort(key=lambda x: x.get("datum", ""), reverse=True)

    # Return formatted
    result = []
    for tx in available:
        result.append({
            "id": tx["id"],
            "datum": tx.get("datum", ""),
            "bedrag": tx.get("bedrag", 0),
            "omschrijving": tx.get("omschrijving", ""),
            "mededelingen": tx.get("mededelingen", ""),
            "tegenrekening": tx.get("tegenrekening", ""),
        })

    return {"transactions": result, "total": len(result)}


@router.get("/status")
async def matching_status(user: dict = Depends(get_current_user)):
    """Get overview of matching status for all invoices."""
    db = get_db()
    uid = user["uid"]

    # Count invoices by status
    inv_docs = list(
        db.collection("invoices")
        .where(filter=FieldFilter("user_id", "==", uid))
        .stream()
    )
    all_invoices = [{"id": doc.id, **doc.to_dict()} for doc in inv_docs]

    # Count matches
    match_docs = list(
        db.collection("invoice_bank_matches")
        .where(filter=FieldFilter("user_id", "==", uid))
        .stream()
    )
    matched_inv_ids = {doc.to_dict().get("invoice_id") for doc in match_docs}

    total = len(all_invoices)
    betaald_met_datum = sum(1 for inv in all_invoices if inv.get("betaald_op"))
    verzonden = sum(1 for inv in all_invoices if inv.get("status") == "verzonden")
    matched = len(matched_inv_ids)
    matchable = sum(
        1 for inv in all_invoices
        if inv.get("status") in ("verzonden", "betaald") and not inv.get("betaald_op") and inv["id"] not in matched_inv_ids
    )

    return {
        "total_invoices": total,
        "matched": matched,
        "matchable": matchable,
        "betaald_met_datum": betaald_met_datum,
        "verzonden": verzonden,
    }


@router.delete("/match/{invoice_id}")
async def unmatch_invoice(
    invoice_id: str,
    user: dict = Depends(get_current_user),
):
    """Remove a match between an invoice and bank transactions."""
    db = get_db()
    uid = user["uid"]

    # Find and delete the match
    match_docs = list(
        db.collection("invoice_bank_matches")
        .where(filter=FieldFilter("user_id", "==", uid))
        .where(filter=FieldFilter("invoice_id", "==", invoice_id))
        .stream()
    )

    if not match_docs:
        raise HTTPException(404, "Geen match gevonden voor deze factuur")

    for doc in match_docs:
        doc.reference.delete()

    # Reset invoice betaald_op
    inv_doc = db.collection("invoices").document(invoice_id).get()
    if inv_doc.exists and inv_doc.to_dict().get("user_id") == uid:
        db.collection("invoices").document(invoice_id).update({
            "betaald_op": None,
            "status": "verzonden",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })

    return {"ok": True}
