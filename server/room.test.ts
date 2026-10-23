import { describe, expect, it } from "vitest";
import type { PeerState, ServerMsg } from "../src/shared/protocol.ts";
import { CLOSE_REPLACED, Room } from "./room.ts";
import { TraceStore } from "./traces.ts";

class FakeConn {
  messages: ServerMsg[] = [];
  closed: number | null = null;
  send(data: string) {
    this.messages.push(JSON.parse(data));
  }
  close(code?: number) {
    this.closed = code ?? 1000;
  }
  of<T extends ServerMsg["type"]>(type: T) {
    return this.messages.filter((m): m is Extract<ServerMsg, { type: T }> => m.type === type);
  }
}

function setup() {
  const clock = { now: 1_000_000 };
  const store = new TraceStore({ file: null, now: () => clock.now });
  const room = new Room({ store, now: () => clock.now, resumeGraceMs: 30_000 });
  return { clock, store, room };
}

const at = (x: number, section: PeerState["section"] = "home"): PeerState => ({ p: [x, 1, 0], perch: null, section });

describe("Room", () => {
  it("welcomes a new visitor and tells the others", () => {
    const { room, store } = setup();
    const a = new FakeConn();
    const b = new FakeConn();
    const pa = room.hello(a);
    room.updateState(pa, at(1));
    const pb = room.hello(b);

    const welcome = b.of("welcome")[0];
    expect(welcome.self).toEqual(pb.identity);
    expect(welcome.peers).toEqual([{ ...pa.identity, state: at(1) }]);
    expect(welcome.online).toBe(2);
    expect(welcome.totalVisitors).toBe(2);
    expect(a.of("join")[0].peer).toEqual(pb.identity);
    expect(a.of("count").at(-1)).toEqual({ type: "count", online: 2, totalVisitors: 2 });
    expect(store.totalVisitors).toBe(2);
  });

  it("broadcasts only changed states, never back to the owner", () => {
    const { room } = setup();
    const a = new FakeConn();
    const b = new FakeConn();
    const pa = room.hello(a);
    room.hello(b);
    room.updateState(pa, at(1));
    room.tick();
    expect(b.of("states")).toEqual([{ type: "states", states: [[pa.identity.id, at(1)]] }]);
    expect(a.of("states")).toEqual([]);

    room.updateState(pa, at(1));
    room.tick();
    expect(b.of("states")).toHaveLength(1);
  });

  it("resumes an identity within the grace period without a leave", () => {
    const { room, clock, store } = setup();
    const a = new FakeConn();
    const watcher = new FakeConn();
    const pa = room.hello(a);
    room.hello(watcher);
    room.detach(pa, a);

    clock.now += 10_000;
    room.tick();
    const a2 = new FakeConn();
    const resumed = room.hello(a2, pa.identity.id);
    expect(resumed).toBe(pa);
    expect(a2.of("welcome")[0].self).toEqual(pa.identity);
    expect(watcher.of("leave")).toEqual([]);
    expect(watcher.of("join")).toHaveLength(0);
    expect(store.totalVisitors).toBe(2);

    clock.now += 60_000;
    room.tick();
    expect(room.online).toBe(2);
  });

  it("gives a fresh identity after the grace period", () => {
    const { room, clock } = setup();
    const a = new FakeConn();
    const pa = room.hello(a);
    room.detach(pa, a);
    clock.now += 31_000;
    room.tick();
    const fresh = room.hello(new FakeConn(), pa.identity.id);
    expect(fresh.identity.id).not.toBe(pa.identity.id);
  });

  it("takes over a still-open socket with the same resumeId", () => {
    const { room } = setup();
    const a = new FakeConn();
    const pa = room.hello(a);
    const a2 = new FakeConn();
    expect(room.hello(a2, pa.identity.id)).toBe(pa);
    expect(a.closed).toBe(CLOSE_REPLACED);
    // The late close of the old socket must not detach the new one.
    room.detach(pa, a);
    expect(pa.conn).toBe(a2);
  });

  it("leaves a trace after the grace period if the visitor stayed and moved", () => {
    const { room, clock, store } = setup();
    const a = new FakeConn();
    const watcher = new FakeConn();
    const pa = room.hello(a);
    room.hello(watcher);
    for (let i = 0; i < 20; i++) {
      clock.now += 500;
      room.updateState(pa, at(i * 0.5, i > 10 ? "work" : "home"));
    }
    room.detach(pa, a);
    const leftAt = clock.now;
    clock.now += 30_000;
    room.tick();

    const leave = watcher.of("leave")[0];
    expect(leave.id).toBe(pa.identity.id);
    expect(leave.trace).toMatchObject({ id: pa.identity.id, rest: [9.5, 1, 0], sections: ["home", "work"], leftAt });
    expect(leave.trace!.path.length).toBeGreaterThan(5);
    expect(store.list()).toHaveLength(1);
    expect(watcher.of("count").at(-1)).toMatchObject({ online: 1 });
  });

  it("leaves no trace for a quick or motionless visit", () => {
    const { room, clock, store } = setup();
    const watcher = new FakeConn();
    room.hello(watcher);

    const quick = new FakeConn();
    const pq = room.hello(quick);
    room.updateState(pq, at(0));
    room.updateState(pq, at(5));
    clock.now += 2_000;
    room.detach(pq, quick);

    const still = new FakeConn();
    const ps = room.hello(still);
    room.updateState(ps, at(0));
    clock.now += 60_000;
    room.detach(ps, still);

    clock.now += 30_000;
    room.tick();
    expect(watcher.of("leave").map((l) => l.trace)).toEqual([null, null]);
    expect(store.list()).toEqual([]);
  });
});
