import { Point2D, calculateAngle, calculateVelocity, signedAngleDegrees } from "./geometry";
import { getProtocolMovementDirection, type ExerciseProtocol } from "../data/protocols";
import type { PoseLandmarks } from "./calibration";

export type ExerciseType = "knee-flexion" | "shoulder-abduction" | "shoulder-flexion";

export interface SafetyProtocol {
  id: string;
  label: string;
  maxAngle: number;
  minAngle?: number;
  velocityLimitDegPerSecond?: number;
  /** Optional measurement-specific compensation thresholds. */
  trunkLateralTiltLimit?: number;
  trunkForwardPitchLimit?: number;
}

export const DEFAULT_PROTOCOLS: Record<string, SafetyProtocol> = {
  "acl-stage-2": {
    id: "acl-stage-2",
    label: "Post-ACL rehabilitation · Stage 2",
    maxAngle: 90,
    minAngle: 0,
    velocityLimitDegPerSecond: 120,
    trunkLateralTiltLimit: 12,
    trunkForwardPitchLimit: 15,
  },
  "general-range-of-motion": {
    id: "general-range-of-motion",
    label: "General range-of-motion screen",
    maxAngle: 180,
    minAngle: 0,
    velocityLimitDegPerSecond: 180,
  },
};

export interface PoseAnchors {
  hip?: Point2D;
  shoulder?: Point2D;
  oppositeShoulder?: Point2D;
  ear?: Point2D;
  knee?: Point2D;
  ankle?: Point2D;
  trunkTop?: Point2D;
  trunkBottom?: Point2D;
}

export interface CompensationResult {
  isCompensating: boolean;
  flags: Array<"trunk-lateral-tilt" | "trunk-forward-pitch" | "contralateral-shoulder-drop">;
  values: { trunkLateralTilt: number; trunkForwardPitch: number; contralateralShoulderDrop: number };
}

export interface SafetyResult extends CompensationResult {
  shouldHalt: boolean;
  severity: "safe" | "caution" | "halt";
  reasons: string[];
  velocityDegPerSecond: number;
  angle: number;
}

export interface ProtocolSafetyResult {
  shouldHalt: boolean;
  severity: "safe" | "caution" | "halt";
  reasons: string[];
  compensationTypes: string[];
  velocityDegPerSecond: number;
  angle: number;
  averageConfidence: number;
}

const finiteOrZero = (value: number) => (Number.isFinite(value) ? value : 0);
// A small fixed return band avoids counting a rep from camera drift while
// allowing normal pose-estimation jitter. Configurable per state-machine use.
export const BASELINE_TOLERANCE_DEGREES = 6;

function compensationDeviation(type: string, measuredAngle: number): number {
  // Checks built from a shoulder/hip plus opposite-hip triangle are naturally
  // close to 90 degrees when the pelvis is level. Treating them as 180 degrees
  // creates a permanent warning during otherwise normal standing exercises.
  const referenceAngle = /shrug|scapular|shoulder_drop|lateral_trunk_tilt|hip_hiking|pelvic_drop|pelvic_rotation/i.test(type) ? 90 : /tiptoe|ankle_inversion_eversion/i.test(type) ? 90 : 180;
  return Math.abs(referenceAngle - measuredAngle);
}

/** Flexion often decreases the included joint angle; elevation often increases it. */
export function isSafetyLimitBreached(protocol: ExerciseProtocol, angle: number): boolean {
  if (!Number.isFinite(angle)) return true;
  return getProtocolMovementDirection(protocol) === "decreasing"
    ? angle <= protocol.safetyHardStopAngle
    : angle >= protocol.safetyHardStopAngle;
}

export function isProtocolTargetReached(protocol: ExerciseProtocol, angle: number, tolerance = 6): boolean {
  if (!Number.isFinite(angle)) return false;
  return getProtocolMovementDirection(protocol) === "decreasing"
    ? angle <= protocol.targetMaxAngle + tolerance
    : angle >= protocol.targetMaxAngle - tolerance;
}

export function isProtocolBackAtStart(protocol: ExerciseProtocol, angle: number, tolerance = BASELINE_TOLERANCE_DEGREES, measuredStartAngle = protocol.baselineAngle): boolean {
  if (!Number.isFinite(angle)) return false;
  return getProtocolMovementDirection(protocol) === "decreasing"
    ? angle >= measuredStartAngle - tolerance
    : angle <= measuredStartAngle + tolerance;
}

