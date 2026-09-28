import type { FastifyReply, FastifyRequest } from "fastify";
import { matchesAdminPassword } from "../services/admin-service.js";
import {
  ADMIN_SESSION_COOKIE,
  buildAdminSessionCookie,
  clearAdminSessionCookie,
  createAdminSession,
  destroyAdminSession,
  getAdminSession,
  parseCookieValue,
} from "../services/admin-session.js";

function cookieSecure(request: FastifyRequest) {
  return request.server.config.NODE_ENV === "production";
}

export function readAdminSessionId(request: FastifyRequest) {
  return parseCookieValue(request.headers.cookie, ADMIN_SESSION_COOKIE);
}

export function attachAdminSession(request: FastifyRequest, reply: FastifyReply, rememberMe = false) {
  const hours = request.server.config.ADMIN_SESSION_TTL_HOURS;
  const id = createAdminSession(hours * 60 * 60 * 1000);
  reply.header(
    "Set-Cookie",
    buildAdminSessionCookie(id, cookieSecure(request), rememberMe ? hours * 3600 : undefined),
  );
}

export function expireAdminSession(request: FastifyRequest, reply: FastifyReply) {
  destroyAdminSession(readAdminSessionId(request));
  reply.header("Set-Cookie", clearAdminSessionCookie(cookieSecure(request)));
}

export async function adminGuard(request: FastifyRequest, reply: FastifyReply) {
  const { ADMIN_PASSWORD } = request.server.config;
  if (!ADMIN_PASSWORD) {
    return reply.status(503).send({ code: 50301, message: "管理后台尚未配置密码", data: null });
  }
  if (!getAdminSession(readAdminSessionId(request))) {
    return reply.status(401).send({ code: 40101, message: "登录已过期，请重新登录", data: null });
  }
}

export function authenticateAdminLogin(
  username: string,
  password: string,
  expectedUsername: string,
  expectedPassword: string,
) {
  return matchesAdminPassword(username, password, expectedUsername, expectedPassword);
}
