// Laundry on the lines. The navigation buttons are cloths on the main line, one per section;
// the other lines carry decorative laundry using the same Verlet sim with fewer iterations.
import * as THREE from "three";
import type { Engine } from "../core/types.ts";
import { ORDER } from "../core/types.ts";
import { CLOTHESLINES } from "../core/layout.ts";
import { SECTIONS, type Section } from "../core/sections.ts";
import { $highlighted, $reducedMotion, $section } from "../core/stores.ts";
import { registerInteractable, registerSurface } from "../core/surfaces.ts";
import { gust } from "../core/wind.ts";
import type { SectionId } from "../shared/protocol.ts";
import { paintFabric, type FabricDesign, type FabricPattern, type IconKind } from "./fabric.ts";
import { installHtmlFabrics } from "./htmlFabric.ts";
import { buildLines, buildPins, PIN_WOOD, type Sag } from "./line.ts";
import { ClothPiece } from "./piece.ts";
import { makeShape, type ShapeKind } from "./shapes.ts";

interface Look {
  kind: ShapeKind;
  w: number;
  h: number;
  cols: number;
  rows: number;
  icon: IconKind;
}

const NAV_LOOKS: Record<SectionId, Look> = {
  home: { kind: "towel", w: 0.92, h: 1.12, cols: 14, rows: 16, icon: "heart" },
  work: { kind: "pillow", w: 1.18, h: 0.84, cols: 16, rows: 12, icon: "star" },
  about: { kind: "shirt", w: 1.14, h: 1.02, cols: 15, rows: 15, icon: "flower" },
  stack: { kind: "towel", w: 0.96, h: 1.06, cols: 14, rows: 16, icon: "stack" },
  contact: { kind: "pillow", w: 1.16, h: 0.8, cols: 16, rows: 12, icon: "envelope" },
};

interface Decor {
  line: number;
  t: number;
  kind: ShapeKind;
  w: number;
  h: number;
  base: string;
  accent: string;
  pattern: FabricPattern;
  density?: number;
  windScale?: number;
}

const DECOR: Decor[] = [
  { line: 0, t: 0.2, kind: "shirt", w: 1.0, h: 0.95, base: "#f7f4ee", accent: "#6c9bd2", pattern: "pinstripe" },
  { line: 0, t: 0.42, kind: "trousers", w: 0.78, h: 1.1, base: "#46659a", accent: "#2b4162", pattern: "denim", density: 0.45 },
  { line: 0, t: 0.575, kind: "sock", w: 0.2, h: 0.44, base: "#e63946", accent: "#fff6e3", pattern: "ribbed" },
  { line: 0, t: 0.62, kind: "sock", w: 0.2, h: 0.44, base: "#e63946", accent: "#fff6e3", pattern: "ribbed" },
  { line: 0, t: 0.8, kind: "towel", w: 0.8, h: 1.0, base: "#98e2c6", accent: "#ffffff", pattern: "stripes" },
  { line: 1, t: 0.33, kind: "carpet", w: 1.5, h: 1.1, base: "#b5302a", accent: "#f2e8cf", pattern: "rug", density: 1.2, windScale: 0.6 },
  { line: 1, t: 0.66, kind: "shirt", w: 0.95, h: 0.9, base: "#f4a259", accent: "#fff6e3", pattern: "checks" },
  { line: 1, t: 0.84, kind: "sock", w: 0.2, h: 0.42, base: "#ffd23f", accent: "#4361ee", pattern: "ribbed" },
];

interface NavCloth {
  section: Section;
  piece: ClothPiece;
  pinIdx: number[];
  hover: { u: number; v: number } | null;
  glow: number;
}

