"use client";

import { getProtocolTrackedSide, type ExerciseProtocol } from "../data/protocols";
import { useCallback, useEffect, useRef, useState } from "react";
import { PoseCamera } from "./PoseCamera";
import type { ProtocolSafetyResult } from "../lib/safety";
import { ProtocolExerciseStateMachine } from "../lib/exerciseStateMachine";

export type HUDStatus = "safe" | "caution" | "halt";

interface LiveExerciseHUDProps {
  protocol: ExerciseProtocol;
  angle: number;
  peakRom: number;
  repetitionCount: number;
  targetReps: number;
  currentSet: number;
  targetSets: number;
  status: HUDStatus;
  compensationMessage?: string;
  safetyMessage?: string;
  onAngleChange: (angle: number) => void;
  onSafetyUpdate?: (result: ProtocolSafetyResult) => void;
  onBaselineMeasured?: (angle: number, tolerance: number) => void;
  onCompleteRep: (holdMs?: number) => void;
  onEndSession: () => void;
  onRestartToCalibration: () => void;
  planProgress?: string;
  exerciseInstructions?: string;
  exercisePrescription?: string;
}

export function LiveExerciseHUD({ protocol, angle, peakRom, repetitionCount, targetReps, currentSet, targetSets, status, compensationMessage, safetyMessage, onAngleChange, onSafetyUpdate, onBaselineMeasured, onCompleteRep, onEndSession, onRestartToCalibration, planProgress, exerciseInstructions, exercisePrescription }: LiveExerciseHUDProps) {
  const smoothedAngleRef = useRef<number | null>(null);
  const stateMachineRef = useRef(new ProtocolExerciseStateMachine(protocol));
  const trackedJointNamesRef = useRef<string[]>([...protocol.primaryJoint]);
  const lastTrackedPointsRef = useRef<Record<string, { point: { x: number; y: number; z?: number; visibility?: number }; time: number }>>({});
  const smoothedTrackedPointsRef = useRef<Record<string, { x: number; y: number; z?: number; visibility?: number }>>({});
  const forearmBaselineRef = useRef<number | null>(null);
  const baselineReportedRef = useRef(false);
  const lastAnnouncementRef = useRef<{ key: string; time: number }>({ key: "", time: 0 });
  const [autoRepStatus, setAutoRepStatus] = useState("Move to the prescribed target, then return to the starting position.");
  useEffect(() => { smoothedAngleRef.current = null; }, [protocol.id]);
  useEffect(() => {
    stateMachineRef.current = new ProtocolExerciseStateMachine(protocol);
    trackedJointNamesRef.current = protocol.id === "cat_camel"
      ? Array.from(new Set([...protocol.primaryJoint, "LEFT_EAR", "RIGHT_EAR", "RIGHT_SHOULDER", "RIGHT_HIP"]))
      : [...protocol.primaryJoint];
    lastTrackedPointsRef.current = {};
    smoothedTrackedPointsRef.current = {};
    forearmBaselineRef.current = null;
    baselineReportedRef.current = false;
    setAutoRepStatus("Move to the prescribed target, then return to the starting position.");
  }, [protocol.id]);

  const handleLandmarks = useCallback((landmarks: Record<string, { x: number; y: number; z?: number; visibility?: number } | undefined>) => {
    // These names are locked when the exercise starts. Never select the
    // opposite leg based on which side happens to be more visible.
    const now = performance.now();
    const trackedLandmarks = { ...landmarks };
    trackedJointNamesRef.current.forEach((name) => {
      const point = landmarks[name];
      if (point && (point.visibility ?? 0) >= 0.45) {
        lastTrackedPointsRef.current[name] = { point, time: now };
      } else {
        const cached = lastTrackedPointsRef.current[name];
        if (cached && now - cached.time <= 320) trackedLandmarks[name] = { ...cached.point, visibility: 0.65 };
      }
      const pointToSmooth = trackedLandmarks[name];
      if (pointToSmooth) {
        const previous = smoothedTrackedPointsRef.current[name];
        const smoothing = 0.35;
        const smoothedPoint = previous ? {
          ...pointToSmooth,
          x: previous.x * (1 - smoothing) + pointToSmooth.x * smoothing,
          y: previous.y * (1 - smoothing) + pointToSmooth.y * smoothing,
          z: previous.z === undefined || pointToSmooth.z === undefined ? pointToSmooth.z : previous.z * (1 - smoothing) + pointToSmooth.z * smoothing,
        } : pointToSmooth;
        smoothedTrackedPointsRef.current[name] = smoothedPoint;
        trackedLandmarks[name] = smoothedPoint;
      }
    });
    const points = trackedJointNamesRef.current.map((name) => trackedLandmarks[name]);
    if (points.every((point) => point && (point.visibility ?? 0) >= 0.65)) {
      const [a, b, c] = points as [{ x: number; y: number; z?: number }, { x: number; y: number; z?: number }, { x: number; y: number; z?: number }];
      const rawAngle = protocol.id === "cat_camel"
        ? catCamelDirectedAngle(trackedLandmarks, a, getProtocolTrackedSide(protocol))
        : protocol.angleMeasurement === "forearm_rotation"
          ? forearmRotationFromBaseline(a, b, c, getProtocolTrackedSide(protocol), forearmBaselineRef)
          : angleBetween(a, b, c);
      const nextAngle = rawAngle === null ? null : protocol.angleTransform === "flexion" ? 180 - rawAngle : rawAngle;
      if (nextAngle !== null) {
        const previous = smoothedAngleRef.current;
        const smoothed = previous === null ? nextAngle : previous * 0.7 + nextAngle * 0.3;
        smoothedAngleRef.current = smoothed;
        onAngleChange(Math.round(smoothed));
        const result = stateMachineRef.current.update(trackedLandmarks, smoothed);
        onSafetyUpdate?.(result.safety);
        if (result.safety.shouldHalt) announce("halt", result.safety.reasons[0] || protocol.voicePrompts.safetyHalt);
        else if (result.safety.severity === "caution") announce("caution", result.safety.reasons[0] || protocol.voicePrompts.compensating);
        if (result.state.baselineReady && !baselineReportedRef.current) {
          baselineReportedRef.current = true;
          onBaselineMeasured?.(result.state.measuredStartAngle ?? smoothed, result.state.baselineToleranceDegrees ?? 4);
        }
        if (status !== "halt" && repetitionCount < targetReps && result.completedRep) {
          setAutoRepStatus("Rep counted automatically.");
          if (repetitionCount + 1 >= targetReps) announce("set-complete", currentSet >= targetSets ? "Exercise complete. You finished all prescribed sets." : `Set ${currentSet} complete. Rest, then begin set ${currentSet + 1}.`);
          onCompleteRep(result.state.targetHoldMs || 0);
        } else if (result.state.phase === "START" && !result.state.baselineReady) {
          setAutoRepStatus("Hold your starting position while we measure your baseline.");
        } else if (result.state.phase === "PEAK_HOLD") {
          setAutoRepStatus(result.state.targetHoldMs < 500 ? "Target reached. Hold briefly." : "Target held. Return slowly to start.");
        } else if (result.state.phase === "RETURN") {
          setAutoRepStatus("Return to your starting position.");
        }
      }
    }
  }, [onAngleChange, onCompleteRep, onSafetyUpdate, protocol, repetitionCount, status, targetReps]);

  const speak = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  };
  const announce = (key: string, text: string) => {
    const now = Date.now();
    const previous = lastAnnouncementRef.current;
    if (previous.key === key && now - previous.time < 4000) return;
    lastAnnouncementRef.current = { key, time: now };
    speak(text);
  };
  const completeRepManually = () => {
    if (repetitionCount + 1 >= targetReps) announce("set-complete", currentSet >= targetSets ? "Exercise complete. You finished all prescribed sets." : `Set ${currentSet} complete. Rest, then begin set ${currentSet + 1}.`);
    else speak(protocol.voicePrompts.goodRep);
    onCompleteRep(0);
  };
  const angleLabel = "Current angle";
  const statusLabel = status === "halt" ? "HALT / RELAX" : status === "caution" ? "FORM CORRECTION" : "GOOD FORM";
  const statusClass = status === "halt" ? "border-red-500 bg-red-500/15 text-red-300" : status === "caution" ? "border-amber-400 bg-amber-400/15 text-amber-200" : "border-emerald-400 bg-emerald-400/15 text-emerald-200";

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-white md:p-8">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-400">{planProgress || "Active session"}</p><h1 className="mt-1 text-2xl font-black">{protocol.name}</h1><p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">Tracking {getProtocolTrackedSide(protocol).toLowerCase()} side only</p></div><button onClick={onEndSession} className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200">End session</button></header>
      <section className="mx-auto mt-6 grid max-w-7xl gap-5 lg:grid-cols-[1fr_300px]">
        <div className="relative min-h-[520px] overflow-hidden rounded-3xl border border-teal-100 bg-white shadow-sm"><PoseCamera protocol={protocol} onLandmarks={handleLandmarks} onRestartToCalibration={onRestartToCalibration} /><div className="absolute bottom-6 left-6 rounded-2xl border border-teal-100 bg-white/95 p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{angleLabel}</p><p className="mt-1 text-7xl font-black tabular-nums text-teal-950">{Math.round(angle)}<span className="text-3xl text-slate-400">°</span></p><p className="text-sm text-slate-500">Target {protocol.targetMaxAngle}° · Stop {protocol.safetyHardStopAngle}°</p></div><div className="absolute bottom-6 right-6 rounded-2xl border border-teal-100 bg-white/95 p-5 text-right shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Set {currentSet} of {targetSets}</p><p className="mt-1 text-6xl font-black tabular-nums text-teal-950">{repetitionCount}<span className="text-2xl text-slate-400">/{targetReps}</span></p><p className="text-sm text-slate-500">reps · Peak {Math.round(peakRom)}°</p></div></div>
        <aside className="space-y-4"><div className={`rounded-2xl border p-5 ${statusClass}`} role="status" aria-live="assertive"><p className="text-xs font-black uppercase tracking-wider">{statusLabel}</p><p className="mt-2 text-sm font-semibold">{safetyMessage || compensationMessage || (status === "safe" ? protocol.voicePrompts.goodRep : protocol.voicePrompts.compensating)}</p><button onClick={() => speak(status === "halt" ? protocol.voicePrompts.safetyHalt : status === "caution" ? protocol.voicePrompts.compensating : protocol.voicePrompts.goodRep)} className="mt-4 rounded-lg border border-current px-3 py-2 text-xs font-bold">Repeat audio cue</button></div><div className="rounded-2xl border border-teal-100 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-teal-700">How to do this exercise</p><p className="mt-2 text-sm leading-6 text-slate-700">{exerciseInstructions || protocol.voicePrompts.ready}</p>{exercisePrescription && <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-xs font-bold text-teal-900">{exercisePrescription}</p>}<p className="mt-3 text-xs leading-5 text-slate-500">Keep the required body points visible. Move slowly and stop when the safety message appears.</p></div><div className="rounded-2xl border border-teal-100 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Automatic rep tracking</p><p className="mt-3 text-sm leading-6 text-slate-600" role="status" aria-live="polite">{autoRepStatus}</p><p className="mt-2 text-xs text-slate-500">The app counts a rep after you reach the target and return to the start position.</p><button onClick={completeRepManually} disabled={status === "halt" || repetitionCount >= targetReps} className="mt-5 w-full rounded-lg bg-teal-600 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Manual fallback: complete rep</button></div></aside>
      </section>
    </main>
  );
}

