import { describe, expect, it } from "vitest";
import { QUESTIONS } from "../content/questions.js";
import { PERSONALITY_TYPES } from "../content/personalities.js";
import { RELATIONSHIP_TYPES } from "../content/relationships.js";
import { buildPairReport, buildPersonalHighlights, buildPersonalResult, readReportVersion, teaserOf } from "./compose.js";
import { computeIndices } from "./indices.js";
import { matchRelationship } from "./relationship.js";
import { generateInviteCode, isInviteCode } from "../utils/crypto.js";
import type { OptionKey } from "../content/questions.js";
import { DIMENSION_KEYS } from "../domain/dimensions.js";

function answers(pattern: OptionKey[]) {
  return QUESTIONS.map((q, i) => ({
    questionId: q.id,
    optionKey: pattern[i % pattern.length],
  }));
}

describe("invite code", () => {
  it("generates a 24-character URL-safe token", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(24);
    expect(code).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(isInviteCode(code)).toBe(true);
    expect(isInviteCode("1234")).toBe(false);
    expect(isInviteCode("invalid token")).toBe(false);
    expect(isInviteCode("abc")).toBe(false);
    expect(isInviteCode("token+with/extra=")).toBe(false);
  });
});

describe("scoring", () => {
  it("covers 16 dimensions with 30 questions", () => {
    expect(QUESTIONS).toHaveLength(30);
    expect(PERSONALITY_TYPES).toHaveLength(16);
    expect(RELATIONSHIP_TYPES).toHaveLength(24);
    expect(DIMENSION_KEYS).toHaveLength(16);
  });

  it("produces different personalities for different answer patterns", () => {
    const cat = buildPersonalResult(answers(["A"]));
    const dog = buildPersonalResult(answers(["D"]));
    expect(JSON.stringify(cat.dimensionScores)).not.toBe(JSON.stringify(dog.dimensionScores));
    for (const key of DIMENSION_KEYS) {
      expect(cat.dimensionScores[key]).toBeGreaterThanOrEqual(0);
      expect(cat.dimensionScores[key]).toBeLessThanOrEqual(100);
    }
  });

  it("does not map two personalities to a fixed relationship by name only", () => {
    const pair1 = buildPairReport(answers(["A"]), answers(["D"]));
    const pair2 = buildPairReport(answers(["B", "C"]), answers(["A", "D", "C"]));
    expect(pair1.relationshipName.length).toBeGreaterThan(0);
    expect(pair1.indices.rapport).toBeGreaterThanOrEqual(0);
    expect(pair1.whoMore.length).toBeGreaterThan(5);
    expect(pair1.scene.lines.length).toBeGreaterThan(2);
    expect(pair1.advice.length).toBeGreaterThan(0);
    expect(`${pair1.relationshipType}:${pair2.relationshipType}`.length).toBeGreaterThan(3);
  });

  it("uses TA-neutral copy", () => {
    const report = buildPairReport(answers(["A"]), answers(["C"]));
    const blob = `${report.roast} ${report.advice.join(" ")} ${report.tagline}`;
    expect(blob).not.toMatch(/对象|恋爱|情侣/);
  });

  it("builds answer-dependent paid report details", () => {
    const report = buildPairReport(answers(["A"]), answers(["D"]));
    const differentReport = buildPairReport(answers(["B", "C"]), answers(["A", "C", "D"]));
    expect(report.misunderstandings).toHaveLength(3);
    expect(report.misunderstandings[0]?.aView.length).toBeGreaterThan(10);
    expect(report.conflictPattern.repair.length).toBeGreaterThan(10);
    expect(report.communicationGuide).toHaveLength(3);
    expect(JSON.stringify(report.misunderstandings)).not.toBe(JSON.stringify(differentReport.misunderstandings));
  });

  it("returns three useful personal highlights immediately", () => {
    const personal = buildPersonalResult(answers(["A"]));
    const highlights = buildPersonalHighlights(personal.dimensionScores);
    expect(highlights).toHaveLength(3);
    expect(new Set(highlights.map((item) => item.id)).size).toBe(3);
    expect(highlights.every((item) => item.description.length > 10)).toBe(true);
  });

  it("writes V2 candidates from the matcher without rescaling", () => {
    const aAnswers = answers(["A"]);
    const bAnswers = answers(["D"]);
    const report = buildPairReport(aAnswers, bAnswers);
    const matched = matchRelationship(
      report.a.dimensionScores,
      report.b.dimensionScores,
      computeIndices(report.a.dimensionScores, report.b.dimensionScores),
    );
    expect(report.reportVersion).toBe(2);
    expect(readReportVersion(report)).toEqual({ kind: "v2", version: 2 });
    expect(report.relationshipCandidates).toHaveLength(3);
    expect(report.relationshipCandidates[0]?.typeId).toBe(report.relationshipType);
    expect(report.relationshipCandidates).toEqual(matched.candidates);
    expect(report.relationshipEvidence).toEqual(matched.evidence);
    expect(report.relationshipEvidence.length).toBeGreaterThanOrEqual(3);
    expect(report.relationshipEvidence.length).toBeLessThanOrEqual(5);
    expect(report.indices.rapport).toBeGreaterThanOrEqual(0);
    expect(report.whoMore).toHaveLength(9);
    expect(report.scene.lines.length).toBeGreaterThan(2);
    expect(report.advice.length).toBeGreaterThan(0);
  });

  it("reads missing, v1, v2, and future report versions", () => {
    expect(readReportVersion({})).toEqual({ kind: "v1", version: 1 });
    expect(readReportVersion({ reportVersion: 1 })).toEqual({ kind: "v1", version: 1 });
    expect(readReportVersion({ reportVersion: 2 })).toEqual({ kind: "v2", version: 2 });
    expect(readReportVersion({ reportVersion: 3 })).toEqual({ kind: "unsupported", version: 3 });
    expect(readReportVersion({ reportVersion: "2" }).kind).toBe("invalid");
  });

  it("teaser keeps base indices and hides full-report fields", () => {
    const report = buildPairReport(answers(["A"]), answers(["D"]));
    const teaser = teaserOf(report);
    expect(teaser.rapport).toBeGreaterThanOrEqual(0);
    expect(teaser.companionship).toBeGreaterThanOrEqual(0);
    expect(teaser.spark).toBeGreaterThanOrEqual(0);
    expect(teaser.security).toBeGreaterThanOrEqual(0);
    expect(teaser.abstract).toBeGreaterThanOrEqual(0);
    expect(teaser).not.toHaveProperty("roast");
    expect(teaser).not.toHaveProperty("whoMore");
    expect(teaser).not.toHaveProperty("advice");
    expect(teaser).not.toHaveProperty("scene");
    expect(teaser).not.toHaveProperty("freedom");
  });
});
