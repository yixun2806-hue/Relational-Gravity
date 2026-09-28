import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { prisma } from "../db.js";
import { AppError, ErrorCodes } from "../utils/errors.js";

export interface AuthUser {
  id: string;
  loginKey: string;
  accessRole: "buyer" | "guest";
  accessCodeId: string | null;
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser;
  }
}

export async function authGuard(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AppError(ErrorCodes.UNAUTHORIZED, "未登录或 token 失效", 401);
  }
  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = jwt.verify(token, request.server.config.JWT_SECRET) as { sub: string };
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new Error("missing user");
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });
    request.user = {
      id: user.id,
      loginKey: user.loginKey,
      accessRole: user.accessRole,
      accessCodeId: user.accessCodeId,
    };
  } catch {
    throw new AppError(ErrorCodes.UNAUTHORIZED, "未登录或 token 失效", 401);
  }
}
