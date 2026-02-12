import io
from datetime import datetime

import httpx
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

MAANDEN = [
    "januari", "februari", "maart", "april", "mei", "juni",
    "juli", "augustus", "september", "oktober", "november", "december",
]
FOOTER_COLOR = colors.HexColor("#4e7c7d")
PAGE_W, PAGE_H = A4
FOOTER_H = 20 * mm


def _format_date(date_str: str) -> str:
    try:
        d = datetime.strptime(date_str[:10], "%Y-%m-%d")
        return f"{d.day} {MAANDEN[d.month - 1]} {d.year}"
    except Exception:
        return date_str or ""


def _fmt(amount) -> str:
    """Format currency as € 1.250,00 (Dutch style)."""
    try:
        v = float(amount or 0)
    except (ValueError, TypeError):
        v = 0.0
    formatted = f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"€ {formatted}"


def _footer(canvas, doc, company):
    canvas.saveState()
    canvas.setFillColor(FOOTER_COLOR)
    canvas.rect(0, 0, PAGE_W, FOOTER_H, fill=1, stroke=0)

    website = company.get("website") or company.get("email") or ""
    adres = company.get("adres", "")
    pc_plaats = f"{company.get('postcode', '')} {company.get('plaats', '')}".strip()
    kvk = company.get("kvk_nummer", "")
    btw_nr = company.get("btw_nummer", "")

    line1_parts = [p for p in [website, adres, pc_plaats] if p]
    line2_parts = [p for p in [
        f"KVK-nummer {kvk}" if kvk else "",
        f"BTW-nummer {btw_nr}" if btw_nr else "",
    ] if p]

    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica", 8)
    cx = PAGE_W / 2
    canvas.drawCentredString(cx, FOOTER_H - 7 * mm, " | ".join(line1_parts))
    canvas.drawCentredString(cx, FOOTER_H - 13 * mm, " | ".join(line2_parts))
    canvas.restoreState()


def _get_logo(company):
    logo_url = company.get("logo_url")
    if not logo_url:
        return None
    try:
        resp = httpx.get(logo_url, timeout=5)
        if resp.status_code == 200:
            img = Image(io.BytesIO(resp.content), width=25 * mm, height=18 * mm)
            img.hAlign = "CENTER"
            return img
    except Exception:
        pass
    return None


