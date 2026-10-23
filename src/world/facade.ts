// Facade elements, all built in a local "facade frame": x runs along the wall, y is up,
// +z points out into the yard and the wall surface is z = 0.
import * as THREE from "three";
import type { WorldCtx } from "./ctx.ts";
import { C } from "./materials.ts";
import type { Col, Vec } from "./kit.ts";

export const PANE_COLORS = ["#d81e3c", "#f08a24", "#f5c518", "#1fa88a", "#2f62c4", "#8250c8", "#e8458a", "#2fb3e0"];
const PANE_CLEAR = ["#7fa6b5", "#8fb6c2", "#6f98aa", "#a3c4c9"];

interface TileInstance {
  m: THREE.Matrix4;
  c: THREE.Color;
}

const darker = (c: Col, k: number) => new THREE.Color(c).multiplyScalar(k);

export class Facade {
  readonly tiles: TileInstance[] = [];
  /** Interesting window centres in world space, for ambient effects (TV glow, router). */
  readonly marks = new Map<string, { pos: Vec; yaw: number; w: number; h: number }>();

  constructor(
    readonly ctx: WorldCtx,
    readonly rand: () => number,
  ) {}

  private get m() {
    return this.ctx.b.matte;
  }
  private get p() {
    return this.ctx.b.props;
  }

  /** Plastered building body with plinth, string courses and cornice. Returns the eave height. */
  body(x0: number, x1: number, floors: number, depth: number, plaster: Col, floorH: number, plinth: number): number {
    const w = x1 - x0;
    const cx = (x0 + x1) / 2;
    const h = plinth + floors * floorH + 0.25;
    this.m.boxUp(w, h, depth, plaster, { p: [cx, 0, -depth / 2] }, 0.02);
    // Stone plinth, a little proud of the wall.
    this.m.boxUp(w + 0.02, plinth + 0.25, 0.08, C.stone, { p: [cx, 0, 0.0] });
    for (let f = 1; f < floors; f++) {
      this.m.boxUp(w + 0.02, 0.1, 0.07, darker(plaster, 0.9), { p: [cx, plinth + f * floorH - 0.12, 0] });
    }
    // Cornice.
    this.m.boxUp(w + 0.12, 0.14, 0.22, darker(plaster, 0.88), { p: [cx, h - 0.2, 0.02] });
    this.m.boxUp(w + 0.2, 0.08, 0.3, darker(plaster, 0.95), { p: [cx, h - 0.08, 0.04] });
    // Rest proxy: the wall face, so a sleeping butterfly can cling to it.
    this.ctx.rest.boxUp(w, h, 0.05, "#fff", { p: [cx, 0, 0.0] });
    return h;
  }

