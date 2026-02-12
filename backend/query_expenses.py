#!/usr/bin/env python3
"""Query all expenses from Firestore and list unique categories and leveranciers with counts."""

import firebase_admin
from firebase_admin import credentials, firestore
from collections import Counter

# Initialize Firebase
cred = credentials.Certificate("/Users/daan/facturatie/facturatie/backend/serviceAccountKey.json")
try:
    app = firebase_admin.get_app()
except ValueError:
    app = firebase_admin.initialize_app(cred)

db = firestore.client()

# Query all expenses
print("Querying all expenses from Firestore...")
expenses_ref = db.collection("expenses")
docs = expenses_ref.stream()

categories = Counter()
leveranciers = Counter()
no_category_leveranciers = []
total = 0

for doc in docs:
    data = doc.to_dict()
    total += 1

    cat = data.get("category", None)
    lev = data.get("leverancier", None)

    # Count categories
    cat_key = cat if cat else "<empty/None>"
    categories[cat_key] += 1

    # Count leveranciers
    lev_key = lev if lev else "<empty/None>"
    leveranciers[lev_key] += 1

    # Track leveranciers with no category
    if not cat or str(cat).strip() == "":
        no_category_leveranciers.append({
            "leverancier": lev,
            "description": data.get("description", ""),
            "amount": data.get("amount", ""),
            "date": data.get("date", ""),
        })

print(f"\n{'='*60}")
print(f"TOTAL EXPENSES: {total}")
print(f"{'='*60}")

print(f"\n--- UNIQUE CATEGORIES ({len(categories)}) ---")
for cat, count in categories.most_common():
    print(f"  {cat}: {count}")

print(f"\n--- UNIQUE LEVERANCIERS ({len(leveranciers)}) ---")
for lev, count in leveranciers.most_common():
    print(f"  {lev}: {count}")

print(f"\n--- EXPENSES WITH NO/EMPTY CATEGORY ({len(no_category_leveranciers)}) ---")
if no_category_leveranciers:
    print("Sample (up to 20):")
    for item in no_category_leveranciers[:20]:
        print(f"  Leverancier: {item['leverancier']}, Desc: {item['description'][:60]}, Amount: {item['amount']}, Date: {item['date']}")
else:
    print("  None found - all expenses have a category.")
