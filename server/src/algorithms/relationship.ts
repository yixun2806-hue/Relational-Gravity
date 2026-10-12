import { RELATIONSHIP_BY_ID, RELATIONSHIP_TYPES, type RelationshipTypeDef } from "../content/relationships.js";
import { DIMENSION_LABELS, type DimensionScores, type DimKey } from "../domain/dimensions.js";
import {
  clampFloat100,
  compareDimensionFingerprint,
  matchDifferent,
  matchHigh,
  matchLow,
  matchSimilar,
} from "./scoring.js";
import type { RelationshipIndices } from "./indices.js";

export const MIN_ANCHOR_STRENGTH = 35;
export const PRIMARY_SCORE_SHARE = 0.7;
export const SUPPORT_SCORE_SHARE = 0.3;
export const ROLE_FIT_SHARE = 0.7;
export const CONTRAST_FIT_SHARE = 0.3;

const PRIMARY_MEAN_ELIGIBLE = 58;
const PRIMARY_MEAN_BORDERLINE = 36;
const WEAKEST_BORDERLINE = 15;
const SCORE_ELIGIBLE = 40;
const WEAK_COMPETITION_PENALTY = 16;

export type CandidateTier = "eligible" | "borderline" | "weak";
export type CandidateOrientation = "a-b" | "b-a" | "symmetric";

export interface RelationshipEvidence {
  id: string;
  dimensionKeys: DimKey[];
  strength: number;
  aValue: number;
  bValue: number;
  role: "a" | "b" | "pair";
  text: string;
}

export interface RelationshipCandidate {
  typeId: string;
  score: number;
  eligibility: number;
  eligible: boolean;
  tier: CandidateTier;
  fallback: boolean;
  orientation: CandidateOrientation;
  roles: { a: string; b: string };
  evidence: RelationshipEvidence[];
}

export interface RelationshipMatch {
  type: RelationshipTypeDef;
  score: number;
  eligibility: number;
  roles: { a: string; b: string };
  evidence: RelationshipEvidence[];
  candidates: RelationshipCandidate[];
}

type Subject = "first" | "second" | "pair";
type Paradigm = "complement" | "similar" | "conflict" | "both-high" | "both-low" | "difference";
type Side = "first" | "second";

interface Feature {
  id: string;
  keys: DimKey[];
  label: string;
  subject: Subject;
  anchor: boolean;
  strength(first: DimensionScores, second: DimensionScores, indices: RelationshipIndices): number;
}

interface Rule {
  typeId: string;
  paradigm: Paradigm;
  symmetric: boolean;
  roleNames: [string, string];
  features: Feature[];
}

interface EvaluatedCandidate extends RelationshipCandidate {
  rawScore: number;
  rawEligibility: number;
  competitionScore: number;
}

const valueOf = (scores: DimensionScores, key: DimKey) => scores[key];

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function geometricMean(values: number[]): number {
  if (values.length === 0 || values.some((value) => value <= 0)) return 0;
  const logMean = values.reduce((sum, value) => sum + Math.log(value), 0) / values.length;
  return clampFloat100(Math.exp(logMean));
}

export function blendRelationshipScore(primaryMean: number, supportMean: number): number {
  return clampFloat100(primaryMean * PRIMARY_SCORE_SHARE + supportMean * SUPPORT_SCORE_SHARE);
}

export function relationshipCompetition(rawScore: number, structural: number, tier: CandidateTier): number {
  const continuous = rawScore * (0.75 + 0.25 * clampFloat100(structural) / 100);
  return tier === "weak" ? continuous - WEAK_COMPETITION_PENALTY : continuous;
}

function high(id: string, key: DimKey, subject: Side, anchor = false): Feature {
  return {
    id,
    keys: [key],
    label: `${DIMENSION_LABELS[key]}偏高`,
    subject,
    anchor,
    strength: (first, second) => matchHigh(subject === "first" ? first[key] : second[key]),
  };
}

function low(id: string, key: DimKey, subject: Side, anchor = false): Feature {
  return {
    id,
    keys: [key],
    label: `${DIMENSION_LABELS[key]}偏低`,
    subject,
    anchor,
    strength: (first, second) => matchLow(subject === "first" ? first[key] : second[key]),
  };
}