  window(
    x: number,
    y: number,
    o: { w?: number; h?: number; arch?: boolean; shutter?: Col | null; frame?: Col; curtain?: boolean; pot?: boolean; mark?: string } = {},
  ): void {
    const w = o.w ?? 0.9;
    const h = o.h ?? 1.35;
    const frame = o.frame ?? C.white;
    const g = this.ctx.b.glass;
    const t = 0.07;
    // Glass (dark, reflective) slightly recessed.
    g.box(w - 0.04, h - 0.04, 0.02, C.glassDark, { p: [x, y + h / 2, 0.01] });
    if (o.arch) {
      const r = w / 2;
      const half = new THREE.CylinderGeometry(r, r, 0.02, 10, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2);
      g.add(half, C.glassDark, { p: [x, y + h, 0.01] });
      const ring = new THREE.TorusGeometry(r, t / 2, 3, 10, Math.PI);
      this.m.add(ring, frame, { p: [x, y + h, 0.035] });
      // Keystone.
      this.m.box(0.12, 0.16, 0.06, C.creamShade, { p: [x, y + h + r + 0.02, 0.03] });
    } else {
      this.m.box(w + 0.2, 0.12, 0.06, C.creamShade, { p: [x, y + h + 0.1, 0.02] });
    }
    // Frame and mullions.
    this.m.box(w, t, 0.06, frame, { p: [x, y + h - t / 2, 0.03] });
    this.m.box(w, t, 0.06, frame, { p: [x, y + t / 2, 0.03] });
    this.m.box(t, h, 0.06, frame, { p: [x - w / 2 + t / 2, y + h / 2, 0.03] });
    this.m.box(t, h, 0.06, frame, { p: [x + w / 2 - t / 2, y + h / 2, 0.03] });
    this.m.box(0.04, h, 0.04, frame, { p: [x, y + h / 2, 0.03] });
    this.m.box(w, 0.04, 0.04, frame, { p: [x, y + h * 0.7, 0.03] });
    if (o.curtain) {
      this.m.box(w - 0.12, h * 0.38, 0.01, C.offWhite, { p: [x, y + h * 0.78, 0.02] });
    }
    // Sill.
    this.m.box(w + 0.18, 0.06, 0.18, C.stone, { p: [x, y - 0.03, 0.08] });
    this.ctx.rest.box(w + 0.18, 0.06, 0.18, "#fff", { p: [x, y - 0.03, 0.08] });
    if (o.shutter) {
      const sw = w / 2 + 0.02;
      for (const side of [-1, 1]) {
        const sx = x + side * (w / 2 + sw / 2 + 0.03);
        this.m.box(sw, h, 0.04, o.shutter, { p: [sx, y + h / 2, 0.03] });
        for (let k = 0.12; k < h - 0.05; k += 0.12) {
          this.m.box(sw - 0.06, 0.025, 0.02, darker(o.shutter, 0.78), { p: [sx, y + k, 0.055] });
        }
      }
    }
    if (o.pot ?? this.rand() < 0.45) this.geranium(x + (this.rand() - 0.5) * (w - 0.3), y, 0.1);
    if (o.mark) {
      const e = this.ctx.f.top.elements;
      this.marks.set(o.mark, { pos: this.ctx.f.point([x, y + h / 2, 0.025]), yaw: Math.atan2(e[8], e[10]), w, h });
    }
  }

  door(x: number, o: { w?: number; h?: number; color?: Col; awning?: boolean; step?: boolean; transom?: boolean } = {}): void {
    const w = o.w ?? 1.1;
    const h = o.h ?? 2.15;
    const col = o.color ?? C.wood;
    const y0 = 0.2;
    this.m.box(w + 0.16, h + 0.08, 0.06, C.creamShade, { p: [x, y0 + h / 2, 0.01] });
    for (const side of [-1, 1]) {
      const lx = x + (side * w) / 4;
      this.m.box(w / 2 - 0.03, h - 0.06, 0.06, col, { p: [lx, y0 + h / 2, 0.04] });
      // Raised panels.
      this.m.box(w / 2 - 0.18, h * 0.32, 0.03, darker(col, 1.15), { p: [lx, y0 + h * 0.25, 0.08] });
      this.m.box(w / 2 - 0.18, h * 0.38, 0.03, darker(col, 1.15), { p: [lx, y0 + h * 0.68, 0.08] });
      this.ctx.b.metal.sphere(0.03, C.chrome, { p: [x + side * 0.08, y0 + h * 0.48, 0.1] }, 0);
    }
    if (o.transom ?? true) {
      const r = w / 2;
      const fan = new THREE.CylinderGeometry(r, r, 0.02, 10, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2);
      this.ctx.b.glow.add(fan, PANE_COLORS[Math.floor(this.rand() * PANE_COLORS.length)], { p: [x, y0 + h, 0.02], s: [1, 0.55, 1] });
      for (let k = 0; k < 5; k++) {
        const a = Math.PI * (k + 0.5) / 5;
        this.m.box(0.03, r * 0.55, 0.03, C.white, { p: [x + Math.cos(a) * r * 0.5, y0 + h + Math.sin(a) * r * 0.27, 0.04], r: [0, 0, a - Math.PI / 2] });
      }
      this.m.add(new THREE.TorusGeometry(r, 0.04, 3, 10, Math.PI), C.white, { p: [x, y0 + h, 0.04], s: [1, 0.55, 1] });
    }
    if (o.step ?? true) this.m.boxUp(w + 0.5, 0.2, 0.55, C.stone, { p: [x, 0, 0.27] });
    if (o.awning) {
      this.ctx.b.metal.box(w + 0.6, 0.04, 0.8, C.tin, { p: [x, y0 + h + 0.55, 0.38], r: [0.32, 0, 0] });
      for (const side of [-1, 1]) {
        this.ctx.b.metal.rod([x + side * (w / 2 + 0.25), y0 + h + 0.2, 0], [x + side * (w / 2 + 0.25), y0 + h + 0.45, 0.7], 0.015, C.black, 4);
      }
    }
  }

