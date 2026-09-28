import type { DimensionScores } from "../domain/dimensions.js";
import { clamp100, mean, resonance, gap, highLowPair, bothHigh, bothLow } from "./scoring.js";

export interface RelationshipIndices {
  rapport: number;
  companionship: number;
  communication: number;
  security: number;
  freedom: number;
  spark: number;
  stability: number;
  abstract: number;
}

export function computeIndices(a: DimensionScores, b: DimensionScores): RelationshipIndices {
  const rapport = clamp100(
    mean([
      resonance(a.communication, b.communication),
      resonance(a.investment, b.investment),
      resonance(a.rationality, b.rationality),
      100 - conflictRisk(a, b) * 0.7,
    ]),
  );

  const companionshipNeedGap = gap(a.companionship, b.companionship);
  const meetNeed =
    100 -
    Math.max(0, a.companionship - (100 - b.independence)) * 0.45 -
    Math.max(0, b.companionship - (100 - a.independence)) * 0.45;
  const companionship = clamp100(
    mean([
      bothHigh(a.companionship, b.companionship) ? 88 : 70 - companionshipNeedGap * 0.35,
      meetNeed,
      resonance(a.dependency, b.dependency) * 0.6 + 20,
    ]),
  );

  const communication = clamp100(
    mean([
      resonance(a.communication, b.communication),
      resonance(a.emotionExpression, b.emotionExpression),
      100 - gap(a.replySensitivity, b.emotionExpression) * 0.5,
    ]),
  );

  const security = clamp100(
    mean([
      100 - conflictRisk(a, b),
      100 - Math.max(0, a.securityNeed - b.investment) * 0.6,
      100 - Math.max(0, b.securityNeed - a.investment) * 0.6,
      resonance(a.securityNeed, b.securityNeed) * 0.4 + 40,
    ]),
  );

  const freedom = clamp100(
    mean([
      resonance(a.boundary, b.boundary),
      bothHigh(a.independence, b.independence) ? 86 : highLowPair(a.independence, b.companionship) ? 62 : 70,
      100 - Math.max(0, a.independence - (100 - b.companionship)) * 0.3,
    ]),
  );

  const spark = clamp100(
    mean([
      (a.novelty + b.novelty) / 2,
      (a.abstract + b.abstract) / 2,
      (a.investment + b.investment) / 2 * 0.7 + 15,
    ]),
  );

  const stability = clamp100(
    mean([
      100 - conflictRisk(a, b),
      (a.rationality + b.rationality) / 2,
      100 - gap(a.novelty, b.novelty) * 0.4,
      bothLow(a.conflictInitiative, b.conflictInitiative, 45) ? 74 : 60,
    ]),
  );

  const abstract = clamp100((a.abstract + b.abstract) / 2 + Math.max(a.abstract, b.abstract) * 0.08);

  return { rapport, companionship, communication, security, freedom, spark, stability, abstract };
}

export function conflictRisk(a: DimensionScores, b: DimensionScores): number {
  const signals = [
    a.replySensitivity > 68 && b.emotionExpression < 40 ? 78 : 30,
    b.replySensitivity > 68 && a.emotionExpression < 40 ? 78 : 30,
    a.companionship > 72 && b.independence > 72 ? 70 : 28,
    b.companionship > 72 && a.independence > 72 ? 70 : 28,
    a.conflictInitiative > 70 && b.conflictAvoidance > 70 ? 74 : 32,
    b.conflictInitiative > 70 && a.conflictAvoidance > 70 ? 74 : 32,
    a.securityNeed > 72 && b.investment < 40 ? 76 : 30,
    b.securityNeed > 72 && a.investment < 40 ? 76 : 30,
  ];
  return mean(signals);
}

export const INDEX_LABELS: Record<keyof RelationshipIndices, string> = {
  rapport: "默契指数",
  companionship: "陪伴指数",
  communication: "沟通指数",
  security: "安心指数",
  freedom: "独处指数",
  spark: "火花指数",
  stability: "稳定指数",
  abstract: "抽象指数",
};