function directional(id: string, key: DimKey, highSide: Side, anchor = false): Feature {
  return {
    id,
    keys: [key],
    label: `${DIMENSION_LABELS[key]}一高一低`,
    subject: "pair",
    anchor,
    strength: (first, second) => {
      const highScores = highSide === "first" ? first : second;
      const lowScores = highSide === "first" ? second : first;
      const roleFit = geometricMean([
        matchHigh(highScores[key]),
        matchLow(lowScores[key]),
      ]);
      const contrastFit = matchDifferent(highScores[key], lowScores[key]);
      return roleFit * ROLE_FIT_SHARE + contrastFit * CONTRAST_FIT_SHARE;
    },
  };
}

function bothHigh(id: string, key: DimKey, anchor = false): Feature {
  return {
    id,
    keys: [key],
    label: `双方${DIMENSION_LABELS[key]}都高`,
    subject: "pair",
    anchor,
    strength: (first, second) => geometricMean([matchHigh(first[key]), matchHigh(second[key])]),
  };
}

function bothLow(id: string, key: DimKey, anchor = false): Feature {
  return {
    id,
    keys: [key],
    label: `双方${DIMENSION_LABELS[key]}都低`,
    subject: "pair",
    anchor,
    strength: (first, second) => geometricMean([matchLow(first[key]), matchLow(second[key])]),
  };
}

function similar(id: string, key: DimKey): Feature {
  return {
    id,
    keys: [key],
    label: `双方${DIMENSION_LABELS[key]}接近`,
    subject: "pair",
    anchor: false,
    strength: (first, second) => matchSimilar(first[key], second[key]),
  };
}

function personGeo(id: string, subject: Side, keys: DimKey[], label: string, read: (scores: DimensionScores) => number[], anchor = false): Feature {
  return {
    id,
    keys,
    label,
    subject,
    anchor,
    strength: (first, second) => geometricMean(read(subject === "first" ? first : second)),
  };
}

function indexFeature(id: string, key: keyof RelationshipIndices): Feature {
  return { id, keys: [], label: `${key}关系指数`, subject: "pair", anchor: false, strength: (_first, _second, indices) => indices[key] };
}

