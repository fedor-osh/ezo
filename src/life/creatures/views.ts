// Scene objects for one live pointer creature. They only take poses; motion lives in the sims.
import * as THREE from "three";
import { bodyGeometry, leafColor, leafGeometry, leafTexture, wingGeometry, wingTexture } from "./art.ts";

/**
 * Wing angle of a sleeping butterfly (radians from flat). Nearly flat, like a butterfly basking on a
 * wall: folded-up wings would be seen edge-on from most camera shots and the visitor's colour lost.
 */
export const WINGS_REST = 0.3;

const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();

/**
 * Orientation for something sitting on a surface: local +Y along `normal`, head (+Z) pointing
 * "up the surface" (world up projected onto it), or along `fallbackYaw` on flat ground.
 */
export function surfaceQuaternion(normal: THREE.Vector3, fallbackYaw: number, out: THREE.Quaternion): THREE.Quaternion {
  _y.copy(normal).normalize();
  _z.set(0, 1, 0).addScaledVector(_y, -_y.y);
  if (_z.lengthSq() < 0.04) {
    _z.set(Math.sin(fallbackYaw), 0, Math.cos(fallbackYaw)).addScaledVector(_y, -_y.dot(_z));
  }
  _z.normalize();
  _x.crossVectors(_y, _z).normalize();
  _m.makeBasis(_x, _y, _z);
  return out.setFromRotationMatrix(_m);
}

export interface CreatureView {
  readonly root: THREE.Group;
  setOpacity(o: number): void;
  dispose(): void;
}

export class ButterflyView implements CreatureView {
  readonly root = new THREE.Group();
  private readonly wingR = new THREE.Group();
  private readonly wingL = new THREE.Group();
  private readonly wingMat: THREE.MeshLambertMaterial;
  private readonly bodyMat: THREE.MeshLambertMaterial;
  private readonly tex: THREE.CanvasTexture;

  constructor(color: string, seedKey: string, castShadow: boolean) {
    this.tex = wingTexture(color, seedKey);
    this.wingMat = new THREE.MeshLambertMaterial({
      map: this.tex,
      emissive: 0xffffff,
      emissiveMap: this.tex,
      emissiveIntensity: 0.22,
      side: THREE.DoubleSide,
      transparent: true,
    });
    this.bodyMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color("#3b2a33").lerp(new THREE.Color(color), 0.18),
      transparent: true,
    });
    const body = new THREE.Mesh(bodyGeometry(), this.bodyMat);
    const geo = wingGeometry();
    const r = new THREE.Mesh(geo, this.wingMat);
    const l = new THREE.Mesh(geo, this.wingMat);
    l.scale.x = -1;
    this.wingR.add(r);
    this.wingL.add(l);
    this.wingR.position.y = this.wingL.position.y = 0.002;
    for (const m of [body, r, l]) m.castShadow = castShadow;
    this.root.add(body, this.wingR, this.wingL);
  }

  /** 0 = wings flat open, positive raises them, PI/2 is upright. */
  setWings(angle: number): void {
    this.wingR.rotation.z = angle;
    this.wingL.rotation.z = -angle;
  }

  setOpacity(o: number): void {
    this.wingMat.opacity = this.bodyMat.opacity = o;
    this.root.visible = o > 0.01;
  }

  dispose(): void {
    this.tex.dispose();
    this.wingMat.dispose();
    this.bodyMat.dispose();
  }
}

export class LeafView implements CreatureView {
  readonly root = new THREE.Group();
  /** Rotates around the leaf's long axis (tumbling). */
  readonly tumble = new THREE.Group();
  private readonly mat: THREE.MeshLambertMaterial;

  constructor(color: string, seedKey: string, castShadow: boolean) {
    this.mat = new THREE.MeshLambertMaterial({
      color: leafColor(color, seedKey),
      map: leafTexture(),
      side: THREE.DoubleSide,
      transparent: true,
    });
    const mesh = new THREE.Mesh(leafGeometry(), this.mat);
    // Lay the leaf flat, face up, tip toward +Z (the root's forward).
    mesh.rotation.set(-Math.PI / 2, Math.PI, 0, "YXZ");
    mesh.scale.setScalar(1.25);
    mesh.castShadow = castShadow;
    this.tumble.add(mesh);
    this.root.add(this.tumble);
  }

  setOpacity(o: number): void {
    this.mat.opacity = o;
    this.root.visible = o > 0.01;
  }

  dispose(): void {
    this.mat.dispose();
  }
}
