"use client";

export function CalibrationOverlay({ progressPercent, message, issues }: { progressPercent: number; message: string; issues?: string[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="rounded-2xl bg-black/30 px-5 py-3 text-center text-white backdrop-blur-[1px]">
        <p className="text-xs font-black uppercase tracking-wider">{message}</p>
        <div className="mt-2 flex items-center justify-center gap-3">
          <Ring value={progressPercent} />
          <p className="text-sm">{Math.round(progressPercent)}%</p>
        </div>
        {issues && issues.length > 0 && (
          <p className="mt-2 text-[11px] text-amber-200">{issues[0]}</p>
        )}
      </div>
    </div>
  );
}

function Ring({ value }: { value: number }) {
  const size = 40;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Calibration ${Math.round(value)} percent`}>
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,.3)" strokeWidth={stroke} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="#34d399" strokeWidth={stroke} fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
    </svg>
  );
}
