import { describe, expect, it } from "vitest";
import { getClinicalProtocol } from "../data/protocols";
import { ProtocolExerciseStateMachine } from "./exerciseStateMachine";

describe("ProtocolExerciseStateMachine", () => {
  it("counts a shoulder target-and-return movement", () => {
    const machine = new ProtocolExerciseStateMachine(getClinicalProtocol("shoulder_forward_flexion")!);
    const targetAngle = getClinicalProtocol("shoulder_forward_flexion")!.targetMaxAngle;
    const landmarks = {
      LEFT_HIP: { x: 0.5, y: 0.7, visibility: 0.95 },
      LEFT_SHOULDER: { x: 0.5, y: 0.4, visibility: 0.95 },
      LEFT_ELBOW: { x: 0.8, y: 0.4, visibility: 0.95 },
    };
    for (let index = 0; index < 12; index += 1) machine.update(landmarks, 15, index * 80);
    machine.update(landmarks, targetAngle, 2000);
    machine.update(landmarks, targetAngle, 2100);
    machine.update(landmarks, targetAngle, 2200);
    machine.update(landmarks, targetAngle, 2300);
    machine.update(landmarks, targetAngle, 2400);
    machine.update(landmarks, targetAngle, 2500);
    machine.update(landmarks, targetAngle, 2600);
    machine.update(landmarks, 80, 2900);
    const result = machine.update(landmarks, 15, 3300);
    expect(result.completedRep).toBe(true);
    expect(result.state.repetitionCount).toBe(1);
  });
});
