// Hot, per-frame shared data. Plain mutable maps on purpose: they change 60 times a second
// and nothing should re-render because of them.
import * as THREE from "three";
import type { PeerState, PointerKind } from "../shared/protocol.ts";

/** Latest network state of each remote peer (written by src/net, read by creatures). */
export const peerStates = new Map<string, { state: PeerState; receivedAt: number }>();

export interface Flyer {
  id: string;
  kind: PointerKind;
  isSelf: boolean;
  /** Simulated world position of the creature (not the raw aim). Written by creatures each frame. */
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  perched: boolean;
}

/**
 * Every pointer creature currently in the yard (ours + peers'), written by src/life/creatures,
 * read by cats (to get scared) and leaves (to be blown around).
 */
export const flyers = new Map<string, Flyer>();
