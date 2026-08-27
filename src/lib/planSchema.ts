import Ajv from "ajv";

export const exerciseCard = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    protocolId: { type: "string" },
    name: { type: "string" },
    category: { type: "string" },
    instructions: { type: "string" },
    sets: { type: ["integer", "null"] },
    repetitions: { type: ["integer", "null"] },
    holdSeconds: { type: ["number", "null"] },
    restSeconds: { type: ["number", "null"] },
    targetAngleDegrees: { type: ["number", "null"] },
    safetyStopAngleDegrees: { type: ["number", "null"] },
    cameraSetup: { type: "string", enum: ["sagittal", "frontal", "not specified"] },
    compensationWarnings: { type: "array", items: { type: "string" } },
    evidence: { type: "string" },
    clinicianReviewRequired: { type: "boolean" },
  },
  required: [
    "id",
    "protocolId",
    "name",
    "category",
    "instructions",
    "sets",
    "repetitions",
    "holdSeconds",
    "restSeconds",
    "targetAngleDegrees",
    "safetyStopAngleDegrees",
    "cameraSetup",
    "compensationWarnings",
    "evidence",
    "clinicianReviewRequired",
  ],
} as const;

export const planSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    documentSummary: { type: "string" },
    clinicalSource: { type: ["string", "null"] },
    patientInstructions: { type: "array", items: { type: "string" } },
    exercises: { type: "array", items: exerciseCard },
    needsClinicianReview: { type: "boolean" },
    reviewNotes: { type: "array", items: { type: "string" } },
  },
  required: ["documentSummary", "clinicalSource", "patientInstructions", "exercises", "needsClinicianReview", "reviewNotes"],
} as const;

const ajv = new Ajv({ allErrors: true, strict: true });
const validateFn = ajv.compile(planSchema as any);

export function validatePlan(plan: unknown): { valid: true } | { valid: false; errors: string[] } {
  const valid = validateFn(plan);
  if (valid) return { valid: true };
  const errors = (validateFn.errors || []).map((e) => `${e.instancePath || "root"} ${e.message}`);
  return { valid: false, errors };
}
