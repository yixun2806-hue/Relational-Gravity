import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function render(full: Record<string, unknown>, teaser: Record<string, unknown> = { relationshipName: "测试关系", relationshipCode: "01" }) {
  const source = readFileSync(new URL("../../web/assets/dossier.js", import.meta.url), "utf8");
  const window: { renderRelationshipDossier?: (report: unknown, preview: unknown) => string } = {};
  const runner = new Function("window", `${source}\nreturn window.renderRelationshipDossier;`);
  const renderRelationshipDossier = runner(window) as (report: unknown, preview: unknown) => string;
  return renderRelationshipDossier(full, teaser);
}

const base = {
  you: { typeName: "你型", tagline: "一句", summary: "你的说明" },
  ta: { typeName: "对方型", tagline: "一句", summary: "对方的说明" },
  indices: { rapport: 70, communication: 60, security: 55, stability: 50 },
  indicesDetailed: [],
  dimensionComparison: [],
  whoMore: [],
  communicationScenarios: [],
  nextActions: ["一件", "两件", "三件"],
  dynamicScene: { title: "场面", lines: [], punchline: "" },
  complements: { youOffer: [], taOffer: [] },
  conflictCycle: { pattern: "low-conflict", triggers: [], breakpoint: "停一下", repairPlan: "说清楚" },
  boundaries: { forYou: [], forTa: [] },
  relationshipConfidence: {
    wordingStrength: "moderate",
    typicality: 42,
    reasons: [{ text: "这条理由成立", strength: 62 }],
  },
  relationshipEvidence: [{ text: "这条不该出现", strength: 0 }],
};

describe("dossier renderer", () => {
  it("does not present zero-strength evidence as a reason", () => {
    const html = render(base);
    expect(html).toContain("支持度 62%");
    expect(html).not.toContain("支持度 0%");
    expect(html).not.toContain("这条不该出现");
  });

  it("shows an empty reason list instead of padding with zero evidence", () => {
    const html = render({
      ...base,
      relationshipConfidence: { wordingStrength: "tentative", typicality: 10, reasons: [{ text: "无效", strength: 0 }] },
    });
    expect(html).not.toContain("支持度 0%");
    expect(html).not.toContain("无效");
  });
});
