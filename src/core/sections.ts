import type { SectionId } from "../shared/protocol.ts";
import type { V3 } from "./layout.ts";

export interface Shot {
  position: V3;
  target: V3;
  fov: number;
  /**
   * Distance from the camera to the invisible plane the pointer creatures fly in
   * when the cursor is not over anything interactive.
   */
  pointerDepth: number;
}

export interface Section {
  id: SectionId;
  /** Word painted on the cloth button and used as the nav label. */
  label: string;
  /** Cloth colours: [base, accent]. */
  palette: [string, string];
  /** Cloth print. */
  pattern: "stripes" | "dots" | "checks" | "flowers" | "plain";
  shot: Shot;
}

// Shots are framed so the main clothesline stays in view wherever possible:
// the cloth buttons are the navigation.
export const SECTIONS: Section[] = [
  {
    id: "home",
    label: "Hello",
    palette: ["#ffd23f", "#ee4266"],
    pattern: "stripes",
    shot: { position: [-0.5, 5.6, 14.2], target: [-1.4, 2.3, -2], fov: 50, pointerDepth: 11 },
  },
  {
    id: "work",
    label: "Work",
    palette: ["#3bceac", "#0e7c7b"],
    pattern: "checks",
    // Close plan on the supra table, the yard alive behind it.
    shot: { position: [-3.8, 1.5, 3.7], target: [-3.95, 0.72, 0.4], fov: 40, pointerDepth: 2.8 },
  },
  {
    id: "about",
    label: "About",
    palette: ["#ff8fab", "#fb6f92"],
    pattern: "flowers",
    shot: { position: [3.5, 1.6, -1.1], target: [5.6, 0.95, -6.4], fov: 46, pointerDepth: 3.6 },
  },
  {
    id: "stack",
    label: "Stack",
    palette: ["#9b5de5", "#f15bb5"],
    pattern: "dots",
    // Looking up at the colourful shushabandi windows of the back house.
    shot: { position: [2.2, 1.5, 1.4], target: [-0.9, 5.3, -8], fov: 55, pointerDepth: 4.2 },
  },
  {
    id: "contact",
    label: "Contact",
    palette: ["#4cc9f0", "#4361ee"],
    pattern: "plain",
    shot: { position: [0.6, 1.55, 5.6], target: [6.0, 1.2, 2.4], fov: 46, pointerDepth: 3.4 },
  },
];

export const sectionById = (id: SectionId): Section => SECTIONS.find((s) => s.id === id) ?? SECTIONS[0];
