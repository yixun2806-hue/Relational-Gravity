import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RELATIONSHIP_TYPES } from "../content/relationships.js";
import { buildPairReportFromScores } from "./compose.js";
import { RELATIONSHIP_FIXTURES } from "./fixtures.js";
import { mapFull } from "../services/test-service.js";

const NAMES = [
  "冰山 × 小太阳",
  "嘴硬 × 心软",
  "猫 × 狗",
  "计划 × 随缘",
  "侦探 × 失踪人口",
  "黏人 × 自由",
  "理性 × 感性",
  "主动 × 被动",
  "社牛 × 社恐",
  "显眼包 × 低调王",
  "情绪雷达 × 情绪木头",
  "关系项目经理 × 快乐摸鱼王",
  "火药桶 × 灭火器",
  "冰山 × 冰山",
  "小太阳 × 小太阳",
  "显眼包 × 显眼包",
  "内耗王 × 安抚王",
  "纠结王 × 决策王",
  "记仇王 × 转头忘",
  "主动沟通 × 冷处理",
  "高敏感 × 高稳定",
  "高独立 × 高独立",
  "高陪伴 × 高陪伴",
  "高抽象 × 高抽象",
];

const BANNED = [
  "连体婴文学",
  "关系分数是",
  "成立度是",
  "目前比较突出",
  "从数据来看",
  "从指标来看",
  "综合来看",
  "总体来说",
  "建议双方",
  "relationshipEvidence",
  "eligibility",
  "rawScore",
  "competitionScore",
  "reportVersion",
  "A viewer",
  "B viewer",
  "Pro Max",
  "梗密度",
  "快捷回复",
  "平行宇宙",
  "清缓存",
];

function render(full: Record<string, unknown>, teaser: Record<string, unknown>) {
  const source = readFileSync(new URL("../../web/assets/dossier.js", import.meta.url), "utf8");
  const window: { renderRelationshipDossier?: (report: unknown, preview: unknown) => string } = {};
  const runner = new Function("window", `${source}\nreturn window.renderRelationshipDossier;`);
  const renderRelationshipDossier = runner(window) as (report: unknown, preview: unknown) => string;
  return renderRelationshipDossier(full, teaser);
}

describe("relationship copy", () => {
  it("keeps the 24 relationship names and drops known bad phrases", () => {
    expect(RELATIONSHIP_TYPES.map((item) => item.name)).toEqual(NAMES);
    expect(RELATIONSHIP_FIXTURES).toHaveLength(24);
    const summaries: string[] = [];
    for (const fixture of RELATIONSHIP_FIXTURES) {
      const report = buildPairReportFromScores(fixture.a, fixture.b);
      expect(report.relationshipType).toBe(fixture.typeId);
      expect(report.finalSummary.length).toBeGreaterThanOrEqual(180);
      expect(report.finalSummary.length).toBeLessThanOrEqual(320);
      expect(report.finalSummary).not.toMatch(/关系分数|成立度/);
      expect(report.dynamicRoast).not.toMatch(/文学|连体婴/);
      const blob = [
        report.subtitle,
        report.tagline,
        report.summary,
        report.roast,
        report.scene.punchline,
        report.dynamicRoast,
        report.finalSummary,
        ...report.advice,
      ].join("\n");
      for (const phrase of BANNED) expect(blob, report.relationshipName).not.toContain(phrase);
      const view = mapFull(report, true);
      const html = render(view as unknown as Record<string, unknown>, {
        relationshipName: report.relationshipName,
        relationshipCode: report.relationshipCode,
        subtitle: report.subtitle,
        tagline: report.tagline,
      });
      for (const phrase of BANNED) expect(html, report.relationshipName).not.toContain(phrase);
      expect(html).toContain("想留给你们的话");
      summaries.push(report.finalSummary);
    }
    expect(new Set(summaries).size).toBe(24);
  });

  it("does not reuse one closing across the sampled relationships", () => {
    const ids = ["together_together", "independent_independent", "talk_now_later", "rational_emotional", "iceberg_sun", "cat_dog"];
    const summaries = ids.map((id) => {
      const fixture = RELATIONSHIP_FIXTURES.find((item) => item.typeId === id)!;
      return buildPairReportFromScores(fixture.a, fixture.b).finalSummary;
    });
    const openings = summaries.map((text) => text.slice(0, 16));
    const seconds = summaries.map((text) => text.split("\n\n")[1]);
    const endings = summaries.map((text) => text.slice(-16));
    expect(new Set(openings).size).toBe(ids.length);
    expect(new Set(seconds).size).toBe(ids.length);
    expect(new Set(endings).size).toBe(ids.length);
  });
});
