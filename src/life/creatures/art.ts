// Procedural art for pointer creatures and traces: wing/leaf geometry and canvas textures.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { hashString, seeded } from "./util.ts";

// ------------------------------------------------------------------------------------------------
// Butterfly wings. Built in the XY plane (x = outward span, y = forward), then laid flat (y → +z).
// Forewing and hindwing of one side share a geometry; their UVs point at the left/right half of a
// 2:1 texture.

/** Half wingspan of the unscaled butterfly is ~0.08 m. */
function forewingShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0.004, 0.006);
  s.bezierCurveTo(0.02, 0.03, 0.05, 0.042, 0.078, 0.04);
  s.bezierCurveTo(0.083, 0.03, 0.074, 0.008, 0.06, -0.004);
  s.bezierCurveTo(0.04, -0.008, 0.02, -0.006, 0.003, -0.002);
  s.closePath();
  return s;
}

function hindwingShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0.003, -0.001);
  s.bezierCurveTo(0.03, -0.004, 0.058, -0.016, 0.056, -0.034);
  s.bezierCurveTo(0.054, -0.05, 0.04, -0.058, 0.03, -0.066);
  s.bezierCurveTo(0.024, -0.06, 0.012, -0.04, 0.002, -0.014);
  s.closePath();
  return s;
}

interface Box2 {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function shapeBox(shape: THREE.Shape): Box2 {
  const pts = shape.getPoints(16);
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of pts) {
    b.minX = Math.min(b.minX, p.x);
    b.minY = Math.min(b.minY, p.y);
    b.maxX = Math.max(b.maxX, p.x);
    b.maxY = Math.max(b.maxY, p.y);
  }
  return b;
}

function remapUv(geo: THREE.BufferGeometry, box: Box2, u0: number, u1: number): void {
  const pos = geo.getAttribute("position");
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) - box.minX) / (box.maxX - box.minX);
    const v = (pos.getY(i) - box.minY) / (box.maxY - box.minY);
    uv.setXY(i, u0 + u * (u1 - u0), v);
  }
  uv.needsUpdate = true;
}

const FORE = forewingShape();
const HIND = hindwingShape();
const FORE_BOX = shapeBox(FORE);
const HIND_BOX = shapeBox(HIND);

let wingGeoCache: THREE.BufferGeometry | null = null;
/** One side's wings (right side, +X). Mirror with scale.x = -1 for the left side. */
export function wingGeometry(): THREE.BufferGeometry {
  if (wingGeoCache) return wingGeoCache;
  const fore = new THREE.ShapeGeometry(FORE, 10);
  remapUv(fore, FORE_BOX, 0, 0.5);
  const hind = new THREE.ShapeGeometry(HIND, 10);
  remapUv(hind, HIND_BOX, 0.5, 1);
  // Hindwing sits a hair below the forewing so they don't z-fight where they overlap.
  hind.translate(0, 0, -0.0008);
  const g = mergeGeometries([fore, hind])!;
  g.rotateX(Math.PI / 2);
  // A slight dihedral curl at the tips reads as "soft" wings.
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setY(i, pos.getY(i) + x * x * 2.2);
  }
  g.computeVertexNormals();
  wingGeoCache = g;
  return g;
}

let bodyGeoCache: THREE.BufferGeometry | null = null;
/** Slim body along +Z with head and two antennae. */
export function bodyGeometry(): THREE.BufferGeometry {
  if (bodyGeoCache) return bodyGeoCache;
  const parts: THREE.BufferGeometry[] = [];
  const abdomen = new THREE.CapsuleGeometry(0.0055, 0.042, 3, 6);
  abdomen.rotateX(Math.PI / 2);
  abdomen.translate(0, 0, -0.008);
  parts.push(abdomen);
  const head = new THREE.SphereGeometry(0.0068, 8, 6);
  head.translate(0, 0.001, 0.024);
  parts.push(head);
  for (const side of [-1, 1]) {
    const len = 0.03;
    const ant = new THREE.CylinderGeometry(0.0006, 0.0008, len, 3, 1);
    ant.translate(0, len / 2, 0);
    ant.rotateX(0.9);
    ant.rotateZ(-side * 0.35);
    ant.translate(side * 0.002, 0.004, 0.027);
    parts.push(ant);
    const knob = new THREE.SphereGeometry(0.0016, 5, 4);
    const tip = new THREE.Vector3(0, len, 0)
      .applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.9)
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), -side * 0.35);
    knob.translate(side * 0.002 + tip.x, 0.004 + tip.y, 0.027 + tip.z);
    parts.push(knob);
  }
  bodyGeoCache = mergeGeometries(parts)!;
  return bodyGeoCache;
}