  /** Hairline cracks: a short random walk of thin dark strokes. */
  cracks(x0: number, x1: number, y0: number, y1: number, plaster: Col, n: number): void {
    const col = darker(plaster, 0.62);
    for (let i = 0; i < n; i++) {
      let x = THREE.MathUtils.lerp(x0, x1, this.rand());
      let y = THREE.MathUtils.lerp(y0, y1, this.rand());
      const segs = 3 + Math.floor(this.rand() * 4);
      for (let s = 0; s < segs; s++) {
        const len = 0.12 + this.rand() * 0.25;
        const a = -Math.PI / 2 + (this.rand() - 0.5) * 1.6;
        const nx = x + Math.cos(a) * len;
        const ny = y + Math.sin(a) * len;
        this.p.box(len, 0.018, 0.01, col, { p: [(x + nx) / 2, (y + ny) / 2, 0.005], r: [0, 0, a] }, 0);
        x = nx;
        y = ny;
      }
    }
  }

  /** A patch of fallen plaster showing the brick underneath. */
  peel(x: number, y: number, w: number, h: number): void {
    this.p.box(w, h, 0.012, "#cdbb9e", { p: [x, y, 0.004] }, 0.02);
    const bh = 0.09;
    for (let r = 0; r * bh < h - bh; r++) {
      const off = r % 2 ? 0.1 : 0;
      for (let bx = -w / 2 + 0.06 + off; bx < w / 2 - 0.1; bx += 0.21) {
        if (this.rand() < 0.75) this.p.box(0.18, bh - 0.025, 0.02, this.rand() < 0.5 ? C.brick : "#c47459", { p: [x + bx + 0.09, y - h / 2 + bh / 2 + r * bh + 0.02, 0.01] });
      }
    }
  }

