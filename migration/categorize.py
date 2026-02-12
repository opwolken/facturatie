#!/usr/bin/env python3
"""Categorize all expenses based on leverancier name."""

import sys
sys.path.insert(0, "/Users/daan/facturatie/facturatie/backend")

import firebase_admin
from firebase_admin import credentials, firestore
from collections import Counter

if not firebase_admin._apps:
    cred = credentials.Certificate("/Users/daan/facturatie/facturatie/backend/serviceAccountKey.json")
    firebase_admin.initialize_app(cred)

db = firestore.client()

CATEGORY_MAP = {
    # Hosting & Servers
    "Stannet": "Hosting & servers",
    "Google Cloud EMEA Limited": "Hosting & servers",
    "Cloud86": "Hosting & servers",
    "Hostnet": "Hosting & servers",

    # Software & Licenties
    "OpenAI": "Software & licenties",
    "OpenAI, LLC": "Software & licenties",
    "Elementor LTD": "Software & licenties",
    "WP Mail SMTP": "Software & licenties",
    "Jetimpex": "Software & licenties",
    "Freemius, inc.": "Software & licenties",
    "Freemius": "Software & licenties",
    "Brainstorm force": "Software & licenties",
    "WPML": "Software & licenties",
    "Rocketgenius": "Software & licenties",
    "OnTheGoSystems Limited": "Software & licenties",
    "Envato": "Software & licenties",

    # Hardware & Elektronica
    "Coolblue.nl": "Hardware & elektronica",
    "Bol.com": "Hardware & elektronica",
    "Allekabels.nl": "Hardware & elektronica",
    "Amazon": "Hardware & elektronica",
    "Mediamarkt": "Hardware & elektronica",
    "Amac": "Hardware & elektronica",
    "Apple Support": "Hardware & elektronica",
    "gsmpunt.nl": "Hardware & elektronica",
    "Art &amp; Craft": "Hardware & elektronica",
    "Ali Express": "Hardware & elektronica",

    # Kantoor & Inrichting
    "Ikea": "Kantoor & inrichting",
    "Pastoe": "Kantoor & inrichting",
    "Karwei": "Kantoor & inrichting",
    "Planed Timber Online B.V.": "Kantoor & inrichting",
    "Meerdanlicht": "Kantoor & inrichting",

    # Zakelijke diensten
    "WIMA": "Zakelijke diensten",
    "unifiedpost": "Zakelijke diensten",
    "Alpina Pensioen": "Zakelijke diensten",

    # Transport
    "Parkmobile": "Transport",
}

expenses = list(db.collection("expenses").stream())
batch = db.batch()
updated = 0
skipped = 0

for doc in expenses:
    d = doc.to_dict()
    lev = (d.get("leverancier") or "").strip()
    cat = CATEGORY_MAP.get(lev)
    if cat:
        batch.update(doc.reference, {"categorie": cat})
        updated += 1
    elif not lev:
        batch.update(doc.reference, {"categorie": "Overig"})
        updated += 1
    else:
        print(f"  Geen match: '{lev}'")
        skipped += 1

batch.commit()
print(f"\nGecategoriseerd: {updated}")
print(f"Overgeslagen: {skipped}")

# Verify
cats = Counter()
for doc in db.collection("expenses").stream():
    d = doc.to_dict()
    cats[d.get("categorie", "") or "(leeg)"] += 1

print("\nResultaat:")
for cat, count in cats.most_common():
    print(f"  {count:3d}  {cat}")
