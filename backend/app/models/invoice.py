from pydantic import BaseModel
from typing import Optional


class InvoiceLineItem(BaseModel):
    beschrijving: str
    aantal: float = 1
    tarief: float = 0
    btw_percentage: float = 21
    totaal: float = 0


class InvoiceCreate(BaseModel):
    klant_id: str
    klant_naam: Optional[str] = ""
    factuurdatum: str
    vervaldatum: str
    onderwerp: Optional[str] = ""
    regels: list[InvoiceLineItem] = []
    notities: Optional[str] = ""
    status: str = "concept"
    daan_of_wim: Optional[str] = "Beiden"


class InvoiceUpdate(BaseModel):
    klant_id: Optional[str] = None
    klant_naam: Optional[str] = None
    factuurdatum: Optional[str] = None
    vervaldatum: Optional[str] = None
    onderwerp: Optional[str] = None
    regels: Optional[list[InvoiceLineItem]] = None
    notities: Optional[str] = None
    status: Optional[str] = None
    daan_of_wim: Optional[str] = None


class Invoice(InvoiceCreate):
    id: str
    user_id: str
    factuurnummer: str
    subtotaal: float = 0
    btw_totaal: float = 0
    totaal: float = 0
    pdf_url: Optional[str] = None
    verzonden_op: Optional[str] = None
    betaald_op: Optional[str] = None
    daan_of_wim: Optional[str] = "Beiden"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
