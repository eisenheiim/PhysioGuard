export interface AIExerciseCard {
  id: string;
  protocolId: string;
  name: string;
  category: string;
  instructions: string;
  sets: number | null;
  repetitions: number | null;
  holdSeconds: number | null;
  restSeconds: number | null;
  targetAngleDegrees: number | null;
  safetyStopAngleDegrees: number | null;
  cameraSetup: "sagittal" | "frontal" | "not specified";
  compensationWarnings: string[];
  evidence: string;
  clinicianReviewRequired: boolean;
  side?: "Left" | "Right";
}

export interface AIExercisePlan {
  documentSummary: string;
  clinicalSource: string | null;
  patientInstructions: string[];
  exercises: AIExerciseCard[];
  needsClinicianReview: boolean;
  reviewNotes: string[];
  clinicianConfirmed?: boolean;
}
