import { describe, expect, it } from "vitest";
import {
  ACCESS_CODE_CAPACITY,
  allocateNumericAccessCodes,
  AGENT_STOCK_WHERE,
  agentDisplayName,
  fillDailyCounts,
  fillDailyMoney,
  isLowStock,
  parseCodePriceFen,
  parseOverviewDays,
  periodDeltaPercent,
  recentDayKeys,
  sqlDayKey,
  makeNumericAccessCode,
  matchesAdminPassword,
  normalizeAgentName,
  parseBasicCredentials,
  parseLowStockThreshold,
  remainingAccessCodes,
  requireNumericAccessCode,
  insufficientCapacityMessage,
} from "./admin-service.js";

describe("admin access code generation", () => {
  it("creates exactly six numeric characters and preserves leading zeroes", () => {
    expect(makeNumericAccessCode(() => 0)).toBe("000000");
    expect(makeNumericAccessCode(() => 999999)).toBe("999999");
    expect(makeNumericAccessCode(() => 42)).toBe("000042");
  });

  it("never reuses codes already taken or already allocated in the same batch", () => {
    const sequence = [1, 1, 2, 2, 3];
    let index = 0;
    const codes = allocateNumericAccessCodes(2, ["000001"], () => sequence[index++] ?? 3);
    expect(codes).toEqual(["000002", "000003"]);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("allocates a unique batch of codes", () => {
    const codes = allocateNumericAccessCodes(40);
    expect(codes).toHaveLength(40);
    expect(new Set(codes).size).toBe(40);
  });

  it("accepts only six digits without spaces", () => {
    expect(requireNumericAccessCode("012345")).toBe("012345");
    expect(() => requireNumericAccessCode(" 012345 ")).toThrow("验证码必须是6位数字，且不能包含空格");
    expect(() => requireNumericAccessCode("12345A")).toThrow("验证码必须是6位数字，且不能包含空格");
  });
});

describe("admin agents", () => {
  it("trims agent names and rejects blank or oversized names", () => {
    expect(normalizeAgentName("  张三  ")).toBe("张三");
    expect(() => normalizeAgentName("   ")).toThrow("请填写代理人姓名");
    expect(() => normalizeAgentName("x".repeat(33))).toThrow("代理人姓名不能超过 32 个字");
  });

  it("counts remaining unique codes against the 1,000,000 pool", () => {
    expect(ACCESS_CODE_CAPACITY).toBe(1_000_000);
    expect(remainingAccessCodes(0)).toBe(1_000_000);
    expect(remainingAccessCodes(115)).toBe(999885);
    expect(remainingAccessCodes(1_000_000)).toBe(0);
  });

  it("rejects oversized batches before random retry", () => {
    expect(insufficientCapacityMessage(20)).toBe("验证码剩余数量不足，当前最多还能生成20个。");
  });
});

describe("agent low stock", () => {
  it("warns when unused count is less than or equal to the threshold", () => {
    expect(isLowStock(31, 30)).toBe(false);
    expect(isLowStock(30, 30)).toBe(true);
    expect(isLowStock(12, 30)).toBe(true);
  });

  it("counts remaining stock only from active unused codes", () => {
    expect(AGENT_STOCK_WHERE).toEqual({ isActive: true, useCount: 0 });
  });

  it("marks a deleted agent in the name shown to operators", () => {
    expect(agentDisplayName("张三", false)).toBe("张三");
    expect(agentDisplayName("张三", true)).toBe("张三（已删除）");
  });

  it("fills missing days with zero used codes and fen", () => {
    const days = recentDayKeys(3, new Date("2026-09-23T12:00:00+08:00"));
    expect(days).toEqual(["2026-09-21", "2026-09-22", "2026-09-23"]);
    expect(fillDailyCounts(days, [{ day: "2026-09-22", codes: 4 }])).toEqual([
      { day: "2026-09-21", codes: 0 },
      { day: "2026-09-22", codes: 4 },
      { day: "2026-09-23", codes: 0 },
    ]);
    expect(fillDailyMoney(days, [{ day: "2026-09-22", codes: 4, fen: 3960 }])).toEqual([
      { day: "2026-09-21", codes: 0, fen: 0 },
      { day: "2026-09-22", codes: 4, fen: 3960 },
      { day: "2026-09-23", codes: 0, fen: 0 },
    ]);
  });

  it("parses overview day windows and period deltas", () => {
    expect(parseOverviewDays(7)).toBe(7);
    expect(parseOverviewDays(30)).toBe(30);
    expect(parseOverviewDays(90)).toBe(90);
    expect(parseOverviewDays(15)).toBe(30);
    expect(periodDeltaPercent(4, 2)).toBe(100);
    expect(periodDeltaPercent(0, 0)).toBe(0);
    expect(periodDeltaPercent(3, 0)).toBeNull();
  });

  it("keeps a UTC date column on its calendar day", () => {
    expect(sqlDayKey(new Date("2026-09-23T00:00:00.000Z"))).toBe("2026-09-23");
    expect(sqlDayKey("2026-09-23")).toBe("2026-09-23");
  });

  it("accepts a unit price stored in fen", () => {
    expect(parseCodePriceFen(990)).toBe(990);
    expect(() => parseCodePriceFen(0)).toThrow("单个验证码金额必须在 0.01 元到 9999 元之间");
    expect(() => parseCodePriceFen(9.9)).toThrow("单个验证码金额必须在 0.01 元到 9999 元之间");
  });

  it("accepts only integers from 1 to 999999", () => {
    expect(parseLowStockThreshold(30)).toBe(30);
    expect(parseLowStockThreshold("50")).toBe(50);
    expect(() => parseLowStockThreshold(0)).toThrow("预警阈值必须是 1 到 999999 的整数");
    expect(() => parseLowStockThreshold(1.5)).toThrow("预警阈值必须是 1 到 999999 的整数");
  });
});

describe("admin authentication helpers", () => {
  it("parses a valid Basic authorization header", () => {
    const encoded = Buffer.from("admin:secret:with-colon").toString("base64");
    expect(parseBasicCredentials(`Basic ${encoded}`)).toEqual({
      username: "admin",
      password: "secret:with-colon",
    });
  });

  it("rejects missing or malformed authorization headers", () => {
    expect(parseBasicCredentials(undefined)).toBeNull();
    expect(parseBasicCredentials("Bearer token")).toBeNull();
    expect(parseBasicCredentials("Basic !!!")).toBeNull();
  });

  it("matches username and password without falling back to a default", () => {
    expect(matchesAdminPassword("admin", "admin123456", "admin", "admin123456")).toBe(true);
    expect(matchesAdminPassword("admin", "wrong", "admin", "admin123456")).toBe(false);
    expect(matchesAdminPassword("admin", "admin123456", "admin", "")).toBe(false);
  });
});
