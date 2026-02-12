from pydantic import BaseModel
from typing import Optional


class CustomerCreate(BaseModel):
    bedrijfsnaam: str
    voornaam: Optional[str] = ""
    achternaam: Optional[str] = ""
    email: Optional[str] = ""
    telefoon: Optional[str] = ""
    adres: Optional[str] = ""
    postcode: Optional[str] = ""
    plaats: Optional[str] = ""
    land: Optional[str] = "Nederland"
    kvk_nummer: Optional[str] = ""
    btw_nummer: Optional[str] = ""
    notities: Optional[str] = ""


class CustomerUpdate(CustomerCreate):
    pass


class Customer(CustomerCreate):
    id: str
    user_id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
