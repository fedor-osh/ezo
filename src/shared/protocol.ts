// Wire protocol shared by the browser client (src/net) and the Node server (server/).
// Keep this file dependency-free: it is imported from both sides.

export type SectionId = "home" | "work" | "about" | "stack" | "contact";
export const SECTION_IDS: readonly SectionId[] = ["home", "work", "about", "stack", "contact"];

/** What a visitor's pointer looks like in the yard. */
export type PointerKind = "butterfly" | "leaf";

export type Vec3 = [number, number, number];

export interface Identity {
  id: string;
  kind: PointerKind;
  /** CSS hex colour, e.g. "#ff6f91". */
  color: string;
  /** Short whimsical display name, e.g. "Sleepy Churchkhela". */
  name: string;
}

/** A butterfly (or caught leaf) sitting on a surface registered in core/surfaces.ts. */
export interface Perch {
  surfaceId: string;
  u: number;
  v: number;
}

export interface PeerState {
  /** World-space position the pointer creature is heading to (its "aim"). */
  p: Vec3;
  perch: Perch | null;
  section: SectionId;
}

/** What a visitor leaves behind when they close the tab. */
export interface Trace {
  id: string;
  kind: PointerKind;
  color: string;
  name: string;
  /** Downsampled recent path of the visitor's aim, oldest first, at most 64 points. */
  path: Vec3[];
  /** Last known aim position. */
  rest: Vec3;
  /** Last perch, if they were sitting on something when they left. */
  perch: Perch | null;
  sections: SectionId[];
  /** Unix ms. */
  arrivedAt: number;
  leftAt: number;
}

export type ClientMsg =
  | { type: "hello"; /** previously assigned id from sessionStorage, to survive reloads */ resumeId?: string }
  | ({ type: "state" } & PeerState);

export interface PeerSnapshot extends Identity {
  state: PeerState | null;
}

export type ServerMsg =
  | {
      type: "welcome";
      self: Identity;
      peers: PeerSnapshot[];
      traces: Trace[];
      online: number;
      totalVisitors: number;
    }
  | { type: "join"; peer: Identity }
  /** Batched peer states, sent at the server tick rate (~15 Hz). */
  | { type: "states"; states: Array<[id: string, state: PeerState]> }
  | { type: "leave"; id: string; trace: Trace | null }
  | { type: "count"; online: number; totalVisitors: number };

export const STATE_HZ = 15;
export const MAX_TRACES = 200;
export const MAX_TRACE_PATH = 64;
