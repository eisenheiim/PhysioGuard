from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, PageBreak

OUT = Path("output/pdf/two_exercise_rehabilitation_instructions.pdf")
OUT.parent.mkdir(parents=True, exist_ok=True)
NAVY = colors.HexColor("#123b36")
TEAL = colors.HexColor("#0f9f8c")
SLATE = colors.HexColor("#475569")
MUTED = colors.HexColor("#64748b")
GREEN = colors.HexColor("#e7f7f3")
AMBER = colors.HexColor("#fffbeb")
LINE = colors.HexColor("#cbd5e1")

base = getSampleStyleSheet()
base.add(ParagraphStyle(name="TitleHealth", parent=base["Title"], fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=NAVY))
base.add(ParagraphStyle(name="Sub", parent=base["Normal"], fontSize=9, leading=13, textColor=MUTED))
base.add(ParagraphStyle(name="SectionHealth", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=NAVY, spaceBefore=10, spaceAfter=6))
base.add(ParagraphStyle(name="BodyHealth", parent=base["BodyText"], fontSize=9, leading=13, textColor=SLATE))
base.add(ParagraphStyle(name="SmallHealth", parent=base["BodyText"], fontSize=7.5, leading=10, textColor=MUTED))
base.add(ParagraphStyle(name="BoldHealth", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=NAVY))
base.add(ParagraphStyle(name="CenterHealth", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=NAVY, alignment=1))


def P(text, style="BodyHealth"):
    return Paragraph(text, base[style])


def table(data, widths, backgrounds=None):
    commands = [("BOX", (0, 0), (-1, -1), 0.6, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]
    for row, color in backgrounds or []:
        commands.append(("BACKGROUND", (0, row), (-1, row), color))
    result = Table(data, colWidths=widths)
    result.setStyle(TableStyle(commands))
    return result


def page_decor(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, letter[1] - 0.72 * inch, letter[0], 0.72 * inch, fill=1, stroke=0)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(0.55 * inch, 0.35 * inch, "PhysioGuard intake example - not a medical prescription")
    canvas.drawRightString(letter[0] - 0.55 * inch, 0.35 * inch, f"Two-exercise sample - Page {doc.page}")
    canvas.restoreState()


doc = SimpleDocTemplate(str(OUT), pagesize=letter, leftMargin=.55 * inch, rightMargin=.55 * inch, topMargin=.95 * inch, bottomMargin=.58 * inch, title="Two Exercise Rehabilitation Instructions")
story = [P("TWO-EXERCISE REHABILITATION PLAN", "TitleHealth"), P("Sample paper for the PhysioGuard upload, matching, and camera flow", "Sub"), Spacer(1, .2 * inch)]
story.append(table([[P("PATIENT", "SmallHealth"), P("DATE", "SmallHealth"), P("CLINIC / PROVIDER", "SmallHealth")], [P("Alex Morgan", "BoldHealth"), P("August 20, 2026", "BoldHealth"), P("Example Sports Rehabilitation Clinic", "BoldHealth")]], [2.25 * inch, 1.45 * inch, 2.85 * inch], [(0, colors.HexColor("#f8fafc"))]))
story += [P("Exercise 1 - Heel Slides (Knee Flexion)", "SectionHealth"), P("Prescription: 2 sets of 10 repetitions. Work toward 90 degrees of knee flexion without forcing the movement. Stop at 98 degrees or sooner for sharp pain, instability, or sudden movement.")]
story.append(table([[P("START", "CenterHealth"), P("MOVE", "CenterHealth"), P("SAFETY", "CenterHealth")], [P("Lie on your back with the left leg relaxed and the upper back supported."), P("Slowly slide the left heel toward the hip, pause briefly, then return with control."), P("Keep the trunk relaxed. Do not pull the leg with your hands or force the range.")]], [2.05 * inch, 2.25 * inch, 2.25 * inch], [(0, GREEN)]))
story += [P("Exercise 2 - Straight Leg Raise", "SectionHealth"), P("Prescription: 2 sets of 8 repetitions. Raise the leg toward 45 degrees while keeping the knee straight. Stop at 60 degrees or sooner if the knee bends, pain increases, or the movement becomes unstable.")]
story.append(table([[P("START", "CenterHealth"), P("MOVE", "CenterHealth"), P("SAFETY", "CenterHealth")], [P("Lie on your back with one knee bent and the working leg straight."), P("Tighten the thigh, keep the knee locked, slowly raise the straight leg, then lower it with control."), P("Do not allow the knee to bend or the lower back to arch excessively.")]], [2.05 * inch, 2.25 * inch, 2.25 * inch], [(0, GREEN)]))
story += [P("Camera setup", "SectionHealth")]
story.append(table([[P("REQUIRED VIEW", "CenterHealth"), P("FRAME CHECK", "CenterHealth")], [P("Side view / sagittal", "CenterHealth"), P("Place the device at knee height. Keep the shoulder, hip, knee, and ankle visible.")]], [2.1 * inch, 4.45 * inch], [(0, GREEN)]))
story += [PageBreak(), P("FORM AND SAFETY NOTES", "TitleHealth"), P("Use the paper from your clinician as the source of truth. PhysioGuard can provide movement feedback, but it does not diagnose or change your prescription.", "Sub"), Spacer(1, .2 * inch)]
story.append(table([[P("EXERCISE", "CenterHealth"), P("FORM WATCH", "CenterHealth"), P("STOP RULE", "CenterHealth")], [P("Heel Slides", "BoldHealth"), P("Keep the pelvis and upper back supported; avoid pulling the leg manually."), P("Stop at the prescribed limit or for pain, giving way, or instability.")], [P("Straight Leg Raise", "BoldHealth"), P("Keep the knee locked and avoid arching the lower back."), P("Stop if the knee bends, pain increases, or form cannot be controlled.")]], [1.55 * inch, 2.65 * inch, 2.35 * inch], [(0, GREEN)]))
story += [P("Session order", "SectionHealth"), P("1. Complete Heel Slides. 2. Review the exercise summary. 3. Select Next exercise: Straight Leg Raise. 4. Recalibrate the camera before starting the second exercise."), Spacer(1, .15 * inch)]
story.append(table([[P("IMPORTANT: This fictional sample is only for demonstrating the PhysioGuard upload flow. It is not medical advice. Confirm all exercise names, repetitions, ROM limits, and safety rules with a licensed clinician before use.", "SmallHealth")]], [6.55 * inch], [(0, AMBER)]))
doc.build(story, onFirstPage=page_decor, onLaterPages=page_decor)
print(OUT.resolve())
