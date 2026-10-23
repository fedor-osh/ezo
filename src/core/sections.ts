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
    shot: { position: [0, 5.2, 14.5], target: [0, 2.2, -2], fov: 50, pointerDepth: 11 },
  },
  {
    id: "work",
    label: "Work",
    palette: ["#3bceac", "#0e7c7b"],
    pattern: "checks",
    // Close plan on the supra table, the yard alive behind it.
    shot: { position: [-1.0, 1.55, 3.0], target: [-3.0, 1.15, -1.6], fov: 46, pointerDepth: 3.2 },
  },
  {
    id: "about",
    label: "About",
    palette: ["#ff8fab", "#fb6f92"],
    pattern: "flowers",
    shot: { position: [2.4, 1.6, -1.6], target: [4.8, 1.0, -5.8], fov: 48, pointerDepth: 3.4 },
  },
  {
    id: "stack",
    label: "Stack",
    palette: ["#9b5de5", "#f15bb5"],
    pattern: "dots",
    // Looking up at the colourful shushabandi windows of the back house.
    shot: { position: [-1.5, 2.2, 1.5], target: [-0.5, 5.0, -8], fov: 52, pointerDepth: 5 },
  },
  {
    id: "contact",
    label: "Contact",
    palette: ["#4cc9f0", "#4361ee"],
    pattern: "plain",
    shot: { position: [3.2, 1.4, 7.6], target: [6.3, 0.8, 3.6], fov: 45, pointerDepth: 3.6 },
  },
];

export const sectionById = (id: SectionId): Section => SECTIONS.find((s) => s.id === id) ?? SECTIONS[0];
