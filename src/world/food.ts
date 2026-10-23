// Georgian supra food, as vertex-coloured geometries (unit: metres, sitting on y = 0).
import * as THREE from "three";
import { lathe, vertexPaint } from "./kit.ts";

const hash = (x: number, y: number, z: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Shoti / puri: canoe-shaped bread, golden with a darker crust and pointed, slightly lifted tips. */
export function puri(len = 0.44, width = 0.13, h = 0.075): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 22, 10);
  const pos = g.attributes.position;
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const ax = Math.abs(p.x);
    const taper = Math.pow(Math.max(0, 1 - ax * ax), 0.75);
    let y = p.y * taper;
    if (y < -0.35 * taper) y = -0.35 * taper; // flat bottom
    const ridge = Math.exp(-Math.pow(p.z * 3.5, 2)) * 0.12 * taper; // a gentle raised spine
    pos.setXYZ(i, p.x * len * 0.5, (y + (y > 0 ? ridge : 0)) * h + ax * ax * h * 0.55 + h * 0.35, p.z * taper * width * 0.5);
  }
  g.computeVertexNormals();
  const golden = new THREE.Color("#dc9433");
  const crust = new THREE.Color("#a3581b");
  const dark = new THREE.Color("#6e3a14");
  const pale = new THREE.Color("#ecc98c");
  return vertexPaint(g, (q, c) => {
    const top = THREE.MathUtils.clamp((q.y - h * 0.3) / (h * 0.9), 0, 1);
    const tip = Math.pow(Math.abs(q.x) / (len * 0.5), 3);
    c.copy(pale).lerp(golden, Math.min(1, top * 2.2));
    c.lerp(crust, top * 0.55 + tip * 0.5);
    if (hash(q.x, q.y, q.z) > 0.93 && top > 0.3) c.lerp(dark, 0.6);
  });
}

/** Khachapuri adjaruli: bread boat with melted cheese (yolk and butter are added separately). */
export function khachapuriBoat(len = 0.42, width = 0.2): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(1, 0.36, 10, 36).rotateX(Math.PI / 2);
  const pos = g.attributes.position;
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const ax = Math.min(1.3, Math.abs(p.x));
    const pinch = Math.max(0.05, 1 - Math.pow(ax / 1.3, 2.4));
    const lift = Math.pow(ax / 1.3, 4) * 0.5;
    pos.setXYZ(i, p.x * len * 0.42, (p.y + 0.36 + lift) * 0.12, p.z * width * 0.5 * pinch);
  }
  g.computeVertexNormals();
  const golden = new THREE.Color("#e39a35");
  const crust = new THREE.Color("#a5561a");
  const pale = new THREE.Color("#f0cd84");
  return vertexPaint(g, (q, c) => {
    const top = THREE.MathUtils.clamp(q.y / 0.085, 0, 1);
    c.copy(pale).lerp(golden, top).lerp(crust, Math.pow(top, 3) * 0.6 + (Math.abs(q.x) > len * 0.4 ? 0.3 : 0));
  });
}

/** The cheese pool inside the boat, blistered. */
export function cheesePool(len = 0.42, width = 0.2): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const pinch = Math.max(0.05, 1 - Math.pow(Math.abs(x), 2.4));
    pos.setXYZ(i, x * len * 0.34, 0.05 + (1 - x * x - z * z) * 0.012, z * width * 0.33 * pinch);
  }
  g.computeVertexNormals();
  const cheese = new THREE.Color("#ffd23a");
  const blister = new THREE.Color("#e8902a");
  return vertexPaint(g, (q, c) => {
    c.copy(cheese);
    if (hash(q.x * 3, 0, q.z * 3) > 0.8) c.lerp(blister, 0.6);
  });
}

/** Khinkali: pleated dumpling with a topknot. */
export function khinkali(r = 0.048): THREE.BufferGeometry {
  const prof: Array<[number, number]> = [
    [0.001, 0],
    [r * 0.8, 0.004],
    [r, r * 0.35],
    [r * 0.95, r * 0.7],
    [r * 0.7, r * 1.05],
    [r * 0.35, r * 1.35],
    [r * 0.2, r * 1.5],
    [r * 0.26, r * 1.62],
    [r * 0.24, r * 1.78],
    [0.001, r * 1.84],
  ];
  const g = lathe(prof, 18);
  const pos = g.attributes.position;
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const a = Math.atan2(p.z, p.x);
    const t = THREE.MathUtils.clamp((p.y - r * 0.5) / (r * 1.0), 0, 1);
    const k = 1 + Math.sin(a * 9) * 0.12 * t;
    pos.setXYZ(i, p.x * k, p.y, p.z * k);
  }
  g.computeVertexNormals();
  const dough = new THREE.Color("#f2e3c4");
  const shade = new THREE.Color("#dcc59c");
  return vertexPaint(g, (q, c) => {
    const a = Math.atan2(q.z, q.x);
    c.copy(dough).lerp(shade, (0.5 + 0.5 * Math.sin(a * 9 + 1.2)) * 0.5 * THREE.MathUtils.clamp(q.y / r - 0.5, 0, 1));
  });
}

