// Presence client: keeps one WebSocket to the yard server, mirrors the room into stores/presence,
// and streams our pointer state. Without a server the site simply works solo.
import { $connection, $counts, $peers, $section, $self, $traces } from "../core/stores.ts";
import { peerStates } from "../core/presence.ts";
import { getSelfState } from "../life/creatures/index.ts";
import {
  MAX_TRACES,
  STATE_HZ,
  type Identity,
  type PeerSnapshot,
  type PeerState,
  type ServerMsg,
} from "../shared/protocol.ts";

const RESUME_KEY = "ezo:id";
/** Matches server/room.ts CLOSE_REPLACED: another tab took our identity (e.g. a duplicated tab). */
const CLOSE_REPLACED = 4000;
const MIN_MOVE = 0.01;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 30_000;

const PROVISIONAL_COLORS = ["#ff6f91", "#ffc75f", "#3bceac", "#4cc9f0", "#9b5de5", "#f15bb5", "#fb8500", "#06d6a0"];

let started = false;
let ws: WebSocket | null = null;
let welcomed = false;
let attempt = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let lastSent: PeerState | null = null;

export function connect(): void {
  if (started) return;
  started = true;

  if (!$self.get()) $self.set(provisionalSelf());
  open();
  setInterval(sendState, 1000 / STATE_HZ);

  // Come back quickly when the network or the tab returns instead of waiting out the backoff.
  addEventListener("online", retryNow);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    lastSent = null;
    retryNow();
  });
}

function serverUrl(): string {
  const override = import.meta.env.VITE_WS_URL as string | undefined;
  if (override) return override;
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
}

function open(): void {
  retryTimer = null;
  if (attempt === 0 && $connection.get() !== "online") $connection.set("connecting");
  let socket: WebSocket;
  try {
    socket = new WebSocket(serverUrl());
  } catch {
    scheduleRetry();
    return;
  }
  ws = socket;

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "hello", resumeId: readResumeId() }));
  });
  socket.addEventListener("message", (e) => {
    if (typeof e.data !== "string") return;
    let msg: ServerMsg;
    try {
      msg = JSON.parse(e.data) as ServerMsg;
    } catch {
      return;
    }
    handle(msg);
  });
  socket.addEventListener("close", (e) => {
    if (ws !== socket) return;
    ws = null;
    welcomed = false;
    lastSent = null;
    if (e.code === CLOSE_REPLACED) writeResumeId(null);
    forgetPeers();
    $connection.set("offline");
    scheduleRetry();
  });
}

function scheduleRetry(): void {
  if (retryTimer) return;
  // Exponential backoff with jitter (50–100% of the step) so a server restart isn't stampeded.
  const step = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempt);
  attempt++;
  retryTimer = setTimeout(open, step * (0.5 + Math.random() * 0.5));
}

function retryNow(): void {
  if (ws || !retryTimer) return;
  clearTimeout(retryTimer);
  attempt = 0;
  open();
}

function handle(msg: ServerMsg): void {
  switch (msg.type) {
    case "welcome": {
      welcomed = true;
      attempt = 0;
      writeResumeId(msg.self.id);
      $self.set(msg.self);
      const peers: Record<string, PeerSnapshot> = {};
      peerStates.clear();
      const now = performance.now();
      for (const p of msg.peers) {
        peers[p.id] = p;
        if (p.state) peerStates.set(p.id, { state: p.state, receivedAt: now });
      }
      $peers.set(peers);
      $traces.set(msg.traces.slice(-MAX_TRACES));
      $counts.set({ online: msg.online, totalVisitors: msg.totalVisitors });
      $connection.set("online");
      lastSent = null;
      break;
    }
    case "states": {
      const now = performance.now();
      const peers = $peers.get();
      for (const [id, state] of msg.states) {
        const snapshot = peers[id];
        if (!snapshot) continue;
        peerStates.set(id, { state, receivedAt: now });
        // $peers only follows coarse changes (section, perched or not); positions stay in peerStates.
        if (!snapshot.state || snapshot.state.section !== state.section || !snapshot.state.perch !== !state.perch) {
          $peers.setKey(id, { ...snapshot, state });
        }
      }
      break;
    }
    case "join":
      $peers.setKey(msg.peer.id, { ...msg.peer, state: null });
      break;
    case "leave":
      peerStates.delete(msg.id);
      $peers.setKey(msg.id, undefined);
      if (msg.trace) $traces.set([...$traces.get(), msg.trace].slice(-MAX_TRACES));
      break;
    case "count":
      $counts.set({ online: msg.online, totalVisitors: msg.totalVisitors });
      break;
  }
}

function sendState(): void {
  if (!ws || !welcomed || ws.readyState !== WebSocket.OPEN || document.hidden) return;
  const self = getSelfState();
  const state: PeerState = { p: self.p, perch: self.perch, section: $section.get() };
  if (lastSent && !changed(lastSent, state)) return;
  ws.send(JSON.stringify({ type: "state", ...state }));
  // Copy: the creature may reuse its arrays.
  lastSent = { p: [state.p[0], state.p[1], state.p[2]], perch: state.perch && { ...state.perch }, section: state.section };
}

function changed(a: PeerState, b: PeerState): boolean {
  if (a.section !== b.section) return true;
  if (Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]) > MIN_MOVE) return true;
  if (!a.perch || !b.perch) return a.perch !== b.perch;
  return a.perch.surfaceId !== b.perch.surfaceId || Math.abs(a.perch.u - b.perch.u) > MIN_MOVE || Math.abs(a.perch.v - b.perch.v) > MIN_MOVE;
}

/** Offline we can't know who is around: clear peers, keep the traces we already saw. */
function forgetPeers(): void {
  peerStates.clear();
  $peers.set({});
  $counts.set({ online: 1, totalVisitors: $counts.get().totalVisitors });
}

function provisionalSelf(): Identity {
  return {
    id: "local",
    kind: Math.random() < 0.75 ? "butterfly" : "leaf",
    color: PROVISIONAL_COLORS[Math.floor(Math.random() * PROVISIONAL_COLORS.length)],
    name: "You",
  };
}

function readResumeId(): string | undefined {
  try {
    return sessionStorage.getItem(RESUME_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeResumeId(id: string | null): void {
  try {
    if (id) sessionStorage.setItem(RESUME_KEY, id);
    else sessionStorage.removeItem(RESUME_KEY);
  } catch {
    // Storage may be blocked (private mode); we just won't survive reloads.
  }
}
