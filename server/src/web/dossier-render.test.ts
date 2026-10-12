import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function render(full: Record<string, unknown>, teaser: Record<string, unknown> = { relationshipName: "测试关系", relationshipCode: "01" }) {
  const source = readFileSync(new URL("../../web/assets/dossier.js", import.meta.url), "utf8");
  const window: { renderRelationshipDossier?: (report: unknown, preview: unknown) => string } = {};
  const runner = new Function("window", `${source}\nreturn window.renderRelationshipDossier;`);
  const renderRelationshipDossier = runner(window) as (report: unknown, preview: unknown) => string;
  return renderRelationshipDossier(full, teaser);
}

function renderCard(full: Record<string, unknown>, teaser: Record<string, unknown> = { relationshipName: "测试关系", relationshipCode: "01" }) {
  const source = readFileSync(new URL("../../web/assets/dossier.js", import.meta.url), "utf8");
  const window: { buildRelationshipCard?: (report: unknown, preview: unknown) => string } = {};
  const runner = new Function("window", `${source}\nreturn window.buildRelationshipCard;`);
  const buildRelationshipCard = runner(window) as (report: unknown, preview: unknown) => string;
  return buildRelationshipCard(full, teaser);
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

  it("softens stored typos and the closing title without rewriting source data", () => {
    const html = render({
      ...base,
      finalSummary: "连体婴文学成立。请给水壶一点独处时间。",
      subtitle: "连体婴文学",
    }, { relationshipName: "高陪伴 × 高陪伴", relationshipCode: "23", subtitle: "连体婴文学" });
    expect(html).toContain("想留给你们的话");
    expect(html).toContain("你们最容易同频的地方");
    expect(html).toContain("你们最容易拉开距离的地方");
    expect(html).toContain("有些话，其实可以这样说");
    expect(html).toContain("太习惯黏在一起");
    expect(html).not.toContain("连体婴文学");
    expect(html).not.toContain("写在这份档案最后");
  });

  it("shows an empty reason list instead of padding with zero evidence", () => {
    const html = render({
      ...base,
      relationshipConfidence: { wordingStrength: "tentative", typicality: 10, reasons: [{ text: "无效", strength: 0 }] },
    });
    expect(html).not.toContain("支持度 0%");
    expect(html).not.toContain("无效");
  });

  it("fills the share card with existing report copy and metric bars", () => {
    const html = renderCard({
      ...base,
      finalSummary: "第一段关系说明。\n\n第二段优势。",
      nextActions: [],
      adviceForPair: ["想对方的时候，直接说出来。"],
    }, {
      relationshipName: "关系项目经理 × 快乐摸鱼王",
      relationshipCode: "12",
      tagline: "一个负责推进，一个负责松弛。",
    });
    expect(html).toContain("关于你们");
    expect(html).toContain("适合你们的小提醒");
    expect(html).toContain("想对方的时候，直接说出来。");
    expect(html).toContain("一个负责推进，一个负责松弛。");
    expect(html.match(/class="rel-meter"/g)).toHaveLength(4);
  });

  it("lets large report sections paginate while protecting their child cards", () => {
    const css = readFileSync(new URL("../../web/assets/dossier.css", import.meta.url), "utf8");
    const printCss = css.slice(css.indexOf("@media print"));
    expect(printCss).not.toMatch(/\.dos-sheet[^{]*\{[^}]*break-inside\s*:\s*avoid/s);
    expect(printCss).toMatch(/\.dos-file[^{]*\{[^}]*break-inside\s*:\s*avoid/s);
    expect(printCss).toMatch(/\.dos-sheet\s*>\s*h2[^{]*\{[^}]*break-after\s*:\s*avoid(?:[;}])/s);
    expect(printCss).toMatch(/html,body[^{]*\{[^}]*min-height\s*:\s*0!important/s);
    expect(printCss).toMatch(/main[^{]*\{[^}]*padding\s*:\s*0!important/s);
  });
});
