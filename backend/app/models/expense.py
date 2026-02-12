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


class ExpenseUpdate(ExpenseCreate):
    pass


class Expense(ExpenseCreate):
    id: str
    user_id: str
    pdf_url: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
