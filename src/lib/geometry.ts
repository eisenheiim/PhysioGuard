/** Pose point accepted from MediaPipe or a normalized application adapter. */
export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D extends Point2D {
  z: number;
}

export type Vector3D = Point3D;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Returns the angle ABC in degrees, always in the range 0..180. */
export function calculateAngle(pointA: Point2D, pointB: Point2D, pointC: Point2D): number {
  const ab = { x: pointA.x - pointB.x, y: pointA.y - pointB.y };
  const cb = { x: pointC.x - pointB.x, y: pointC.y - pointB.y };
  const denominator = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (denominator === 0) return NaN;
  return (Math.acos(clamp((ab.x * cb.x + ab.y * cb.y) / denominator, -1, 1)) * 180) / Math.PI;
}

export function calculateAngle3D(pointA: Point3D, pointB: Point3D, pointC: Point3D): number {
  const ab = { x: pointA.x - pointB.x, y: pointA.y - pointB.y, z: pointA.z - pointB.z };
  const cb = { x: pointC.x - pointB.x, y: pointC.y - pointB.y, z: pointC.z - pointB.z };
  const denominator = Math.hypot(ab.x, ab.y, ab.z) * Math.hypot(cb.x, cb.y, cb.z);
  if (denominator === 0) return NaN;
  return (Math.acos(clamp((ab.x * cb.x + ab.y * cb.y + ab.z * cb.z) / denominator, -1, 1)) * 180) / Math.PI;
}

/** Signed angle from vector A to B, useful for tilt direction and asymmetry. */
export function signedAngleDegrees(vectorA: Point2D, vectorB: Point2D): number {
  const cross = vectorA.x * vectorB.y - vectorA.y * vectorB.x;
  const dot = vectorA.x * vectorB.x + vectorA.y * vectorB.y;
  return (Math.atan2(cross, dot) * 180) / Math.PI;
}

export function distance2D(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function verticalAlignmentAngle(point: Point2D, reference: Point2D): number {
  return Math.abs(signedAngleDegrees({ x: 0, y: -1 }, { x: point.x - reference.x, y: point.y - reference.y }));
}

export function calculateVelocity(previousAngle: number, currentAngle: number, deltaMs: number): number {
  if (!Number.isFinite(previousAngle) || !Number.isFinite(currentAngle) || deltaMs <= 0) return NaN;
  return Math.abs(currentAngle - previousAngle) / (deltaMs / 1000);
}
