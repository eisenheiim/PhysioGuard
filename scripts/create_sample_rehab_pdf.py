from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, PageBreak

OUT = Path("output/pdf/sample_rehabilitation_instructions.pdf")
OUT.parent.mkdir(parents=True, exist_ok=True)
NAVY = colors.HexColor("#0f172a")
SLATE = colors.HexColor("#475569")
MUTED = colors.HexColor("#64748b")
GREEN = colors.HexColor("#ecfdf5")
AMBER = colors.HexColor("#fffbeb")
RED = colors.HexColor("#fef2f2")
LINE = colors.HexColor("#cbd5e1")

base = getSampleStyleSheet()
base.add(ParagraphStyle(name="WhiteTitle", parent=base["Title"], fontName="Helvetica-Bold", fontSize=19, leading=23, textColor=colors.white))
base.add(ParagraphStyle(name="GreenSub", parent=base["Normal"], fontSize=9, leading=12, textColor=colors.HexColor("#d1fae5")))
base.add(ParagraphStyle(name="MainTitle", parent=base["Title"], fontName="Helvetica-Bold", fontSize=19, leading=23, textColor=NAVY))
base.add(ParagraphStyle(name="SubTitle", parent=base["Normal"], fontSize=9, leading=12, textColor=MUTED))
base.add(ParagraphStyle(name="Section", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=NAVY, spaceBefore=10, spaceAfter=6))
base.add(ParagraphStyle(name="Body9", parent=base["BodyText"], fontSize=9, leading=13, textColor=SLATE))
base.add(ParagraphStyle(name="Small", parent=base["BodyText"], fontSize=7.5, leading=10, textColor=MUTED))
base.add(ParagraphStyle(name="Bold9", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=NAVY))
base.add(ParagraphStyle(name="Center", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=NAVY, alignment=1))


def P(text, style="Body9"):
    return Paragraph(text, base[style])


def page_decor(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, letter[1] - 0.72 * inch, letter[0], 0.72 * inch, fill=1, stroke=0)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(0.55 * inch, 0.35 * inch, "PhysioGuard intake example - not a medical prescription")
    canvas.drawRightString(letter[0] - 0.55 * inch, 0.35 * inch, f"Sample document - Page {doc.page}")
    canvas.restoreState()


