// Canvas 2D fabric painter: the texture every browser gets (and the first frame in browsers
// that later upgrade to HTML-in-Canvas). Base colour, print, weave, hand stitching, label patch.
import type { Section } from "../core/sections.ts";
import { insetPolygon, type ShapeSpec } from "./shapes.ts";

export type FabricPattern = Section["pattern"] | "rug" | "denim" | "pinstripe" | "ribbed";
export type IconKind = "heart" | "star" | "flower" | "stack" | "envelope";

export interface FabricDesign {
  base: string;
  accent: string;
  pattern: FabricPattern;
  shape: ShapeSpec;
  label?: string;
  icon?: IconKind;
  seed: number;
}

export const LABEL_FONT = 'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", "Quicksand", system-ui, sans-serif';
export const CREAM = "#fff6e3";
const INK = "#3a2a22";

/** Pixel size of a design's texture for a given width. */
export function fabricSize(d: FabricDesign, widthPx: number): { w: number; h: number } {
  return { w: widthPx, h: Math.round((widthPx * d.shape.height) / d.shape.width / 16) * 16 };
}

export function paintFabric(d: FabricDesign, widthPx: number, canvas = document.createElement("canvas")): HTMLCanvasElement {
  const { w, h } = fabricSize(d, widthPx);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const rand = mulberry(d.seed);
  const s = w / 512; // design units are for a 512 px wide cloth

  ctx.fillStyle = d.base;
  ctx.fillRect(0, 0, w, h);
  // Sun-faded top, slightly damp bottom.
  const shade = ctx.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, "rgba(255,255,255,0.10)");
  shade.addColorStop(1, "rgba(0,0,0,0.08)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);

  paintPattern(ctx, d, w, h, s, rand);
  weave(ctx, w, h, rand);
  stitchOutline(ctx, d, w, h, s);
  if (d.label) labelPatch(ctx, d, w, h, s);
  return canvas;
}