const rules: Rule[] = [
  {
    typeId: "iceberg_sun",
    paradigm: "complement",
    symmetric: false,
    roleNames: ["冰山", "小太阳"],
    features: [
      directional("expression-roles", "emotionExpression", "second", true),
      high("ice-independent", "independence", "first"),
      high("ice-rational", "rationality", "first"),
      high("sun-companionship", "companionship", "second"),
    ],
  },
  {
    typeId: "stubborn_soft",
    paradigm: "complement",
    symmetric: false,
    roleNames: ["嘴硬", "心软"],
    features: [
      personGeo("hard-role", "first", ["emotionExpression", "conflictAvoidance"], "嘴硬角色", (scores) => [matchLow(scores.emotionExpression), matchHigh(scores.conflictAvoidance)], true),
      personGeo("soft-role", "second", ["emotionSensitivity", "investment"], "心软角色", (scores) => [matchHigh(scores.emotionSensitivity), matchHigh(scores.investment)], true),
      directional("expression-gap", "emotionExpression", "second"),
    ],
  },
  {
    typeId: "cat_dog",
    paradigm: "difference",
    symmetric: false,
    roleNames: ["猫", "狗"],
    features: [
      directional("independence-roles", "independence", "first", true),
      directional("companionship-roles", "companionship", "second", true),
      low("dog-low-dependency", "dependency", "second"),
    ],
  },
  {
    typeId: "plan_go_with_flow",
    paradigm: "difference",
    symmetric: false,
    roleNames: ["计划", "随缘"],
    features: [
      directional("dominance-roles", "dominance", "first", true),
      high("plan-rational", "rationality", "first"),
      high("flow-novelty", "novelty", "second"),
    ],
  },
  {
    typeId: "detective_missing",
    paradigm: "conflict",
    symmetric: false,
    roleNames: ["侦探", "失踪人口"],
    features: [
      high("detective-reply", "replySensitivity", "first", true),
      personGeo("missing-role", "second", ["communication", "emotionExpression"], "失踪人口角色", (scores) => [matchLow(scores.communication), matchLow(scores.emotionExpression)], true),
      high("detective-security", "securityNeed", "first"),
    ],
  },
  {
    typeId: "clingy_free",
    paradigm: "complement",
    symmetric: false,
    roleNames: ["黏人", "自由"],
    features: [
      directional("companionship-roles", "companionship", "first", true),
      directional("independence-roles", "independence", "second", true),
      high("clingy-dependency", "dependency", "first"),
      high("free-boundary", "boundary", "second"),
    ],
  },
  {
    typeId: "rational_emotional",
    paradigm: "complement",
    symmetric: false,
    roleNames: ["理性", "感性"],
    features: [
      personGeo("rational-role", "first", ["rationality", "emotionSensitivity"], "理性角色", (scores) => [matchHigh(scores.rationality), matchLow(scores.emotionSensitivity)], true),
      personGeo("emotional-role", "second", ["emotionSensitivity", "rationality"], "感性角色", (scores) => [matchHigh(scores.emotionSensitivity), matchLow(scores.rationality)], true),
      high("emotional-expression", "emotionExpression", "second"),
    ],
  },
  {
    typeId: "active_passive",
    paradigm: "difference",
    symmetric: false,
    roleNames: ["主动", "被动"],
    features: [
      directional("communication-roles", "communication", "first", true),
      high("active-dominance", "dominance", "first"),
      low("passive-dominance", "dominance", "second"),
    ],
  },
  {
    typeId: "social_battery",
    paradigm: "difference",
    symmetric: false,
    roleNames: ["社牛", "社恐"],
    features: [
      directional("communication-roles", "communication", "first", true),
      high("social-novelty", "novelty", "first"),
      high("quiet-independent", "independence", "second"),
    ],
  },
  {
    typeId: "spotlight_lowkey",
    paradigm: "difference",
    symmetric: false,
    roleNames: ["显眼包", "低调王"],
    features: [
      directional("novelty-roles", "novelty", "first", true),
      low("lowkey-communication", "communication", "second", true),
      high("spotlight-abstract", "abstract", "first"),
      high("spotlight-communication", "communication", "first"),
    ],
  },
  {
    typeId: "radar_wood",
    paradigm: "difference",
    symmetric: false,
    roleNames: ["情绪雷达", "情绪木头"],
    features: [
      directional("sensitivity-roles", "emotionSensitivity", "first", true),
      high("radar-reply", "replySensitivity", "first"),
      low("wood-expression", "emotionExpression", "second"),
    ],
  },
  {
    typeId: "pm_slacker",
    paradigm: "difference",
    symmetric: false,
    roleNames: ["关系项目经理", "快乐摸鱼王"],
    features: [
      directional("dominance-roles", "dominance", "first", true),
      directional("investment-roles", "investment", "first", true),
      high("slacker-novelty", "novelty", "second"),
    ],
  },
  {
    typeId: "powder_extinguisher",
    paradigm: "conflict",
    symmetric: false,
    roleNames: ["火药桶", "灭火器"],
    features: [
      personGeo("powder-role", "first", ["emotionSensitivity", "emotionExpression"], "火药桶角色", (scores) => [matchHigh(scores.emotionSensitivity), matchHigh(scores.emotionExpression)], true),
      high("extinguisher-rational", "rationality", "second", true),
      high("powder-initiative", "conflictInitiative", "first"),
      low("powder-low-rational", "rationality", "first"),
      high("extinguisher-avoidance", "conflictAvoidance", "second"),
      high("extinguisher-communication", "communication", "second"),
    ],
  },
  {
    typeId: "ice_ice",
    paradigm: "both-low",
    symmetric: true,
    roleNames: ["冰山", "冰山"],
    features: [
      bothLow("both-low-expression", "emotionExpression", true),
      bothHigh("both-independent", "independence", true),
      bothLow("both-low-communication", "communication"),
      similar("expression-similar", "emotionExpression"),
    ],
  },
  {
    typeId: "sun_sun",
    paradigm: "both-high",
    symmetric: true,
    roleNames: ["小太阳", "小太阳"],
    features: [
      bothHigh("both-companionship", "companionship", true),
      bothHigh("both-expression", "emotionExpression", true),
      bothHigh("both-communication", "communication"),
      similar("companionship-similar", "companionship"),
    ],
  },
  {
    typeId: "spotlight_spotlight",
    paradigm: "both-high",
    symmetric: true,
    roleNames: ["显眼包", "显眼包"],
    features: [
      bothHigh("both-novelty", "novelty", true),
      bothHigh("both-abstract", "abstract", true),
      bothHigh("both-communication", "communication"),
      similar("novelty-similar", "novelty"),
    ],
  },
  {
    typeId: "rumination_comfort",
    paradigm: "complement",
    symmetric: false,
    roleNames: ["内耗王", "安抚王"],
    features: [
      personGeo("rumination-role", "first", ["replySensitivity", "emotionSensitivity"], "内耗角色", (scores) => [matchHigh(scores.replySensitivity), matchHigh(scores.emotionSensitivity)], true),
      personGeo("comfort-role", "second", ["emotionExpression", "communication", "companionship"], "安抚角色", (scores) => [
        Math.max(matchHigh(scores.emotionExpression), matchHigh(scores.communication)),
        matchHigh(scores.companionship),
      ], true),
      high("rumination-security", "securityNeed", "first"),
      high("comfort-rational", "rationality", "second"),
    ],
  },
  {
    typeId: "hesitate_decide",
    paradigm: "difference",
    symmetric: false,
    roleNames: ["纠结王", "决策王"],
    features: [
      directional("dominance-roles", "dominance", "second", true),
      low("hesitate-initiative", "conflictInitiative", "first"),
      high("decide-rational", "rationality", "second"),
    ],
  },
  {
    typeId: "grudge_forget",
    paradigm: "difference",
    symmetric: false,
    roleNames: ["持续在意细节", "较快翻篇"],
    features: [
      directional("reply-roles", "replySensitivity", "first", true),
      high("detail-investment", "investment", "first", true),
      high("detail-sensitive", "emotionSensitivity", "first"),
      high("moveon-rational", "rationality", "second"),
    ],
  },
  {
    typeId: "talk_now_later",
    paradigm: "conflict",
    symmetric: false,
    roleNames: ["主动沟通", "冷处理"],
    features: [
      personGeo("talk-role", "first", ["conflictInitiative", "communication"], "主动沟通角色", (scores) => [matchHigh(scores.conflictInitiative), matchHigh(scores.communication)], true),
      personGeo("later-role", "second", ["conflictAvoidance", "communication"], "冷处理角色", (scores) => [matchHigh(scores.conflictAvoidance), matchLow(scores.communication)], true),
      low("later-expression", "emotionExpression", "second"),
      high("later-independent", "independence", "second"),
    ],
  },
  {
    typeId: "sensitive_stable",
    paradigm: "complement",
    symmetric: false,
    roleNames: ["高敏感", "高稳定"],
    features: [
      high("sensitive-high", "emotionSensitivity", "first", true),
      personGeo("stable-role", "second", ["rationality", "emotionSensitivity"], "高稳定角色", (scores) => [matchHigh(scores.rationality), matchLow(scores.emotionSensitivity)], true),
      high("sensitive-security", "securityNeed", "first"),
      low("stable-low-reply", "replySensitivity", "second"),
      high("stable-avoidance", "conflictAvoidance", "second"),
    ],
  },
  {
    typeId: "independent_independent",
    paradigm: "both-high",
    symmetric: true,
    roleNames: ["高独立", "高独立"],
    features: [
      bothHigh("both-independent", "independence", true),
      bothHigh("both-boundary", "boundary", true),
      bothLow("both-low-companionship", "companionship"),
      similar("independent-similar", "independence"),
    ],
  },
  {
    typeId: "together_together",
    paradigm: "both-high",
    symmetric: true,
    roleNames: ["高陪伴", "高陪伴"],
    features: [
      bothHigh("both-companionship", "companionship", true),
      bothHigh("both-dependency", "dependency", true),
      bothLow("both-low-independence", "independence"),
      similar("companionship-similar", "companionship"),
    ],
  },
  {
    typeId: "abstract_abstract",
    paradigm: "both-high",
    symmetric: true,
    roleNames: ["高抽象", "高抽象"],
    features: [
      bothHigh("both-abstract", "abstract", true),
      bothHigh("both-novelty", "novelty"),
      indexFeature("abstract-index", "abstract"),
      similar("abstract-similar", "abstract"),
    ],
  },
];