/**
 * Estimates shoulder external rotation from the forearm's orientation in the
 * frontal camera plane. The first stable orientation is the zero reference;
 * outward movement is positive for either anatomical side.
 */
function forearmRotationFromBaseline(
  shoulder: { x: number; y: number },
  elbow: { x: number; y: number },
  wrist: { x: number; y: number },
  trackedSide: "Left" | "Right" | "Bilateral",
  baselineRef: { current: number | null },
) {
  const forearmAngle = (Math.atan2(wrist.x - elbow.x, elbow.y - wrist.y) * 180) / Math.PI;
  if (baselineRef.current === null || !Number.isFinite(baselineRef.current)) {
    baselineRef.current = forearmAngle;
    return 0;
  }
  const signedChange = normalizeSignedDegrees(forearmAngle - baselineRef.current);
  const outwardChange = trackedSide === "Left" ? -signedChange : signedChange;
  // Keep the elbow near the prescribed 90° position. This function measures
  // rotation only; the configured compensation check handles elbow flare.
  const upperArmLength = Math.hypot(shoulder.x - elbow.x, shoulder.y - elbow.y);
  const forearmLength = Math.hypot(wrist.x - elbow.x, wrist.y - elbow.y);
  if (upperArmLength < 0.02 || forearmLength < 0.02) return 0;
  return Math.max(0, Math.min(180, outwardChange));
}

