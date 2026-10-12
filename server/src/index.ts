import { loadConfig } from "./config.js";
import { prisma } from "./db.js";
import { buildApp } from "./app.js";
import { createRedis, safeConnect } from "./redis.js";
import { purgeDeletedAgents, releaseUnassignedAccessCodes } from "./services/admin-service.js";

async function main() {
  const config = loadConfig();
  const redis = createRedis(config);
  const redisOk = await safeConnect(redis);
  if (!redisOk) {
    console.warn("Redis unavailable, rate limit will skip on error");
  }

  const app = await buildApp(config, redis);
  await prisma.$connect();
  const purged = await purgeDeletedAgents();
  if (purged.agents > 0 || purged.codes > 0) {
    console.log(`removed ${purged.agents} deleted agents and released ${purged.codes} access codes`);
  }
  const released = await releaseUnassignedAccessCodes();
  if (released > 0) console.log(`released ${released} unassigned access codes back to the pool`);
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  // Admin UI: http://127.0.0.1:${config.PORT}/admin

}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
