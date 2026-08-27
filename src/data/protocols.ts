export interface CompensationCheck {
  type: string;
  description: string;
  anchorJoints: [string, string, string];
  thresholdAngle: number;
  correctionPrompt: string;
}

export interface ExerciseProtocol {
  id: string;
  name: string;
  category: "Lower Extremity" | "Upper Extremity" | "Spine & Core";
  clinicalSource: string;
  cameraSetup: "sagittal" | "frontal"; // sagittal = Side view, frontal = Front view
  primaryJoint: [string, string, string]; // [Point A, Center/Vertex, Point B]
  angleTransform?: "included" | "flexion";
  angleMeasurement?: "joint" | "forearm_rotation" | "cervical_retraction" | "bird_dog_alignment" | "bilateral_bridge";
  /** Direction of the measured joint angle while moving toward the target. */
  movementDirection?: "decreasing" | "increasing";
  baselineAngle: number;
  targetMaxAngle: number;
  safetyHardStopAngle: number;
  compensationChecks: CompensationCheck[];
  voicePrompts: {
    ready: string;
    goodRep: string;
    compensating: string;
    safetyHalt: string;
  };
}

export type ExerciseSide = "Left" | "Right";

export function applyProtocolSide(protocol: ExerciseProtocol, side: ExerciseSide): ExerciseProtocol {
  if (side === "Left") return protocol;
  const swap = (name: string) => name.startsWith("LEFT_") ? name.replace("LEFT_", "RIGHT_") : name.startsWith("RIGHT_") ? name.replace("RIGHT_", "LEFT_") : name;
  return {
    ...protocol,
    primaryJoint: protocol.primaryJoint.map(swap) as ExerciseProtocol["primaryJoint"],
    compensationChecks: protocol.compensationChecks.map((check) => ({ ...check, anchorJoints: check.anchorJoints.map(swap) as CompensationCheck["anchorJoints"] })),
  };
}

