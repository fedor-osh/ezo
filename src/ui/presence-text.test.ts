import { describe, expect, it } from "vitest";
import { announceDelay, othersSentence } from "./presence-text.ts";

describe("presence announcements", () => {
  it("says nothing when nothing changed or when alone from the start", () => {
    expect(othersSentence(2, 2)).toBeNull();
    expect(othersSentence(0, null)).toBeNull();
  });

  it("uses kind, correctly pluralised sentences", () => {
    expect(othersSentence(1, null)).toBe("1 other visitor is in the yard.");
    expect(othersSentence(3, 1)).toBe("3 other visitors are in the yard.");
    expect(othersSentence(0, 2)).toBe("The yard is quiet now, it's just you.");
  });

  it("throttles to one announcement per gap", () => {
    expect(announceDelay(1000, null, 30_000)).toBe(0);
    expect(announceDelay(11_000, 1000, 30_000)).toBe(20_000);
    expect(announceDelay(40_000, 1000, 30_000)).toBe(0);
  });
});
