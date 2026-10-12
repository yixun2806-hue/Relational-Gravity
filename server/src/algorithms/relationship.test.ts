import { describe, expect, it } from "vitest";
import { RELATIONSHIP_TYPES } from "../content/relationships.js";
import { QUESTIONS, type OptionKey } from "../content/questions.js";
import { EMPTY_SCORES, type DimensionScores } from "../domain/dimensions.js";
import { RELATIONSHIP_FIXTURES } from "./fixtures.js";
import { computeIndices } from "./indices.js";
import { MIN_ANCHOR_STRENGTH, blendRelationshipScore, matchRelationship, rankRelationshipCandidates, relationshipCompetition } from "./relationship.js";
import { scoreAnswers } from "./scoring.js";

const match = (a: DimensionScores, b: DimensionScores) => matchRelationship(a, b, computeIndices(a, b));
const rank = (a: DimensionScores, b: DimensionScores) => rankRelationshipCandidates(a, b, computeIndices(a, b));
const neutral = (patch: Partial<DimensionScores> = {}): DimensionScores => ({
  ...EMPTY_SCORES,
  ...Object.fromEntries(Object.keys(EMPTY_SCORES).map((key) => [key, 50])),
  ...patch,
}) as DimensionScores;

describe("relationship V2 reachability", () => {
  it("defines one independent fixture for every relationship type", () => {
    expect(new Set(RELATIONSHIP_FIXTURES.map((item) => item.typeId))).toEqual(
      new Set(RELATIONSHIP_TYPES.map((item) => item.id)),
    );
    expect(MIN_ANCHOR_STRENGTH).toBe(35);
  });

  it.each(RELATIONSHIP_FIXTURES)("reaches $typeId with evidence", ({ typeId, a, b }) => {
    const result = match(a, b);
    expect(result.type.id).toBe(typeId);
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates[0]?.typeId).toBe(typeId);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.evidence.length).toBeGreaterThanOrEqual(3);
    expect(result.evidence.length).toBeLessThanOrEqual(5);
  });
});

describe("relationship symmetry", () => {
  it.each(RELATIONSHIP_FIXTURES)("keeps the full Top3 stable for $typeId", ({ a, b }) => {
    const forward = match(a, b);
    const reverse = match(b, a);
    expect(reverse.candidates.map((item) => item.typeId)).toEqual(forward.candidates.map((item) => item.typeId));
    reverse.candidates.forEach((candidate, index) => {
      const original = forward.candidates[index];
      expect(candidate.score).toBe(original?.score);
      expect(candidate.eligibility).toBe(original?.eligibility);
      expect(candidate.roles.a).toBe(original?.roles.b);
      expect(candidate.roles.b).toBe(original?.roles.a);
      expect(candidate.evidence.map((item) => item.role).sort()).toEqual(
        original?.evidence.map((item) => item.role === "a" ? "b" : item.role === "b" ? "a" : "pair").sort(),
      );
    });
  });

  it("uses neutral roles for identical vectors", () => {
    const same = { ...EMPTY_SCORES, communication: 50, independence: 50, companionship: 50 };
    const result = match(same, same);
    expect(result.candidates.every((item) => item.orientation === "symmetric")).toBe(true);
  });
});

