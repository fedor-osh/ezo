// One piece of laundry: Verlet sim + a mesh whose position buffer IS the sim's array.
import * as THREE from "three";
import { windAt } from "../core/wind.ts";
import { lineDir, lineLength, sagPoint, type PinPlacement, type Sag } from "./line.ts";
import { insidePolygon, type ShapeSpec } from "./shapes.ts";
import { DEFAULT_STEP, FixedStepper, VerletCloth, type StepParams, type Vec3 } from "./verlet.ts";

const STEP = 1 / 90;
/** The cloth hangs a hair below the rope's centre, inside the pin jaws. */
const DROP = 0.012;

export interface PieceOptions {
  shape: ShapeSpec;
  line: Sag;
  /** Centre of the piece along the line, t ∈ [0, 1]. */
  t: number;
  texture: THREE.Texture;
  iterations: number;
  density?: number;
  /** Per-piece wind multiplier (heavy carpet < light sock). */
  windScale?: number;
  castShadow: boolean;
  seed: number;
}

export class ClothPiece {
  readonly sim: VerletCloth;
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly pins: PinPlacement[] = [];
  readonly center = new THREE.Vector3();
  /** Horizontal direction the u axis runs along. */
  readonly right = new THREE.Vector3();
  /** Front-face direction at rest. */
  readonly front = new THREE.Vector3();
  /** Global wind multiplier set by the owner every frame (reduced motion…). */
  windGain = 1;

  private readonly stepper = new FixedStepper(STEP, 4);
  private readonly params: StepParams;
  private readonly windScale: number;
  private readonly baseWind = new THREE.Vector3();
  private readonly phase: number;
  private time = 0;

  constructor(opts: PieceOptions) {
    const { shape, line } = opts;
    const L = lineLength(line);
    const span = shape.width / L;
    const t0 = opts.t - span / 2;
    const dy = shape.height / (shape.rows - 1);
    const p = new THREE.Vector3();
    this.windScale = opts.windScale ?? 1;
    this.phase = opts.seed * 1.618;

    this.sim = new VerletCloth({
      cols: shape.cols,
      rows: shape.rows,
      width: shape.width,
      height: shape.height,
      density: opts.density,
      pins: shape.pins,
      mask: (cu, cv) => insidePolygon(shape.outline, cu, cv),
      place: (col, row, out: Vec3) => {
        sagPoint(line, t0 + (col / (shape.cols - 1)) * span, p);
        out[0] = p.x;
        out[1] = p.y - DROP - row * dy;
        out[2] = p.z;
      },
    });

    lineDir(line, this.right);
    this.front.crossVectors(new THREE.Vector3(0, -1, 0), this.right).normalize();
    sagPoint(line, opts.t, this.center).y -= shape.height / 2;

    for (const k of this.sim.pins) {
      const col = k % shape.cols;
      this.pins.push({
        position: sagPoint(line, t0 + (col / (shape.cols - 1)) * span),
        along: this.right.clone(),
      });
    }

    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(this.sim.pos, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", posAttr);
    const uv = new Float32Array(this.sim.count * 2);
    for (let j = 0; j < shape.rows; j++) {
      for (let i = 0; i < shape.cols; i++) {
        const k = j * shape.cols + i;
        uv[k * 2] = i / (shape.cols - 1);
        uv[k * 2 + 1] = 1 - j / (shape.rows - 1);
      }
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(this.sim.indices, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    const material = new THREE.MeshStandardMaterial({
      map: opts.texture,
      // Emissive through the same map: "glow" brightens the print instead of washing it out.
      emissiveMap: opts.texture,
      emissive: 0xffffff,
      emissiveIntensity: 0,
      roughness: 0.92,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.castShadow = opts.castShadow;
    this.mesh.receiveShadow = true;
    // Positions are world-space; the bounding sphere is refreshed after each sim step, so
    // frustum culling and raycasting stay correct.

    const wind = (x: number, y: number, z: number, out: Vec3) => {
      // Shared wind at the piece centre plus a travelling ripple across the fabric: billows.
      // The cross term pushes through the fabric even when the wind runs along the line.
      const b = this.baseWind;
      const bl = b.length();
      const ripple = 1 + 0.4 * Math.sin(x * 2.3 + z * 1.9 + y * 3.1 - this.time * 2.6 + this.phase);
      const cross = 0.45 * bl * Math.sin(this.time * 1.7 + x * 1.3 + z * 1.1 + this.phase);
      out[0] = b.x * ripple + this.front.x * cross;
      out[1] = b.y + 0.25 * Math.sin(this.time * 3.3 + x * 4 + this.phase) * bl;
      out[2] = b.z * ripple + this.front.z * cross;
    };
    this.params = { ...DEFAULT_STEP, iterations: opts.iterations, wind };
  }

  setTexture(texture: THREE.Texture): void {
    const old = this.mesh.material.map;
    this.mesh.material.map = texture;
    this.mesh.material.emissiveMap = texture;
    this.mesh.material.needsUpdate = true;
    if (old && old !== texture) old.dispose();
  }

  update(dt: number, t: number): void {
    this.time = t;
    windAt(this.center, t, this.baseWind).multiplyScalar(this.windScale * this.windGain);
    const steps = this.stepper.advance(dt);
    for (let i = 0; i < steps; i++) this.sim.step(STEP, this.params);
    this.sim.clearPush();
    if (steps === 0) return;
    const geo = this.mesh.geometry;
    geo.getAttribute("position").needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }

  /** Push the cloth at surface coords with a velocity (m/s), e.g. on click. */
  impulse(u: number, v: number, radius: number, vel: THREE.Vector3): void {
    this.sim.addVelocityAt(u, v, radius, vel.x, vel.y, vel.z, STEP);
  }
}