def generate_invoice_pdf(invoice: dict, company: dict, klant: dict = None) -> bytes:
    klant = klant or {}
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=FOOTER_H + 10 * mm,
    )

    footer_cb = lambda c, d: _footer(c, d, company)

    # ── Styles ──────────────────────────────────────────────────────────────
    base = getSampleStyleSheet()

    def sty(name, **kw):
        return ParagraphStyle(name, parent=base["Normal"], **kw)

    normal = sty("N", fontSize=10, leading=14)
    bold10 = sty("B10", fontSize=10, leading=14, fontName="Helvetica-Bold")
    center = sty("C", fontSize=10, leading=14, alignment=TA_CENTER)
    center_bold = sty("CB", fontSize=10, leading=14, alignment=TA_CENTER, fontName="Helvetica-Bold")
    right9 = sty("R9", fontSize=9, leading=13, alignment=TA_RIGHT)
    small = sty("S", fontSize=9, leading=13, textColor=colors.HexColor("#555555"))
    small_center = sty("SC", fontSize=9, leading=14, alignment=TA_CENTER, textColor=colors.HexColor("#444444"))
    factuur_title = sty("FT", fontSize=13, fontName="Helvetica-Bold", alignment=TA_CENTER, leading=18)
    tbl_header = sty("TH", fontSize=10, fontName="Helvetica-Bold", leading=14)
    tbl_right = sty("TR", fontSize=10, leading=14, alignment=TA_RIGHT, fontName="Helvetica-Bold")
    tbl_label = sty("TL", fontSize=9, leading=13, textColor=colors.HexColor("#888888"))
    tbl_label_r = sty("TLR", fontSize=9, leading=13, alignment=TA_RIGHT, textColor=colors.HexColor("#888888"))

    elements = []
    W = PAGE_W - 40 * mm  # usable width

    # ── Logo ────────────────────────────────────────────────────────────────
    logo = _get_logo(company)
    if logo:
        elements.append(logo)
        elements.append(Spacer(1, 6 * mm))

    # ── Client address block ────────────────────────────────────────────────
    bedrijfsnaam = klant.get("bedrijfsnaam") or invoice.get("klant_naam", "")
    voornaam = klant.get("voornaam", "")
    achternaam = klant.get("achternaam", "")
    contactnaam = " ".join(filter(None, [voornaam, achternaam]))

    client_lines = [f"<b>{bedrijfsnaam}</b>"]
    if contactnaam and contactnaam != bedrijfsnaam:
        client_lines.append(contactnaam)
    if klant.get("adres"):
        client_lines.append(klant["adres"])
    pc_plaats = f"{klant.get('postcode', '')} {klant.get('plaats', '')}".strip()
    if pc_plaats:
        client_lines.append(pc_plaats)

    elements.append(Paragraph("<br/>".join(client_lines), normal))
    elements.append(Spacer(1, 10 * mm))

    # ── FACTUUR title with rule ─────────────────────────────────────────────
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc")))
    elements.append(Spacer(1, 3 * mm))
    elements.append(Paragraph("FACTUUR", factuur_title))
    elements.append(Spacer(1, 3 * mm))

    onderwerp = invoice.get("onderwerp", "")
    if onderwerp:
        elements.append(Paragraph(onderwerp, center))
    elements.append(Spacer(1, 3 * mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc")))
    elements.append(Spacer(1, 8 * mm))

    # ── Invoice meta ────────────────────────────────────────────────────────
    meta = [
        ["<b>Datum:</b>", _format_date(invoice.get("factuurdatum", ""))],
        ["<b>Factuurnr:</b>", invoice.get("factuurnummer", "")],
    ]
    if onderwerp:
        meta.append(["<b>Onderwerp:</b>", onderwerp])

    meta_table = Table(
        [[Paragraph(k, normal), Paragraph(v, normal)] for k, v in meta],
        colWidths=[30 * mm, W - 30 * mm],
        hAlign="LEFT",
    )
    meta_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 8 * mm))

    # ── Line items ──────────────────────────────────────────────────────────
    row_data = [
        [Paragraph("Omschrijving", tbl_header), Paragraph("Prijs", tbl_right)],
    ]
    for regel in invoice.get("regels", []):
        totaal = float(regel.get("aantal", 1)) * float(regel.get("tarief", 0))
        row_data.append([
            Paragraph(regel.get("beschrijving", ""), normal),
            Paragraph(_fmt(totaal), right9),
        ])

    line_table = Table(row_data, colWidths=[W - 40 * mm, 40 * mm])
    line_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("TOPPADDING", (0, 1), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("LINEBELOW", (0, 0), (-1, 0), 0.75, colors.HexColor("#333333")),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, colors.HexColor("#dddddd")),
    ]))
    elements.append(line_table)
    elements.append(Spacer(1, 6 * mm))

    # ── Totals ──────────────────────────────────────────────────────────────
    subtotaal = float(invoice.get("subtotaal", 0))
    btw_totaal = float(invoice.get("btw_totaal", 0))
    totaal = float(invoice.get("totaal", 0))

    # Determine BTW breakdown (assume single rate for display; list unique rates)
    regels = invoice.get("regels", [])
    btw_rates = sorted(set(r.get("btw_percentage", 21) for r in regels))
    btw_label = f"BTW ({', '.join(str(int(r)) + '%' for r in btw_rates)})"

    totals_data = [
        [Paragraph("Subtotaal", small), Paragraph(_fmt(subtotaal), right9)],
        [Paragraph(btw_label, small), Paragraph(_fmt(btw_totaal), right9)],
        [Paragraph("<b>Totaal</b>", bold10), Paragraph(f"<b>{_fmt(totaal)}</b>", sty("RB", fontSize=10, alignment=TA_RIGHT, fontName="Helvetica-Bold"))],
    ]
    totals_table = Table(totals_data, colWidths=[W - 45 * mm, 45 * mm], hAlign="RIGHT")
    totals_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEABOVE", (0, -1), (-1, -1), 0.75, colors.HexColor("#cccccc")),
        ("TOPPADDING", (0, -1), (-1, -1), 6),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 14 * mm))

    # ── Payment info ────────────────────────────────────────────────────────
    iban = company.get("iban", "")
    company_name = company.get("bedrijfsnaam", "")
    if iban:
        betaling_text = (
            f"Wil je het factuurbedrag overmaken binnen een termijn waar we allebei vrolijk "
            f"van worden? Dat mag op IBAN {iban} ten name van {company_name}"
        )
        elements.append(Paragraph(betaling_text, small_center))
        elements.append(Spacer(1, 6 * mm))

    # Notes or default closing
    if invoice.get("notities"):
        elements.append(Paragraph(invoice["notities"], small_center))
        elements.append(Spacer(1, 4 * mm))

    elements.append(Paragraph("Bedankt voor de opdracht!", small_center))

    doc.build(elements, onFirstPage=footer_cb, onLaterPages=footer_cb)
    return buffer.getvalue()
