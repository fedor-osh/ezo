// The DOM layer: nav, panels, URL hash, settings, presence. It works on its own; the 3D yard is an enhancement.
import { SECTIONS } from "../core/sections.ts";
import { $highlighted, $mode, $reducedMotion, $sceneReady, $section } from "../core/stores.ts";
import type { SectionId } from "../shared/protocol.ts";
import { h, qs } from "./dom.ts";
import { headingOf, renderPanels } from "./panels.ts";
import { readPref, writePref } from "./prefs.ts";
import { installPresence } from "./presence.ts";
import { hashForSection, sectionFromDigit, sectionFromHash } from "./route.ts";
import { viewInset } from "./viewport.ts";

const root = document.documentElement;
/** Keep in sync with the bottom-sheet breakpoint in styles.css. */
const SHEET_QUERY = "(max-width: 40rem)";
const EXIT_MS = 180;

export function initUI(): void {
  const panels = renderPanels(qs("[data-panels]"));
  const links = renderNav(qs("[data-nav]"));
  const stage = qs("main");
  const sceneDesc = qs("[data-scene-desc]");
  const sheet = matchMedia(SHEET_QUERY);

  installPreferences();
  installPresence(qs("[data-presence]"), qs("[data-announcer]"));

  // ---- Section state ------------------------------------------------------------------------------
  $section.set(sectionFromHash(location.hash) ?? "home");

  const motionOK = () => !$reducedMotion.get();
  const isFlat = () => $mode.get() === "flat";

  const showPanel = (id: SectionId, animate: boolean) => {
    for (const [pid, el] of panels) {
      if (pid === id || isFlat()) {
        el.hidden = false;
        el.inert = false;
        delete el.dataset.state;
        continue;
      }
      if (el.hidden) continue;
      if (!animate) {
        el.hidden = true;
        continue;
      }
      // The old card fades out on top of the new one, unreachable meanwhile.
      el.inert = true;
      el.dataset.state = "out";
      setTimeout(() => {
        if ($section.get() === pid || isFlat()) return;
        el.hidden = true;
        el.inert = false;
        delete el.dataset.state;
      }, EXIT_MS);
    }
    for (const [lid, a] of links) {
      if (lid === id) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
    measureInset();
  };

  const focusPanel = (id: SectionId) => {
    const panel = panels.get(id);
    const heading = panel && headingOf(panel);
    if (!panel || !heading) return;
    heading.focus({ preventScroll: true });
    if (isFlat()) panel.scrollIntoView({ behavior: motionOK() ? "smooth" : "auto", block: "start" });
    else panel.scrollTop = 0;
  };

  showPanel($section.get(), false);

  // Every later change was asked for by the visitor (nav, cloth, keys, history): announce it by
  // moving focus to the new heading. The initial load never steals focus.
  $section.listen((id) => {
    showPanel(id, motionOK() && !isFlat());
    focusPanel(id);
    if (sectionFromHash(location.hash) !== id) history.pushState(null, "", hashForSection(id));
  });

  const fromLocation = () => {
    const id = sectionFromHash(location.hash);
    if (id && id !== $section.get()) $section.set(id);
  };
  addEventListener("hashchange", fromLocation);
  addEventListener("popstate", fromLocation);

  // ---- Keyboard -----------------------------------------------------------------------------------
  addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
    if (isTyping(e.target)) return;
    if (e.key === "Escape") {
      if ($section.get() !== "home") $section.set("home");
      return;
    }
    const id = sectionFromDigit(e.key);
    if (id && !e.shiftKey) $section.set(id);
  });

  qs("[data-skip]").addEventListener("click", (e) => {
    e.preventDefault();
    const heading = headingOf(panels.get($section.get())!);
    (heading ?? stage).focus();
  });

  // ---- Highlight the matching cloth while a nav item is hovered or focused -------------------------
  for (const [id, a] of links) {
    const on = () => $highlighted.set(id);
    const off = () => {
      if ($highlighted.get() === id) $highlighted.set(null);
    };
    // Handle plain activation ourselves: the browser's own fragment navigation would focus the
    // (scrollable) panel after we have focused its heading. Modified clicks keep native behaviour.
    a.addEventListener("click", (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      if ($section.get() === id) focusPanel(id);
      else $section.set(id);
    });
    a.addEventListener("pointerenter", on);
    a.addEventListener("focus", on);
    a.addEventListener("pointerleave", off);
    a.addEventListener("blur", off);
  }

  // ---- Mode, loading, fallback --------------------------------------------------------------------
  $mode.subscribe((mode) => {
    root.dataset.mode = mode;
    sceneDesc.hidden = mode === "flat";
    showPanel($section.get(), false);
  });

  $sceneReady.subscribe((ready) => {
    if (ready) root.dataset.ready = "";
  });

  watchWebGLFallback(qs("[data-fallback-note]"));

  // ---- Tell the camera how much of the canvas the bottom sheet covers -----------------------------
  function measureInset() {
    viewInset.bottom = sheet.matches && !isFlat() ? Math.max(0, innerHeight - stage.getBoundingClientRect().top) : 0;
  }
  new ResizeObserver(measureInset).observe(stage);
  addEventListener("resize", measureInset);
  measureInset();
}

