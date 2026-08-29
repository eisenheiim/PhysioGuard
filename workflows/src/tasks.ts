import { task, type TaskContext } from "@renderinc/sdk/workflows";

export type SessionRep = {
  setNumber: number;
  repNumber: number;
  peakAngle: number;
  startingAngle?: number;
  confidence?: number;
  holdSeconds?: number;
  compensated: boolean;
  safetyThresholdHeld: boolean;
  quality?: "Good" | "Limited" | "Incomplete";
};

export type SessionInput = {
  sessionId: string;
  exercise: string;
  side: "Left" | "Right" | "Bilateral" | "Not specified";
  targetAngle?: number;
  safetyLimit?: number;
  reps: SessionRep[];
  safetyEvents: Array<{ angle: number; reason: string; timestamp?: string }>;
};

export type SessionMetrics = {
  sessionId: string;
  exercise: string;
  side: SessionInput["side"];
  totalReps: number;
  cleanReps: number;
  compensatedReps: number;
  peakRom: number;
  averageConfidence?: number;
  holdSuccesses: number;
  safetyEvents: number;
  measurementQuality: "Good" | "Limited" | "Incomplete";
};

function assertFinite(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
}

export const validateSession = task(
  { name: "validate_session", retry: { maxRetries: 2, waitDurationMs: 1000 } },
  async (_ctx: TaskContext, session: SessionInput) => {
    if (!session || typeof session.sessionId !== "string" || !session.sessionId.trim()) {
      throw new Error("A sessionId is required");
    }
    if (!session.exercise || !Array.isArray(session.reps) || !Array.isArray(session.safetyEvents)) {
      throw new Error("Session must include an exercise, reps, and safetyEvents array");
    }

    session.reps.forEach((rep, index) => {
      assertFinite(rep.peakAngle, `reps[${index}].peakAngle`);
      if (rep.confidence !== undefined) assertFinite(rep.confidence, `reps[${index}].confidence`);
      if (rep.holdSeconds !== undefined) assertFinite(rep.holdSeconds, `reps[${index}].holdSeconds`);
    });

    return session;
  },
);

export const analyzeSession = task(
  { name: "analyze_session", retry: { maxRetries: 2, waitDurationMs: 1000 } },
  async (_ctx: TaskContext, session: SessionInput): Promise<SessionMetrics> => {
    const totalReps = session.reps.length;
    const cleanReps = session.reps.filter((rep) => !rep.compensated).length;
    const confidenceValues = session.reps
      .map((rep) => rep.confidence)
      .filter((confidence): confidence is number => confidence !== undefined);
    const averageConfidence = confidenceValues.length
      ? confidenceValues.reduce((sum, confidence) => sum + confidence, 0) / confidenceValues.length
      : undefined;
    const holdSuccesses = session.reps.filter((rep) =>
      (rep.holdSeconds ?? 0) > 0 && rep.quality !== "Incomplete",
    ).length;
    const quality: SessionMetrics["measurementQuality"] =
      totalReps === 0 || confidenceValues.length === 0
        ? "Incomplete"
        : (averageConfidence ?? 0) < 0.65
          ? "Incomplete"
          : (averageConfidence ?? 0) < 0.8
            ? "Limited"
            : "Good";

    return {
      sessionId: session.sessionId,
      exercise: session.exercise,
      side: session.side,
      totalReps,
      cleanReps,
      compensatedReps: totalReps - cleanReps,
      peakRom: Math.max(0, ...session.reps.map((rep) => rep.peakAngle)),
      averageConfidence,
      holdSuccesses,
      safetyEvents: session.safetyEvents.length,
      measurementQuality: quality,
    };
  },
);

export const prepareReport = task(
  { name: "prepare_report", retry: { maxRetries: 2, waitDurationMs: 1000 } },
  async (_ctx: TaskContext, metrics: SessionMetrics) => ({
    ...metrics,
    reportStatus: "ready" as const,
    generatedAt: new Date().toISOString(),
  }),
);

export const processRehabilitationSession = task(
  { name: "process_rehabilitation_session", retry: { maxRetries: 2, waitDurationMs: 1000 } },
  async (ctx: TaskContext, session: SessionInput) => {
    const validated = await ctx.run(validateSession, session);
    const metrics = await ctx.run(analyzeSession, validated);
    return ctx.run(prepareReport, metrics);
  },
);
