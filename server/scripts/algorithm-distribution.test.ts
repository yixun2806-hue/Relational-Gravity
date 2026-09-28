import { describe, expect, it } from "vitest";
import { runDistribution } from "./algorithm-distribution.js";

describe("algorithm distribution", () => {
  it("repeats a fixed seed exactly and keeps counts valid", () => {
    const input = { personalSamples: 500, pairSamples: 250, seed: 42 };
    const first = runDistribution(input);
    const second = runDistribution(input);
    expect(second).toEqual(first);
    expect(first.personalities.reduce((sum, row) => sum + row.count, 0)).toBe(500);
    expect(first.relationships.reduce((sum, row) => sum + row.count, 0)).toBe(250);
    expect(first.tiers.eligible + first.tiers.borderline + first.tiers.weak).toBe(250);
    expect(first.personalities.every((row) => Number.isFinite(row.percentage))).toBe(true);
    expect(first.relationships.every((row) => Number.isFinite(row.percentage))).toBe(true);
    expect(first.percentiles.score).toHaveLength(5);
    expect(first.percentiles.competitionScore).toHaveLength(5);
    expect(first.percentiles.margin).toHaveLength(5);
    expect(first.percentiles.evidenceStrength).toHaveLength(5);
    expect(first.failures).toEqual([]);
    expect(first.ok).toBe(true);
  });
});
