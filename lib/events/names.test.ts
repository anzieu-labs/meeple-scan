import { describe, expect, it } from "vitest";

import { cleanEvent } from "./names";

describe("cleanEvent", () => {
  it("keeps a visit's declared props, with their types", () => {
    expect(cleanEvent("visit", { path: "/fr", ref: "qr", device: "phone", installed: true })).toEqual({
      name: "visit",
      props: { path: "/fr", ref: "qr", device: "phone", installed: true },
    });
  });

  it("drops props an event doesn't declare, or of the wrong type or value", () => {
    expect(cleanEvent("visit", { path: "/", ip: "1.2.3.4", device: "tablet", installed: "yes" })).toEqual({
      name: "visit",
      props: { path: "/" },
    });
    expect(cleanEvent("photo", { source: "satellite" })).toEqual({ name: "photo", props: {} });
  });

  it("cuts long strings and skips empty ones", () => {
    const { props } = cleanEvent("visit", { path: "/" + "a".repeat(500), ref: "" })!;
    expect((props.path as string).length).toBe(100);
    expect(props).not.toHaveProperty("ref");
  });

  it("refuses unknown events, even inherited names", () => {
    expect(cleanEvent("hack", {})).toBeNull();
    expect(cleanEvent("toString", {})).toBeNull();
    expect(cleanEvent(42, {})).toBeNull();
  });
});