/** Doqi: a clay wine jug with a spouted lip (the handle is added separately). */
export function doqi(): THREE.BufferGeometry {
  const g = lathe(
    [
      [0.001, 0],
      [0.06, 0],
      [0.07, 0.015],
      [0.105, 0.08],
      [0.11, 0.13],
      [0.09, 0.2],
      [0.045, 0.25],
      [0.04, 0.29],
      [0.055, 0.31],
      [0.05, 0.315],
      [0.035, 0.3],
    ],
    16,
  );
  const clay = new THREE.Color("#b5562f");
  const band = new THREE.Color("#7a2f1b");
  return vertexPaint(g, (q, c) => {
    c.copy(clay);
    if ((q.y > 0.15 && q.y < 0.165) || (q.y > 0.18 && q.y < 0.19)) c.copy(band);
    c.multiplyScalar(0.92 + hash(q.x, q.y, q.z) * 0.1);
  });
}

/** Plate with a little rim. */
export function plate(r = 0.13): THREE.BufferGeometry {
  return lathe(
    [
      [0.001, 0.004],
      [r * 0.65, 0.004],
      [r * 0.7, 0],
      [r * 0.75, 0],
      [r, 0.018],
      [r * 0.97, 0.02],
      [r * 0.72, 0.008],
      [0.001, 0.009],
    ],
    24,
  );
}

/** Tomato: squashed sphere; the calyx is added separately. */
export function tomato(r = 0.042): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, 14, 10);
  g.scale(1, 0.82, 1).translate(0, r * 0.8, 0);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getZ(i), pos.getX(i));
    const k = 1 + Math.sin(a * 5) * 0.03;
    pos.setX(i, pos.getX(i) * k);
    pos.setZ(i, pos.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

export function calyx(r = 0.02): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(r, 5).rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 1; i < pos.count; i++) {
    const a = Math.atan2(pos.getZ(i), pos.getX(i));
    const k = 0.5 + 0.5 * Math.abs(Math.cos(a * 2.5));
    pos.setX(i, pos.getX(i) * k);
    pos.setZ(i, pos.getZ(i) * k);
  }
  return g;
}

export function cucumber(len = 0.16, r = 0.022): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(r, len - 2 * r, 4, 10).rotateZ(Math.PI / 2);
  const dark = new THREE.Color("#3f7a2a");
  const light = new THREE.Color("#7fae4a");
  return vertexPaint(g, (q, c) => {
    c.copy(dark).lerp(light, Math.max(0, q.x / (len / 2)) * 0.6 + (hash(q.x, q.y, q.z) > 0.85 ? 0.3 : 0));
  });
}

/** Kantsi: a drinking horn with a silver rim, lying on its side. */
export function hornPoints(): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector3(t * 0.26, Math.sin(t * Math.PI * 0.6) * 0.05, Math.sin(t * 2) * 0.03));
  }
  return pts;
}

export function horn(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(hornPoints());
  const g = new THREE.TubeGeometry(curve, 16, 1, 10, false);
  // Taper the tube from the mouth (t = 1) to the tip (t = 0).
  const pos = g.attributes.position;
  const pt = new THREE.Vector3();
  const per = 11;
  for (let i = 0; i < pos.count; i++) {
    const seg = Math.floor(i / per);
    const t = seg / 16;
    curve.getPointAt(t, pt);
    const r = 0.004 + t * 0.03;
    pos.setXYZ(i, pt.x + (pos.getX(i) - pt.x) * r, pt.y + (pos.getY(i) - pt.y) * r, pt.z + (pos.getZ(i) - pt.z) * r);
  }
  g.computeVertexNormals();
  const horn0 = new THREE.Color("#3a2a20");
  const horn1 = new THREE.Color("#c99a62");
  return vertexPaint(g, (q, c) => {
    c.copy(horn0).lerp(horn1, THREE.MathUtils.clamp(q.x / 0.26, 0, 1));
  });
}
