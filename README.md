# Ezo · ეზო

The portfolio of **Fedor Oshepkov**, fullstack TypeScript engineer. It's a small multiplayer Tbilisi courtyard
("ezo" is Georgian for "yard"):

- The navigation buttons are **cloths on a clothesline**. They're Verlet-simulated, billow in a shared wind field,
  and have their labels painted on. In Chrome builds with the experimental
  [HTML-in-Canvas](https://github.com/WICG/html-in-canvas) API the labels are real HTML rendered into the texture.
  Every other browser gets a Canvas 2D fabric.
- **Your cursor is a 3D butterfly** (or, for some visitors, a **leaf** that drifts toward the cursor as if the wind
  carries it). It lands on cloths. **Other visitors' creatures fly around in real time.**
- **When someone leaves, they leave a trace**: their butterfly falls asleep where they were, their leaf joins the pile
  in their colour, and a ghost trail of their path fades over a day.
- **Hundreds of leaves** with Rapier physics, plus **cats that get scared** of anyone's butterfly and run.
- Grandmothers on a bench, grandpa playing nardi, a tone oven baking puri, a supra table close-up, shushabandi
  windows, a Zhiguli, a delivery scooter and tangled internet cables.

The 3D scene sits on top of a **plain, accessible page**:

- Semantic landmarks, a skip link, real links and buttons, visible focus rings.
- Focus moves to the panel heading when you change section.
- Polite live presence announcements.
- Keyboard shortcuts: `1`–`5` pick a section, `Esc` goes home.
- Respects `prefers-reduced-motion` (also a toggle), `forced-colors` and dark mode.
- A **flat mode** that turns the yard off entirely.
- The site still works without WebGL and without the server.

## Run it

```bash
npm install
npm run dev
```

`npm run dev` starts two processes:

- Vite on http://localhost:5173.
- The presence server on :8787. Vite proxies `/ws` to it.

```bash
npm run build && npm start
```

That's production: one Node process serves `dist/` and the WebSocket on `$PORT`.

```bash
npm test
```

The tests use Vitest. They cover cloth, creature dynamics, cat brains and steering, UI routing and flight, the server
room, validation, rate limits, trace storage and static serving.

### Environment variables

| Var | Default | |
|---|---|---|
| `PORT` | `8787` | HTTP + WebSocket |
| `DATA_DIR` | `./data` | traces and visitor count (`ezo.json`, written atomically) |
| `RESUME_GRACE_MS` | `30000` | a reload within this window keeps your identity and leaves no trace |
| `VITE_WS_URL` | same origin `/ws` | build-time override for static hosting |

## How it's put together

```
src/
  core/      engine loop, input (raycast → aim point), wind field, nanostores, layout, sections, shared registries
  world/     the procedural courtyard: merged vertex-coloured batches, instancing, shader sway, sky/PMREM
  cloth/     Verlet cloth, clothesline + pins, Canvas 2D fabric, HTML-in-Canvas upgrade
  life/      Rapier world, leaves, cats (lazy chunk: Rapier inlines its WASM)
  life/creatures/  butterfly & leaf pointer dynamics, peers, perching, traces
  net/       WebSocket client: identity, peers, reconnect with backoff
  ui/        accessible DOM, hash routing, presence chip, settings, camera director
  shared/    wire protocol (imported by browser and server)
server/      Node + ws: room, validation, rate limits, path recording, trace store, static files
```

- **State** lives in [Nanostores](https://github.com/nanostores/nanostores), so the DOM UI and the 3D scene share one
  source of truth (`$section`, `$highlighted`, `$reducedMotion`…). Data that changes every frame (pointer, creature
  positions, peer states) lives in plain mutable maps. That way nothing re-renders 60 times a second.
- **Networking** sends each visitor's *aim point*, not their creature's position, at 15 Hz and only when it changes.
  Each client runs the same creature dynamics for every peer locally. Remote butterflies therefore move just as
  characterfully as yours, and no interpolation is needed.
- **The server** keeps no secrets and accepts very little. Every message is strictly validated, rate limited and
  capped at 1 KB. Identities are assigned by the server. Paths are downsampled server-side, and traces are capped
  and expire after 7 days.
- **CSS** goes through PostCSS + Autoprefixer, with targets from `browserslist` in `package.json`. It uses cascade
  layers, `color-mix()` and logical properties.
- **Performance:**
  - The world is merged into roughly 55 draw calls.
  - Leaves are instanced, and only a rotating subset feels the wind each frame.
  - Physics runs at a fixed step.
  - The physics chunk loads after first paint.
  - Rendering pauses in flat mode and in hidden tabs.

Content (projects, stack, contact) is in [`src/content.ts`](src/content.ts).

## Credits

The cloth-as-HTML idea is inspired by [fimbox/html-in-canvas](https://github.com/fimbox/html-in-canvas). Every
model in the yard is built procedurally in code; there are no downloaded assets.