export const TOP_20_CLINICAL_PROTOCOLS: ExerciseProtocol[] = [
  // ==========================================
  // I. LOWER EXTREMITY (KNEE, HIP, ANKLE)
  // ==========================================
  {
    id: "heel_slides",
    name: "Heel Slides (Knee Flexion)",
    category: "Lower Extremity",
    clinicalSource: "Mass General Brigham - Post-Op ACL Protocol",
    cameraSetup: "sagittal",
    primaryJoint: ["LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"],
    angleTransform: "flexion",
    baselineAngle: 0,
    targetMaxAngle: 90,
    safetyHardStopAngle: 100,
    compensationChecks: [
      {
        type: "trunk_pitch_forward",
        description: "Bending upper torso forward to pull leg manually",
        anchorJoints: ["LEFT_SHOULDER", "LEFT_HIP", "LEFT_KNEE"],
        thresholdAngle: 18,
        correctionPrompt: "Keep your upper body flat and relax your torso.",
      },
    ],
    voicePrompts: {
      ready: "Position sideways to the camera. Slowly slide your heel toward your hip.",
      goodRep: "Target depth achieved. Slowly extend your leg.",
      compensating: "Keep your upper body flat; do not tense your torso.",
      safetyHalt: "Prescribed safety limit reached. Do not force further.",
    },
  },
  {
    id: "straight_leg_raise",
    name: "Straight Leg Raise (SLR)",
    category: "Lower Extremity",
    clinicalSource: "AAOS Total Knee Arthroplasty Guideline",
    cameraSetup: "sagittal",
    primaryJoint: ["LEFT_SHOULDER", "LEFT_HIP", "LEFT_ANKLE"],
    movementDirection: "decreasing",
    baselineAngle: 180,
    targetMaxAngle: 45,
    safetyHardStopAngle: 60,
    compensationChecks: [
      {
        type: "extensor_lag_knee_bend",
        description: "Bending the knee while elevating leg (extensor lag)",
        anchorJoints: ["LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"],
        thresholdAngle: 15,
        correctionPrompt: "Lock your knee completely straight.",
      },
    ],
    voicePrompts: {
      ready: "Lie sideways to the camera. Lock your knee and raise your leg.",
      goodRep: "Clean form. Lower with control.",
      compensating: "Keep your knee locked; engage your quadriceps.",
      safetyHalt: "Sufficient height reached. Lower leg slowly.",
    },
  },
  {
    id: "short_arc_quad",
    name: "Short Arc Quad (Terminal Knee Ext.)",
    category: "Lower Extremity",
    clinicalSource: "UW Health Knee Rehabilitation Guidelines",
    cameraSetup: "sagittal",
    primaryJoint: ["LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"],
    baselineAngle: 140,
    targetMaxAngle: 175,
    safetyHardStopAngle: 180,
    compensationChecks: [
      {
        type: "hip_hiking",
        description: "Lifting the hip off the support surface",
        anchorJoints: ["LEFT_SHOULDER", "LEFT_HIP", "RIGHT_HIP"],
        thresholdAngle: 12,
        correctionPrompt: "Keep your hips firmly grounded.",
      },
    ],
    voicePrompts: {
      ready: "Position your leg side-on to the camera with a bolster under your knee. Straighten your lower leg fully.",
      goodRep: "Full extension achieved.",
      compensating: "Lift only your lower leg; keep your hips still.",
      safetyHalt: "Avoid hyperextending your knee.",
    },
  },
  {
    id: "side_lying_clamshell",
    name: "Side-Lying Clamshell",
    category: "Lower Extremity",
    clinicalSource: "APTA Patellofemoral Pain CPG",
    cameraSetup: "sagittal",
    primaryJoint: ["LEFT_ANKLE", "LEFT_HIP", "LEFT_KNEE"],
    baselineAngle: 0,
    targetMaxAngle: 40,
    safetyHardStopAngle: 50,
    compensationChecks: [
      {
        type: "pelvis_backward_rotation",
        description: "Rolling pelvis backward during knee lift",
        anchorJoints: ["LEFT_SHOULDER", "LEFT_HIP", "LEFT_KNEE"],
        thresholdAngle: 15,
        correctionPrompt: "Keep your pelvis stacked and facing forward.",
      },
    ],
    voicePrompts: {
      ready: "Lie on your side facing the camera. With knees bent, open the top knee while keeping your feet together.",
      goodRep: "Great glute activation.",
      compensating: "Do not roll your hips backward.",
      safetyHalt: "Maximum range reached. Slowly return.",
    },
  },
  {
    id: "hip_abduction_standing",
    name: "Standing Hip Abduction",
    category: "Lower Extremity",
    clinicalSource: "Ohio State Hip Rehab Guidelines",
    cameraSetup: "frontal",
    primaryJoint: ["RIGHT_HIP", "LEFT_HIP", "LEFT_ANKLE"],
    baselineAngle: 90,
    targetMaxAngle: 130,
    safetyHardStopAngle: 140,
    compensationChecks: [
      {
        type: "lateral_trunk_tilt",
        description: "Tilting torso laterally to compensate for leg height",
        anchorJoints: ["LEFT_SHOULDER", "LEFT_HIP", "RIGHT_HIP"],
        thresholdAngle: 10,
        correctionPrompt: "Keep your spine upright; do not lean sideways.",
      },
    ],
    voicePrompts: {
      ready: "Face the camera. Lift your leg out to the side with control.",
      goodRep: "Good core stabilization.",
      compensating: "Keep your torso vertical.",
      safetyHalt: "Target angle limit reached.",
    },
  },
  {
    id: "glute_bridge",
    name: "Glute Bridge",
    category: "Lower Extremity",
    clinicalSource: "APTA Low Back & Pelvic Health CPG",
    cameraSetup: "sagittal",
    primaryJoint: ["LEFT_SHOULDER", "LEFT_HIP", "LEFT_KNEE"],
    angleMeasurement: "bilateral_bridge",
    baselineAngle: 120,
    targetMaxAngle: 175,
    safetyHardStopAngle: 185,
    compensationChecks: [
      {
        type: "lumbar_hyperextension",
        description: "Excessive arching of the lower back",
        anchorJoints: ["LEFT_EAR", "LEFT_SHOULDER", "LEFT_HIP"],
        thresholdAngle: 15,
        correctionPrompt: "Drive through your glutes, do not hyperextend your lower back.",
      },
    ],
    voicePrompts: {
      ready: "Lie on your back with your body visible from the side. Lift your hips until aligned with your knees and shoulders.",
      goodRep: "Squeeze your glutes and lower with control.",
      compensating: "Engage your core to protect your lower back.",
      safetyHalt: "Avoid over-extending your spine.",
    },
  },
  {
    id: "wall_slides_squat",
    name: "Wall Slide / Mini Squat",
    category: "Lower Extremity",
    clinicalSource: "Mass General Meniscus Repair Guidelines",
    cameraSetup: "frontal",
    primaryJoint: ["LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"],
    baselineAngle: 180,
    // Shoulder-height forward flexion is the default rep target. A clinician
    // or uploaded prescription can override this value for a different ROM.
    targetMaxAngle: 90,
    safetyHardStopAngle: 110,
    compensationChecks: [
      {
        type: "knee_valgus",
        description: "Knees caving inward (dynamic valgus)",
        anchorJoints: ["LEFT_HIP", "LEFT_KNEE", "RIGHT_KNEE"],
        thresholdAngle: 12,
        correctionPrompt: "Keep your knees tracking over your toes.",
      },
    ],
    voicePrompts: {
      ready: "Lean against the wall and slide down into a controlled mini squat.",
      goodRep: "Target depth reached. Press back up.",
      compensating: "Do not let your knees collapse inward.",
      safetyHalt: "Do not exceed prescribed knee flexion.",
    },
  },
  {
    id: "calf_raises",
    name: "Standing Calf Raises",
    category: "Lower Extremity",
    clinicalSource: "APTA Achilles Tendinopathy Protocol",
    cameraSetup: "sagittal",
    primaryJoint: ["LEFT_KNEE", "LEFT_ANKLE", "LEFT_FOOT_INDEX"],
    baselineAngle: 90,
    targetMaxAngle: 120,
    safetyHardStopAngle: 130,
    compensationChecks: [
      {
        type: "ankle_inversion_eversion",
        description: "Ankle rolling inward or outward at the top",
        anchorJoints: ["LEFT_KNEE", "LEFT_HEEL", "LEFT_FOOT_INDEX"],
        thresholdAngle: 10,
        correctionPrompt: "Distribute weight evenly across the ball of your foot.",
      },
    ],
    voicePrompts: {
      ready: "Stand sideways to the camera. Rise onto your toes and pause briefly at the peak.",
      goodRep: "Clean calf contraction.",
      compensating: "Keep your ankles straight.",
      safetyHalt: "Lower your heels with control.",
    },
  },
  {
    id: "step_ups",
    name: "Step-Ups",
    category: "Lower Extremity",
    clinicalSource: "UW Health Lower Extremity Protocol",
    cameraSetup: "frontal",
    primaryJoint: ["LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"],
    baselineAngle: 180,
    targetMaxAngle: 120,
    safetyHardStopAngle: 100,
    compensationChecks: [
      {
        type: "pelvic_drop_trendelenburg",
        description: "Contralateral pelvic drop during single-leg support",
        anchorJoints: ["LEFT_SHOULDER", "LEFT_HIP", "RIGHT_HIP"],
        thresholdAngle: 10,
        correctionPrompt: "Keep your pelvis level as you step up.",
      },
    ],
    voicePrompts: {
      ready: "Step onto the platform and rise with an upright torso.",
      goodRep: "Balanced movement.",
      compensating: "Do not drop your opposite hip.",
      safetyHalt: "Maintain your balance.",
    },
  },
  {
    id: "ankle_dorsiflexion",
    name: "Seated Ankle Dorsiflexion",
    category: "Lower Extremity",
    clinicalSource: "AAOS Ankle Sprain Clinical Protocol",
    cameraSetup: "sagittal",
    primaryJoint: ["LEFT_KNEE", "LEFT_ANKLE", "LEFT_FOOT_INDEX"],
    baselineAngle: 90,
    targetMaxAngle: 110,
    safetyHardStopAngle: 120,
    compensationChecks: [
      {
        type: "knee_rotation",
        description: "Rotating the knee to simulate ankle pull",
        anchorJoints: ["LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"],
        thresholdAngle: 8,
        correctionPrompt: "Keep your leg stationary; pull from the ankle only.",
      },
    ],
    voicePrompts: {
      ready: "Sit or lie with your leg side-on to the camera. Pull your toes upward toward your shin.",
      goodRep: "Maximum dorsiflexion reached.",
      compensating: "Keep your knee still.",
      safetyHalt: "Do not overstrain the ankle.",
    },
  },

  // ==========================================
  // II. UPPER EXTREMITY (SHOULDER, ELBOW, NECK)
  // ==========================================
  {
    id: "shoulder_abduction",
    name: "Shoulder Abduction (Scapular Plane)",
    category: "Upper Extremity",
    clinicalSource: "AAOS Rotator Cuff Guideline",
    cameraSetup: "frontal",
    primaryJoint: ["LEFT_HIP", "LEFT_SHOULDER", "LEFT_ELBOW"],
    baselineAngle: 15,
    targetMaxAngle: 90,
    safetyHardStopAngle: 100,
    compensationChecks: [
      {
        type: "scapular_shrug",
        description: "Excessive shoulder hike/trapezius shrugging",
        anchorJoints: ["LEFT_EAR", "LEFT_SHOULDER", "RIGHT_SHOULDER"],
        thresholdAngle: 12,
        correctionPrompt: "Keep your shoulders down; avoid shrugging.",
      },
    ],
    voicePrompts: {
      ready: "Raise your arm outward to shoulder height.",
      goodRep: "Controlled movement. Slowly lower your arm.",
      compensating: "Keep your shoulder blade relaxed down.",
      safetyHalt: "Safety limit reached. Lower your arm slowly.",
    },
  },
  {
    id: "shoulder_forward_flexion",
    name: "Shoulder Forward Flexion",
    category: "Upper Extremity",
    clinicalSource: "Mass General Shoulder Rehab Guidelines",
    cameraSetup: "sagittal",
    primaryJoint: ["LEFT_HIP", "LEFT_SHOULDER", "LEFT_ELBOW"],
    baselineAngle: 15,
    targetMaxAngle: 120,
    safetyHardStopAngle: 140,
    compensationChecks: [
      {
        type: "lumbar_extension_lean",
        description: "Arching lower back backward to assist arm elevation",
        anchorJoints: ["LEFT_SHOULDER", "LEFT_HIP", "LEFT_KNEE"],
        thresholdAngle: 12,
        correctionPrompt: "Keep your spine neutral; do not lean backward.",
      },
    ],
    voicePrompts: {
      ready: "Turn sideways to the camera. Raise your arm straight forward to shoulder height, then return slowly.",
      goodRep: "Clean flexion angle.",
      compensating: "Do not arch your lower back.",
      safetyHalt: "Maximum safe ROM reached.",
    },
  },
  {
    id: "shoulder_external_rotation",
    name: "Shoulder External Rotation",
    category: "Upper Extremity",
    clinicalSource: "Mayo Clinic Rotator Cuff CPG",
    cameraSetup: "frontal",
    primaryJoint: ["LEFT_SHOULDER", "LEFT_ELBOW", "LEFT_WRIST"],
    angleMeasurement: "forearm_rotation",
    baselineAngle: 0,
    targetMaxAngle: 90,
    safetyHardStopAngle: 100,
    compensationChecks: [
      {
        type: "elbow_abduction",
        description: "Flaring elbow away from the torso",
        anchorJoints: ["LEFT_SHOULDER", "LEFT_ELBOW", "LEFT_HIP"],
        thresholdAngle: 10,
        correctionPrompt: "Keep your elbow pinned to your side.",
      },
    ],
    voicePrompts: {
      ready: "Elbow at 90 degrees; rotate your forearm outward.",
      goodRep: "Great external rotation.",
      compensating: "Do not let your elbow flare away from your ribcage.",
      safetyHalt: "Return to starting position without forcing.",
    },
  },
  {
    id: "codman_pendulum",
    name: "Pendulum (Codman) Exercise",
    category: "Upper Extremity",
    clinicalSource: "AAOS Frozen Shoulder Protocol",
    cameraSetup: "sagittal",
    primaryJoint: ["LEFT_HIP", "LEFT_SHOULDER", "LEFT_WRIST"],
    baselineAngle: 20,
    targetMaxAngle: 45,
    safetyHardStopAngle: 55,
    compensationChecks: [
      {
        type: "active_muscle_engagement",
        description: "Actively tensing arm muscles instead of passive momentum",
        anchorJoints: ["LEFT_EAR", "LEFT_SHOULDER", "LEFT_ELBOW"],
        thresholdAngle: 12,
        correctionPrompt: "Let your arm hang completely loose and let gravity move it.",
      },
    ],
    voicePrompts: {
      ready: "Stand or lean sideways to the camera. Relax your arm and let your body momentum create gentle circles.",
      goodRep: "Good passive swing.",
      compensating: "Relax your arm muscles completely.",
      safetyHalt: "Keep circles small and controlled.",
    },
  },
  {
    id: "wall_climb_shoulder",
    name: "Wall Climbs (Shoulder Walk)",
    category: "Upper Extremity",
    clinicalSource: "UW Health Adhesive Capsulitis Protocol",
    cameraSetup: "sagittal",
    primaryJoint: ["LEFT_HIP", "LEFT_SHOULDER", "LEFT_WRIST"],
    baselineAngle: 90,
    targetMaxAngle: 150,
    safetyHardStopAngle: 165,
    compensationChecks: [
      {
        type: "tiptoe_compensation",
        description: "Rising on toes to artificially reach higher",
        anchorJoints: ["LEFT_KNEE", "LEFT_ANKLE", "LEFT_FOOT_INDEX"],
        thresholdAngle: 15,
        correctionPrompt: "Keep both heels flat on the floor.",
      },
    ],
    voicePrompts: {
      ready: "Stand sideways to the camera beside the wall. Walk your fingers gently upward.",
      goodRep: "Target elevation reached.",
      compensating: "Do not rise onto your toes.",
      safetyHalt: "Hold at your pain-free limit.",
    },
  },
  {
    id: "elbow_flexion_extension",
    name: "Elbow Active ROM",
    category: "Upper Extremity",
    clinicalSource: "Mass General Distal Humerus Protocol",
    cameraSetup: "sagittal",
    primaryJoint: ["LEFT_SHOULDER", "LEFT_ELBOW", "LEFT_WRIST"],
    baselineAngle: 170,
    targetMaxAngle: 40,
    safetyHardStopAngle: 30,
    compensationChecks: [
      {
        type: "shoulder_flexion_cheat",
        description: "Lifting shoulder forward while bending elbow",
        anchorJoints: ["LEFT_HIP", "LEFT_SHOULDER", "LEFT_ELBOW"],
        thresholdAngle: 12,
        correctionPrompt: "Keep your upper arm stationary beside your ribs.",
      },
    ],
    voicePrompts: {
      ready: "Stand sideways to the camera. Bend your elbow to bring your hand toward your shoulder.",
      goodRep: "Full elbow flexion achieved.",
      compensating: "Keep your shoulder still.",
      safetyHalt: "Do not force; extend smoothly.",
    },
  },
  {
    id: "cervical_retraction",
    name: "Cervical Retraction (Chin Tuck)",
    category: "Upper Extremity",
    clinicalSource: "APTA Neck Pain Clinical Practice Guidelines",
    cameraSetup: "sagittal",
    primaryJoint: ["NOSE", "LEFT_EAR", "LEFT_SHOULDER"],
    angleMeasurement: "cervical_retraction",
    baselineAngle: 90,
    targetMaxAngle: 80,
    safetyHardStopAngle: 70,
    compensationChecks: [
      {
        type: "neck_flexion_downward",
        description: "Tilting head downward instead of retracting straight back",
        anchorJoints: ["LEFT_EYE", "NOSE", "MOUTH_LEFT"],
        thresholdAngle: 10,
        correctionPrompt: "Look straight ahead; glide your head directly backward.",
      },
    ],
    voicePrompts: {
      ready: "Sit or stand sideways to the camera. Keep your gaze forward and glide your chin straight back.",
      goodRep: "Proper cervical alignment held.",
      compensating: "Do not look down; glide backward horizontally.",
      safetyHalt: "Avoid excessive neck pressure.",
    },
  },

  // ==========================================
  // III. SPINE, BACK & CORE STABILIZATION
  // ==========================================
  {
    id: "bird_dog",
    name: "Bird-Dog (Contralateral Extension)",
    category: "Spine & Core",
    clinicalSource: "McGill Core Stability / APTA Spine CPG",
    cameraSetup: "sagittal",
    primaryJoint: ["LEFT_WRIST", "LEFT_SHOULDER", "RIGHT_ANKLE"],
    angleMeasurement: "bird_dog_alignment",
    baselineAngle: 90,
    targetMaxAngle: 180,
    safetyHardStopAngle: 190,
    compensationChecks: [
      {
        type: "pelvic_rotation",
        description: "Rotating hips/pelvis sideways",
        anchorJoints: ["LEFT_SHOULDER", "LEFT_HIP", "RIGHT_HIP"],
        thresholdAngle: 12,
        correctionPrompt: "Keep your hips level and parallel to the floor.",
      },
    ],
    voicePrompts: {
      ready: "Position yourself side-on to the camera on all fours. Extend the opposite arm and leg simultaneously.",
      goodRep: "Excellent spinal stability.",
      compensating: "Keep your hips level.",
      safetyHalt: "Do not over-lift beyond horizontal.",
    },
  },
  {
    id: "cat_camel",
    name: "Cat-Camel (Thoracic Mobility)",
    category: "Spine & Core",
    clinicalSource: "AAOS Low Back Pain Rehabilitation",
    cameraSetup: "sagittal",
    primaryJoint: ["LEFT_SHOULDER", "LEFT_HIP", "LEFT_KNEE"],
    // Directed head/neck/hip angle. With the camera pose, the usable range is
    // typically about 130–190°, so the target must remain reachable.
    baselineAngle: 135,
    targetMaxAngle: 185,
    safetyHardStopAngle: 210,
    compensationChecks: [
      {
        type: "elbow_flexion_lead",
        description: "Bending elbows instead of moving through the spine",
        anchorJoints: ["LEFT_SHOULDER", "LEFT_ELBOW", "LEFT_WRIST"],
        thresholdAngle: 15,
        correctionPrompt: "Keep your arms locked straight; move from your spine.",
      },
    ],
    voicePrompts: {
      ready: "Position yourself side-on to the camera on all fours. Round your back toward the ceiling, then gently arch downward.",
      goodRep: "Smooth spinal articulation.",
      compensating: "Keep your arms straight.",
      safetyHalt: "Stay within your comfortable range.",
    },
  },
  {
    id: "side_plank_modified",
    name: "Side Plank (Knee Supported)",
    category: "Spine & Core",
    clinicalSource: "APTA Spine Rehabilitation Protocol",
    cameraSetup: "sagittal",
    primaryJoint: ["LEFT_SHOULDER", "LEFT_HIP", "LEFT_KNEE"],
    baselineAngle: 150,
    targetMaxAngle: 170,
    safetyHardStopAngle: 185,
    compensationChecks: [
      {
        type: "pelvis_sagging",
        description: "Hips sagging toward the floor",
        anchorJoints: ["LEFT_SHOULDER", "LEFT_HIP", "LEFT_KNEE"],
        thresholdAngle: 15,
        correctionPrompt: "Elevate your hips to maintain a straight diagonal line.",
      },
    ],
    voicePrompts: {
      ready: "Prop on your elbow and raise hips to form a straight line.",
      goodRep: "Strong lateral core hold.",
      compensating: "Do not let your hips sag downward.",
      safetyHalt: "Hold completed. Lower with control.",
    },
  },
];

