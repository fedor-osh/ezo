// Pure position-based Verlet cloth. No three.js in here so it can be unit-tested in node.
//
// Particles form a cols × rows grid (u across, v down). An optional mask removes grid cells so
// the same solver can make shirts, trousers and socks. Particles outside every active cell are
// "dead": they are not simulated and simply shadow their nearest live neighbour, which keeps
// bounding volumes tight without compacting the arrays.

export type Vec3 = [number, number, number];
export type WindFn = (x: number, y: number, z: number, out: Vec3) => void;

export interface ClothGridSpec {
  cols: number;
  rows: number;
  /** Nominal size in metres; rest lengths come from it, not from the initial placement. */
  width: number;
  height: number;
  /** Initial world position of particle (col, row). */
  place(col: number, row: number, out: Vec3): void;
  /** Is the grid cell whose centre is at (cu, cv) ∈ [0, 1]² part of the cloth? Default: all. */
  mask?(cu: number, cv: number): boolean;
  /** Top-row columns held by clothespins. */
  pins: number[];
  /** Areal density, kg/m². */
  density?: number;
}

export interface StepParams {
  gravity: number;
  /** Velocity damping per second (exponential). */
  damping: number;
  iterations: number;
  /** Aerodynamic coefficient: force = aero · area · (relative wind · n) · n. */
  aero: number;
  wind: WindFn;
  /** Hard safety caps so nothing can ever explode. */
  maxSpeed: number;
  maxAccel: number;
}

export const DEFAULT_STEP: Omit<StepParams, "wind"> = {
  gravity: 9.81,
  damping: 1.4,
  iterations: 6,
  aero: 1.1,
  maxSpeed: 10,
  maxAccel: 80,
};

const STIFF_STRUCT = 1;
const STIFF_SHEAR = 0.55;
const STIFF_BEND = 0.12;

export class VerletCloth {
  readonly cols: number;
  readonly rows: number;
  readonly count: number;
  readonly pos: Float32Array;
  readonly prev: Float32Array;
  /** External accelerations for the coming steps (hover lift, wiggle…). Caller clears it. */
  readonly push: Float32Array;
  readonly invMass: Float32Array;
  readonly live: Uint8Array;
  readonly indices: Uint32Array;

  private readonly rest0: Float32Array;
  private readonly acc: Float32Array;
  private readonly pinned: number[] = [];
  private readonly pinPos: Float32Array;
  private readonly cA: Uint32Array;
  private readonly cB: Uint32Array;
  private readonly cRest: Float32Array;
  private readonly cStiff: Float32Array;
  /** Dead particle → live particle it shadows. */
  private readonly shadow: Array<[number, number]> = [];
  private readonly tmp: Vec3 = [0, 0, 0];

