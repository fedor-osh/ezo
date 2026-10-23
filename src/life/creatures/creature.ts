// One live pointer creature (ours or a peer's): sim + perching + view + presence record.
// The caller tells it where to go each frame (a `Drive`); the creature decides how to get there.
import * as THREE from "three";
import type { Identity, Perch, PointerKind } from "../../shared/protocol.ts";
import type { Flyer } from "../../core/presence.ts";
import { surfaces } from "../../core/surfaces.ts";
import { windAt } from "../../core/wind.ts";
import { createButterflyState, stepButterfly, type ButterflyState } from "./butterflySim.ts";
import { createLeafState, stepLeaf, type LeafState } from "./leafSim.ts";
import { startRide, stepRide, type PerchRide, type SurfaceLike } from "./perch.ts";
import { nameTagTexture } from "./art.ts";
import { ButterflyView, LeafView, WINGS_REST, surfaceQuaternion } from "./views.ts";
import { clamp, damp, hashString, seeded } from "./util.ts";

export interface Drive {
  /** Raw target: the visitor's aim point. */
  target: THREE.Vector3;
  /** Where the visitor wants to sit, if anywhere. */
  landing: Perch | null;
  /** Idle now regardless of target movement (e.g. our cursor left the canvas). */
  forceIdle: boolean;
}

export interface FrameCtx {
  dt: number;
  t: number;
  camPos: THREE.Vector3;
  calm: boolean;
  /** Our own aim, so name tags brighten when we come close. */
  aim: THREE.Vector3;
  quality: "low" | "high";
}

/** Where a departed visitor's creature lies. */
export interface RestPose {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  yaw: number;
  /** Set when resting on a registered surface (the pose then follows it). */
  perch: Perch | null;
}

/** Fixed world scale of sleeping creatures and traces. */
export const TRACE_SCALE = 1.5;
/** Stand-off from a surface along its normal, per unit of creature scale. */
export const STAND_OFF = { butterfly: 0.004, leaf: 0.006 } as const;

const IDLE_AFTER = 1.5;
const LAND_RADIUS = 0.25;
const SLEEP_HOLD = 2.4;

const fixedSurface = (point: THREE.Vector3, normal: THREE.Vector3): SurfaceLike => ({
  pointAt(_u, _v, out, n) {
    out.copy(point);
    n?.copy(normal);
  },
});

const tmpLand = new THREE.Vector3();
const tmpRidePoint = new THREE.Vector3();
const tmpTarget = new THREE.Vector3();
const tmpWind = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const ZERO = new THREE.Vector3();

export class Creature {
  readonly id: string;
  readonly isSelf: boolean;
  kind: PointerKind;
  readonly flyer: Flyer;
  /** True once fully faded out after `retire()` or sleeping; the owner should dispose it. */
  gone = false;

  private color: string;
  private name: string;
  private readonly scene: THREE.Scene;
  private view!: ButterflyView | LeafView;
  private bfly: ButterflyState | null = null;
  private leaf: LeafState | null = null;
  private readonly phase: number;
  private readonly pos = new THREE.Vector3();
  private readonly normal = new THREE.Vector3(0, 1, 0);
  private ride: PerchRide | null = null;
  private rideSurface: SurfaceLike | null = null;
  private scale = 1;
  private fade = 0;
  private fadeTarget = 1;
  private readonly rawTarget = new THREE.Vector3();
  private lastMoveT = -Infinity;
  private idleBlend = 0;
  private idleStartT = 0;
  private wasIdle = false;
  private leafCooldownUntil = 0;
  private leafSlipAt = 0;
  private bornT = -1;
  private sleep: { pose: RestPose; startedAt: number; done: boolean; onDone: () => void } | null = null;
  private tag: THREE.Sprite | null = null;
  private tagOpacity = 0;

  private readonly quality: "low" | "high";

