# Ezo — shared brief for everyone building it

**Ezo** (ეზო, Georgian for "yard") is the portfolio of Fedor Oshepkov, a fullstack TypeScript engineer applying to
Evil Martians (frontend engineer: polished UI, CSS/UX care, accessibility, TypeScript front and back, Node, their OSS
ecosystem: PostCSS, Autoprefixer, Browserslist, Nanostores, AnyCable).

The site is a cute, colourful, low-poly 3D **Tbilisi courtyard** rendered with Three.js:

- Old houses with carved wooden balconies and **shushabandi** — glazed balconies with colourful glass panes.
- Post-Soviet: a beige VAZ-2101 Zhiguli, yellow gas pipes along the walls, an old ZIL fridge, rusty water tank.
- Modern era: delivery scooter with a yellow box, AC units, satellite dish, tangled internet cables, a Wi-Fi router
  glowing in a window, solar water heater.
- Life: grandmothers on a bench, grandpa playing nardi, a **tone** clay oven, **puri** (canoe-shaped shoti bread),
  a supra table with khachapuri, churchkhela, khinkali, wine jug, herbs, under a grape-vine pergola. A fig tree.
- **Tons of leaves** with collision physics lying around (Rapier). **Cats** that get scared of pointers and run.
- **Clotheslines** across the yard. The navigation buttons are **colourful cloths** hanging on the main line
  (Verlet cloth, label painted on the fabric; HTML-in-Canvas texture where the browser supports it).
- Each visitor's cursor is a **3D butterfly** (most visitors) or a **leaf** (some), visible to every other visitor
  in real time. The butterfly flies with acceleration/flapping and **lands on a cloth** when the cursor touches it.
  The leaf does not follow the cursor directly: it drifts toward it as if the wind carried it.
- When a visitor leaves, they leave a **trace** behind (their butterfly falls asleep somewhere, their leaf joins
  the pile on the ground with their colour, a faint ghost trail of their path fades over a day).
- Clicking a cloth moves the camera to a section shot. Some shots are close plans (the supra table with food)
  with the busy yard in the background.
- Very little text. Accessible, simple DOM UI on top: everything works with keyboard and screen reader and with
  `prefers-reduced-motion`, and there is a flat (no-3D) mode.

## Repo layout and ownership

Repo: `/Users/fedor_osh/Documents/dev-for-fun/ezo`. Vite + strict TypeScript, Three r186, Rapier
(`@dimforge/rapier3d-compat`), Nanostores, `ws` on the server. **Do not add npm dependencies.**

| Path | Owner |
|---|---|
| `src/core/*`, `src/shared/*`, `src/main.ts` | orchestrator (read them; do not edit, except `layout.ts`/`sections.ts` coordinates by the world agent) |
| `src/world/**`, `src/core/layout.ts`, shot coordinates in `src/core/sections.ts` | world agent |
| `src/cloth/**` | cloth agent |
| `src/life/creatures/**` | creatures agent (butterfly, leaf pointer, peers, traces) |
| `src/life/*.ts` (not creatures/) | physics agent (Rapier world, leaves, cats) |
| `src/net/**`, `server/**` | net agent |
| `src/ui/**`, `index.html`, `src/styles.css`, `src/content.ts` | UI agent |

Several agents work in this folder **at the same time**. Touch only files you own. Do not run `git` commands that
change state (no commit, checkout, stash, reset). If `npx tsc --noEmit` shows errors in files you don't own, ignore
them; your files must be clean. Each module's entry function signature is already in its stub — keep it.

## Shared contracts (read these files first)

- `src/core/types.ts` — `Engine` (`onUpdate(fn, ORDER.x)`), `ColliderSpec`, `WorldHandle`.
- `src/core/layout.ts` — where everything is (metres, y up, yard opens toward +Z).
- `src/core/sections.ts` — sections, cloth labels/palettes/patterns, camera shots.
- `src/core/stores.ts` — nanostores: `$section`, `$highlighted`, `$reducedMotion`, `$mode`, `$self`, `$peers`, `$traces`…
- `src/core/presence.ts` — hot per-frame maps: `peerStates` (net → creatures), `flyers` (creatures → cats/leaves).
- `src/core/surfaces.ts` — `registerInteractable` (raycast + click), `registerSurface` (perchable deforming surface).
- `src/core/input.ts` — `pointer` (aim point in world, hover hit, uv on surface).
- `src/core/wind.ts` — `windAt(p, t)`, `gust()`, shared by cloth, leaves, leaf pointers.
- `src/shared/protocol.ts` — WebSocket messages.

## Style

Cute, warm, colourful, low-poly, soft. Late-afternoon golden light. Flat-shaded `MeshStandardMaterial` /
`MeshLambertMaterial` with a cohesive palette (terracotta, cream plaster, sky blue, mint, saffron, wine red,
vine green). Build everything procedurally from primitives — no downloaded assets. Mind performance: merge static
geometry (`BufferGeometryUtils.mergeGeometries` from `three/examples/jsm/utils/BufferGeometryUtils.js`), use
`InstancedMesh` for repeats, keep draw calls low, honour `engine.quality === "low"`.

Code: strict TS, small focused modules, comments only where the why is not obvious.
