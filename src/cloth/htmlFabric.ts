// HTML-in-Canvas label textures (WICG proposal, behind chrome://flags/#canvas-draw-element).
//
// The WebGL canvas gets `layoutsubtree`, each cloth's source <div> lives INSIDE the canvas, and
// on the canvas `paint` event `texElementImage2D` uploads the rendered HTML into a texture.
//
// Why not upload into the CanvasTexture three already made: three allocates 2D textures with
// immutable `texStorage2D`, and a texImage2D-style re-specification of an immutable texture is
// an INVALID_OPERATION. So each cloth gets its own GL texture, wrapped in THREE.ExternalTexture
// (three binds it as-is), and the material swaps to it after the first successful upload.
import * as THREE from "three";
import type { Engine } from "../core/types.ts";
import { CREAM, fabricSize, LABEL_FONT, mix, type FabricDesign } from "./fabric.ts";

// Chrome 150+: (target, internalformat, element). Chrome 138–149: (target, level, internalformat, format, type, element).
type TexElementImage2D = (...args: Array<GLenum | Element>) => void;
type HtmlGL = WebGL2RenderingContext & { texElementImage2D?: TexElementImage2D };
type HtmlCanvas = HTMLCanvasElement & { requestPaint?: () => void };
type PaintEvent = Event & { changedElements?: Element[] };

export function htmlInCanvasSupported(engine: Engine): boolean {
  const gl = engine.renderer.getContext() as HtmlGL;
  return typeof gl.texElementImage2D === "function" && typeof (engine.canvas as HtmlCanvas).requestPaint === "function";
}

interface Entry {
  el: HTMLElement;
  glTex: WebGLTexture;
  texture: THREE.ExternalTexture;
  ready: boolean;
  onReady(texture: THREE.Texture): void;
}

/**
 * Mirror each design as live HTML inside the canvas. `onReady` fires once per design with the
 * HTML-backed texture after its first successful upload. Returns false when unsupported.
 */
export function installHtmlFabrics(
  engine: Engine,
  items: Array<{ design: FabricDesign; widthPx: number; onReady(texture: THREE.Texture): void }>,
): boolean {
  if (!htmlInCanvasSupported(engine) || items.length === 0) return false;
  const canvas = engine.canvas as HtmlCanvas;
  const gl = engine.renderer.getContext() as HtmlGL;
  const upload = gl.texElementImage2D as TexElementImage2D;
  const aniso = engine.renderer.extensions.get("EXT_texture_filter_anisotropic") as {
    TEXTURE_MAX_ANISOTROPY_EXT: number;
  } | null;
  const maxAniso = Math.min(8, engine.renderer.capabilities.getMaxAnisotropy());

  if (!canvas.hasAttribute("layoutsubtree")) canvas.setAttribute("layoutsubtree", "");

  const entries: Entry[] = [];
  for (const item of items) {
    const glTex = gl.createTexture();
    if (!glTex) continue;
    const el = buildElement(item.design, item.widthPx);
    canvas.appendChild(el);
    const texture = new THREE.ExternalTexture(glTex);
    texture.colorSpace = THREE.SRGBColorSpace;
    entries.push({ el, glTex, texture, ready: false, onReady: item.onReady });
  }

  let broken = false;
  const uploadOne = (e: Entry): boolean => {
    gl.bindTexture(gl.TEXTURE_2D, e.glTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // our UVs follow three's flipY convention
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    // sRGB storage so three's linear workflow sees correctly decoded colours; RGBA as a retry.
    for (const internal of [gl.SRGB8_ALPHA8, gl.RGBA8]) {
      while (gl.getError() !== gl.NO_ERROR) {
        /* drain stale errors */
      }
      if (upload.length === 3) upload.call(gl, gl.TEXTURE_2D, internal, e.el);
      else upload.call(gl, gl.TEXTURE_2D, 0, internal === gl.RGBA8 ? gl.RGBA : internal, gl.RGBA, gl.UNSIGNED_BYTE, e.el);
      if (gl.getError() === gl.NO_ERROR) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso);
        return true;
      }
    }
    return false;
  };

  const onPaint = (event: Event) => {
    if (broken) return;
    const changed = (event as PaintEvent).changedElements;
    try {
      for (const e of entries) {
        if (e.ready && changed && !changed.includes(e.el)) continue;
        if (!uploadOne(e)) throw new Error("texElementImage2D rejected the upload");
        if (!e.ready) {
          e.ready = true;
          e.onReady(e.texture);
        }
      }
    } catch (err) {
      // Keep the Canvas 2D fabric; it is already on screen.
      broken = true;
      console.warn("[cloth] HTML-in-Canvas upload failed, staying on the 2D fallback", err);
    } finally {
      // We touched texture bindings and pixel-store state behind three's back.
      engine.renderer.resetState();
    }
  };
  canvas.addEventListener("paint", onPaint);
  canvas.requestPaint?.();
  // Webfonts may arrive later and change the text metrics.
  document.fonts?.ready.then(() => canvas.requestPaint?.());
  return true;
}

