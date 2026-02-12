"""
Import script: WordPress JSON → Firestore

Gebruik:
  1. Exporteer data vanuit WordPress met de [facturatie_export] shortcode
  2. Download het JSON bestand (facturatie-export.json)
  3. Zet het in de /migration/ map
  4. Start de backend server
  5. Ga naar http://localhost:3000/instellingen en klik "Importeer WordPress Data"
     OF voer dit script handmatig uit:
     cd backend && python3 -m migration.import_wp ../migration/facturatie-export.json
"""

import json
import sys
import os
from datetime import datetime, timezone

# Voeg backend path toe
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import firebase_admin
from firebase_admin import credentials, firestore


def init_firebase():
    """Initialiseer Firebase als dat nog niet is gebeurd."""
    if not firebase_admin._apps:
        cred_path = os.path.join(os.path.dirname(__file__), '..', 'backend', 'serviceAccountKey.json')
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            raise FileNotFoundError(f"serviceAccountKey.json niet gevonden op {cred_path}")
    return firestore.client()


def parse_date(date_str: str) -> str:
    """Converteer diverse datumformaten naar YYYY-MM-DD."""
    if not date_str:
        return ""
    
    # Probeer verschillende formaten
    formats = [
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%Y%m%d",
        "%d/%m/%y",
        "%Y-m-%d H:%M:%S",
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    
    # Als niets werkt, return origineel
    return date_str


def parse_status(wp_status: str) -> str:
    """Converteer WordPress factuurstatus naar nieuwe status."""
    mapping = {
        'betaald': 'betaald',
        'paid': 'betaald',
        'verzonden': 'verzonden',
        'sent': 'verzonden',
        'concept': 'concept',
        'draft': 'concept',
        'openstaand': 'verzonden',
        'open': 'verzonden',
        'vervallen': 'vervallen',
        'overdue': 'vervallen',
        'geannuleerd': 'geannuleerd',
        'cancelled': 'geannuleerd',
    }
    return mapping.get(wp_status.lower().strip(), 'concept') if wp_status else 'concept'


def parse_daan_of_wim(value: str) -> str:
    """Normaliseer daan_of_wim waarde."""
    if not value:
        return "Beiden"
    val = value.strip().lower()
    if 'daan' in val and 'wim' not in val:
        return "Daan"
    elif 'wim' in val and 'daan' not in val:
        return "Wim"
    return "Beiden"


def import_klanten(db, klanten: list, user_id: str) -> dict:
    """
    Importeer klanten en geef een mapping terug: wp_user_id → firestore_id
    """
    wp_to_new = {}
    imported = 0
    skipped = 0

    for klant in klanten:
        wp_id = klant.get('wp_user_id')
        
        # Bepaal bedrijfsnaam: gebruik factuurnaam, of display_name, of voor+achternaam
        bedrijfsnaam = (
            klant.get('factuurnaam') or 
            klant.get('display_name') or 
            f"{klant.get('voornaam', '')} {klant.get('achternaam', '')}".strip() or
            'Onbekend'
        )

        now = datetime.now(timezone.utc).isoformat()
        data = {
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
            'wp_user_id': wp_id,  # Bewaar voor referentie
            'created_at': now,
            'updated_at': now,
        }

        doc_ref = db.collection('customers').add(data)
        new_id = doc_ref[1].id
        wp_to_new[wp_id] = new_id
        imported += 1

    print(f"  Klanten: {imported} geïmporteerd, {skipped} overgeslagen")
    return wp_to_new


def import_inkomsten(db, inkomsten: list, user_id: str, klant_mapping: dict) -> int:
    """Importeer inkomsten (facturen)."""
    imported = 0

    for ink in inkomsten:
        # Map klant
        wp_klant_id = ink.get('wp_klant_id')
        klant_id = klant_mapping.get(wp_klant_id, '')
        klant_naam = ink.get('factuurnaam', '')

        # Regels
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

        # Bedragen
        subtotaal = float(ink.get('subtotaal', 0))
        btw_totaal = float(ink.get('btw_waarde', 0))
        totaal = float(ink.get('factuur_waarde', 0))

        # Als totaal 0 is maar we regels hebben, bereken opnieuw
        if totaal == 0 and regels:
            subtotaal = sum(r['aantal'] * r['tarief'] for r in regels)
            btw_totaal = sum(r['aantal'] * r['tarief'] * (r['btw_percentage'] / 100) for r in regels)
            totaal = subtotaal + btw_totaal

        # Datums
        factuurdatum = parse_date(ink.get('factuurdatum', ''))
        
        # Vervaldatum = factuurdatum + 30 dagen (standaard)
        vervaldatum = ''
        if factuurdatum:
            try:
                dt = datetime.strptime(factuurdatum, "%Y-%m-%d")
                from datetime import timedelta
                vervaldatum = (dt + timedelta(days=30)).strftime("%Y-%m-%d")
            except ValueError:
                vervaldatum = factuurdatum

        # Status mapping
        status = parse_status(ink.get('factuur_status', ''))

        now = datetime.now(timezone.utc).isoformat()
        
        # Gebruik originele post_date als created_at
        created_at = ink.get('post_date', now)
        try:
            # WordPress format: "2021-08-22 14:30:00"
            dt = datetime.strptime(created_at, "%Y-%m-%d %H:%M:%S")
            created_at = dt.replace(tzinfo=timezone.utc).isoformat()
        except (ValueError, TypeError):
            created_at = now

        data = {
            'klant_id': klant_id,
            'klant_naam': klant_naam,
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
            'wp_post_id': ink.get('wp_post_id'),  # Bewaar voor referentie
            'created_at': created_at,
            'updated_at': now,
        }

        db.collection('invoices').add(data)
        imported += 1

    print(f"  Inkomsten: {imported} geïmporteerd")
    return imported


def import_uitgaven(db, uitgaven: list, user_id: str) -> int:
    """Importeer uitgaven."""
    imported = 0

    for uit in uitgaven:
        factuurdatum = parse_date(uit.get('factuurdatum', ''))
        
        now = datetime.now(timezone.utc).isoformat()
        
        # Gebruik originele post_date als created_at
        created_at = uit.get('post_date', now)
        try:
            dt = datetime.strptime(created_at, "%Y-%m-%d %H:%M:%S")
            created_at = dt.replace(tzinfo=timezone.utc).isoformat()
        except (ValueError, TypeError):
            created_at = now

        # Crediteur: als het een getal is (taxonomy term ID) gebruiken we post_title als beschrijving
        crediteur = uit.get('crediteur', '')
        if isinstance(crediteur, (int, float)):
            crediteur = ''  # Term ID niet bruikbaar, wordt leeg
        leverancier = str(crediteur) if crediteur else ''

        # Bijlage URL: alleen gebruiken als het een echte URL is
        bijlage = uit.get('bijlage_url', '')
        pdf_url = None
        if isinstance(bijlage, str) and bijlage.startswith('http'):
            pdf_url = bijlage

        data = {
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
            'wp_post_id': uit.get('wp_post_id'),  # Bewaar voor referentie
            'created_at': created_at,
            'updated_at': now,
        }

        db.collection('expenses').add(data)
        imported += 1

    print(f"  Uitgaven: {imported} geïmporteerd")
    return imported


def run_import(json_path: str, user_id: str):
    """Voer de volledige import uit."""
    print(f"\n{'='*60}")
    print(f"WordPress → Firestore Import")
    print(f"{'='*60}")
    print(f"JSON bestand: {json_path}")
    print(f"User ID: {user_id}")
    print()

    # Lees JSON
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"Export datum: {data.get('exported_at', 'onbekend')}")
    print(f"Klanten: {len(data.get('klanten', []))}")
    print(f"Inkomsten: {len(data.get('inkomsten', []))}")
    print(f"Uitgaven: {len(data.get('uitgaven', []))}")
    print()

    # Init Firebase
    db = init_firebase()

    # Import klanten eerst (we hebben de mapping nodig voor inkomsten)
    print("Stap 1/3: Klanten importeren...")
    klant_mapping = import_klanten(db, data.get('klanten', []), user_id)

    # Import inkomsten
    print("Stap 2/3: Inkomsten importeren...")
    import_inkomsten(db, data.get('inkomsten', []), user_id, klant_mapping)

    # Import uitgaven
    print("Stap 3/3: Uitgaven importeren...")
    import_uitgaven(db, data.get('uitgaven', []), user_id)

    print(f"\n{'='*60}")
    print("Import voltooid!")
    print(f"{'='*60}\n")


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Gebruik: python3 import_wp.py <pad-naar-json> <firebase-user-id>")
        print("Voorbeeld: python3 import_wp.py ../migration/facturatie-export.json abc123def456")
        sys.exit(1)
    
    json_path = sys.argv[1]
    user_id = sys.argv[2]
    
    if not os.path.exists(json_path):
        print(f"Bestand niet gevonden: {json_path}")
        sys.exit(1)
    
    run_import(json_path, user_id)
