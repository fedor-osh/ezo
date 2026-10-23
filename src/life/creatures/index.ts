// Pointer creatures of every visitor (ours and remote peers') and the traces of those who left.
import * as THREE from "three";
import type { Engine, WorldHandle } from "../../core/types.ts";
import { ORDER } from "../../core/types.ts";
import type { Identity, PeerSnapshot, Perch, Vec3 } from "../../shared/protocol.ts";
import { $highlighted, $mode, $peers, $reducedMotion, $self, $traces } from "../../core/stores.ts";
import { flyers, peerStates } from "../../core/presence.ts";
import { pointer } from "../../core/input.ts";
import { surfaces } from "../../core/surfaces.ts";
import { Creature, type Drive, type FrameCtx } from "./creature.ts";
import { createTraces, type TracesApi } from "./traces.ts";

const SELF_FALLBACK: Identity = { id: "self", kind: "butterfly", color: "#ffb347", name: "" };
/** Point on a cloth a keyboard-highlighted butterfly flies to. */
const CLOTH_SPOT = { u: 0.5, v: 0.45 } as const;

let self: Creature | null = null;
const selfTarget = new THREE.Vector3(0, 2.5, 0);

/**
 * What the net agent sends for us: our aim (not the creature's simulated position) and the perch
 * our creature is sitting on. Cheap; safe to call before init.
 */
export function getSelfState(): { p: Vec3; perch: Perch | null } {
  const t = self ? selfTarget : pointer.aim;
  return { p: [round(t.x), round(t.y), round(t.z)], perch: self?.perch ?? null };
}

const round = (x: number) => Math.round(x * 1000) / 1000;

