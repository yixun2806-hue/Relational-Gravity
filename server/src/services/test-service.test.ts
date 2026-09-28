import { TestStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredPairReport } from "../algorithms/compose.js";

const buildPairReport = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  test: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  resultUnlock: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  relationshipResult: { upsert: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
  testAnswer: { findMany: vi.fn(), count: vi.fn(), createMany: vi.fn() },
}));

vi.mock("../db.js", () => ({ prisma: prismaMock }));
vi.mock("../algorithms/compose.js", async () => {
  const actual = await vi.importActual<typeof import("../algorithms/compose.js")>("../algorithms/compose.js");
  return { ...actual, buildPairReport };
});

const { getRelationship, mapFull } = await import("./test-service.js");
const { buildPairReportFromScores } = await import("../algorithms/compose.js");
const { RELATIONSHIP_FIXTURES } = await import("../algorithms/fixtures.js");

function person(typeName: string, dominance: number) {
  return {
    typeId: typeName,
    typeName,
    tagline: typeName,
    summary: typeName,
    score: 80,
    secondaryTypeId: null,
    secondaryTypeName: null,
    typeScores: {},
    dimensionScores: { dominance },
  };
}

const scene = {
  title: "场景",
  lines: [
    { speaker: "you" as const, text: "你怎么不说话？" },
    { speaker: "ta" as const, text: "没事。" },
  ],
  punchline: "安静。",
};

const details = {
  misunderstandings: [{ id: "m", title: "误解", aView: "A 侧看法", bView: "B 侧看法", bridge: "桥" }],
  conflictPattern: { title: "冲突", aReaction: "A 先问", bReaction: "B 先停", stuckAt: "卡住", repair: "约时间" },
  communicationGuide: [{ scenario: "回复慢", forA: "A 可以说", forB: "B 可以说", why: "原因" }],
};

function stored(version?: number): StoredPairReport {
  const report = {
    a: person("人格A", 12),
    b: person("人格B", 91),
    relationshipType: "hesitate_decide",
    relationshipCode: "18",
    relationshipName: "纠结王 × 决策王",
    subtitle: "副标题",
    tagline: "一句话",
    summary: "摘要",
    indices: { rapport: 40, companionship: 41, communication: 42, security: 43, freedom: 44, spark: 45, stability: 46, abstract: 47 },
    indexLabels: { rapport: "默契" },
    dimensionLabels: { dominance: "掌舵" },
    whoMore: [{
      id: "cares",
      title: "谁更在乎这段关系",
      aPercent: 72,
      bPercent: 28,
      aLabel: "你",
      bLabel: "TA",
      tie: false,
      note: "投入更明显一点。",
    }],
    scene,
    roast: "吐槽",
    advice: ["建议"],
    ...details,
  };
  return (version === undefined ? report : { ...report, reportVersion: version }) as StoredPairReport;
}

function storedV2(): StoredPairReport {
  return {
    ...stored(2),
    whoMore: [{
      id: "cares",
      title: "谁更在乎这段关系",
      aPercent: 72,
      bPercent: 28,
      aLabel: "A",
      bLabel: "B",
      tie: false,
      note: "",
      winner: "a",
      reason: { aScore: 80, bScore: 20, dimensions: ["investment"] },
    }],
    relationshipCandidates: [{
      typeId: "hesitate_decide",
      score: 64,
      eligibility: 64,
      eligible: true,
      tier: "eligible",
      fallback: false,
      orientation: "a-b",
      roles: { a: "纠结王", b: "决策王" },
      evidence: [{
        id: "hesitate-dominance",
        dimensionKeys: ["dominance"],
        strength: 80,
        aValue: 12,
        bValue: 91,
        role: "a",
        text: "A 的掌舵指数偏低，当前值 12%",
      }],
    }],
    relationshipEvidence: [{
      id: "dominance-gap",
      dimensionKeys: ["dominance"],
      strength: 70,
      aValue: 12,
      bValue: 91,
      role: "pair",
      text: "A 与 B 的掌舵指数差异，当前支持度 70%",
    }],
  } as StoredPairReport;
}

