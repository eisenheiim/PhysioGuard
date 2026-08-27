"use client";

import { useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { getProtocolTrackedSide, type ExerciseProtocol } from "../data/protocols";
import { getRequiredCalibrationAnchors, type PoseLandmarks } from "../lib/calibration";
import { LandmarkFilter } from "../lib/landmarkFilter";

// MediaPipe's 33-point order includes face landmarks between the nose and body.
// Keeping the complete index map is essential: body points are not consecutive.
const landmarkNames = ["NOSE", "LEFT_EYE_INNER", "LEFT_EYE", "LEFT_EYE_OUTER", "RIGHT_EYE_INNER", "RIGHT_EYE", "RIGHT_EYE_OUTER", "LEFT_EAR", "RIGHT_EAR", "MOUTH_LEFT", "MOUTH_RIGHT", "LEFT_SHOULDER", "RIGHT_SHOULDER", "LEFT_ELBOW", "RIGHT_ELBOW", "LEFT_WRIST", "RIGHT_WRIST", "LEFT_PINKY", "RIGHT_PINKY", "LEFT_INDEX", "RIGHT_INDEX", "LEFT_THUMB", "RIGHT_THUMB", "LEFT_HIP", "RIGHT_HIP", "LEFT_KNEE", "RIGHT_KNEE", "LEFT_ANKLE", "RIGHT_ANKLE", "LEFT_HEEL", "RIGHT_HEEL", "LEFT_FOOT_INDEX", "RIGHT_FOOT_INDEX"];

interface PoseCameraProps { protocol: ExerciseProtocol; onLandmarks: (landmarks: PoseLandmarks) => void; onWorldLandmarks?: (landmarks: PoseLandmarks) => void; onRestartToCalibration?: () => void; }
type Point = { x: number; y: number; z?: number; visibility?: number };

export function PoseCamera({ protocol, onLandmarks, onWorldLandmarks, onRestartToCalibration }: PoseCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const protocolRef = useRef(protocol);
  const onLandmarksRef = useRef(onLandmarks);
  const onWorldLandmarksRef = useRef(onWorldLandmarks);
  const [status, setStatus] = useState("Starting camera...");
  const [error, setError] = useState<string | null>(null);
  const [permissionHint, setPermissionHint] = useState<string | null>(null);
  const [restartKey, setRestartKey] = useState(0);

  protocolRef.current = protocol;
  onLandmarksRef.current = onLandmarks;
  onWorldLandmarksRef.current = onWorldLandmarks;

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let landmarker: PoseLandmarker | null = null;
    let frameTimer: number | undefined;
    let inferenceInFlight = false;
    const cachedOverlayPoints: Array<Point | undefined> = [];
    const cachedOverlayTimes: number[] = [];
    const landmarkFilter = new LandmarkFilter({ alpha: 0.5, minVisibility: 0.65, requiredStableFrames: 3 });
    const worldLandmarkFilter = new LandmarkFilter({ alpha: 0.5, minVisibility: 0.65, requiredStableFrames: 3 });

    const start = async () => {
      let loadingStage = "camera";
      try {
        // Load MediaPipe only when the camera view is opened so the landing
        // page does not wait for the WASM runtime and pose bundle.
        const { FilesetResolver, PoseLandmarker: PoseLandmarkerRuntime } = await import("@mediapipe/tasks-vision");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser does not support camera access.");
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        } catch (camErr: any) {
          const msg = camErr?.name || camErr?.message || String(camErr);
          if (/NotAllowedError|Permission|denied/i.test(msg)) {
            setPermissionHint("Camera permission denied. Click the address bar lock icon → Site settings → Allow Camera, then reload. On Safari: Settings → Websites → Camera → Allow.");
          }
          throw camErr;
        }
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus("Loading pose tracker...");
        loadingStage = "MediaPipe WASM runtime";
        let vision;
        try {
          vision = await FilesetResolver.forVisionTasks("/mediapipe/tasks-vision/wasm/");
        } catch (e) {
          throw new Error(`Could not load WASM modules. Check that /public/mediapipe/tasks-vision/wasm/ files exist. ${String(e)}`);
        }
        loadingStage = "pose model";
        const trackerOptions = {
          runningMode: "VIDEO" as const, numPoses: 1, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.45,
        };
        try {
          landmarker = await PoseLandmarkerRuntime.createFromOptions(vision, {
            baseOptions: { modelAssetPath: "/mediapipe/pose_landmarker_full.task", delegate: "GPU" },
            ...trackerOptions,
          });
        } catch (gpuReason) {
          console.warn("GPU pose tracking was unavailable; retrying with CPU.", gpuReason);
          landmarker = await PoseLandmarkerRuntime.createFromOptions(vision, {
            baseOptions: { modelAssetPath: "/mediapipe/pose_landmarker_full.task", delegate: "CPU" },
            ...trackerOptions,
          });
        }
        if (cancelled) return;
        const processFrame = (_now?: number) => {
          if (cancelled) return;
          const video = videoRef.current;
          if (!inferenceInFlight && video && landmarker && video.readyState >= 2) {
            inferenceInFlight = true;
            try {
              const ts = performance.now();
              const result = landmarker.detectForVideo(video, ts);
              const points = result.landmarks[0] || [];
              const landmarks = landmarkFilter.update(mapLandmarks(points));
              const now = performance.now();
              const worldLandmarks = worldLandmarkFilter.update(mapLandmarks(result.worldLandmarks[0] || []));
              const requiredLandmarks = selectExerciseLandmarks(protocolRef.current, landmarks);
              // Publish world points first so the active frame's 3D angle
              // calculation does not consume the previous frame's points.
              onWorldLandmarksRef.current?.(worldLandmarks);
              onLandmarksRef.current(requiredLandmarks);
              const stabilizedPoints = landmarkNames.map((name) => {
                const point = landmarks[name];
                return point ? { x: point.x, y: point.y, z: point.z, visibility: point.visibility } : undefined;
              });
              stabilizedPoints.forEach((point, index) => {
                if (point && (point.visibility ?? 0) >= 0.45) {
                  cachedOverlayPoints[index] = point;
                  cachedOverlayTimes[index] = now;
                }
              });
              const overlayNames = new Set([
                ...protocolRef.current.primaryJoint,
                ...protocolRef.current.compensationChecks.flatMap((check) => check.anchorJoints),
                ...(protocolRef.current.id === "cat_camel" ? ["LEFT_EAR", "RIGHT_EAR", "RIGHT_SHOULDER", "RIGHT_HIP"] : []),
              ]);
              drawOverlay(canvasRef.current, video, stabilizedPoints, protocolRef.current, cachedOverlayPoints, cachedOverlayTimes, now, overlayNames);
              setStatus(points.length ? "Camera connected" : "Move into the camera frame");
            } catch (reason) {
              if (!cancelled) { setError(reason instanceof Error ? reason.message : "Pose tracking could not process the camera frame."); setStatus("Pose tracking unavailable"); }
            } finally { inferenceInFlight = false; }
          }
          if (!cancelled) {
            if ("requestVideoFrameCallback" in HTMLVideoElement.prototype && videoRef.current) {
              (videoRef.current as any).requestVideoFrameCallback(processFrame);
            } else {
              frameTimer = window.setTimeout(processFrame, 50);
            }
          }
        };
        setStatus("Camera connected");
        if ("requestVideoFrameCallback" in HTMLVideoElement.prototype && videoRef.current) {
          (videoRef.current as any).requestVideoFrameCallback(processFrame);
        } else {
          processFrame();
        }
      } catch (reason) {
        if (!cancelled) { const message = reason instanceof Error ? reason.message : "Camera access was not available."; setError(`${loadingStage}: ${message}`); setStatus("Camera unavailable"); }
      }
    };
    void start();
    return () => { cancelled = true; if (frameTimer) window.clearTimeout(frameTimer); landmarker?.close(); stream?.getTracks().forEach((track) => track.stop()); };
    // The camera/model must initialize once per mounted camera, not once per
    // React render. Angle updates change the callback identity in the parent.
  }, [restartKey]);

  return <div className="absolute inset-0 bg-slate-100"><video ref={videoRef} className="h-full w-full object-cover" playsInline muted /><canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-label="Live pose tracking overlay" /><div className="absolute left-4 top-4 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 text-xs font-bold text-teal-900 shadow-sm">{status}</div><button type="button" onClick={() => { if (onRestartToCalibration) { onRestartToCalibration(); return; } setError(null); setPermissionHint(null); setStatus("Restarting camera..."); setRestartKey((value) => value + 1); }} className="absolute left-4 top-14 rounded-lg border border-white/80 bg-white/95 px-3 py-2 text-xs font-bold text-teal-900 shadow-sm transition hover:bg-white">Back to calibration</button><div className="absolute right-4 top-4 max-w-[250px] rounded-2xl border border-white/80 bg-white/95 p-4 shadow-lg"><p className="text-[10px] font-black uppercase tracking-wider text-teal-700">Exercise instructions</p><p className="mt-2 text-xs leading-5 text-slate-700">{protocol.voicePrompts.ready}</p><p className="mt-2 text-[11px] font-bold text-slate-500">{protocol.cameraSetup === "sagittal" ? "Side view" : "Front view"} · Tracked side: {getProtocolTrackedSide(protocol)} · Target {protocol.targetMaxAngle}° · Stop {protocol.safetyHardStopAngle}°</p></div>{error && <div className="absolute inset-x-5 top-24 rounded-2xl border border-rose-200 bg-white/95 p-4 text-sm text-rose-700 shadow-lg"><strong>Camera or pose tracking problem.</strong><p className="mt-1">{permissionHint || "Allow camera access and keep the required body points visible, then refresh if needed."}</p><p className="mt-2 text-xs text-rose-500 break-words">{error}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => { setError(null); setPermissionHint(null); setStatus("Restarting camera..."); setRestartKey((v) => v + 1); }} className="rounded border border-rose-300 px-3 py-1 text-xs font-bold text-rose-700">Retry camera</button><button type="button" onClick={() => window.location.reload()} className="rounded border border-rose-300 px-3 py-1 text-xs font-bold text-rose-700">Reload</button></div></div>}</div>;
}

