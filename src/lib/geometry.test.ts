import { describe, expect, it } from "vitest";
import { calculateAngle, calculateAngle3D } from "./geometry";

describe("geometry", () => {
  it("calculates a right angle", () => expect(calculateAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90));
  it("calculates a 3D right angle", () => expect(calculateAngle3D({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })).toBeCloseTo(90));
  it("returns NaN for a collapsed joint", () => expect(Number.isNaN(calculateAngle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }))).toBe(true));
});