function buildElement(d: FabricDesign, widthPx: number): HTMLElement {
  const { w, h } = fabricSize(d, widthPx);
  const s = w / 512;
  const el = document.createElement("div");
  // Purely visual: the DOM nav is the accessible version of these links.
  el.setAttribute("aria-hidden", "true");
  el.inert = true;
  const ink = mix(d.accent, "#3a2a22", 0.45);
  const clip = d.shape.outline.map(([u, v]) => `${(u * 100).toFixed(2)}% ${(v * 100).toFixed(2)}%`).join(",");
  el.style.cssText = [
    `width:${w}px`,
    `height:${h}px`,
    "position:absolute",
    "left:0",
    "top:0",
    "pointer-events:none",
    "overflow:hidden",
    "box-sizing:border-box",
    `background-color:${d.base}`,
    `background-image:${cssPattern(d, s)}`,
    `background-size:${cssPatternSize(d, s)}`,
  ].join(";");
  const stitch = document.createElement("div");
  stitch.style.cssText = [
    "position:absolute",
    `inset:${16 * s}px`,
    `border:${4 * s}px dashed ${CREAM}`,
    `border-radius:${6 * s}px`,
    `clip-path:polygon(${clip})`,
  ].join(";");
  el.appendChild(stitch);

  if (d.label) {
    const { cx, cy, w: lw } = d.shape.label;
    const patch = document.createElement("div");
    patch.textContent = d.label;
    patch.style.cssText = [
      "position:absolute",
      `left:${cx * 100}%`,
      `top:${cy * 100}%`,
      `max-width:${lw * w}px`,
      `transform:translate(-50%,-50%) rotate(${((d.seed % 7) - 3) * 0.7}deg)`,
      `padding:${18 * s}px ${34 * s}px`,
      `background:${CREAM}`,
      `border-radius:${44 * s}px`,
      `outline:${3.5 * s}px dashed ${d.accent}`,
      `outline-offset:-${10 * s}px`,
      `box-shadow:0 ${3 * s}px ${8 * s}px rgba(40,20,10,.25)`,
      `font:800 ${Math.min(110 * s, (lw * w) / Math.max(4, d.label.length) / 0.62)}px/1.1 ${LABEL_FONT}`,
      `color:${ink}`,
      `text-shadow:${1.5 * s}px ${2 * s}px 0 ${mix(ink, "#000000", 0.35)}`,
      "white-space:nowrap",
    ].join(";");
    el.appendChild(patch);
  }
  return el;
}

function cssPattern(d: FabricDesign, s: number): string {
  const a = d.accent;
  switch (d.pattern) {
    case "stripes":
      return `repeating-linear-gradient(180deg,transparent 0 ${30 * s}px,${a} ${30 * s}px ${76 * s}px,transparent ${76 * s}px ${97 * s}px)`;
    case "pinstripe":
      return `repeating-linear-gradient(90deg,transparent 0 ${10 * s}px,${a} ${10 * s}px ${13 * s}px,transparent ${13 * s}px ${26 * s}px)`;
    case "dots":
      return `radial-gradient(${a} ${12 * s}px,transparent ${12.5 * s}px)`;
    case "checks":
      return `linear-gradient(90deg,${a}73 50%,transparent 50%),linear-gradient(0deg,${a}73 50%,transparent 50%)`;
    case "flowers":
      return `radial-gradient(circle at 50% 50%,#ffd23f ${5 * s}px,${a} ${5.5 * s}px ${14 * s}px,transparent ${14.5 * s}px)`;
    case "plain":
      return `linear-gradient(0deg,transparent ${24 * s}px,${a} ${24 * s}px ${70 * s}px,transparent ${70 * s}px)`;
    default:
      return "none";
  }
}

function cssPatternSize(d: FabricDesign, s: number): string {
  switch (d.pattern) {
    case "dots":
      return `${58 * s}px ${50 * s}px`;
    case "checks":
      return `${88 * s}px ${88 * s}px`;
    case "flowers":
      return `${70 * s}px ${64 * s}px`;
    default:
      return "auto";
  }
}
