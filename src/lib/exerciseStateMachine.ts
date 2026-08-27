import { ExerciseType, SafetyProtocol, SafetyResult, evaluateSafety } from "./safety";
import { Point2D } from "./geometry";
import { getProtocolMovementDirection, type ExerciseProtocol } from "../data/protocols";
import type { PoseLandmarks } from "./calibration";
import { BASELINE_TOLERANCE_DEGREES, evaluateProtocolSafety, isProtocolBackAtStart, isProtocolTargetReached, type ProtocolSafetyResult } from "./safety";

export type ExercisePhase = "IDLE" | "CALIBRATING" | "ACTIVE_REP" | "PEAK_HOLD" | "REP_COMPLETED" | "REST";

export interface ExerciseState {
  phase: ExercisePhase;
  currentAngle: number;
  peakRom: number;
  repetitionCount: number;
  validReps: number;
  compensatedReps: number;
  timeUnderTensionMs: number;
  lastSafety: SafetyResult | null;
  lastUpdatedAt: number | null;
}

export type ExerciseEvent =
  | { type: "START_CALIBRATION" }
  | { type: "CALIBRATION_COMPLETE" }
  | { type: "POSE_UPDATE"; angle: number; anchors: Record<string, Point2D | undefined>; timestamp?: number }
  | { type: "PEAK_HOLD_COMPLETE" }
  | { type: "REST_COMPLETE" }
  | { type: "STOP" };

export const initialExerciseState = (): ExerciseState => ({ phase: "IDLE", currentAngle: NaN, peakRom: 0, repetitionCount: 0, validReps: 0, compensatedReps: 0, timeUnderTensionMs: 0, lastSafety: null, lastUpdatedAt: null });

export class ExerciseStateMachine {
  private state: ExerciseState = initialExerciseState();
  constructor(private readonly exercise: ExerciseType, private readonly protocol: SafetyProtocol, private readonly repThresholdDegrees = 30) { }
  getState(): ExerciseState { return { ...this.state }; }
  dispatch(event: ExerciseEvent): ExerciseState {
    if (event.type === "STOP") { this.state = initialExerciseState(); return this.getState(); }
    if (event.type === "START_CALIBRATION" && this.state.phase === "IDLE") this.state.phase = "CALIBRATING";
    else if (event.type === "CALIBRATION_COMPLETE" && this.state.phase === "CALIBRATING") this.state.phase = "ACTIVE_REP";
    else if (event.type === "REST_COMPLETE" && this.state.phase === "REST") this.state.phase = "ACTIVE_REP";
    else if (event.type === "PEAK_HOLD_COMPLETE" && this.state.phase === "PEAK_HOLD") { this.state.phase = "REP_COMPLETED"; this.state.repetitionCount += 1; if (this.state.lastSafety?.isCompensating) this.state.compensatedReps += 1; else this.state.validReps += 1; this.state.phase = "REST"; }
    else if (event.type === "POSE_UPDATE" && (this.state.phase === "ACTIVE_REP" || this.state.phase === "PEAK_HOLD")) this.updatePose(event);
    return this.getState();
  }
  private updatePose(event: Extract<ExerciseEvent, { type: "POSE_UPDATE" }>): void {
    const timestamp = event.timestamp ?? Date.now();
    const deltaMs = this.state.lastUpdatedAt === null ? 0 : timestamp - this.state.lastUpdatedAt;
    const anchors = event.anchors;
    const safety = evaluateSafety({ exercise: this.exercise, angle: event.angle, previousAngle: this.state.currentAngle, deltaMs, anchors: { ...anchors, hip: anchors.hip, shoulder: anchors.shoulder, oppositeShoulder: anchors.oppositeShoulder }, protocol: this.protocol });
    this.state.currentAngle = event.angle; this.state.lastSafety = safety; this.state.lastUpdatedAt = timestamp;
    if (safety.shouldHalt) { this.state.phase = "REST"; return; }
    if (this.state.phase === "ACTIVE_REP") { this.state.peakRom = Math.max(this.state.peakRom, Number.isFinite(event.angle) ? event.angle : 0); if (this.state.peakRom >= this.repThresholdDegrees) this.state.phase = "PEAK_HOLD"; }
    if (this.state.phase === "PEAK_HOLD" && deltaMs > 0) this.state.timeUnderTensionMs += deltaMs;
  }
}

export type ProtocolRepPhase = "START" | "FLEXING_EXTENDING" | "PEAK_HOLD" | "RETURN" | "REST";

const BASELINE_SAMPLE_COUNT = 12;
const TARGET_HOLD_MS = 500;

export interface ProtocolExerciseState {
  phase: ProtocolRepPhase;
  currentAngle: number;
  measuredStartAngle: number | null;
  baselineReady: boolean;
  baselineSampleCount: number;
  baselineToleranceDegrees: number | null;
  targetHoldMs: number;
  peakAngle: number | null;
  repetitionCount: number;
  timeUnderTensionMs: number;
  lastUpdatedAt: number | null;
  lastSafety: ProtocolSafetyResult | null;
}

