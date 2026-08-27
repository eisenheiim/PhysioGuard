"use client";

import { ArrowLeft, Dumbbell, Play } from "lucide-react";
import { useState } from "react";
import { CLINICAL_PROTOCOLS, getProtocolMovementDirection, getProtocolTrackedSide, type ExerciseProtocol } from "../data/protocols";
import type { ExtractedRehabDocument } from "../lib/documentExtraction";
import type { AIExercisePlan } from "../lib/aiPlan";

interface ManualExerciseSetupProps {
  onContinue: (document: ExtractedRehabDocument, plan: AIExercisePlan) => void;
  onBack: () => void;
}

export function ManualExerciseSetup({ onContinue, onBack }: ManualExerciseSetupProps) {
  const [protocolId, setProtocolId] = useState(CLINICAL_PROTOCOLS[0]?.id || "");
  const [sets, setSets] = useState("3");
  const [repetitions, setRepetitions] = useState("10");
  const [targetAngle, setTargetAngle] = useState(String(CLINICAL_PROTOCOLS[0]?.targetMaxAngle ?? ""));
  const [safetyStop, setSafetyStop] = useState(String(CLINICAL_PROTOCOLS[0]?.safetyHardStopAngle ?? ""));
  const [error, setError] = useState<string | null>(null);
  const protocol = CLINICAL_PROTOCOLS.find((item) => item.id === protocolId) || CLINICAL_PROTOCOLS[0];

  const chooseProtocol = (nextId: string) => {
    const nextProtocol = CLINICAL_PROTOCOLS.find((item) => item.id === nextId);
    setProtocolId(nextId);
    if (nextProtocol) {
      setTargetAngle(String(nextProtocol.targetMaxAngle));
      setSafetyStop(String(nextProtocol.safetyHardStopAngle));
    }
  };

  const start = () => {
    const values = [sets, repetitions, targetAngle, safetyStop].map(Number);
    if (!protocol || values.some((value) => !Number.isFinite(value) || value <= 0)) {
      setError("Enter a positive value for sets, repetitions, target ROM, and safety stop.");
      return;
    }
    const [setCount, repCount, target, stop] = values;
    const direction = getProtocolMovementDirection(protocol);
    const invalidSafetyOrder = direction === "decreasing" ? stop >= target : stop <= target;
    if (invalidSafetyOrder) {
      setError(direction === "decreasing"
        ? "For this exercise, the safety stop must be lower than the target ROM."
        : "For this exercise, the safety stop must be greater than the target ROM.");
      return;
    }
    const exercise = {
      id: `manual-${protocol.id}`,
      protocolId: protocol.id,
      name: protocol.name,
      category: protocol.category,
      instructions: protocol.voicePrompts.ready,
      sets: setCount,
      repetitions: repCount,
      holdSeconds: null,
      restSeconds: null,
      targetAngleDegrees: target,
      safetyStopAngleDegrees: stop,
      cameraSetup: protocol.cameraSetup,
      compensationWarnings: protocol.compensationChecks.map((check) => check.description),
      evidence: "Selected manually from the PhysioGuard exercise library.",
      clinicianReviewRequired: true,
    };
    onContinue(
      {
        fileName: "Manual exercise selection",
        fileType: "manual",
        text: `${protocol.name}: ${setCount} sets of ${repCount} repetitions. Target ROM ${target} degrees. Safety stop ${stop} degrees.`,
        extractedAt: new Date().toISOString(),
      },
      {
        documentSummary: "Exercise selected manually from the library.",
        clinicalSource: protocol.clinicalSource,
        patientInstructions: [protocol.voicePrompts.ready],
        exercises: [exercise],
        needsClinicianReview: true,
        reviewNotes: ["Manual values should be checked against the prescribing clinician's instructions."],
        clinicianConfirmed: true,
      },
    );
  };

  return <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5" aria-labelledby="manual-exercise-title">
    <div className="flex items-start gap-3"><div className="rounded-xl bg-emerald-100 p-3 text-emerald-700"><Dumbbell className="h-5 w-5" /></div><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Manual setup</p><h3 id="manual-exercise-title" className="mt-1 text-xl font-black text-teal-950">Choose an exercise yourself</h3><p className="mt-1 text-sm leading-6 text-slate-600">Select a movement and confirm its session values before opening the camera.</p></div></div>
    <label className="mt-5 block text-sm font-bold text-teal-950">Exercise<select value={protocolId} onChange={(event) => chooseProtocol(event.target.value)} className="mt-2 w-full rounded-xl border border-teal-200 bg-white px-3 py-3 font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-400">{CLINICAL_PROTOCOLS.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.category}</option>)}</select></label>
    {protocol && <div className="mt-3 rounded-xl bg-white px-4 py-3 text-sm leading-6 text-slate-600"><p><strong className="text-teal-900">Instruction:</strong> {protocol.voicePrompts.ready}</p><p><strong className="text-teal-900">Camera:</strong> {protocol.cameraSetup === "sagittal" ? "Side view" : "Front view"}</p><p><strong className="text-teal-900">Tracked side:</strong> {getProtocolTrackedSide(protocol)}</p></div>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2"><NumberField label="Sets" value={sets} onChange={setSets} /><NumberField label="Repetitions" value={repetitions} onChange={setRepetitions} /><NumberField label="Target ROM (°)" value={targetAngle} onChange={setTargetAngle} /><NumberField label="Safety stop (°)" value={safetyStop} onChange={setSafetyStop} /></div>
    <p className="mt-4 text-xs leading-5 text-slate-600">Library values are prefilled for convenience. Confirm them with your clinician before exercising.</p>
    {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-3 font-bold text-teal-900"><ArrowLeft className="h-4 w-4" />Back</button><button type="button" onClick={start} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 font-black text-slate-950 hover:bg-emerald-300"><Play className="h-4 w-4" />Continue to review</button></div>
  </section>;
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-bold text-teal-950">{label}<input type="number" min="1" step="1" value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-teal-200 bg-white px-3 py-3 font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-400" /></label>;
}
