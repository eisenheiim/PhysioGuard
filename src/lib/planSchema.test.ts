import { describe, it, expect } from "vitest";
import { validatePlan } from "./planSchema";

const validPlan = {
  documentSummary: "ACL rehab",
  clinicalSource: "Clinic A",
  patientInstructions: ["Do not force pain"],
  exercises: [
    {
      id: "e1",
      protocolId: "heel_slides",
      name: "Heel Slides (Knee Flexion)",
      category: "Lower Extremity",
      instructions: "Slide heel slowly",
      sets: 3,
      repetitions: 10,
      holdSeconds: null,
      restSeconds: 30,
      targetAngleDegrees: 90,
      safetyStopAngleDegrees: 100,
      cameraSetup: "sagittal",
      compensationWarnings: [],
      evidence: "Protocol note",
      clinicianReviewRequired: false,
    },
  ],
  needsClinicianReview: false,
  reviewNotes: [],
};

describe("plan schema validator", () => {
  it("accepts a valid plan", () => {
    const res = validatePlan(validPlan);
    expect(res.valid).toBe(true);
  });

  it("rejects when required fields are missing", () => {
    const broken = { ...validPlan, documentSummary: undefined } as any;
    const res = validatePlan(broken);
    expect(res.valid).toBe(false);
  });

  it("rejects wrong cameraSetup enum", () => {
    const broken = JSON.parse(JSON.stringify(validPlan));
    broken.exercises[0].cameraSetup = "diagonal";
    const res = validatePlan(broken);
    expect(res.valid).toBe(false);
  });
});