export function initCreatures(engine: Engine, world: WorldHandle): void {
  const { scene, camera } = engine;
  const traces = createTraces(engine, world);
  const peers = new Map<string, Creature>();
  const leaving = new Map<string, { creature: Creature; since: number }>();
  let t = 0;

  // --- our own creature ----------------------------------------------------------------------
  const selfIdentity = () => $self.get() ?? SELF_FALLBACK;
  self = new Creature(scene, selfIdentity(), true, pointer.aim.clone(), engine.quality);
  flyers.set(self.id, self.flyer);
  let selfFlyerKey = self.id;
  $self.subscribe((id) => {
    if (!self) return;
    const identity = id ?? SELF_FALLBACK;
    self.setIdentity(identity);
    if (selfFlyerKey !== identity.id) {
      flyers.delete(selfFlyerKey);
      selfFlyerKey = identity.id;
      self.flyer.id = identity.id;
      flyers.set(selfFlyerKey, self.flyer);
    }
    // We may have been rendered as a peer before the welcome told us who we are.
    const dup = peers.get(identity.id);
    if (dup) removePeer(identity.id, false);
  });

  const selfDrive: Drive = { target: selfTarget, landing: null, forceIdle: false };
  const clothPoint = new THREE.Vector3();
  function driveSelf(): Drive {
    const hl = $highlighted.get();
    const cloth = hl ? surfaces.get(`cloth:${hl}`) : undefined;
    selfDrive.landing = null;
    selfDrive.forceIdle = false;
    if (hl && cloth) {
      // Keyboard focus on a nav button: fly to that cloth and sit on it.
      cloth.pointAt(CLOTH_SPOT.u, CLOTH_SPOT.v, clothPoint);
      selfTarget.copy(clothPoint);
      selfDrive.landing = { surfaceId: cloth.id, ...CLOTH_SPOT };
    } else {
      selfTarget.copy(pointer.aim);
      const h = pointer.hover;
      if (pointer.inside && h?.uv && surfaces.has(h.target.id)) {
        selfDrive.landing = { surfaceId: h.target.id, u: h.uv.u, v: h.uv.v };
      } else if (!pointer.inside) {
        // Cursor left the canvas: stay where we sit, or idle around the last aim.
        selfDrive.landing = self?.perch ?? null;
        selfDrive.forceIdle = true;
      }
    }
    return selfDrive;
  }

  // --- peers ---------------------------------------------------------------------------------
  const spawnPoint = (snap: PeerSnapshot) => {
    const p = snap.state?.p;
    const v = p ? new THREE.Vector3(p[0], p[1], p[2]) : new THREE.Vector3((Math.random() - 0.5) * 6, 2.5, 4);
    // Flutter in from a little above.
    return v.add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.2, (Math.random() - 0.5) * 0.6));
  };

  function addPeer(snap: PeerSnapshot): void {
    const old = leaving.get(snap.id);
    if (old) {
      old.creature.dispose();
      flyers.delete(snap.id);
      leaving.delete(snap.id);
    }
    const c = new Creature(scene, snap, false, spawnPoint(snap), engine.quality);
    peers.set(snap.id, c);
    flyers.set(snap.id, c.flyer);
  }

  function removePeer(id: string, toSleep: boolean): void {
    const c = peers.get(id);
    if (!c) return;
    peers.delete(id);
    if (!toSleep) {
      c.dispose();
      flyers.delete(id);
      return;
    }
    leaving.set(id, { creature: c, since: t });
    trySleep(id);
  }

  /** If the departed peer's trace is known, its creature goes to sleep where the trace will be. */
  function trySleep(id: string): void {
    const entry = leaving.get(id);
    if (!entry || entry.creature.sleeping) return;
    const trace = $traces.get().find((tr) => tr.id === id);
    if (!trace || Date.now() - trace.leftAt > 120_000) return;
    const pose = traces.restPose(trace);
    traces.suppress(trace.id);
    entry.creature.goToSleep(pose, t, () => traces.unsuppress(trace.id));
  }

  const syncPeers = (all: Record<string, PeerSnapshot>) => {
    const selfId = $self.get()?.id;
    for (const id of [...peers.keys()]) if (!all[id] || id === selfId) removePeer(id, id !== selfId);
    for (const snap of Object.values(all)) {
      if (!snap || snap.id === selfId) continue;
      const c = peers.get(snap.id);
      if (!c) addPeer(snap);
      else c.setIdentity(snap);
    }
  };
  $peers.subscribe(syncPeers);
  $traces.subscribe(() => {
    for (const id of leaving.keys()) trySleep(id);
  });

  const peerDrive: Drive = { target: new THREE.Vector3(), landing: null, forceIdle: false };
  function drivePeer(id: string, c: Creature): Drive {
    const st = peerStates.get(id)?.state ?? $peers.get()[id]?.state ?? null;
    if (st) peerDrive.target.set(st.p[0], st.p[1], st.p[2]);
    else peerDrive.target.copy(c.position);
    peerDrive.landing = st?.perch ?? null;
    return peerDrive;
  }
  const frozen: Drive = { target: new THREE.Vector3(), landing: null, forceIdle: true };

  // --- system cursor -------------------------------------------------------------------------
  let cursorHidden = false;
  const setCursorHidden = (v: boolean) => {
    if (v === cursorHidden) return;
    cursorHidden = v;
    document.body.classList.toggle("creature-cursor", v);
  };
  $mode.subscribe((m) => {
    if (m !== "3d") setCursorHidden(false);
  });

  // --- frame ---------------------------------------------------------------------------------
  const ctx: FrameCtx = { dt: 0, t: 0, camPos: new THREE.Vector3(), calm: false, aim: pointer.aim, quality: engine.quality };
  engine.onUpdate((dt, time) => {
    t = time;
    ctx.dt = dt;
    ctx.t = time;
    ctx.calm = $reducedMotion.get();
    camera.getWorldPosition(ctx.camPos);
    ctx.aim = self ? self.position : pointer.aim;

    setCursorHidden(pointer.inside && pointer.type !== "touch" && $mode.get() === "3d");

    if (self) self.update(driveSelf(), ctx);
    for (const [id, c] of peers) c.update(drivePeer(id, c), ctx);
    for (const [id, entry] of leaving) {
      const c = entry.creature;
      // No trace showed up: just fade away.
      if (!c.sleeping && t - entry.since > 1.5) c.retire();
      frozen.target.copy(c.position);
      c.update(frozen, ctx);
      if (c.gone) {
        c.dispose();
        leaving.delete(id);
        if (flyers.get(id) === c.flyer) flyers.delete(id);
      }
    }
  }, ORDER.life);
}

export type { TracesApi };
