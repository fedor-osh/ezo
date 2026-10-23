// Who a visitor is: a pointer kind, a cheerful colour and a whimsical name of Georgian yard things.
import { randomBytes } from "node:crypto";
import type { Identity, PointerKind } from "../src/shared/protocol.ts";

export type Rng = () => number;

const ADJECTIVES = [
  "Sleepy", "Brave", "Golden", "Tiny", "Sunny", "Jolly", "Fuzzy", "Lazy", "Merry", "Shy",
  "Sparkly", "Dizzy", "Happy", "Cozy", "Breezy", "Crispy", "Humble", "Sneaky", "Velvet", "Spicy",
  "Sweet", "Wobbly", "Rosy", "Lucky", "Curious", "Giggly", "Mellow", "Peppy", "Dreamy", "Toasty",
];

const NOUNS = [
  "Churchkhela", "Khinkali", "Puri", "Tklapi", "Khachapuri", "Badrijani", "Pkhali", "Lobiani",
  "Kvevri", "Tarragon", "Matsoni", "Gozinaki", "Pelamushi", "Mchadi", "Jonjoli", "Sulguni",
  "Tamada", "Nardi", "Fig", "Grapevine", "Clothespin", "Shushabandi", "Zhiguli", "Tone",
];

/** Bright, warm colours that read well on cream plaster and terracotta. */
export const PALETTE = [
  "#ff6f91", "#ff9671", "#ffc75f", "#f9f871", "#7bd389", "#3bceac", "#4cc9f0", "#4895ef",
  "#9b5de5", "#f15bb5", "#ee4266", "#ffd23f", "#00bbf9", "#fb8500", "#c77dff", "#06d6a0",
];

/** Share of visitors who get a butterfly; the rest drift as leaves. */
export const BUTTERFLY_SHARE = 0.75;

const pick = <T>(list: readonly T[], rng: Rng): T => list[Math.floor(rng() * list.length) % list.length];

export function newId(): string {
  return randomBytes(9).toString("base64url");
}

export function createIdentity(id: string = newId(), rng: Rng = Math.random): Identity {
  const kind: PointerKind = rng() < BUTTERFLY_SHARE ? "butterfly" : "leaf";
  return {
    id,
    kind,
    color: pick(PALETTE, rng),
    name: `${pick(ADJECTIVES, rng)} ${pick(NOUNS, rng)}`,
  };
}
