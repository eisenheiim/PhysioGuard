import { NextResponse } from "next/server";
import { access } from "fs/promises";
import { constants } from "fs";
import { join } from "path";

export const runtime = "nodejs";

async function exists(p: string) {
  try { await access(p, constants.R_OK); return true; } catch { return false; }
}

export async function GET() {
  const root = process.cwd();
  const files = {
    pdfWorker: join(root, "public", "pdf.worker.min.mjs"),
    poseModel: join(root, "public", "mediapipe", "pose_landmarker_full.task"),
    wasmModule: join(root, "public", "mediapipe", "tasks-vision", "wasm", "vision_wasm_module_internal.js"),
    wasmInternal: join(root, "public", "mediapipe", "tasks-vision", "wasm", "vision_wasm_internal.js"),
    wasmNoSimd: join(root, "public", "mediapipe", "tasks-vision", "wasm", "vision_wasm_nosimd_internal.js"),
  } as const;

  const statuses = {
    pdfWorker: await exists(files.pdfWorker),
    poseModel: await exists(files.poseModel),
    wasmModule: await exists(files.wasmModule),
    wasmInternal: await exists(files.wasmInternal),
    wasmNoSimd: await exists(files.wasmNoSimd),
  };
  const ok = Object.values(statuses).every(Boolean);
  const payload = {
    ok,
    assets: statuses,
    env: process.env.NODE_ENV,
    commit: process.env.RENDER_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(payload, { status: ok ? 200 : 503 });
}
