import { isIP } from "node:net";

type AssertSafeFetchUrlInput = {
  rawUrl: string;
  allowDataUrl?: boolean;
  allowedHosts?: string[];
};

const DEFAULT_BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "0.0.0.0",
  "::",
  "::1",
]);

function normalizeHost(hostname: string): string {
  return hostname.trim().toLowerCase();
}

function isPrivateIpv4(host: string): boolean {
  const segments = host.split(".").map((item) => Number(item));
  if (segments.length !== 4 || segments.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) {
    return true;
  }

  const [a, b] = segments;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 0) return true;

  return false;
}

function isPrivateIpv6(host: string): boolean {
  const normalized = host.toLowerCase();
  if (normalized === "::1" || normalized === "::") {
    return true;
  }
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  if (normalized.startsWith("fe80")) {
    return true;
  }

  return false;
}

function getEnvAllowlist(): Set<string> {
  const raw = process.env.OUTBOUND_FETCH_ALLOWLIST?.trim() ?? "";
  if (!raw) {
    return new Set();
  }

  return new Set(
    raw
      .split(",")
      .map((item) => normalizeHost(item))
      .filter((item) => item.length > 0),
  );
}

function assertAllowedHost(hostname: string, allowedHosts?: string[]) {
  const normalizedHost = normalizeHost(hostname);
  const envAllowlist = getEnvAllowlist();
  const runtimeAllowlist = new Set((allowedHosts ?? []).map((item) => normalizeHost(item)));

  if (runtimeAllowlist.size > 0 && !runtimeAllowlist.has(normalizedHost)) {
    throw new Error(`blocked outbound host: ${normalizedHost}`);
  }

  if (envAllowlist.size > 0 && !envAllowlist.has(normalizedHost)) {
    throw new Error(`blocked outbound host: ${normalizedHost}`);
  }
}

function assertHostIsPublic(hostname: string) {
  const normalizedHost = normalizeHost(hostname);
  if (DEFAULT_BLOCKED_HOSTS.has(normalizedHost)) {
    throw new Error(`blocked outbound host: ${normalizedHost}`);
  }

  const ipVersion = isIP(normalizedHost);
  if (ipVersion === 4 && isPrivateIpv4(normalizedHost)) {
    throw new Error(`blocked private IPv4 address: ${normalizedHost}`);
  }

  if (ipVersion === 6 && isPrivateIpv6(normalizedHost)) {
    throw new Error(`blocked private IPv6 address: ${normalizedHost}`);
  }
}

export function assertSafeFetchUrl(input: AssertSafeFetchUrlInput): URL {
  const rawUrl = input.rawUrl.trim();
  if (!rawUrl) {
    throw new Error("fetch url is required");
  }

  if (/^data:/i.test(rawUrl)) {
    if (input.allowDataUrl) {
      return new URL(rawUrl);
    }

    throw new Error("data URL is not allowed");
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`invalid fetch url: ${rawUrl}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`unsupported fetch url protocol: ${parsed.protocol}`);
  }

  if (parsed.username || parsed.password) {
    throw new Error("credentialed URL is not allowed");
  }

  assertHostIsPublic(parsed.hostname);
  assertAllowedHost(parsed.hostname, input.allowedHosts);
  return parsed;
}
