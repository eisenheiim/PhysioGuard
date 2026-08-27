"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProtocolExerciseStateMachine } from "../lib/exerciseStateMachine";
import { ProtocolSelector } from "./ProtocolSelector";
import type { HUDStatus } from "./LiveExerciseHUD";
import { SessionSummary, type SessionRepRecord } from "./SessionSummary";
import { PoseCamera } from "./PoseCamera";
import { CalibrationOverlay } from "./CalibrationOverlay";
import { getClinicalProtocol, getProtocolTrackedSide, protocolSupportsSideSelection, remapProtocolSide, type ExerciseProtocol } from "../data/protocols";
import { evaluateCalibration, type PoseLandmarks } from "../lib/calibration";
import { downloadClinicalReportJson, generateClinicalReport, type SessionData } from "../lib/pdfExport";
import { isSafetyLimitBreached, type ProtocolSafetyResult } from "../lib/safety";
import type { ExtractedRehabDocument } from "../lib/documentExtraction";
import type { AIExercisePlan } from "../lib/aiPlan";

export type RehabWorkflowStep = "PROTOCOL_SELECT" | "CALIBRATION" | "ACTIVE_SESSION" | "SESSION_SUMMARY" | "REPORT_EXPORT";

export function RehabApp({ sourceDocument, aiPlan, onRestartToPaper }: { sourceDocument?: ExtractedRehabDocument; aiPlan?: AIExercisePlan; onRestartToPaper?: () => void }) {
  const suggestedBaseProtocol = aiPlan?.exercises[0]?.protocolId ? getClinicalProtocol(aiPlan.exercises[0].protocolId) : undefined;
  const suggestedSide = suggestedBaseProtocol && protocolSupportsSideSelection(suggestedBaseProtocol) ? (aiPlan?.exercises[0]?.side ?? "Right") : "Left";
  const suggestedProtocol = suggestedBaseProtocol ? remapProtocolSide(suggestedBaseProtocol, suggestedSide) : undefined;
  const [step, setStep] = useState<RehabWorkflowStep>(suggestedProtocol ? "CALIBRATION" : "PROTOCOL_SELECT");
  const [protocol, setProtocol] = useState<ExerciseProtocol | null>(suggestedProtocol || null);
  const [selectedSide, setSelectedSide] = useState<"Left" | "Right">(suggestedSide as "Left" | "Right");
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [calibrationMs, setCalibrationMs] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [angle, setAngle] = useState(42);
  const [startingAngle, setStartingAngle] = useState<number | null>(null);
  const [startingTolerance, setStartingTolerance] = useState(4);
  const [repPeakAngle, setRepPeakAngle] = useState<number | null>(null);
  const [reps, setReps] = useState<SessionRepRecord[]>([]);
  const [safetyViolations, setSafetyViolations] = useState(0);
  const [compensating, setCompensating] = useState(false);
  const [safetyHalt, setSafetyHalt] = useState(false);
  const [safetyReason, setSafetyReason] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [calibrationIssues, setCalibrationIssues] = useState<string[]>([]);
  const lastCalibrationFrameAtRef = useRef<number | null>(null);
  const sessionMetricsRef = useRef({
    frames: 0,
    lowConfidenceFrames: 0,
    confidenceTotal: 0,
    safetyEvents: [] as Array<{ timestamp: string; angle: number; velocityDegreesPerSecond: number; reason: string }>,
    velocitySum: 0,
    velocityCount: 0,
    peakVelocity: 0,
  });

  const [liveLandmarks, setLiveLandmarks] = useState<PoseLandmarks>({});
  const planExercises = aiPlan?.exercises ?? [];
  const currentPlanExercise = planExercises[currentExerciseIndex];
  const nextPlannedExercise = planExercises[currentExerciseIndex + 1];
  // Paper prescription values are the only numeric values used by a session.
  const activeProtocol = protocol ? {
    ...protocol,
    // These values are used only after prescriptionReady is verified below.
    // Never silently substitute catalog ROM/safety values for paper values.
    targetMaxAngle: currentPlanExercise?.targetAngleDegrees ?? 0,
    safetyHardStopAngle: currentPlanExercise?.safetyStopAngleDegrees ?? 0,
  } : null;
  const targetReps = currentPlanExercise?.repetitions ?? 0;
  const targetSets = currentPlanExercise?.sets ?? 0;
  const missingPrescriptionFields = aiPlan
    ? [
      currentPlanExercise?.targetAngleDegrees == null ? "target ROM" : null,
      currentPlanExercise?.safetyStopAngleDegrees == null ? "safety stop angle" : null,
      currentPlanExercise?.sets == null ? "sets" : null,
      currentPlanExercise?.repetitions == null ? "repetitions" : null,
    ].filter((field): field is string => Boolean(field))
    : ["uploaded prescription"];
  const prescriptionReady = missingPrescriptionFields.length === 0;
  const currentSetReps = reps.filter((rep) => rep.setNumber === currentSet).length;
  const exercisePrescription = currentPlanExercise ? `${currentPlanExercise.sets ?? "Not specified"} sets · ${targetReps} reps${currentPlanExercise.holdSeconds ? ` · ${currentPlanExercise.holdSeconds}s hold` : ""}${currentPlanExercise.restSeconds ? ` · ${currentPlanExercise.restSeconds}s rest` : ""}` : undefined;

  useEffect(() => {
    if (step !== "CALIBRATION" || !protocol) return;
    const result = evaluateCalibration({ protocol, landmarks: liveLandmarks, stableForMs: 0 });
    const now = Date.now();
    const deltaMs = lastCalibrationFrameAtRef.current === null ? 0 : Math.min(250, Math.max(0, now - lastCalibrationFrameAtRef.current));
    lastCalibrationFrameAtRef.current = now;
    setCalibrationMs((value) => result.anchorsVisible ? Math.min(1500, value + deltaMs) : 0);
  }, [liveLandmarks, protocol, step]);

  useEffect(() => {
    if (step !== "CALIBRATION" || !protocol) return;
    const result = evaluateCalibration({ protocol, landmarks: liveLandmarks, stableForMs: calibrationMs });
    setCalibrationIssues(result.issues);
    if (result.isReady && countdown === null) setCountdown(3);
  }, [calibrationMs, countdown, liveLandmarks, protocol, step]);

  useEffect(() => {
    if (step !== "CALIBRATION") lastCalibrationFrameAtRef.current = null;
  }, [step]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) { sessionMetricsRef.current = { frames: 0, lowConfidenceFrames: 0, confidenceTotal: 0, safetyEvents: [], velocitySum: 0, velocityCount: 0, peakVelocity: 0 }; setStep("ACTIVE_SESSION"); setStartedAt(Date.now()); setCountdown(null); return; }
    const timer = window.setTimeout(() => setCountdown((value) => value === null ? null : value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const selectProtocol = (selected: ExerciseProtocol) => { const side = protocolSupportsSideSelection(selected) ? "Right" : "Left"; setSelectedSide(side); setCurrentExerciseIndex(0); setCurrentSet(1); setReps([]); setRepPeakAngle(null); setStartingAngle(null); setStartingTolerance(4); setProtocol(remapProtocolSide(selected, side)); setSafetyViolations(0); setSafetyHalt(false); setSafetyReason(null); setStep("CALIBRATION"); setCalibrationMs(0); setCountdown(null); setCalibrationIssues([]); };
  const changeExerciseSide = (side: "Left" | "Right") => { if (!protocol || !protocolSupportsSideSelection(protocol)) return; setSelectedSide(side); setProtocol(remapProtocolSide(protocol, side)); setCalibrationMs(0); setCountdown(null); setCalibrationIssues([]); setLiveLandmarks({}); };
  const startNextPlannedExercise = () => {
    if (!nextPlannedExercise) return;
    const nextProtocol = getClinicalProtocol(nextPlannedExercise.protocolId);
    if (!nextProtocol) return;
    setCurrentExerciseIndex((index) => index + 1); setCurrentSet(1);
    const nextSide = protocolSupportsSideSelection(nextProtocol) ? "Right" : "Left"; sessionMetricsRef.current = { frames: 0, lowConfidenceFrames: 0, confidenceTotal: 0, safetyEvents: [], velocitySum: 0, velocityCount: 0, peakVelocity: 0 }; setSelectedSide(nextSide); setProtocol(remapProtocolSide(nextProtocol, nextSide)); setReps([]); setRepPeakAngle(null); setStartingAngle(null); setStartingTolerance(4); setSafetyViolations(0); setSafetyHalt(false); setSafetyReason(null); setAngle(42); setCalibrationMs(0); setCountdown(null); setCalibrationIssues([]); setLiveLandmarks({}); setStep("CALIBRATION");
  };
  const currentStatus: HUDStatus = safetyHalt ? "halt" : compensating ? "caution" : "safe";
  const completeRep = (holdMs?: number) => {
    if (!activeProtocol || currentStatus === "halt") return;
    const nextNumber = currentSetReps + 1;
    const holdSeconds = typeof holdMs === "number" ? Math.max(0, Math.round(holdMs) / 1000) : undefined;
    const holdTarget = currentPlanExercise?.holdSeconds;
    const holdMet = holdTarget == null ? (holdSeconds ? holdSeconds >= 0.5 : undefined) : (holdSeconds ?? 0) >= holdTarget;
    setReps((items) => [...items, { setNumber: currentSet, repNumber: nextNumber, peakAngle: repPeakAngle ?? angle, startingAngle: startingAngle ?? undefined, compensated: compensating, compensationType: compensating ? activeProtocol.compensationChecks[0]?.type || "form-compensation" : "", safeThresholdHeld: !isSafetyLimitBreached(activeProtocol, angle), holdSeconds, holdMet }]);
    setCompensating(false);
    setRepPeakAngle(null);
    if (nextNumber >= targetReps) {
      if (currentSet >= targetSets) setStep("SESSION_SUMMARY");
      else { setCurrentSet((value) => value + 1); setSafetyHalt(false); setSafetyReason(null); setAngle(activeProtocol.baselineAngle); setRepPeakAngle(null); }
    }
  };
  const handleSafetyUpdate = (result: ProtocolSafetyResult) => {
    const metrics = sessionMetricsRef.current;
    metrics.frames += 1;
    metrics.confidenceTotal += result.averageConfidence;
    if (result.averageConfidence < 0.65) metrics.lowConfidenceFrames += 1;
    if (Number.isFinite(result.velocityDegPerSecond)) {
      metrics.velocitySum += Math.abs(result.velocityDegPerSecond);
      metrics.velocityCount += 1;
      if (Math.abs(result.velocityDegPerSecond) > metrics.peakVelocity) metrics.peakVelocity = Math.abs(result.velocityDegPerSecond);
    }
    setCompensating(result.severity === "caution");
    if (result.reasons.length) setSafetyReason(result.reasons[0]);
    if (result.shouldHalt) {
      const reason = result.reasons[0] || "Safety guardrail triggered";
      if (!metrics.safetyEvents.some((event) => event.angle === result.angle && event.reason === reason)) metrics.safetyEvents.push({ timestamp: new Date().toISOString(), angle: result.angle, velocityDegreesPerSecond: result.velocityDegPerSecond, reason });
      setSafetyHalt((wasHalted) => { if (!wasHalted) setSafetyViolations((count) => count + 1); return true; });
    } else {
      // Once the user is back inside the safe range, allow the state machine
      // to report the completed rep when it reaches the starting angle.
      setSafetyHalt(false);
      if (result.severity === "safe") setSafetyReason(null);
    }
  };
  const endSession = () => setStep("SESSION_SUMMARY");
  const buildReportData = (): SessionData | null => {
    if (!activeProtocol) return null;
    const compensationCounts = reps.reduce<Record<string, number>>((counts, rep) => {
      if (rep.compensated) { const type = rep.compensationType || "Form compensation"; counts[type] = (counts[type] || 0) + 1; }
      return counts;
    }, {});
    const laterality: SessionData["laterality"] = activeProtocol.primaryJoint[0]?.startsWith("RIGHT") ? "Right" : activeProtocol.primaryJoint[0]?.startsWith("LEFT") ? "Left" : "Not specified";
    const averageConfidence = sessionMetricsRef.current.frames ? sessionMetricsRef.current.confidenceTotal / sessionMetricsRef.current.frames : undefined;
    const avgVelocity = sessionMetricsRef.current.velocityCount ? sessionMetricsRef.current.velocitySum / sessionMetricsRef.current.velocityCount : undefined;
    return {
      patientName: "Demo Patient",
      patientId: "DEMO-001",
      protocolName: activeProtocol.name,
      category: activeProtocol.category,
      laterality,
      cameraSetup: activeProtocol.cameraSetup,
      clinicalSource: aiPlan?.clinicalSource || activeProtocol.clinicalSource,
      sourceDocumentName: sourceDocument?.fileName,
      sourceDocumentExtractedAt: sourceDocument?.extractedAt,
      aiExtractionReviewed: aiPlan ? aiPlan.clinicianConfirmed === true : undefined,
      aiReviewNotes: aiPlan?.reviewNotes,
      date: new Date().toLocaleString(),
      prescribedTargetRom: activeProtocol.targetMaxAngle,
      prescribedHoldSeconds: currentPlanExercise?.holdSeconds ?? undefined,
      startingAngle: startingAngle ?? undefined,
      startingToleranceDegrees: startingAngle === null ? undefined : startingTolerance,
      safetyHardStopAngle: activeProtocol.safetyHardStopAngle,
      achievedPeakRom: Math.max(0, ...reps.map((rep) => rep.peakAngle)),
      totalReps: reps.length,
      cleanReps: reps.filter((rep) => !rep.compensated).length,
      compensatedReps: reps.filter((rep) => rep.compensated).length,
      safetyViolations,
      measurementQuality: sessionMetricsRef.current.frames === 0 ? "Incomplete" : sessionMetricsRef.current.lowConfidenceFrames / sessionMetricsRef.current.frames > 0.25 ? "Limited" : "Good",
      incompleteFrames: sessionMetricsRef.current.lowConfidenceFrames,
      durationSeconds: startedAt ? (Date.now() - startedAt) / 1000 : undefined,
      compensationSummary: Object.entries(compensationCounts).map(([type, count]) => ({ type, count })),
      safetyEvents: sessionMetricsRef.current.safetyEvents,
      averageConfidence,
      avgVelocityDegPerSecond: avgVelocity,
      peakVelocityDegPerSecond: sessionMetricsRef.current.peakVelocity || undefined,
      repsDetail: reps,
    };
  };
  const exportReport = () => { const reportData = buildReportData(); if (!reportData) return; setStep("REPORT_EXPORT"); generateClinicalReport(reportData); };
  const exportReportJson = () => { const reportData = buildReportData(); if (reportData) downloadClinicalReportJson(reportData); };
  const restart = () => { setStep("PROTOCOL_SELECT"); setCurrentExerciseIndex(0); setCurrentSet(1); setProtocol(null); setSelectedSide("Left"); setReps([]); setRepPeakAngle(null); setStartingAngle(null); setStartingTolerance(4); setSafetyViolations(0); setSafetyHalt(false); setSafetyReason(null); setAngle(42); setStartedAt(null); setCalibrationMs(0); setCountdown(null); setCalibrationIssues([]); setLiveLandmarks({}); };
  const returnToCalibration = () => { setStep("CALIBRATION"); setCalibrationMs(0); setCountdown(null); setCalibrationIssues([]); setLiveLandmarks({}); setSafetyHalt(false); setSafetyReason(null); setCompensating(false); setAngle(42); setRepPeakAngle(null); setStartingAngle(null); };

  if (!aiPlan) return <PrescriptionRequiredView fields={["uploaded prescription"]} onRestartToPaper={onRestartToPaper} />;
  if (step === "PROTOCOL_SELECT") return <ProtocolSelector onReady={selectProtocol} />;
  if (!protocol) return null;
  if (!prescriptionReady) return <PrescriptionRequiredView fields={missingPrescriptionFields} sourceDocumentName={sourceDocument?.fileName} onRestartToPaper={onRestartToPaper} />;
  if ((step === "CALIBRATION" || step === "ACTIVE_SESSION") && protocol) return <PersistentExerciseView mode={step === "CALIBRATION" ? "calibration" : "active"} protocol={protocol} activeProtocol={activeProtocol} selectedSide={selectedSide} canChooseSide={protocolSupportsSideSelection(protocol)} onSideChange={changeExerciseSide} onBack={restart} calibrationMs={calibrationMs} countdown={countdown} issues={calibrationIssues} landmarks={liveLandmarks} onLandmarks={setLiveLandmarks} angle={angle} peakRom={Math.max(angle, repPeakAngle ?? angle, ...reps.map((rep) => rep.peakAngle), 0)} repetitionCount={currentSetReps} targetReps={targetReps} currentSet={currentSet} targetSets={targetSets} status={currentStatus} planProgress={planExercises.length ? `Exercise ${currentExerciseIndex + 1} of ${planExercises.length}${step === "ACTIVE_SESSION" ? ` · Set ${currentSet} of ${targetSets}` : ""}` : undefined} exerciseInstructions={currentPlanExercise?.instructions} exercisePrescription={exercisePrescription} compensationMessage={compensating ? safetyReason || activeProtocol?.compensationChecks[0]?.correctionPrompt : undefined} safetyMessage={safetyHalt ? safetyReason || activeProtocol?.voicePrompts.safetyHalt : undefined} onAngleChange={(value) => { if (!activeProtocol) return; setAngle(value); setRepPeakAngle((previous) => previous === null ? value : activeProtocol.targetMaxAngle < activeProtocol.baselineAngle ? Math.min(previous, value) : Math.max(previous, value)); }} onSafetyUpdate={handleSafetyUpdate} onBaselineMeasured={(value, tolerance) => { setStartingAngle(value); setStartingTolerance(tolerance); }} onCompleteRep={completeRep} onEndSession={endSession} onRestartToCalibration={returnToCalibration} />;
  if ((step === "SESSION_SUMMARY" || step === "REPORT_EXPORT") && activeProtocol) { const reportData = buildReportData(); if (!reportData) return null; return <SessionSummary protocol={activeProtocol} reps={reps} safetyViolations={safetyViolations} reportData={reportData} planProgress={planExercises.length ? `Exercise ${currentExerciseIndex + 1} of ${planExercises.length}` : undefined} nextExerciseName={nextPlannedExercise ? getClinicalProtocol(nextPlannedExercise.protocolId)?.name : undefined} onNextExercise={nextPlannedExercise ? startNextPlannedExercise : undefined} onExport={exportReport} onExportJson={exportReportJson} onRestart={restart} />; }
  return null;
}

function PersistentExerciseView({ mode, protocol, activeProtocol, selectedSide, canChooseSide, onSideChange, onBack, calibrationMs, countdown, issues, landmarks, onLandmarks, angle, peakRom, repetitionCount, targetReps, currentSet, targetSets, status, planProgress, exerciseInstructions, exercisePrescription, compensationMessage, safetyMessage, onAngleChange, onSafetyUpdate, onBaselineMeasured, onCompleteRep, onEndSession, onRestartToCalibration }: {
  mode: "calibration" | "active";
  protocol: ExerciseProtocol;
  activeProtocol: ExerciseProtocol | null;
  selectedSide: "Left" | "Right";
  canChooseSide: boolean;
  onSideChange: (side: "Left" | "Right") => void;
  onBack: () => void;
  calibrationMs: number;
  countdown: number | null;
  issues: string[];
  landmarks: PoseLandmarks;
  onLandmarks: (landmarks: PoseLandmarks) => void;
  angle: number;
  peakRom: number;
  repetitionCount: number;
  targetReps: number;
  currentSet: number;
  targetSets: number;
  status: HUDStatus;
  planProgress?: string;
  exerciseInstructions?: string;
  exercisePrescription?: string;
  compensationMessage?: string;
  safetyMessage?: string;
  onAngleChange: (value: number) => void;
  onSafetyUpdate: (result: ProtocolSafetyResult) => void;
  onBaselineMeasured: (value: number, tolerance: number) => void;
  onCompleteRep: (holdMs?: number) => void;
  onEndSession: () => void;
  onRestartToCalibration: () => void;
}) {
  const smoothedAngleRef = useRef<number | null>(null);
  const stateMachineRef = useRef(new ProtocolExerciseStateMachine(activeProtocol || protocol));
  const trackedJointNamesRef = useRef<string[]>([...protocol.primaryJoint]);
  const lastTrackedPointsRef = useRef<Record<string, { point: { x: number; y: number; z?: number; visibility?: number }; time: number }>>({});
  const smoothedTrackedPointsRef = useRef<Record<string, { x: number; y: number; z?: number; visibility?: number }>>({});
  const worldLandmarksRef = useRef<PoseLandmarks>({});
  const forearmBaselineVectorRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const forearmElbowBaselineRef = useRef<number | null>(null);
  const cervicalBaselineOffsetRef = useRef<number | null>(null);
  const lastAnnouncementRef = useRef<{ key: string; time: number }>({ key: "", time: 0 });
  const [autoRepStatus, setAutoRepStatus] = useState("Reach the target, then return to your starting position.");
  const [trackingReady, setTrackingReady] = useState(false);
  useEffect(() => {
    stateMachineRef.current = new ProtocolExerciseStateMachine(activeProtocol || protocol);
    trackedJointNamesRef.current = protocol.id === "cat_camel"
      ? Array.from(new Set([...protocol.primaryJoint, "LEFT_EAR", "RIGHT_EAR", "RIGHT_SHOULDER", "RIGHT_HIP"]))
      : protocol.id === "bird_dog"
        ? ["LEFT_WRIST", "LEFT_SHOULDER", "RIGHT_ANKLE", "RIGHT_WRIST", "RIGHT_SHOULDER", "LEFT_ANKLE"]
        : protocol.id === "glute_bridge"
          ? ["LEFT_SHOULDER", "LEFT_HIP", "LEFT_KNEE", "RIGHT_SHOULDER", "RIGHT_HIP", "RIGHT_KNEE"]
          : [...protocol.primaryJoint];
    smoothedAngleRef.current = null;
    lastTrackedPointsRef.current = {};
    smoothedTrackedPointsRef.current = {};
    worldLandmarksRef.current = {};
    forearmBaselineVectorRef.current = null;
    forearmElbowBaselineRef.current = null;
    cervicalBaselineOffsetRef.current = null;
    lastAnnouncementRef.current = { key: "", time: 0 };
    setAutoRepStatus("Reach the target, then return to your starting position.");
    setTrackingReady(false);
  }, [activeProtocol?.safetyHardStopAngle, activeProtocol?.targetMaxAngle, protocol.id]);
  const speak = useCallback((text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  }, []);
  const announce = useCallback((key: string, text: string) => {
    const now = Date.now();
    if (lastAnnouncementRef.current.key === key && now - lastAnnouncementRef.current.time < 4000) return;
    lastAnnouncementRef.current = { key, time: now };
    speak(text);
  }, [speak]);
  const handleTrackingLandmarks = useCallback((landmarks: PoseLandmarks) => {
    if (mode === "calibration" || !activeProtocol) {
      onLandmarks(landmarks);
      return;
    }
    const now = performance.now();
    const trackedLandmarks = { ...landmarks };
    trackedJointNamesRef.current.forEach((name) => {
      const point = landmarks[name];
      if (point && (point.visibility ?? 0) >= 0.45) lastTrackedPointsRef.current[name] = { point, time: now };
      else {
        const cached = lastTrackedPointsRef.current[name];
        if (cached && now - cached.time <= 320) trackedLandmarks[name] = { ...cached.point, visibility: 0.65 };
      }
      const pointToSmooth = trackedLandmarks[name];
      if (pointToSmooth) {
        const previous = smoothedTrackedPointsRef.current[name];
        const smoothing = activeProtocol.angleMeasurement === "forearm_rotation" ? 0.75 : 0.35;
        const smoothedPoint = previous ? { ...pointToSmooth, x: previous.x * (1 - smoothing) + pointToSmooth.x * smoothing, y: previous.y * (1 - smoothing) + pointToSmooth.y * smoothing, z: previous.z === undefined || pointToSmooth.z === undefined ? pointToSmooth.z : previous.z * (1 - smoothing) + pointToSmooth.z * smoothing } : pointToSmooth;
        smoothedTrackedPointsRef.current[name] = smoothedPoint;
        trackedLandmarks[name] = smoothedPoint;
      }
    });
    const points = trackedJointNamesRef.current.map((name) => trackedLandmarks[name]);
    const pointsReady = points.every((point) => point && (point.visibility ?? 0) >= 0.65);
    setTrackingReady((previous) => previous === pointsReady ? previous : pointsReady);
    if (!pointsReady) {
      setAutoRepStatus("Keep the required body points visible to continue measuring.");
      return;
    }
    const [a, b, c] = points as [{ x: number; y: number; z?: number }, { x: number; y: number; z?: number }, { x: number; y: number; z?: number }];
    const worldPoints = activeProtocol.angleMeasurement === "forearm_rotation" || activeProtocol.angleMeasurement === "bird_dog_alignment" || activeProtocol.angleMeasurement === "bilateral_bridge"
      ? activeProtocol.primaryJoint.map((name) => worldLandmarksRef.current[name])
      : [];
    const rawAngle = activeProtocol.id === "cat_camel"
      ? catCamelDirectedAngle(trackedLandmarks, a, getProtocolTrackedSide(activeProtocol))
      : activeProtocol.id === "bird_dog"
        ? birdDogAngle3D(worldLandmarksRef.current)
        : activeProtocol.angleMeasurement === "bilateral_bridge"
          ? bilateralBridgeAngle3D(worldLandmarksRef.current)
          : activeProtocol.angleMeasurement === "forearm_rotation"
            ? worldPoints.every((point) => point && Number.isFinite(point.z) && (point.visibility ?? 0) >= 0.65)
              ? forearmRotation3DFromBaseline(worldPoints[0]!, worldPoints[1]!, worldPoints[2]!, getProtocolTrackedSide(activeProtocol), forearmBaselineVectorRef, forearmElbowBaselineRef)
              : null
            : activeProtocol.angleMeasurement === "bird_dog_alignment"
              ? worldPoints.every((point) => point && Number.isFinite(point.z) && (point.visibility ?? 0) >= 0.65)
                ? angle3D(worldPoints[0]!, worldPoints[1]!, worldPoints[2]!)
                : null
              : activeProtocol.angleMeasurement === "cervical_retraction"
                ? cervicalRetractionAngle(a, b, c, activeProtocol.baselineAngle, cervicalBaselineOffsetRef)
                : angleBetween(a, b, c);
    const nextAngle = rawAngle === null ? null : activeProtocol.angleTransform === "flexion" ? 180 - rawAngle : rawAngle;
    if (nextAngle === null) {
      if (activeProtocol.angleMeasurement === "forearm_rotation") setAutoRepStatus("Keep your elbow near its calibrated 90° position, then rotate only your forearm.");
      return;
    }
    const previous = smoothedAngleRef.current;
    const angleSmoothing = activeProtocol.angleMeasurement === "forearm_rotation" ? 0.65 : 0.3;
    const smoothed = previous === null ? nextAngle : previous * (1 - angleSmoothing) + nextAngle * angleSmoothing;
    smoothedAngleRef.current = smoothed;
    onAngleChange(Math.round(smoothed));
    const result = stateMachineRef.current.update(trackedLandmarks, smoothed);
    onSafetyUpdate(result.safety);
    if (result.safety.shouldHalt) announce("halt", result.safety.reasons[0] || activeProtocol.voicePrompts.safetyHalt);
    else if (result.safety.severity === "caution") announce("caution", result.safety.reasons[0] || activeProtocol.voicePrompts.compensating);
    if (result.state.baselineReady && result.state.measuredStartAngle !== null) onBaselineMeasured(result.state.measuredStartAngle, result.state.baselineToleranceDegrees ?? 4);
    if (status !== "halt" && repetitionCount < targetReps && result.completedRep) {
      setAutoRepStatus("Rep counted. Return to the starting position for the next rep.");
      announce("rep", activeProtocol.voicePrompts.goodRep);
      if (repetitionCount + 1 >= targetReps) announce("set-complete", currentSet >= targetSets ? "Exercise complete. You finished all prescribed sets." : `Set ${currentSet} complete. Rest, then begin set ${currentSet + 1}.`);
      onCompleteRep(result.state.targetHoldMs || 0);
    } else if (result.state.phase === "START" && !result.state.baselineReady) setAutoRepStatus("Hold your starting position while we measure your baseline.");
    else if (result.state.phase === "PEAK_HOLD") setAutoRepStatus("Target reached. Hold briefly, then return slowly.");
    else if (result.state.phase === "RETURN") setAutoRepStatus("Return to your starting position.");
  }, [activeProtocol, announce, currentSet, mode, onAngleChange, onBaselineMeasured, onCompleteRep, onLandmarks, onSafetyUpdate, protocol, repetitionCount, status, targetReps, targetSets]);
  const completeRepManually = () => {
    if (status === "halt" || repetitionCount >= targetReps) return;
    announce("manual-rep", activeProtocol?.voicePrompts.goodRep || "Rep recorded.");
    onCompleteRep(0);
  };
  const calibration = evaluateCalibration({ protocol, landmarks, stableForMs: calibrationMs });
  const trackingProtocol = activeProtocol || protocol;
  const statusLabel = status === "halt" ? "HALT / RELAX" : status === "caution" ? "FORM CORRECTION" : "GOOD FORM";
  const statusClass = status === "halt" ? "border-red-300 bg-red-50 text-red-800" : status === "caution" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-emerald-300 bg-emerald-50 text-emerald-800";
  const handleWorldLandmarks = useCallback((landmarks: PoseLandmarks) => { worldLandmarksRef.current = landmarks; }, []);
  return <main className="min-h-screen bg-slate-50 p-5 text-slate-900 md:p-8">
    <header className="mx-auto flex max-w-7xl items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">{planProgress || (mode === "calibration" ? "Step 2 · Live calibration" : "Active session")}</p><h1 className="mt-1 text-2xl font-black text-teal-950">{mode === "calibration" ? "Set up your camera" : trackingProtocol.name}</h1>{mode === "active" && <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">{getProtocolTrackedSide(trackingProtocol) === "Bilateral" ? "Tracking both sides" : `Tracking ${getProtocolTrackedSide(trackingProtocol).toLowerCase()} side`}</p>}</div>{mode === "active" ? <button onClick={onEndSession} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">End session</button> : <button onClick={onBack} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">← Back</button>}</header>
    {mode === "calibration" && <p className="mx-auto mt-3 max-w-7xl text-slate-600">{protocol.voicePrompts.ready}</p>}
    {mode === "calibration" && canChooseSide && <div className="mx-auto mt-4 max-w-md rounded-xl border border-teal-100 bg-white px-3 py-2 shadow-sm"><div className="flex items-center justify-between gap-3"><p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">Working side</p><div className="flex gap-2"><button type="button" onClick={() => onSideChange("Left")} aria-pressed={selectedSide === "Left"} className={`rounded-md px-3 py-1.5 text-xs font-bold ${selectedSide === "Left" ? "bg-teal-700 text-white" : "border border-slate-300 text-slate-700"}`}>Left</button><button type="button" onClick={() => onSideChange("Right")} aria-pressed={selectedSide === "Right"} className={`rounded-md px-3 py-1.5 text-xs font-bold ${selectedSide === "Right" ? "bg-teal-700 text-white" : "border border-slate-300 text-slate-700"}`}>Right</button></div></div></div>}
    <section className={`mx-auto mt-6 gap-6 ${mode === "calibration" ? "grid max-w-7xl items-center lg:grid-cols-[minmax(0,1fr)_320px]" : "grid max-w-7xl lg:grid-cols-[1fr_300px]"}`}><div className={`relative min-h-[520px] w-full overflow-hidden rounded-3xl border border-teal-100 bg-white shadow-sm ${mode === "calibration" ? "min-h-[600px]" : ""}`}><PoseCamera protocol={trackingProtocol} onLandmarks={handleTrackingLandmarks} onWorldLandmarks={handleWorldLandmarks} onRestartToCalibration={onRestartToCalibration} />{mode === "calibration" && <CalibrationOverlay progressPercent={(calibrationMs / 1500) * 100} message={countdown === null ? "Hold steady" : countdown === 0 ? "Ready" : `Starting in ${countdown}`} issues={issues} />}<div className="absolute bottom-6 left-6 rounded-2xl border border-teal-100 bg-white/95 p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{mode === "calibration" ? "Calibration" : "Current angle"}</p><p className="mt-1 text-7xl font-black tabular-nums text-teal-950">{mode === "calibration" ? `${Math.round((calibrationMs / 1500) * 100)}%` : <>{Math.round(angle)}<span className="text-3xl text-slate-400">°</span></>}</p>{mode === "active" && <p className="text-sm text-slate-500">Target {trackingProtocol.targetMaxAngle}° · Stop {trackingProtocol.safetyHardStopAngle}°</p>}</div>{mode === "active" && <div className="absolute bottom-6 right-6 rounded-2xl border border-teal-100 bg-white/95 p-5 text-right shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Set {currentSet} of {targetSets}</p><p className="mt-1 text-6xl font-black tabular-nums text-teal-950">{repetitionCount}<span className="text-2xl text-slate-400">/{targetReps}</span></p><p className="text-sm text-slate-500">reps · Peak {Math.round(peakRom)}°</p></div>}</div>
      <aside className="space-y-4">{mode === "calibration" ? <><div className="rounded-2xl border border-teal-100 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Calibration status</p><p className="mt-3 text-2xl font-black text-teal-900">{countdown === null ? "Hold steady" : countdown === 0 ? "Ready" : `Starting in ${countdown}`}</p><div className="mt-4 grid gap-2 text-sm"><CalibrationCheck label="Body anchors in frame" good={calibration.anchorsVisible} /><CalibrationCheck label="Perspective advisory" good={calibration.perspectiveAligned} /><CalibrationCheck label="Stable 1.5 seconds" good={calibrationMs >= 1500} /></div>{issues.length > 0 && <p className="mt-4 text-sm text-amber-700">{issues[0]}</p>}</div></> : <><div className={`rounded-2xl border p-5 ${statusClass}`} role="status" aria-live="assertive"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-wider">{statusLabel}</p><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${trackingReady ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{trackingReady ? "Measuring" : "Waiting for points"}</span></div><p className="mt-2 text-sm font-semibold">{safetyMessage || compensationMessage || (trackingReady ? trackingProtocol.voicePrompts.goodRep : "Keep the required body points visible.")}</p><div className="mt-4 flex gap-2"><button type="button" onClick={() => speak(status === "halt" ? trackingProtocol.voicePrompts.safetyHalt : status === "caution" ? trackingProtocol.voicePrompts.compensating : trackingProtocol.voicePrompts.goodRep)} className="rounded-lg border border-current px-3 py-2 text-xs font-bold">Repeat audio cue</button><button type="button" onClick={() => { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); }} className="rounded-lg border border-current px-3 py-2 text-xs font-bold">Pause voice</button></div></div><div className="rounded-2xl border border-teal-100 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-teal-700">How to do this exercise</p><p className="mt-2 text-sm leading-6 text-slate-700">{exerciseInstructions || trackingProtocol.voicePrompts.ready}</p>{exercisePrescription && <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-xs font-bold text-teal-900">{exercisePrescription}</p>}<p className="mt-3 text-xs leading-5 text-slate-500">{autoRepStatus}</p><button type="button" onClick={completeRepManually} disabled={!trackingReady || status === "halt" || repetitionCount >= targetReps} className="mt-4 w-full rounded-lg bg-teal-700 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Manual fallback: complete rep</button></div></>}</aside>
    </section>
  </main>;
}

function angleBetween(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) {
  const ab = { x: a.x - b.x, y: a.y - b.y }; const cb = { x: c.x - b.x, y: c.y - b.y }; const denominator = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (!denominator) return null;
  const cosine = Math.max(-1, Math.min(1, (ab.x * cb.x + ab.y * cb.y) / denominator));
  return (Math.acos(cosine) * 180) / Math.PI;
}

function forearmRotation3DFromBaseline(
  shoulder: { x: number; y: number; z?: number },
  elbow: { x: number; y: number; z?: number },
  wrist: { x: number; y: number; z?: number },
  trackedSide: "Left" | "Right" | "Bilateral",
  baselineRef: { current: { x: number; y: number; z: number } | null },
  elbowBaselineRef: { current: number | null },
) {
  if (shoulder.z === undefined || elbow.z === undefined || wrist.z === undefined) return null;
  const upperArm = normalize3D({ x: elbow.x - shoulder.x, y: elbow.y - shoulder.y, z: elbow.z - shoulder.z });
  if (!upperArm) return null;
  const forearm = { x: wrist.x - elbow.x, y: wrist.y - elbow.y, z: wrist.z - elbow.z };
  const projected = normalize3D(projectPerpendicular(forearm, upperArm));
  if (!projected) return null;
  const elbowAngle = angle3D(shoulder, elbow, wrist);
  if (!Number.isFinite(elbowAngle)) return null;
  if (elbowBaselineRef.current === null) elbowBaselineRef.current = elbowAngle;
  // External rotation should not be credited when the patient changes the
  // prescribed elbow bend. The tolerance absorbs normal pose-model jitter.
  if (Math.abs(elbowAngle - elbowBaselineRef.current) > 12) return null;
  if (baselineRef.current === null) {
    baselineRef.current = projected;
    return 0;
  }

  const baseline = baselineRef.current;
  const cross = cross3D(baseline, projected);
  const signedChange = (Math.atan2(dot3D(upperArm, cross), dot3D(baseline, projected)) * 180) / Math.PI;
  const outwardChange = trackedSide === "Left" ? -signedChange : signedChange;
  return Math.max(0, Math.min(180, outwardChange));
}

function angle3D(a: { x: number; y: number; z?: number }, b: { x: number; y: number; z?: number }, c: { x: number; y: number; z?: number }) {
  if (a.z === undefined || b.z === undefined || c.z === undefined) return NaN;
  const first = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const second = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const denominator = Math.hypot(first.x, first.y, first.z) * Math.hypot(second.x, second.y, second.z);
  if (!denominator) return NaN;
  const cosine = Math.max(-1, Math.min(1, dot3D(first, second) / denominator));
  return (Math.acos(cosine) * 180) / Math.PI;
}

function birdDogAngle3D(landmarks: PoseLandmarks) {
  const diagonals = [
    [landmarks.LEFT_WRIST, landmarks.LEFT_SHOULDER, landmarks.RIGHT_ANKLE],
    [landmarks.RIGHT_WRIST, landmarks.RIGHT_SHOULDER, landmarks.LEFT_ANKLE],
  ];
  const angles = diagonals
    .filter((points) => points.every((point) => point && point.z !== undefined && (point.visibility ?? 0) >= 0.65))
    .map((points) => angle3D(points[0]!, points[1]!, points[2]!))
    .filter((value) => Number.isFinite(value));
  return angles.length ? Math.max(...angles) : null;
}

function bilateralBridgeAngle3D(landmarks: PoseLandmarks) {
  const midpoint = (left: { x: number; y: number; z?: number }, right: { x: number; y: number; z?: number }) => ({
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
    z: ((left.z ?? 0) + (right.z ?? 0)) / 2,
  });
  const points = [landmarks.LEFT_SHOULDER, landmarks.RIGHT_SHOULDER, landmarks.LEFT_HIP, landmarks.RIGHT_HIP, landmarks.LEFT_KNEE, landmarks.RIGHT_KNEE];
  if (points.some((point) => !point || point.z === undefined || (point.visibility ?? 0) < 0.65)) return null;
  const shoulder = midpoint(points[0]!, points[1]!);
  const hip = midpoint(points[2]!, points[3]!);
  const knee = midpoint(points[4]!, points[5]!);
  return angle3D(shoulder, hip, knee);
}

function cervicalRetractionAngle(
  nose: { x: number; y: number },
  ear: { x: number; y: number },
  shoulder: { x: number; y: number },
  baselineAngle: number,
  baselineOffsetRef: { current: number | null },
) {
  const horizontalOffset = Math.abs(ear.x - shoulder.x);
  const neckVerticalLength = Math.abs(ear.y - shoulder.y);
  if (neckVerticalLength < 0.02) return null;
  if (baselineOffsetRef.current === null) baselineOffsetRef.current = horizontalOffset;

  // Chin tuck is a backward translation, not a neck bend. Convert the
  // reduction in ear-to-shoulder horizontal offset into a conservative angle
  // relative to the patient's calibrated neutral position.
  const horizontalRetraction = Math.max(0, baselineOffsetRef.current - horizontalOffset);
  const retractionDegrees = (Math.atan2(horizontalRetraction, neckVerticalLength) * 180) / Math.PI;
  void nose; // Nose remains a required landmark for gaze-down compensation checks.
  return Math.max(0, baselineAngle - retractionDegrees);
}

function normalize3D(vector: { x: number; y: number; z: number }) {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  return length < 0.0001 ? null : { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function projectPerpendicular(vector: { x: number; y: number; z: number }, axis: { x: number; y: number; z: number }) {
  const projection = dot3D(vector, axis);
  return { x: vector.x - projection * axis.x, y: vector.y - projection * axis.y, z: vector.z - projection * axis.z };
}

function dot3D(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross3D(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function catCamelDirectedAngle(landmarks: PoseLandmarks, selectedShoulder: { x: number; y: number }, trackedSide: "Left" | "Right" | "Bilateral") {
  const leftEar = landmarks.LEFT_EAR; const rightEar = landmarks.RIGHT_EAR; const selectedHip = trackedSide === "Right" ? landmarks.RIGHT_HIP : landmarks.LEFT_HIP;
  if (!leftEar || !rightEar || !selectedHip) return null;
  const headCenter = { x: (leftEar.x + rightEar.x) / 2, y: (leftEar.y + rightEar.y) / 2 };
  const first = { x: headCenter.x - selectedShoulder.x, y: headCenter.y - selectedShoulder.y }; const second = { x: selectedHip.x - selectedShoulder.x, y: selectedHip.y - selectedShoulder.y };
  const cross = first.x * second.y - first.y * second.x; const dot = first.x * second.x + first.y * second.y; let directed = (Math.atan2(cross, dot) * 180) / Math.PI;
  if (directed < 0) directed += 360;
  if (trackedSide === "Left") directed = directed === 0 ? 0 : 360 - directed;
  return directed;
}

function CalibrationView({ protocol, selectedSide, canChooseSide, onSideChange, onBack, calibrationMs, countdown, issues, landmarks, onLandmarks, planProgress }: { protocol: ExerciseProtocol; selectedSide: "Left" | "Right"; canChooseSide: boolean; onSideChange: (side: "Left" | "Right") => void; onBack: () => void; calibrationMs: number; countdown: number | null; issues: string[]; landmarks: PoseLandmarks; onLandmarks: (landmarks: PoseLandmarks) => void; planProgress?: string }) {
  const calibration = evaluateCalibration({ protocol, landmarks, stableForMs: calibrationMs });
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-900"><section className="w-full max-w-4xl"><button type="button" onClick={onBack} className="mb-6 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:border-teal-500 hover:text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500">← Back to exercise selection</button><p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Step 2 · Live calibration</p><h1 className="mt-3 text-4xl font-black tracking-tight text-teal-950">Set up your camera</h1><p className="mt-3 text-slate-600">{protocol.voicePrompts.ready}</p>{canChooseSide && <div className="mt-5 rounded-2xl border border-teal-100 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-teal-700">Working side</p><div className="mt-3 flex gap-3"><button type="button" onClick={() => onSideChange("Left")} aria-pressed={selectedSide === "Left"} className={`rounded-lg px-5 py-3 font-bold ${selectedSide === "Left" ? "bg-teal-700 text-white" : "border border-slate-300 text-slate-700"}`}>Left</button><button type="button" onClick={() => onSideChange("Right")} aria-pressed={selectedSide === "Right"} className={`rounded-lg px-5 py-3 font-bold ${selectedSide === "Right" ? "bg-teal-700 text-white" : "border border-slate-300 text-slate-700"}`}>Right</button></div></div>}<div className="mt-8 rounded-3xl border border-teal-100 bg-white p-5 shadow-sm"><div className="relative h-[65vh] min-h-[520px] max-h-[760px] overflow-hidden rounded-2xl border border-teal-100 bg-slate-100"><PoseCamera protocol={protocol} onLandmarks={onLandmarks} /><div className="absolute bottom-4 right-4 rounded-2xl bg-white/95 px-5 py-3 text-center shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{countdown === null ? "Hold steady" : countdown === 0 ? "Ready" : `Starting in ${countdown}`}</p><p className="mt-1 text-3xl font-black text-teal-800">{Math.round((calibrationMs / 1500) * 100)}%</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><CalibrationCheck label="Body anchors in frame" good={calibration.anchorsVisible} /><CalibrationCheck label="Perspective advisory" good={calibration.perspectiveAligned} /><CalibrationCheck label="Stable 1.5 seconds" good={calibrationMs >= 1500} /></div>{issues.length > 0 && <p className="mt-5 text-sm text-amber-700">{issues[0]}</p>}</div></section></main>;
}

function CalibrationCheck({ label, good }: { label: string; good: boolean }) { return <div className={`rounded-xl border p-4 text-sm ${good ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : "border-slate-700 bg-slate-950 text-slate-500"}`}>{good ? "✓" : "○"} <span className="ml-2">{label}</span></div>; }

function PrescriptionRequiredView({ fields, sourceDocumentName, onRestartToPaper }: { fields: string[]; sourceDocumentName?: string; onRestartToPaper?: () => void }) {
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-white"><section className="w-full max-w-2xl rounded-3xl border border-amber-400/30 bg-slate-900 p-8"><p className="text-xs font-bold uppercase tracking-[.2em] text-amber-300">Clinician prescription required</p><h1 className="mt-3 text-3xl font-black">We cannot safely start this exercise yet</h1><p className="mt-4 leading-7 text-slate-300">PhysioGuard uses the uploaded paper as the source of truth. It will not invent ROM limits, safety ceilings, sets, or repetitions from a catalog protocol.</p><p className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">Missing from {sourceDocumentName || "the uploaded paper"}: {fields.join(", ")}.</p><p className="mt-5 text-sm leading-6 text-slate-400">Please upload a clearer paper or confirm the missing values with the prescribing clinician. Do not enter values based on guesswork.</p>{onRestartToPaper && <button type="button" onClick={onRestartToPaper} className="mt-7 rounded-xl bg-emerald-400 px-5 py-3 font-black text-slate-950">Upload a different paper</button>}</section></main>;
}
