import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loginAsWebGuest, loginWithAccessCode } from "../services/auth-service.js";
import { ok } from "../middleware/errors.js";
import { authGuard } from "../middleware/auth.js";
import { prisma } from "../db.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/web/auth/activate", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const body = z.object({ code: z.string() }).parse(request.body);
    return ok(reply, await loginWithAccessCode(app.config, body.code));
  });

  app.post("/api/web/auth/guest", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (_request, reply) => {
    return ok(reply, await loginAsWebGuest(app.config));
  });

  app.get("/api/me", { preHandler: authGuard }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.user.id } });
    return ok(reply, {
      id: user?.id,
      createdAt: user?.createdAt,
      accessRole: user?.accessRole,
    });
  });
}