  constructor(spec: ClothGridSpec) {
    const { cols, rows } = spec;
    this.cols = cols;
    this.rows = rows;
    const n = (this.count = cols * rows);
    this.pos = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.push = new Float32Array(n * 3);
    this.acc = new Float32Array(n * 3);
    this.invMass = new Float32Array(n);
    this.live = new Uint8Array(n);

    const p: Vec3 = [0, 0, 0];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        spec.place(i, j, p);
        const k = (j * cols + i) * 3;
        this.pos[k] = p[0];
        this.pos[k + 1] = p[1];
        this.pos[k + 2] = p[2];
      }
    }
    this.prev.set(this.pos);
    this.rest0 = this.pos.slice();

    // Active cells → triangles + live particles.
    const cellOn = new Uint8Array((cols - 1) * (rows - 1));
    const tris: number[] = [];
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const on = spec.mask ? spec.mask((i + 0.5) / (cols - 1), (j + 0.5) / (rows - 1)) : true;
        if (!on) continue;
        cellOn[j * (cols - 1) + i] = 1;
        const a = j * cols + i;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        // Winding so the front face looks along right × down... i.e. toward the viewer for a
        // cloth whose u runs to the viewer's right.
        tris.push(a, c, b, b, c, d);
        this.live[a] = this.live[b] = this.live[c] = this.live[d] = 1;
      }
    }
    this.indices = new Uint32Array(tris);

    const dx = spec.width / (cols - 1);
    const dy = spec.height / (rows - 1);
    const diag = Math.hypot(dx, dy);
    const ca: number[] = [];
    const cb: number[] = [];
    const cr: number[] = [];
    const cs: number[] = [];
    const seen = new Set<number>();
    const add = (a: number, b: number, rest: number, stiff: number) => {
      const key = a < b ? a * n + b : b * n + a;
      if (seen.has(key)) return;
      seen.add(key);
      ca.push(a);
      cb.push(b);
      cr.push(rest);
      cs.push(stiff);
    };
    const cell = (i: number, j: number) => i >= 0 && j >= 0 && i < cols - 1 && j < rows - 1 && cellOn[j * (cols - 1) + i] === 1;
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        if (!cell(i, j)) continue;
        const a = j * cols + i;
        add(a, a + 1, dx, STIFF_STRUCT);
        add(a + cols, a + cols + 1, dx, STIFF_STRUCT);
        add(a, a + cols, dy, STIFF_STRUCT);
        add(a + 1, a + cols + 1, dy, STIFF_STRUCT);
        add(a, a + cols + 1, diag, STIFF_SHEAR);
        add(a + 1, a + cols, diag, STIFF_SHEAR);
        // Light bending: skip-one springs across two neighbouring active cells.
        if (cell(i + 1, j)) {
          add(a, a + 2, dx * 2, STIFF_BEND);
          add(a + cols, a + cols + 2, dx * 2, STIFF_BEND);
        }
        if (cell(i, j + 1)) {
          add(a, a + cols * 2, dy * 2, STIFF_BEND);
          add(a + 1, a + 1 + cols * 2, dy * 2, STIFF_BEND);
        }
      }
    }
    this.cA = new Uint32Array(ca);
    this.cB = new Uint32Array(cb);
    this.cRest = new Float32Array(cr);
    this.cStiff = new Float32Array(cs);

    let liveCount = 0;
    for (let k = 0; k < n; k++) liveCount += this.live[k];
    const mass = ((spec.density ?? 0.2) * spec.width * spec.height) / Math.max(1, liveCount);
    for (let k = 0; k < n; k++) this.invMass[k] = this.live[k] ? 1 / mass : 0;

    this.pinPos = new Float32Array(spec.pins.length * 3);
    spec.pins.forEach((col, idx) => {
      const k = Math.max(0, Math.min(cols - 1, Math.round(col)));
      if (!this.live[k]) return;
      this.pinned.push(k);
      this.invMass[k] = 0;
      this.pinPos.set(this.pos.subarray(k * 3, k * 3 + 3), idx * 3);
    });

    for (let k = 0; k < n; k++) {
      if (this.live[k]) continue;
      const i0 = k % cols;
      const j0 = (k / cols) | 0;
      let best = -1;
      let bestD = Infinity;
      for (let m = 0; m < n; m++) {
        if (!this.live[m]) continue;
        const d = Math.abs((m % cols) - i0) + Math.abs(((m / cols) | 0) - j0);
        if (d < bestD) {
          bestD = d;
          best = m;
        }
      }
      if (best >= 0) this.shadow.push([k, best]);
    }
  }

  /** Indices of pinned particles. */
  get pins(): readonly number[] {
    return this.pinned;
  }

  /** Back to the initial placement, at rest. */
  reset(): void {
    this.pos.set(this.rest0);
    this.prev.set(this.rest0);
    this.push.fill(0);
  }

  clearPush(): void {
    this.push.fill(0);
  }

  step(dt: number, params: StepParams): void {
    const { pos, prev, acc, push, invMass, live } = this;
    const n = this.count;
    const g = params.gravity;

    for (let k = 0; k < n; k++) {
      const o = k * 3;
      acc[o] = push[o];
      acc[o + 1] = push[o + 1] - g;
      acc[o + 2] = push[o + 2];
    }

    this.aerodynamics(dt, params);

    const damp = Math.exp(-params.damping * dt);
    const maxV = params.maxSpeed * dt;
    const maxA = params.maxAccel;
    const dt2 = dt * dt;
    for (let k = 0; k < n; k++) {
      if (!live[k] || invMass[k] === 0) continue;
      const o = k * 3;
      let ax = acc[o];
      let ay = acc[o + 1];
      let az = acc[o + 2];
      const al = Math.hypot(ax, ay, az);
      if (al > maxA) {
        const s = maxA / al;
        ax *= s;
        ay *= s;
        az *= s;
      }
      let vx = (pos[o] - prev[o]) * damp;
      let vy = (pos[o + 1] - prev[o + 1]) * damp;
      let vz = (pos[o + 2] - prev[o + 2]) * damp;
      const vl = Math.hypot(vx, vy, vz);
      if (vl > maxV) {
        const s = maxV / vl;
        vx *= s;
        vy *= s;
        vz *= s;
      }
      prev[o] = pos[o];
      prev[o + 1] = pos[o + 1];
      prev[o + 2] = pos[o + 2];
      pos[o] += vx + ax * dt2;
      pos[o + 1] += vy + ay * dt2;
      pos[o + 2] += vz + az * dt2;
    }

    this.solve(params.iterations);
    this.finish();
  }

  /** Add velocity (m/s) around surface coords (u, v), Gaussian falloff of `radius` in uv units. */
  addVelocityAt(u: number, v: number, radius: number, vx: number, vy: number, vz: number, dt: number): void {
    this.forEachNear(u, v, radius, (o, w) => {
      this.prev[o] -= vx * w * dt;
      this.prev[o + 1] -= vy * w * dt;
      this.prev[o + 2] -= vz * w * dt;
    });
  }

  /** Accumulate an acceleration (m/s²) into `push` around (u, v). */
  pushAt(u: number, v: number, radius: number, ax: number, ay: number, az: number): void {
    this.forEachNear(u, v, radius, (o, w) => {
      this.push[o] += ax * w;
      this.push[o + 1] += ay * w;
      this.push[o + 2] += az * w;
    });
  }

  /**
   * Bilinear point at surface coords (u, v ∈ [0, 1], v = 0 at the top) and the front-facing
   * normal there.
   */
  sample(u: number, v: number, outP: Vec3, outN?: Vec3): void {
    const { cols, rows, pos } = this;
    const fx = clamp01(u) * (cols - 1);
    const fy = clamp01(v) * (rows - 1);
    const i = Math.min(cols - 2, Math.floor(fx));
    const j = Math.min(rows - 2, Math.floor(fy));
    const tx = fx - i;
    const ty = fy - j;
    const a = (j * cols + i) * 3;
    const b = a + 3;
    const c = a + cols * 3;
    const d = c + 3;
    for (let e = 0; e < 3; e++) {
      const top = pos[a + e] + (pos[b + e] - pos[a + e]) * tx;
      const bot = pos[c + e] + (pos[d + e] - pos[c + e]) * tx;
      outP[e] = top + (bot - top) * ty;
    }
    if (!outN) return;
    // du = right, dv = down; front normal = dv × du.
    const ux = pos[b] - pos[a] + pos[d] - pos[c];
    const uy = pos[b + 1] - pos[a + 1] + pos[d + 1] - pos[c + 1];
    const uz = pos[b + 2] - pos[a + 2] + pos[d + 2] - pos[c + 2];
    const vx = pos[c] - pos[a] + pos[d] - pos[b];
    const vy = pos[c + 1] - pos[a + 1] + pos[d + 1] - pos[b + 1];
    const vz = pos[c + 2] - pos[a + 2] + pos[d + 2] - pos[b + 2];
    let nx = vy * uz - vz * uy;
    let ny = vz * ux - vx * uz;
    let nz = vx * uy - vy * ux;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    outN[0] = nx;
    outN[1] = ny;
    outN[2] = nz;
  }

  /** Is every coordinate finite? */
  isFinite(): boolean {
    const p = this.pos;
    for (let k = 0; k < p.length; k++) if (!Number.isFinite(p[k])) return false;
    return true;
  }

  private aerodynamics(dt: number, params: StepParams): void {
    const { pos, prev, acc, invMass, indices } = this;
    const w = this.tmp;
    const inv3dt = 1 / (3 * dt);
    const k = params.aero * 0.5;
    for (let t = 0; t < indices.length; t += 3) {
      const a = indices[t] * 3;
      const b = indices[t + 1] * 3;
      const c = indices[t + 2] * 3;
      const e1x = pos[b] - pos[a];
      const e1y = pos[b + 1] - pos[a + 1];
      const e1z = pos[b + 2] - pos[a + 2];
      const e2x = pos[c] - pos[a];
      const e2y = pos[c + 1] - pos[a + 1];
      const e2z = pos[c + 2] - pos[a + 2];
      // n = e1 × e2, |n| = 2 · area.
      const nx = e1y * e2z - e1z * e2y;
      const ny = e1z * e2x - e1x * e2z;
      const nz = e1x * e2y - e1y * e2x;
      const nl = Math.hypot(nx, ny, nz);
      if (nl < 1e-10) continue;
      params.wind((pos[a] + pos[b] + pos[c]) / 3, (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3, (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3, w);
      const rx = w[0] - (pos[a] - prev[a] + pos[b] - prev[b] + pos[c] - prev[c]) * inv3dt;
      const ry = w[1] - (pos[a + 1] - prev[a + 1] + pos[b + 1] - prev[b + 1] + pos[c + 1] - prev[c + 1]) * inv3dt;
      const rz = w[2] - (pos[a + 2] - prev[a + 2] + pos[b + 2] - prev[b + 2] + pos[c + 2] - prev[c + 2]) * inv3dt;
      // force = aero · area · (rel · n̂) n̂ = aero · 0.5 · (rel · n / |n|) · n
      const s = (k * (rx * nx + ry * ny + rz * nz)) / nl / 3;
      const fx = s * nx;
      const fy = s * ny;
      const fz = s * nz;
      for (let q = 0; q < 3; q++) {
        const o = q === 0 ? a : q === 1 ? b : c;
        const im = invMass[o / 3];
        acc[o] += fx * im;
        acc[o + 1] += fy * im;
        acc[o + 2] += fz * im;
      }
    }
  }

  private solve(iterations: number): void {
    const { pos, invMass, cA, cB, cRest, cStiff } = this;
    const m = cA.length;
    for (let it = 0; it < iterations; it++) {
      for (let c = 0; c < m; c++) {
        const a = cA[c];
        const b = cB[c];
        const wa = invMass[a];
        const wb = invMass[b];
        const ws = wa + wb;
        if (ws === 0) continue;
        const oa = a * 3;
        const ob = b * 3;
        const dx = pos[ob] - pos[oa];
        const dy = pos[ob + 1] - pos[oa + 1];
        const dz = pos[ob + 2] - pos[oa + 2];
        const d = Math.hypot(dx, dy, dz);
        if (d < 1e-9) continue;
        const s = (cStiff[c] * (d - cRest[c])) / (d * ws);
        pos[oa] += dx * s * wa;
        pos[oa + 1] += dy * s * wa;
        pos[oa + 2] += dz * s * wa;
        pos[ob] -= dx * s * wb;
        pos[ob + 1] -= dy * s * wb;
        pos[ob + 2] -= dz * s * wb;
      }
      this.holdPins();
    }
  }

  private holdPins(): void {
    const { pos, prev, pinPos } = this;
    this.pinned.forEach((k, idx) => {
      const o = k * 3;
      const q = idx * 3;
      pos[o] = prev[o] = pinPos[q];
      pos[o + 1] = prev[o + 1] = pinPos[q + 1];
      pos[o + 2] = prev[o + 2] = pinPos[q + 2];
    });
  }

  private finish(): void {
    if (!this.isFinite()) {
      this.reset();
      return;
    }
    const { pos, prev } = this;
    for (const [dead, alive] of this.shadow) {
      const d = dead * 3;
      const a = alive * 3;
      pos[d] = prev[d] = pos[a];
      pos[d + 1] = prev[d + 1] = pos[a + 1];
      pos[d + 2] = prev[d + 2] = pos[a + 2];
    }
  }

  private forEachNear(u: number, v: number, radius: number, fn: (offset: number, weight: number) => void): void {
    const { cols, rows, live, invMass } = this;
    const r2 = radius * radius;
    for (let j = 0; j < rows; j++) {
      const dv = j / (rows - 1) - v;
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        if (!live[k] || invMass[k] === 0) continue;
        const du = i / (cols - 1) - u;
        const q = (du * du + dv * dv) / r2;
        if (q > 4) continue;
        fn(k * 3, Math.exp(-q));
      }
    }
  }
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Fixed-timestep accumulator. Returns how many fixed steps to run for this frame and drops
 * whatever would exceed `maxSteps` (a slow frame slows the cloth instead of spiralling).
 */
export class FixedStepper {
  private acc = 0;
  constructor(
    readonly step: number,
    readonly maxSteps: number,
  ) {}

  advance(frameDt: number): number {
    this.acc += Math.max(0, frameDt);
    let steps = Math.floor(this.acc / this.step);
    if (steps > this.maxSteps) {
      steps = this.maxSteps;
      this.acc = 0;
    } else {
      this.acc -= steps * this.step;
    }
    return steps;
  }
}
