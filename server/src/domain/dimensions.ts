export const DIMENSION_KEYS = [
  "communication",
  "replySensitivity",
  "securityNeed",
  "independence",
  "companionship",
  "emotionSensitivity",
  "emotionExpression",
  "conflictInitiative",
  "conflictAvoidance",
  "investment",
  "novelty",
  "boundary",
  "dominance",
  "dependency",
  "rationality",
  "abstract",
] as const;

export type DimKey = (typeof DIMENSION_KEYS)[number];

export type DimensionScores = Record<DimKey, number>;

export const DIMENSION_LABELS: Record<DimKey, string> = {
  communication: "开麦指数",
  replySensitivity: "已读乱想指数",
  securityNeed: "安心需求",
  independence: "独处充电指数",
  companionship: "黏人指数",
  emotionSensitivity: "情绪雷达",
  emotionExpression: "表达指数",
  conflictInitiative: "吵架解决欲",
  conflictAvoidance: "冷静指数",
  investment: "上头指数",
  novelty: "折腾指数",
  boundary: "边界感",
  dominance: "掌舵指数",
  dependency: "关系依赖度",
  rationality: "脑回路稳定度",
  abstract: "抽象浓度",
};

export const EMPTY_SCORES: DimensionScores = {
  communication: 0,
  replySensitivity: 0,
  securityNeed: 0,
  independence: 0,
  companionship: 0,
  emotionSensitivity: 0,
  emotionExpression: 0,
  conflictInitiative: 0,
  conflictAvoidance: 0,
  investment: 0,
  novelty: 0,
  boundary: 0,
  dominance: 0,
  dependency: 0,
  rationality: 0,
  abstract: 0,
};

export type ScoreDelta = Partial<Record<DimKey, number>>;

export function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function addDelta(base: DimensionScores, delta: ScoreDelta): DimensionScores {
  const next = { ...base };
  for (const key of DIMENSION_KEYS) {
    const value = delta[key];
    if (typeof value === "number") next[key] += value;
  }
  return next;
}
