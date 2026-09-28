import { QUESTIONS, type OptionKey } from "../content/questions.js";
import {
  DIMENSION_KEYS,
  EMPTY_SCORES,
  addDelta,
  clamp100,
  type DimensionScores,
  type DimKey,
} from "../domain/dimensions.js";

export { clamp100 };

export function clampFloat100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function matchHigh(value: number, start = 50, full = 80): number {
  if (full <= start) return value >= full ? 100 : 0;
  return clampFloat100(((value - start) / (full - start)) * 100);
}

export function matchLow(value: number, start = 50, full = 20): number {
  return matchHigh(100 - value, 100 - start, 100 - full);
}

export function matchSimilar(a: number, b: number, tolerance = 10, maxGap = 55): number {
  if (maxGap <= tolerance) return Math.abs(a - b) <= tolerance ? 100 : 0;
  return clampFloat100(((maxGap - Math.abs(a - b)) / (maxGap - tolerance)) * 100);
}

export function matchDifferent(a: number, b: number, start = 15, full = 55): number {
  if (full <= start) return Math.abs(a - b) >= full ? 100 : 0;
  return clampFloat100(((Math.abs(a - b) - start) / (full - start)) * 100);
}

export function weightedMean(parts: ReadonlyArray<{ value: number; weight: number }>): number {
  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  if (totalWeight <= 0) return 0;
  return clampFloat100(parts.reduce((sum, part) => sum + part.value * part.weight, 0) / totalWeight);
}

export function compareDimensionFingerprint(a: DimensionScores, b: DimensionScores): number {
  for (const key of DIMENSION_KEYS) {
    if (a[key] < b[key]) return -1;
    if (a[key] > b[key]) return 1;
  }
  return 0;
}

export interface AnswerInput {
  questionId: string;
  optionKey: OptionKey;
}

function rangeForDimension(key: DimKey): { min: number; max: number } {
  let min = 0;
  let max = 0;
  for (const question of QUESTIONS) {
    const values = question.options.map((option) => option.scores[key] ?? 0);
    min += Math.min(...values);
    max += Math.max(...values);
  }
  return { min, max };
}

const RANGES: Record<DimKey, { min: number; max: number }> = DIMENSION_KEYS.reduce(
  (acc, key) => {
    acc[key] = rangeForDimension(key);
    return acc;
  },
  {} as Record<DimKey, { min: number; max: number }>,
);

const EXPECTED_RAW: Record<DimKey, number> = DIMENSION_KEYS.reduce(
  (acc, key) => {
    acc[key] = QUESTIONS.reduce(
      (sum, question) => sum + question.options.reduce((optionSum, option) => optionSum + (option.scores[key] ?? 0), 0) / question.options.length,
      0,
    );
    return acc;
  },
  {} as Record<DimKey, number>,
);

function centerAtNeutral(value: number, neutral: number): number {
  if (value <= neutral) return neutral <= 0 ? 0 : value / neutral * 50;
  return neutral >= 100 ? 100 : 50 + (value - neutral) / (100 - neutral) * 50;
}

export function scoreAnswers(answers: AnswerInput[]): DimensionScores {
  let raw = { ...EMPTY_SCORES };
  const byId = new Map(QUESTIONS.map((q) => [q.id, q]));

  for (const answer of answers) {
    const question = byId.get(answer.questionId);
    if (!question) continue;
    const option = question.options.find((item) => item.key === answer.optionKey);
    if (!option) continue;
    raw = addDelta(raw, option.scores);
  }

  const normalized = { ...EMPTY_SCORES };
  for (const key of DIMENSION_KEYS) {
    const { min, max } = RANGES[key];
    const span = Math.max(1, max - min);
    const value = ((raw[key] - min) / span) * 100;
    const neutral = ((EXPECTED_RAW[key] - min) / span) * 100;
    normalized[key] = clamp100(centerAtNeutral(value, neutral));
  }
  return normalized;
}

export function resonance(a: number, b: number): number {
  return clamp100(100 - Math.abs(a - b));
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

export function gap(a: number, b: number): number {
  return Math.abs(a - b);
}

export function highLowPair(a: number, b: number, high = 62, low = 42): boolean {
  return (a >= high && b <= low) || (b >= high && a <= low);
}

export function bothHigh(a: number, b: number, threshold = 68): boolean {
  return a >= threshold && b >= threshold;
}

export function bothLow(a: number, b: number, threshold = 38): boolean {
  return a <= threshold && b <= threshold;
}

export function euclideanDistance(a: DimensionScores, b: DimensionScores): number {
  let sum = 0;
  for (const key of DIMENSION_KEYS) {
    const d = a[key] - b[key];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function similarityFromDistance(distance: number): number {
  const max = Math.sqrt(DIMENSION_KEYS.length * 100 * 100);
  return clamp100((1 - distance / max) * 100);
}
