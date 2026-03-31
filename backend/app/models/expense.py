from pydantic import BaseModel
from typing import Optional


class ExpenseCreate(BaseModel):
    leverancier: str = ""
    factuurnummer: Optional[str] = ""
    datum: Optional[str] = ""
    categorie: Optional[str] = ""
    beschrijving: Optional[str] = ""
    subtotaal: float = 0
    btw: float = 0
    totaal: float = 0
    status: str = "nieuw"
    daan_of_wim: Optional[str] = "Beiden"
    afschrijving: bool = False
    afschrijving_jaren: Optional[int] = None
    afschrijving_restwaarde: Optional[float] = 0


class ExpenseUpdate(ExpenseCreate):
    pass


class Expense(ExpenseCreate):
    id: str
    user_id: str
    pdf_url: Optional[str] = None
    bestand_naam: Optional[str] = None
    bestand_mime_type: Optional[str] = None
    daan_of_wim: Optional[str] = "Beiden"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
