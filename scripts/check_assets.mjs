#!/usr/bin/env node
import { access, constants } from 'fs';
import { join } from 'path';

function exists(p) {
  return new Promise((resolve) => access(p, constants.R_OK, (e) => resolve(!e)));
}

async function main() {
  const root = process.cwd();
  const files = {
    pdfWorker: join(root, 'public', 'pdf.worker.min.mjs'),
    poseModel: join(root, 'public', 'mediapipe', 'pose_landmarker_full.task'),
    wasmModule: join(root, 'public', 'mediapipe', 'tasks-vision', 'wasm', 'vision_wasm_module_internal.js'),
    wasmInternal: join(root, 'public', 'mediapipe', 'tasks-vision', 'wasm', 'vision_wasm_internal.js'),
    wasmNoSimd: join(root, 'public', 'mediapipe', 'tasks-vision', 'wasm', 'vision_wasm_nosimd_internal.js'),
  };
  const statuses = {};
  for (const [k, p] of Object.entries(files)) statuses[k] = await exists(p);
  const ok = Object.values(statuses).every(Boolean);
  console.log(JSON.stringify({ ok, assets: statuses, cwd: root }, null, 2));
  if (!ok) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
