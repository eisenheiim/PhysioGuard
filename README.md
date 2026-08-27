# PhysioGuard

PhysioGuard is a browser-based rehabilitation feedback tool. The first slice establishes the deterministic domain layer that a MediaPipe adapter and accessible dashboard can consume.

## Core contracts

- `src/lib/geometry.ts` contains 2D/3D joint-angle, signed-angle, alignment, distance, and angular-velocity math. Degenerate vectors return `NaN` so callers can fail safely instead of displaying a false measurement.
- `src/lib/safety.ts` contains protocol configuration, compensation detection, and safety evaluation. It supports knee flexion and shoulder movement compensation flags, configurable maximum/minimum angles, velocity limits, and compensation thresholds.
- `src/lib/exerciseStateMachine.ts` provides the exercise lifecycle: `IDLE → CALIBRATING → ACTIVE_REP → PEAK_HOLD → REP_COMPLETED → REST`. Unsafe pose confidence, threshold violations, and velocity spikes move the session to `REST` and expose human-readable halt reasons.

The safety layer is feedback/guardrail logic, not a diagnostic system. Protocol values must be selected or reviewed by a qualified clinician before use with a patient. The UI should surface `shouldHalt`, `severity`, and `reasons` prominently and provide an audio cue without requiring the patient to interpret a medical diagnosis.

## Local checks

```bash
npm install
npm run typecheck
npm test
```

Start the local app with:

```bash
npm run dev
```

Then open http://localhost:3000. If dependencies were previously installed with a different Next.js version, remove `node_modules` and run `npm install` again so the pinned Next.js 14 dependency is restored.

## OpenAI exercise extraction

Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY`. The browser sends only the locally extracted document text to `/api/analyze-rehab-document`; the key is used server-side and is never placed in client code. The route requests strict structured JSON for exercise cards and requires missing prescription values to remain unspecified. A clinician must review the returned cards before a session.

## Deploy to Render

Deploy this as a **Web Service**, not a Static Site, because the app has the server-side `/api/analyze-rehab-document` route. Render can use the included `render.yaml` Blueprint, or configure these values manually:

```text
Build Command: npm ci && npm run build
Start Command: npm start
Health Check Path: /api/healthz
Node: 20.20.2
```

Add `OPENAI_API_KEY` as a Render secret and optionally set `OPENAI_MODEL`. Never commit `.env.local` or place the key in a `NEXT_PUBLIC_*` variable. The health endpoint also verifies that the bundled MediaPipe and PDF worker assets are present.

Before publishing to GitHub, run:

```bash
nvm use 20
npm ci
npm run typecheck
npm test
npm run asset:check
npm run build
```

Camera access requires HTTPS in the deployed environment. The first visit may download several bundled MediaPipe assets, so the initial load can be slower than local development.