export function evaluateProtocolSafety(input: {
  protocol: ExerciseProtocol;
  landmarks: PoseLandmarks;
  angle: number;
  previousAngle?: number;
  deltaMs?: number;
}): ProtocolSafetyResult {
  const requiredNames = Array.from(new Set(input.protocol.primaryJoint));
  const confidenceValues = requiredNames.map((name) => input.landmarks[name]?.visibility ?? 0).filter((value) => Number.isFinite(value));
  const averageConfidence = confidenceValues.length ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length : 0;
  const reasons: string[] = [];
  const compensationTypes: string[] = [];
  for (const check of input.protocol.compensationChecks) {
    const points = check.anchorJoints.map((name) => input.landmarks[name]);
    if (points.some((point) => !point || (point.visibility ?? 0) < 0.65)) continue;
    const measured = calculateAngle(points[0]!, points[1]!, points[2]!);
    if (Number.isFinite(measured) && compensationDeviation(check.type, measured) > check.thresholdAngle) {
      compensationTypes.push(check.type);
      reasons.push(check.correctionPrompt);
    }
  }
  const velocity = input.previousAngle === undefined ? 0 : calculateVelocity(input.previousAngle, input.angle, input.deltaMs ?? 0);
  if (averageConfidence < 0.65) reasons.push("Pose confidence is insufficient");
  if (isSafetyLimitBreached(input.protocol, input.angle)) reasons.push(`Safety limit reached at ${input.protocol.safetyHardStopAngle}°`);
  if (Number.isFinite(velocity) && velocity > 180) reasons.push("Movement velocity spike detected");
  const hardHalt = reasons.some((reason) => reason.startsWith("Pose confidence") || reason.startsWith("Safety limit") || reason.startsWith("Movement velocity"));
  return { shouldHalt: hardHalt, severity: hardHalt ? "halt" : compensationTypes.length ? "caution" : "safe", reasons, compensationTypes, velocityDegPerSecond: finiteOrZero(velocity), angle: input.angle, averageConfidence };
}

export function detectCompensation(exercise: ExerciseType, anchors: PoseAnchors, protocol?: SafetyProtocol): CompensationResult {
  const trunkLateralTilt = anchors.trunkTop && anchors.trunkBottom
    ? Math.abs(signedAngleDegrees({ x: 0, y: -1 }, { x: anchors.trunkTop.x - anchors.trunkBottom.x, y: anchors.trunkTop.y - anchors.trunkBottom.y }))
    : 0;
  const trunkForwardPitch = anchors.ear && anchors.hip
    ? Math.abs(signedAngleDegrees({ x: 0, y: -1 }, { x: anchors.ear.x - anchors.hip.x, y: anchors.ear.y - anchors.hip.y }))
    : 0;
  const contralateralShoulderDrop = anchors.shoulder && anchors.oppositeShoulder
    ? Math.abs(anchors.shoulder.y - anchors.oppositeShoulder.y)
    : 0;
  const flags: CompensationResult["flags"] = [];
  const lateralLimit = protocol?.trunkLateralTiltLimit ?? 12;
  const forwardLimit = protocol?.trunkForwardPitchLimit ?? 15;
  if (exercise === "knee-flexion" && trunkLateralTilt > lateralLimit) flags.push("trunk-lateral-tilt");
  if (exercise === "knee-flexion" && trunkForwardPitch > forwardLimit) flags.push("trunk-forward-pitch");
  if ((exercise === "shoulder-abduction" || exercise === "shoulder-flexion") && trunkLateralTilt > lateralLimit) flags.push("trunk-lateral-tilt");
  if ((exercise === "shoulder-abduction" || exercise === "shoulder-flexion") && contralateralShoulderDrop > 0.08) flags.push("contralateral-shoulder-drop");
  return { isCompensating: flags.length > 0, flags, values: { trunkLateralTilt, trunkForwardPitch, contralateralShoulderDrop } };
}

export function evaluateSafety(input: {
  exercise: ExerciseType;
  angle: number;
  previousAngle?: number;
  deltaMs?: number;
  anchors: PoseAnchors;
  protocol: SafetyProtocol;
}): SafetyResult {
  const compensation = detectCompensation(input.exercise, input.anchors, input.protocol);
  const velocity = input.previousAngle === undefined ? 0 : calculateVelocity(input.previousAngle, input.angle, input.deltaMs ?? 0);
  const reasons: string[] = [];
  if (!Number.isFinite(input.angle)) reasons.push("Pose confidence is insufficient");
  if (Number.isFinite(input.angle) && input.angle > input.protocol.maxAngle) reasons.push(`Angle exceeds ${input.protocol.maxAngle}° safety limit`);
  if (Number.isFinite(input.angle) && input.protocol.minAngle !== undefined && input.angle < input.protocol.minAngle) reasons.push(`Angle is below ${input.protocol.minAngle}° safety limit`);
  if (input.protocol.velocityLimitDegPerSecond !== undefined && velocity > input.protocol.velocityLimitDegPerSecond) reasons.push("Movement velocity spike detected");
  if (compensation.isCompensating) reasons.push(...compensation.flags.map((flag) => flag.replace(/-/g, " ")));
  const hardHalt = reasons.some((reason) => reason.includes("exceeds") || reason.includes("below") || reason.includes("velocity") || reason.includes("insufficient"));
  return { ...compensation, shouldHalt: hardHalt, severity: hardHalt ? "halt" : compensation.isCompensating ? "caution" : "safe", reasons, velocityDegPerSecond: finiteOrZero(velocity), angle: input.angle };
}

export function kneeFlexionAngle(hip: Point2D, knee: Point2D, ankle: Point2D): number { return calculateAngle(hip, knee, ankle); }
export function shoulderAngle(hip: Point2D, shoulder: Point2D, elbow: Point2D): number { return calculateAngle(hip, shoulder, elbow); }
