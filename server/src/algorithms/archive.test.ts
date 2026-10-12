import { describe, expect, it } from "vitest";
import { RELATIONSHIP_FIXTURES } from "./fixtures.js";
import { DIMENSION_KEYS, type DimensionScores } from "../domain/dimensions.js";
import { buildPairReportFromScores } from "./compose.js";
import { actionCategory, indexLevel, wordingStrengthFor } from "./archive.js";
import { matchRelationship } from "./relationship.js";
import { computeIndices } from "./indices.js";

function vector(value: number, patch: Partial<DimensionScores> = {}): DimensionScores {
  return { ...Object.fromEntries(DIMENSION_KEYS.map((key) => [key, value])), ...patch } as DimensionScores;
}

function blend(scores: DimensionScores, ratio: number): DimensionScores {
  return Object.fromEntries(DIMENSION_KEYS.map((key) => [key, Math.round(scores[key] * ratio + 50 * (1 - ratio))])) as DimensionScores;
}

const similar = buildPairReportFromScores(
  vector(72, { boundary: 88, independence: 84, rationality: 76 }),
  vector(70, { boundary: 86, independence: 82, rationality: 74 }),
);
const complement = buildPairReportFromScores(
  RELATIONSHIP_FIXTURES.find((item) => item.typeId === "rational_emotional")!.a,
  RELATIONSHIP_FIXTURES.find((item) => item.typeId === "rational_emotional")!.b,
);
const conflict = buildPairReportFromScores(
  RELATIONSHIP_FIXTURES.find((item) => item.typeId === "talk_now_later")!.a,
  RELATIONSHIP_FIXTURES.find((item) => item.typeId === "talk_now_later")!.b,
);

