import type { PoseLandmark, PoseLandmarks } from "./calibration";

export interface LandmarkFilterOptions {
  alpha?: number;
  minVisibility?: number;
  requiredStableFrames?: number;
}

/**
 * Smooths landmark motion while keeping raw visibility separate. A point is
 * not marked usable until it has been confidently detected for consecutive
 * frames, which prevents one-frame hallucinations from affecting ROM math.
 */
export class LandmarkFilter {
  private readonly alpha: number;
  private readonly minVisibility: number;
  private readonly requiredStableFrames: number;
  private previous: PoseLandmarks = {};
  private stableFrames = new Map<string, number>();

  constructor(options: LandmarkFilterOptions = {}) {
    this.alpha = options.alpha ?? 0.5;
    this.minVisibility = options.minVisibility ?? 0.65;
    this.requiredStableFrames = options.requiredStableFrames ?? 3;
  }

  update(current: PoseLandmarks): PoseLandmarks {
    const names = new Set([...Object.keys(this.previous), ...Object.keys(current)]);
    const next: PoseLandmarks = {};

    for (const name of names) {
      const point = current[name];
      const previous = this.previous[name];
      const visibility = point?.visibility ?? 0;
      const confidentlyVisible = Boolean(point && visibility >= this.minVisibility);
      const stableCount = confidentlyVisible
        ? (this.stableFrames.get(name) ?? 0) + 1
        : 0;
      this.stableFrames.set(name, stableCount);

      // Keep the last coordinate for visual continuity, but expose zero
      // visibility so calibration/safety logic will not use an unstable point.
      if (!point) {
        if (previous) next[name] = { ...previous, visibility: 0 };
        continue;
      }

      const smoothed: PoseLandmark = previous
        ? {
            x: previous.x * (1 - this.alpha) + point.x * this.alpha,
            y: previous.y * (1 - this.alpha) + point.y * this.alpha,
            z: previous.z === undefined || point.z === undefined
              ? point.z
              : previous.z * (1 - this.alpha) + point.z * this.alpha,
            visibility,
          }
        : { ...point, visibility };

      next[name] = {
        ...smoothed,
        visibility: stableCount >= this.requiredStableFrames ? visibility : 0,
      };
    }

    this.previous = next;
    return next;
  }

  reset() {
    this.previous = {};
    this.stableFrames.clear();
  }
}
