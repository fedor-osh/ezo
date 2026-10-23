import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Identity, ServerMsg, Trace } from "../shared/protocol.ts";

const selfState = { p: [0, 1, 2] as [number, number, number], perch: null };
vi.mock("../life/creatures/index.ts", () => ({ getSelfState: () => selfState }));

class FakeSocket extends EventTarget {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: Array<Record<string, unknown>> = [];
  constructor(public url: string) {
    super();
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {}
  serverOpen() {
    this.readyState = 1;
    this.dispatchEvent(new Event("open"));
  }
  serverSend(msg: ServerMsg) {
    this.dispatchEvent(Object.assign(new Event("message"), { data: JSON.stringify(msg) }));
  }
  serverClose(code = 1006) {
    this.readyState = 3;
    this.dispatchEvent(Object.assign(new Event("close"), { code }));
  }
}

const storage = new Map<string, string>();
const me: Identity = { id: "me1", kind: "leaf", color: "#ffc75f", name: "Tiny Tklapi" };
const other: Identity = { id: "p2", kind: "butterfly", color: "#3bceac", name: "Brave Khinkali" };
const trace = { id: "p2", kind: "butterfly", color: "#3bceac", name: "Brave Khinkali", path: [], rest: [0, 0, 0], perch: null, sections: ["home"], arrivedAt: 1, leftAt: 2 } satisfies Trace;

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
  FakeSocket.instances = [];
  storage.clear();
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.stubGlobal("location", { protocol: "https:", host: "ezo.example" });
  vi.stubGlobal("document", Object.assign(new EventTarget(), { hidden: false }));
  vi.stubGlobal("addEventListener", () => {});
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, v),
    removeItem: (k: string) => void storage.delete(k),
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function boot() {
  const client = await import("./client.ts");
  const stores = await import("../core/stores.ts");
  const presence = await import("../core/presence.ts");
  client.connect();
  return { ...stores, ...presence, socket: FakeSocket.instances[0] };
}

describe("net client", () => {
  it("has a provisional self, then adopts the server identity", async () => {
    storage.set("ezo:id", "me1");
    const { socket, $self, $connection, $peers, peerStates, $traces, $counts } = await boot();
    expect(socket.url).toBe("wss://ezo.example/ws");
    expect($self.get()?.name).toBe("You");
    expect($connection.get()).toBe("connecting");

    socket.serverOpen();
    expect(socket.sent[0]).toEqual({ type: "hello", resumeId: "me1" });

    socket.serverSend({
      type: "welcome",
      self: me,
      peers: [{ ...other, state: { p: [1, 1, 1], perch: null, section: "home" } }],
      traces: [trace],
      online: 2,
      totalVisitors: 9,
    });
    expect($self.get()).toEqual(me);
    expect($connection.get()).toBe("online");
    expect(Object.keys($peers.get())).toEqual(["p2"]);
    expect(peerStates.get("p2")?.state.p).toEqual([1, 1, 1]);
    expect($traces.get()).toHaveLength(1);
    expect($counts.get()).toEqual({ online: 2, totalVisitors: 9 });
    expect(storage.get("ezo:id")).toBe("me1");
  });

  it("streams peers, sends only changed state and handles leave", async () => {
    const { socket, $peers, peerStates, $traces } = await boot();
    socket.serverOpen();
    socket.serverSend({ type: "welcome", self: me, peers: [], traces: [], online: 1, totalVisitors: 1 });

    socket.serverSend({ type: "join", peer: other });
    expect($peers.get().p2?.state).toBeNull();
    const first = $peers.get().p2;
    socket.serverSend({ type: "states", states: [["p2", { p: [2, 2, 2], perch: null, section: "home" }]] });
    const afterFirst = $peers.get().p2;
    expect(afterFirst).not.toBe(first);
    socket.serverSend({ type: "states", states: [["p2", { p: [3, 2, 2], perch: null, section: "home" }]] });
    expect(peerStates.get("p2")?.state.p).toEqual([3, 2, 2]);
    expect($peers.get().p2).toBe(afterFirst);

    vi.advanceTimersByTime(200);
    const states = () => socket.sent.filter((m) => m.type === "state");
    expect(states()).toHaveLength(1);
    expect(states()[0]).toEqual({ type: "state", p: [0, 1, 2], perch: null, section: "home" });
    selfState.p = [0.005, 1, 2];
    vi.advanceTimersByTime(200);
    expect(states()).toHaveLength(1);
    selfState.p = [0.5, 1, 2];
    vi.advanceTimersByTime(200);
    expect(states()).toHaveLength(2);

    socket.serverSend({ type: "leave", id: "p2", trace });
    expect($peers.get().p2).toBeUndefined();
    expect(peerStates.has("p2")).toBe(false);
    expect($traces.get()).toEqual([trace]);
  });

  it("goes offline and reconnects with backoff", async () => {
    const { socket, $connection } = await boot();
    socket.serverClose();
    expect($connection.get()).toBe("offline");
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.instances).toHaveLength(2);
    FakeSocket.instances[1].serverClose();
    vi.advanceTimersByTime(999);
    expect(FakeSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1001);
    expect(FakeSocket.instances).toHaveLength(3);
  });

  it("drops the stored identity when another tab takes it over", async () => {
    storage.set("ezo:id", "me1");
    const { socket } = await boot();
    socket.serverClose(4000);
    expect(storage.has("ezo:id")).toBe(false);
  });
});
