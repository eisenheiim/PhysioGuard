# PhysioGuard

PhysioGuard turns a physiotherapy prescription into a guided, measurable home rehabilitation session.

Many patients receive exercises on paper but have no practical way to know whether they are moving through the prescribed range or performing repetitions consistently between appointments. PhysioGuard connects the prescription to exercise-specific camera feedback and a reviewable session report.

## What the project does

The core workflow is:

```text
Prescription paper
        ↓
Structured exercise plan
        ↓
User or clinician review and editing
        ↓
Exercise-specific calibration
        ↓
Pose, angle, confidence, and safety tracking
        ↓
Rep-by-rep rehabilitation report
```

Users can:

- Upload a physiotherapy PDF, image, or text prescription.
- Extract prescribed exercises into a structured plan.
- Review the source evidence and edit exercises, sets, repetitions, hold times, and rest periods.
- Manually select an exercise if document extraction needs correction.
- Confirm the plan before starting a session.
- Choose the left or right working side when the exercise supports it.
- Calibrate the camera using the landmarks required for that exercise.
- Track movement angles and repetitions in real time.
- Receive voice and visual feedback for form, confidence, and safety.
- Review a session summary with rep-by-rep ROM, form, hold, confidence, and safety data.
- Export a clinician-friendly PDF or structured JSON report.

PhysioGuard is a feedback and monitoring tool. It does not diagnose conditions or replace a physiotherapist's instructions.

## How it was built

PhysioGuard is a Next.js and TypeScript web application.

- **OpenAI API** structures information from the uploaded prescription into a validated exercise plan. The extracted source evidence remains visible for review.
- **MediaPipe Pose Landmarker** detects body landmarks locally in the browser through the device camera.
- **Exercise-specific protocols** select the landmarks, camera view, movement direction, target range, and safety limit needed for each exercise.
- **Geometry utilities** calculate 2D joint angles and 3D alignment measurements when depth is relevant.
- **Confidence gating and filtering** prevent unreliable frames from driving measurements when required landmarks are missing or unstable.
- **A repetition state machine** recognizes the starting position, movement toward the target, optional hold, and return to start. This prevents accidental double-counting.
- **Safety logic** pauses normal counting when confidence is too low, velocity is too high, or a configured safety limit is exceeded.
- **jsPDF** generates a rep-by-rep rehabilitation report for later review.
- **AJV** validates structured exercise plans before they can be used by the session.
- **Vitest** covers geometry, safety, plan validation, and repetition behavior.

## Safety and responsible AI

The application keeps the human in the loop:

1. A prescription is converted into a reviewable plan.
2. Missing or uncertain prescription values remain visible instead of being silently invented.
3. The user or clinician can edit the plan and confirm it before a session.
4. Live movement measurement is handled by deterministic geometry and safety rules.
5. Low-confidence tracking pauses measurement rather than pretending that the frame is reliable.

Camera pose processing is designed to run on-device in the browser. The application sends locally extracted document text to the server-side analysis route when document analysis is used; API credentials are never exposed in client code. Do not use the system as a substitute for medical diagnosis or professional care.

## Accessibility and usability

The interface is designed around a simple patient flow: choose the prescription, review the plan, calibrate, exercise, and review the report. It includes:

- Clear exercise instructions during camera use.
- Explicit left/right tracking labels.
- Visible calibration and “waiting for points” states.
- Voice controls and visual safety states.
- A manual fallback for recording a rep when appropriate.
- High-contrast health-oriented colors and keyboard-accessible controls.
- A clinician review step before a prescription-driven session begins.

## Local development

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If the dependencies or Next.js cache are stale:

```bash
rm -rf node_modules .next
npm install
npm run dev
```

For document analysis, copy `.env.example` to `.env.local` and set:

```text
OPENAI_API_KEY=your_key_here
```

The model can be changed with `OPENAI_MODEL`. Never commit `.env.local` or use a `NEXT_PUBLIC_*` variable for the API key.

## Verification

```bash
npm run typecheck
npm test
npm run asset:check
npm run build
```

Before a camera session, verify that the bundled MediaPipe model, MediaPipe WASM files, and PDF worker assets are present. Camera access requires HTTPS in a deployed environment. The first visit can take longer while browser assets are downloaded.

## Deployment

PhysioGuard is intended to run as a Render Web Service because it includes the server-side `/api/analyze-rehab-document` route.

```text
Build Command: npm ci && npm run build
Start Command: npm start
Health Check Path: /api/healthz
Node: 20.20.2
```

Set `OPENAI_API_KEY` as a Render secret. The health endpoint checks that the required MediaPipe and PDF assets are available.

## Current limitations

- Camera accuracy depends on lighting, camera placement, clothing, body visibility, and the selected exercise.
- A browser camera view is not a clinical motion-capture system.
- The current protocols are an extensible prototype and should be reviewed by a qualified clinician before patient use.
- Further testing is needed across different devices, body types, environments, and movement speeds.

## Hackathon submission

PhysioGuard was built for the **Hack for Humanity: AI for Mental/Physical Health and Concussion Recovery** hackathon. The project focuses on physical health by making prescribed home rehabilitation more measurable, understandable, and safety-aware.
