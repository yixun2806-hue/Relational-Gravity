import { beforeEach, describe, expect, it, vi } from "vitest";
import { RELATIONSHIP_TYPES } from "../content/relationships.js";

const prismaMock = vi.hoisted(() => ({
  relationshipResult: {
    groupBy: vi.fn(),
  },
}));

vi.mock("../db.js", () => ({ prisma: prismaMock }));

const { getAdminRelationshipDistribution } = await import("./admin-service.js");

const NOW = new Date("2026-10-03T12:00:00+08:00");

function grouped(rows: Array<{ relationshipType: string; count: number }>) {
  prismaMock.relationshipResult.groupBy.mockResolvedValue(
    rows.map((row) => ({ relationshipType: row.relationshipType, _count: { _all: row.count } })),
  );
}

describe("getAdminRelationshipDistribution", () => {
  beforeEach(() => {
    prismaMock.relationshipResult.groupBy.mockReset();
  });

  it("returns all 24 types as zero when no relationship result exists", async () => {
    grouped([]);
    const data = await getAdminRelationshipDistribution(30, NOW);
    expect(prismaMock.relationshipResult.groupBy).toHaveBeenCalledTimes(1);
    expect(data.totalCompletedTests).toBe(0);
    expect(data.distinctTypes).toBe(0);
    expect(data.topType).toBeNull();
    expect(data.top5Pct).toBe(0);
    expect(data.days).toBe(30);
    expect(data.range).toEqual({ start: "2026-09-04", end: "2026-10-03" });
    expect(data.items).toHaveLength(24);
    expect(data.items.map((item) => item.typeId)).toEqual(RELATIONSHIP_TYPES.map((item) => item.id));
    expect(data.items.every((item) => item.count === 0 && item.pct === 0)).toBe(true);
    for (const type of RELATIONSHIP_TYPES) {
      expect(data.items.find((item) => item.typeId === type.id)).toMatchObject({
        code: type.code,
        name: type.name,
      });
    }
  });

  it("keeps the other 23 types when only one relationship appears", async () => {
    grouped([{ relationshipType: "spotlight_spotlight", count: 2 }]);
    const data = await getAdminRelationshipDistribution(30, NOW);
    expect(data.totalCompletedTests).toBe(2);
    expect(data.distinctTypes).toBe(1);
    expect(data.topType).toMatchObject({
      typeId: "spotlight_spotlight",
      code: "16",
      name: "显眼包 × 显眼包",
      count: 2,
      pct: 100,
    });
    expect(data.top5Pct).toBe(100);
    expect(data.items).toHaveLength(24);
    expect(data.items.filter((item) => item.count === 0)).toHaveLength(23);
    expect(data.items[0]?.typeId).toBe("spotlight_spotlight");
  });

  it("counts several relationships, fills missing types, and sorts by count then code", async () => {
    grouped([
      { relationshipType: "hesitate_decide", count: 5 },
      { relationshipType: "iceberg_sun", count: 5 },
      { relationshipType: "cat_dog", count: 2 },
      { relationshipType: "stubborn_soft", count: 1 },
    ]);
    const data = await getAdminRelationshipDistribution(7, NOW);
    expect(data.items).toHaveLength(24);
    expect(data.distinctTypes).toBe(4);
    expect(data.totalCompletedTests).toBe(13);
    expect(data.items.slice(0, 4).map((item) => item.typeId)).toEqual([
      "iceberg_sun",
      "hesitate_decide",
      "cat_dog",
      "stubborn_soft",
    ]);
    expect(data.items.find((item) => item.typeId === "pm_slacker")).toMatchObject({ count: 0, pct: 0, name: "关系项目经理 × 快乐摸鱼王" });
    expect(data.topType).toMatchObject({ typeId: "iceberg_sun", code: "01", count: 5 });
    const iceberg = data.items.find((item) => item.typeId === "iceberg_sun");
    const cat = data.items.find((item) => item.typeId === "cat_dog");
    expect(iceberg?.pct).toBe(38.46);
    expect(cat?.pct).toBe(15.38);
    expect(typeof iceberg?.pct).toBe("number");
    const pctSum = data.items.reduce((sum, item) => sum + item.pct, 0);
    expect(pctSum).toBeCloseTo(100, 1);
    expect(data.top5Pct).toBe(100);
  });

  it("uses relationship result counts as the percentage denominator", async () => {
    grouped([
      { relationshipType: "iceberg_sun", count: 1 },
      { relationshipType: "stubborn_soft", count: 1 },
      { relationshipType: "cat_dog", count: 2 },
    ]);
    const data = await getAdminRelationshipDistribution(30, NOW);
    expect(data.totalCompletedTests).toBe(4);
    expect(data.items.find((item) => item.typeId === "cat_dog")?.pct).toBe(50);
    expect(data.items.find((item) => item.typeId === "iceberg_sun")?.pct).toBe(25);
    expect(data.items.reduce((sum, item) => sum + item.pct, 0)).toBe(100);
    expect(data.top5Pct).toBe(100);
  });

  it("ignores unknown relationship types without dropping the 24 official results", async () => {
    grouped([
      { relationshipType: "iceberg_sun", count: 6 },
      { relationshipType: "future_unknown_type", count: 4 },
      { relationshipType: "", count: 1 },
    ]);
    const data = await getAdminRelationshipDistribution(30, NOW);
    expect(data.items).toHaveLength(24);
    expect(data.items.some((item) => item.typeId === "future_unknown_type" || item.typeId === "")).toBe(false);
    expect(data.ignoredUnknownCount).toBe(5);
    expect(data.totalCompletedTests).toBe(11);
    expect(data.distinctTypes).toBe(1);
    expect(data.items.find((item) => item.typeId === "iceberg_sun")).toMatchObject({ count: 6, pct: 54.55 });
    expect(data.topType?.typeId).toBe("iceberg_sun");
  });

  it("filters by relationship result createdAt in Asia/Shanghai", async () => {
    grouped([{ relationshipType: "iceberg_sun", count: 1 }]);
    const data = await getAdminRelationshipDistribution(7, NOW);
    expect(data.range).toEqual({ start: "2026-09-27", end: "2026-10-03" });
    expect(data.days).toBe(7);
    const args = prismaMock.relationshipResult.groupBy.mock.calls[0]?.[0];
    expect(args.by).toEqual(["relationshipType"]);
    expect(args._count).toEqual({ _all: true });
    expect(args.where.createdAt.gte).toEqual(new Date("2026-09-27T00:00:00+08:00"));
    expect(args.where.createdAt.lt).toEqual(new Date("2026-10-04T00:00:00+08:00"));
    expect(prismaMock.relationshipResult.groupBy).toHaveBeenCalledTimes(1);
  });

  it("falls back to 30 days when the window is outside 1 to 365", async () => {
    grouped([]);
    const data = await getAdminRelationshipDistribution(400, NOW);
    expect(data.days).toBe(30);
    expect(data.range).toEqual({ start: "2026-09-04", end: "2026-10-03" });
  });
});