  geranium(x: number, y: number, z: number): void {
    const p = this.p;
    p.cyl(0.1, 0.075, 0.16, 7, C.terracotta, { p: [x, y + 0.08, z] });
    p.cyl(0.11, 0.11, 0.03, 7, C.terracottaDark, { p: [x, y + 0.16, z] });
    p.sphere(0.13, C.leafDark, { p: [x, y + 0.24, z], s: [1.2, 0.8, 1] }, 0);
    const bloom = this.rand() < 0.5 ? "#e8304a" : this.rand() < 0.5 ? "#ff6f91" : "#f25c3c";
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7 + this.rand();
      p.sphere(0.045, bloom, { p: [x + Math.cos(a) * 0.08, y + 0.33 + this.rand() * 0.05, z + Math.sin(a) * 0.07] }, 0);
    }
  }

  /** Open carved wooden balcony with brackets and turned balusters. */
  woodBalcony(x0: number, x1: number, y: number, depth: number, color: Col, opts: { roofTo?: number; pots?: number } = {}): void {
    const w = x1 - x0;
    const cx = (x0 + x1) / 2;
    const m = this.m;
    m.box(w, 0.1, depth, darker(color, 0.85), { p: [cx, y - 0.05, depth / 2] });
    this.ctx.rest.box(w, 0.1, depth, "#fff", { p: [cx, y - 0.05, depth / 2] });
    // Carved brackets underneath.
    for (let bx = x0 + 0.2; bx <= x1 - 0.15; bx += 0.9) {
      m.box(0.08, 0.5, 0.08, color, { p: [bx, y - 0.35, depth * 0.45], r: [0.85, 0, 0] });
      m.box(0.06, 0.06, depth * 0.9, color, { p: [bx, y - 0.13, depth * 0.48] });
    }
    const railH = 0.95;
    m.box(w + 0.06, 0.07, 0.1, color, { p: [cx, y + railH, depth - 0.04] });
    m.box(w, 0.05, 0.08, color, { p: [cx, y + 0.12, depth - 0.04] });
    this.ctx.rest.box(w + 0.06, 0.07, 0.1, "#fff", { p: [cx, y + railH, depth - 0.04] });
    for (const side of [x0, x1]) {
      m.box(0.07, 0.07, depth, color, { p: [side, y + railH, depth / 2] });
      m.box(0.05, 0.05, depth, color, { p: [side, y + 0.12, depth / 2] });
    }
    // Front and side balusters: flat boards with a carved diamond, the Tbilisi look.
    const baluster = (bx: number, bz: number, rotY: number) => {
      m.box(0.07, railH - 0.14, 0.025, color, { p: [bx, y + railH / 2 + 0.05, bz], r: [0, rotY, 0] });
      m.box(0.09, 0.09, 0.03, darker(color, 1.18), { p: [bx, y + railH / 2 + 0.05, bz], r: [0, rotY, Math.PI / 4] });
    };
    for (let bx = x0 + 0.1; bx < x1 - 0.05; bx += 0.15) baluster(bx, depth - 0.04, 0);
    for (let bz = 0.12; bz < depth - 0.08; bz += 0.15) {
      baluster(x0, bz, Math.PI / 2);
      baluster(x1, bz, Math.PI / 2);
    }
    if (opts.roofTo) {
      for (const px of [x0 + 0.04, x1 - 0.04]) m.box(0.08, opts.roofTo - y, 0.08, color, { p: [px, (y + opts.roofTo) / 2, depth - 0.05] });
      // Fretwork valance under the roof line.
      m.box(w, 0.16, 0.04, color, { p: [cx, opts.roofTo - 0.08, depth - 0.04] });
      for (let bx = x0 + 0.15; bx < x1 - 0.1; bx += 0.3) {
        m.box(0.1, 0.1, 0.03, darker(color, 1.2), { p: [bx, opts.roofTo - 0.2, depth - 0.04], r: [0, 0, Math.PI / 4] });
      }
    }
    const pots = opts.pots ?? 2;
    for (let i = 0; i < pots; i++) this.geranium(x0 + 0.3 + this.rand() * (w - 0.6), y, depth - 0.25);
  }

  /**
   * Shushabandi: an enclosed glazed balcony, a wooden lower panel and a grid of small panes,
   * the top bands in coloured glass. `levels` stacks it over several floors.
   */
  shushabandi(x0: number, x1: number, y: number, depth: number, wood: Col, floorH: number, levels = 1): void {
    const w = x1 - x0;
    const cx = (x0 + x1) / 2;
    const m = this.m;
    const glow = this.ctx.b.glow;
    const r = this.rand;
    const paneColor = (row: number, rows: number) => {
      if (row >= rows - 2) return PANE_COLORS[Math.floor(r() * PANE_COLORS.length)];
      return r() < 0.28 ? PANE_COLORS[Math.floor(r() * PANE_COLORS.length)] : PANE_CLEAR[Math.floor(r() * PANE_CLEAR.length)];
    };
    // Brackets under the bottom slab.
    for (let bx = x0 + 0.25; bx <= x1 - 0.2; bx += 0.85) {
      m.box(0.1, 0.7, 0.1, wood, { p: [bx, y - 0.42, depth * 0.42], r: [0.8, 0, 0] });
    }
    for (let lv = 0; lv < levels; lv++) {
      const ly = y + lv * floorH;
      const hh = floorH - 0.12;
      m.box(w + 0.1, 0.12, depth + 0.05, darker(wood, 0.85), { p: [cx, ly - 0.06, depth / 2] });
      this.ctx.rest.box(w + 0.1, 0.12, depth + 0.05, "#fff", { p: [cx, ly - 0.06, depth / 2] });
      const panelH = 0.9;
      // Lower wooden panel (front + sides) with lighter carved insets.
      m.box(w, panelH, 0.06, wood, { p: [cx, ly + panelH / 2, depth - 0.03] });
      for (const side of [x0 + 0.03, x1 - 0.03]) m.box(0.06, panelH, depth, wood, { p: [side, ly + panelH / 2, depth / 2] });
      for (let px = x0 + 0.35; px < x1 - 0.2; px += 0.55) {
        m.box(0.4, 0.5, 0.03, darker(wood, 1.22), { p: [px, ly + panelH / 2, depth + 0.005] });
        m.box(0.16, 0.16, 0.035, darker(wood, 0.8), { p: [px, ly + panelH / 2, depth + 0.01], r: [0, 0, Math.PI / 4] });
      }
      m.box(w + 0.06, 0.07, 0.12, darker(wood, 0.9), { p: [cx, ly + panelH, depth - 0.02] });
      // Glazed grid.
      const gy0 = ly + panelH + 0.035;
      const gh = hh - panelH - 0.2;
      const cols = Math.max(2, Math.round(w / 0.3));
      const rows = 6;
      const cw = w / cols;
      const rh = gh / rows;
      for (let c = 0; c < cols; c++) {
        for (let row = 0; row < rows; row++) {
          // The two top rows are split into small squares (the iconic coloured band).
          const split = row >= rows - 2 ? 2 : 1;
          for (let k = 0; k < split; k++) {
            const pw = cw / split;
            glow.box(pw - 0.035, rh - 0.035, 0.015, paneColor(row, rows), {
              p: [x0 + c * cw + pw * (k + 0.5), gy0 + row * rh + rh / 2, depth - 0.04],
            });
          }
        }
        m.box(0.035, gh, 0.05, wood, { p: [x0 + c * cw, gy0 + gh / 2, depth - 0.025] });
      }
      for (let row = 0; row <= rows; row++) m.box(w, 0.03, 0.045, wood, { p: [cx, gy0 + row * rh, depth - 0.025] });
      // Side glazing.
      const scols = Math.max(1, Math.round(depth / 0.3));
      const sw = depth / scols;
      for (const side of [x0, x1]) {
        for (let c = 0; c < scols; c++) {
          for (let row = 0; row < rows; row++) {
            glow.box(0.015, rh - 0.035, sw - 0.035, paneColor(row, rows), { p: [side + (side === x0 ? 0.03 : -0.03), gy0 + row * rh + rh / 2, c * sw + sw / 2] });
          }
        }
        m.box(0.07, gh + 0.05, 0.07, wood, { p: [side, gy0 + gh / 2, depth - 0.03] });
      }
      // Top beam and frieze.
      m.box(w + 0.08, 0.18, 0.1, darker(wood, 0.9), { p: [cx, gy0 + gh + 0.09, depth - 0.03] });
      for (let px = x0 + 0.12; px < x1 - 0.06; px += 0.22) {
        m.box(0.08, 0.08, 0.03, darker(wood, 1.25), { p: [px, gy0 + gh + 0.09, depth + 0.03], r: [0, 0, Math.PI / 4] });
      }
    }
    // Little tin roof on top.
    const topY = y + levels * floorH - 0.1;
    this.ctx.b.metal.box(w + 0.3, 0.05, depth + 0.35, C.tin, { p: [cx, topY + 0.08, depth / 2 + 0.05], r: [0.28, 0, 0] });
    this.ctx.rest.box(w + 0.3, 0.05, depth + 0.35, "#fff", { p: [cx, topY + 0.08, depth / 2 + 0.05], r: [0.28, 0, 0] });
  }

  /** Pitched roof sloping toward the yard, terracotta tiles on the eave, rafter ends below. */
  roofPitched(x0: number, x1: number, y: number, depth: number, rise: number, color: Col, tiles: boolean): void {
    const w = x1 - x0 + 0.3;
    const cx = (x0 + x1) / 2;
    const ov = 0.55;
    const run = depth / 2 + ov;
    const len = Math.hypot(run, rise);
    const ang = Math.atan2(rise, run);
    const m = this.m;
    // Front slope and back slope.
    m.box(w, 0.12, len, color, { p: [cx, y + rise / 2, ov - run / 2], r: [ang, 0, 0] });
    m.box(w, 0.12, len, darker(color, 0.85), { p: [cx, y + rise / 2, -depth - ov + run / 2], r: [-ang, 0, 0] });
    this.ctx.rest.box(w, 0.12, len, "#fff", { p: [cx, y + rise / 2 + 0.05, ov - run / 2], r: [ang, 0, 0] });
    // Gable triangles closing the ends.
    const tri = new THREE.Shape([new THREE.Vector2(-depth / 2, 0), new THREE.Vector2(depth / 2, 0), new THREE.Vector2(0, rise - 0.05)]);
    const gable = new THREE.ExtrudeGeometry(tri, { depth: 0.1, bevelEnabled: false }).rotateY(Math.PI / 2);
    m.add(gable.clone(), C.creamShade, { p: [x0 - 0.02, y, -depth / 2] });
    m.add(gable, C.creamShade, { p: [x1 - 0.08, y, -depth / 2] });
    // Rafter ends under the eave.
    for (let rx = x0 + 0.15; rx < x1; rx += 0.45) {
      m.box(0.07, 0.09, ov + 0.1, C.woodDark, { p: [rx, y - 0.02, ov / 2 - 0.05], r: [ang, 0, 0] });
    }
    // Ridge cap.
    m.box(w + 0.04, 0.12, 0.2, darker(color, 0.8), { p: [cx, y + rise + 0.02, -depth / 2] });
    if (!tiles) return;
    // Rows of half-round tiles, densest at the eave where they are seen from the yard.
    const rows = Math.ceil(len / 0.32);
    const base = new THREE.Color(color);
    const mt = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(ang, 0, 0));
    for (let rI = 0; rI < rows; rI++) {
      const s = (rI + 0.5) * (len / rows);
      const lz = ov - Math.cos(ang) * s;
      const ly = y + Math.sin(ang) * s + 0.07;
      for (let tx = x0 - 0.1; tx <= x1 + 0.1; tx += 0.2) {
        mt.compose(new THREE.Vector3(tx, ly, lz), q, new THREE.Vector3(1, 1, 1));
        const world = this.ctx.f.top.clone().multiply(mt);
        const k = 0.85 + this.rand() * 0.3;
        this.tiles.push({ m: world, c: base.clone().multiplyScalar(k).lerp(new THREE.Color(C.terracottaDark), this.rand() * 0.3) });
      }
    }
  }

  /** Corrugated tin roof: shallow slope, ribs, rust patches. */
  roofTin(x0: number, x1: number, y: number, depth: number, rise: number): void {
    const w = x1 - x0 + 0.4;
    const cx = (x0 + x1) / 2;
    const ov = 0.5;
    const run = depth + ov;
    const len = Math.hypot(run, rise);
    const ang = Math.atan2(rise, run);
    const mt = this.ctx.b.metal;
    mt.box(w, 0.05, len, C.tin, { p: [cx, y + rise / 2, ov - run / 2], r: [ang, 0, 0] });
    this.ctx.rest.box(w, 0.06, len, "#fff", { p: [cx, y + rise / 2 + 0.04, ov - run / 2], r: [ang, 0, 0] });
    for (let rx = x0 - 0.15; rx < x1 + 0.2; rx += 0.18) {
      const rusty = this.rand() < 0.22;
      mt.box(0.05, 0.05, len, rusty ? C.rust : "#b5bfbd", { p: [rx, y + rise / 2 + 0.035, ov - run / 2], r: [ang, 0, 0] });
    }
    // Back wall up to the high side of the roof.
    this.m.boxUp(x1 - x0, rise, 0.2, C.creamShade, { p: [cx, y, -depth + 0.1] });
    for (let rx = x0 + 0.15; rx < x1; rx += 0.6) {
      this.m.box(0.07, 0.09, ov + 0.1, C.woodDark, { p: [rx, y - 0.02, ov / 2 - 0.05] });
    }
  }

  /** Flat roof with a low parapet; returns the roof level. */
  roofFlat(x0: number, x1: number, y: number, depth: number, color: Col): number {
    const w = x1 - x0;
    const cx = (x0 + x1) / 2;
    this.m.boxUp(w, 0.45, 0.18, color, { p: [cx, y, 0.0] });
    this.m.boxUp(w + 0.06, 0.06, 0.26, C.creamShade, { p: [cx, y + 0.45, 0.0] });
    this.ctx.rest.boxUp(w, 0.5, 0.2, "#fff", { p: [cx, y, 0.0] });
    this.m.boxUp(w, 0.04, depth, "#9b9087", { p: [cx, y - 0.02, -depth / 2] });
    return y;
  }

  /** Yellow gas pipe along the wall at height y, with brackets and an optional drop to a meter. */
  gasPipe(x0: number, x1: number, y: number, drops: number[] = []): void {
    const mt = this.ctx.b.metal;
    const z = 0.14;
    mt.rod([x0, y, z], [x1, y, z], 0.035, C.gas, 6);
    mt.rod([x0, y, 0], [x0, y, z], 0.035, C.gas, 6);
    for (let bx = x0 + 0.4; bx < x1; bx += 1.3) mt.box(0.05, 0.1, z, C.stoneDark, { p: [bx, y, z / 2] });
    for (const dx of drops) {
      mt.rod([dx, y, z], [dx, 1.6, z], 0.03, C.gas, 6);
      mt.box(0.28, 0.32, 0.16, "#e4e0d2", { p: [dx, 1.4, z] });
      mt.box(0.18, 0.1, 0.02, C.black, { p: [dx, 1.45, z + 0.09] });
      mt.rod([dx, 1.24, z], [dx, 0.8, z], 0.03, C.gas, 6);
      mt.rod([dx, 0.8, z], [dx, 0.8, 0], 0.03, C.gas, 6);
    }
  }

  /** Split-system AC unit on a bracket. */
  acUnit(x: number, y: number): void {
    const p = this.p;
    p.box(0.8, 0.55, 0.3, "#ece9e0", { p: [x, y, 0.2] });
    p.cyl(0.19, 0.19, 0.02, 10, "#5a5a58", { p: [x - 0.12, y, 0.355], r: [Math.PI / 2, 0, 0] });
    for (let k = -2; k <= 2; k++) p.box(0.38, 0.015, 0.01, "#c9c6bd", { p: [x - 0.12, y + k * 0.07, 0.37] });
    this.ctx.b.metal.rod([x - 0.42, y - 0.3, 0.3], [x - 0.42, y - 0.3, 0], 0.02, C.steel, 4);
    this.ctx.b.metal.rod([x + 0.42, y - 0.3, 0.3], [x + 0.42, y - 0.3, 0], 0.02, C.steel, 4);
    // Drip pipe running down the wall.
    this.ctx.b.props.rod([x + 0.3, y - 0.28, 0.12], [x + 0.32, 0.4, 0.05], 0.012, "#ddd", 4);
    this.ctx.rest.box(0.8, 0.05, 0.3, "#fff", { p: [x, y + 0.28, 0.2] });
  }
}
