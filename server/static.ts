// Minimal static file handler for the built site (production only).
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, resolve, sep } from "node:path";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

const IMMUTABLE = "public, max-age=31536000, immutable";

/** Resolve a URL path inside `root`, or null if it escapes it or is malformed. */
export function resolveSafe(root: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const base = resolve(root);
  const full = resolve(join(base, decoded));
  return full === base || full.startsWith(base + sep) ? full : null;
}

export function createStaticHandler(root: string) {
  const indexFile = join(resolve(root), "index.html");

  return async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const urlPath = req.url ?? "/";
    const full = resolveSafe(root, urlPath);
    if (!full) {
      res.writeHead(400).end("Bad request");
      return;
    }

    let file = full;
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      file = join(file, "index.html");
      info = await stat(file).catch(() => null);
    }
    if (!info?.isFile()) {
      // Missing hashed assets are real 404s; anything else is a client-side route → index.html.
      if (urlPath.startsWith("/assets/") || extname(full) !== "") {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
        return;
      }
      file = indexFile;
      info = await stat(file).catch(() => null);
      if (!info?.isFile()) {
        res.writeHead(404).end("Not found");
        return;
      }
    }

    const isHtml = extname(file) === ".html";
    res.writeHead(200, {
      "Content-Type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": info.size,
      "Cache-Control": urlPath.startsWith("/assets/") ? IMMUTABLE : isHtml ? "no-cache" : "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Last-Modified": info.mtime.toUTCString(),
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(file)
      .on("error", () => res.destroy())
      .pipe(res);
  };
}
