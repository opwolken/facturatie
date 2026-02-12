import os
from dotenv import load_dotenv

load_dotenv()

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "")
FIREBASE_CREDENTIALS_PATH = os.getenv("FIREBASE_CREDENTIALS_PATH", "./serviceAccountKey.json")
FIREBASE_STORAGE_BUCKET = os.getenv("FIREBASE_STORAGE_BUCKET", f"{os.getenv('FIREBASE_PROJECT_ID', '')}.firebasestorage.app")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
FROM_EMAIL = os.getenv("FROM_EMAIL", "info@opwolken.com")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
