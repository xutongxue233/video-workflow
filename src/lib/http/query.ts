export function parseLimit(
  raw: string | null,
  fallback: number,
  options?: {
    min?: number;
    max?: number;
  },
): number {
  const min = options?.min ?? 1;
  const max = options?.max ?? 200;
  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.floor(parsed)));
}
