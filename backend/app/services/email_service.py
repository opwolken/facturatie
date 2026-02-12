import base64
from typing import Optional

import resend

from app.config import RESEND_API_KEY, FROM_EMAIL


def send_invoice_email(
    to_email: str,
    to_name: str,
    invoice_data: dict,
    company: dict,
    pdf_bytes: bytes,
    onderwerp: Optional[str] = None,
    bericht: Optional[str] = None,
):
    resend.api_key = RESEND_API_KEY

    company_name = company.get("bedrijfsnaam", "Opwolken")
    factuurnummer = invoice_data.get("factuurnummer", "")
    totaal = invoice_data.get("totaal", 0)
    vervaldatum = invoice_data.get("vervaldatum", "")

    subject = onderwerp or f"Factuur {factuurnummer} - {company_name}"

    default_bericht = f"""Beste {to_name},

Hierbij ontvangt u factuur {factuurnummer} van {company_name}.

Factuurbedrag: € {totaal:.2f}
Vervaldatum: {vervaldatum}

De factuur vindt u als bijlage bij deze e-mail.

Met vriendelijke groet,
{company_name}
{company.get('email', '')}
{company.get('telefoon', '')}
"""

    resend.Emails.send({
        "from": f"{company_name} <{FROM_EMAIL}>",
        "to": [to_email],
        "subject": subject,
        "text": bericht or default_bericht,
        "attachments": [
            {
                "filename": f"{factuurnummer}.pdf",
                "content": list(pdf_bytes),
            }
        ],
    })
