import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials

from app.config import FIREBASE_CREDENTIALS_PATH, CORS_ORIGINS
from app.routers import invoices, expenses, customers, dashboard, settings

# Initialize Firebase Admin
if not firebase_admin._apps:
    if os.path.exists(FIREBASE_CREDENTIALS_PATH):
        cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()

app = FastAPI(title="Opwolken Facturatie API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(invoices.router, prefix="/api/invoices", tags=["invoices"])
app.include_router(expenses.router, prefix="/api/expenses", tags=["expenses"])
app.include_router(customers.router, prefix="/api/customers", tags=["customers"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