function selectExerciseLandmarks(protocol: ExerciseProtocol, landmarks: PoseLandmarks): PoseLandmarks {
  const names = new Set([
    ...getRequiredCalibrationAnchors(protocol),
    ...(protocol.id === "cat_camel" ? ["LEFT_EAR", "RIGHT_EAR", "RIGHT_SHOULDER", "RIGHT_HIP"] : []),
  ]);
  const selected: PoseLandmarks = {};
  names.forEach((name) => { selected[name] = landmarks[name]; });
  return selected;
}

function mapLandmarks(points: Point[]): PoseLandmarks {
  const landmarks: PoseLandmarks = {};
  points.forEach((point, index) => { const name = landmarkNames[index]; if (name) landmarks[name] = { x: point.x, y: point.y, z: point.z, visibility: point.visibility ?? 0 }; });
  return landmarks;
}

function drawOverlay(canvas: HTMLCanvasElement | null, video: HTMLVideoElement | null, landmarks: Array<Point | undefined>, protocol: ExerciseProtocol, cachedPoints: Array<Point | undefined> = [], cachedTimes: number[] = [], now = performance.now(), lockedNames?: Set<string>) {
  if (!canvas || !video) return;
  const width = canvas.clientWidth; const height = canvas.clientHeight;
  if (!width || !height) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio; canvas.height = height * ratio;
  const context = canvas.getContext("2d"); if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, width, height); context.strokeStyle = "rgba(20, 184, 166, .82)"; context.lineWidth = 3;
  const visibleLandmarks = landmarks.map((point, index) => point && (point.visibility ?? 0) >= 0.45 ? point : now - (cachedTimes[index] ?? 0) <= 320 ? cachedPoints[index] : undefined);
  const points = protocol.primaryJoint.map((name) => visibleLandmarks[landmarkNames.indexOf(name)]).filter(Boolean) as Point[];
  if (points.length === 3) { context.beginPath(); context.moveTo(points[0].x * width, points[0].y * height); points.slice(1).forEach((point) => context.lineTo(point.x * width, point.y * height)); context.stroke(); }
  visibleLandmarks.forEach((point, index) => {
    const name = landmarkNames[index];
    if (!point || (point.visibility ?? 1) < 0.45 || (lockedNames && !lockedNames.has(name))) return;
    context.fillStyle = "#0f766e";
    context.beginPath();
    context.arc(point.x * width, point.y * height, 4, 0, Math.PI * 2);
    context.fill();
  });
}