  constructor(scene: THREE.Scene, identity: Identity, isSelf: boolean, start: THREE.Vector3, quality: "low" | "high") {
    this.scene = scene;
    this.quality = quality;
    this.id = identity.id;
    this.isSelf = isSelf;
    this.kind = identity.kind;
    this.color = identity.color;
    this.name = identity.name;
    this.phase = seeded(hashString(identity.id), 7) * 100;
    this.pos.copy(start);
    this.rawTarget.copy(start);
    this.flyer = { id: identity.id, kind: identity.kind, isSelf, position: this.pos, velocity: new THREE.Vector3(), perched: false };
    this.build();
  }

  /** Swap kind/colour in place (e.g. the server's identity replaced our local guess). */
  setIdentity(identity: Identity): void {
    const changed = identity.kind !== this.kind || identity.color !== this.color || identity.name !== this.name;
    if (!changed) return;
    this.kind = identity.kind;
    this.color = identity.color;
    this.name = identity.name;
    this.flyer.kind = identity.kind;
    this.teardownView();
    this.ride = null;
    this.build();
  }

  get perch(): Perch | null {
    if (!this.ride || this.sleep || !surfaces.has(this.ride.surfaceId)) return null;
    return { surfaceId: this.ride.surfaceId, u: this.ride.u, v: this.ride.v };
  }

  get position(): THREE.Vector3 {
    return this.pos;
  }

  /** Fade out and disappear. */
  retire(): void {
    this.fadeTarget = 0;
  }

  get sleeping(): boolean {
    return this.sleep !== null;
  }

  /** Fly (or drift) to the rest pose, settle there, then hand over to the trace renderer. */
  goToSleep(pose: RestPose, t: number, onDone: () => void): void {
    this.sleep = { pose, startedAt: t, done: false, onDone };
    this.ride = null;
    this.fadeTarget = 1;
  }

