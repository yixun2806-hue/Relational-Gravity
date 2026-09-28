import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authGuard } from "../middleware/auth.js";
import { ok } from "../middleware/errors.js";
import { getFullReportOffer, redeemFullReport } from "../services/product-service.js";

export async function productRoutes(app: FastifyInstance) {
  app.get("/api/products/full-report", { preHandler: authGuard }, async (_request, reply) => {
    return ok(reply, getFullReportOffer(app.config));
  });

  app.post("/api/tests/:id/redeem", {
    preHandler: authGuard,
    config: { rateLimit: { max: 8, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({ code: z.string() }).parse(request.body);
    return ok(reply, await redeemFullReport(id, request.user.id, body.code));
  });
}
