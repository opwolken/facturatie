import re
import io
import json
import base64
import pdfplumber

from app.config import GEMINI_API_KEY

MAANDEN = {
    "januari": "01", "februari": "02", "maart": "03", "april": "04",
    "mei": "05", "juni": "06", "juli": "07", "augustus": "08",
    "september": "09", "oktober": "10", "november": "11", "december": "12",
}


def _to_iso_date(date_str: str) -> str:
    """Normalize any common date format to YYYY-MM-DD."""
    if not date_str:
        return ""
    s = date_str.strip()
    # Already ISO: YYYY-MM-DD or YYYY/MM/DD
    m = re.match(r"^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$", s)
    if m:
        return f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
    # DD-MM-YYYY or DD/MM/YYYY
    m = re.match(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$", s)
    if m:
        return f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
    # "12 februari 2026"
    m = re.match(r"^(\d{1,2})\s+(\w+)\s+(\d{4})$", s, re.IGNORECASE)
    if m:
        maand = MAANDEN.get(m.group(2).lower())
        if maand:
            return f"{m.group(3)}-{maand}-{m.group(1).zfill(2)}"
    return s


def extract_expense_data(pdf_bytes: bytes) -> dict:
    """Extract invoice/expense data from a PDF using Gemini 2.5 Flash, with regex fallback."""
    if GEMINI_API_KEY:
        try:
            result = _extract_with_gemini(pdf_bytes)
            result["methode"] = "gemini"
            return result
        except Exception:
            pass
    result = _extract_with_regex(pdf_bytes)
    result["methode"] = "regex"
    return result


def _extract_with_gemini(pdf_bytes: bytes) -> dict:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=GEMINI_API_KEY)

    categories = [
        "Software & Licenties", "Kantoorkosten", "Hosting & Domein",
        "Telefoon & Internet", "Reiskosten", "Marketing",
        "Verzekering", "Accountant", "Overig",
    ]

    prompt = f"""Analyseer deze factuur/bon en extraheer de volgende gegevens als JSON.
Geef ALLEEN geldige JSON terug, geen uitleg of markdown.

Velden:
- leverancier: naam van het bedrijf dat de factuur stuurt (string)
- factuurnummer: het factuurnummer (string, leeg als niet gevonden)
- datum: factuurdatum in formaat DD-MM-YYYY (string, leeg als niet gevonden)
- categorie: meest passende categorie uit deze lijst: {', '.join(categories)}
- beschrijving: korte omschrijving van wat er gefactureerd wordt (string)
- subtotaal: bedrag excl. BTW als getal (number, 0 als niet gevonden)
- btw: BTW bedrag als getal (number, 0 als niet gevonden)
- totaal: totaalbedrag incl. BTW als getal (number, 0 als niet gevonden)

Gebruik altijd punten als decimaalscheidingsteken in de getallen.
"""

    pdf_b64 = base64.standard_b64encode(pdf_bytes).decode("utf-8")

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
            prompt,
        ],
    )

    text = response.text.strip()
    # Strip markdown code fences if present
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    data = json.loads(text)
    return {
        "leverancier": str(data.get("leverancier", "")),
        "factuurnummer": str(data.get("factuurnummer", "")),
        "datum": _to_iso_date(str(data.get("datum", ""))),
        "categorie": str(data.get("categorie", "")),
        "beschrijving": str(data.get("beschrijving", "")),
        "subtotaal": float(data.get("subtotaal", 0) or 0),
        "btw": float(data.get("btw", 0) or 0),
        "totaal": float(data.get("totaal", 0) or 0),
    }


def _extract_with_regex(pdf_bytes: bytes) -> dict:
    """Fallback regex-based extraction."""
    result = {
        "leverancier": "", "factuurnummer": "", "datum": "",
        "categorie": "", "beschrijving": "", "subtotaal": 0, "btw": 0, "totaal": 0,
    }

    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            full_text = ""
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    full_text += text + "\n"

            if not full_text.strip():
                return result

            lines = full_text.split("\n")

            for line in lines[:5]:
                line = line.strip()
                if line and len(line) > 2 and not re.match(r"^[\d\s\-/\.]+$", line):
                    result["leverancier"] = line
                    break

            invoice_patterns = [
                r"(?:factuur(?:nummer)?|invoice(?:\s*(?:no|nr|number))?)\s*[:\s#]*\s*([A-Za-z0-9][\w\-/\.]{1,30})",
                r"(?:nota|bon|receipt)\s*[:\s#]*\s*([A-Za-z0-9][\w\-/\.]{1,30})",
                r"\b([A-Z]{1,4}[-_]?\d{4}[-_/]\d{2,6})\b",
            ]
            for pattern in invoice_patterns:
                match = re.search(pattern, full_text, re.IGNORECASE | re.MULTILINE)
                if match:
                    candidate = match.group(1).strip()
                    if len(candidate) >= 3 and not re.match(r"^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$", candidate):
                        result["factuurnummer"] = candidate
                        break

            date_patterns = [
                r"(\d{2}[-/]\d{2}[-/]\d{4})",
                r"(\d{4}[-/]\d{2}[-/]\d{2})",
                r"(\d{1,2}\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4})",
            ]
            for pattern in date_patterns:
                match = re.search(pattern, full_text, re.IGNORECASE)
                if match:
                    result["datum"] = _to_iso_date(match.group(1).strip())
                    break

            subtotal_match = re.search(r"(?:subtotaal|subtotal|netto|excl\.?\s*btw)[:\s]*[€$]?\s*([\d.,]+)", full_text, re.IGNORECASE)
            if subtotal_match:
                result["subtotaal"] = parse_amount(subtotal_match.group(1))

            btw_match = re.search(r"(?:btw|vat|tax)[:\s]*[€$]?\s*([\d.,]+)", full_text, re.IGNORECASE)
            if btw_match:
                result["btw"] = parse_amount(btw_match.group(1))

            total_match = re.search(r"(?:totaal|total|te\s+betalen|incl\.?\s*btw)[:\s]*[€$]?\s*([\d.,]+)", full_text, re.IGNORECASE)
            if total_match:
                result["totaal"] = parse_amount(total_match.group(1))

            if result["totaal"] > 0 and result["subtotaal"] == 0:
                if result["btw"] > 0:
                    result["subtotaal"] = round(result["totaal"] - result["btw"], 2)
                else:
                    result["subtotaal"] = round(result["totaal"] / 1.21, 2)
                    result["btw"] = round(result["totaal"] - result["subtotaal"], 2)

            text_lower = full_text.lower()
            categories = {
                "Software & Licenties": ["software", "license", "licentie", "saas", "subscription", "abonnement"],
                "Kantoorkosten": ["kantoor", "office", "papier", "printer", "bureau"],
                "Hosting & Domein": ["hosting", "server", "domein", "domain", "cloud", "aws", "azure"],
                "Telefoon & Internet": ["telefoon", "internet", "mobiel", "telecom", "provider"],
                "Reiskosten": ["reis", "trein", "ns", "ov", "benzine", "parkeren", "vlucht"],
                "Marketing": ["marketing", "advertentie", "google ads", "facebook", "reclame"],
                "Verzekering": ["verzekering", "insurance", "polis"],
                "Accountant": ["accountant", "boekhouder", "belasting", "administratie"],
            }
            for cat, keywords in categories.items():
                if any(kw in text_lower for kw in keywords):
                    result["categorie"] = cat
                    break

    except Exception:
        pass

    return result


def parse_amount(text: str) -> float:
    text = text.strip()
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")
    try:
        return round(float(text), 2)
    except ValueError:
        return 0
