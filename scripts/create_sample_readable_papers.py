from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

OUT = Path("output/pdf")
OUT.mkdir(parents=True, exist_ok=True)
NAVY = colors.HexColor("#123b36")
TEAL = colors.HexColor("#0f9f8c")
SLATE = colors.HexColor("#334155")
MUTED = colors.HexColor("#64748b")
PALE = colors.HexColor("#e7f7f3")
WARN = colors.HexColor("#fffbeb")
LINE = colors.HexColor("#cbd5e1")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TitleHealth", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=19, leading=23, textColor=NAVY, spaceAfter=5))
styles.add(ParagraphStyle(name="SubHealth", parent=styles["Normal"], fontSize=9, leading=13, textColor=MUTED))
styles.add(ParagraphStyle(name="SectionHealth", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=NAVY, spaceBefore=12, spaceAfter=6))
styles.add(ParagraphStyle(name="BodyHealth", parent=styles["BodyText"], fontSize=9, leading=13, textColor=SLATE))
styles.add(ParagraphStyle(name="SmallHealth", parent=styles["BodyText"], fontSize=7.5, leading=10, textColor=MUTED))
styles.add(ParagraphStyle(name="BoldHealth", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=NAVY))
styles.add(ParagraphStyle(name="CenterHealth", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=NAVY, alignment=1))


def P(text, style="BodyHealth"):
    return Paragraph(text, styles[style])


def table(rows, widths, background_rows=(0,)):
    commands = [
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]
    for row in background_rows:
        commands.append(("BACKGROUND", (0, row), (-1, row), PALE))
    result = Table(rows, colWidths=widths, repeatRows=1)
    result.setStyle(TableStyle(commands))
    return result


def decorate(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, letter[1] - 0.7 * inch, letter[0], 0.7 * inch, fill=1, stroke=0)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(0.55 * inch, 0.34 * inch, "PhysioGuard sample paper - not a medical prescription")
    canvas.drawRightString(letter[0] - 0.55 * inch, 0.34 * inch, f"Page {doc.page}")
    canvas.restoreState()


def header(title, source):
    return [P(title, "TitleHealth"), P(source, "SubHealth"), Spacer(1, 0.18 * inch)]


def patient_table():
    return table([
        [P("PATIENT", "SmallHealth"), P("DATE", "SmallHealth"), P("PROVIDER", "SmallHealth")],
        [P("Jordan Lee", "BoldHealth"), P("August 20, 2026", "BoldHealth"), P("Example Rehabilitation Clinic", "BoldHealth")],
    ], [2.1 * inch, 1.5 * inch, 2.95 * inch])


def exercise_section(number, name, prescription, camera, start, move, safety):
    return [
        P(f"Exercise {number} - {name}", "SectionHealth"),
        P(f"Prescription: {prescription}"),
        Spacer(1, 0.06 * inch),
        table([
            [P("CAMERA VIEW", "CenterHealth"), P("START", "CenterHealth"), P("MOVE", "CenterHealth"), P("SAFETY", "CenterHealth")],
            [P(camera, "BoldHealth"), P(start), P(move), P(safety)],
        ], [1.15 * inch, 1.7 * inch, 1.95 * inch, 1.75 * inch]),
    ]


def build(filename, title, source, exercises, notes):
    story = header(title, source)
    story.append(patient_table())
    for exercise in exercises:
        story.extend(exercise_section(*exercise))
    story += [P("General safety notes", "SectionHealth"), P(notes), Spacer(1, 0.12 * inch)]
    story.append(table([[P("IMPORTANT: This sample is for testing document extraction and camera planning. Confirm all exercise limits with a licensed clinician before use.", "SmallHealth")]], [6.55 * inch], background_rows=(0,)))
    SimpleDocTemplate(str(OUT / filename), pagesize=letter, leftMargin=.55 * inch, rightMargin=.55 * inch, topMargin=.9 * inch, bottomMargin=.55 * inch, title=title).build(story, onFirstPage=decorate, onLaterPages=decorate)


build(
    "sample_paper_knee_rehab.pdf",
    "KNEE REHABILITATION HOME PROGRAM",
    "Readable sample with explicit knee prescriptions for paper extraction.",
    [
        (1, "Heel Slides (Knee Flexion)", "2 sets of 10 repetitions. Target 90 degrees of knee flexion. Safety stop at 98 degrees.", "Side view", "Lie on your back with the upper back supported and the leg relaxed.", "Slowly slide the left heel toward the hip, pause briefly, and return with control.", "Keep the trunk relaxed. Stop for sharp pain, instability, or sudden movement."),
        (2, "Straight Leg Raise (SLR)", "2 sets of 8 repetitions. Target 45 degrees of hip flexion. Safety stop at 60 degrees.", "Side view", "Lie on your back with one knee bent and the working leg straight.", "Tighten the thigh, keep the knee locked, raise the leg slowly, and lower with control.", "Stop if the knee bends, pain increases, or the lower back arches."),
    ],
    "Rest 60 seconds between sets. Keep the shoulder, hip, knee, and ankle visible to the camera.",
)

build(
    "sample_paper_shoulder_rehab.pdf",
    "SHOULDER MOBILITY HOME PROGRAM",
    "Readable sample with shoulder exercises and different camera instructions.",
    [
        (1, "Shoulder Forward Flexion", "3 sets of 8 repetitions. Target 90 degrees. Safety stop at 110 degrees.", "Front view", "Sit or stand upright with the arm relaxed by your side.", "Raise the arm forward slowly to the target, then lower it with control.", "Do not shrug the shoulder. Stop for sharp pain or pinching."),
        (2, "Shoulder External Rotation", "2 sets of 12 repetitions. Hold the end position for 2 seconds. Safety stop at 45 degrees.", "Front view", "Keep the elbow at the side and bent to 90 degrees.", "Rotate the forearm outward without moving the elbow away from the body.", "Move slowly and keep the shoulder relaxed."),
    ],
    "Rest 45 seconds between sets. Keep both shoulders and the working elbow visible to the camera.",
)

build(
    "sample_paper_mixed_rehab.pdf",
    "LOWER EXTREMITY STRENGTH PROGRAM",
    "Readable sample with three exercises for testing multi-exercise plan selection.",
    [
        (1, "Glute Bridge", "2 sets of 10 repetitions. Hold the top position for 3 seconds. Target 175 degrees. Safety stop at 185 degrees.", "Side view", "Lie on your back with knees bent and feet supported.", "Lift the hips until the shoulders, hips, and knees are aligned, then lower slowly.", "Do not arch the lower back or force the range."),
        (2, "Side-Lying Clamshell", "2 sets of 12 repetitions. Target 40 degrees of hip abduction. Safety stop at 50 degrees.", "Side view", "Lie on your side with knees bent and feet together.", "Open the top knee while keeping the feet together, then return slowly.", "Keep the pelvis stacked. Do not roll backward."),
        (3, "Standing Hip Abduction", "2 sets of 10 repetitions. Target 30 degrees. Safety stop at 40 degrees.", "Front view", "Stand tall with a stable support nearby.", "Lift one leg out to the side without leaning, then lower with control.", "Keep the spine upright and stop if balance becomes unsafe."),
    ],
    "Rest 60 seconds between sets. Stop for sharp pain, giving way, new swelling, or symptoms that concern you.",
)

print("Created 3 readable sample rehabilitation papers in output/pdf")
