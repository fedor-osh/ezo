import { describe, expect, it } from "vitest";
import { MAX_MESSAGE_BYTES, parseClientMessage, sameState } from "./validate.ts";

const state = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ type: "state", p: [1, 2, 3], perch: null, section: "home", ...extra });

describe("parseClientMessage", () => {
  it("accepts hello with and without resumeId", () => {
    expect(parseClientMessage('{"type":"hello"}')).toEqual({ type: "hello" });
    expect(parseClientMessage('{"type":"hello","resumeId":"abc_DEF-1"}')).toEqual({ type: "hello", resumeId: "abc_DEF-1" });
  });

  it("ignores a malformed resumeId instead of rejecting hello", () => {
    expect(parseClientMessage('{"type":"hello","resumeId":"../../etc"}')).toEqual({ type: "hello" });
    expect(parseClientMessage('{"type":"hello","resumeId":42}')).toEqual({ type: "hello" });
  });

  it("accepts a well-formed state and strips unknown fields", () => {
    expect(parseClientMessage(state({ evil: true }))).toEqual({ type: "state", p: [1, 2, 3], perch: null, section: "home" });
  });

  it("clamps positions to the world box and rounds them", () => {
    const msg = parseClientMessage(state({ p: [1e9, -500, 0.123456] }));
    expect(msg).toMatchObject({ p: [30, -30, 0.123] });
  });

  it("rejects non-finite or malformed positions", () => {
    expect(parseClientMessage(state({ p: [1, 2] }))).toBeNull();
    expect(parseClientMessage(state({ p: [1, 2, "3"] }))).toBeNull();
    expect(parseClientMessage(state({ p: [1, 2, null] }))).toBeNull();
    expect(parseClientMessage('{"type":"state","p":[1,2,1e999],"perch":null,"section":"home"}')).toBeNull();
    expect(parseClientMessage(state({ p: { 0: 1, 1: 2, 2: 3 } }))).toBeNull();
  });

  it("validates the section", () => {
    expect(parseClientMessage(state({ section: "work" }))).toMatchObject({ section: "work" });
    expect(parseClientMessage(state({ section: "admin" }))).toBeNull();
    expect(parseClientMessage(state({ section: undefined }))).toBeNull();
  });

  it("validates perches", () => {
    expect(parseClientMessage(state({ perch: { surfaceId: "cloth:work", u: 0.5, v: 1 } }))).toMatchObject({
      perch: { surfaceId: "cloth:work", u: 0.5, v: 1 },
    });
    expect(parseClientMessage(state({ perch: { surfaceId: "cloth", u: 1.5, v: 0 } }))).toBeNull();
    expect(parseClientMessage(state({ perch: { surfaceId: "cloth", u: -0.1, v: 0 } }))).toBeNull();
    expect(parseClientMessage(state({ perch: { surfaceId: "x".repeat(100), u: 0, v: 0 } }))).toBeNull();
    expect(parseClientMessage(state({ perch: { surfaceId: "<script>", u: 0, v: 0 } }))).toBeNull();
    expect(parseClientMessage(state({ perch: "cloth" }))).toBeNull();
  });

  it("rejects junk, unknown types and oversized frames", () => {
    expect(parseClientMessage("not json")).toBeNull();
    expect(parseClientMessage("[]")).toBeNull();
    expect(parseClientMessage("null")).toBeNull();
    expect(parseClientMessage('{"type":"welcome"}')).toBeNull();
    expect(parseClientMessage(state({ pad: "x".repeat(MAX_MESSAGE_BYTES) }))).toBeNull();
  });
});

describe("sameState", () => {
  const a = { p: [1, 2, 3] as [number, number, number], perch: null, section: "home" as const };
  it("compares position, perch and section", () => {
    expect(sameState(null, a)).toBe(false);
    expect(sameState(a, { ...a })).toBe(true);
    expect(sameState(a, { ...a, p: [1, 2, 3.001] })).toBe(false);
    expect(sameState(a, { ...a, section: "work" })).toBe(false);
    expect(sameState(a, { ...a, perch: { surfaceId: "c", u: 0, v: 0 } })).toBe(false);
  });
});
