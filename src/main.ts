import "./styles.css";
import { createEngine } from "./core/engine.ts";
import { installInput } from "./core/input.ts";
import { buildWorld } from "./world/index.ts";
import { initCloth } from "./cloth/index.ts";
import { initLife } from "./life/index.ts";
import { initCreatures } from "./life/creatures/index.ts";
import { connect } from "./net/client.ts";
import { initUI } from "./ui/index.ts";
import { installCameraDirector } from "./ui/camera.ts";

async function main() {
  // The DOM UI comes first and works on its own: the 3D yard is an enhancement.
  initUI();
  connect();

  const canvas = document.querySelector<HTMLCanvasElement>("#scene");
  if (!canvas || !supportsWebGL2()) {
    document.documentElement.dataset.webgl = "none";
    return;
  }

  const engine = createEngine(canvas);
  installInput(engine);
  installCameraDirector(engine);
  const world = buildWorld(engine);
  initCloth(engine);
  initCreatures(engine, world);
  await initLife(engine, world);
}

function supportsWebGL2(): boolean {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

main().catch((err) => {
  console.error(err);
  document.documentElement.dataset.webgl = "error";
});
