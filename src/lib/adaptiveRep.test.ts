import { describe, expect, it } from "vitest";
import { getClinicalProtocol } from "../data/protocols";
import { ProtocolExerciseStateMachine } from "./exerciseStateMachine";

describe("adaptive rep baseline", () => {
  it("counts heel slides when raw camera extension is around 160 degrees", () => {
    const machine = new ProtocolExerciseStateMachine(getClinicalProtocol("heel_slides")!);
    const landmarks = {
      LEFT_HIP: { x: 0.5, y: 0.3, visibility: 0.95 },
      LEFT_KNEE: { x: 0.5, y: 0.55, visibility: 0.95 },
      LEFT_ANKLE: { x: 0.5, y: 0.85, visibility: 0.95 },
    };
    // Raw included angle 160° is normalized to 20° of clinical knee flexion.
    for (let index = 0; index < 12; index += 1) machine.update(landmarks, 20, index * 80);
    machine.update(landmarks, 90, 2000);
    machine.update(landmarks, 90, 2100);
    machine.update(landmarks, 90, 2200);
    machine.update(landmarks, 90, 2300);
    machine.update(landmarks, 90, 2400);
    machine.update(landmarks, 90, 2500);
    machine.update(landmarks, 90, 2600);
    machine.update(landmarks, 60, 2900);
    const result = machine.update(landmarks, 20, 3300);
    expect(result.completedRep).toBe(true);
    expect(result.state.repetitionCount).toBe(1);
  });
});
