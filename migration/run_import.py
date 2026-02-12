"""Run the import from WordPress export JSON to Firestore."""
import sys, os, json, signal
signal.signal(signal.SIGINT, signal.SIG_IGN)  # Ignore Ctrl+C
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone, timedelta

if not firebase_admin._apps:
    cred_path = os.path.join(os.path.dirname(__file__), '..', 'backend', 'serviceAccountKey.json')
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()
USER_ID = 'jROgjVI5QnS8ojB21q1pxqMLY8I2'

# Check of er al data is geimporteerd
existing_customers = list(db.collection('customers').where('user_id', '==', USER_ID).limit(1).stream())
if existing_customers:
    print("Er zijn al klanten in Firestore. Voer eerst cleanup.py uit.")
    sys.exit(1)

json_path = os.path.join(os.path.dirname(__file__), 'facturatie-export.json')
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Export: {data['exported_at']}")
print(f"Klanten: {len(data['klanten'])} | Inkomsten: {len(data['inkomsten'])} | Uitgaven: {len(data['uitgaven'])}")
print()

def parse_date(s):
    if not s:
        return ''
    for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%Y%m%d']:
        try:
            return datetime.strptime(s.strip(), fmt).strftime('%Y-%m-%d')
        except ValueError:
            pass
    return s

def parse_status(s):
    m = {'betaald': 'betaald', 'paid': 'betaald', 'open': 'verzonden',
         'verzonden': 'verzonden', 'concept': 'concept', 'draft': 'concept'}
    return m.get(s.lower().strip(), 'concept') if s else 'concept'

def parse_dw(v):
    if not v:
        return 'Beiden'
    v = v.strip().lower()
    if 'daan' in v and 'wim' not in v:
        return 'Daan'
    if 'wim' in v and 'daan' not in v:
        return 'Wim'
    return 'Beiden'

def wp_to_utc(post_date, fallback):
    try:
        dt = datetime.strptime(post_date, '%Y-%m-%d %H:%M:%S')
        return dt.replace(tzinfo=timezone.utc).isoformat()
    except (ValueError, TypeError):
        return fallback

now = datetime.now(timezone.utc).isoformat()

# --- 1: Klanten ---
print('Stap 1/3: Klanten...')
klant_map = {}
batch = db.batch()
batch_count = 0
for k in data['klanten']:
    wp_id = k.get('wp_user_id')
    naam = k.get('factuurnaam') or k.get('display_name') or \
           f"{k.get('voornaam', '')} {k.get('achternaam', '')}".strip() or 'Onbekend'
    d = {
        'bedrijfsnaam': naam,
        'voornaam': k.get('voornaam', ''),
        'achternaam': k.get('achternaam', ''),
        'email': k.get('email', ''),
        'telefoon': k.get('telefoonnummer', ''),
        'adres': k.get('straat_nummer', ''),
        'postcode': k.get('postcode', ''),
        'plaats': k.get('stad', ''),
        'land': 'Nederland',
        'kvk_nummer': '',
        'btw_nummer': '',
        'notities': k.get('overig', ''),
        'user_id': USER_ID,
        'wp_user_id': wp_id,
        'created_at': now,
        'updated_at': now,
    }
    doc_ref = db.collection('customers').document()
    batch.set(doc_ref, d)
    klant_map[wp_id] = doc_ref.id
    batch_count += 1
    if batch_count % 400 == 0:
        batch.commit()
        batch = db.batch()

if batch_count % 400 != 0:
    batch.commit()

print(f'  {len(klant_map)} klanten geimporteerd')