function evidenceFor(
  feature: Feature,
  strength: number,
  first: DimensionScores,
  second: DimensionScores,
  firstIsA: boolean,
): RelationshipEvidence {
  const firstValue = feature.keys.length ? valueOf(first, feature.keys[0]) : strength;
  const secondValue = feature.keys.length ? valueOf(second, feature.keys.at(-1) as DimKey) : strength;
  const aValue = firstIsA ? firstValue : secondValue;
  const bValue = firstIsA ? secondValue : firstValue;
  const role = feature.subject === "pair" ? "pair" : feature.subject === "first" ? (firstIsA ? "a" : "b") : (firstIsA ? "b" : "a");
  return {
    id: feature.id,
    dimensionKeys: feature.keys,
    strength: Math.round(strength),
    aValue: Math.round(aValue),
    bValue: Math.round(bValue),
    role,
    text: feature.subject === "pair"
      ? `A 与 B 的${feature.label}，当前支持度 ${Math.round(strength)}%`
      : `${role === "a" ? "A" : "B"} 的${feature.label}，当前值 ${Math.round(role === "a" ? aValue : bValue)}%`,
  };
}

function tierFor(primaryMean: number, weakest: number, rawScore: number): CandidateTier {
  if (primaryMean >= PRIMARY_MEAN_ELIGIBLE && weakest >= MIN_ANCHOR_STRENGTH && rawScore >= SCORE_ELIGIBLE) return "eligible";
  if (primaryMean >= PRIMARY_MEAN_BORDERLINE && weakest >= WEAKEST_BORDERLINE) return "borderline";
  return "weak";
}

