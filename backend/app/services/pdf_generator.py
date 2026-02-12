from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_LEFT
import io


def generate_invoice_pdf(invoice: dict, company: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            "InvoiceTitle",
            parent=styles["Heading1"],
            fontSize=24,
            spaceAfter=6 * mm,
            textColor=colors.HexColor("#1a1a1a"),
        )
    )
    styles.add(
        ParagraphStyle(
            "CompanyName",
            parent=styles["Normal"],
            fontSize=10,
            textColor=colors.HexColor("#666666"),
        )
    )
    styles.add(
        ParagraphStyle(
            "RightAlign",
            parent=styles["Normal"],
            alignment=TA_RIGHT,
            fontSize=9,
        )
    )
    styles.add(
        ParagraphStyle(
            "SmallText",
            parent=styles["Normal"],
            fontSize=9,
            textColor=colors.HexColor("#444444"),
        )
    )

    elements = []

    # Header: Company info + Invoice number
    company_name = company.get("bedrijfsnaam", "Opwolken")
    company_info = f"""<b>{company_name}</b><br/>
{company.get('adres', '')}<br/>
{company.get('postcode', '')} {company.get('plaats', '')}<br/>
{company.get('email', '')}<br/>
KVK: {company.get('kvk_nummer', '')} | BTW: {company.get('btw_nummer', '')}"""

    invoice_info = f"""<b>FACTUUR</b><br/>
Factuurnummer: {invoice.get('factuurnummer', '')}<br/>
Datum: {invoice.get('factuurdatum', '')}<br/>
Vervaldatum: {invoice.get('vervaldatum', '')}"""

    header_table = Table(
        [
            [
                Paragraph(company_info, styles["SmallText"]),
                Paragraph(invoice_info, styles["RightAlign"]),
            ]
        ],
        colWidths=[90 * mm, 80 * mm],
    )
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    elements.append(header_table)
    elements.append(Spacer(1, 10 * mm))

    # Client info
    elements.append(Paragraph("<b>Factuur aan:</b>", styles["SmallText"]))
    elements.append(Spacer(1, 2 * mm))
    elements.append(
        Paragraph(invoice.get("klant_naam", ""), styles["Normal"])
    )
    elements.append(Spacer(1, 8 * mm))

    # Subject
    if invoice.get("onderwerp"):
        elements.append(
            Paragraph(
                f"<b>Onderwerp:</b> {invoice['onderwerp']}", styles["Normal"]
            )
        )
        elements.append(Spacer(1, 6 * mm))

    # Line items table
    table_data = [["Omschrijving", "Aantal", "Tarief", "BTW %", "Totaal"]]
    for regel in invoice.get("regels", []):
        table_data.append(
            [
                regel.get("beschrijving", ""),
                str(regel.get("aantal", 1)),
                f"€ {regel.get('tarief', 0):.2f}",
                f"{regel.get('btw_percentage', 21)}%",
                f"€ {regel.get('totaal', 0):.2f}",
            ]
        )

    line_table = Table(
        table_data,
        colWidths=[70 * mm, 20 * mm, 30 * mm, 20 * mm, 30 * mm],
    )
    line_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f5f5f5")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#333333")),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                ("TOPPADDING", (0, 0), (-1, 0), 8),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
                ("TOPPADDING", (0, 1), (-1, -1), 6),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                (
                    "LINEBELOW",
                    (0, 0),
                    (-1, 0),
                    1,
                    colors.HexColor("#dddddd"),
                ),
                (
                    "LINEBELOW",
                    (0, -1),
                    (-1, -1),
                    1,
                    colors.HexColor("#dddddd"),
                ),
            ]
        )
    )
    elements.append(line_table)
    elements.append(Spacer(1, 6 * mm))

    # Totals
    totals_data = [
        ["Subtotaal", f"€ {invoice.get('subtotaal', 0):.2f}"],
        ["BTW", f"€ {invoice.get('btw_totaal', 0):.2f}"],
        ["Totaal", f"€ {invoice.get('totaal', 0):.2f}"],
    ]
    totals_table = Table(totals_data, colWidths=[130 * mm, 40 * mm])
    totals_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                (
                    "LINEABOVE",
                    (1, -1),
                    (-1, -1),
                    1,
                    colors.HexColor("#333333"),
                ),
            ]
        )
    )
    elements.append(totals_table)
    elements.append(Spacer(1, 10 * mm))

    # Payment info
    iban = company.get("iban", "")
    if iban:
        elements.append(
            Paragraph(
                f"<b>Betaling:</b> Gelieve het bedrag over te maken op IBAN {iban} "
                f"o.v.v. factuurnummer {invoice.get('factuurnummer', '')}.",
                styles["SmallText"],
            )
        )

    # Notes
    if invoice.get("notities"):
        elements.append(Spacer(1, 6 * mm))
        elements.append(
            Paragraph(
                f"<b>Opmerkingen:</b><br/>{invoice['notities']}",
                styles["SmallText"],
            )
        )

    doc.build(elements)
    return buffer.getvalue()
