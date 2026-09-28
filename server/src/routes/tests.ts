import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authGuard } from "../middleware/auth.js";
import { ok } from "../middleware/errors.js";
import {
  completeTest,
  createTest,
  getCardPayload,
  getPersonalResult,
  getRelationship,
  getTest,
  joinTest,
  listMine,
  publicQuestions,
  upsertAnswers,
} from "../services/test-service.js";
import { prisma } from "../db.js";
import { canCreateTest } from "../domain/access.js";
import { AppError, ErrorCodes } from "../utils/errors.js";

export async function testRoutes(app: FastifyInstance) {
  app.get("/api/questions", { preHandler: authGuard }, async (_request, reply) => {
    return ok(reply, { version: 1, questions: publicQuestions() });
  });

  app.post("/api/tests", { preHandler: authGuard }, async (request, reply) => {
    if (!canCreateTest(request.user.accessRole)) {
      throw new AppError(ErrorCodes.FORBIDDEN, "受邀者不能发起新测试，请先输入购买验证码", 403);
    }
    const created = await createTest(request.user.id, app.config.INVITE_EXPIRES_DAYS);
    await prisma.event.create({
      data: { userId: request.user.id, testId: created.id, eventName: "test_start" },
    });
    return ok(reply, created, 201);
  });

  app.post("/api/tests/join", { preHandler: authGuard }, async (request, reply) => {
    const body = z.object({
      inviteCode: z.string().regex(/^[A-Za-z0-9_-]{24}$/),
    }).parse(request.body);
    const joined = await joinTest(request.user.id, body.inviteCode);
    await prisma.event.create({
      data: { userId: request.user.id, testId: joined.id, eventName: "b_open" },
    });
    return ok(reply, joined);
  });

  app.get("/api/tests/mine", { preHandler: authGuard }, async (request, reply) => {
    return ok(reply, { tests: await listMine(request.user.id) });
  });

  app.get("/api/tests/:id", { preHandler: authGuard }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    return ok(reply, await getTest(id, request.user.id));
  });

  app.put("/api/tests/:id/answers", { preHandler: authGuard }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z
      .object({
        answers: z
          .array(
            z.object({
              questionId: z.string().min(1),
              optionKey: z.enum(["A", "B", "C", "D"]),
            }),
          )
          .min(1)
          .max(30),
      })
      .parse(request.body);
    return ok(reply, await upsertAnswers(id, request.user.id, body.answers));
  });

  app.post("/api/tests/:id/complete", { preHandler: authGuard }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await completeTest(id, request.user.id);
    await prisma.event.create({
      data: {
        userId: request.user.id,
        testId: id,
        eventName: result.role === "A" ? "test_complete" : "b_complete",
      },
    });
    return ok(reply, result);
  });

  app.get("/api/tests/:id/result", { preHandler: authGuard }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    return ok(reply, await getPersonalResult(id, request.user.id));
  });

  app.get("/api/tests/:id/relationship", { preHandler: authGuard }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = await getRelationship(id, request.user.id);
    await prisma.event.create({
      data: { userId: request.user.id, testId: id, eventName: "relationship_view" },
    });
    return ok(reply, data);
  });

  app.get("/api/tests/:id/card", { preHandler: authGuard }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    return ok(reply, await getCardPayload(id, request.user.id));
  });
}