function paintPattern(ctx: CanvasRenderingContext2D, d: FabricDesign, w: number, h: number, s: number, rand: () => number) {
  const accent = d.accent;
  ctx.save();
  switch (d.pattern) {
    case "stripes": {
      // Beach-towel bands: wide accent, thin cream pinline either side.
      const band = 46 * s;
      for (let y = 30 * s, k = 0; y < h; y += band * 2.1, k++) {
        ctx.fillStyle = accent;
        ctx.fillRect(0, y, w, band);
        ctx.fillStyle = CREAM;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(0, y - 9 * s, w, 4 * s);
        ctx.fillRect(0, y + band + 5 * s, w, 4 * s);
        ctx.globalAlpha = 1;
        if (k % 2 === 1) {
          ctx.fillStyle = "rgba(255,255,255,0.25)";
          ctx.fillRect(0, y + band * 0.42, w, band * 0.16);
        }
      }
      break;
    }
    case "pinstripe": {
      ctx.fillStyle = accent;
      for (let x = 10 * s; x < w; x += 26 * s) ctx.fillRect(x, 0, 3 * s, h);
      break;
    }
    case "ribbed": {
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      for (let x = 0; x < w; x += 14 * s) ctx.fillRect(x, 0, 5 * s, h);
      ctx.fillStyle = accent;
      ctx.fillRect(0, h * 0.08, w, 22 * s);
      ctx.fillRect(0, h * 0.08 + 34 * s, w, 10 * s);
      break;
    }
    case "dots": {
      const step = 58 * s;
      ctx.fillStyle = accent;
      for (let y = 0, row = 0; y < h + step; y += step * 0.866, row++) {
        for (let x = (row % 2) * step * 0.5; x < w + step; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, 12 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = CREAM;
      ctx.globalAlpha = 0.7;
      for (let y = step * 0.433, row = 0; y < h + step; y += step * 0.866, row++) {
        for (let x = ((row + 1) % 2) * step * 0.5; x < w + step; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, 4.5 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case "checks": {
      // Gingham: translucent bands both ways, darker where they cross.
      const c = 44 * s;
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.45;
      for (let x = 0; x < w; x += c * 2) ctx.fillRect(x, 0, c, h);
      for (let y = 0; y < h; y += c * 2) ctx.fillRect(0, y, w, c);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = CREAM;
      for (let x = c * 1.5; x < w; x += c * 2) ctx.fillRect(x - 1.5 * s, 0, 3 * s, h);
      for (let y = c * 1.5; y < h; y += c * 2) ctx.fillRect(0, y - 1.5 * s, w, 3 * s);
      break;
    }
    case "flowers": {
      const n = Math.round((w * h) / (70 * s * 70 * s));
      for (let i = 0; i < n; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const r = (9 + rand() * 9) * s;
        const petal = i % 3 === 0 ? CREAM : accent;
        flower(ctx, x, y, r, rand() * Math.PI, petal, i % 3 === 0 ? accent : "#ffd23f");
        if (rand() < 0.5) leaf(ctx, x + r * 1.6, y + r * 0.8, r * 0.8, rand() * Math.PI * 2);
      }
      break;
    }
    case "denim": {
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 2 * s;
      for (let x = -h; x < w; x += 6 * s) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + h, h);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(w * 0.18, h * 0.4, w * 0.16, h * 0.5);
      ctx.fillRect(w * 0.66, h * 0.4, w * 0.16, h * 0.5);
      break;
    }
    case "rug": {
      // A little Caucasian kilim: borders, a medallion row of diamonds, hooks.
      const m = 26 * s;
      ctx.fillStyle = accent;
      ctx.fillRect(m, m, w - 2 * m, h - 2 * m);
      ctx.fillStyle = d.base;
      ctx.fillRect(m * 2, m * 2, w - 4 * m, h - 4 * m);
      ctx.fillStyle = "#35588a";
      ctx.fillRect(m * 2.6, m * 2.6, w - 5.2 * m, h - 5.2 * m);
      const cy = h / 2;
      const count = 3;
      for (let i = 0; i < count; i++) {
        const cx = w * ((i + 0.5) / count);
        const r = Math.min(w / count, h) * 0.32;
        diamond(ctx, cx, cy, r, d.base);
        diamond(ctx, cx, cy, r * 0.66, accent);
        diamond(ctx, cx, cy, r * 0.3, "#ffd23f");
      }
      ctx.fillStyle = "#ffd23f";
      for (let x = m * 3.4; x < w - m * 3; x += m * 1.1) {
        diamond(ctx, x, m * 1.5, m * 0.32, "#ffd23f");
        diamond(ctx, x, h - m * 1.5, m * 0.32, "#ffd23f");
      }
      break;
    }
    case "plain": {
      // Pillowcase hem band so plain is not boring.
      ctx.fillStyle = accent;
      ctx.fillRect(0, h - 70 * s, w, 46 * s);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(0, h - 58 * s, w, 3 * s);
      ctx.fillRect(0, h - 38 * s, w, 3 * s);
      break;
    }
  }
  ctx.restore();
}

/** Woven texture: alternating thread brightness plus a bit of random slub. */
function weave(ctx: CanvasRenderingContext2D, w: number, h: number, rand: () => number) {
  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  for (let y = 0; y < h; y++) {
    const rowSlub = (rand() - 0.5) * 6;
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const thread = ((x >> 1) + (y >> 1)) & 1 ? 7 : -7;
      const n = thread + rowSlub + (rand() - 0.5) * 10;
      px[o] = clamp255(px[o] + n);
      px[o + 1] = clamp255(px[o + 1] + n);
      px[o + 2] = clamp255(px[o + 2] + n);
    }
  }
  ctx.putImageData(img, 0, 0);
}

function stitchOutline(ctx: CanvasRenderingContext2D, d: FabricDesign, w: number, h: number, s: number) {
  const inset = 16 * s;
  const poly = insetPolygon(
    d.shape.outline.map(([u, v]) => [u * w, v * h] as [number, number]),
    inset,
  );
  ctx.save();
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.lineCap = "round";
  ctx.setLineDash([11 * s, 9 * s]);
  // Thread shadow first, then the thread: reads as stitches poking through.
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = 5 * s;
  ctx.translate(1.2 * s, 1.6 * s);
  ctx.stroke();
  ctx.translate(-1.2 * s, -1.6 * s);
  ctx.strokeStyle = d.pattern === "plain" || d.pattern === "denim" ? "#ffe9a8" : CREAM;
  ctx.lineWidth = 4 * s;
  ctx.stroke();
  ctx.restore();
}

function labelPatch(ctx: CanvasRenderingContext2D, d: FabricDesign, w: number, h: number, s: number) {
  const label = d.label ?? "";
  const { cx, cy, w: lw } = d.shape.label;
  const maxW = lw * w;
  const iconW = d.icon ? 70 * s : 0;
  let size = 120 * s;
  ctx.font = `800 ${size}px ${LABEL_FONT}`;
  const textW = ctx.measureText(label).width;
  const padX = 34 * s;
  const fit = (maxW - padX * 2 - iconW) / Math.max(1, textW);
  if (fit < 1) size *= fit;
  size = Math.min(size, h * 0.22);
  ctx.font = `800 ${size}px ${LABEL_FONT}`;
  const tw = ctx.measureText(label).width;
  const pw = Math.min(maxW, tw + padX * 2 + iconW);
  const ph = size * 1.55;
  const x = cx * w;
  const y = cy * h;
  const tilt = ((d.seed % 7) - 3) * 0.012;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  // Appliqué patch.
  ctx.shadowColor = "rgba(40,20,10,0.25)";
  ctx.shadowBlur = 8 * s;
  ctx.shadowOffsetY = 3 * s;
  ctx.fillStyle = CREAM;
  roundRect(ctx, -pw / 2, -ph / 2, pw, ph, ph * 0.32);
  ctx.fill();
  ctx.shadowColor = "transparent";
  // Running stitch around it.
  ctx.setLineDash([9 * s, 7 * s]);
  ctx.lineCap = "round";
  ctx.lineWidth = 3.5 * s;
  ctx.strokeStyle = d.accent;
  roundRect(ctx, -pw / 2 + 9 * s, -ph / 2 + 9 * s, pw - 18 * s, ph - 18 * s, ph * 0.26);
  ctx.stroke();
  ctx.setLineDash([]);

  const ink = mix(d.accent, INK, 0.45);
  const textX = iconW / 2;
  if (d.icon) drawIcon(ctx, d.icon, -pw / 2 + padX + iconW / 2 - 6 * s, 0, 26 * s, d.accent, s);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Embroidered look: a darker thread edge, then the fill, then a faint highlight.
  ctx.fillStyle = mix(ink, "#000000", 0.35);
  ctx.fillText(label, textX + 1.5 * s, size * 0.06 + 2 * s);
  ctx.fillStyle = ink;
  ctx.fillText(label, textX, size * 0.06);
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, textX - 1 * s, size * 0.06 - 1.5 * s);
  ctx.restore();
}

function drawIcon(ctx: CanvasRenderingContext2D, kind: IconKind, x: number, y: number, r: number, color: string, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4 * s;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  switch (kind) {
    case "heart": {
      ctx.beginPath();
      ctx.moveTo(0, r * 0.85);
      ctx.bezierCurveTo(-r * 1.3, -r * 0.1, -r * 0.6, -r * 1.1, 0, -r * 0.35);
      ctx.bezierCurveTo(r * 0.6, -r * 1.1, r * 1.3, -r * 0.1, 0, r * 0.85);
      ctx.fill();
      break;
    }
    case "star": {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 ? r * 0.45 : r;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "flower": {
      flower(ctx, 0, 0, r * 0.9, 0.3, color, "#ffd23f");
      break;
    }
    case "stack": {
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 1 - i * 0.22;
        roundRect(ctx, -r * 0.9 + i * r * 0.12, r * 0.45 - i * r * 0.6, r * 1.8 - i * r * 0.24, r * 0.48, r * 0.14);
        ctx.fill();
      }
      break;
    }
    case "envelope": {
      roundRect(ctx, -r, -r * 0.68, r * 2, r * 1.36, r * 0.18);
      ctx.fill();
      ctx.strokeStyle = CREAM;
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(-r * 0.78, -r * 0.45);
      ctx.lineTo(0, r * 0.12);
      ctx.lineTo(r * 0.78, -r * 0.45);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

function flower(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, petal: string, centre: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = petal;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, r * 0.5, r * 0.36, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = centre;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = "#5c9e5a";
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.7, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.8, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.8, y);
  ctx.closePath();
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Mix two #rrggbb colours. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, sh: number) => (p >> sh) & 255;
  const c = (sh: number) => Math.round(ch(pa, sh) + (ch(pb, sh) - ch(pa, sh)) * t);
  return `#${((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1)}`;
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
