// Wording for the presence chip and the polite live announcements. Pure, unit tested.
import type { PointerKind } from "../shared/protocol.ts";

export const CREATURE: Record<PointerKind, { name: string; emoji: string }> = {
  butterfly: { name: "a butterfly", emoji: "🦋" },
  leaf: { name: "a leaf", emoji: "🍃" },
};

/** Sentence for screen readers about the *other* visitors. Null when there is nothing worth saying. */
export function othersSentence(others: number, previous: number | null): string | null {
  if (others === previous) return null;
  if (others <= 0) return previous === null ? null : "The yard is quiet now, it's just you.";
  return others === 1 ? "1 other visitor is in the yard." : `${others} other visitors are in the yard.`;
}

export const formatCount = (n: number): string => new Intl.NumberFormat("en").format(n);

/** Throttle gate: announce only on change, at most once per `minGapMs`. Returns ms to wait (0 = now). */
export function announceDelay(now: number, lastAt: number | null, minGapMs: number): number {
  if (lastAt === null) return 0;
  return Math.max(0, lastAt + minGapMs - now);
}
