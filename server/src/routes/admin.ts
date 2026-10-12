import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  adminGuard,
  attachAdminSession,
  authenticateAdminLogin,
  expireAdminSession,
  readAdminSessionId,
} from "../middleware/admin-auth.js";
import { getAdminSession } from "../services/admin-session.js";
import { ok } from "../middleware/errors.js";
import {
  createAgent,
  deleteAgent,
  generateAccessCodes,
  getAdminOverview,
  getAdminRelationshipDistribution,
  getAdminRuntime,
  getAdminSettings,
  getAgent,
  listAccessCodes,
  listAgents,
  listCodesForExport,
  setAccessCodeActive,
  setCodePriceFen,
  setLowStockThreshold,
  updateAgent,
} from "../services/admin-service.js";

const adminPage = join(process.cwd(), "admin/index.html");
const agentFilter = z.string().uuid().optional();

export async function adminRoutes(app: FastifyInstance) {
  const renderAdmin = async (_request: unknown, reply: import("fastify").FastifyReply) => {
    const html = await readFile(adminPage, "utf8");
    return reply.type("text/html; charset=utf-8").send(html);
  };
  app.get("/admin", renderAdmin);
  app.get("/admin/", renderAdmin);

  app.post("/api/admin/login", async (request, reply) => {
    const { ADMIN_USERNAME, ADMIN_PASSWORD } = request.server.config;
    if (!ADMIN_PASSWORD) {
      return reply.status(503).send({ code: 50301, message: "管理后台尚未配置密码", data: null });
    }
    const body = z.object({
      username: z.string(),
      password: z.string(),
      rememberMe: z.boolean().optional(),
    }).parse(request.body);
    if (!authenticateAdminLogin(body.username, body.password, ADMIN_USERNAME, ADMIN_PASSWORD)) {
      return reply.status(401).send({ code: 40101, message: "账号或密码错误", data: null });
    }
    attachAdminSession(request, reply, body.rememberMe === true);
    return ok(reply, { authenticated: true, username: ADMIN_USERNAME });
  });

  app.get("/api/admin/session", async (request, reply) => {
    const { ADMIN_USERNAME, ADMIN_PASSWORD } = request.server.config;
    if (!ADMIN_PASSWORD) {
      return reply.status(503).send({ code: 50301, message: "管理后台尚未配置密码", data: null });
    }
    if (!getAdminSession(readAdminSessionId(request))) {
      return reply.status(401).send({ code: 40101, message: "登录已过期，请重新登录", data: null });
    }
    return ok(reply, { authenticated: true, username: ADMIN_USERNAME });
  });

  app.post("/api/admin/logout", async (request, reply) => {
    expireAdminSession(request, reply);
    return ok(reply, { authenticated: false });
  });

  app.get("/api/admin/overview", { preHandler: adminGuard }, async (request, reply) => {
    const query = z.object({ days: z.coerce.number().optional() }).parse(request.query);
    return ok(reply, await getAdminOverview(query.days));
  });

  app.get("/api/admin/relationship-distribution", { preHandler: adminGuard }, async (request, reply) => {
    const query = z.object({
      days: z.coerce.number().int().min(1).max(365).optional(),
    }).parse(request.query);
    return ok(reply, await getAdminRelationshipDistribution(query.days));
  });

  app.get("/api/admin/settings", { preHandler: adminGuard }, async (_request, reply) => {
    return ok(reply, await getAdminSettings());
  });

  app.put("/api/admin/settings/agent-low-stock-threshold", { preHandler: adminGuard }, async (request, reply) => {
    const body = z.object({ threshold: z.number() }).parse(request.body);
    return ok(reply, await setLowStockThreshold(body.threshold));
  });

  app.put("/api/admin/settings/code-price", { preHandler: adminGuard }, async (request, reply) => {
    const body = z.object({ priceFen: z.number() }).parse(request.body);
    return ok(reply, await setCodePriceFen(body.priceFen));
  });

  app.get("/api/admin/runtime", { preHandler: adminGuard }, async (request, reply) => {
    return ok(reply, await getAdminRuntime(request.server.config));
  });

  app.get("/api/admin/agents", { preHandler: adminGuard }, async (_request, reply) => {
    return ok(reply, { items: await listAgents() });
  });

  app.post("/api/admin/agents", { preHandler: adminGuard }, async (request, reply) => {
    const body = z.object({ name: z.string() }).parse(request.body);
    return ok(reply, await createAgent(body.name), 201);
  });

  app.get("/api/admin/agents/:id", { preHandler: adminGuard }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    return ok(reply, await getAgent(id));
  });

  app.patch("/api/admin/agents/:id", { preHandler: adminGuard }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { name } = z.object({ name: z.string() }).parse(request.body);
    return ok(reply, await updateAgent(id, name));
  });

  app.delete("/api/admin/agents/:id", { preHandler: adminGuard }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    return ok(reply, await deleteAgent(id));
  });

  app.get("/api/admin/codes", { preHandler: adminGuard }, async (request, reply) => {
    const query = z.object({
      query: z.string().max(32).optional(),
      status: z.enum(["all", "active", "disabled"]).default("all"),
      usage: z.enum(["all", "unused", "used", "frequent"]).default("all"),
      sort: z.enum(["useCount", "createdAt"]).optional(),
      order: z.enum(["asc", "desc"]).optional(),
      agentId: agentFilter,
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(10).max(100).default(30),
    }).parse(request.query);
    return ok(reply, await listAccessCodes(query));
  });

  app.post("/api/admin/codes", { preHandler: adminGuard }, async (request, reply) => {
    const body = z.object({
      count: z.number().int().min(1).max(500),
      agentId: z.string().uuid(),
    }).parse(request.body);
    return ok(reply, { items: await generateAccessCodes(body) }, 201);
  });

  app.patch("/api/admin/codes/:id", { preHandler: adminGuard }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { isActive } = z.object({ isActive: z.boolean() }).parse(request.body);
    return ok(reply, await setAccessCodeActive(id, isActive));
  });

  app.get("/api/admin/codes.csv", { preHandler: adminGuard }, async (request, reply) => {
    const query = z.object({ agentId: agentFilter }).parse(request.query);
    const items = await listCodesForExport(query.agentId);
    const lines = [
      ["验证码", "代理人", "状态", "使用次数", "最后使用时间", "售价", "创建时间"],
      ...items.map((item) => [
        item.code,
        item.agent ? (item.agent.deletedAt ? `${item.agent.name}（已删除）` : item.agent.name) : "—",
        item.isActive ? "有效" : "已停用",
        item.useCount,
        item.lastUsedAt?.toISOString() || "",
        (item.priceFen / 100).toFixed(2),
        item.createdAt.toISOString(),
      ]),
    ];
    const csv = `\uFEFF${lines.map((row) => row.map(csvCell).join(",")).join("\n")}`;
    return reply
      .header("Content-Disposition", `attachment; filename="relationship-access-codes-${new Date().toISOString().slice(0, 10)}.csv"`)
      .type("text/csv; charset=utf-8")
      .send(csv);
  });
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
