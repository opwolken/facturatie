import re
import io
import pdfplumber


def extract_expense_data(pdf_bytes: bytes) -> dict:
    """Extract invoice/expense data from a PDF file using text analysis."""
    result = {
        "leverancier": "",
        "factuurnummer": "",
        "datum": "",
        "categorie": "",
        "beschrijving": "",
        "subtotaal": 0,
        "btw": 0,
        "totaal": 0,
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

            # Try to find company/supplier name (usually first non-empty lines)
            for line in lines[:5]:
                line = line.strip()
                if line and len(line) > 2 and not re.match(r"^[\d\s\-/\.]+$", line):
                    result["leverancier"] = line
                    break

            # Find invoice number patterns
            invoice_patterns = [
                r"(?:factuur(?:nummer)?|invoice(?:\s*(?:no|nr|number))?)[:\s#]*([A-Za-z0-9\-/]+)",
                r"(?:nota|bon|receipt)[:\s#]*([A-Za-z0-9\-/]+)",
            ]
            for pattern in invoice_patterns:
                match = re.search(pattern, full_text, re.IGNORECASE)
                if match:
                    result["factuurnummer"] = match.group(1).strip()
                    break

            # Find date patterns
            date_patterns = [
                r"(\d{2}[-/]\d{2}[-/]\d{4})",
                r"(\d{4}[-/]\d{2}[-/]\d{2})",
                r"(\d{1,2}\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4})",
            ]
            for pattern in date_patterns:
                match = re.search(pattern, full_text, re.IGNORECASE)
                if match:
                    result["datum"] = match.group(1).strip()
                    break

            # Find amounts - look for total, subtotal, btw/vat
            amount_pattern = r"[€$]\s*([\d.,]+)|(\d+[.,]\d{2})\s*(?:EUR|euro)"

            # Subtotal
            subtotal_match = re.search(
                r"(?:subtotaal|subtotal|netto|excl\.?\s*btw)[:\s]*[€$]?\s*([\d.,]+)",
                full_text,
                re.IGNORECASE,
            )
            if subtotal_match:
                result["subtotaal"] = parse_amount(subtotal_match.group(1))

            # BTW/VAT
            btw_match = re.search(
                r"(?:btw|vat|tax|omzetbelasting)[:\s]*[€$]?\s*([\d.,]+)",
                full_text,
                re.IGNORECASE,
            )
            if btw_match:
                result["btw"] = parse_amount(btw_match.group(1))

            # Total
            total_match = re.search(
                r"(?:totaal|total|te\s+betalen|bedrag|incl\.?\s*btw)[:\s]*[€$]?\s*([\d.,]+)",
                full_text,
                re.IGNORECASE,
            )
            if total_match:
                result["totaal"] = parse_amount(total_match.group(1))

            # If we have total but not subtotal, calculate
            if result["totaal"] > 0 and result["subtotaal"] == 0:
                if result["btw"] > 0:
                    result["subtotaal"] = round(result["totaal"] - result["btw"], 2)
                else:
                    result["subtotaal"] = round(result["totaal"] / 1.21, 2)
                    result["btw"] = round(
                        result["totaal"] - result["subtotaal"], 2
                    )

            # Try to determine category based on keywords
            text_lower = full_text.lower()
            categories = {
                "Software & Licenties": [
                    "software", "license", "licentie", "saas", "subscription", "abonnement"
                ],
                "Kantoorkosten": [
                    "kantoor", "office", "papier", "printer", "bureau"
                ],
                "Hosting & Domein": [
                    "hosting", "server", "domein", "domain", "cloud", "aws", "azure"
                ],
                "Telefoon & Internet": [
                    "telefoon", "internet", "mobiel", "telecom", "provider"
                ],
                "Reiskosten": [
                    "reis", "trein", "ns", "ov", "benzine", "parkeren", "vlucht"
                ],
                "Marketing": [
                    "marketing", "advertentie", "google ads", "facebook", "reclame"
                ],
                "Verzekering": [
                    "verzekering", "insurance", "polis"
                ],
                "Accountant": [
                    "accountant", "boekhouder", "belasting", "administratie"
                ],
            }
            for cat, keywords in categories.items():
                if any(kw in text_lower for kw in keywords):
                    result["categorie"] = cat
                    break

            # Description: first meaningful line or subject
            desc_match = re.search(
                r"(?:omschrijving|description|betreft|onderwerp)[:\s]*(.+)",
                full_text,
                re.IGNORECASE,
            )
            if desc_match:
                result["beschrijving"] = desc_match.group(1).strip()[:200]

    except Exception:
        pass

    return result


def parse_amount(text: str) -> float:
    """Parse a Dutch/European formatted amount to float."""
    text = text.strip()
    # Handle Dutch format: 1.234,56
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")
    try:
        return round(float(text), 2)
    except ValueError:
        return 0