function normalizeSignedDegrees(angle: number) {
  return ((angle + 180) % 360 + 360) % 360 - 180;
}

function angleBetween(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const denominator = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (!denominator) return null;
  const cosine = Math.max(-1, Math.min(1, (ab.x * cb.x + ab.y * cb.y) / denominator));
  return (Math.acos(cosine) * 180) / Math.PI;
}

type CatCamelPoint = { x: number; y: number; visibility?: number };

function midpoint(a: CatCamelPoint, b: CatCamelPoint): CatCamelPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, visibility: Math.min(a.visibility ?? 0, b.visibility ?? 0) };
}

function catCamelDirectedAngle(
  landmarks: Record<string, CatCamelPoint | undefined>,
  selectedShoulder: CatCamelPoint,
  trackedSide: "Left" | "Right" | "Bilateral",
): number | null {
  const leftEar = landmarks.LEFT_EAR;
  const rightEar = landmarks.RIGHT_EAR;
  const selectedHip = trackedSide === "Right" ? landmarks.RIGHT_HIP : landmarks.LEFT_HIP;
  if (!leftEar || !rightEar || !selectedHip) return null;

  const headCenter = midpoint(leftEar, rightEar);
  // The selected shoulder is the camera-visible neck/upper-spine proxy.
  // Use a directed 0..360° angle so Cat and Camel occupy different ranges.
  const first = { x: headCenter.x - selectedShoulder.x, y: headCenter.y - selectedShoulder.y };
  const second = { x: selectedHip.x - selectedShoulder.x, y: selectedHip.y - selectedShoulder.y };
  const cross = first.x * second.y - first.y * second.x;
  const dot = first.x * second.x + first.y * second.y;
  let directed = (Math.atan2(cross, dot) * 180) / Math.PI;
  if (directed < 0) directed += 360;
  // Left/right views reverse the signed image orientation. Keep the
  // anatomical Cat→Camel direction consistent after side selection.
  if (trackedSide === "Left") directed = directed === 0 ? 0 : 360 - directed;
  return directed;
}
