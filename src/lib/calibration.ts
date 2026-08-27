import type { ExerciseProtocol } from "../data/protocols";

export interface PoseLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export type PoseLandmarks = Record<string, PoseLandmark | undefined>;

export interface CalibrationResult {
  isReady: boolean;
  anchorsVisible: boolean;
  perspectiveAligned: boolean;
  stable: boolean;
  visibleAnchors: string[];
  missingAnchors: string[];
  issues: string[];
  confidence: number;
}

const MIN_VISIBILITY = 0.65;

/**
 * Calibration is exercise-specific. A shoulder exercise should not block on
 * lower-leg landmarks that are outside the camera frame. Its primary joint
 * and the upper-body anchors needed for posture/perspective are sufficient.
 */
export function getRequiredCalibrationAnchors(protocol: ExerciseProtocol): string[] {
  const configured = [
    ...protocol.primaryJoint,
    ...protocol.compensationChecks.flatMap((check) => check.anchorJoints),
  ];
  const unique = Array.from(new Set(configured));
  if (protocol.id === "bird_dog") {
    return Array.from(new Set([...unique, "RIGHT_WRIST", "RIGHT_SHOULDER", "LEFT_ANKLE"]));
  }
  if (protocol.id === "glute_bridge") {
    return Array.from(new Set([...unique, "RIGHT_SHOULDER", "RIGHT_HIP", "RIGHT_KNEE"]));
  }
  if (protocol.id === "cat_camel") {
    return Array.from(new Set([...unique, "RIGHT_SHOULDER", "RIGHT_HIP"]));
  }
  if (protocol.id === "cervical_retraction") return unique;
  if (protocol.category !== "Upper Extremity") return unique;

  const primary = new Set(protocol.primaryJoint);
  const subjectPrefix = protocol.primaryJoint[1]?.startsWith("RIGHT_") ? "RIGHT_" : "LEFT_";
  const oppositePrefix = subjectPrefix === "RIGHT_" ? "LEFT_" : "RIGHT_";
  const upperBody = unique.filter((name) => !/(KNEE|ANKLE|HEEL|FOOT)/.test(name) && (primary.has(name) || !name.startsWith(oppositePrefix)));
  const required = new Set(upperBody);
  required.add(`${subjectPrefix}SHOULDER`);
  required.add(`${subjectPrefix}HIP`);
  return Array.from(required);
}

const inFrame = (landmark: PoseLandmark) => landmark.x >= 0 && landmark.x <= 1 && landmark.y >= 0 && landmark.y <= 1;
// Missing visibility is unknown, not a high-confidence landmark.
const visibilityOf = (landmark: PoseLandmark | undefined) => landmark ? (landmark.visibility ?? 0) : 0;

/**
 * Evaluates one normalized MediaPipe pose frame. The perspective check is
 * deliberately conservative and is intended as a setup aid, not a diagnosis.
 */
export function evaluateCalibration(input: {
  protocol: ExerciseProtocol;
  landmarks: PoseLandmarks;
  stableForMs?: number;
  requiredStableMs?: number;
}): CalibrationResult {
  const requiredAnchors = getRequiredCalibrationAnchors(input.protocol);
  const visibleAnchors = requiredAnchors.filter((name) => {
    const point = input.landmarks[name];
    return Boolean(point && inFrame(point) && visibilityOf(point) > MIN_VISIBILITY);
  });
  const missingAnchors = requiredAnchors.filter((name) => !visibleAnchors.includes(name));
  const anchorsVisible = missingAnchors.length === 0;
  const subjectPrefix = input.protocol.primaryJoint[1]?.startsWith("RIGHT_") ? "RIGHT_" : "LEFT_";
  const oppositePrefix = subjectPrefix === "RIGHT_" ? "LEFT_" : "RIGHT_";
  const shoulder = input.landmarks[`${subjectPrefix}SHOULDER`];
  const oppositeShoulder = input.landmarks[`${oppositePrefix}SHOULDER`];
  const hip = input.landmarks[`${subjectPrefix}HIP`];
  const oppositeHip = input.landmarks[`${oppositePrefix}HIP`];
  const shoulderWidth = shoulder && oppositeShoulder ? Math.abs(shoulder.x - oppositeShoulder.x) : 0;
  const hipWidth = hip && oppositeHip ? Math.abs(hip.x - oppositeHip.x) : 0;
  const perspectiveAligned = input.protocol.cameraSetup === "frontal"
    ? shoulderWidth > 0.08 && hipWidth > 0.06
    : Boolean(shoulder && hip && Math.abs(shoulder.x - hip.x) < 0.45);
  const requiredStableMs = input.requiredStableMs ?? 1500;
  const stable = (input.stableForMs ?? 0) >= requiredStableMs;
  const issues: string[] = [];
  if (!anchorsVisible) issues.push(`Move into frame: ${missingAnchors.join(", ")}`);
  if (!perspectiveAligned) issues.push(input.protocol.cameraSetup === "frontal" ? "For best measurement quality, turn more toward the camera." : "For best measurement quality, turn more sideways to the camera.");
  if (!stable) issues.push("Hold still for calibration");
  const confidence = requiredAnchors.length ? requiredAnchors.reduce((sum, name) => sum + visibilityOf(input.landmarks[name]), 0) / requiredAnchors.length : 0;
  // Perspective is advisory: it informs measurement quality but no longer
  // blocks a patient who cannot stand perfectly square to the camera.
  return { isReady: anchorsVisible && stable, anchorsVisible, perspectiveAligned, stable, visibleAnchors, missingAnchors, issues, confidence };
}

export { MIN_VISIBILITY };
