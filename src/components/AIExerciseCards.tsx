"use client";

import { CheckCircle2, Pencil, Save, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { CLINICAL_PROTOCOLS } from "../data/protocols";
import type { AIExercisePlan } from "../lib/aiPlan";

interface AIExerciseCardsProps { plan: AIExercisePlan; onChange: (plan: AIExercisePlan) => void; }

export function AIExerciseCards({ plan, onChange }: AIExerciseCardsProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const update = (id: string, key: "sets" | "repetitions" | "holdSeconds" | "restSeconds", value: string) => onChange({ ...plan, exercises: plan.exercises.map((item) => item.id === id ? { ...item, [key]: value === "" ? null : Number(value) } : item) });
  const replaceExercise = (id: string, protocolId: string) => {
    const protocol = CLINICAL_PROTOCOLS.find((item) => item.id === protocolId);
    if (!protocol) return;
    // Protocol catalog entries supply pose geometry and coaching only. Numeric
    // prescription values must remain sourced from the uploaded paper.
    onChange({ ...plan, exercises: plan.exercises.map((item) => item.id === id ? { ...item, protocolId: protocol.id, name: protocol.name, category: protocol.category, cameraSetup: protocol.cameraSetup, instructions: protocol.voicePrompts.ready } : item) });
  };

  return <section className="mt-6" aria-labelledby="ai-plan-title">
    <div className="rounded-2xl border border-teal-100 bg-teal-50 p-5">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-teal-700">Plan review</p>
      <h2 id="ai-plan-title" className="mt-2 text-xl font-black text-teal-950">Exercises from your paper</h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">{plan.documentSummary}</p>
      <div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-2"><p><span className="font-bold text-slate-800">Clinical source:</span> {plan.clinicalSource || "Not specified in the paper"}</p><p><span className="font-bold text-slate-800">Plan status:</span> {plan.needsClinicianReview ? "Review needed before starting" : "Values extracted for review"}</p></div>
      {plan.needsClinicianReview && <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /><div><p className="font-bold">Please review before starting</p>{plan.reviewNotes.length > 0 && <ul className="mt-1 list-disc pl-4">{plan.reviewNotes.slice(0, 3).map((note) => <li key={note}>{note}</li>)}</ul>}</div></div>}
    </div>
    <div className="mt-4 space-y-4">
      {plan.exercises.map((exercise, index) => <article key={exercise.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4"><div><span className="text-xs font-bold uppercase tracking-wider text-teal-700">Exercise {index + 1}</span><span className="ml-2 text-xs font-bold uppercase tracking-wider text-slate-500">{exercise.category}</span><h3 className="mt-1 text-lg font-bold text-teal-950">{exercise.name}</h3></div><button type="button" onClick={() => setEditing(editing === exercise.id ? null : exercise.id)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:border-teal-500 hover:text-teal-800"><Pencil className="h-4 w-4" />{editing === exercise.id ? "Close" : "Edit"}</button></div>
        <p className="mt-3 text-sm leading-6 text-slate-700">{exercise.instructions}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-600 sm:grid-cols-3"><span><span className="block text-slate-500">Sets</span><strong className="text-slate-900">{exercise.sets ?? "Not specified"}</strong></span><span><span className="block text-slate-500">Reps</span><strong className="text-slate-900">{exercise.repetitions ?? "Not specified"}</strong></span><span><span className="block text-slate-500">Hold / Rest</span><strong className="text-slate-900">{exercise.holdSeconds != null || exercise.restSeconds != null ? `${exercise.holdSeconds ?? 0}s / ${exercise.restSeconds ?? 0}s` : "Not specified"}</strong></span><span><span className="block text-slate-500">Target ROM</span><strong className="text-slate-900">{exercise.targetAngleDegrees == null ? "Not specified" : `${exercise.targetAngleDegrees}°`}</strong></span><span><span className="block text-slate-500">Safety stop</span><strong className="text-amber-700">{exercise.safetyStopAngleDegrees == null ? "Review" : `${exercise.safetyStopAngleDegrees}°`}</strong></span><span><span className="block text-slate-500">Camera / side</span><strong className="text-slate-900">{exercise.cameraSetup === "sagittal" ? "Side" : exercise.cameraSetup === "frontal" ? "Front" : "Review"} / {exercise.side ?? "Paper"}</strong></span></div>
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"><strong className="text-slate-800">Clinical source:</strong> {plan.clinicalSource || "Not specified in the paper"}</div>
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-teal-100 bg-teal-50 p-3 text-xs leading-5 text-teal-950"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" /><div><p className="font-bold">Source from uploaded paper</p><p className="mt-1 italic text-teal-900">“{exercise.evidence}”</p></div></div>
        {exercise.clinicianReviewRequired && <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-amber-800"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />This exercise has an ambiguous or safety-sensitive value. Review it before starting.</p>}
        {editing === exercise.id && <div className="mt-5 grid gap-3 rounded-xl border border-teal-100 bg-teal-50 p-4 sm:grid-cols-4"><label className="text-xs font-semibold text-slate-700 sm:col-span-4">Exercise<select value={exercise.protocolId} onChange={(event) => replaceExercise(exercise.id, event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">{CLINICAL_PROTOCOLS.map((protocol) => <option key={protocol.id} value={protocol.id}>{protocol.name}</option>)}</select></label>{(["sets", "repetitions", "holdSeconds", "restSeconds"] as const).map((key) => <label key={key} className="text-xs font-semibold text-slate-700">{key === "holdSeconds" ? "Hold (sec)" : key === "restSeconds" ? "Rest (sec)" : key === "sets" ? "Sets" : "Reps"}<input type="number" min="0" value={exercise[key] ?? ""} onChange={(event) => update(exercise.id, key, event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" /></label>)}<p className="sm:col-span-4 flex items-center gap-2 text-xs text-teal-800"><Save className="h-4 w-4" />Changes are saved into this plan immediately.</p></div>}
        {exercise.compensationWarnings.length > 0 && <p className="mt-4 text-xs text-amber-800">Form watch: {exercise.compensationWarnings.join("; ")}</p>}
      </article>)}
    </div>
  </section>;
}
