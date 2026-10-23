// URL hash ↔ section. Pure, so it can be unit tested without a DOM.
import { SECTION_IDS, type SectionId } from "../shared/protocol.ts";

/** "#work" → "work". Empty hash means home; anything unknown returns null (e.g. "#main" from the skip link). */
export function sectionFromHash(hash: string): SectionId | null {
  const raw = decodeURIComponent(hash.replace(/^#\/?/, "")).trim().toLowerCase();
  if (raw === "") return "home";
  return (SECTION_IDS as readonly string[]).includes(raw) ? (raw as SectionId) : null;
}

export const hashForSection = (id: SectionId): string => `#${id}`;

/** Keys "1"…"5" pick a section by position. */
export function sectionFromDigit(key: string): SectionId | null {
  if (!/^[1-9]$/.test(key)) return null;
  return SECTION_IDS[Number(key) - 1] ?? null;
}
