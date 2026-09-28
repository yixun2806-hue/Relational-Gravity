import { describe, expect, it } from "vitest";
import { EMPTY_SCORES } from "../domain/dimensions.js";
import {
  clampFloat100,
  compareDimensionFingerprint,
  matchDifferent,
  matchHigh,
  matchLow,
  matchSimilar,
  weightedMean,
} from "./scoring.js";

describe("normalized scoring primitives", () => {
  it("maps high, low, similar and different evidence to 0..100 without early rounding", () => {
    expect(matchHigh(50)).toBe(0);
    expect(matchHigh(80)).toBe(100);
    expect(matchHigh(65)).toBe(50);
    expect(matchHigh(60.25)).toBeCloseTo(34.166666, 5);
    expect(matchLow(50)).toBe(0);
    expect(matchLow(20)).toBe(100);
    expect(matchSimilar(60, 65)).toBe(100);
    expect(matchSimilar(10, 90)).toBe(0);
    expect(matchDifferent(10, 10)).toBe(0);
    expect(matchDifferent(10, 80)).toBe(100);
    expect(weightedMean([{ value: 100, weight: 3 }, { value: 0, weight: 1 }])).toBe(75);
  });

  it("keeps every primitive in range and symmetric where required", () => {
    for (let a = 0; a <= 100; a += 5) {
      expect(matchHigh(a)).toBeGreaterThanOrEqual(0);
      expect(matchHigh(a)).toBeLessThanOrEqual(100);
      expect(matchLow(a)).toBeGreaterThanOrEqual(0);
      expect(matchLow(a)).toBeLessThanOrEqual(100);
      for (let b = 0; b <= 100; b += 5) {
        expect(matchSimilar(a, b)).toBe(matchSimilar(b, a));
        expect(matchDifferent(a, b)).toBe(matchDifferent(b, a));
      }
    }
    expect(clampFloat100(101.4)).toBe(100);
    expect(clampFloat100(-0.4)).toBe(0);
    expect(clampFloat100(42.75)).toBe(42.75);
    expect(weightedMean([])).toBe(0);
  });

  it("compares dimension fingerprints independently of argument position", () => {
    const low = { ...EMPTY_SCORES, communication: 20 };
    const high = { ...EMPTY_SCORES, communication: 80 };
    expect(compareDimensionFingerprint(low, high)).toBe(-1);
    expect(compareDimensionFingerprint(high, low)).toBe(1);
    expect(compareDimensionFingerprint(low, { ...low })).toBe(0);
  });
});