  update(drive: Drive, c: FrameCtx): void {
    const { dt, t } = c;
    if (this.bornT < 0) this.bornT = t;
    if (this.rawTarget.distanceToSquared(drive.target) > 4e-6) {
      this.rawTarget.copy(drive.target);
      this.lastMoveT = t;
    }

    // Grow with distance from the camera so the cursor stays legible in wide shots.
    const want = this.sleep ? TRACE_SCALE : clamp(c.camPos.distanceTo(this.pos) / 4, 1, 3);
    this.scale += (want - this.scale) * damp(3, dt);
    const k = this.scale;

    // Resolve the landing spot for this frame.
    let spot: Perch | null = null;
    let surf: SurfaceLike | null = null;
    if (this.sleep) {
      const p = this.sleep.pose;
      const real = p.perch ? surfaces.get(p.perch.surfaceId) : undefined;
      if (p.perch && real) {
        spot = p.perch;
        surf = real;
      } else {
        spot = { surfaceId: "rest", u: 0, v: 0 };
        surf = this.ride?.surfaceId === "rest" && this.rideSurface ? this.rideSurface : fixedSurface(p.point, p.normal);
      }
    } else if (drive.landing) {
      const real = surfaces.get(drive.landing.surfaceId);
      if (real) {
        spot = drive.landing;
        surf = real;
      }
    }
    if (spot && surf) surf.pointAt(spot.u, spot.v, tmpLand);

    // Idle: the visitor's pointer is still (or gone) and there is nowhere to sit.
    const idle = !this.sleep && !spot && (drive.forceIdle || t - this.lastMoveT > IDLE_AFTER);
    if (idle && !this.wasIdle) this.idleStartT = t;
    this.wasIdle = idle;
    this.idleBlend += ((idle ? 1 : 0) - this.idleBlend) * damp(idle ? 0.8 : 3, dt);

    if (spot) tmpTarget.copy(tmpLand);
    else {
      tmpTarget.copy(this.rawTarget);
      if (this.idleBlend > 0.001) this.addIdleOffset(tmpTarget, t - this.idleStartT, k, c.calm);
    }

    const v = this.bfly?.v ?? this.leaf!.v;
    const p = this.bfly?.p ?? this.leaf!.p;

    // Riding a perch: stay, or take off.
    if (this.ride && this.rideSurface) {
      let stay = !!spot && spot.surfaceId === this.ride.surfaceId;
      if (stay && !this.sleep) {
        this.rideSurface.pointAt(this.ride.u, this.ride.v, tmpRidePoint);
        stay = tmpRidePoint.distanceTo(tmpLand) < 0.3 * Math.max(1, k * 0.6);
        // A leaf only gets caught for a moment, then slips off.
        if (this.leaf && t > this.leafSlipAt) stay = false;
      }
      if (stay) {
        if (this.leaf && !this.sleep) this.ride.v = Math.min(0.98, this.ride.v + dt * 0.05);
        const standOff = (this.leaf ? STAND_OFF.leaf : STAND_OFF.butterfly) * k;
        stepRide(this.ride, this.rideSurface, dt, this.pos, this.normal, standOff, c.camPos);
        p.copy(this.pos);
        v.set(0, 0, 0);
      } else {
        this.takeOff(t, k);
      }
    }

    if (!this.ride) {
      if (this.bfly) {
        stepButterfly(this.bfly, tmpTarget, dt, { scale: k, calm: c.calm, t });
      } else if (this.leaf) {
        windAt(this.leaf.p, t, tmpWind);
        stepLeaf(this.leaf, tmpTarget, dt, { scale: k, calm: c.calm, t, wind: this.sleep ? ZERO : tmpWind });
      }
      this.pos.copy(p);
      // Land?
      if (spot && surf && this.pos.distanceTo(tmpLand) < LAND_RADIUS * Math.max(1, k * 0.5)) {
        const leafOk = !this.leaf || this.sleep || (t > this.leafCooldownUntil && v.length() < 2.5 * k);
        if (leafOk) {
          this.ride = startRide(surf, spot.surfaceId, spot.u, spot.v, this.pos);
          this.rideSurface = surf;
          if (this.leaf) this.leafSlipAt = t + 1.2 + seeded(hashString(this.id), Math.floor(t)) * 1.6;
        }
      }
    }

    // Sleep bookkeeping: once settled for a while, hand over to the trace and fade out.
    if (this.sleep && !this.sleep.done) {
      const settled = this.ride && this.ride.age > SLEEP_HOLD;
      if (settled || t - this.sleep.startedAt > 9) {
        this.sleep.done = true;
        this.sleep.onDone();
        this.fadeTarget = 0;
      }
    }

    this.pose(c);

    this.fade += (this.fadeTarget - this.fade) * damp(this.fadeTarget > this.fade ? 2.5 : 3.5, dt);
    if (this.fadeTarget === 0 && this.fade < 0.01) this.gone = true;
    this.view.setOpacity(this.fade);

    this.flyer.velocity.copy(this.ride ? ZERO : v);
    this.flyer.perched = !!this.ride;

    this.updateTag(c);
  }

  dispose(): void {
    this.teardownView();
    if (this.tag) {
      this.scene.remove(this.tag);
      this.tag.material.map?.dispose();
      this.tag.material.dispose();
      this.tag = null;
    }
  }

  // --------------------------------------------------------------------------------------------

  private build(): void {
    const shadow = this.quality === "high";
    const seedKey = this.id;
    this.view = this.kind === "leaf" ? new LeafView(this.color, seedKey, shadow) : new ButterflyView(this.color, seedKey, shadow);
    if (this.kind === "leaf") {
      this.leaf = createLeafState(this.pos, this.phase);
      this.bfly = null;
    } else {
      this.bfly = createButterflyState(this.pos, this.phase);
      this.leaf = null;
    }
    this.view.root.position.copy(this.pos);
    this.view.setOpacity(this.fade);
    this.scene.add(this.view.root);
    if (!this.isSelf && this.name) this.buildTag();
  }

  private teardownView(): void {
    this.scene.remove(this.view.root);
    this.view.dispose();
    if (this.tag) {
      this.scene.remove(this.tag);
      this.tag.material.map?.dispose();
      this.tag.material.dispose();
      this.tag = null;
    }
  }

