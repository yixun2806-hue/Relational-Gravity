import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { Redis } from "ioredis";
import type { AppConfig } from "./config.js";
import { registerErrorHandler } from "./middleware/errors.js";
import { authRoutes } from "./routes/auth.js";
import { testRoutes } from "./routes/tests.js";
import { metaRoutes } from "./routes/meta.js";
import { adminRoutes } from "./routes/admin.js";
import { webRoutes } from "./routes/web.js";
import { adRoutes } from "./routes/ads.js";

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
    redis: Redis;
  }
}

export async function buildApp(config: AppConfig, redis: Redis): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  app.decorate("config", config);
  app.decorate("redis", redis);
  allowEmptyJsonBody(app);

  await app.register(helmet, { global: true, contentSecurityPolicy: false });
  await app.register(cors, {
    origin: config.NODE_ENV === "production" ? config.WEB_ORIGIN || false : true,
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    redis,
    skipOnError: true,
    allowList: (request) => request.url === "/api/health" || request.url === "/health",
  });

  registerErrorHandler(app);

  await app.register(authRoutes);
  await app.register(testRoutes);
  await app.register(metaRoutes);
  await app.register(adminRoutes);
  await app.register(webRoutes);
  if (config.P0_E2E === "true") {
    await app.register(adRoutes);
  }

  return app;
}

function allowEmptyJsonBody(app: FastifyInstance): void {
  const parseJson = app.getDefaultJsonParser("error", "error");
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (request, body, done) => {
      const text = typeof body === "string" ? body : body.toString();
      if (!text) {
        done(null, {});
        return;
      }
      parseJson(request, text, done);
    },
  );
}
