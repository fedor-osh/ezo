// Strict parsing of untrusted client messages. Anything odd is dropped (null), never thrown.
import { SECTION_IDS, type ClientMsg, type Perch, type PeerState, type SectionId, type Vec3 } from "../src/shared/protocol.ts";

export const MAX_MESSAGE_BYTES = 1024;
/** Positions are clamped to a box this far around the yard centre, in metres. */
export const WORLD_BOUND = 30;
const SURFACE_ID = /^[\w:.\-]{1,48}$/;
const RESUME_ID = /^[\w\-]{1,32}$/;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Millimetre precision is plenty and keeps broadcasts small. */
const round = (v: number) => Math.round(v * 1000) / 1000;

export function parseVec3(v: unknown): Vec3 | null {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isFiniteNumber)) return null;
  return [0, 1, 2].map((i) => round(clamp(v[i] as number, -WORLD_BOUND, WORLD_BOUND))) as Vec3;
}

export function parsePerch(v: unknown): Perch | null | undefined {
  if (v === null) return null;
  if (!isObject(v)) return undefined;
  const { surfaceId, u, v: vv } = v;
  if (typeof surfaceId !== "string" || !SURFACE_ID.test(surfaceId)) return undefined;
  if (!isFiniteNumber(u) || !isFiniteNumber(vv) || u < 0 || u > 1 || vv < 0 || vv > 1) return undefined;
  return { surfaceId, u: round(u), v: round(vv) };
}

export function parseSection(v: unknown): SectionId | null {
  return typeof v === "string" && (SECTION_IDS as readonly string[]).includes(v) ? (v as SectionId) : null;
}

export function parseState(msg: Record<string, unknown>): PeerState | null {
  const p = parseVec3(msg.p);
  const perch = parsePerch(msg.perch ?? null);
  const section = parseSection(msg.section);
  if (!p || perch === undefined || !section) return null;
  return { p, perch, section };
}

/** Parse a raw WebSocket frame into a well-formed client message, or null. */
export function parseClientMessage(raw: string): ClientMsg | null {
  if (raw.length > MAX_MESSAGE_BYTES) return null;
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(msg)) return null;
  if (msg.type === "hello") {
    const { resumeId } = msg;
    return typeof resumeId === "string" && RESUME_ID.test(resumeId) ? { type: "hello", resumeId } : { type: "hello" };
  }
  if (msg.type === "state") {
    const state = parseState(msg);
    return state ? { type: "state", ...state } : null;
  }
  return null;
}

export function sameState(a: PeerState | null, b: PeerState): boolean {
  if (!a || a.section !== b.section) return false;
  if (a.p[0] !== b.p[0] || a.p[1] !== b.p[1] || a.p[2] !== b.p[2]) return false;
  if (!a.perch || !b.perch) return a.perch === b.perch;
  return a.perch.surfaceId === b.perch.surfaceId && a.perch.u === b.perch.u && a.perch.v === b.perch.v;
}
