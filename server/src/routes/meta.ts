import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authGuard } from "../middleware/auth.js";
import { ok } from "../middleware/errors.js";
import { prisma } from "../db.js";

export async function metaRoutes(app: FastifyInstance) {
  app.post("/api/share", { preHandler: authGuard }, async (request, reply) => {
    const body = z
      .object({
        testId: z.string().uuid().optional(),
        shareType: z.enum([
          "invite_message",
          "invite_timeline",
          "result_card",
          "unlock_nudge",
          "save_image",
        ]),
      })
      .parse(request.body);
    await prisma.shareRecord.create({
      data: {
        userId: request.user.id,
        testId: body.testId,
        shareType: body.shareType,
      },
    });
    return ok(reply, { recorded: true });
  });

  app.post("/api/events", { preHandler: authGuard }, async (request, reply) => {
    const body = z
      .object({
        events: z
          .array(
            z.object({
              eventName: z.string().min(1).max(64),
              testId: z.string().uuid().optional(),
              properties: z.record(z.unknown()).optional(),
            }),
          )
          .min(1)
          .max(20),
      })
      .parse(request.body);
    await prisma.event.createMany({
      data: body.events.map((item) => ({
        userId: request.user.id,
        testId: item.testId,
        eventName: item.eventName,
        properties: (item.properties ?? undefined) as object | undefined,
      })),
    });
    return ok(reply, { recorded: body.events.length });
  });

  app.get("/api/health", async (_request, reply) => {
    return ok(reply, { status: "ok", service: "relab-api" });
  });

  app.get("/health", async (_request, reply) => {
    return ok(reply, { status: "ok" });
  });
}
