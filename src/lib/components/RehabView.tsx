import React, { useState } from "react";
import { ShieldAlert, CheckCircle2, AlertTriangle, FileDown } from "lucide-react";

interface RehabViewProps {
    currentAngle: number;
    targetMaxAngle: number;
    currentRep: number;
    totalRepsTarget: number;
    isCompensating: boolean;
    compensationMsg: string;
    isSafetyTriggered: boolean;
    onExportReport: () => void;
}

export const RehabView: React.FC<RehabViewProps> = ({
    currentAngle,
    targetMaxAngle,
    currentRep,
    totalRepsTarget,
    isCompensating,
    compensationMsg,
    isSafetyTriggered,
    onExportReport,
}) => {
    // Açıya ve güvenliğe göre dinamik renk
    const getStatusColor = () => {
        if (isSafetyTriggered) return "border-red-500 bg-red-500/10 text-red-500";
        if (isCompensating) return "border-amber-500 bg-amber-500/10 text-amber-400";
        return "border-emerald-500 bg-emerald-500/10 text-emerald-400";
    };

    return (
        <div className="relative w-full h-screen bg-slate-950 text-white font-sans overflow-hidden">
            {/* 1. Üst Güvenlik ve Durum Çubuğu */}
            <header className="absolute top-0 inset-x-0 z-20 p-6 flex justify-between items-center bg-gradient-to-b from-slate-950/80 to-transparent backdrop-blur-sm">
                <div>
                    <h1 className="text-xl font-bold tracking-wide text-slate-100 flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                        PhysioGuard Live Track
                    </h1>
                    <p className="text-sm text-slate-400">Target Protocol: Knee Flexion (ACL Phase 2)</p>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={onExportReport}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition border border-slate-700 shadow-sm"
                    >
                        <FileDown className="h-4 w-4" />
                        Export Clinician PDF
                    </button>
                </div>
            </header>

            {/* 2. Canlı Kamera & Canvas Katmanı (Buraya video/canvas monte edilir) */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-full h-full max-w-5xl aspect-video bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex items-center justify-center">
                    {/* Mock Video Placeholder */}
                    <span className="text-slate-600 font-mono text-sm">[Camera Viewport & Skeleton Tracking Canvas]</span>

                    {/* 3. Canlı Açı Göstergesi (HUD - Büyük Boyutlu) */}
                    <div className="absolute bottom-8 left-8 p-6 rounded-2xl bg-slate-950/90 border border-slate-800 backdrop-blur-md min-w-[200px]">
                        <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                            Current Joint Angle
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-6xl font-black tabular-nums ${getStatusColor().split(" ")[2]}`}>
                                {Math.round(currentAngle)}°
                            </span>
                            <span className="text-slate-500 font-medium">/ max {targetMaxAngle}°</span>
                        </div>
                    </div>

                    {/* 4. Tekrar ve İlerleme Kartı */}
                    <div className="absolute bottom-8 right-8 p-6 rounded-2xl bg-slate-950/90 border border-slate-800 backdrop-blur-md min-w-[180px] text-right">
                        <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                            Repetitions
                        </div>
                        <div className="text-5xl font-black text-slate-100 tabular-nums">
                            {currentRep} <span className="text-2xl text-slate-500 font-normal">/ {totalRepsTarget}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 5. Dinamik Güvenlik ve Kompansasyon Uyarı Katmanı (Overlay Banner) */}
            {isSafetyTriggered && (
                <div className="absolute top-24 inset-x-8 z-30 p-4 bg-red-600/90 text-white rounded-xl shadow-2xl flex items-center justify-between border border-red-400 animate-bounce">
                    <div className="flex items-center gap-3">
                        <ShieldAlert className="h-7 w-7 text-white shrink-0" />
                        <div>
                            <div className="font-bold text-base">SAFETY GUARDRAIL TRIGGERED</div>
                            <div className="text-sm text-red-100">Prescribed safety threshold exceeded. Please return to resting position slowly.</div>
                        </div>
                    </div>
                    <span className="px-3 py-1 bg-white text-red-700 font-bold rounded text-xs uppercase">Auto-Paused</span>
                </div>
            )}

            {!isSafetyTriggered && isCompensating && (
                <div className="absolute top-24 inset-x-8 z-30 p-4 bg-amber-500/90 text-slate-950 rounded-xl shadow-xl flex items-center gap-3 border border-amber-300">
                    <AlertTriangle className="h-6 w-6 text-slate-950 shrink-0" />
                    <div className="font-semibold text-sm">
                        Biomechanical Flag: <span className="font-normal">{compensationMsg}</span>
                    </div>
                </div>
            )}
        </div>
    );
};