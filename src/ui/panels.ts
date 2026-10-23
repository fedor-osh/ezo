// One small card per section. Content comes from src/content.ts; this file only decides the markup.
import { SECTIONS, type Section } from "../core/sections.ts";
import { ABOUT, PERSON, PROJECTS, SECTION_TITLES, STACK } from "../content.ts";
import type { SectionId } from "../shared/protocol.ts";
import { h, icon } from "./dom.ts";

const PIN = ["M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10Z", "M12 11.5a1.5 1.5 0 1 0 0-.01"];
const MAIL = ["M4 6h16v12H4z", "m4 7 8 6 8-6"];
const CODE = ["m8 8-4 4 4 4", "m16 8 4 4-4 4", "m13.5 5-3 14"];

const tags = (items: string[], label: string) =>
  h("ul", { class: "tags", "aria-label": label }, ...items.map((t) => h("li", {}, t)));

function body(id: SectionId): Node[] {
  switch (id) {
    case "home":
      return [
        h("h1", { id: "home-title", class: "panel__title", tabindex: -1 }, PERSON.name),
        h("p", { class: "kicker" }, PERSON.role),
        h("p", { class: "lede" }, PERSON.tagline),
        h("p", { class: "meta" }, icon(PIN), PERSON.location),
        // Pointer-only tip: screen readers already have the nav, and there are no cloths in flat mode.
        h("p", { class: "hint", "aria-hidden": "true" }, "Tip: the cloths on the line are buttons."),
      ];
    case "work":
      return [
        title(id),
        h(
          "ul",
          { class: "projects" },
          ...PROJECTS.map((p) =>
            h(
              "li",
              { class: "project" },
              h("h3", { class: "project__name" }, p.url ? h("a", { href: p.url }, p.name) : p.name),
              h("p", { class: "project__what" }, p.what),
              tags(p.stack, `${p.name} stack`),
            ),
          ),
        ),
      ];
    case "about":
      return [title(id), ...ABOUT.map((text) => h("p", {}, text))];
    case "stack":
      return [
        title(id),
        h(
          "div",
          { class: "stack" },
          ...STACK.map((g) => h("div", { class: "stack__group" }, h("h3", {}, g.group), tags(g.items, g.group))),
        ),
      ];
    case "contact":
      return [
        title(id),
        h("p", {}, "Say hi, I answer quickly."),
        h(
          "ul",
          { class: "contacts" },
          h("li", {}, h("a", { class: "contact", href: `mailto:${PERSON.email}` }, icon(MAIL), PERSON.email)),
          h(
            "li",
            {},
            h(
              "a",
              { class: "contact", href: PERSON.github },
              icon(CODE),
              h("span", {}, "GitHub ", h("span", { class: "contact__handle" }, `@${PERSON.githubHandle}`)),
            ),
          ),
        ),
      ];
  }
}

function title(id: SectionId) {
  return h("h2", { id: `${id}-title`, class: "panel__title", tabindex: -1 }, SECTION_TITLES[id]);
}

function panel(s: Section): HTMLElement {
  const el = h(
    "section",
    {
      id: s.id,
      class: "panel",
      "aria-labelledby": `${s.id}-title`,
      "data-pattern": s.pattern,
      style: `--accent: ${s.palette[0]}; --accent-2: ${s.palette[1]}`,
    },
    // A strip of the matching cloth: same palette and print as the button on the line.
    h("div", { class: "panel__swatch", "aria-hidden": "true" }),
    ...body(s.id),
  );
  return el;
}

export function renderPanels(root: HTMLElement): Map<SectionId, HTMLElement> {
  const panels = new Map<SectionId, HTMLElement>();
  for (const s of SECTIONS) {
    const el = panel(s);
    panels.set(s.id, el);
    root.append(el);
  }
  return panels;
}

export const headingOf = (panel: HTMLElement): HTMLElement | null => panel.querySelector<HTMLElement>(".panel__title");
