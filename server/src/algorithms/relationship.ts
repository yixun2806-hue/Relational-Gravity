import { RELATIONSHIP_BY_ID, RELATIONSHIP_TYPES, type RelationshipTypeDef } from "../content/relationships.js";
import { DIMENSION_LABELS, type DimensionScores, type DimKey } from "../domain/dimensions.js";
import {
  compareDimensionFingerprint,
  matchDifferent,
  matchHigh,
  matchLow,
  matchSimilar,
  weightedMean,
} from "./scoring.js";
import type { RelationshipIndices } from "./indices.js";

export const MIN_ANCHOR_STRENGTH = 35;
const MIN_ELIGIBILITY = 55;
const MIN_BORDERLINE = 35;

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

interface Feature {
  id: string;
  keys: DimKey[];
  label: string;
  subject: Subject;
  anchor: boolean;
  weight: number;
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
const subjectValue = (subject: Subject, first: DimensionScores, second: DimensionScores, key: DimKey) =>
  subject === "first" ? first[key] : subject === "second" ? second[key] : (first[key] + second[key]) / 2;

function high(id: string, key: DimKey, subject: Exclude<Subject, "pair">, weight: number, anchor = false): Feature {
  return { id, keys: [key], label: `${DIMENSION_LABELS[key]}偏高`, subject, weight, anchor, strength: (first, second) => matchHigh(subjectValue(subject, first, second, key)) };
}

function low(id: string, key: DimKey, subject: Exclude<Subject, "pair">, weight: number, anchor = false): Feature {
  return { id, keys: [key], label: `${DIMENSION_LABELS[key]}偏低`, subject, weight, anchor, strength: (first, second) => matchLow(subjectValue(subject, first, second, key)) };
}

function difference(id: string, key: DimKey, weight: number, anchor = false): Feature {
  return { id, keys: [key], label: `${DIMENSION_LABELS[key]}差异`, subject: "pair", weight, anchor, strength: (first, second) => matchDifferent(first[key], second[key]) };
}

function crossDifference(id: string, firstKey: DimKey, secondKey: DimKey, weight: number, anchor = false): Feature {
  return { id, keys: [firstKey, secondKey], label: `${DIMENSION_LABELS[firstKey]}与${DIMENSION_LABELS[secondKey]}差异`, subject: "pair", weight, anchor, strength: (first, second) => matchDifferent(first[firstKey], second[secondKey]) };
}

function bothHigh(id: string, key: DimKey, weight: number, anchor = false): Feature {
  return { id, keys: [key], label: `双方${DIMENSION_LABELS[key]}都高`, subject: "pair", weight, anchor, strength: (first, second) => Math.min(matchHigh(first[key]), matchHigh(second[key])) };
}

function bothLow(id: string, key: DimKey, weight: number, anchor = false): Feature {
  return { id, keys: [key], label: `双方${DIMENSION_LABELS[key]}都低`, subject: "pair", weight, anchor, strength: (first, second) => Math.min(matchLow(first[key]), matchLow(second[key])) };
}

function similar(id: string, key: DimKey, weight: number): Feature {
  return { id, keys: [key], label: `双方${DIMENSION_LABELS[key]}接近`, subject: "pair", weight, anchor: false, strength: (first, second) => matchSimilar(first[key], second[key]) };
}

function maxHigh(id: string, keys: DimKey[], subject: Exclude<Subject, "pair">, weight: number, anchor = false): Feature {
  return { id, keys, label: `${keys.map((key) => DIMENSION_LABELS[key]).join("或")}具备一项`, subject, weight, anchor, strength: (first, second) => Math.max(...keys.map((key) => matchHigh(subjectValue(subject, first, second, key)))) };
}

function indexFeature(id: string, key: keyof RelationshipIndices, weight: number): Feature {
  return { id, keys: [], label: `${key}关系指数`, subject: "pair", weight, anchor: false, strength: (_first, _second, indices) => indices[key] };
}

const rules: Rule[] = [
  { typeId: "iceberg_sun", paradigm: "complement", symmetric: false, roleNames: ["冰山", "小太阳"], features: [low("ice-expression", "emotionExpression", "first", .2, true), high("sun-expression", "emotionExpression", "second", .2, true), difference("expression-gap", "emotionExpression", .2, true), high("ice-independent", "independence", "first", .15), high("ice-rational", "rationality", "first", .1), high("sun-companionship", "companionship", "second", .15)] },
  { typeId: "stubborn_soft", paradigm: "complement", symmetric: false, roleNames: ["嘴硬", "心软"], features: [low("hard-expression", "emotionExpression", "first", .25, true), high("hard-avoidance", "conflictAvoidance", "first", .2, true), high("soft-sensitive", "emotionSensitivity", "second", .2, true), high("soft-investment", "investment", "second", .2, true), difference("expression-gap", "emotionExpression", .15)] },
  { typeId: "cat_dog", paradigm: "difference", symmetric: false, roleNames: ["猫", "狗"], features: [high("cat-independent", "independence", "first", .25, true), high("dog-companionship", "companionship", "second", .25, true), difference("companionship-gap", "companionship", .2, true), low("cat-companionship", "companionship", "first", .15), low("dog-independent", "independence", "second", .15), low("dog-low-dependency", "dependency", "second", .1)] },
  { typeId: "plan_go_with_flow", paradigm: "difference", symmetric: false, roleNames: ["计划", "随缘"], features: [high("plan-dominance", "dominance", "first", .3, true), low("flow-dominance", "dominance", "second", .25, true), difference("dominance-gap", "dominance", .15, true), high("plan-rational", "rationality", "first", .15), high("flow-novelty", "novelty", "second", .15)] },
  { typeId: "detective_missing", paradigm: "conflict", symmetric: false, roleNames: ["侦探", "失踪人口"], features: [high("detective-reply", "replySensitivity", "first", .25, true), low("missing-communication", "communication", "second", .25, true), low("missing-expression", "emotionExpression", "second", .2, true), high("detective-security", "securityNeed", "first", .15), crossDifference("reply-expression-gap", "replySensitivity", "emotionExpression", .15)] },
  { typeId: "clingy_free", paradigm: "complement", symmetric: false, roleNames: ["黏人", "自由"], features: [high("clingy-companionship", "companionship", "first", .25, true), high("free-independent", "independence", "second", .25, true), difference("companionship-gap", "companionship", .15, true), high("clingy-dependency", "dependency", "first", .2), high("free-boundary", "boundary", "second", .15)] },
  { typeId: "rational_emotional", paradigm: "complement", symmetric: false, roleNames: ["理性", "感性"], features: [high("rational-high", "rationality", "first", .3, true), high("emotional-sensitive", "emotionSensitivity", "second", .3, true), difference("rational-gap", "rationality", .15, true), low("rational-low-sensitive", "emotionSensitivity", "first", .15), low("emotional-low-rational", "rationality", "second", .1)] },
  { typeId: "active_passive", paradigm: "difference", symmetric: false, roleNames: ["主动", "被动"], features: [high("active-communication", "communication", "first", .3, true), low("passive-communication", "communication", "second", .25, true), difference("communication-gap", "communication", .2, true), high("active-dominance", "dominance", "first", .15), low("passive-dominance", "dominance", "second", .1)] },
  { typeId: "social_battery", paradigm: "difference", symmetric: false, roleNames: ["社牛", "社恐"], features: [high("social-communication", "communication", "first", .3, true), low("quiet-communication", "communication", "second", .3, true), difference("communication-gap", "communication", .2, true), high("social-novelty", "novelty", "first", .1), high("quiet-independent", "independence", "second", .1)] },
  { typeId: "spotlight_lowkey", paradigm: "difference", symmetric: false, roleNames: ["显眼包", "低调王"], features: [maxHigh("spotlight-energy", ["novelty", "abstract"], "first", .25, true), low("lowkey-novelty", "novelty", "second", .2, true), low("lowkey-communication", "communication", "second", .2, true), difference("novelty-gap", "novelty", .2, true), high("spotlight-communication", "communication", "first", .15)] },
  { typeId: "radar_wood", paradigm: "difference", symmetric: false, roleNames: ["情绪雷达", "情绪木头"], features: [high("radar-sensitive", "emotionSensitivity", "first", .3, true), low("wood-sensitive", "emotionSensitivity", "second", .25, true), difference("sensitivity-gap", "emotionSensitivity", .25, true), high("radar-reply", "replySensitivity", "first", .1), low("wood-expression", "emotionExpression", "second", .1)] },
  { typeId: "pm_slacker", paradigm: "difference", symmetric: false, roleNames: ["关系项目经理", "快乐摸鱼王"], features: [high("pm-dominance", "dominance", "first", .25, true), high("pm-investment", "investment", "first", .25, true), low("slacker-dominance", "dominance", "second", .2, true), low("slacker-investment", "investment", "second", .15), high("slacker-novelty", "novelty", "second", .15)] },
  { typeId: "powder_extinguisher", paradigm: "conflict", symmetric: false, roleNames: ["火药桶", "灭火器"], features: [high("powder-sensitive", "emotionSensitivity", "first", .22, true), high("powder-expression", "emotionExpression", "first", .2, true), high("extinguisher-rational", "rationality", "second", .22, true), maxHigh("extinguisher-soothing", ["communication", "emotionExpression"], "second", .06, true), high("powder-initiative", "conflictInitiative", "first", .12), low("powder-low-rational", "rationality", "first", .08), high("extinguisher-avoidance", "conflictAvoidance", "second", .1)] },
  { typeId: "ice_ice", paradigm: "both-low", symmetric: true, roleNames: ["冰山", "冰山"], features: [bothLow("both-low-expression", "emotionExpression", .3, true), bothHigh("both-independent", "independence", .25, true), bothLow("both-low-communication", "communication", .25), similar("expression-similar", "emotionExpression", .2)] },
  { typeId: "sun_sun", paradigm: "both-high", symmetric: true, roleNames: ["小太阳", "小太阳"], features: [bothHigh("both-companionship", "companionship", .35, true), bothHigh("both-expression", "emotionExpression", .3, true), bothHigh("both-communication", "communication", .2), similar("companionship-similar", "companionship", .15)] },
  { typeId: "spotlight_spotlight", paradigm: "both-high", symmetric: true, roleNames: ["显眼包", "显眼包"], features: [bothHigh("both-novelty", "novelty", .3, true), bothHigh("both-abstract", "abstract", .3, true), bothHigh("both-communication", "communication", .25), similar("novelty-similar", "novelty", .15)] },
  { typeId: "rumination_comfort", paradigm: "complement", symmetric: false, roleNames: ["内耗王", "安抚王"], features: [high("rumination-reply", "replySensitivity", "first", .2, true), high("rumination-sensitive", "emotionSensitivity", "first", .18, true), maxHigh("comfort-expression", ["emotionExpression", "communication"], "second", .2, true), high("comfort-companionship", "companionship", "second", .14, true), high("rumination-security", "securityNeed", "first", .12), high("comfort-rational", "rationality", "second", .08), high("comfort-communication", "communication", "second", .08)] },
  { typeId: "hesitate_decide", paradigm: "difference", symmetric: false, roleNames: ["纠结王", "决策王"], features: [low("hesitate-dominance", "dominance", "first", .3, true), high("decide-dominance", "dominance", "second", .3, true), difference("dominance-gap", "dominance", .2, true), low("hesitate-initiative", "conflictInitiative", "first", .1), high("decide-rational", "rationality", "second", .1)] },
  { typeId: "grudge_forget", paradigm: "difference", symmetric: false, roleNames: ["持续在意细节", "较快翻篇"], features: [high("detail-reply", "replySensitivity", "first", .25, true), high("detail-investment", "investment", "first", .2, true), low("moveon-reply", "replySensitivity", "second", .2, true), difference("reply-gap", "replySensitivity", .15, true), high("detail-sensitive", "emotionSensitivity", "first", .1), high("moveon-rational", "rationality", "second", .1)] },
  { typeId: "talk_now_later", paradigm: "conflict", symmetric: false, roleNames: ["主动沟通", "冷处理"], features: [high("talk-initiative", "conflictInitiative", "first", .28, true), high("talk-communication", "communication", "first", .24, true), high("later-avoidance", "conflictAvoidance", "second", .22, true), low("later-communication", "communication", "second", .12, true), low("later-expression", "emotionExpression", "second", .1, true), high("later-independent", "independence", "second", .04)] },
  { typeId: "sensitive_stable", paradigm: "complement", symmetric: false, roleNames: ["高敏感", "高稳定"], features: [high("sensitive-high", "emotionSensitivity", "first", .28, true), high("sensitive-security", "securityNeed", "first", .14, true), high("stable-rational", "rationality", "second", .28, true), low("stable-low-sensitive", "emotionSensitivity", "second", .15, true), low("stable-low-reply", "replySensitivity", "second", .12, true), high("stable-avoidance", "conflictAvoidance", "second", .03)] },
  { typeId: "independent_independent", paradigm: "both-high", symmetric: true, roleNames: ["高独立", "高独立"], features: [bothHigh("both-independent", "independence", .4, true), bothHigh("both-boundary", "boundary", .3, true), bothLow("both-low-companionship", "companionship", .15), similar("independent-similar", "independence", .15)] },
  { typeId: "together_together", paradigm: "both-high", symmetric: true, roleNames: ["高陪伴", "高陪伴"], features: [bothHigh("both-companionship", "companionship", .45, true), bothHigh("both-dependency", "dependency", .25, true), bothLow("both-low-independence", "independence", .15), similar("companionship-similar", "companionship", .15)] },
  { typeId: "abstract_abstract", paradigm: "both-high", symmetric: true, roleNames: ["高抽象", "高抽象"], features: [bothHigh("both-abstract", "abstract", .5, true), bothHigh("both-novelty", "novelty", .2), indexFeature("abstract-index", "abstract", .15), similar("abstract-similar", "abstract", .15)] },
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

function evaluate(rule: Rule, first: DimensionScores, second: DimensionScores, indices: RelationshipIndices, firstIsA: boolean): EvaluatedCandidate {
  const measured = rule.features.map((feature) => ({ feature, strength: feature.strength(first, second, indices) }));
  const rawScore = weightedMean(measured.map(({ feature, strength }) => ({ value: strength, weight: feature.weight })));
  const rawEligibility = rawScore;
  const anchorsPass = measured.filter(({ feature }) => feature.anchor).every(({ strength }) => strength >= MIN_ANCHOR_STRENGTH);
  const eligible = rawEligibility >= MIN_ELIGIBILITY && anchorsPass;
  const tier: CandidateTier = eligible ? "eligible" : rawEligibility >= MIN_BORDERLINE ? "borderline" : "weak";
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
    competitionScore: rawScore * (0.75 + 0.25 * rawEligibility / 100),
    score: Math.round(rawScore),
    eligibility: Math.round(rawEligibility),
    eligible,
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

export function matchRelationship(a: DimensionScores, b: DimensionScores, indices: RelationshipIndices): RelationshipMatch {
  const evaluated = rules.map((rule) => orient(rule, a, b, indices));
  const ordered = (["eligible", "borderline", "weak"] as CandidateTier[])
    .flatMap((tier) => evaluated.filter((item) => item.tier === tier).sort(compareEvaluated));
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
