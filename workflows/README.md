# PhysioGuard Render Workflows

This service processes structured rehabilitation session data after a camera session ends.

It intentionally receives measurements only - not raw camera frames or video:

```text
validate_session
        ↓
analyze_session
        ↓
prepare_report
```

## Local setup

```bash
npm install
npm run build
npm start
```

## Render setup

Create a separate **Workflow** service in the Render Dashboard:

- Root directory: `workflows`
- Language: `Node`
- Build command: `npm install && npm run build`
- Start command: `node dist/index.js`

After deployment, start `process_rehabilitation_session` from the Workflow Tasks page to verify the chain. The task slug is shown in the Render Dashboard and has the form `{workflow-slug}/process_rehabilitation_session`.

The Next.js Web Service should trigger this task with a server-side `RENDER_API_KEY`. Never expose that key in a `NEXT_PUBLIC_*` variable.
