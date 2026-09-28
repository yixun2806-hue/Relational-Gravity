import { Redis } from "ioredis";
import type { AppConfig } from "./config.js";

export function createRedis(config: AppConfig): Redis {
  return new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
  });
}

export async function safeConnect(redis: Redis): Promise<boolean> {
  try {
    await redis.connect();
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}