describe("phase 2 archive", () => {
  it("fills the extended report from matcher facts", () => {
    for (const report of [similar, complement, conflict]) {
      expect(report.reportVersion).toBe(2);
      expect(report.dimensionComparison).toHaveLength(16);
      expect(report.indicesDetailed).toHaveLength(8);
      expect(report.similarities.length).toBeLessThanOrEqual(5);
      expect(report.differences.length).toBeLessThanOrEqual(5);
      expect(report.strengths.length).toBeLessThanOrEqual(5);
      expect(report.communicationScenarios.length).toBeGreaterThanOrEqual(6);
      expect(report.communicationScenarios.length).toBeLessThanOrEqual(8);
      expect(report.communicationScenarios.every((item) => !/比较的是同一个指标|比较的是不同指标|不能说成两边接近/.test(item.whySelected))).toBe(true);
      expect(report.nextActions).toHaveLength(3);
      expect(report.whoMore).toHaveLength(9);
      expect(report.whoMore.every((item) => item.explanation && item.explanation.length > 0)).toBe(true);
      expect(report.complements.aOffers.length).toBeLessThanOrEqual(3);
      expect(report.complements.bOffers.length).toBeLessThanOrEqual(3);
      expect(new Set(report.boundaries.forA).size).toBe(report.boundaries.forA.length);
      expect(new Set(report.boundaries.forB).size).toBe(report.boundaries.forB.length);
      expect(report.adviceForA).toHaveLength(3);
      expect(report.adviceForB).toHaveLength(3);
      expect(report.adviceForPair).toHaveLength(3);
      expect(report.misunderstandingsDetailed.length).toBeLessThanOrEqual(3);
      expect(report.misunderstandingsDetailed.every((item) => item.aInterpretation !== item.bInterpretation)).toBe(true);
      expect(report.conflictCycle.breakpoint.length).toBeGreaterThan(4);
      expect(report.dynamicScene.lines.length).toBeGreaterThan(1);
      expect(report.dynamicRoast).not.toMatch(/精神病|废物|垃圾|有病/);
      expect(report.finalSummary.length).toBeGreaterThanOrEqual(180);
      expect(report.finalSummary.length).toBeLessThanOrEqual(320);
      expect(report.finalSummary).not.toMatch(/关系分数|成立度|目前比较突出|从数据来看|从指标来看/);
      expect(report.relationshipCandidates[0]?.typeId).toBe(report.relationshipType);
      for (const item of report.dimensionComparison) {
        expect(item.aValue).toBeGreaterThanOrEqual(0);
        expect(item.bValue).toBeLessThanOrEqual(100);
        expect(item.importance).toBeGreaterThanOrEqual(0);
        expect(item.importance).toBeLessThanOrEqual(100);
      }
      for (const item of report.whoMore) {
        expect(item.aPercent).toBeGreaterThanOrEqual(0);
        expect(item.bPercent).toBeLessThanOrEqual(100);
      }
    }
    expect(similar.finalSummary).not.toBe(complement.finalSummary);
    expect(complement.dynamicRoast).not.toBe(conflict.dynamicRoast);
    expect(similar.strengths.map((item) => item.explanation).join()).not.toBe(conflict.strengths.map((item) => item.explanation).join());
    expect(similar.communicationScenarios.map((item) => item.title).join()).not.toBe(conflict.communicationScenarios.map((item) => item.title).join());
    expect(buildPairReportFromScores(similar.a.dimensionScores, similar.b.dimensionScores).finalSummary).toBe(similar.finalSummary);
  });

  it("uses different wording for eligible, borderline, and weak", () => {
    expect(wordingStrengthFor("eligible")).toBe("strong");
    expect(wordingStrengthFor("borderline")).toBe("moderate");
    expect(wordingStrengthFor("weak")).toBe("tentative");
    expect(indexLevel(39).label).toContain("偏低");
    expect(indexLevel(59).label).toBe("中等");
    expect(indexLevel(79).label).toBe("良好");
    expect(indexLevel(80).label).toBe("很高");
    const weak = buildPairReportFromScores(vector(50), vector(50));
    expect(weak.relationshipConfidence.wordingStrength).toBe("tentative");
    expect(weak.finalSummary).toContain("这还不是定论");
    expect(weak.finalSummary).not.toContain("很典型");
    expect(weak.finalSummary).not.toMatch(/关系分数|成立度/);
    const source = RELATIONSHIP_FIXTURES[0]!;
    let borderline: ReturnType<typeof buildPairReportFromScores> | undefined;
    for (const ratio of [0.35, 0.45, 0.55, 0.65, 0.75]) {
      const report = buildPairReportFromScores(blend(source.a, ratio), blend(source.b, ratio));
      if (report.relationshipConfidence.selectionTier === "borderline") borderline = report;
    }
    expect(borderline?.relationshipConfidence.wordingStrength).toBe("moderate");
    expect(borderline?.finalSummary).toContain("就你们现在的相处看");
    expect(borderline?.finalSummary).not.toMatch(/关系分数是|成立度是/);
    expect(borderline?.relationshipConfidence.reasons[0]?.text).toContain("比较明显");
    const matched = matchRelationship(source.a, source.b, computeIndices(source.a, source.b));
    const eligible = buildPairReportFromScores(source.a, source.b);
    expect(matched.candidates[0]?.tier).toBe("eligible");
    expect(eligible.relationshipConfidence.wordingStrength).toBe("strong");
    expect(eligible.finalSummary).not.toContain("很典型");
    expect(eligible.relationshipConfidence.reasons[0]?.text.startsWith("很典型")).toBe(true);
    expect(eligible.relationshipConfidence.reasons.every((item) => item.strength >= 60)).toBe(true);
  });

  it("keeps archive claims tied to real gaps", () => {
    const reports = [similar, complement, conflict];
    for (const report of reports) {
      expect(report.relationshipConfidence.reasons.every((item) => item.strength > 0 && item.strength <= 100)).toBe(true);
      if (report.relationshipConfidence.wordingStrength === "strong") {
        expect(report.relationshipConfidence.reasons.every((item) => item.strength >= 60)).toBe(true);
        expect(report.relationshipConfidence.reasons.every((item) => !item.text.startsWith("很典型") || item.strength >= 60)).toBe(true);
      }
      for (const item of [...report.similarities, ...report.differences, ...report.complements.aOffers, ...report.complements.bOffers]) {
        expect(item.strength).toBeGreaterThanOrEqual(0);
        expect(item.strength).toBeLessThanOrEqual(100);
      }
      for (const item of report.dimensionComparison) {
        expect(item.similarity).toBeGreaterThanOrEqual(0);
        expect(item.similarity).toBeLessThanOrEqual(100);
        expect(item.importance).toBeLessThanOrEqual(100);
      }
      expect(report.dynamicScene.lines.every((line) => !line.text.includes("指数") && !line.text.includes("我卡在"))).toBe(true);
      expect(report.dynamicScene.lines.every((line) => line.speaker !== "system")).toBe(true);
      expect(report.dynamicRoast).not.toContain("改快捷回复");
      expect(report.strengths.every((item) => !/不是突出|不能写成|只是数值接近|暂时不像/.test(item.explanation))).toBe(true);
    }
    expect(similar.differenceSummary).toContain("没有特别突出");
    expect(similar.differences.every((item) => Math.abs(item.aValue - item.bValue) >= 18)).toBe(true);
    expect(similar.conflictCycle.pattern).not.toBe("pursue-withdraw");
    expect(similar.complements.aOffers).toEqual([]);
    expect(similar.complements.bOffers).toEqual([]);
    expect(similar.finalSummary).not.toContain("追问带来沉默");
    expect(complement.adviceForA.join("")).not.toBe(complement.adviceForB.join(""));
    expect(conflict.adviceForA.join("")).not.toBe(conflict.adviceForB.join(""));
    expect(conflict.misunderstandingsDetailed.length).toBeGreaterThan(0);
    expect(new Set(reports.map((report) => report.dynamicRoast)).size).toBe(3);
    expect(conflict.dynamicRoast).not.toBe(similar.dynamicRoast);
  });

  it("keeps symmetric, severity, scenarios, and actions consistent", () => {
    const symmetricBlob = `${similar.risks.map((item) => item.mechanism).join("")}${similar.finalSummary}${similar.conflictCycle.loop}`;
    expect(symmetricBlob).not.toMatch(/一边用靠近|一边.{0,16}另一边/);
    expect(similar.differences).toHaveLength(0);
    expect(similar.conflictCycle.pattern).toBe("low-conflict");
    expect(similar.finalSummary).not.toMatch(/最大的不同|追问带来沉默|一个追/);
    expect(conflict.conflictCycle.pattern).toBe("pursue-withdraw");
    expect(conflict.risks.some((item) => item.severity !== "low")).toBe(true);
    const reply = conflict.communicationScenarios.find((item) => item.title === "消息暂时没回复");
    const fight = conflict.communicationScenarios.find((item) => item.title === "气氛不对需要谈一谈");
    expect(reply?.whySelected).toContain("已读乱想指数");
    expect(fight?.whySelected).toContain("吵架解决欲");
    expect(fight?.whySelected).toContain("冷静指数");
    expect(fight?.whySelected).toMatch(/缓冲|继续谈/);
    expect(fight?.whySelected).not.toMatch(/比较的是不同指标|不能说成两边接近/);
    expect(new Set(conflict.nextActions.map((item) => actionCategory(item))).size).toBe(3);
    expect(new Set(conflict.adviceForPair.map((item) => actionCategory(item))).size).toBe(conflict.adviceForPair.length);
    expect(new Set(similar.nextActions.map((item) => actionCategory(item))).size).toBe(similar.nextActions.length);
    for (const report of [similar, complement, conflict]) {
      expect(report.dynamicRoast).not.toMatch(/不算打平|当前支持度|A为|系统建议/);
      expect(report.nextActions).toHaveLength(3);
    }
    expect(buildPairReportFromScores(similar.a.dimensionScores, similar.b.dimensionScores).dynamicRoast).toBe(similar.dynamicRoast);
  });
});
