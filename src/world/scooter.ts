// Delivery scooter with a yellow thermal box: the modern era parked next to the old one.
// Local frame: front toward +X.
import * as THREE from "three";
import { SPOTS } from "../core/layout.ts";
import { localBox, type WorldCtx } from "./ctx.ts";
import type { Vec } from "./kit.ts";
import { C } from "./materials.ts";

export function buildScooter(ctx: WorldCtx): void {
  const { center, rotationY } = SPOTS.scooter;
  // Leaning on its side stand.
  ctx.f.at({ p: center as Vec, r: [0.07, rotationY, 0] }, () => {
    const g = ctx.b.glossy;
    const mt = ctx.b.metal;
    const m = ctx.b.matte;
    const body = "#5c8fc4";
    for (const x of [-0.6, 0.62]) {
      m.cyl(0.22, 0.22, 0.1, 14, C.rubber, { p: [x, 0.22, 0], r: [Math.PI / 2, 0, 0] });
      mt.cyl(0.12, 0.12, 0.11, 10, "#b8bec2", { p: [x, 0.22, 0], r: [Math.PI / 2, 0, 0] });
    }
    // Floorboard, rear body, front shield, seat.
    m.box(0.62, 0.06, 0.32, "#2f2d2c", { p: [0.02, 0.3, 0] });
    g.add(new THREE.CapsuleGeometry(0.17, 0.42, 4, 10).rotateZ(Math.PI / 2), body, { p: [-0.48, 0.52, 0], s: [1, 0.9, 1.05] });
    g.box(0.14, 0.62, 0.36, body, { p: [0.38, 0.62, 0], r: [0, 0, -0.25] });
    g.box(0.1, 0.24, 0.24, body, { p: [0.6, 0.38, 0], r: [0, 0, -0.35] });
    m.add(new THREE.CapsuleGeometry(0.13, 0.36, 4, 8).rotateZ(Math.PI / 2), "#2a2624", { p: [-0.42, 0.72, 0], s: [1, 0.45, 1] });
    // Fork, handlebar, mirrors, headlight.
    mt.rod([0.62, 0.22, 0], [0.48, 0.98, 0], 0.03, "#666", 6);
    mt.rod([0.48, 0.98, -0.32], [0.48, 0.98, 0.32], 0.022, "#333", 6);
    for (const s of [-1, 1]) {
      m.cyl(0.03, 0.03, 0.1, 6, "#222", { p: [0.48, 0.98, s * 0.33], r: [Math.PI / 2, 0, 0] });
      mt.rod([0.48, 0.98, s * 0.22], [0.44, 1.18, s * 0.28], 0.008, "#333", 4);
      mt.cyl(0.045, 0.045, 0.015, 8, C.chrome, { p: [0.44, 1.2, s * 0.29], r: [0, 0, Math.PI / 2] });
    }
    g.box(0.12, 0.14, 0.26, body, { p: [0.5, 0.92, 0], r: [0, 0, -0.25] });
    ctx.b.glow.cyl(0.05, 0.05, 0.02, 10, "#fff6d8", { p: [0.57, 0.93, 0], r: [0, 0, Math.PI / 2] });
    ctx.b.glow.box(0.02, 0.05, 0.12, "#d42a2a", { p: [-0.75, 0.55, 0] });
    // Thermal delivery box on a rack. Plain: no brands.
    mt.box(0.42, 0.03, 0.36, "#3a3a3a", { p: [-0.6, 0.8, 0] });
    g.boxUp(0.5, 0.46, 0.46, "#f6c624", { p: [-0.62, 0.82, 0] });
    g.box(0.52, 0.04, 0.48, "#e0ae12", { p: [-0.62, 1.28, 0] });
    m.box(0.01, 0.05, 0.4, "#d9dde0", { p: [-0.36, 1.04, 0] });
    m.box(0.25, 0.04, 0.01, "#2a2a2a", { p: [-0.62, 1.2, 0.235] });
    // Side stand.
    mt.rod([-0.05, 0.3, 0.12], [-0.12, 0.0, 0.3], 0.015, "#333", 4);
    localBox(ctx, 0, 0, 1.6, 0.6, 1.3);
    ctx.rest.box(0.5, 0.05, 0.46, "#fff", { p: [-0.62, 1.3, 0] });
  });
}