def styled_table(data, widths, backgrounds=None):
    commands = [("BOX", (0, 0), (-1, -1), 0.6, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]
    for row, color in (backgrounds or []):
        commands.append(("BACKGROUND", (0, row), (-1, row), color))
    table = Table(data, colWidths=widths)
    table.setStyle(TableStyle(commands))
    return table


doc = SimpleDocTemplate(str(OUT), pagesize=letter, leftMargin=.55 * inch, rightMargin=.55 * inch, topMargin=.95 * inch, bottomMargin=.58 * inch, title="Sample Rehabilitation Instructions")
story = [P("SAMPLE REHABILITATION INSTRUCTIONS", "MainTitle"), P("For PhysioGuard document upload and review flow", "SubTitle"), Spacer(1, .2 * inch)]
story.append(styled_table([[P("PATIENT", "Small"), P("DATE OF ISSUE", "Small"), P("CLINIC / PROVIDER", "Small")], [P("Alex Morgan", "Bold9"), P("August 19, 2026", "Bold9"), P("Example Sports Rehabilitation Clinic", "Bold9")]], [2.25 * inch, 1.65 * inch, 2.65 * inch]))
story += [P("Clinical protocol", "Section")]
story.append(styled_table([[P("Protocol", "Small"), P("Post-operative ACL rehabilitation - Phase 2", "Bold9")], [P("Primary exercise", "Small"), P("Knee flexion heel slides - left knee")], [P("Clinical reference", "Small"), P("Mass General Brigham post-op ACL rehabilitation protocol, Phase 2")], [P("Prescribed target", "Small"), P("Work toward 90 degrees of knee flexion without forcing the movement.")], [P("Safety hard stop", "Small"), P("Stop at 98 degrees or sooner if pain, instability, or a sudden velocity spike occurs.")]], [1.35 * inch, 5.2 * inch], [(0, colors.HexColor("#f8fafc"))]))
story += [P("Camera setup", "Section")]
story.append(styled_table([[P("REQUIRED VIEW", "Center"), P("PATIENT POSITION", "Center"), P("FRAME CHECK", "Center")], [P("Side view / sagittal", "Center"), P("Lie flat on your back. Keep your left hip, knee, ankle, and shoulder visible."), P("Place the device at knee height. Step back about 2 meters. Keep the full leg inside the frame.")]], [1.65 * inch, 2.35 * inch, 2.55 * inch], [(0, GREEN)]))
story += [P("Exercise instructions", "Section")]
story.append(styled_table([[P("1", "Center"), P("Start position", "Bold9"), P("Lie on your back with both legs relaxed and straight. Keep your upper back and pelvis supported.")], [P("2", "Center"), P("Slow flexion", "Bold9"), P("Slowly slide the left heel toward your hip. Do not pull the leg with your hands.")], [P("3", "Center"), P("Pause", "Bold9"), P("When target depth is reached, pause briefly while keeping your trunk relaxed.")], [P("4", "Center"), P("Return", "Bold9"), P("Slowly slide the heel away until the leg returns to the starting position.")]], [.4 * inch, 1.5 * inch, 4.65 * inch], [(0, GREEN)]))

story += [PageBreak(), P("ADDITIONAL EXERCISES ON THIS PAPER", "MainTitle"), P("The following exercises are included so the upload flow can match a complete home program to the guided exercise catalog.", "SubTitle"), Spacer(1, .2 * inch)]
story.append(styled_table([[P("EXERCISE", "Center"), P("PRESCRIPTION", "Center"), P("INSTRUCTIONS AND LIMITS", "Center")],
    [P("Straight Leg Raise", "Bold9"), P("2 sets x 8 reps", "Bold9"), P("Keep the knee locked and raise the leg to 45 degrees. Stop at 60 degrees or if the knee bends.")],
    [P("Short Arc Quad", "Bold9"), P("2 sets x 10 reps", "Bold9"), P("Place a bolster under the knee and straighten the lower leg. Avoid hyperextension.")],
    [P("Glute Bridge", "Bold9"), P("2 sets x 10 reps", "Bold9"), P("Lift the hips with control and pause for 3 seconds. Keep the ribs down and do not arch the back.")],
    [P("Side-Lying Clamshell", "Bold9"), P("2 sets x 12 reps", "Bold9"), P("Keep feet together and open the top knee. Do not roll the pelvis backward.")],
    [P("Standing Hip Abduction", "Bold9"), P("2 sets x 10 reps", "Bold9"), P("Face a counter for support and lift the leg out to the side. Keep the trunk upright.")],
    [P("Standing Calf Raises", "Bold9"), P("2 sets x 12 reps", "Bold9"), P("Rise onto the balls of the feet and pause briefly. Keep the ankles straight.")]],
    [1.65 * inch, 1.35 * inch, 3.55 * inch], [(0, GREEN), (2, colors.HexColor("#f8fafc")), (4, colors.HexColor("#f8fafc")), (6, colors.HexColor("#f8fafc"))]))
story += [Spacer(1, .22 * inch), P("General home-program guidance", "Section"), P("Complete exercises in the order prescribed by your clinician. Rest 60 seconds between sets. Stop for sharp pain, instability, new swelling, or any symptom that concerns you. The app may flag form and angle guardrails, but it does not diagnose or change the prescription.")]

story += [PageBreak(), P("FORM AND SAFETY GUARDRAILS", "MainTitle"), P("PhysioGuard will provide feedback on the following movement patterns during the session.", "SubTitle"), Spacer(1, .2 * inch)]
story.append(styled_table([[P("CHECK", "Center"), P("WHAT TO WATCH", "Center"), P("CORRECTION CUE", "Center")], [P("Trunk pitch forward", "Bold9"), P("Upper torso bends forward to pull the leg manually. Threshold: 18 degrees."), P("Keep your upper back relaxed on the ground.")], [P("Pelvic asymmetry", "Bold9"), P("Hip hitching or pelvic rotation changes pressure through the pelvis. Threshold: 12 degrees."), P("Maintain even pressure across both hips.")], [P("Hard stop", "Bold9"), P("Knee angle reaches the 98 degree safety ceiling, or movement becomes unstable."), P("Stop, relax, and return to the starting position slowly.")]], [1.55 * inch, 2.7 * inch, 2.3 * inch], [(0, GREEN), (3, RED)]))
story += [P("Session prescription", "Section")]
story.append(styled_table([[P("Frequency", "Small"), P("Repetitions", "Small"), P("Rest", "Small"), P("Pain rule", "Small")], [P("As directed by your clinician", "Bold9"), P("2 sets of 10", "Bold9"), P("60 seconds", "Bold9"), P("Stop and contact your clinician for sharp pain, giving way, or new swelling.")]], [1.5 * inch, 1.2 * inch, 1.25 * inch, 2.6 * inch], [(0, colors.HexColor("#f8fafc"))]))
story += [P("Expected voice cues", "Section"), P("Ready: Please position yourself sideways to the camera. Lie flat and slowly slide your heel."), P("Good repetition: Target depth reached with stable form. Slowly extend your leg."), P("Correction: Notice your torso posture. Keep your upper body flat."), P("Safety halt: Prescribed limit reached for Phase 2. Return to starting position."), Spacer(1, .15 * inch)]
story.append(styled_table([[P("IMPORTANT: This is a fictional sample document created to demonstrate the PhysioGuard upload flow. It is not medical advice and must not be used as a real treatment plan. Any exercise, ROM limit, frequency, or safety instruction must be confirmed by a licensed clinician for the individual patient.", "Small")]], [6.55 * inch], [(0, AMBER)]))
doc.build(story, onFirstPage=page_decor, onLaterPages=page_decor)
print(OUT.resolve())
