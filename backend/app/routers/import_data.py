from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from firebase_admin import firestore
from google.cloud.firestore_v1 import FieldFilter
from datetime import datetime, timezone, timedelta
from typing import Optional

import json

from app.auth import get_current_user

router = APIRouter()


def get_db():
    return firestore.client()


def parse_date(date_str: str) -> str:
    if not date_str:
        return ""
    formats = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y%m%d", "%d/%m/%y"]
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return date_str


def parse_status(wp_status: str) -> str:
    mapping = {
        'betaald': 'betaald', 'paid': 'betaald',
        'verzonden': 'verzonden', 'sent': 'verzonden',
        'concept': 'concept', 'draft': 'concept',
        'openstaand': 'verzonden', 'open': 'verzonden',
        'vervallen': 'vervallen', 'overdue': 'vervallen',
    }
    return mapping.get(wp_status.lower().strip(), 'concept') if wp_status else 'concept'


def parse_daan_of_wim(value: str) -> str:
    if not value:
        return "Beiden"
    val = value.strip().lower()
    if 'daan' in val and 'wim' not in val:
        return "Daan"
    elif 'wim' in val and 'daan' not in val:
        return "Wim"
    return "Beiden"


@router.post("/wordpress")
async def import_wordpress(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Importeer data uit WordPress export JSON bestand."""
    if not file.filename or not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="Alleen JSON bestanden toegestaan")

    contents = await file.read()
    try:
        data = json.loads(contents)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Ongeldig JSON bestand")

    db = get_db()
    user_id = user["uid"]
    now = datetime.now(timezone.utc).isoformat()
    results = {"klanten": 0, "inkomsten": 0, "uitgaven": 0}

    # --- Klanten ---
    klant_mapping = {}  # wp_user_id → firestore_id
    for klant in data.get('klanten', []):
        wp_id = klant.get('wp_user_id')
        bedrijfsnaam = (
            klant.get('factuurnaam') or
            klant.get('display_name') or
            f"{klant.get('voornaam', '')} {klant.get('achternaam', '')}".strip() or
            'Onbekend'
        )

        klant_data = {
            'bedrijfsnaam': bedrijfsnaam,
            'voornaam': klant.get('voornaam', ''),
            'achternaam': klant.get('achternaam', ''),
            'email': klant.get('email', ''),
            'telefoon': klant.get('telefoonnummer', ''),
            'adres': klant.get('straat_nummer', ''),
            'postcode': klant.get('postcode', ''),
            'plaats': klant.get('stad', ''),
            'land': 'Nederland',
            'kvk_nummer': '',
            'btw_nummer': '',
            'notities': klant.get('overig', ''),
            'user_id': user_id,
            'wp_user_id': wp_id,
            'created_at': now,
            'updated_at': now,
        }
        doc_ref = db.collection('customers').add(klant_data)
        klant_mapping[wp_id] = doc_ref[1].id
        results["klanten"] += 1

    # --- Inkomsten (facturen) ---
    for ink in data.get('inkomsten', []):
        wp_klant_id = ink.get('wp_klant_id')
        klant_id = klant_mapping.get(wp_klant_id, '')

        regels = []
        for regel in ink.get('regels', []):
            btw_pct = 21.0 if ink.get('btw_berekenen', False) else 0.0
            tarief = float(regel.get('tarief', 0))
            aantal = float(regel.get('aantal', 1))
            regels.append({
                'beschrijving': regel.get('beschrijving', ''),
                'aantal': aantal,
                'tarief': tarief,
                'btw_percentage': btw_pct,
                'totaal': round(aantal * tarief, 2),
            })

        subtotaal = float(ink.get('subtotaal', 0))
        btw_totaal = float(ink.get('btw_waarde', 0))
        totaal = float(ink.get('factuur_waarde', 0))

        if totaal == 0 and regels:
            subtotaal = sum(r['aantal'] * r['tarief'] for r in regels)
            btw_totaal = sum(r['aantal'] * r['tarief'] * (r['btw_percentage'] / 100) for r in regels)
            totaal = subtotaal + btw_totaal

        factuurdatum = parse_date(ink.get('factuurdatum', ''))
        vervaldatum = ''
        if factuurdatum:
            try:
                dt = datetime.strptime(factuurdatum, "%Y-%m-%d")
                vervaldatum = (dt + timedelta(days=30)).strftime("%Y-%m-%d")
            except ValueError:
                vervaldatum = factuurdatum

        status = parse_status(ink.get('factuur_status', ''))

        created_at = ink.get('post_date', now)
        try:
            dt = datetime.strptime(created_at, "%Y-%m-%d %H:%M:%S")
            created_at = dt.replace(tzinfo=timezone.utc).isoformat()
        except (ValueError, TypeError):
            created_at = now

        inv_data = {
            'klant_id': klant_id,
            'klant_naam': ink.get('factuurnaam', ''),
            'factuurnummer': ink.get('factuurnummer', ''),
            'factuurdatum': factuurdatum,
            'vervaldatum': vervaldatum,
            'onderwerp': ink.get('onderwerp', ''),
            'regels': regels,
            'notities': ink.get('overige_info', ''),
            'status': status,
            'daan_of_wim': parse_daan_of_wim(ink.get('daan_of_wim', '')),
            'subtotaal': round(subtotaal, 2),
            'btw_totaal': round(btw_totaal, 2),
            'totaal': round(totaal, 2),
            'user_id': user_id,
            'pdf_url': None,
            'verzonden_op': None,
            'betaald_op': now if status == 'betaald' else None,
            'wp_post_id': ink.get('wp_post_id'),
            'created_at': created_at,
            'updated_at': now,
        }
        db.collection('invoices').add(inv_data)
        results["inkomsten"] += 1

    # --- Uitgaven ---
    for uit in data.get('uitgaven', []):
        factuurdatum = parse_date(uit.get('factuurdatum', ''))

        created_at = uit.get('post_date', now)
        try:
            dt = datetime.strptime(created_at, "%Y-%m-%d %H:%M:%S")
            created_at = dt.replace(tzinfo=timezone.utc).isoformat()
        except (ValueError, TypeError):
            created_at = now

        # Crediteur: als het een getal is (taxonomy term ID), leeg laten
        crediteur = uit.get('crediteur', '')
        if isinstance(crediteur, (int, float)):
            crediteur = ''
        leverancier = str(crediteur) if crediteur else ''

        # Bijlage URL: alleen als het een echte URL is
        bijlage = uit.get('bijlage_url', '')
        pdf_url = None
        if isinstance(bijlage, str) and bijlage.startswith('http'):
            pdf_url = bijlage

        exp_data = {
            'leverancier': leverancier,
            'factuurnummer': str(uit.get('factuurnummer', '')),
            'datum': factuurdatum,
            'categorie': '',
            'beschrijving': uit.get('post_title', ''),
            'subtotaal': round(float(uit.get('waarde_ex', 0)), 2),
            'btw': round(float(uit.get('btw_waarde', 0)), 2),
            'totaal': round(float(uit.get('totaal_waarde', 0)), 2),
            'status': 'verwerkt',
            'daan_of_wim': parse_daan_of_wim(uit.get('daan_of_wim', '')),
            'pdf_url': pdf_url,
            'user_id': user_id,
            'wp_post_id': uit.get('wp_post_id'),
            'created_at': created_at,
            'updated_at': now,
        }
        db.collection('expenses').add(exp_data)
        results["uitgaven"] += 1

    # Update volgende factuurnummer op basis van hoogste geïmporteerde
    if results["inkomsten"] > 0:
        all_nummers = [ink.get('factuurnummer', '') for ink in data.get('inkomsten', [])]
        # Probeer het hoogste nummer te vinden
        max_num = 0
        for nr in all_nummers:
            # Extract digits from factuurnummer
            digits = ''.join(filter(str.isdigit, nr))
            if digits:
                max_num = max(max_num, int(digits))
        
        if max_num > 0:
            settings_ref = db.collection("company_settings").document(user_id)
            settings = settings_ref.get()
            if settings.exists:
                current = settings.to_dict().get("volgende_factuurnummer", 1)
                if max_num + 1 > current:
                    settings_ref.update({"volgende_factuurnummer": max_num + 1})
            else:
                settings_ref.set({
                    "factuur_prefix": "F",
                    "volgende_factuurnummer": max_num + 1,
                    "user_id": user_id,
                })

    return {
        "ok": True,
        "bericht": f"Import voltooid: {results['klanten']} klanten, {results['inkomsten']} facturen, {results['uitgaven']} uitgaven",
        "resultaten": results,
    }