// Stable public name consumed by the selector and state engine.
// Keep TOP_20_CLINICAL_PROTOCOLS as the source so additional protocols can be
// added without changing the UI contract.
export const CLINICAL_PROTOCOLS: ExerciseProtocol[] = TOP_20_CLINICAL_PROTOCOLS;

export function getClinicalProtocol(protocolId: string): ExerciseProtocol | undefined {
  return CLINICAL_PROTOCOLS.find((protocol) => protocol.id === protocolId);
}

export function getProtocolMovementDirection(protocol: ExerciseProtocol): "decreasing" | "increasing" {
  return protocol.movementDirection ?? (protocol.targetMaxAngle < protocol.baselineAngle ? "decreasing" : "increasing");
}

export function getProtocolsByCategory(category: ExerciseProtocol["category"]): ExerciseProtocol[] {
  return CLINICAL_PROTOCOLS.filter((protocol) => protocol.category === category);
}

export type TrackedSide = "Left" | "Right" | "Bilateral";

export function getProtocolTrackedSide(protocol: ExerciseProtocol): TrackedSide {
  if (["bird_dog", "glute_bridge", "cat_camel"].includes(protocol.id)) return "Bilateral";
  // The center joint is the vertex used for the measured angle. Other points
  // may intentionally belong to the opposite side (for example, a hip
  // abduction check), so they must not disable laterality selection.
  const centerPoint = protocol.primaryJoint[1] || "";
  if (centerPoint.startsWith("RIGHT_")) return "Right";
  if (centerPoint.startsWith("LEFT_")) return "Left";
  return "Bilateral";
}

export function protocolSupportsSideSelection(protocol: ExerciseProtocol): boolean {
  return getProtocolTrackedSide(protocol) !== "Bilateral" && protocol.primaryJoint.some((joint) => joint.startsWith("LEFT_") || joint.startsWith("RIGHT_"));
}

/** Remaps all left/right landmarks, including contralateral compensation anchors. */
export function remapProtocolSide(protocol: ExerciseProtocol, side: "Left" | "Right"): ExerciseProtocol {
  const current = getProtocolTrackedSide(protocol);
  if (current === "Bilateral" || current === side) return protocol;
  const swap = (joint: string) => joint.replace(/^LEFT_/, "__RIGHT__").replace(/^RIGHT_/, "LEFT_").replace(/^__RIGHT__/, "RIGHT_");
  return {
    ...protocol,
    primaryJoint: protocol.primaryJoint.map(swap) as ExerciseProtocol["primaryJoint"],
    compensationChecks: protocol.compensationChecks.map((check) => ({ ...check, anchorJoints: check.anchorJoints.map(swap) as [string, string, string] })),
  };
}
