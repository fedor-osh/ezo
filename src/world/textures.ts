// Small canvas textures: license plate, Soviet mosaic, faded shop sign, tablecloth, nardi board.
import * as THREE from "three";
import { rng } from "./kit.ts";

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) throw new Error("2d canvas unavailable");
  return [c, g];
}

function tex(c: HTMLCanvasElement, anisotropy = 4): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  return t;
}

export function plateTexture(text = "FO·2026"): THREE.CanvasTexture {
  const [c, g] = canvas(256, 64);
  g.fillStyle = "#f4f2ea";
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = "#2a55a8";
  g.fillRect(0, 0, 46, 64);
  g.fillStyle = "#ffffff";
  g.font = "bold 22px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("GE", 23, 34);
  g.fillStyle = "#1d1d1f";
  g.font = "bold 40px 'DIN Alternate', 'Arial Narrow', system-ui, sans-serif";
  g.fillText(text, 151, 35);
  g.strokeStyle = "#1d1d1f";
  g.lineWidth = 4;
  g.strokeRect(2, 2, 252, 60);
  // A little road dust in the corners.
  const grd = g.createRadialGradient(128, 32, 40, 128, 32, 150);
  grd.addColorStop(0, "rgba(160,130,90,0)");
  grd.addColorStop(1, "rgba(160,130,90,0.45)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 64);
  return tex(c);
}

/** A faded Soviet-era mosaic: a sun, a woman with grapes, the river. Rendered as tiles with a few missing. */
export function mosaicTexture(): THREE.CanvasTexture {
  const W = 384;
  const H = 288;
  const [, s] = canvas(W, H);
  const sky = s.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#3f7fc0");
  sky.addColorStop(0.65, "#8cc4e4");
  sky.addColorStop(1, "#2f6fa8");
  s.fillStyle = sky;
  s.fillRect(0, 0, W, H);
  // Sun and rays.
  s.fillStyle = "#f7c23b";
  for (let i = 0; i < 12; i++) {
    s.save();
    s.translate(96, 84);
    s.rotate((i / 12) * Math.PI * 2);
    s.fillRect(-6, 40, 12, 34);
    s.restore();
  }
  s.beginPath();
  s.arc(96, 84, 38, 0, Math.PI * 2);
  s.fill();
  s.fillStyle = "#f08a2c";
  s.beginPath();
  s.arc(96, 84, 22, 0, Math.PI * 2);
  s.fill();
  // River waves.
  for (let k = 0; k < 4; k++) {
    s.strokeStyle = k % 2 ? "#e8f3f8" : "#1f5e93";
    s.lineWidth = 9;
    s.beginPath();
    for (let x = 0; x <= W; x += 8) s.lineTo(x, 236 + k * 13 + Math.sin(x * 0.05 + k) * 6);
    s.stroke();
  }
  // Woman: dress, arms, head, scarf, grapes.
  s.fillStyle = "#c8303d";
  s.beginPath();
  s.moveTo(250, 92);
  s.lineTo(292, 92);
  s.lineTo(318, 236);
  s.lineTo(224, 236);
  s.closePath();
  s.fill();
  s.fillStyle = "#f3d27a";
  s.fillRect(238, 150, 66, 10);
  s.fillStyle = "#e9b38a";
  s.beginPath();
  s.arc(271, 70, 22, 0, Math.PI * 2);
  s.fill();
  s.fillStyle = "#1e2a3a";
  s.beginPath();
  s.arc(271, 62, 23, Math.PI, 0);
  s.fill();
  s.strokeStyle = "#e9b38a";
  s.lineWidth = 12;
  s.beginPath();
  s.moveTo(256, 110);
  s.lineTo(222, 140);
  s.lineTo(206, 118);
  s.stroke();
  s.fillStyle = "#6a2f86";
  for (let i = 0; i < 9; i++) {
    s.beginPath();
    s.arc(200 + (i % 3) * 9 - (i > 5 ? -4 : 0), 112 + Math.floor(i / 3) * 10, 7, 0, Math.PI * 2);
    s.fill();
  }
  s.fillStyle = "#4b9a3c";
  s.beginPath();
  s.ellipse(202, 98, 14, 7, -0.4, 0, Math.PI * 2);
  s.fill();
  // Vine border.
  s.strokeStyle = "#e0a63a";
  s.lineWidth = 14;
  s.strokeRect(7, 7, W - 14, H - 14);

  const [c, g] = canvas(W, H);
  g.fillStyle = "#8f8a80";
  g.fillRect(0, 0, W, H);
  const data = s.getImageData(0, 0, W, H).data;
  const rand = rng(99);
  const T = 8;
  for (let y = 0; y < H; y += T) {
    for (let x = 0; x < W; x += T) {
      if (rand() < 0.035) continue; // fallen tile
      const i = ((y + T / 2) * W + (x + T / 2)) * 4;
      const fade = 0.1 + rand() * 0.1;
      const j = (rand() - 0.5) * 24;
      const r = data[i] * (1 - fade) + 235 * fade + j;
      const gg = data[i + 1] * (1 - fade) + 225 * fade + j;
      const b = data[i + 2] * (1 - fade) + 210 * fade + j;
      g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`;
      g.fillRect(x + 0.6, y + 0.6, T - 1.2, T - 1.2);
    }
  }
  return tex(c);
}

export function signTexture(text: string): THREE.CanvasTexture {
  const [c, g] = canvas(512, 128);
  g.fillStyle = "#e9dcbc";
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = "#5b7fa6";
  g.lineWidth = 6;
  g.strokeRect(8, 8, 496, 112);
  g.fillStyle = "rgba(55, 95, 150, 0.75)";
  g.font = "bold 86px 'Futura', 'Century Gothic', system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256, 68);
  // Weathering: rust streaks and flaked paint.
  const rand = rng(5);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = rand() < 0.6 ? "rgba(233,220,188,0.85)" : "rgba(150,90,50,0.35)";
    const w = 4 + rand() * 30;
    g.fillRect(rand() * 512, rand() * 128, w, 2 + rand() * 6);
  }
  for (let i = 0; i < 6; i++) {
    const x = rand() * 512;
    const grd = g.createLinearGradient(x, 0, x, 128);
    grd.addColorStop(0, "rgba(140,80,40,0.4)");
    grd.addColorStop(1, "rgba(140,80,40,0)");
    g.fillStyle = grd;
    g.fillRect(x, 0, 6, 128);
  }
  return tex(c);
}

/** White supra tablecloth with a red cross-stitch border and tiny blue flowers. */
export function tableclothTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 512);
  g.fillStyle = "#fbf7ee";
  g.fillRect(0, 0, 1024, 512);
  const rand = rng(17);
  // Faint woven texture.
  for (let i = 0; i < 1024; i += 4) {
    g.fillStyle = `rgba(200,190,170,${0.05 + rand() * 0.05})`;
    g.fillRect(i, 0, 1, 512);
  }
  const border = (inset: number) => {
    g.fillStyle = "#c62f3f";
    for (let x = inset; x < 1024 - inset; x += 16) {
      for (const y of [inset, 512 - inset - 12]) {
        g.fillRect(x, y, 6, 6);
        g.fillRect(x + 6, y + 6, 6, 6);
      }
    }
    for (let y = inset; y < 512 - inset; y += 16) {
      for (const x of [inset, 1024 - inset - 12]) {
        g.fillRect(x, y, 6, 6);
        g.fillRect(x + 6, y + 6, 6, 6);
      }
    }
  };
  border(10);
  g.fillStyle = "#2f5fa8";
  g.fillRect(36, 36, 952, 3);
  g.fillRect(36, 473, 952, 3);
  g.fillRect(36, 36, 3, 440);
  g.fillRect(985, 36, 3, 440);
  for (let i = 0; i < 70; i++) {
    const x = 60 + rand() * 904;
    const y = 60 + rand() * 392;
    g.fillStyle = rand() < 0.7 ? "#3d6fb8" : "#d24b5a";
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.arc(x + Math.cos(k * 1.57) * 4, y + Math.sin(k * 1.57) * 4, 3, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#f2c94c";
    g.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  // A wine stain: proof of a good supra.
  g.fillStyle = "rgba(140,40,70,0.18)";
  g.beginPath();
  g.ellipse(690, 300, 26, 18, 0.4, 0, Math.PI * 2);
  g.fill();
  return tex(c, 8);
}

export function nardiTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 256);
  g.fillStyle = "#8a5634";
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = "#e9cf9c";
  g.fillRect(14, 14, 236, 228);
  g.fillRect(262, 14, 236, 228);
  const tri = (x: number, top: boolean, dark: boolean) => {
    g.fillStyle = dark ? "#7a2c22" : "#2f4a3a";
    g.beginPath();
    if (top) {
      g.moveTo(x, 14);
      g.lineTo(x + 39, 14);
      g.lineTo(x + 19.5, 110);
    } else {
      g.moveTo(x, 242);
      g.lineTo(x + 39, 242);
      g.lineTo(x + 19.5, 146);
    }
    g.fill();
  };
  for (let i = 0; i < 6; i++) {
    tri(14 + i * 39.3, true, i % 2 === 0);
    tri(14 + i * 39.3, false, i % 2 === 1);
    tri(262 + i * 39.3, true, i % 2 === 0);
    tri(262 + i * 39.3, false, i % 2 === 1);
  }
  return tex(c);
}
