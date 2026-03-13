import { describe, expect, it, vi } from "vitest";

import { assertSafeFetchUrl } from "./url-guard";

describe("assertSafeFetchUrl", () => {
  it("accepts public HTTPS URLs", () => {
    const parsed = assertSafeFetchUrl({
      rawUrl: "https://cdn.example.com/video.mp4",
    });

    expect(parsed.hostname).toBe("cdn.example.com");
  });

  it("rejects localhost and private IPs", () => {
    expect(() =>
      assertSafeFetchUrl({
        rawUrl: "http://localhost/internal",
      }),
    ).toThrow("blocked outbound host");

    expect(() =>
      assertSafeFetchUrl({
        rawUrl: "http://127.0.0.1/internal",
      }),
    ).toThrow("blocked private IPv4 address");

    expect(() =>
      assertSafeFetchUrl({
        rawUrl: "http://192.168.1.1/internal",
      }),
    ).toThrow("blocked private IPv4 address");
  });

  it("supports explicit host allowlist", () => {
    expect(() =>
      assertSafeFetchUrl({
        rawUrl: "https://assets.example.com/image.png",
        allowedHosts: ["assets.example.com"],
      }),
    ).not.toThrow();

    expect(() =>
      assertSafeFetchUrl({
        rawUrl: "https://cdn.example.com/image.png",
        allowedHosts: ["assets.example.com"],
      }),
    ).toThrow("blocked outbound host");
  });

  it("enforces env allowlist when configured", () => {
    vi.stubEnv("OUTBOUND_FETCH_ALLOWLIST", "assets.example.com");
    expect(() =>
      assertSafeFetchUrl({
        rawUrl: "https://assets.example.com/image.png",
      }),
    ).not.toThrow();
    expect(() =>
      assertSafeFetchUrl({
        rawUrl: "https://cdn.example.com/image.png",
      }),
    ).toThrow("blocked outbound host");
    vi.unstubAllEnvs();
  });
});