export function initCloth(engine: Engine): void {
  const { scene, renderer, camera } = engine;
  const low = engine.quality === "low";
  const texWidth = low ? 512 : 768;
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const makeTexture = (design: FabricDesign, width: number) => {
    const tex = new THREE.CanvasTexture(paintFabric(design, width));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  };

  const group = new THREE.Group();
  group.name = "laundry";
  scene.add(group);

  const lines: Sag[] = [CLOTHESLINES.main, ...CLOTHESLINES.decor];
  group.add(buildLines(lines));

  // Navigation cloths, evenly spread along the main line.
  const nav: NavCloth[] = [];
  const designs: Array<{ design: FabricDesign; piece: ClothPiece }> = [];
  SECTIONS.forEach((section, i) => {
    const look = NAV_LOOKS[section.id];
    const shape = makeShape(look.kind, look.w, look.h, look.cols, look.rows);
    const design: FabricDesign = {
      base: section.palette[0],
      accent: section.palette[1],
      pattern: section.pattern,
      shape,
      label: section.label,
      icon: look.icon,
      seed: 11 + i * 7,
    };
    const t = SECTIONS.length === 1 ? 0.5 : 0.14 + (i * 0.72) / (SECTIONS.length - 1);
    const piece = new ClothPiece({
      shape,
      line: CLOTHESLINES.main,
      t,
      texture: makeTexture(design, texWidth),
      iterations: 6,
      castShadow: true,
      seed: i + 1,
    });
    piece.mesh.name = `cloth:${section.id}`;
    group.add(piece.mesh);
    nav.push({ section, piece, pinIdx: [], hover: null, glow: 0 });
    designs.push({ design, piece });
  });

  const decor = DECOR.map((d, i) => {
    const line = lines[1 + d.line];
    const scale = low ? 0.7 : 1;
    const cols = Math.max(5, Math.round((d.kind === "sock" ? 7 : d.kind === "carpet" ? 14 : 11) * scale));
    const rows = Math.max(7, Math.round((d.kind === "sock" ? 10 : d.kind === "carpet" ? 11 : 13) * scale));
    const shape = makeShape(d.kind, d.w, d.h, cols, rows);
    const design: FabricDesign = { base: d.base, accent: d.accent, pattern: d.pattern, shape, seed: 101 + i * 13 };
    const piece = new ClothPiece({
      shape,
      line,
      t: d.t,
      texture: makeTexture(design, 256),
      iterations: low ? 2 : 3,
      density: d.density,
      windScale: d.windScale,
      castShadow: !low,
      seed: 50 + i,
    });
    group.add(piece.mesh);
    return piece;
  });

  // Every clothespin in one instanced mesh; remember which belong to which nav cloth.
  const placements = [...nav.map((n) => n.piece), ...decor].flatMap((p) => p.pins);
  let idx = 0;
  for (const n of nav) n.pinIdx = n.piece.pins.map(() => idx++);
  const pins = buildPins(placements);
  group.add(pins);

  const paintPins = (selected: SectionId) => {
    const c = new THREE.Color();
    for (const n of nav) {
      c.set(n.section.id === selected ? n.section.palette[1] : PIN_WOOD);
      for (const k of n.pinIdx) pins.setColorAt(k, c);
    }
    if (pins.instanceColor) pins.instanceColor.needsUpdate = true;
  };
  paintPins($section.get());
  $section.listen(paintPins);

  // Upgrade labels to live HTML where the browser can (Canvas 2D stays until the first paint).
  installHtmlFabrics(
    engine,
    designs.map(({ design, piece }) => ({ design, widthPx: 512, onReady: (tex) => piece.setTexture(tex) })),
  );

  const tmpDir = new THREE.Vector3();
  const tmpN = [0, 0, 0] as [number, number, number];
  const tmpP = [0, 0, 0] as [number, number, number];

  for (const n of nav) {
    const { section, piece } = n;
    const id = `cloth:${section.id}`;
    registerInteractable({
      id,
      object: piece.mesh,
      label: section.label,
      onHover(hit) {
        const uv = hit?.uv;
        if (!uv) {
          n.hover = null;
          return;
        }
        const u = uv.x;
        const v = 1 - uv.y;
        if (!n.hover && !$reducedMotion.get()) {
          // A small ripple when the pointer arrives.
          tmpDir.copy(camera.position).sub(hit.point).normalize().multiplyScalar(-0.9);
          piece.impulse(u, v, 0.18, tmpDir);
        }
        n.hover = { u, v };
      },
      onActivate(hit) {
        const uv = hit.uv;
        const u = uv ? uv.x : 0.5;
        const v = uv ? 1 - uv.y : 0.5;
        // Flap: shove the cloth away from the viewer at the hit point, a little upward.
        tmpDir.copy(hit.point).sub(camera.position).normalize();
        tmpDir.y += 0.25;
        tmpDir.multiplyScalar($reducedMotion.get() ? 0.8 : 3.4);
        piece.impulse(u, v, 0.32, tmpDir);
        $section.set(section.id);
        gust(0.6);
      },
    });
    registerSurface({
      id,
      pointAt(u, v, outPoint, outNormal) {
        piece.sim.sample(u, v, tmpP, outNormal ? tmpN : undefined);
        outPoint.set(tmpP[0], tmpP[1], tmpP[2]);
        outNormal?.set(tmpN[0], tmpN[1], tmpN[2]);
      },
      uvFromHit(hit) {
        if (hit.object !== piece.mesh || !hit.uv) return null;
        return { u: hit.uv.x, v: 1 - hit.uv.y };
      },
    });
  }

  engine.onUpdate((dt, t) => {
    const reduced = $reducedMotion.get();
    const selected = $section.get();
    const highlighted = $highlighted.get();
    const gain = reduced ? 0.25 : 1;

    for (const n of nav) {
      const { piece } = n;
      const isSel = n.section.id === selected;
      const isHi = n.section.id === highlighted;
      piece.windGain = gain;

      if (!reduced) {
        if (n.hover) {
          // Lift toward the viewer and up around the pointer.
          tmpDir.copy(camera.position).sub(piece.center).setY(0).normalize();
          piece.sim.pushAt(n.hover.u, n.hover.v, 0.28, tmpDir.x * 5, 4, tmpDir.z * 5);
        }
        if (isHi) {
          // Keyboard focus on the DOM button: a sideways wiggle of the hem.
          const s = Math.sin(t * 9) * 10;
          const r = piece.right;
          piece.sim.pushAt(0.5, 0.95, 0.45, r.x * s, 1.5, r.z * s);
        }
      }

      const target = (isSel ? 0.12 : 0) + (n.hover ? 0.2 : 0) + (isHi ? 0.22 + 0.08 * Math.sin(t * 6) : 0);
      n.glow += (target - n.glow) * Math.min(1, dt * 8);
      piece.mesh.material.emissiveIntensity = n.glow;
      piece.update(dt, t);
    }

    for (const p of decor) {
      p.windGain = gain;
      p.update(dt, t);
    }
  }, ORDER.cloth);
}
