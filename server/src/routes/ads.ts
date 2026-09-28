import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authGuard } from "../middleware/auth.js";
import { ok } from "../middleware/errors.js";
import { prisma } from "../db.js";
import { createAdSession, unlockFullResult } from "../services/unlock-service.js";
import { AppError, ErrorCodes } from "../utils/errors.js";

export async function adRoutes(app: FastifyInstance) {
  app.post("/api/ads/session", {
    preHandler: authGuard,
    config: { rateLimit: { max: 8, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const body = z.object({ testId: z.string().uuid() }).parse(request.body);
    try {
      const session = await createAdSession(app.config, app.redis, body.testId, request.user.id);
      await prisma.event.create({
        data: {
          userId: request.user.id,
          testId: body.testId,
          eventName: "ad_request",
        },
      });
      return ok(reply, session);
    } catch (error) {
      if (error instanceof AppError && error.code === ErrorCodes.ALREADY_UNLOCKED) {
        const { getRelationship } = await import("../services/test-service.js");
        return ok(reply, {
          alreadyUnlocked: true,
          relationship: await getRelationship(body.testId, request.user.id),
        });
      }
      throw error;
    }
  });

  app.post("/api/ads/events", { preHandler: authGuard }, async (request, reply) => {
    const body = z
      .object({
        testId: z.string().uuid().optional(),
        eventName: z.enum([
          "ad_request",
          "ad_loaded",
          "ad_clicked",
          "ad_completed",
          "ad_closed",
          "ad_failed",
          "unlock_success",
          "unlock_failed",
        ]),
        properties: z.record(z.unknown()).optional(),
      })
      .parse(request.body);
    await prisma.event.create({
      data: {
        userId: request.user.id,
        testId: body.testId,
        eventName: body.eventName,
        properties: (body.properties ?? undefined) as object | undefined,
      },
    });
    return ok(reply, { recorded: true });
  });

  app.post("/api/tests/:id/unlock", {
    preHandler: authGuard,
    config: { rateLimit: { max: 12, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z
      .object({
        nonce: z.string().min(8),
        unlockType: z.literal("FULL_RESULT").default("FULL_RESULT"),
      })
      .parse(request.body);
    const data = await unlockFullResult(app.config, app.redis, id, request.user.id, body.nonce);
    await prisma.event.create({
      data: { userId: request.user.id, testId: id, eventName: "unlock_success" },
    });
    return ok(reply, data);
  });
}
