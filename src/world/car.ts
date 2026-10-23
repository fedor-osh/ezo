// VAZ-2101 "Kopeyka": boxy beige saloon, round headlights, chrome bumpers, a few fig leaves on the
// roof and a cassette on the dashboard. Local frame: nose toward +X, width along Z.
import * as THREE from "three";
import { SPOTS } from "../core/layout.ts";
import { localBox, type WorldCtx } from "./ctx.ts";
import { extrude, rng, type Vec } from "./kit.ts";
import { C } from "./materials.ts";
import { plateTexture } from "./textures.ts";

const BODY = "#e9d6a9";
const L = 4.06;
const W = 1.6;

export function buildCar(ctx: WorldCtx): void {
  const { center, rotationY } = SPOTS.car;
  const rand = rng(2101);
  ctx.f.at({ p: center as Vec, r: [0, rotationY, 0] }, () => {
    const body = ctx.b.glossy;
    const mt = ctx.b.metal;
    const hl = L / 2;
    // Lower body: side profile extruded across the width.
    body.add(
      extrude(
        [
          [-hl, 0.26],
          [hl, 0.26],
          [hl + 0.02, 0.55],
          [hl - 0.06, 0.76],
          [0.85, 0.82],
          [-1.25, 0.82],
          [-hl + 0.05, 0.78],
          [-hl - 0.02, 0.55],
        ],
        W,
        0.03,
      ),
      BODY,
    );
    // Cabin: glass band with body-coloured pillars and roof.
    const cabin: Array<[number, number]> = [
      [-1.22, 0.82],
      [0.82, 0.82],
      [0.3, 1.34],
      [-0.86, 1.34],
    ];
    ctx.b.glass.add(extrude(cabin, W - 0.16), "#2c4552");
    body.add(extrude([[-0.9, 1.32], [0.34, 1.32], [0.28, 1.38], [-0.85, 1.38]], W - 0.12, 0.02), BODY);
    for (const z of [-(W - 0.15) / 2, (W - 0.15) / 2]) {
      body.box(0.07, 0.74, 0.05, BODY, { p: [0.56, 1.08, z], r: [0, 0, 0.785] });
      body.box(0.07, 0.52, 0.05, BODY, { p: [-0.25, 1.08, z] });
      body.box(0.08, 0.64, 0.05, BODY, { p: [-1.04, 1.08, z], r: [0, 0, -0.6] });
    }
    // Wheels and arches.
    for (const wx of [-1.22, 1.2]) {
      for (const s of [-1, 1]) {
        const z = s * (W / 2 - 0.12);
        ctx.b.matte.cyl(0.37, 0.37, 0.03, 16, "#1f1c1c", { p: [wx, 0.32, s * (W / 2 + 0.003)], r: [Math.PI / 2, 0, 0], s: [1, 1, 1] });
        ctx.b.matte.cyl(0.3, 0.3, 0.2, 14, C.rubber, { p: [wx, 0.3, z], r: [Math.PI / 2, 0, 0] });
        mt.cyl(0.17, 0.19, 0.03, 12, C.chrome, { p: [wx, 0.3, z + s * 0.1], r: [Math.PI / 2, 0, 0] });
        mt.cyl(0.05, 0.05, 0.04, 8, "#9aa2a6", { p: [wx, 0.3, z + s * 0.115], r: [Math.PI / 2, 0, 0] });
      }
    }
    // Front: round headlights in chrome rings, grille, turn signals.
    for (const s of [-1, 1]) {
      const z = s * 0.56;
      mt.cyl(0.11, 0.11, 0.05, 16, C.chrome, { p: [hl + 0.01, 0.58, z], r: [0, 0, Math.PI / 2] });
      ctx.b.glow.cyl(0.085, 0.085, 0.02, 16, "#d6d0b4", { p: [hl + 0.04, 0.58, z], r: [0, 0, Math.PI / 2] });
      ctx.b.glow.box(0.03, 0.06, 0.12, "#ff9a2a", { p: [hl + 0.01, 0.43, s * 0.6] });
      ctx.b.glow.box(0.03, 0.14, 0.18, "#d42a2a", { p: [-hl - 0.01, 0.58, s * 0.6] });
      ctx.b.glow.box(0.03, 0.06, 0.18, "#ff9a2a", { p: [-hl - 0.01, 0.47, s * 0.6] });
      // Mirror and door handles.
      mt.box(0.05, 0.08, 0.1, C.chrome, { p: [0.75, 0.9, s * (W / 2 + 0.06)] });
      mt.box(0.12, 0.025, 0.02, C.chrome, { p: [0.05, 0.72, s * (W / 2 + 0.005)] });
      mt.box(0.12, 0.025, 0.02, C.chrome, { p: [-0.75, 0.72, s * (W / 2 + 0.005)] });
      // Side chrome strip.
      mt.box(L - 0.3, 0.02, 0.01, C.chrome, { p: [0, 0.62, s * (W / 2 + 0.006)] });
      // Rust bubbling on the sills: it is a 1974 car after all.
      for (let k = 0; k < 4; k++) ctx.b.props.sphere(0.03 + rand() * 0.02, C.rust, { p: [-1.6 + rand() * 3.2, 0.32, s * (W / 2 + 0.002)], s: [1.3, 0.8, 0.3] }, 0);
    }
    ctx.b.matte.box(0.03, 0.17, 0.66, "#2d2a28", { p: [hl + 0.01, 0.57, 0] });
    for (let k = 0; k < 4; k++) mt.box(0.035, 0.018, 0.66, C.chrome, { p: [hl + 0.025, 0.505 + k * 0.042, 0] });
    mt.box(0.03, 0.2, 0.025, C.chrome, { p: [hl + 0.03, 0.57, 0] });
    // Chrome bumpers with rubber over-riders.
    for (const s of [-1, 1]) {
      const x = s * (hl + 0.07);
      mt.box(0.08, 0.09, W + 0.08, C.chrome, { p: [x, 0.36, 0] });
      for (const z of [-0.35, 0.35]) ctx.b.matte.box(0.1, 0.16, 0.07, C.rubber, { p: [x, 0.38, z] });
    }
    // License plates.
    const plateMat = new THREE.MeshStandardMaterial({ map: plateTexture("FO·2026"), roughness: 0.5 });
    const plates = new THREE.Group();
    for (const s of [-1, 1]) {
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.12), plateMat);
      plate.position.set(s * (hl + 0.115), 0.36, 0);
      plate.rotation.y = s * Math.PI / 2;
      plates.add(plate);
    }
    plates.applyMatrix4(ctx.f.top);
    plates.name = "license-plates";
    ctx.root.add(plates);
    // Interior hints: seats, steering wheel, a cassette on the dashboard.
    ctx.b.matte.box(0.45, 0.55, 1.3, "#6a3a2a", { p: [-0.55, 0.86, 0] });
    ctx.b.matte.box(0.3, 0.12, 1.4, "#3a3532", { p: [0.55, 0.86, 0] });
    ctx.b.matte.add(new THREE.TorusGeometry(0.15, 0.015, 4, 12).rotateY(Math.PI / 2), "#2a2624", { p: [0.35, 0.98, 0.35], r: [0, 0, 0.5] });
    ctx.b.props.box(0.06, 0.012, 0.1, "#2a2a2a", { p: [0.62, 0.93, -0.2], r: [0, 0.3, 0] });
    ctx.b.props.box(0.03, 0.013, 0.08, "#e8c84a", { p: [0.62, 0.932, -0.2], r: [0, 0.3, 0] });
    // Fallen fig leaves on the roof and the windscreen.
    for (let k = 0; k < 7; k++) {
      const onRoof = k < 5;
      const x = onRoof ? -0.8 + rand() * 1.0 : 0.5 + rand() * 0.25;
      const y = onRoof ? 1.39 : 0.84 + (0.82 - x);
      ctx.b.props.add(new THREE.CircleGeometry(0.08, 5).rotateX(-Math.PI / 2), rand() < 0.5 ? "#d9a43a" : "#b8762a", {
        p: [x, y, (rand() - 0.5) * 1.1],
        r: [onRoof ? 0 : 0, rand() * 6, onRoof ? (rand() - 0.5) * 0.1 : -0.78],
        s: [1, 1, 1.4],
      });
    }
    localBox(ctx, 0, 0, L + 0.15, W + 0.1, 1.38);
    ctx.rest.box(1.2, 0.06, W - 0.15, "#fff", { p: [-0.27, 1.38, 0] });
    ctx.rest.box(1.0, 0.06, W, "#fff", { p: [1.45, 0.8, 0] });
    ctx.rest.box(0.8, 0.06, W, "#fff", { p: [-1.6, 0.8, 0] });
  });
}
