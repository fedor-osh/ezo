// App-wide state lives in nanostores so the DOM UI and the 3D scene share one source of truth.
// Per-frame data (pointer position, creature positions) does NOT live here: see input.ts and presence.ts.
import { atom, map } from "nanostores";
import type { Identity, PeerSnapshot, SectionId, Trace } from "../shared/protocol.ts";

/** Current section; drives the camera, the panel and the URL hash. */
export const $section = atom<SectionId>("home");

/** Section whose DOM nav button has keyboard focus / hover (the cloth highlights, the butterfly flies to it). */
export const $highlighted = atom<SectionId | null>(null);

export const $reducedMotion = atom<boolean>(
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches,
);

/** "3d" renders the yard; "flat" pauses rendering and shows a plain page (low power / user choice). */
export const $mode = atom<"3d" | "flat">("3d");

export type ConnectionStatus = "connecting" | "online" | "offline";
export const $connection = atom<ConnectionStatus>("connecting");

/** Our identity. Starts as a local guess and is replaced by the server's "welcome". */
export const $self = atom<Identity | null>(null);

/** Other visitors right now, keyed by id. Updated on join/leave; their states stream via presence.ts. */
export const $peers = map<Record<string, PeerSnapshot>>({});

/** Traces left by visitors who already went home. */
export const $traces = atom<Trace[]>([]);

export const $counts = atom<{ online: number; totalVisitors: number }>({ online: 1, totalVisitors: 0 });

/** True once the 3D scene has rendered its first frame. */
export const $sceneReady = atom(false);