# --- 2: Inkomsten ---
print('Stap 2/3: Inkomsten...')
ink_count = 0
for ink in data['inkomsten']:
    wp_klant_id = ink.get('wp_klant_id')
    klant_id = klant_map.get(wp_klant_id, '')

    regels = []
    for r in ink.get('regels', []):
        btw_pct = 21.0 if ink.get('btw_berekenen', False) else 0.0
        tarief = float(r.get('tarief', 0))
        aantal = float(r.get('aantal', 1))
        regels.append({
            'beschrijving': r.get('beschrijving', ''),
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
            dt = datetime.strptime(factuurdatum, '%Y-%m-%d')
            vervaldatum = (dt + timedelta(days=30)).strftime('%Y-%m-%d')
        except ValueError:
            vervaldatum = factuurdatum

    status = parse_status(ink.get('factuur_status', ''))
    created_at = wp_to_utc(ink.get('post_date', ''), now)

    d = {
        'klant_id': klant_id,
        'klant_naam': ink.get('factuurnaam', ''),
        'factuurnummer': ink.get('factuurnummer', ''),
        'factuurdatum': factuurdatum,
        'vervaldatum': vervaldatum,
        'onderwerp': ink.get('onderwerp', ''),
        'regels': regels,
        'notities': ink.get('overige_info', ''),
        'status': status,
        'daan_of_wim': parse_dw(ink.get('daan_of_wim', '')),
        'subtotaal': round(subtotaal, 2),
        'btw_totaal': round(btw_totaal, 2),
        'totaal': round(totaal, 2),
        'user_id': USER_ID,
        'pdf_url': None,
        'verzonden_op': None,
        'betaald_op': now if status == 'betaald' else None,
        'wp_post_id': ink.get('wp_post_id'),
        'created_at': created_at,
        'updated_at': now,
    }
    db.collection('invoices').document().set(d)
    ink_count += 1
    if ink_count % 50 == 0:
        print(f'    ...{ink_count} verwerkt')

print(f'  {ink_count} inkomsten geimporteerd')

# --- 3: Uitgaven ---
print('Stap 3/3: Uitgaven...')
uit_count = 0
for uit in data['uitgaven']:
    factuurdatum = parse_date(uit.get('factuurdatum', ''))
    created_at = wp_to_utc(uit.get('post_date', ''), now)

    crediteur = uit.get('crediteur', '')
    if isinstance(crediteur, (int, float)):
        crediteur = ''
    leverancier = str(crediteur) if crediteur else ''

    bijlage = uit.get('bijlage_url', '')
    pdf_url = bijlage if isinstance(bijlage, str) and bijlage.startswith('http') else None

    d = {
        'leverancier': leverancier,
        'factuurnummer': str(uit.get('factuurnummer', '')),
        'datum': factuurdatum,
        'categorie': '',
        'beschrijving': uit.get('post_title', ''),
        'subtotaal': round(float(uit.get('waarde_ex', 0)), 2),
        'btw': round(float(uit.get('btw_waarde', 0)), 2),
        'totaal': round(float(uit.get('totaal_waarde', 0)), 2),
        'status': 'verwerkt',
        'daan_of_wim': parse_dw(uit.get('daan_of_wim', '')),
        'pdf_url': pdf_url,
        'user_id': USER_ID,
        'wp_post_id': uit.get('wp_post_id'),
        'created_at': created_at,
        'updated_at': now,
    }
    db.collection('expenses').document().set(d)
    uit_count += 1
    if uit_count % 50 == 0:
        print(f'    ...{uit_count} verwerkt')

print(f'  {uit_count} uitgaven geimporteerd')

# --- Update factuurnummer teller ---
max_num = 0
for ink in data['inkomsten']:
    nr = str(ink.get('factuurnummer', ''))
    digits = ''.join(filter(str.isdigit, nr))
    if digits:
        max_num = max(max_num, int(digits))

if max_num > 0:
    ref = db.collection('company_settings').document(USER_ID)
    s = ref.get()
    if s.exists:
        current = s.to_dict().get('volgende_factuurnummer', 1)
        if max_num + 1 > current:
            ref.update({'volgende_factuurnummer': max_num + 1})
            print(f'\nFactuurnummer teller bijgewerkt naar {max_num + 1}')
        else:
            print(f'\nFactuurnummer teller al op {current}, geen update nodig')
    else:
        ref.set({'factuur_prefix': 'F', 'volgende_factuurnummer': max_num + 1, 'user_id': USER_ID})
        print(f'\nFactuurnummer teller ingesteld op {max_num + 1}')

print('\n✅ Import voltooid!')
