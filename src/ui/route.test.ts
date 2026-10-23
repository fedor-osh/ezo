import { describe, expect, it } from "vitest";
import { hashForSection, sectionFromDigit, sectionFromHash } from "./route.ts";
import { SECTION_IDS } from "../shared/protocol.ts";

describe("hash ↔ section", () => {
  it("empty hash is home", () => {
    expect(sectionFromHash("")).toBe("home");
    expect(sectionFromHash("#")).toBe("home");
  });

  it("parses known sections, tolerating case and a leading slash", () => {
    expect(sectionFromHash("#work")).toBe("work");
    expect(sectionFromHash("#Contact")).toBe("contact");
    expect(sectionFromHash("#/about")).toBe("about");
  });

  it("ignores unknown fragments such as the skip link target", () => {
    expect(sectionFromHash("#main")).toBeNull();
    expect(sectionFromHash("#work-title")).toBeNull();
  });

  it("round-trips every section", () => {
    for (const id of SECTION_IDS) expect(sectionFromHash(hashForSection(id))).toBe(id);
  });

  it("maps digit keys to sections in nav order", () => {
    expect(sectionFromDigit("1")).toBe("home");
    expect(sectionFromDigit("5")).toBe("contact");
    expect(sectionFromDigit("6")).toBeNull();
    expect(sectionFromDigit("0")).toBeNull();
    expect(sectionFromDigit("a")).toBeNull();
  });
});
