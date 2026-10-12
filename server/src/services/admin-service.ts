import { randomInt, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { RELATIONSHIP_BY_ID, RELATIONSHIP_TYPES } from "../content/relationships.js";
import { prisma } from "../db.js";
import { AppError, ErrorCodes } from "../utils/errors.js";

export const ACCESS_CODE_CAPACITY = 1_000_000;
export const FREQUENT_USE_THRESHOLD = 5;
export const DEFAULT_LOW_STOCK_THRESHOLD = 30;
export const LOW_STOCK_SETTING_KEY = "agent_low_stock_threshold";
export const CODE_PRICE_SETTING_KEY = "access_code_price_fen";
export const DEFAULT_CODE_PRICE_FEN = 990;
export const USAGE_CHART_DAYS = 14;
const GENERATE_RETRY_PER_CODE = 20;
export const AGENT_STOCK_WHERE = { isActive: true, useCount: 0 } as const;

export function remainingAccessCodes(used: number) {
  return Math.max(0, ACCESS_CODE_CAPACITY - used);
}

export function insufficientCapacityMessage(remaining: number) {
  return `验证码剩余数量不足，当前最多还能生成${remaining}个。`;
}

export function normalizeAgentName(name: string) {
  const value = name.trim();
  if (!value) throw new AppError(ErrorCodes.BAD_REQUEST, "请填写代理人姓名", 400);
  if (value.length > 32) throw new AppError(ErrorCodes.BAD_REQUEST, "代理人姓名不能超过 32 个字", 400);
  return value;
}

export function makeNumericAccessCode(random: () => number = () => randomInt(0, ACCESS_CODE_CAPACITY)) {
  return random().toString().padStart(6, "0");
}

export function allocateNumericAccessCodes(
  count: number,
  taken: Iterable<string> = [],
  random: () => number = () => randomInt(0, ACCESS_CODE_CAPACITY),
) {
  const used = new Set(taken);
  const codes: string[] = [];
  let attempts = 0;
  const limit = Math.max(count * GENERATE_RETRY_PER_CODE, 100);
  while (codes.length < count && attempts < limit) {
    attempts += 1;
    const code = makeNumericAccessCode(random);
    if (used.has(code)) continue;
    used.add(code);
    codes.push(code);
  }
  if (codes.length !== count) {
    throw new AppError(ErrorCodes.INTERNAL, "验证码生成失败，可用号码不足或冲突过多", 500);
  }
  return codes;
}

export function requireNumericAccessCode(value: string) {
  if (!/^\d{6}$/.test(value)) {
    throw new AppError(ErrorCodes.ACCESS_CODE_INVALID, "验证码必须是6位数字，且不能包含空格", 400);
  }
  return value;
}

export function parseLowStockThreshold(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 999_999) {
    throw new AppError(ErrorCodes.BAD_REQUEST, "预警阈值必须是 1 到 999999 的整数", 400);
  }
  return parsed;
}

export function isLowStock(unused: number, threshold: number) {
  return unused <= threshold;
}

export function agentDisplayName(name: string, deleted: boolean) {
  return deleted ? `${name}（已删除）` : name;
}

export function parseCodePriceFen(value: unknown) {
  const fen = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(fen) || fen < 1 || fen > 999_900) {
    throw new AppError(ErrorCodes.BAD_REQUEST, "单个验证码金额必须在 0.01 元到 9999 元之间", 400);
  }
  return fen;
}

export function recentDayKeys(days: number, now = new Date()) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now.getTime() - (days - 1 - index) * 86_400_000);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  });
}

export function fillDailyCounts(days: string[], rows: Array<{ day: string; codes: number }>) {
  const counts = new Map(rows.map((row) => [row.day, row.codes]));
  return days.map((day) => ({ day, codes: counts.get(day) ?? 0 }));
}

export function fillDailyMoney(
  days: string[],
  rows: Array<{ day: string; codes: number; fen: number }>,
) {
  const map = new Map(rows.map((row) => [row.day, row]));
  return days.map((day) => {
    const hit = map.get(day);
    return { day, codes: hit?.codes ?? 0, fen: hit?.fen ?? 0 };
  });
}

