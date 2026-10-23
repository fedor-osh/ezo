// Traces left by visitors + the all-time visitor counter, persisted as one small JSON file.
// Writes are debounced and atomic (tmp file + rename) so a crash never leaves half a file.
import { mkdirSync, readFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { MAX_TRACE_PATH, MAX_TRACES, type Trace } from "../src/shared/protocol.ts";
import { parsePerch, parseSection, parseVec3 } from "./validate.ts";

export const TRACE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface StoreFile {
  version: 1;
  totalVisitors: number;
  traces: Trace[];
}

export interface TraceStoreOptions {
  /** JSON file to load from and save to; null keeps everything in memory. */
  file: string | null;
  now?: () => number;
  debounceMs?: number;
  maxAgeMs?: number;
  maxTraces?: number;
}

export class TraceStore {
  totalVisitors = 0;
  private traces: Trace[] = [];
  private readonly file: string | null;
  private readonly now: () => number;
  private readonly debounceMs: number;
  private readonly maxAgeMs: number;
  private readonly maxTraces: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writing: Promise<void> = Promise.resolve();

  constructor(opts: TraceStoreOptions) {
    this.file = opts.file;
    this.now = opts.now ?? Date.now;
    this.debounceMs = opts.debounceMs ?? 2000;
    this.maxAgeMs = opts.maxAgeMs ?? TRACE_MAX_AGE_MS;
    this.maxTraces = opts.maxTraces ?? MAX_TRACES;
  }

  /** Load the file if it exists. A missing or corrupt file starts an empty store. */
  load(): void {
    if (!this.file) return;
    let raw: string;
    try {
      raw = readFileSync(this.file, "utf8");
    } catch {
      return;
    }
    try {
      const data = JSON.parse(raw) as Partial<StoreFile>;
      const total = Number(data.totalVisitors);
      this.totalVisitors = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
      this.traces = Array.isArray(data.traces) ? data.traces.map(sanitizeTrace).filter((t): t is Trace => !!t) : [];
      this.traces.sort((a, b) => a.leftAt - b.leftAt);
    } catch (err) {
      console.warn(`[traces] ignoring unreadable ${this.file}:`, err);
    }
    this.prune();
  }

  /** Traces newest last, pruned of expired ones. */
  list(): Trace[] {
    if (this.prune()) this.scheduleSave();
    return this.traces;
  }

  add(trace: Trace): void {
    this.traces.push(trace);
    this.prune();
    this.scheduleSave();
  }

  /** Count a brand new visitor and return the new total. */
  countVisitor(): number {
    this.totalVisitors++;
    this.scheduleSave();
    return this.totalVisitors;
  }

  /** Drop traces older than maxAge and beyond the cap. Returns whether anything was dropped. */
  prune(): boolean {
    const before = this.traces.length;
    const cutoff = this.now() - this.maxAgeMs;
    this.traces = this.traces.filter((t) => t.leftAt >= cutoff);
    if (this.traces.length > this.maxTraces) this.traces = this.traces.slice(-this.maxTraces);
    return this.traces.length !== before;
  }

  /** Write pending changes now (used on shutdown and in tests). */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.save();
    }
    await this.writing;
  }

  private scheduleSave(): void {
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.save();
    }, this.debounceMs);
    this.timer.unref?.();
  }

  private save(): void {
    const file = this.file;
    if (!file) return;
    const data: StoreFile = { version: 1, totalVisitors: this.totalVisitors, traces: this.traces };
    const json = JSON.stringify(data);
    // Chain writes so two saves never race on the same tmp file.
    this.writing = this.writing.then(async () => {
      const tmp = `${file}.${process.pid}.tmp`;
      try {
        mkdirSync(dirname(file), { recursive: true });
        await writeFile(tmp, json, "utf8");
        await rename(tmp, file);
      } catch (err) {
        console.error(`[traces] failed to save ${file}:`, err);
      }
    });
  }
}

/** Traces come back from disk, so re-check their shape like any untrusted input. */
function sanitizeTrace(v: unknown): Trace | null {
  if (typeof v !== "object" || v === null) return null;
  const t = v as Record<string, unknown>;
  const rest = parseVec3(t.rest);
  const perch = parsePerch(t.perch ?? null);
  if (typeof t.id !== "string" || typeof t.name !== "string" || typeof t.color !== "string") return null;
  if (t.kind !== "butterfly" && t.kind !== "leaf") return null;
  if (!rest || perch === undefined) return null;
  if (typeof t.arrivedAt !== "number" || typeof t.leftAt !== "number") return null;
  const path = Array.isArray(t.path) ? t.path.map(parseVec3).filter((p) => !!p).slice(-MAX_TRACE_PATH) : [];
  const sections = Array.isArray(t.sections) ? t.sections.map(parseSection).filter((s) => !!s) : [];
  return {
    id: t.id,
    kind: t.kind,
    color: t.color,
    name: t.name,
    path,
    rest,
    perch,
    sections,
    arrivedAt: t.arrivedAt,
    leftAt: t.leftAt,
  };
}
