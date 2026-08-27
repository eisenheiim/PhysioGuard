"use client";

import { useEffect, useReducer, useState } from "react";
import { Camera, CheckCircle2, ChevronRight, Info, MoveHorizontal, MoveVertical, type LucideIcon } from "lucide-react";
import { CLINICAL_PROTOCOLS, getProtocolMovementDirection, getProtocolTrackedSide, type ExerciseProtocol } from "../data/protocols";
import { initialProtocolSelectionState, protocolSelectionReducer, getSelectedProtocol } from "../lib/protocolSelection";

interface ProtocolSelectorProps {
  protocols?: readonly ExerciseProtocol[];
  onReady: (protocol: ExerciseProtocol) => void;
}

export function ProtocolSelector({ protocols = CLINICAL_PROTOCOLS, onReady }: ProtocolSelectorProps) {
  const [state, dispatch] = useReducer(protocolSelectionReducer, initialProtocolSelectionState());
  const selectedProtocol = getSelectedProtocol(state);
  const availableProtocols = Array.isArray(protocols) ? protocols : CLINICAL_PROTOCOLS;
  const [targetAngle, setTargetAngle] = useState<number | null>(null);
  const [safetyStopAngle, setSafetyStopAngle] = useState<number | null>(null);
  const [editingAngles, setEditingAngles] = useState(false);

  useEffect(() => {
    if (!selectedProtocol) return;
    setTargetAngle(selectedProtocol.targetMaxAngle);
    setSafetyStopAngle(selectedProtocol.safetyHardStopAngle);
    setEditingAngles(false);
  }, [selectedProtocol?.id]);

  const activeProtocol = selectedProtocol ? {
    ...selectedProtocol,
    targetMaxAngle: targetAngle ?? selectedProtocol.targetMaxAngle,
    safetyHardStopAngle: safetyStopAngle ?? selectedProtocol.safetyHardStopAngle,
  } : null;

  useEffect(() => {
    if (state.phase === "ACTIVE" && activeProtocol) onReady(activeProtocol);
  }, [onReady, safetyStopAngle, selectedProtocol?.id, state.phase, targetAngle]);

  if (state.phase === "ACTIVE" && selectedProtocol) {
    return <div className="min-h-screen bg-slate-950" aria-live="polite" />;
  }

  const cameraLabel = activeProtocol?.cameraSetup === "sagittal" ? "Side View" : "Front View";

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">PhysioGuard clinical setup</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-100">Choose your prescribed exercise</h1>
          <p className="mt-4 text-base leading-7 text-slate-400">Select the protocol prescribed by your clinician. PhysioGuard will use its ROM target, safety ceiling, compensation checks, and camera orientation for the session.</p>
        </header>

        <div className="mt-9 grid gap-5 md:grid-cols-2" aria-label="Available clinical protocols">
          {availableProtocols.map((protocol) => {
            const selected = protocol.id === state.selectedProtocolId;
            return (
              <button
                key={protocol.id}
                type="button"
                aria-pressed={selected}
                onClick={() => dispatch({ type: "SELECT_PROTOCOL", protocolId: protocol.id })}
                className={`rounded-2xl border p-6 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-400 ${selected ? "border-emerald-400 bg-emerald-400/10" : "border-slate-700 bg-slate-900 hover:border-slate-500"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-300">{protocol.category}</span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400"><Camera className="h-4 w-4" />{protocol.cameraSetup === "sagittal" ? "Side View" : "Front View"}</span>
                </div>
                <h2 className="mt-5 text-xl font-bold text-slate-100">{protocol.name}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">{protocol.clinicalSource}</p>
                <div className="mt-5 flex flex-wrap gap-5 text-sm">
                  <span><span className="block text-xs text-slate-500">Tracked side</span><strong className="text-emerald-300">{getProtocolTrackedSide(protocol)}</strong></span>
                  <span><span className="block text-xs text-slate-500">Target ROM</span><strong className="text-slate-200">{protocol.targetMaxAngle}°</strong></span>
                  <span><span className="block text-xs text-slate-500">Safety stop</span><strong className="text-amber-300">{protocol.safetyHardStopAngle}°</strong></span>
                  <span><span className="block text-xs text-slate-500">Checks</span><strong className="text-slate-200">{protocol.compensationChecks.length}</strong></span>
                </div>
              </button>
            );
          })}
        </div>

        {activeProtocol && state.phase === "SELECTED" && (
          <section className="mt-7 rounded-2xl border border-slate-700 bg-slate-900 p-6" aria-labelledby="calibration-title">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-emerald-400/15 p-3 text-emerald-300"><Camera className="h-6 w-6" /></div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Step 2 · Pose calibration</p>
                <h2 id="calibration-title" className="mt-1 text-2xl font-bold text-slate-100">Prepare for {activeProtocol.name}</h2>
                <p className="mt-2 text-slate-400">{activeProtocol.voicePrompts.ready}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <CalibrationHint icon={activeProtocol.cameraSetup === "sagittal" ? MoveHorizontal : MoveVertical} title={cameraLabel} detail={`Show your ${getProtocolTrackedSide(activeProtocol).toLowerCase()} side to the camera.`} />
              <CalibrationHint icon={Info} title="Full body visible" detail="Keep all anchor joints in frame." />
              <CalibrationHint icon={CheckCircle2} title="Stable position" detail="Hold still while calibration checks pose." />
            </div>
            <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950/60 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Exercise angles</p><p className="mt-1 text-sm text-slate-300">Target {activeProtocol.targetMaxAngle}° · Safety stop {activeProtocol.safetyHardStopAngle}°</p></div><button type="button" onClick={() => setEditingAngles((value) => !value)} className="rounded-lg border border-emerald-400 px-3 py-2 text-xs font-bold text-emerald-300">{editingAngles ? "Done" : "Edit"}</button></div>{editingAngles && <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-300">Target ROM (°)<input type="number" min="1" value={targetAngle ?? ""} onChange={(event) => setTargetAngle(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs font-bold text-slate-300">Safety stop (°)<input type="number" min="1" value={safetyStopAngle ?? ""} onChange={(event) => setSafetyStopAngle(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" /></label><p className="text-xs text-slate-400 sm:col-span-2">Keep the safety stop {getProtocolMovementDirection(activeProtocol) === "decreasing" ? "lower" : "higher"} than the target.</p></div>}</div><div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => dispatch({ type: "CONFIRM_CAMERA_SETUP" })} className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-5 py-3 font-bold text-slate-950 hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300">Camera position confirmed <ChevronRight className="h-4 w-4" /></button>
              <button type="button" onClick={() => dispatch({ type: "BACK_TO_PROTOCOLS" })} className="rounded-lg border border-slate-600 px-5 py-3 font-semibold text-slate-200 hover:border-slate-400">Choose another exercise</button>
            </div>
          </section>
        )}

        {activeProtocol && state.phase === "READY" && (
          <section className="mt-7 flex flex-col gap-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6 sm:flex-row sm:items-center sm:justify-between" aria-live="polite">
            <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Calibration ready</p><h2 className="mt-1 text-xl font-bold text-slate-100">Your setup is ready to start</h2><p className="mt-2 text-sm text-slate-300">The live session will stop at {activeProtocol.safetyHardStopAngle}° and flag the listed compensation patterns.</p></div>
            <button type="button" onClick={() => dispatch({ type: "START_EXERCISE" })} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 py-3 font-black text-slate-950 hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300">Start exercise <ChevronRight className="h-4 w-4" /></button>
          </section>
        )}

        {state.error && <p role="alert" className="mt-4 text-sm font-semibold text-red-300">{state.error}</p>}
      </div>
    </main>
  );
}

function CalibrationHint({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><Icon className="h-5 w-5 text-emerald-300" /><p className="mt-3 text-sm font-bold text-slate-200">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div>;
}