function evaluate(rule: Rule, first: DimensionScores, second: DimensionScores, indices: RelationshipIndices, firstIsA: boolean): EvaluatedCandidate {
  const measured = rule.features.map((feature) => ({ feature, strength: feature.strength(first, second, indices) }));
  const primaryValues = measured.filter(({ feature }) => feature.anchor).map(({ strength }) => strength);
  const supportValues = measured.filter(({ feature }) => !feature.anchor).map(({ strength }) => strength);
  const primaryMean = mean(primaryValues);
  const weakest = primaryValues.length ? Math.min(...primaryValues) : 0;
  const supportMean = supportValues.length ? mean(supportValues) : primaryMean;
  const rawScore = blendRelationshipScore(primaryMean, supportMean);
  const rawEligibility = clampFloat100(primaryMean * 0.8 + weakest * 0.2);
  const tier = tierFor(primaryMean, weakest, rawScore);
  const orientation: CandidateOrientation = rule.symmetric ? "symmetric" : firstIsA ? "a-b" : "b-a";
  const roles = rule.symmetric
    ? { a: rule.roleNames[0], b: rule.roleNames[1] }
    : firstIsA
      ? { a: rule.roleNames[0], b: rule.roleNames[1] }
      : { a: rule.roleNames[1], b: rule.roleNames[0] };
  const evidence = measured
    .slice()
    .sort((left, right) => right.strength - left.strength || left.feature.id.localeCompare(right.feature.id))
    .slice(0, 5)
    .map(({ feature, strength }) => evidenceFor(feature, strength, first, second, firstIsA));
  return {
    typeId: rule.typeId,
    rawScore,
    rawEligibility,
    competitionScore: relationshipCompetition(rawScore, rawEligibility, tier),
    score: Math.round(rawScore),
    eligibility: Math.round(rawEligibility),
    eligible: tier === "eligible",
    tier,
    fallback: tier === "weak",
    orientation,
    roles,
    evidence,
  };
}

function compareEvaluated(left: EvaluatedCandidate, right: EvaluatedCandidate): number {
  if (left.competitionScore !== right.competitionScore) return right.competitionScore - left.competitionScore;
  if (left.rawScore !== right.rawScore) return right.rawScore - left.rawScore;
  return (RELATIONSHIP_BY_ID[left.typeId]?.code ?? "99").localeCompare(RELATIONSHIP_BY_ID[right.typeId]?.code ?? "99");
}

function orient(rule: Rule, a: DimensionScores, b: DimensionScores, indices: RelationshipIndices): EvaluatedCandidate {
  if (rule.symmetric) return evaluate(rule, a, b, indices, true);
  const forward = evaluate(rule, a, b, indices, true);
  const reverse = evaluate(rule, b, a, indices, false);
  if (forward.competitionScore > reverse.competitionScore) return forward;
  if (reverse.competitionScore > forward.competitionScore) return reverse;
  if (forward.rawScore > reverse.rawScore) return forward;
  if (reverse.rawScore > forward.rawScore) return reverse;
  const fingerprint = compareDimensionFingerprint(a, b);
  if (fingerprint < 0) return forward;
  if (fingerprint > 0) return reverse;
  return {
    ...forward,
    orientation: "symmetric",
    roles: { a: "无明显定向", b: "无明显定向" },
    evidence: forward.evidence.map((item) => ({ ...item, role: "pair" as const })),
  };
}

export function rankRelationshipCandidates(a: DimensionScores, b: DimensionScores, indices: RelationshipIndices): EvaluatedCandidate[] {
  return rules.map((rule) => orient(rule, a, b, indices)).sort(compareEvaluated);
}

export function matchRelationship(a: DimensionScores, b: DimensionScores, indices: RelationshipIndices): RelationshipMatch {
  const ordered = rankRelationshipCandidates(a, b, indices);
  const candidates = ordered.slice(0, 3);
  const top = candidates[0];
  const type = RELATIONSHIP_BY_ID[top.typeId] ?? RELATIONSHIP_TYPES[0];
  return {
    type,
    score: top.score,
    eligibility: top.eligibility,
    roles: top.roles,
    evidence: top.evidence,
    candidates,
  };
}