function renderNav(list: HTMLElement): Map<SectionId, HTMLAnchorElement> {
  const links = new Map<SectionId, HTMLAnchorElement>();
  SECTIONS.forEach((s, i) => {
    const a = h(
      "a",
      {
        class: "sections__link",
        href: hashForSection(s.id),
        "aria-keyshortcuts": String(i + 1),
        style: `--accent: ${s.palette[0]}; --accent-2: ${s.palette[1]}`,
        "data-pattern": s.pattern,
      },
      h("span", { class: "sections__swatch", "aria-hidden": "true" }),
      h("span", { class: "sections__label" }, s.label),
    );
    links.set(s.id, a);
    list.append(h("li", {}, a));
  });
  return links;
}

function installPreferences(): void {
  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const storedMotion = readPref("reduced-motion");
  $reducedMotion.set(storedMotion === null ? motionQuery.matches : storedMotion === "1");
  motionQuery.addEventListener("change", () => {
    if (readPref("reduced-motion") === null) $reducedMotion.set(motionQuery.matches);
  });
  if (readPref("mode") === "flat") $mode.set("flat");

  const motionBtn = qs<HTMLButtonElement>('[data-toggle="motion"]');
  const flatBtn = qs<HTMLButtonElement>('[data-toggle="flat"]');

  $reducedMotion.subscribe((reduced) => {
    root.dataset.motion = reduced ? "reduce" : "full";
    motionBtn.setAttribute("aria-pressed", String(reduced));
  });
  $mode.subscribe((mode) => flatBtn.setAttribute("aria-pressed", String(mode === "flat")));

  motionBtn.addEventListener("click", () => {
    const next = !$reducedMotion.get();
    $reducedMotion.set(next);
    writePref("reduced-motion", next ? "1" : "0");
  });
  flatBtn.addEventListener("click", () => {
    const next = $mode.get() === "flat" ? "3d" : "flat";
    $mode.set(next);
    writePref("mode", next);
  });
}

/** main.ts flags `html[data-webgl]` after initUI() when the 3D yard can't run: switch to flat for good. */
function watchWebGLFallback(note: HTMLElement): void {
  const apply = () => {
    const state = root.dataset.webgl;
    if (state !== "none" && state !== "error") return;
    $mode.set("flat");
    qs('[data-toggle="flat"]').hidden = true;
    note.textContent =
      state === "none"
        ? "This browser can't draw the 3D yard, so here is the quiet version."
        : "The 3D yard didn't load this time, so here is the quiet version.";
    note.hidden = false;
    observer.disconnect();
  };
  const observer = new MutationObserver(apply);
  observer.observe(root, { attributes: true, attributeFilter: ["data-webgl"] });
  apply();
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)
  );
}
