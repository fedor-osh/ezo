// The one shared yard: who is here, their latest states, and what they leave behind.
// Transport-agnostic (a Conn is anything with send/close) and clock-injected, so it is unit-testable.
import type { Identity, PeerSnapshot, PeerState, SectionId, ServerMsg, Trace } from "../src/shared/protocol.ts";
import { createIdentity, newId, type Rng } from "./identity.ts";
import { PathRecorder } from "./path.ts";
import type { TraceStore } from "./traces.ts";
import { sameState } from "./validate.ts";

export interface Conn {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

/** Close code sent to a socket whose identity was taken over by a newer connection (same resumeId). */
export const CLOSE_REPLACED = 4000;

export interface Peer {
  identity: Identity;
  conn: Conn | null;
  state: PeerState | null;
  dirty: boolean;
  path: PathRecorder;
  sections: Set<SectionId>;
  arrivedAt: number;
  /** When the socket closed; the peer lingers (invisible change for others) until the grace period ends. */
  detachedAt: number | null;
}

export interface RoomOptions {
  store: TraceStore;
  now?: () => number;
  rng?: Rng;
  /** How long a closed connection may come back with its resumeId. */
  resumeGraceMs?: number;
  /** Visitors must stay at least this long to leave a trace. */
  minStayMs?: number;
  /** ...and move at least this far (metres). */
  minTravel?: number;
}

export class Room {
  private readonly peers = new Map<string, Peer>();
  private readonly store: TraceStore;
  private readonly now: () => number;
  private readonly rng: Rng;
  private readonly resumeGraceMs: number;
  private readonly minStayMs: number;
  private readonly minTravel: number;

  constructor(opts: RoomOptions) {
    this.store = opts.store;
    this.now = opts.now ?? Date.now;
    this.rng = opts.rng ?? Math.random;
    this.resumeGraceMs = opts.resumeGraceMs ?? 30_000;
    this.minStayMs = opts.minStayMs ?? 5_000;
    this.minTravel = opts.minTravel ?? 0.5;
  }

  get online(): number {
    return this.peers.size;
  }

  get(id: string): Peer | undefined {
    return this.peers.get(id);
  }

  /** Handle `hello`: resume an existing identity if allowed, otherwise mint a new one. */
  hello(conn: Conn, resumeId?: string): Peer {
    const existing = resumeId ? this.peers.get(resumeId) : undefined;
    if (existing) {
      // A reload whose old socket is not closed yet: the newest connection wins.
      if (existing.conn && existing.conn !== conn) existing.conn.close(CLOSE_REPLACED, "replaced");
      existing.conn = conn;
      existing.detachedAt = null;
      this.sendWelcome(existing);
      return existing;
    }

    const peer: Peer = {
      identity: createIdentity(newId(), this.rng),
      conn,
      state: null,
      dirty: false,
      path: new PathRecorder(),
      sections: new Set(),
      arrivedAt: this.now(),
      detachedAt: null,
    };
    this.peers.set(peer.identity.id, peer);
    this.store.countVisitor();
    this.sendWelcome(peer);
    this.broadcast({ type: "join", peer: peer.identity }, peer);
    this.broadcastCount();
    return peer;
  }

  updateState(peer: Peer, state: PeerState): void {
    if (this.peers.get(peer.identity.id) !== peer) return;
    peer.path.add(state.p, this.now());
    peer.sections.add(state.section);
    if (sameState(peer.state, state)) return;
    peer.state = state;
    peer.dirty = true;
  }

  /** The socket went away. The peer stays for the resume grace period. */
  detach(peer: Peer, conn: Conn): void {
    if (peer.conn !== conn) return;
    peer.conn = null;
    peer.detachedAt = this.now();
  }

  /** Run at STATE_HZ: broadcast changed states and let expired peers go home. */
  tick(): void {
    this.broadcastStates();
    const now = this.now();
    for (const peer of this.peers.values()) {
      if (peer.detachedAt !== null && now - peer.detachedAt >= this.resumeGraceMs) this.remove(peer);
    }
  }

  /** On shutdown: everyone still here leaves a trace (they'll get fresh identities after restart). */
  closeAll(): void {
    const now = this.now();
    for (const peer of this.peers.values()) {
      peer.detachedAt ??= now;
      this.remove(peer);
    }
  }

  private remove(peer: Peer): void {
    this.peers.delete(peer.identity.id);
    const trace = this.buildTrace(peer);
    if (trace) this.store.add(trace);
    this.broadcast({ type: "leave", id: peer.identity.id, trace });
    this.broadcastCount();
  }

  private buildTrace(peer: Peer): Trace | null {
    const leftAt = peer.detachedAt ?? this.now();
    if (!peer.state || leftAt - peer.arrivedAt < this.minStayMs || peer.path.travelled < this.minTravel) return null;
    const { id, kind, color, name } = peer.identity;
    return {
      id,
      kind,
      color,
      name,
      path: peer.path.points.slice(),
      rest: peer.state.p,
      perch: peer.state.perch,
      sections: [...peer.sections],
      arrivedAt: peer.arrivedAt,
      leftAt,
    };
  }

  private sendWelcome(peer: Peer): void {
    const peers: PeerSnapshot[] = [];
    for (const other of this.peers.values()) {
      if (other !== peer) peers.push({ ...other.identity, state: other.state });
    }
    send(peer.conn, {
      type: "welcome",
      self: peer.identity,
      peers,
      traces: this.store.list(),
      online: this.online,
      totalVisitors: this.store.totalVisitors,
    });
  }

  private broadcastStates(): void {
    // Serialize each changed state once; each recipient gets every fragment except its own.
    const fragments: Array<[peer: Peer, json: string]> = [];
    for (const peer of this.peers.values()) {
      if (!peer.dirty || !peer.state) continue;
      peer.dirty = false;
      fragments.push([peer, JSON.stringify([peer.identity.id, peer.state])]);
    }
    if (fragments.length === 0) return;
    for (const recipient of this.peers.values()) {
      if (!recipient.conn) continue;
      const parts = fragments.filter(([owner]) => owner !== recipient).map(([, json]) => json);
      if (parts.length > 0) recipient.conn.send(`{"type":"states","states":[${parts.join(",")}]}`);
    }
  }

  private broadcastCount(): void {
    this.broadcast({ type: "count", online: this.online, totalVisitors: this.store.totalVisitors });
  }

  private broadcast(msg: ServerMsg, except?: Peer): void {
    const json = JSON.stringify(msg);
    for (const peer of this.peers.values()) {
      if (peer !== except && peer.conn) peer.conn.send(json);
    }
  }
}

function send(conn: Conn | null, msg: ServerMsg): void {
  conn?.send(JSON.stringify(msg));
}
