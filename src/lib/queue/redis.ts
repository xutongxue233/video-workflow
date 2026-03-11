import type { ConnectionOptions } from "bullmq";

export function getBullMQConnectionOptions(): ConnectionOptions {
  const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  const parsed = new URL(redisUrl);

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname && parsed.pathname !== "/" ? Number(parsed.pathname.slice(1)) : 0,
    maxRetriesPerRequest: null,
  };
}
