from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

OUTPUT = "/Users/sude/Documents/ChatGPT/truexercises/output/pdf/PhysioGuard_screenshot_report.pdf"

navy = colors.HexColor("#0f172a")
slate = colors.HexColor("#475569")
muted = colors.HexColor("#64748b")
teal = colors.HexColor("#0f766e")
mint = colors.HexColor("#f0fdfa")
line = colors.HexColor("#cbd5e1")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TitlePG", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=17, leading=21, textColor=colors.white, alignment=TA_LEFT, spaceAfter=3))
styles.add(ParagraphStyle(name="SubtitlePG", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=colors.HexColor("#99f6e4")))
styles.add(ParagraphStyle(name="SectionPG", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=navy, spaceBefore=7, spaceAfter=7))
styles.add(ParagraphStyle(name="BodyPG", parent=styles["Normal"], fontName="Helvetica", fontSize=8.5, leading=12, textColor=slate))
styles.add(ParagraphStyle(name="SmallPG", parent=styles["Normal"], fontName="Helvetica", fontSize=7.5, leading=10, textColor=muted))

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(line)
    canvas.line(14 * mm, 13 * mm, 196 * mm, 13 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(muted)
    canvas.drawString(14 * mm, 8 * mm, "PhysioGuard | Clinical review copy")
    canvas.drawRightString(196 * mm, 8 * mm, f"Page {doc.page}")
    canvas.restoreState()

doc = SimpleDocTemplate(OUTPUT, pagesize=A4, rightMargin=14 * mm, leftMargin=14 * mm, topMargin=14 * mm, bottomMargin=18 * mm)
story = []

header = Table([[Paragraph("PHYSIOGUARD - REHABILITATION PROGRESS REPORT", styles["TitlePG"]), Paragraph("CLINICIAN REVIEW COPY", styles["SubtitlePG"])]], colWidths=[125 * mm, 57 * mm])
header.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), navy),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
    ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
    ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
]))
story += [header, Spacer(1, 7 * mm)]

info = [
    [Paragraph("Patient", styles["SmallPG"]), Paragraph("Sude Yilmaz", styles["BodyPG"]), Paragraph("Date & time", styles["SmallPG"]), Paragraph("27 Aug 2026, 18:42", styles["BodyPG"])],
    [Paragraph("Exercise", styles["SmallPG"]), Paragraph("Forward shoulder flexion", styles["BodyPG"]), Paragraph("Laterality", styles["SmallPG"]), Paragraph("Right", styles["BodyPG"])],
    [Paragraph("Camera view", styles["SmallPG"]), Paragraph("Sagittal (side)", styles["BodyPG"]), Paragraph("Source", styles["SmallPG"]), Paragraph("Prescribed exercise plan", styles["BodyPG"])],
]
info_table = Table(info, colWidths=[25 * mm, 70 * mm, 28 * mm, 59 * mm])
info_table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.35, line), ("BACKGROUND", (0, 0), (-1, -1), colors.white), ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f8fafc")), ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#f8fafc")), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm), ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm)]))
story += [info_table, Spacer(1, 6 * mm), Paragraph("Clinical summary", styles["SectionPG"])]

summary = Table([
    [Paragraph("Starting ROM: 1.3718448091774° ± 4.0°", styles["BodyPG"]), Paragraph("Peak ROM: 153.0° / target 140.0°", styles["BodyPG"])],
    [Paragraph("Repetitions: 3 total | 3 clean | 0 compensated", styles["BodyPG"]), Paragraph("Safety events: 0 | Stop limit: 160.0°", styles["BodyPG"])],
    [Paragraph("Measurement quality: Good", styles["BodyPG"]), Paragraph("Average confidence: 90%", styles["BodyPG"])],
], colWidths=[91 * mm, 91 * mm])
summary.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), mint), ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#99f6e4")), ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#ccfbf1")), ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm), ("TOPPADDING", (0, 0), (-1, -1), 3 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm)]))
story += [summary, Spacer(1, 7 * mm), Paragraph("Rep-by-rep audit", styles["SectionPG"])]

rows = [
    ["Rep", "Start ROM", "Peak ROM", "Hold", "Form", "Compensation", "Safety", "Confidence"],
    ["S1 / R1", "1.3718448091774°", "153.0°", "0.0s", "Clean", "-", "Within limit", "92% · Good"],
    ["S1 / R2", "1.3718448091774°", "126.0°", "0.0s", "Clean", "-", "Within limit", "88% · Good"],
    ["S1 / R3", "1.3718448091774°", "129.0°", "0.0s", "Clean", "-", "Within limit", "90% · Good"],
]
audit = Table(rows, colWidths=[18 * mm, 34 * mm, 24 * mm, 16 * mm, 18 * mm, 22 * mm, 22 * mm, 28 * mm], repeatRows=1)
audit.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), navy), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 6.8), ("LEADING", (0, 0), (-1, -1), 8), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]), ("GRID", (0, 0), (-1, -1), 0.35, colors.white), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm), ("TOPPADDING", (0, 0), (-1, -1), 3 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm)]))
story += [audit, Spacer(1, 7 * mm)]

note = Table([[Paragraph("Session note", styles["BodyPG"]), Paragraph("Three repetitions were completed with clean form and no safety-limit events. Hold time was 0.0s for each repetition. Confidence remained above the measurement-quality threshold throughout the tracked frames.", styles["SmallPG"])]], colWidths=[28 * mm, 154 * mm])
note.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fff7ed")), ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#fed7aa")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm), ("TOPPADDING", (0, 0), (-1, -1), 3 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm)]))
story += [note, Spacer(1, 6 * mm), Paragraph("Computer-vision measurements are intended for clinician review and do not replace medical diagnosis, treatment, or the prescribing clinician's instructions.", styles["SmallPG"])]

doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUTPUT)
