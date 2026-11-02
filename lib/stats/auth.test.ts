import { afterEach, describe, expect, it, vi } from "vitest";

import { statsAccess } from "./auth";

const basic = (user: string, password: string) => `Basic ${btoa(`${user}:${password}`)}`;

describe("statsAccess", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("hides the page when no password is set", () => {
    vi.stubEnv("STATS_PASSWORD", "");
    expect(statsAccess(basic("me", "anything"))).toBe("off");
  });

  it("asks for the password until the right one comes, whatever the user name", () => {
    vi.stubEnv("STATS_PASSWORD", "s3cret:with-colon");
    expect(statsAccess(null)).toBe("ask");
    expect(statsAccess("Bearer s3cret")).toBe("ask");
    expect(statsAccess("Basic !!!not-base64")).toBe("ask");
    expect(statsAccess(basic("me", "wrong"))).toBe("ask");
    expect(statsAccess(basic("me", "s3cret:with-colon"))).toBe("ok");
    expect(statsAccess(basic("", "s3cret:with-colon"))).toBe("ok");
  });
});
