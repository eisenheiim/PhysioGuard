"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileText, LoaderCircle, ShieldCheck, UploadCloud, Dumbbell } from "lucide-react";
import { extractRehabDocument, type ExtractedRehabDocument } from "../lib/documentExtraction";
import type { AIExercisePlan } from "../lib/aiPlan";
import { AIExerciseCards } from "./AIExerciseCards";
import { ManualExerciseSetup } from "./ManualExerciseSetup";

interface DocumentIntakeProps { onContinue: (document: ExtractedRehabDocument, plan: AIExercisePlan) => void; }

export function DocumentIntake({ onContinue }: DocumentIntakeProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [document, setDocument] = useState<ExtractedRehabDocument | null>(null);
  const [plan, setPlan] = useState<AIExercisePlan | null>(null);
  const [clinicianConfirmed, setClinicianConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  const analyzePaper = async (source: ExtractedRehabDocument) => {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/analyze-rehab-document", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: source.fileName, text: source.text }) });
      const payload = await response.json() as AIExercisePlan & { error?: string; details?: string[] };
      if (!response.ok) {
        setErrorDetails(Array.isArray((payload as any).details) ? (payload as any).details as string[] : []);
        throw new Error(payload.error || "The document could not be analyzed.");
      }
      if (!payload.exercises?.length) throw new Error("No exercises were found. Please check the paper or upload a clearer copy.");
      setPlan(payload); setClinicianConfirmed(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The paper could not be analyzed."); setShowDetails(true); }
    finally { setBusy(false); }
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError(null); setDocument(null); setPlan(null); setClinicianConfirmed(false);
    try { const nextDocument = await extractRehabDocument(file); setDocument(nextDocument); setErrorDetails([]); setShowDetails(false); await analyzePaper(nextDocument); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The document could not be read."); setBusy(false); }
  };

  return <main className="min-h-screen bg-slate-950 px-5 py-10 text-white md:px-8"><section className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-start"><div className="pt-3"><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-400">Start your program</p><h1 className="mt-4 max-w-xl text-4xl font-black leading-tight tracking-tight text-teal-950 md:text-5xl">Turn your clinician’s paper into a clear exercise plan.</h1><p className="mt-5 max-w-xl text-base leading-7 text-slate-400">Upload the instructions from your doctor or physical therapist. We will read the prescribed exercises, organize the details, and let you review everything before the camera session.</p><div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1"><WorkflowStep number="01" title="Upload" detail="Add a PDF, photo, or text file." /><WorkflowStep number="02" title="Review" detail="Check exercises, sets, reps, and limits." /><WorkflowStep number="03" title="Move" detail="Start the guided camera session." /></div></div><div className="rounded-3xl border border-teal-100 bg-white p-5 shadow-sm md:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-teal-700">Your instructions</p><h2 className="mt-2 text-2xl font-black text-teal-950">Upload a rehabilitation paper</h2></div><div className="rounded-xl bg-teal-50 p-3"><FileText className="h-6 w-6 text-teal-700" /></div></div>
    <label htmlFor="rehab-file-input" role="button" tabIndex={0} className="mt-7 flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/60 px-6 py-12 text-center transition hover:border-teal-500 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-400">
      <UploadCloud className="h-9 w-9 text-teal-700" />
      <span className="mt-4 text-lg font-bold text-teal-950">Choose a document</span>
      <span className="mt-2 text-sm text-slate-500">PDF, image, or plain text · Maximum 20 MB</span>
      <input id="rehab-file-input" ref={inputRef} type="file" accept="application/pdf,image/*,text/plain,.pdf,.txt" className="absolute h-px w-px -translate-x-[9999px] overflow-hidden opacity-0" onChange={(event) => void handleFile(event.target.files?.[0])} />
    </label>
    <div className="mt-6 flex items-center gap-3"><span className="h-px flex-1 bg-teal-100" /><span className="text-xs font-bold uppercase tracking-wider text-slate-400">or</span><span className="h-px flex-1 bg-teal-100" /></div>
    <button type="button" onClick={() => { setManualMode(true); setError(null); }} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4 font-black text-emerald-900 hover:bg-emerald-100"><Dumbbell className="h-5 w-5" />Choose an exercise yourself</button>
    {manualMode && <ManualExerciseSetup onBack={() => setManualMode(false)} onContinue={onContinue} />}
    {busy && <div className="mt-5 flex items-center gap-3 rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-900" role="status"><LoaderCircle className="h-5 w-5 animate-spin text-teal-700" />{document ? "We are preparing your exercise plan…" : "Reading your paper…"}</div>}
    {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p className="font-semibold">{error}</p>
      {errorDetails.length > 0 && <div className="mt-3 rounded-lg border border-red-200 bg-white/70 p-3 text-xs text-red-700">
        <button type="button" onClick={() => setShowDetails((v) => !v)} className="mb-2 rounded border border-red-300 px-2 py-1 font-bold text-red-800">{showDetails ? "Detayları gizle" : "Detayları göster"}</button>
        {showDetails && <ul className="list-disc space-y-1 pl-5">
          {errorDetails.map((d, i) => <li key={i}>{d}</li>)}
        </ul>}
      </div>}
    </div>}
    {document && !plan && !busy && <div className="mt-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><FileText className="h-5 w-5 text-emerald-700" /><p className="text-sm text-emerald-900">{document.fileName} is ready for us.</p></div>}
    {plan && <AIExerciseCards plan={plan} onChange={(nextPlan) => { setPlan({ ...nextPlan, clinicianConfirmed: false }); setClinicianConfirmed(false); }} />}
    {plan && document && <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />Review the plan and edit any exercise details before starting. This does not replace clinician guidance.</div>}
    {plan && document && <label className="mt-4 flex items-start gap-3 rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-950"><input type="checkbox" checked={clinicianConfirmed} onChange={(event) => setClinicianConfirmed(event.target.checked)} className="mt-1 h-5 w-5 accent-teal-700" /><span>I confirm that the exercise values match the prescribing clinician’s paper and have been reviewed before starting.</span></label>}
    {plan && document && <button type="button" disabled={!clinicianConfirmed} onClick={() => onContinue(document, { ...plan, clinicianConfirmed: true })} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-4 text-lg font-black text-slate-950 shadow-sm transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 className="h-5 w-5" />Start plan</button>}
  </div></section></main>;
}

function WorkflowStep({ number, title, detail }: { number: string; title: string; detail: string }) { return <div className="flex items-start gap-3"><span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-black text-teal-800">{number}</span><div><p className="font-bold text-teal-950">{title}</p><p className="mt-0.5 text-sm text-slate-500">{detail}</p></div></div>; }