// ------------------------------------------------------------------------------------------------
// Wing textures.

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
}

function tracePath(ctx: CanvasRenderingContext2D, shape: THREE.Shape, box: Box2, x0: number, w: number, h: number): void {
  const pts = shape.getPoints(20);
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = x0 + ((p.x - box.minX) / (box.maxX - box.minX)) * w;
    const y = (1 - (p.y - box.minY) / (box.maxY - box.minY)) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

const toCanvas = (box: Box2, x0: number, w: number, h: number) => (x: number, y: number): [number, number] => [
  x0 + ((x - box.minX) / (box.maxX - box.minX)) * w,
  (1 - (y - box.minY) / (box.maxY - box.minY)) * h,
];

const css = (c: THREE.Color) => `#${c.getHexString()}`;

/**
 * Pretty wing print tinted by the visitor's colour. `seedKey` picks one of a few patterns
 * (veined monarch, eye-spotted, banded) so butterflies differ beyond colour.
 */
export function wingTexture(color: string, seedKey: string): THREE.CanvasTexture {
  const W = 256;
  const H = 128;
  const [c, ctx] = canvas(W, H);
  const seed = hashString(seedKey);
  const variant = seed % 3;
  const base = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  const light = new THREE.Color().setHSL(hsl.h + 0.04, Math.min(1, hsl.s * 0.9 + 0.1), Math.min(0.85, hsl.l + 0.22));
  // A neutral (grey) base is used for instanced sleepers tinted per instance: keep the accent neutral too.
  const accent =
    hsl.s < 0.05
      ? new THREE.Color("#c9c4bd")
      : new THREE.Color().setHSL((hsl.h + 0.12 + seeded(seed, 1) * 0.1) % 1, 0.85, 0.6);
  const dark = new THREE.Color("#2a1b2e").lerp(base, 0.15);
  const cream = "#fff6e4";

  const wings: Array<[THREE.Shape, Box2, number]> = [
    [FORE, FORE_BOX, 0],
    [HIND, HIND_BOX, W / 2],
  ];
  for (const [shape, box, x0] of wings) {
    const w = W / 2;
    const at = toCanvas(box, x0, w, H);
    ctx.save();
    tracePath(ctx, shape, box, x0, w, H);
    ctx.clip();
    // Root → tip gradient.
    const [rx, ry] = at(0, 0);
    const g = ctx.createRadialGradient(rx, ry, 2, rx, ry, w * 1.1);
    g.addColorStop(0, css(light));
    g.addColorStop(0.55, css(base));
    g.addColorStop(1, css(base.clone().multiplyScalar(0.8)));
    ctx.fillStyle = g;
    ctx.fillRect(x0, 0, w, H);

    if (variant === 2) {
      // Bands across the wing.
      ctx.strokeStyle = css(accent);
      ctx.lineWidth = 9;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        const r = w * (0.45 + i * 0.25);
        ctx.arc(rx, ry, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Veins radiating from the root.
    ctx.strokeStyle = css(dark);
    ctx.globalAlpha = variant === 0 ? 0.85 : 0.35;
    ctx.lineWidth = variant === 0 ? 2.2 : 1.2;
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.55 + (i / 6) * Math.PI * 1.1 + (x0 > 0 ? Math.PI * 0.35 : -Math.PI * 0.1);
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.quadraticCurveTo(rx + Math.cos(a) * w * 0.4, ry - Math.sin(a) * w * 0.25, rx + Math.cos(a) * w * 1.2, ry - Math.sin(a) * w * 0.9);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (variant === 1) {
      // Eye spot.
      const [ex, ey] = x0 === 0 ? at(0.055, 0.025) : at(0.04, -0.035);
      const r = x0 === 0 ? 13 : 11;
      ctx.fillStyle = css(dark);
      ctx.beginPath();
      ctx.arc(ex, ey, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = css(accent);
      ctx.beginPath();
      ctx.arc(ex, ey, r * 0.68, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cream;
      ctx.beginPath();
      ctx.arc(ex - r * 0.2, ey - r * 0.2, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Dark border with little cream dots, like a monarch's.
    ctx.save();
    tracePath(ctx, shape, box, x0, w, H);
    ctx.clip();
    tracePath(ctx, shape, box, x0, w, H);
    ctx.strokeStyle = css(dark);
    ctx.lineWidth = variant === 0 ? 14 : 9;
    ctx.stroke();
    const pts = shape.getSpacedPoints(26);
    ctx.fillStyle = cream;
    for (let i = 2; i < pts.length - 3; i += 2) {
      const [px, py] = at(pts[i].x, pts[i].y);
      // Pull the dot slightly inward toward the root so it sits inside the border.
      const dx = rx - px;
      const dy = ry - py;
      const d = Math.hypot(dx, dy) || 1;
      ctx.beginPath();
      ctx.arc(px + (dx / d) * 3, py + (dy / d) * 3, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  return tex;
}

// ------------------------------------------------------------------------------------------------
// Grape-vine leaf: a polar outline (five lobes, toothed edge, deep sinus at the stem) triangulated
// as a fan from the stem point with an inner ring, so it can be cupped and curled.

function leafRadius(phi: number): number {
  const lobes: Array<[number, number]> = [
    [0, 1],
    [1.05, 0.82],
    [-1.05, 0.82],
    [2.05, 0.55],
    [-2.05, 0.55],
  ];
  let lobe = 0;
  for (const [c, wgt] of lobes) lobe = Math.max(lobe, wgt * Math.exp(-(((phi - c) / 0.42) ** 2)));
  let r = 0.6 + 0.4 * lobe;
  // Deep sinus where the stem joins.
  const a = Math.abs(phi);
  r *= 0.25 + 0.75 * Math.min(1, Math.max(0, (Math.PI - a) / 0.75));
  // Serrated edge: a sawtooth with ~30 teeth.
  const tooth = ((((phi + Math.PI) / (Math.PI * 2)) * 30) % 1 + 1) % 1;
  r *= 1 + 0.07 * (1 - tooth) * (0.4 + 0.6 * lobe);
  return r * 0.5;
}

let leafGeoCache: THREE.BufferGeometry | null = null;
/** Unit leaf ~0.14 m long, stem at the origin, tip toward +Y in the XY plane (face +Z). */
export function leafGeometry(): THREE.BufferGeometry {
  if (leafGeoCache) return leafGeoCache;
  const N = 90;
  const L = 0.14;
  const center = [0, 0.32];
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  // Vertex 0 = centre of the blade.
  const push = (x: number, y: number) => {
    positions.push(x * L, y * L, 0);
    uvs.push(0.5 + x, y);
  };
  push(center[0], center[1]);
  for (let ring = 1; ring <= 2; ring++) {
    for (let i = 0; i < N; i++) {
      const phi = -Math.PI + (i / N) * Math.PI * 2;
      const r = leafRadius(phi) * (ring === 1 ? 0.55 : 1);
      // Polar around a point a little above the stem; the sinus reaches back to the stem.
      push(center[0] + Math.sin(phi) * r * 1.0, center[1] + Math.cos(phi) * r * 1.25);
    }
  }
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const a1 = 1 + i;
    const b1 = 1 + j;
    const a2 = 1 + N + i;
    const b2 = 1 + N + j;
    index.push(0, a1, b1);
    index.push(a1, a2, b2, a1, b2, b1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  // Cup across the midrib and curl the tip a little.
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / L;
    const y = pos.getY(i) / L;
    pos.setZ(i, (x * x * 0.32 + (y - 0.3) ** 2 * 0.12) * L);
  }
  // Recentre so the leaf rotates around its middle, and add a short stem.
  g.translate(0, -0.32 * L, -0.02 * L);
  const stem = new THREE.CylinderGeometry(0.0012, 0.0018, 0.035, 3, 1);
  stem.translate(0, -0.32 * L - 0.012, 0);
  stem.deleteAttribute("normal");
  const merged = mergeGeometries([g, stem])!;
  merged.computeVertexNormals();
  leafGeoCache = merged;
  return merged;
}

let leafTexCache: THREE.CanvasTexture | null = null;
/** Grey-scale veins on white, tinted by the material colour. */
export function leafTexture(): THREE.CanvasTexture {
  if (leafTexCache) return leafTexCache;
  const S = 128;
  const [c, ctx] = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S * 0.7, 4, S / 2, S * 0.55, S * 0.6);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#d9d2c4");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // Canvas y is down; uv v grows upward. The blade's stem point sits at v ≈ 0.27, the tip at v ≈ 0.95.
  const sx = S / 2;
  const sy = S * (1 - 0.27);
  ctx.strokeStyle = "rgba(90,70,40,0.5)";
  ctx.lineCap = "round";
  for (const [a, len, w] of [
    [0, 0.66, 3],
    [1.0, 0.5, 2.2],
    [-1.0, 0.5, 2.2],
    [2.0, 0.34, 1.6],
    [-2.0, 0.34, 1.6],
  ] as const) {
    ctx.lineWidth = w;
    const ex = sx + Math.sin(a) * len * S;
    const ey = sy - Math.cos(a) * len * S;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + Math.sin(a * 0.8) * len * S * 0.5, sy - Math.cos(a * 0.8) * len * S * 0.55, ex, ey);
    ctx.stroke();
    // Side veinlets angled toward the tip of the vein.
    ctx.lineWidth = 0.9;
    for (let k = 1; k < 4; k++) {
      const t = k / 4;
      const px = sx + (ex - sx) * t;
      const py = sy + (ey - sy) * t;
      for (const side of [-1, 1]) {
        const b = a + side * 0.8;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.sin(b) * 10 * (1 - t * 0.5), py - Math.cos(b) * 10 * (1 - t * 0.5));
        ctx.stroke();
      }
    }
  }
  leafTexCache = new THREE.CanvasTexture(c);
  leafTexCache.colorSpace = THREE.SRGBColorSpace;
  return leafTexCache;
}

const AUTUMN = ["#e9a23b", "#c8553d", "#a83a4b", "#9a9f3a", "#d9822b"];
/** Visitor colour mixed with an autumn hue, so a leaf is recognisably theirs but still leafy. */
export function leafColor(color: string, seedKey: string): THREE.Color {
  const autumn = new THREE.Color(AUTUMN[hashString(seedKey) % AUTUMN.length]);
  return new THREE.Color(color).lerp(autumn, 0.42);
}

// ------------------------------------------------------------------------------------------------

let dotTexCache: THREE.CanvasTexture | null = null;
/** Soft round dot for ghost trails. */
export function dotTexture(): THREE.CanvasTexture {
  if (dotTexCache) return dotTexCache;
  const S = 32;
  const [c, ctx] = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.6)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  dotTexCache = new THREE.CanvasTexture(c);
  return dotTexCache;
}

/** A small pill with the visitor's name, for remote creatures. Returns texture and aspect (w/h). */
export function nameTagTexture(name: string, color: string): { texture: THREE.CanvasTexture; aspect: number } {
  const H = 48;
  const font = `600 26px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const [, mctx] = canvas(8, 8);
  mctx.font = font;
  const textW = Math.ceil(mctx.measureText(name).width);
  const W = Math.min(512, textW + 58);
  const [c, ctx] = canvas(W, H);
  const r = H / 2 - 4;
  ctx.fillStyle = "rgba(255, 248, 236, 0.82)";
  ctx.beginPath();
  ctx.roundRect(2, 4, W - 4, H - 8, r);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(4 + r, H / 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = font;
  ctx.fillStyle = "#3a2a2a";
  ctx.textBaseline = "middle";
  ctx.fillText(name, 4 + r + 14, H / 2 + 1);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, aspect: W / H };
}
