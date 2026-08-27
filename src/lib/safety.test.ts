import { describe, expect, it } from "vitest";
import { getClinicalProtocol } from "../data/protocols";
import { evaluateProtocolSafety, isSafetyLimitBreached } from "./safety";

describe("protocol safety direction", () => {
  it("halts knee flexion when the decreasing angle reaches the paper limit", () => {
    const protocol = getClinicalProtocol("heel_slides")!;
    expect(isSafetyLimitBreached(protocol, 99)).toBe(false);
    expect(isSafetyLimitBreached(protocol, 100)).toBe(true);
    expect(isSafetyLimitBreached(protocol, 120)).toBe(true);
  });

  it("halts shoulder elevation when the increasing angle reaches the paper limit", () => {
    const protocol = getClinicalProtocol("shoulder_forward_flexion")!;
    expect(isSafetyLimitBreached(protocol, 140)).toBe(true);
    expect(isSafetyLimitBreached(protocol, 90)).toBe(false);
  });

  it("treats straight leg raise as a decreasing-angle exercise", () => {
    const protocol = getClinicalProtocol("straight_leg_raise")!;
    expect(isSafetyLimitBreached(protocol, 80)).toBe(false);
    expect(isSafetyLimitBreached(protocol, 60)).toBe(true);
  });

  it("flags a configured compensation without treating missing secondary anchors as a halt", () => {
    const protocol = getClinicalProtocol("shoulder_forward_flexion")!;
    const result = evaluateProtocolSafety({
      protocol,
      angle: 80,
      landmarks: {
        LEFT_HIP: { x: 0.5, y: 0.7, visibility: 0.95 },
        LEFT_SHOULDER: { x: 0.5, y: 0.4, visibility: 0.95 },
        LEFT_ELBOW: { x: 0.8, y: 0.4, visibility: 0.95 },
      },
    });
    expect(result.shouldHalt).toBe(false);
    expect(result.averageConfidence).toBeGreaterThan(0.9);
  });
});