describe("eligibility anchors and extremes", () => {
  it("requires both people for both-high relationships", () => {
    const bothIndependent = { ...EMPTY_SCORES, independence: 95, boundary: 95, companionship: 10 };
    const ordinary = { ...EMPTY_SCORES, independence: 45, boundary: 45, companionship: 50 };
    expect(match(bothIndependent, bothIndependent).candidates.find((item) => item.typeId === "independent_independent")?.tier).toBe("eligible");
    expect(match(bothIndependent, ordinary).candidates.find((item) => item.typeId === "independent_independent")?.tier).not.toBe("eligible");

    const bothTogether = { ...EMPTY_SCORES, companionship: 95, dependency: 90, independence: 10 };
    expect(match(bothTogether, bothTogether).candidates.find((item) => item.typeId === "together_together")?.tier).toBe("eligible");
    expect(match(bothTogether, ordinary).candidates.find((item) => item.typeId === "together_together")?.tier).not.toBe("eligible");
  });

  it("does not make a directional difference type eligible for identical neutral vectors", () => {
    const same = { ...EMPTY_SCORES, ...Object.fromEntries(Object.keys(EMPTY_SCORES).map((key) => [key, 50])) } as DimensionScores;
    const directional = new Set(RELATIONSHIP_TYPES.slice(0, 13).map((item) => item.id));
    directional.add("rumination_comfort");
    directional.add("hesitate_decide");
    directional.add("grudge_forget");
    directional.add("talk_now_later");
    directional.add("sensitive_stable");
    expect(match(same, same).candidates.filter((item) => item.tier === "eligible").every((item) => !directional.has(item.typeId))).toBe(true);
  });

  it.each([0, 25, 50, 75, 100])("is stable for identical %i vectors", (value) => {
    const vector = Object.fromEntries(Object.keys(EMPTY_SCORES).map((key) => [key, value])) as DimensionScores;
    const result = match(vector, vector);
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates.every((item) => item.orientation === "symmetric")).toBe(true);
    expect(result.candidates.every((item) => Number.isInteger(item.score) && Number.isInteger(item.eligibility))).toBe(true);
  });

  it("keeps opposite extreme vectors invariant when swapped", () => {
    const low = Object.fromEntries(Object.keys(EMPTY_SCORES).map((key) => [key, 0])) as DimensionScores;
    const high = Object.fromEntries(Object.keys(EMPTY_SCORES).map((key) => [key, 100])) as DimensionScores;
    expect(match(low, high).candidates.map((item) => item.typeId)).toEqual(match(high, low).candidates.map((item) => item.typeId));
  });

  it.each(["A", "B", "C", "D"] as OptionKey[])("is deterministic for all-%s answer extremes", (optionKey) => {
    const vector = scoreAnswers(QUESTIONS.map((question) => ({ questionId: question.id, optionKey })));
    const first = match(vector, vector);
    const second = match(vector, vector);
    expect(second.candidates).toEqual(first.candidates);
    expect(first.candidates.every((item) => item.orientation === "symmetric")).toBe(true);
  });

  it.each([
    "independent_independent",
    "together_together",
    "ice_ice",
    "abstract_abstract",
    "sensitive_stable",
    "detective_missing",
    "talk_now_later",
  ])("selects the intended semantic extreme for %s", (typeId) => {
    const fixture = RELATIONSHIP_FIXTURES.find((item) => item.typeId === typeId);
    expect(fixture).toBeDefined();
    expect(match(fixture!.a, fixture!.b).type.id).toBe(typeId);
  });

  it("keeps major complements out of formal eligibility when an anchor is absent", () => {
    const noExpressionGapA = { ...EMPTY_SCORES, independence: 92, rationality: 90, emotionExpression: 50 };
    const noExpressionGapB = { ...EMPTY_SCORES, companionship: 92, emotionExpression: 50 };
    const candidate = match(noExpressionGapA, noExpressionGapB).candidates.find((item) => item.typeId === "iceberg_sun");
    expect(candidate?.eligible ?? false).toBe(false);
  });

  it("keeps a moderate dominance gap from becoming a typical hesitate match", () => {
    const mild = rank(neutral({ dominance: 60 }), neutral({ dominance: 45 }))
      .find((item) => item.typeId === "hesitate_decide");
    const strong = rank(neutral({ dominance: 30 }), neutral({ dominance: 75 }))
      .find((item) => item.typeId === "hesitate_decide");
    expect(mild?.tier).toBe("weak");
    expect(mild?.score ?? 100).toBeLessThan(40);
    expect(strong?.tier).toBe("eligible");
    expect(strong?.score ?? 0).toBeGreaterThanOrEqual(50);
    expect((strong?.score ?? 0) - (mild?.score ?? 0)).toBeGreaterThan(30);
  });

  it("does not add an orientation bonus on top of the winning direction", () => {
    const low = neutral({ dominance: 20 });
    const high = neutral({ dominance: 80 });
    const forward = rank(low, high).find((item) => item.typeId === "hesitate_decide");
    const reverse = rank(high, low).find((item) => item.typeId === "hesitate_decide");
    const symmetric = rank(
      neutral({ novelty: 80, abstract: 80 }),
      neutral({ novelty: 80, abstract: 80 }),
    ).find((item) => item.typeId === "spotlight_spotlight");
    expect(forward?.score).toBe(70);
    expect(reverse?.score).toBe(forward?.score);
    expect(reverse?.eligibility).toBe(forward?.eligibility);
    expect(forward?.roles).toEqual({ a: "纠结王", b: "决策王" });
    expect(reverse?.roles).toEqual({ a: "决策王", b: "纠结王" });
    expect(symmetric?.score).toBe(85);
    expect(forward?.score ?? 100).toBeLessThanOrEqual(symmetric?.score ?? 0);
    expect(blendRelationshipScore(70, 100) - blendRelationshipScore(70, 0)).toBeCloseTo(30);
  });

  it("lets a strong borderline outrank a barely eligible candidate", () => {
    const pair = [
      neutral({ abstract: 68, novelty: 64, communication: 96 }),
      neutral({ abstract: 68, novelty: 64, communication: 96 }),
    ] as const;
    const ranked = rank(pair[0], pair[1]);
    const spotlight = ranked.find((item) => item.typeId === "spotlight_spotlight");
    const abstract = ranked.find((item) => item.typeId === "abstract_abstract");
    expect(spotlight?.tier).toBe("borderline");
    expect(abstract?.tier).toBe("eligible");
    expect(spotlight?.competitionScore ?? 0).toBeGreaterThan(abstract?.competitionScore ?? 0);
    expect(ranked.findIndex((item) => item.typeId === "spotlight_spotlight"))
      .toBeLessThan(ranked.findIndex((item) => item.typeId === "abstract_abstract"));
    expect(relationshipCompetition(50, 58, "eligible")).toBeLessThan(relationshipCompetition(72, 56, "borderline"));
    expect(relationshipCompetition(55, 35, "weak")).toBeLessThan(relationshipCompetition(48, 42, "borderline"));
  });

  it("does not let support alone establish a both-high relationship", () => {
    const loud = neutral({ communication: 96 });
    const spotlight = rank(loud, loud).find((item) => item.typeId === "spotlight_spotlight");
    expect(spotlight?.tier).not.toBe("eligible");
    expect(spotlight?.eligible).toBe(false);
  });

  it("keeps Top3 invariant across deterministic general samples", () => {
    let state = 0x5eed1234;
    const next = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    };
    for (let sample = 0; sample < 40; sample += 1) {
      const a = Object.fromEntries(Object.keys(EMPTY_SCORES).map((key) => [key, next() * 100])) as DimensionScores;
      const b = Object.fromEntries(Object.keys(EMPTY_SCORES).map((key) => [key, next() * 100])) as DimensionScores;
      const forward = match(a, b);
      const reverse = match(b, a);
      expect(reverse.candidates.map((item) => item.typeId)).toEqual(forward.candidates.map((item) => item.typeId));
      expect(reverse.candidates.map((item) => item.score)).toEqual(forward.candidates.map((item) => item.score));
      expect(reverse.candidates.map((item) => item.eligibility)).toEqual(forward.candidates.map((item) => item.eligibility));
    }
  });
});
