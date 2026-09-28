import { PERSONALITY_TYPES, type PersonalityTypeDef } from "../content/personalities.js";
import type { DimensionScores } from "../domain/dimensions.js";
import { euclideanDistance, similarityFromDistance } from "./scoring.js";

export interface PersonalityMatch {
  typeId: string;
  typeName: string;
  tagline: string;
  summary: string;
  score: number;
  secondaryTypeId: string | null;
  secondaryTypeName: string | null;
  typeScores: Record<string, number>;
}

export const SECONDARY_TYPE_THRESHOLDS = {
  minScore: 68,
  maxGap: 6,
} as const;

export function selectSecondary(
  top: { score: number },
  second?: { type: PersonalityTypeDef; score: number },
): { id: string; name: string } | null {
  if (!second) return null;
  if (second.score < SECONDARY_TYPE_THRESHOLDS.minScore) return null;
  if (top.score - second.score > SECONDARY_TYPE_THRESHOLDS.maxGap) return null;
  return { id: second.type.id, name: second.type.name };
}

export function matchPersonality(scores: DimensionScores): PersonalityMatch {
  const ranked = PERSONALITY_TYPES.map((type) => ({
    type,
    score: similarityFromDistance(euclideanDistance(scores, type.prototype)),
  })).sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const second = ranked[1];
  const secondary = selectSecondary(top, second);
  const typeScores = Object.fromEntries(ranked.map((item) => [item.type.id, item.score]));

  return {
    typeId: top.type.id,
    typeName: top.type.name,
    tagline: top.type.tagline,
    summary: top.type.summary,
    score: top.score,
    secondaryTypeId: secondary?.id ?? null,
    secondaryTypeName: secondary?.name ?? null,
    typeScores,
  };
}
