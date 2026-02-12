"""Verwijder alle geimporteerde data en start opnieuw."""
import firebase_admin, os, sys
from firebase_admin import credentials, firestore

if not firebase_admin._apps:
    cred = credentials.Certificate(os.path.join(os.path.dirname(__file__), '..', 'backend', 'serviceAccountKey.json'))
    firebase_admin.initialize_app(cred)

db = firestore.client()
UID = 'jROgjVI5QnS8ojB21q1pxqMLY8I2'

print("Verwijderen van alle data...")
for col in ['customers', 'invoices', 'expenses']:
    docs = list(db.collection(col).where('user_id', '==', UID).stream())
    batch = db.batch()
    count = 0
    for doc in docs:
        batch.delete(doc.reference)
        count += 1
        if count % 400 == 0:
            batch.commit()
            batch = db.batch()
    if count % 400 != 0:
        batch.commit()
    print(f"  {col}: {count} verwijderd")

print("Klaar!")
