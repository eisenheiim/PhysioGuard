import { NextResponse } from "next/server";
import { CLINICAL_PROTOCOLS } from "../../../src/data/protocols";
import { validatePlan, planSchema } from "../../../src/lib/planSchema";

export const runtime = "nodejs";

const schema = planSchema;

const extractionInstructions = `You are selecting exercises for a rehabilitation session from a clinician-provided paper. The project exercise catalog is included below. Choose only exercises whose protocolId exists in that catalog; never invent an exercise or protocolId.

Rules:
- Select the catalog exercise that best matches each clearly prescribed exercise in the paper. Include only exercises supported by the paper.
- Extract sets, repetitions, holds, rest, target ROM angles, and hard safety limits when explicitly stated.
- If a value is absent or ambiguous, return null. Never invent a prescription or convert a vague phrase into a number.
- Preserve the document's clinical source and include a short evidence quote for each exercise.
- Mark clinicianReviewRequired true for any inferred, ambiguous, contradictory, or safety-sensitive item.
- This is structured extraction, not diagnosis and not a replacement for clinician review.
- Use sagittal for side-view instructions, frontal for front-view instructions, and not specified when absent.

Project exercise catalog:
${CLINICAL_PROTOCOLS.map((protocol) => JSON.stringify({ protocolId: protocol.id, name: protocol.name, category: protocol.category, cameraSetup: protocol.cameraSetup, targetMaxAngle: protocol.targetMaxAngle, safetyHardStopAngle: protocol.safetyHardStopAngle })).join("\n")}`;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the server." }, { status: 503 });
  const body = await request.json().catch(() => null) as { fileName?: string; text?: string } | null;
  if (!body?.text?.trim()) return NextResponse.json({ error: "No extracted document text was provided." }, { status: 400 });
  if (body.text.length > 80_000) return NextResponse.json({ error: "The extracted document is too long. Please upload a shorter paper." }, { status: 413 });

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.2",
        store: false,
        input: [
          { role: "system", content: [{ type: "input_text", text: extractionInstructions }] },
          { role: "user", content: [{ type: "input_text", text: `File name: ${body.fileName || "uploaded document"}\n\nDocument text:\n${body.text}` }] },
        ],
        text: { format: { type: "json_schema", name: "rehab_exercise_plan", strict: true, schema } },
      }),
    });
    if (!response.ok) throw new Error(`OpenAI API returned ${response.status}`);
    const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const outputText = payload.output_text || payload.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text;
    if (!outputText) throw new Error("OpenAI returned no structured output");

    // Strict JSON schema validation (Responsible AI: no invented fields)
    const parsed = JSON.parse(outputText) as { exercises?: Array<{ protocolId?: string }>; [key: string]: unknown };
    const validity = validatePlan(parsed);
    if (!validity.valid) {
      const details = validity.errors.slice(0, 6);
      return NextResponse.json({ error: "The analyzed plan did not match the required schema.", details }, { status: 422 });
    }
    // Ensure protocolId is from catalog only
    const ids = new Set(CLINICAL_PROTOCOLS.map((p) => p.id));
    const bad = (parsed.exercises || []).find((ex: any) => !ids.has(ex.protocolId));
    if (bad) return NextResponse.json({ error: `Unknown protocolId in output: ${bad.protocolId}` }, { status: 422 });

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Rehabilitation document analysis failed", error);
    return NextResponse.json({ error: "The document could not be analyzed. Check the server key and try again." }, { status: 502 });
  }
}
