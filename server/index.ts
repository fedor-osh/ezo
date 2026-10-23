// Ezo presence server: one HTTP server, a WebSocket room at /ws, the built site in production.
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import { STATE_HZ } from "../src/shared/protocol.ts";
import { RateLimiter } from "./rate.ts";
import { Room, type Conn, type Peer } from "./room.ts";
import { createStaticHandler } from "./static.ts";
import { TraceStore } from "./traces.ts";
import { MAX_MESSAGE_BYTES, parseClientMessage } from "./validate.ts";

const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = resolve(process.env.DATA_DIR || "./data");
const PROD = process.env.NODE_ENV === "production";
const DIST_DIR = resolve(process.env.DIST_DIR || fileURLToPath(new URL("../dist", import.meta.url)));

const HEARTBEAT_MS = 20_000;
const HELLO_TIMEOUT_MS = 10_000;

const store = new TraceStore({ file: resolve(DATA_DIR, "ezo.json") });
store.load();
const room = new Room({ store, resumeGraceMs: Number(process.env.RESUME_GRACE_MS) || undefined });
const serveStatic = PROD ? createStaticHandler(DIST_DIR) : null;

const server = createServer((req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  if (path === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ ok: true, online: room.online, totalVisitors: store.totalVisitors }));
    return;
  }
  if (serveStatic) {
    serveStatic(req, res).catch((err) => {
      console.error("[static]", err);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Ezo server: the site is served by Vite in dev.");
});

const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

server.on("upgrade", (req, socket, head) => {
  if ((req.url ?? "").split("?")[0] !== "/ws") {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
});

const alive = new WeakMap<WebSocket, boolean>();

wss.on("connection", (ws: WebSocket) => {
  const conn: Conn = {
    send: (data) => {
      if (ws.readyState === ws.OPEN) ws.send(data);
    },
    close: (code, reason) => ws.close(code, reason),
  };
  const limiter = new RateLimiter();
  let peer: Peer | null = null;
  alive.set(ws, true);

  const helloTimer = setTimeout(() => ws.close(4001, "hello expected"), HELLO_TIMEOUT_MS);

  ws.on("pong", () => alive.set(ws, true));

  ws.on("message", (data: RawData, isBinary: boolean) => {
    const verdict = limiter.hit(Date.now());
    if (verdict === "kick") {
      ws.close(4008, "too many messages");
      return;
    }
    if (verdict === "drop" || isBinary) return;
    const msg = parseClientMessage(data.toString());
    if (!msg) return;
    if (msg.type === "hello") {
      if (peer) return;
      clearTimeout(helloTimer);
      peer = room.hello(conn, msg.resumeId);
    } else if (peer) {
      room.updateState(peer, { p: msg.p, perch: msg.perch, section: msg.section });
    }
  });

  ws.on("close", () => {
    clearTimeout(helloTimer);
    if (peer) room.detach(peer, conn);
  });
  ws.on("error", () => ws.terminate());
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!alive.get(ws)) {
      ws.terminate();
      continue;
    }
    alive.set(ws, false);
    ws.ping();
  }
}, HEARTBEAT_MS);

const ticker = setInterval(() => room.tick(), 1000 / STATE_HZ);
// Hourly prune so week-old traces disappear even on a quiet server.
const pruner = setInterval(() => store.list(), 60 * 60 * 1000);

server.listen(PORT, HOST, () => {
  console.log(`[ezo] listening on http://${HOST}:${PORT} (ws at /ws${PROD ? `, serving ${DIST_DIR}` : ""}), data in ${DATA_DIR}`);
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[ezo] ${signal}, saving and shutting down`);
  clearInterval(heartbeat);
  clearInterval(ticker);
  clearInterval(pruner);
  room.closeAll();
  for (const ws of wss.clients) ws.close(1012, "restarting");
  server.close();
  await store.flush();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
