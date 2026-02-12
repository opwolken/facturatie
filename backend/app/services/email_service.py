import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication

from app.config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, FROM_EMAIL


def send_invoice_email(
    to_email: str,
    to_name: str,
    invoice_data: dict,
    company: dict,
    pdf_bytes: bytes,
):
    company_name = company.get("bedrijfsnaam", "Opwolken")
    factuurnummer = invoice_data.get("factuurnummer", "")
    totaal = invoice_data.get("totaal", 0)
    vervaldatum = invoice_data.get("vervaldatum", "")

    msg = MIMEMultipart()
    msg["From"] = f"{company_name} <{FROM_EMAIL}>"
    msg["To"] = to_email
    msg["Subject"] = f"Factuur {factuurnummer} - {company_name}"

    body = f"""Beste {to_name},

Hierbij ontvangt u factuur {factuurnummer} van {company_name}.

Factuurbedrag: € {totaal:.2f}
Vervaldatum: {vervaldatum}

De factuur vindt u als bijlage bij deze e-mail.

Met vriendelijke groet,
{company_name}
{company.get('email', '')}
{company.get('telefoon', '')}
"""
    msg.attach(MIMEText(body, "plain"))

    pdf_attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
    pdf_attachment.add_header(
        "Content-Disposition", "attachment", filename=f"{factuurnummer}.pdf"
    )
    msg.attach(pdf_attachment)

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)