describe("stored report perspective", () => {
  it("reads a V1 report and flips B without rebuilding", () => {
    const report = stored();
    const aView = mapFull(report, true);
    const bView = mapFull(report, false);
    expect(aView.reportVersion).toEqual({ kind: "v1", version: 1 });
    expect(aView).not.toHaveProperty("relationshipCandidates");
    expect(aView.you.typeName).toBe("人格A");
    expect(aView.you.dimensionScores.dominance).toBe(12);
    expect(aView.whoMore[0]?.aPercent).toBe(72);
    expect(aView.whoMore[0]?.winner).toBe("you");
    expect(aView.whoMore[0]?.note).toBe("投入更明显一点。");
    expect(bView.you.typeName).toBe("人格B");
    expect(bView.you.dimensionScores.dominance).toBe(91);
    expect(bView.whoMore[0]?.aPercent).toBe(28);
    expect(bView.whoMore[0]?.winner).toBe("ta");
    expect(bView.whoMore[0]?.note).toBe("TA 把这段关系放得更靠前。");
    expect(bView.scene.lines[0]?.speaker).toBe("ta");
    expect(bView.misunderstandings[0]?.yourView).toBe("B 侧看法");
    expect(bView.conflictPattern.yourReaction).toBe("B 先停");
    expect(bView.communicationGuide[0]?.forYou).toBe("B 可以说");
    expect(report.whoMore[0]?.note).toBe("投入更明显一点。");
  });

  it("maps a V2 report from both perspectives", () => {
    const report = storedV2();
    const aView = mapFull(report, true);
    const bView = mapFull(report, false);
    expect(aView.reportVersion).toEqual({ kind: "v2", version: 2 });
    expect(aView.relationshipCandidates?.[0]?.typeId).toBe("hesitate_decide");
    expect(aView.relationshipCandidates?.[0]?.roles).toEqual({ you: "纠结王", ta: "决策王" });
    expect(aView.relationshipCandidates?.[0]?.evidence[0]?.role).toBe("you");
    expect(aView.relationshipCandidates?.[0]?.evidence[0]?.text).toBe("你 的掌舵指数偏低，当前值 12%");
    expect(aView.relationshipEvidence?.[0]?.text).toBe("你 与 TA 的掌舵指数差异，当前支持度 70%");
    expect(aView.whoMore[0]?.winner).toBe("you");
    expect(aView.whoMore[0]?.note).not.toContain("TA");
    expect(bView.you.dimensionScores.dominance).toBe(91);
    expect(bView.relationshipCandidates?.[0]?.roles).toEqual({ you: "决策王", ta: "纠结王" });
    expect(bView.relationshipCandidates?.[0]?.orientation).toBe("b-a");
    expect(bView.relationshipCandidates?.[0]?.evidence[0]?.role).toBe("ta");
    expect(bView.relationshipCandidates?.[0]?.evidence[0]?.aValue).toBe(91);
    expect(bView.relationshipCandidates?.[0]?.evidence[0]?.text).toBe("TA 的掌舵指数偏低，当前值 12%");
    expect(bView.relationshipEvidence?.[0]?.role).toBe("pair");
    expect(bView.relationshipEvidence?.[0]?.text).toBe("TA 与 你 的掌舵指数差异，当前支持度 70%");
    expect(bView.whoMore[0]?.aPercent).toBe(28);
    expect(bView.whoMore[0]?.winner).toBe("ta");
    expect(bView.whoMore[0]?.note).toContain("TA");
    expect(bView.whoMore[0]?.reason?.youScore).toBe(20);
    expect(report.whoMore[0]?.note).toBe("");
  });

  it("keeps an explicit v1 and does not disguise a future version as v1", () => {
    expect(mapFull(stored(1), true).reportVersion).toEqual({ kind: "v1", version: 1 });
    const future = mapFull({ ...storedV2(), reportVersion: 3 }, false);
    expect(future.reportVersion).toEqual({ kind: "unsupported", version: 3 });
    expect(future).not.toHaveProperty("relationshipCandidates");
    expect(future.you.typeName).toBe("人格B");
    expect(() => mapFull({ ...stored(), reportVersion: "2" }, true)).toThrow(/报告版本无效/);
  });
});

describe("phase 2 perspective", () => {
  it("maps an extended V2 report for B and leaves old V2 without archive fields", () => {
    const fixture = RELATIONSHIP_FIXTURES.find((item) => item.typeId === "talk_now_later");
    const report = buildPairReportFromScores(fixture!.a, fixture!.b);
    const stored = report.finalSummary;
    const view = mapFull(report, false);
    expect(view.reportVersion).toEqual({ kind: "v2", version: 2 });
    expect(view.finalSummary).toContain("你目前更接近");
    expect(view.finalSummary).toContain("TA目前更接近");
    expect(view.differences?.[0]?.aValue).toBe(report.differences[0]?.bValue);
    expect(view.conflictCycle?.yourFirstReaction).toContain("你");
    expect(view.adviceForYou?.[0]).toContain("你");
    expect(view.communicationScenarios?.[0]?.youScript).toContain("你可以说");
    expect((view.complements?.youOffer.length ?? 0) + (view.complements?.taOffer.length ?? 0)).toBeGreaterThan(0);
    expect(view.dynamicScene?.lines.some((line) => line.speaker === "you")).toBe(true);
    expect(report.finalSummary).toBe(stored);
    const old = mapFull(storedV2(), true);
    expect(old).not.toHaveProperty("relationshipConfidence");
    expect(old).not.toHaveProperty("finalSummary");
  });
});

describe("historical relationship reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.resultUnlock.findFirst.mockResolvedValue({ id: "unlock" });
  });

  it.each([
    ["v1", stored()],
    ["v2", storedV2()],
  ])("does not rebuild or write a stored %s report", async (_label, content) => {
    prismaMock.test.findUnique.mockResolvedValue({
      id: "t1",
      creatorId: "ua",
      participantBId: "ub",
      status: TestStatus.completed,
      relationship: { content },
    });
    const result = await getRelationship("t1", "ub");
    expect(buildPairReport).not.toHaveBeenCalled();
    expect(prismaMock.relationshipResult.upsert).not.toHaveBeenCalled();
    expect(prismaMock.relationshipResult.update).not.toHaveBeenCalled();
    expect(prismaMock.relationshipResult.create).not.toHaveBeenCalled();
    expect(prismaMock.test.update).not.toHaveBeenCalled();
    expect(result.full?.you.typeName).toBe("人格B");
  });
});