  private buildTag(): void {
    const { texture, aspect } = nameTagTexture(this.name, this.color);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, sizeAttenuation: false, opacity: 0 });
    const sprite = new THREE.Sprite(mat);
    const h = 0.026;
    sprite.scale.set(h * aspect, h, 1);
    sprite.center.set(0.5, 0);
    sprite.renderOrder = 10;
    this.tag = sprite;
    this.scene.add(sprite);
  }

  private addIdleOffset(out: THREE.Vector3, tau: number, k: number, calm: boolean): void {
    const b = this.idleBlend * k;
    if (this.bfly) {
      // A lazy loop around the last aim.
      const w = calm ? 0.3 : 0.65;
      out.x += Math.cos(w * tau + this.phase) * 0.4 * b;
      out.z += Math.sin(w * tau + this.phase) * 0.3 * b;
      out.y += Math.sin(2 * w * tau) * 0.12 * b;
    } else {
      // Drift down slowly, then get lifted again.
      const drop = (1 - Math.cos(tau * (calm ? 0.2 : 0.35))) * 0.5;
      out.y -= drop * 0.6 * b;
      out.x += Math.sin(tau * 0.5 + this.phase) * 0.18 * b;
      out.z += Math.cos(tau * 0.4 + this.phase) * 0.1 * b;
    }
  }

  private takeOff(t: number, k: number): void {
    this.ride = null;
    this.rideSurface = null;
    const v = this.bfly?.v ?? this.leaf!.v;
    // Push off the surface.
    v.copy(this.normal).multiplyScalar(0.6 * k);
    v.y += 0.6 * k;
    if (this.leaf) this.leafCooldownUntil = t + 2.5;
  }

  private pose(c: FrameCtx): void {
    const { dt, t } = c;
    const root = this.view.root;
    root.position.copy(this.pos);
    root.scale.setScalar(this.scale);
    const perchedFor = this.ride ? this.ride.age : -1;

    if (this.bfly && this.view instanceof ButterflyView) {
      const s = this.bfly;
      if (this.ride) surfaceQuaternion(this.normal, this.sleep ? this.sleep.pose.yaw : s.yaw, tmpQ);
      else tmpQ.setFromEuler(tmpE.set(s.pitch, s.yaw, s.roll, "YXZ"));
      root.quaternion.slerp(tmpQ, damp(this.ride ? 8 : 14, dt));

      const flight = c.calm ? 0.45 + 0.45 * Math.sin(s.flap) : 0.25 + (0.55 + 0.45 * s.effort) * 0.95 * Math.sin(s.flap);
      let perched: number;
      if (this.sleep) perched = WINGS_REST + 0.05 * Math.sin(t * 0.8 + this.phase);
      else if (c.calm) perched = 0.45 + 0.1 * Math.sin(t * 0.7 + this.phase);
      // Slow open/close, like a butterfly warming up in the sun.
      else perched = 0.55 + 0.45 * Math.sin(t * 1.3 + this.phase);
      const blend = perchedFor < 0 ? 0 : clamp(perchedFor / 0.5, 0, 1);
      this.view.setWings(flight + (perched - flight) * blend);
    } else if (this.leaf && this.view instanceof LeafView) {
      const s = this.leaf;
      if (this.ride) surfaceQuaternion(this.normal, this.sleep ? this.sleep.pose.yaw : s.yaw, tmpQ);
      else tmpQ.setFromEuler(tmpE.set(s.pitch, s.yaw, s.roll, "YXZ"));
      root.quaternion.slerp(tmpQ, damp(this.ride ? 6 : 10, dt));
      this.view.tumble.rotation.z = this.ride ? this.view.tumble.rotation.z * (1 - damp(4, dt)) : s.tumble;
    }
  }

  private updateTag(c: FrameCtx): void {
    if (!this.tag) return;
    let want = 0.3;
    if (c.aim.distanceTo(this.pos) < 1.0 * this.scale) want = 0.9;
    if (c.t - this.bornT < 5) want = 0.9;
    if (this.sleep) want = 0;
    want *= this.fade;
    this.tagOpacity += (want - this.tagOpacity) * damp(3, c.dt);
    this.tag.material.opacity = this.tagOpacity;
    this.tag.visible = this.tagOpacity > 0.02;
    this.tag.position.copy(this.pos);
    this.tag.position.y += 0.05 * this.scale + 0.02;
  }
}
