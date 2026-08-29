import { describe, it, expect } from "vitest";
import { ProtocolExerciseStateMachine } from "./exerciseStateMachine";
import type { ExerciseProtocol } from "../data/protocols";

const baseProtocol: ExerciseProtocol = {
  id: "test_flexion",
  name: "Test Flexion",
  category: "Lower Extremity",
  clinicalSource: "Unit Test",
  cameraSetup: "sagittal",
  primaryJoint: ["LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"],
  angleTransform: "flexion",
  baselineAngle: 0,
  targetMaxAngle: 90,
  safetyHardStopAngle: 100,
  compensationChecks: [],
  voicePrompts: { ready: "ready", goodRep: "good", compensating: "comp", safetyHalt: "halt" },
};

function landmarks(conf=0.99) {
  return {
    LEFT_HIP: { x: 0.4, y: 0.5, visibility: conf },
    LEFT_KNEE: { x: 0.5, y: 0.6, visibility: conf },
    LEFT_ANKLE: { x: 0.6, y: 0.7, visibility: conf },
  } as any;
}

describe("ProtocolExerciseStateMachine", () => {
  it("measures baseline then completes a rep with target hold and return", () => {
    const sm = new ProtocolExerciseStateMachine(baseProtocol);
    // Feed enough baseline frames at angle ~0
    for (let i=0;i<12;i++) sm.update(landmarks(), 0, 1000+i*16);
    const s1 = sm.getState();
    expect(s1.baselineReady).toBe(true);
    // Move toward target and reach it
    let ts = 1000 + 12*16;
    for (let a=10; a<=90; a+=10) { ts+=100; sm.update(landmarks(), a, ts); }
    // Hold ~600ms at target
    for (let k=0;k<6;k++) { ts+=100; sm.update(landmarks(), 90, ts); }
    // Return to baseline
    for (let a=80; a>=0; a-=20) { ts+=120; const r = sm.update(landmarks(), a, ts); if (r.completedRep) break; }
    const s2 = sm.getState();
    expect(s2.repetitionCount).toBe(1);
    expect(s2.phase).toBe("START");
  });

  it("halts when safety limit reached", () => {
    const sm = new ProtocolExerciseStateMachine(baseProtocol);
    for (let i=0;i<12;i++) sm.update(landmarks(), 0, 1000+i*16);
    const res = sm.update(landmarks(), 110, 2000);
    expect(res.safety.shouldHalt).toBe(true);
  });

  it("flags velocity spike", () => {
    const sm = new ProtocolExerciseStateMachine(baseProtocol);
    for (let i=0;i<12;i++) sm.update(landmarks(), 0, 1000+i*16);
    // Jump angle quickly within small delta to trigger velocity>360
    const r1 = sm.update(landmarks(), 0, 2000);
    const r2 = sm.update(landmarks(), 100, 2005);
    expect(r2.safety.reasons.join(" ")).toMatch(/velocity/i);
  });
});