/** Direction-aware state machine used by the live camera flow. */
export class ProtocolExerciseStateMachine {
  private state: ProtocolExerciseState = {
    phase: "START", currentAngle: NaN, measuredStartAngle: null, baselineReady: false, baselineSampleCount: 0, baselineToleranceDegrees: null, targetHoldMs: 0, peakAngle: null, repetitionCount: 0,
    timeUnderTensionMs: 0, lastUpdatedAt: null, lastSafety: null,
  };

  constructor(private readonly protocol: ExerciseProtocol, private readonly baselineToleranceDegrees = BASELINE_TOLERANCE_DEGREES) { }

  getState(): ProtocolExerciseState { return { ...this.state }; }

  resetRep() {
    this.state.phase = "START";
    this.state.peakAngle = null;
    this.state.timeUnderTensionMs = 0;
    this.state.targetHoldMs = 0;
  }

  update(landmarks: PoseLandmarks, angle: number, timestamp = Date.now()): { completedRep: boolean; safety: ProtocolSafetyResult; state: ProtocolExerciseState } {
    const deltaMs = this.state.lastUpdatedAt === null ? 0 : Math.max(0, timestamp - this.state.lastUpdatedAt);
    const safety = evaluateProtocolSafety({ protocol: this.protocol, landmarks, angle, previousAngle: Number.isFinite(this.state.currentAngle) ? this.state.currentAngle : undefined, deltaMs });
    this.state.currentAngle = angle;
    this.state.lastUpdatedAt = timestamp;
    this.state.lastSafety = safety;

    // Dynamically adapt the return-to-start tolerance based on measurement
    // confidence and instantaneous motion stability to minimize false reps
    // on jittery frames while remaining responsive during clean tracking.
    if (this.state.baselineReady) {
      const base = this.baselineToleranceDegrees;
      const conf = Math.max(0, Math.min(1, safety.averageConfidence));
      // Confidence-driven scaling: high confidence → tighter, low → wider.
      let adaptive = base;
      if (conf >= 0.9) adaptive = Math.max(3, Math.round(base * 0.6));
      else if (conf >= 0.75) adaptive = Math.round(base * 1.0);
      else if (conf >= 0.6) adaptive = Math.min(12, Math.round(base * 1.3));
      else adaptive = Math.min(14, Math.round(base * 1.6));
      // Velocity tweak: very stable return → slightly tighter; fast motion → wider.
      const v = Math.abs(safety.velocityDegPerSecond || 0);
      if (v <= 20) adaptive = Math.max(3, adaptive - 1);
      else if (v >= 80) adaptive = Math.min(16, adaptive + 2);
      this.state.baselineToleranceDegrees = adaptive;
    }
    if (safety.shouldHalt) {
      // A safety breach ends the outward movement, but the user can still
      // complete this rep by returning to the measured starting angle.
      this.state.phase = "RETURN";
      return { completedRep: false, safety, state: this.getState() };
    }
    if (this.state.phase === "REST") return { completedRep: false, safety, state: this.getState() };
    if (this.state.phase === "START" && !this.state.baselineReady && Number.isFinite(angle)) {
      const sampleCount = this.state.baselineSampleCount;
      // The first valid pose frame is the patient's actual starting ROM.
      // Keep it fixed; later frames only provide enough stability time before
      // the exercise can begin, rather than changing the starting angle.
      if (sampleCount === 0) this.state.measuredStartAngle = angle;
      this.state.baselineSampleCount += 1;
      if (this.state.baselineSampleCount >= BASELINE_SAMPLE_COUNT) {
        this.state.baselineToleranceDegrees = this.baselineToleranceDegrees;
        this.state.baselineReady = true;
      }
      return { completedRep: false, safety, state: this.getState() };
    }
    if (this.state.phase === "START" && this.state.baselineReady && Number.isFinite(angle)) {
      this.state.phase = "FLEXING_EXTENDING";
    }
    if (this.state.phase === "FLEXING_EXTENDING") {
      this.state.peakAngle = this.state.peakAngle === null
        ? angle
        : getProtocolMovementDirection(this.protocol) === "decreasing" ? Math.min(this.state.peakAngle, angle) : Math.max(this.state.peakAngle, angle);
      this.state.timeUnderTensionMs += deltaMs;
      if (isProtocolTargetReached(this.protocol, angle) && Math.abs(angle - (this.state.measuredStartAngle ?? angle)) >= 10) {
        this.state.phase = "PEAK_HOLD";
        this.state.targetHoldMs = 0;
      }
    } else if (this.state.phase === "PEAK_HOLD") {
      if (!isProtocolTargetReached(this.protocol, angle)) {
        this.state.phase = "FLEXING_EXTENDING";
        this.state.targetHoldMs = 0;
      } else {
        this.state.targetHoldMs += deltaMs;
        this.state.timeUnderTensionMs += deltaMs;
        if (this.state.targetHoldMs >= TARGET_HOLD_MS) this.state.phase = "RETURN";
      }
    } else if (this.state.phase === "RETURN" && isProtocolBackAtStart(this.protocol, angle, this.state.baselineToleranceDegrees ?? BASELINE_TOLERANCE_DEGREES, this.state.measuredStartAngle ?? this.protocol.baselineAngle)) {
      this.state.repetitionCount += 1;
      const completedRep = true;
      this.resetRep();
      return { completedRep, safety, state: this.getState() };
    }
    return { completedRep: false, safety, state: this.getState() };
  }
}