export function periodDeltaPercent(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function sqlDayKey(value: Date | string) {
  if (typeof value === "string") return value.slice(0, 10);
  const iso = value.toISOString();
  if (iso.endsWith("T00:00:00.000Z")) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function parseOverviewDays(value: unknown) {
  const days = typeof value === "number" ? value : Number(value);
  if (days === 7 || days === 30 || days === 90) return days;
  return 30;
}

export function parseRelationshipDays(value: unknown) {
  if (value === undefined || value === null || value === "") return 30;
  const days = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 365) return 30;
  return days;
}

export function relationshipSharePercent(count: number, total: number) {
  if (total <= 0 || count <= 0) return 0;
  return Math.round((count / total) * 10000) / 100;
}

export function parseBasicCredentials(header?: string) {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 1) return null;
    return { username: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
  } catch {
    return null;
  }
}

export function matchesAdminPassword(
  username: string,
  password: string,
  expectedUsername: string,
  expectedPassword: string,
) {
  if (!expectedPassword) return false;
  return safeEqual(username, expectedUsername) && safeEqual(password, expectedPassword);
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function getLowStockThreshold() {
  const row = await prisma.systemSetting.findUnique({ where: { key: LOW_STOCK_SETTING_KEY } });
  if (!row) return DEFAULT_LOW_STOCK_THRESHOLD;
  try {
    return parseLowStockThreshold(row.value);
  } catch {
    return DEFAULT_LOW_STOCK_THRESHOLD;
  }
}

export async function setLowStockThreshold(value: unknown) {
  const threshold = parseLowStockThreshold(value);
  await prisma.systemSetting.upsert({
    where: { key: LOW_STOCK_SETTING_KEY },
    update: { value: String(threshold) },
    create: { key: LOW_STOCK_SETTING_KEY, value: String(threshold) },
  });
  return { agentLowStockThreshold: threshold };
}

export async function getCodePriceFen() {
  const row = await prisma.systemSetting.findUnique({ where: { key: CODE_PRICE_SETTING_KEY } });
  if (!row) return DEFAULT_CODE_PRICE_FEN;
  try {
    return parseCodePriceFen(Number(row.value));
  } catch {
    return DEFAULT_CODE_PRICE_FEN;
  }
}

export async function setCodePriceFen(value: unknown) {
  const priceFen = parseCodePriceFen(value);
  await prisma.systemSetting.upsert({
    where: { key: CODE_PRICE_SETTING_KEY },
    update: { value: String(priceFen) },
    create: { key: CODE_PRICE_SETTING_KEY, value: String(priceFen) },
  });
  return { priceFen };
}

export async function getAdminSettings() {
  const [agentLowStockThreshold, priceFen] = await Promise.all([getLowStockThreshold(), getCodePriceFen()]);
  return { agentLowStockThreshold, priceFen };
}

type AgentStatRow = {
  agentId: string | null;
  _count: { _all: number };
  _sum: { useCount: number | null };
  _max: { createdAt: Date | null };
};

function indexStats(rows: AgentStatRow[]) {
  return new Map(rows.filter((row) => row.agentId).map((row) => [row.agentId as string, row]));
}

export async function purgeDeletedAgents() {
  const deleted = await prisma.agent.findMany({
    where: { deletedAt: { not: null } },
    select: { id: true },
  });
  if (!deleted.length) return { agents: 0, codes: 0 };
  const ids = deleted.map((item) => item.id);
  const removed = await prisma.reportAccessCode.deleteMany({ where: { agentId: { in: ids } } });
  const agents = await prisma.agent.deleteMany({ where: { id: { in: ids } } });
  return { agents: agents.count, codes: removed.count };
}

export async function listAgents() {
  await purgeDeletedAgents();
  const [agents, totals, unused] = await Promise.all([
    prisma.agent.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" } }),
    prisma.reportAccessCode.groupBy({
      by: ["agentId"],
      where: { agentId: { not: null } },
      _count: { _all: true },
      _sum: { useCount: true },
      _max: { createdAt: true },
    }),
    prisma.reportAccessCode.groupBy({
      by: ["agentId"],
      where: { agentId: { not: null }, ...AGENT_STOCK_WHERE },
      _count: { _all: true },
      _sum: { useCount: true },
      _max: { createdAt: true },
    }),
  ]);
  const totalMap = indexStats(totals);
  const unusedMap = indexStats(unused);
  return agents.map((agent) => {
    const total = totalMap.get(agent.id)?._count._all ?? 0;
    const unusedCount = unusedMap.get(agent.id)?._count._all ?? 0;
    return {
      id: agent.id,
      name: agent.name,
      deleted: Boolean(agent.deletedAt),
      createdAt: agent.createdAt,
      codes: total,
      unused: unusedCount,
      used: total - unusedCount,
      uses: totalMap.get(agent.id)?._sum.useCount ?? 0,
      lastGeneratedAt: totalMap.get(agent.id)?._max.createdAt ?? null,
    };
  });
}

export async function getAgentInventorySummary() {
  const [items, threshold] = await Promise.all([listAgents(), getLowStockThreshold()]);
  const active = items.filter((item) => !item.deleted);
  const lowStock = active
    .filter((item) => isLowStock(item.unused, threshold))
    .sort((left, right) => left.unused - right.unused || left.name.localeCompare(right.name, "zh-CN"))
    .map((item) => ({ id: item.id, name: item.name, unusedCodeCount: item.unused }));
  return {
    threshold,
    items: active,
    lowStockCount: lowStock.length,
    agents: lowStock,
  };
}

export async function releaseUnassignedAccessCodes() {
  const rows = await prisma.reportAccessCode.findMany({
    where: { agentId: null },
    select: { id: true, code: true },
  });
  const ids = rows.filter((row) => /^\d{6}$/.test(row.code)).map((row) => row.id);
  if (!ids.length) return 0;
  const released = await prisma.reportAccessCode.deleteMany({ where: { id: { in: ids } } });
  return released.count;
}

export async function getAdminOverview(daysInput?: unknown) {
  await purgeDeletedAgents();
  await releaseUnassignedAccessCodes();
  const days = parseOverviewDays(daysInput);
  const dayKeys = recentDayKeys(days);
  const weekKeys = recentDayKeys(7);
  const rangeStart = dayKeys[0]!;
  const rangeEnd = dayKeys.at(-1)!;
  const prevEnd = new Date(`${rangeStart}T12:00:00+08:00`);
  prevEnd.setTime(prevEnd.getTime() - 86_400_000);
  const prevKeys = recentDayKeys(days, prevEnd);
  const historySince = new Date(`${prevKeys[0]}T00:00:00+08:00`);

  const [
    codeTotal,
    usedCodes,
    unusedCodes,
    assignedUnused,
    totalUseAgg,
    inventory,
    priceFen,
    dailyRows,
    usedByAgent,
    recentEvents,
  ] = await Promise.all([
    prisma.reportAccessCode.count(),
    prisma.reportAccessCode.count({ where: { useCount: { gt: 0 } } }),
    prisma.reportAccessCode.count({ where: { useCount: 0 } }),
    prisma.reportAccessCode.count({ where: { agentId: { not: null }, useCount: 0 } }),
    prisma.reportAccessCode.aggregate({ _sum: { useCount: true, priceFen: true }, where: { useCount: { gt: 0 } } }),
    getAgentInventorySummary(),
    getCodePriceFen(),
    prisma.$queryRaw<Array<{ day: Date | string; codes: number; fen: number }>>`
      WITH usage_events AS (
        SELECT u.access_code_id AS code_id, u.created_at AS used_at
        FROM users u
        WHERE u.access_role = 'buyer' AND u.access_code_id IS NOT NULL
        UNION ALL
        SELECT NULLIF(e.properties->>'accessCodeId', '') AS code_id, e.created_at AS used_at
        FROM events e
        WHERE e.event_name IN ('purchase_redeemed', 'access_code_used')
          AND NULLIF(e.properties->>'accessCodeId', '') IS NOT NULL
      ),
      first_use AS (
        SELECT DISTINCT ON (code_id) code_id, used_at
        FROM usage_events
        WHERE code_id IS NOT NULL
        ORDER BY code_id, used_at ASC
      )
      SELECT (fu.used_at AT TIME ZONE 'Asia/Shanghai')::date AS day,
             COUNT(*)::int AS codes,
             COALESCE(SUM(c.price_fen), 0)::int AS fen
      FROM first_use fu
      INNER JOIN report_access_codes c ON c.id = fu.code_id
      WHERE fu.used_at >= ${historySince}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.reportAccessCode.groupBy({
      by: ["agentId"],
      where: { useCount: { gt: 0 } },
      _count: { _all: true },
      _sum: { useCount: true },
    }),
    prisma.$queryRaw<Array<{
      used_at: Date;
      code: string;
      agent_name: string | null;
      agent_deleted: Date | null;
      source: string;
    }>>`
      WITH usage_events AS (
        SELECT u.access_code_id AS code_id, u.created_at AS used_at, 'web_login'::text AS source
        FROM users u
        WHERE u.access_role = 'buyer' AND u.access_code_id IS NOT NULL
        UNION ALL
        SELECT NULLIF(e.properties->>'accessCodeId', ''),
               e.created_at,
               COALESCE(NULLIF(e.properties->>'source', ''), CASE WHEN e.event_name = 'purchase_redeemed' THEN 'full_report' ELSE e.event_name END)
        FROM events e
        WHERE e.event_name IN ('purchase_redeemed', 'access_code_used')
          AND NULLIF(e.properties->>'accessCodeId', '') IS NOT NULL
      )
      SELECT ue.used_at, c.code, a.name AS agent_name, a.deleted_at AS agent_deleted, ue.source
      FROM usage_events ue
      INNER JOIN report_access_codes c ON c.id = ue.code_id
      LEFT JOIN agents a ON a.id = c.agent_id
      WHERE ue.code_id IS NOT NULL
      ORDER BY ue.used_at DESC
      LIMIT 5
    `,
  ]);

  const normalizedDaily = dailyRows.map((row) => ({
    day: sqlDayKey(row.day),
    codes: Number(row.codes),
    fen: Number(row.fen),
  }));
  const dailyUsage = fillDailyMoney(dayKeys, normalizedDaily);
  const weeklyStats = fillDailyMoney(weekKeys, normalizedDaily);
  const prevUsage = fillDailyMoney(prevKeys, normalizedDaily);

  const periodUsed = dailyUsage.reduce((sum, item) => sum + item.codes, 0);
  const prevPeriodUsed = prevUsage.reduce((sum, item) => sum + item.codes, 0);
  const periodFen = dailyUsage.reduce((sum, item) => sum + item.fen, 0);
  const prevPeriodFen = prevUsage.reduce((sum, item) => sum + item.fen, 0);
  const todayKey = dayKeys.at(-1)!;
  const todayRow = dailyUsage.find((item) => item.day === todayKey);

  const agentIds = usedByAgent.map((row) => row.agentId).filter((id): id is string => Boolean(id));
  const agentsMeta = agentIds.length
    ? await prisma.agent.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true, deletedAt: true } })
    : [];
  const agentMap = new Map(agentsMeta.map((item) => [item.id, item]));
  const assignedUsage = usedByAgent.filter((row) => row.agentId && agentMap.has(row.agentId));
  const treemapTotal = assignedUsage.reduce((sum, row) => sum + row._count._all, 0);
  const usageByAgent = assignedUsage
    .map((row) => {
      const agent = agentMap.get(row.agentId as string)!;
      const value = row._count._all;
      return {
        id: row.agentId,
        name: agentDisplayName(agent.name, Boolean(agent.deletedAt)),
        value,
        uses: row._sum.useCount ?? 0,
        pct: treemapTotal ? `${((value / treemapTotal) * 100).toFixed(1)}%` : "0.0%",
      };
    })
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name, "zh-CN"));

  const statusItems = [
    { name: "已使用", value: usedCodes, color: "#f0a04b" },
    { name: "未使用", value: assignedUnused, color: "#2f7cf6" },
  ].map((item) => ({
    ...item,
    pct: codeTotal ? `${((item.value / codeTotal) * 100).toFixed(2)}%` : "0.00%",
  }));

  return {
    days,
    range: { start: rangeStart, end: rangeEnd },
    history: {
      complete: false,
      note: "每日验证码数按「首次使用日」统计，来源为 Web 登录买家记录与报告兑换事件；同一验证码跨天多次使用只计入首次。lastUsedAt 未用于历史趋势。登录侧历史在补记 access_code_used 之前仅能通过 buyer 用户记录恢复。",
    },
    kpis: {
      totalCodes: codeTotal,
      usedCodes,
      unusedCodes,
      agents: inventory.items.length,
      totalFen: totalUseAgg._sum.priceFen ?? 0,
      totalUseCount: totalUseAgg._sum.useCount ?? 0,
      deltas: {
        totalCodes: null as number | null,
        usedCodes: periodDeltaPercent(periodUsed, prevPeriodUsed),
        unusedCodes: null as number | null,
        agents: null as number | null,
        totalFen: periodDeltaPercent(periodFen, prevPeriodFen),
      },
    },
    codes: {
      total: codeTotal,
      usedCodes,
      unusedCodes,
      assignedUnused,
      capacity: ACCESS_CODE_CAPACITY,
      remaining: remainingAccessCodes(codeTotal),
    },
    dailyUsage: dailyUsage.map(({ day, codes }) => ({ day, codes })),
    weeklyStats: weeklyStats.map(({ day, codes, fen }) => ({
      day: day.slice(5),
      usage: codes,
      amount: Number((fen / 100).toFixed(2)),
      fen,
    })),
    usageByAgent,
    usageByStatus: statusItems,
    donut: { total: codeTotal, items: statusItems },
    recentUsage: recentEvents.map((item) => ({
      time: new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(item.used_at).replace(/\//g, "-"),
      code: item.code,
      agent: item.agent_name ? agentDisplayName(item.agent_name, Boolean(item.agent_deleted)) : "—",
      status: "已使用",
      source: item.source,
    })),
    revenue: {
      priceFen,
      todayCodes: todayRow?.codes ?? 0,
      todayFen: todayRow?.fen ?? 0,
      totalFen: totalUseAgg._sum.priceFen ?? 0,
      periodFen,
      periodUsed,
    },
    agents: inventory.items.length,
    agentInventory: {
      threshold: inventory.threshold,
      lowStockCount: inventory.lowStockCount,
      agents: inventory.agents,
    },
  };
}

export async function getAdminRelationshipDistribution(daysInput?: unknown, now = new Date()) {
  const days = parseRelationshipDays(daysInput);
  const dayKeys = recentDayKeys(days, now);
  const rangeStart = dayKeys[0]!;
  const rangeEnd = dayKeys.at(-1)!;
  const start = new Date(`${rangeStart}T00:00:00+08:00`);
  const end = new Date(`${rangeEnd}T00:00:00+08:00`);
  end.setTime(end.getTime() + 86_400_000);
  const grouped = await prisma.relationshipResult.groupBy({
    by: ["relationshipType"],
    where: { createdAt: { gte: start, lt: end } },
    _count: { _all: true },
  });
  const counts = new Map<string, number>();
  let ignoredUnknownCount = 0;
  for (const row of grouped) {
    const count = Math.max(0, Math.trunc(Number(row._count._all) || 0));
    if (!RELATIONSHIP_BY_ID[row.relationshipType]) {
      ignoredUnknownCount += count;
      continue;
    }
    counts.set(row.relationshipType, (counts.get(row.relationshipType) ?? 0) + count);
  }
  const knownTotal = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const totalCompletedTests = knownTotal + ignoredUnknownCount;
  const items = RELATIONSHIP_TYPES.map((type) => {
    const count = counts.get(type.id) ?? 0;
    return {
      typeId: type.id,
      code: type.code,
      name: type.name,
      count,
      pct: relationshipSharePercent(count, totalCompletedTests),
    };
  }).sort((left, right) => right.count - left.count || left.code.localeCompare(right.code));
  const topType = items[0] && items[0].count > 0 ? items[0] : null;
  const top5Count = items.slice(0, 5).reduce((sum, item) => sum + item.count, 0);
  return {
    days,
    range: { start: rangeStart, end: rangeEnd },
    totalCompletedTests,
    distinctTypes: items.filter((item) => item.count > 0).length,
    topType,
    top5Pct: relationshipSharePercent(top5Count, totalCompletedTests),
    ignoredUnknownCount,
    items,
  };
}

export async function createAgent(name: string) {
  const normalized = normalizeAgentName(name);
  try {
    return await prisma.agent.create({
      data: { name: normalized },
      select: { id: true, name: true, createdAt: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(ErrorCodes.AGENT_EXISTS, `代理人「${normalized}」已经存在`, 409);
    }
    throw error;
  }
}

export async function updateAgent(id: string, name: string) {
  await requireAgent(id);
  const normalized = normalizeAgentName(name);
  try {
    return await prisma.agent.update({
      where: { id },
      data: { name: normalized },
      select: { id: true, name: true, createdAt: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(ErrorCodes.AGENT_EXISTS, `代理人「${normalized}」已经存在`, 409);
    }
    throw error;
  }
}

export async function deleteAgent(id: string) {
  const agent = await requireAgent(id);
  if (agent.deletedAt) throw new AppError(ErrorCodes.NOT_FOUND, "代理人已删除", 404);
  const released = await prisma.$transaction(async (tx) => {
    const removed = await tx.reportAccessCode.deleteMany({
      where: { agentId: id },
    });
    await tx.agent.delete({ where: { id } });
    return removed.count;
  });
  return { id, released };
}

async function requireAgent(agentId: string) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent || agent.deletedAt) throw new AppError(ErrorCodes.NOT_FOUND, "代理人不存在，请先创建", 404);
  return agent;
}

export async function getAgent(id: string) {
  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent) throw new AppError(ErrorCodes.NOT_FOUND, "代理人不存在，请先创建", 404);
  const [total, unused, uses, lastGenerated, recentCodes] = await Promise.all([
    prisma.reportAccessCode.count({ where: { agentId: id } }),
    prisma.reportAccessCode.count({ where: { agentId: id, ...AGENT_STOCK_WHERE } }),
    prisma.reportAccessCode.aggregate({ where: { agentId: id }, _sum: { useCount: true } }),
    prisma.reportAccessCode.findFirst({
      where: { agentId: id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.reportAccessCode.findMany({
      where: { agentId: id },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        code: true,
        isActive: true,
        useCount: true,
        lastUsedAt: true,
        createdAt: true,
        priceFen: true,
        priceVariant: true,
      },
    }),
  ]);
  return {
    id: agent.id,
    name: agent.name,
    deleted: Boolean(agent.deletedAt),
    createdAt: agent.createdAt,
    codes: total,
    unused,
    used: total - unused,
    uses: uses._sum.useCount ?? 0,
    lastGeneratedAt: lastGenerated?.createdAt ?? null,
    recentCodes,
  };
}

export async function listAccessCodes(input: {
  query?: string;
  status?: "all" | "active" | "disabled";
  agentId?: string;
  usage?: "all" | "unused" | "used" | "frequent";
  sort?: "useCount" | "createdAt";
  order?: "asc" | "desc";
  page: number;
  pageSize: number;
}) {
  await purgeDeletedAgents();
  await releaseUnassignedAccessCodes();
  const where: Prisma.ReportAccessCodeWhereInput = {
    agentId: { not: null },
    agent: { deletedAt: null },
  };
  if (input.query) where.code = { contains: input.query };
  if (input.status === "active") where.isActive = true;
  if (input.status === "disabled") where.isActive = false;
  if (input.agentId) where.agentId = input.agentId;
  if (input.usage === "unused") where.useCount = 0;
  if (input.usage === "used") where.useCount = { gt: 0 };
  if (input.usage === "frequent") where.useCount = { gte: FREQUENT_USE_THRESHOLD };
  const orderBy = input.sort && input.order
    ? [{ [input.sort]: input.order }, { id: "asc" as const }]
    : [{ createdAt: "desc" as const }];
  const [items, total] = await Promise.all([
    prisma.reportAccessCode.findMany({
      where,
      orderBy,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        id: true,
        code: true,
        isActive: true,
        useCount: true,
        lastUsedAt: true,
        createdAt: true,
        channel: true,
        priceFen: true,
        priceVariant: true,
        agentId: true,
        agent: { select: { id: true, name: true, deletedAt: true } },
      },
    }),
    prisma.reportAccessCode.count({ where }),
  ]);
  return { items, total, page: input.page, pageSize: input.pageSize };
}

export async function generateAccessCodes(input: {
  count: number;
  agentId: string;
}) {
  const [agent, priceFen] = await Promise.all([requireAgent(input.agentId), getCodePriceFen()]);
  const usedCount = await prisma.reportAccessCode.count();
  const remaining = remainingAccessCodes(usedCount);
  if (input.count > remaining) {
    throw new AppError(ErrorCodes.BAD_REQUEST, insufficientCapacityMessage(remaining), 400);
  }
  const created: Array<{ id: string; code: string; agentId: string | null }> = [];
  const batch = new Set<string>();
  const limit = input.count * GENERATE_RETRY_PER_CODE;
  for (let attempts = 0; created.length < input.count && attempts < limit; attempts += 1) {
    const code = makeNumericAccessCode();
    if (batch.has(code)) continue;
    batch.add(code);
    try {
      const item = await prisma.reportAccessCode.create({
        data: {
          code,
          agentId: agent.id,
          channel: agent.name,
          priceFen,
          priceVariant: `fen_${priceFen}`,
        },
        select: { id: true, code: true, agentId: true },
      });
      created.push(item);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  if (created.length !== input.count) {
    throw new AppError(ErrorCodes.INTERNAL, "验证码生成失败，请稍后重试", 500);
  }
  return created;
}

export async function setAccessCodeActive(id: string, isActive: boolean) {
  try {
    return await prisma.reportAccessCode.update({
      where: { id },
      data: { isActive },
      select: { id: true, code: true, isActive: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new AppError(ErrorCodes.NOT_FOUND, "验证码不存在", 404);
    }
    throw error;
  }
}

export async function listCodesForExport(agentId?: string) {
  await purgeDeletedAgents();
  await releaseUnassignedAccessCodes();
  const where: Prisma.ReportAccessCodeWhereInput = {
    agentId: { not: null },
    agent: { deletedAt: null },
  };
  if (agentId) where.agentId = agentId;
  return prisma.reportAccessCode.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      code: true,
      isActive: true,
      channel: true,
      priceFen: true,
      priceVariant: true,
      useCount: true,
      lastUsedAt: true,
      createdAt: true,
      agent: { select: { name: true, deletedAt: true } },
    },
  });
}

export async function getAdminRuntime(config: { NODE_ENV: string; ADMIN_PASSWORD: string; PORT: number }) {
  const started = Date.now();
  let postgres = { ok: false, ms: 0 };
  try {
    await prisma.$queryRaw`SELECT 1`;
    postgres = { ok: true, ms: Date.now() - started };
  } catch {
    postgres = { ok: false, ms: Date.now() - started };
  }
  const memory = process.memoryUsage();
  return {
    api: { ok: true },
    postgres,
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    rssBytes: memory.rss,
    heapUsed: memory.heapUsed,
    heapTotal: memory.heapTotal,
    nodeEnv: config.NODE_ENV,
    port: config.PORT,
    adminPasswordConfigured: Boolean(config.ADMIN_PASSWORD),
  };
}
