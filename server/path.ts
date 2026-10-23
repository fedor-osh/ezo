// Downsampled record of where a visitor's pointer went, for the ghost trail of their trace.
import { MAX_TRACE_PATH, type Vec3 } from "../src/shared/protocol.ts";

export const PATH_INTERVAL_MS = 400;
export const PATH_MIN_STEP = 0.15;

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export class PathRecorder {
  /** Kept points, oldest first, at most MAX_TRACE_PATH. */
  readonly points: Vec3[] = [];
  /** Total distance moved across every reported position, not just kept ones. */
  travelled = 0;
  private lastKeptAt = -Infinity;
  private prev: Vec3 | null = null;

  add(p: Vec3, now: number): void {
    if (this.prev) this.travelled += dist(this.prev, p);
    this.prev = p;
    const last = this.points[this.points.length - 1];
    if (last && (now - this.lastKeptAt < PATH_INTERVAL_MS || dist(last, p) <= PATH_MIN_STEP)) return;
    this.points.push(p);
    this.lastKeptAt = now;
    if (this.points.length > MAX_TRACE_PATH) this.points.splice(0, this.points.length - MAX_TRACE_PATH);
  }
}
