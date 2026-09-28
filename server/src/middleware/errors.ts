import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError, ErrorCodes } from "../utils/errors.js";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, _request, reply: FastifyReply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
        data: null,
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        code: ErrorCodes.BAD_REQUEST,
        message: error.issues[0]?.message ?? "参数错误",
        data: null,
      });
    }

    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status === 429) {
      return reply.status(429).send({
        code: ErrorCodes.RATE_LIMIT,
        message: "请求过于频繁",
        data: null,
      });
    }
    if (status >= 400 && status < 500) {
      return reply.status(status).send({
        code: ErrorCodes.BAD_REQUEST,
        message: "参数错误",
        data: null,
      });
    }

    requestLog(error);
    return reply.status(500).send({
      code: ErrorCodes.INTERNAL,
      message: "服务暂时不可用",
      data: null,
    });
  });
}

function requestLog(error: unknown) {
  console.error(error);
}

export function ok<T>(reply: FastifyReply, data: T, status = 200) {
  return reply.status(status).send({ code: 0, message: "success", data });
}

export function getIp(request: FastifyRequest): string {
  return request.ip || "0.0.0.0";
}
