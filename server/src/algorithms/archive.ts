import { DIMENSION_KEYS, DIMENSION_LABELS, type DimKey, type DimensionScores } from "../domain/dimensions.js";
import { conflictRisk, INDEX_LABELS, type RelationshipIndices } from "./indices.js";
import type { RelationshipEvidence } from "./relationship.js";
import { gap, resonance } from "./scoring.js";
import type { WhoMoreInput } from "./who-more.js";

export type WordingStrength = "strong" | "moderate" | "tentative";
export type SelectionTier = "eligible" | "borderline" | "weak";

const WEIGHT: Record<DimKey, number> = {
  companionship: 1,
  independence: 0.95,
  communication: 0.95,
  replySensitivity: 0.92,
  emotionExpression: 0.9,
  securityNeed: 0.9,
  emotionSensitivity: 0.86,
  conflictInitiative: 0.84,
  conflictAvoidance: 0.82,
  boundary: 0.84,
  investment: 0.8,
  dependency: 0.76,
  rationality: 0.74,
  dominance: 0.7,
  novelty: 0.52,
  abstract: 0.46,
};

const INDEX_KEYS = ["rapport", "companionship", "communication", "security", "freedom", "spark", "stability", "abstract"] as const;

const INDEX_DIMS: Record<(typeof INDEX_KEYS)[number], DimKey[]> = {
  rapport: ["communication", "investment", "rationality"],
  companionship: ["companionship", "independence", "dependency"],
  communication: ["communication", "emotionExpression", "replySensitivity"],
  security: ["securityNeed", "investment", "conflictAvoidance"],
  freedom: ["independence", "boundary", "companionship"],
  spark: ["novelty", "abstract", "investment"],
  stability: ["rationality", "conflictInitiative", "novelty"],
  abstract: ["abstract", "novelty"],
};

const LEAD: Record<WordingStrength, string> = {
  strong: "你们很典型地呈现",
  moderate: "你们比较明显地呈现",
  tentative: "在当前结果中，你们更接近",
};

export function wordingStrengthFor(tier: SelectionTier): WordingStrength {
  if (tier === "eligible") return "strong";
  if (tier === "borderline") return "moderate";
  return "tentative";
}

export function indexLevel(value: number): { level: "low" | "medium" | "good" | "high"; label: string } {
  if (value <= 39) return { level: "low", label: "偏低，需要磨合" };
  if (value <= 59) return { level: "medium", label: "中等" };
  if (value <= 79) return { level: "good", label: "良好" };
  return { level: "high", label: "很高" };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function mid(value: number): boolean {
  return value >= 43 && value <= 57;
}

function higher(a: number, b: number): "a" | "b" | "tie" {
  if (Math.abs(a - b) <= 6) return "tie";
  return a > b ? "a" : "b";
}

export interface DimensionComparisonItem {
  key: DimKey;
  label: string;
  aValue: number;
  bValue: number;
  difference: number;
  similarity: number;
  higherSide: "a" | "b" | "tie";
  importance: number;
  summary: string;
}

export interface FactItem {
  dimensions: DimKey[];
  strength: number;
  aValue: number;
  bValue: number;
  summary: string;
  explanation?: string;
  impact?: string;
}

export interface ComplementItem {
  dimensions: DimKey[];
  strength: number;
  aValue: number;
  bValue: number;
  summary: string;
  tension: boolean;
}

export interface IndexDetail {
  key: (typeof INDEX_KEYS)[number];
  label: string;
  value: number;
  level: "low" | "medium" | "good" | "high";
  levelLabel: string;
  summary: string;
  explanation: string;
  evidence: string[];
}

export interface StrengthItem {
  title: string;
  evidence: string;
  explanation: string;
}

export interface RiskItem {
  title: string;
  severity: "low" | "medium" | "high";
  evidence: string;
  mechanism: string;
  suggestion: string;
}

export interface MisunderstandingDetail {
  title: string;
  trigger: string;
  aInterpretation: string;
  bInterpretation: string;
  reality: string;
  repair: string;
}

export type ConflictPattern = "pursue-withdraw" | "mutual-pursue" | "mutual-withdraw" | "logic-emotion" | "low-conflict";

export interface ConflictCycle {
  pattern: ConflictPattern;
  triggers: string[];
  aFirstReaction: string;
  bFirstReaction: string;
  escalation: string;
  loop: string;
  breakpoint: string;
  repairPlan: string;
}

export interface CommunicationScenario {
  title: string;
  whySelected: string;
  aScript: string;
  bScript: string;
  whyItWorks: string;
}

export interface DynamicScene {
  title: string;
  lines: Array<{ speaker: "a" | "b" | "system"; text: string }>;
  punchline: string;
}

export interface RelationshipArchive {
  relationshipConfidence: {
    selectionTier: SelectionTier;
    score: number;
    eligibility: number;
    top1Top2Gap: number;
    typicality: number;
    wordingStrength: WordingStrength;
    reasons: Array<{ id: string; strength: number; text: string }>;
  };
  indicesDetailed: IndexDetail[];
  dimensionComparison: DimensionComparisonItem[];
  similarities: FactItem[];
  differences: FactItem[];
  differenceSummary: string;
  complements: { aOffers: ComplementItem[]; bOffers: ComplementItem[] };
  strengths: StrengthItem[];
  risks: RiskItem[];
  misunderstandingsDetailed: MisunderstandingDetail[];
  conflictCycle: ConflictCycle;
  boundaries: { forA: string[]; forB: string[] };
  communicationScenarios: CommunicationScenario[];
  dynamicScene: DynamicScene;
  dynamicRoast: string;
  adviceForA: string[];
  adviceForB: string[];
  adviceForPair: string[];
  nextActions: string[];
  finalSummary: string;
  whoMore: WhoMoreInput[];
}

function comparisonOf(a: DimensionScores, b: DimensionScores): DimensionComparisonItem[] {
  return DIMENSION_KEYS.map((key) => {
    const aValue = a[key];
    const bValue = b[key];
    const difference = Math.abs(aValue - bValue);
    const similarity = 100 - difference;
    const side = higher(aValue, bValue);
    const extremity = (Math.abs(aValue - 50) + Math.abs(bValue - 50)) / 2;
    const importance = clamp((difference * 1.35 + extremity * 0.55) * WEIGHT[key]);
    const label = DIMENSION_LABELS[key];
    const summary = side === "tie"
      ? (aValue >= 65
        ? `A和B的${label}都偏高，目前是A为${aValue}，B为${bValue}。`
        : aValue <= 35
          ? `A和B的${label}都偏低，目前是A为${aValue}，B为${bValue}。`
          : `A和B的${label}接近，而且都靠近中间，A为${aValue}，B为${bValue}。`)
      : `${side === "a" ? "A" : "B"}的${label}明显高于${side === "a" ? "B" : "A"}，A为${aValue}，B为${bValue}。`;
    return { key, label, aValue, bValue, difference, similarity, higherSide: side, importance, summary };
  });
}

const DIRECTION_NONE = 15;
const DIRECTION_CLEAR = 25;
const MIN_GAP = 18;

export type DirectionLevel = "none" | "mild" | "clear";
export type ActionCategory = "reply-status" | "pause-and-return" | "emotion-first" | "space-boundary" | "concrete-request" | "single-topic-conflict" | "reassurance" | "shared-plan" | "check-in";

export function directionLevel(left: number, right: number): DirectionLevel {
  const gap = Math.abs(left - right);
  if (gap < DIRECTION_NONE) return "none";
  if (gap < DIRECTION_CLEAR) return "mild";
  return "clear";
}

export function hasDirectionalEvidence(left: number, right: number): boolean {
  return directionLevel(left, right) !== "none";
}

export function actionCategory(text: string): ActionCategory {
  if (/暂停|回来继续|返回时间|不再追加|不会就这样消失/.test(text)) return "pause-and-return";
  if (/一个具体问题|一次只|只留一个|只谈一件/.test(text)) return "single-topic-conflict";
  if (/同一件事|事实确认|默契|理解的是/.test(text)) return "check-in";
  if (/谁发起|小事|具体时间|想不想约/.test(text)) return "shared-plan";
  if (/空间|独处|放假|边界/.test(text)) return "space-boundary";
  if (/晚回|再联系|回复/.test(text)) return "reply-status";
  if (/复述|感受|被听|方案/.test(text)) return "emotion-first";
  if (/关系还在|安心/.test(text)) return "reassurance";
  return "concrete-request";
}

function featured(value: number): boolean {
  return value >= 65 || value <= 35;
}

function takeFacts(rows: DimensionComparisonItem[], kind: "similar" | "different"): FactItem[] {
  const ranked = rows
    .map((row) => {
      const meaningful = kind === "similar"
        ? row.similarity >= 75 && featured(row.aValue) && featured(row.bValue) && !mid(row.aValue) && !mid(row.bValue)
        : row.difference >= MIN_GAP;
      const strength = clamp(kind === "similar"
        ? row.similarity * WEIGHT[row.key]
        : row.difference * WEIGHT[row.key]);
      return { row, strength, meaningful };
    })
    .filter((item) => item.meaningful)
    .sort((left, right) => right.strength - left.strength || left.row.key.localeCompare(right.row.key));
  return ranked.slice(0, 5).map((item) => fact(item.row, item.strength, kind));
}

function fact(row: DimensionComparisonItem, strength: number, kind: "similar" | "different"): FactItem {
  if (kind === "similar") {
    const high = row.aValue >= 65;
    const summary = high
      ? `A和B的${row.label}都偏高，A为${row.aValue}，B为${row.bValue}。`
      : `A和B的${row.label}都偏低，A为${row.aValue}，B为${row.bValue}。`;
    const explanation = row.key === "boundary"
      ? "A和B都比较重视个人边界，因此即使关系亲密，也不会要求彼此时时在线。"
      : row.key === "independence" && high
        ? "双方都需要比较多的个人空间。"
        : high
          ? `A和B在${row.label}上都明显偏高，这是可以一起依靠的共同点。`
          : `A和B在${row.label}上都明显偏低，相处时不要把这件事当成某一方的缺点。`;
    return { dimensions: [row.key], strength: clamp(strength), aValue: row.aValue, bValue: row.bValue, summary, explanation };
  }
  const highSide = row.higherSide === "a" ? "A" : "B";
  const impact = row.key === "replySensitivity"
    ? `${highSide}更需要及时回应，另一方对消息空窗的接受程度更高。`
    : `${highSide}在${row.label}上更强，关系节奏会先被这一侧带动。`;
  return {
    dimensions: [row.key],
    strength: clamp(strength),
    aValue: row.aValue,
    bValue: row.bValue,
    summary: row.summary,
    impact,
  };
}

function complementsFrom(a: DimensionScores, b: DimensionScores): RelationshipArchive["complements"] {
  const patterns: Array<{ offer: DimKey; need: DimKey; line: string }> = [
    { offer: "rationality", need: "emotionSensitivity", line: "更擅长在情绪起来后把事情拉回可处理状态" },
    { offer: "communication", need: "conflictAvoidance", line: "更愿意先把问题说开" },
    { offer: "independence", need: "companionship", line: "更能守住各自的空间" },
    { offer: "emotionExpression", need: "replySensitivity", line: "更能把感受说出来，减少对方猜测" },
    { offer: "boundary", need: "dependency", line: "更能把亲近和边界分开" },
    { offer: "conflictInitiative", need: "conflictAvoidance", line: "更能推动卡住的问题继续谈" },
    { offer: "investment", need: "securityNeed", line: "更能用实际投入回应安全感需求" },
  ];
  const aOffers: ComplementItem[] = [];
  const bOffers: ComplementItem[] = [];
  for (const pattern of patterns) {
    pushOffer(aOffers, "a", a, b, pattern);
    pushOffer(bOffers, "b", b, a, pattern);
  }
  return { aOffers: aOffers.slice(0, 3), bOffers: bOffers.slice(0, 3) };
}

function pushOffer(
  target: ComplementItem[],
  side: "a" | "b",
  self: DimensionScores,
  other: DimensionScores,
  pattern: { offer: DimKey; need: DimKey; line: string },
) {
  if (target.length >= 3) return;
  const offerGap = self[pattern.offer] - other[pattern.offer];
  const needGap = other[pattern.need] - self[pattern.need];
  if (self[pattern.offer] < 70 || other[pattern.need] < 70) return;
  if (offerGap < MIN_GAP && needGap < MIN_GAP) return;
  const tension = offerGap >= 28 || needGap >= 28;
  const selfName = side === "a" ? "A" : "B";
  const otherName = side === "a" ? "B" : "A";
  target.push({
    dimensions: [pattern.offer, pattern.need],
    strength: clamp((self[pattern.offer] + other[pattern.need]) / 2),
    aValue: side === "a" ? self[pattern.offer] : other[pattern.need],
    bValue: side === "a" ? other[pattern.need] : self[pattern.offer],
    tension,
    summary: `${selfName}${pattern.line}，${otherName}在${DIMENSION_LABELS[pattern.need]}上更高。${tension ? "这种差异既能互补，也可能成为冲突来源。" : ""}`,
  });
}

function factorLine(parts: Array<{ name: string; value: number }>): string {
  const up = parts.filter((part) => part.value >= 60).map((part) => part.name);
  const down = parts.filter((part) => part.value <= 45).map((part) => part.name);
  const raised = up.length ? `往上拉的是${up.join("、")}` : "没有单独一项明显往上拉";
  const lowered = down.length ? `往下拉的是${down.join("、")}` : "也没有单独一项把指数明显压低";
  return `${raised}，${lowered}。`;
}

function indexParts(a: DimensionScores, b: DimensionScores): Record<(typeof INDEX_KEYS)[number], Array<{ name: string; value: number }>> {
  const risk = conflictRisk(a, b);
  return {
    rapport: [
      { name: "沟通方式接近", value: resonance(a.communication, b.communication) },
      { name: "投入程度接近", value: resonance(a.investment, b.investment) },
      { name: "处事方式接近", value: resonance(a.rationality, b.rationality) },
      { name: "冲突风险留下的空间", value: clamp(100 - risk * 0.7) },
    ],
    companionship: [
      { name: "陪伴需求是否同向", value: clamp(a.companionship >= 68 && b.companionship >= 68 ? 88 : 70 - gap(a.companionship, b.companionship) * 0.35) },
      { name: "陪伴和独处能不能接住", value: clamp(100 - Math.max(0, a.companionship - (100 - b.independence)) * 0.45 - Math.max(0, b.companionship - (100 - a.independence)) * 0.45) },
      { name: "依赖程度接近", value: clamp(resonance(a.dependency, b.dependency) * 0.6 + 20) },
    ],
    communication: [
      { name: "开口习惯接近", value: resonance(a.communication, b.communication) },
      { name: "表达习惯接近", value: resonance(a.emotionExpression, b.emotionExpression) },
      { name: "回复敏感和表达之间的空档", value: clamp(100 - gap(a.replySensitivity, b.emotionExpression) * 0.5) },
    ],
    security: [
      { name: "冲突风险留下的安心空间", value: clamp(100 - risk) },
      { name: "A的安心需求有没有被B的投入接住", value: clamp(100 - Math.max(0, a.securityNeed - b.investment) * 0.6) },
      { name: "B的安心需求有没有被A的投入接住", value: clamp(100 - Math.max(0, b.securityNeed - a.investment) * 0.6) },
      { name: "安心需求本身是否接近", value: clamp(resonance(a.securityNeed, b.securityNeed) * 0.4 + 40) },
    ],
    freedom: [
      { name: "边界感接近", value: resonance(a.boundary, b.boundary) },
      { name: "双方是否都需要独立", value: a.independence >= 68 && b.independence >= 68 ? 86 : 70 },
      { name: "独立是否挤压对方的陪伴", value: clamp(100 - Math.max(0, a.independence - (100 - b.companionship), b.independence - (100 - a.companionship)) * 0.3) },
    ],
    spark: [
      { name: "新鲜感的平均水平", value: clamp((a.novelty + b.novelty) / 2) },
      { name: "抽象浓度的平均水平", value: clamp((a.abstract + b.abstract) / 2) },
      { name: "投入带来的热度", value: clamp((a.investment + b.investment) / 2 * 0.7 + 15) },
    ],
    stability: [
      { name: "冲突风险的反向空间", value: clamp(100 - risk) },
      { name: "理性的平均水平", value: clamp((a.rationality + b.rationality) / 2) },
      { name: "新鲜感落差", value: clamp(100 - gap(a.novelty, b.novelty) * 0.4) },
      { name: "是否都不会急着升级冲突", value: a.conflictInitiative <= 45 && b.conflictInitiative <= 45 ? 74 : 60 },
    ],
    abstract: [
      { name: "抽象浓度的平均水平", value: clamp((a.abstract + b.abstract) / 2) },
      { name: "更高的那一侧抽象浓度", value: clamp(Math.max(a.abstract, b.abstract)) },
    ],
  };
}

function indicesDetailed(a: DimensionScores, b: DimensionScores, indices: RelationshipIndices): IndexDetail[] {
  const parts = indexParts(a, b);
  return INDEX_KEYS.map((key) => {
    const value = indices[key];
    const level = indexLevel(value);
    const dims = INDEX_DIMS[key];
    return {
      key,
      label: INDEX_LABELS[key],
      value,
      level: level.level,
      levelLabel: level.label,
      summary: `${INDEX_LABELS[key]}为${value}，当前${level.label}。`,
      explanation: `${INDEX_LABELS[key]}看的是${parts[key].map((part) => part.name).join("、")}。${factorLine(parts[key])}`,
      evidence: dims.map((dim) => `A的${DIMENSION_LABELS[dim]}为${a[dim]}，B的${DIMENSION_LABELS[dim]}为${b[dim]}。`),
    };
  });
}

function confidenceOf(tier: SelectionTier, score: number, eligibility: number, gap: number, evidence: RelationshipEvidence[]) {
  const wordingStrength = wordingStrengthFor(tier);
  const prefix = wordingStrength === "strong"
    ? "很典型的一点是，"
    : wordingStrength === "moderate"
      ? "比较明显的一点是，"
      : "在当前结果中，更接近的一点是，";
  return {
    selectionTier: tier,
    score,
    eligibility,
    top1Top2Gap: gap,
    typicality: clamp(eligibility * 0.75 + Math.min(gap, 25)),
    wordingStrength,
    reasons: evidence
      .filter((item) => item.strength >= (wordingStrength === "strong" ? 60 : wordingStrength === "moderate" ? 45 : 1))
      .sort((left, right) => right.strength - left.strength || left.id.localeCompare(right.id))
      .slice(0, wordingStrength === "tentative" ? 3 : 5)
      .map((item) => ({ id: item.id, strength: clamp(item.strength), text: `${prefix}${item.text}` })),
  };
}

function rejectedStrength(text: string): boolean {
  return /不是突出|不能写成|只是数值接近|暂时不像|还不是/.test(text);
}

function strengthsOf(indices: RelationshipIndices, similarities: FactItem[], complements: RelationshipArchive["complements"]): StrengthItem[] {
  const items: Array<StrengthItem & { score: number }> = [];
  for (const key of INDEX_KEYS) {
    if (indices[key] < 70) continue;
    items.push({
      score: indices[key],
      title: `${INDEX_LABELS[key]}比较稳`,
      evidence: `${INDEX_LABELS[key]}为${indices[key]}。`,
      explanation: `${INDEX_LABELS[key]}到了${indices[key]}，这是双方当前数据里比较正向的一块。`,
    });
  }
  for (const item of similarities.filter((factItem) => factItem.strength >= 60 && !rejectedStrength(factItem.explanation ?? "")).slice(0, 2)) {
    items.push({
      score: item.strength,
      title: `${DIMENSION_LABELS[item.dimensions[0]]}是共同点`,
      evidence: item.summary,
      explanation: item.explanation ?? item.summary,
    });
  }
  for (const item of [...complements.aOffers, ...complements.bOffers].filter((offer) => !offer.tension && offer.strength >= 70).slice(0, 2)) {
    items.push({
      score: item.strength,
      title: "有一块接得住的差异",
      evidence: item.summary,
      explanation: item.summary,
    });
  }
  return items
    .filter((item) => !rejectedStrength(item.explanation))
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .filter((item, index, all) => all.findIndex((other) => other.title === item.title) === index)
    .slice(0, 5)
    .map(({ title, evidence, explanation }) => ({ title, evidence, explanation }));
}

function severityFromStrength(strength: number): RiskItem["severity"] {
  if (strength >= 70) return "high";
  if (strength >= 40) return "medium";
  return "low";
}

function riskTone(level: RiskItem["severity"]): string {
  if (level === "high") return "这是当前关系中最值得优先处理的机制之一。";
  if (level === "medium") return "这比较容易出现，需要主动管理。";
  return "这值得留意，可能偶尔出现。";
}

function bothCloseHigh(a: DimensionScores, b: DimensionScores, key: DimKey, bar = 68): boolean {
  return a[key] >= bar && b[key] >= bar && !hasDirectionalEvidence(a[key], b[key]);
}

function risksOf(a: DimensionScores, b: DimensionScores): RiskItem[] {
  const replyHit = (a.replySensitivity >= 68 && b.emotionExpression <= 45 && hasDirectionalEvidence(a.replySensitivity, b.emotionExpression))
    || (b.replySensitivity >= 68 && a.emotionExpression <= 45 && hasDirectionalEvidence(b.replySensitivity, a.emotionExpression));
  const securityHit = hasDirectionalEvidence(a.securityNeed, b.securityNeed) || (a.securityNeed >= 72 && b.investment <= 45) || (b.securityNeed >= 72 && a.investment <= 45);
  const aSeeks = a.companionship >= 70 && a.companionship >= a.independence + DIRECTION_NONE;
  const bSeeks = b.companionship >= 70 && b.companionship >= b.independence + DIRECTION_NONE;
  const aSpace = a.independence >= 70 && a.independence >= a.companionship + DIRECTION_NONE;
  const bSpace = b.independence >= 70 && b.independence >= b.companionship + DIRECTION_NONE;
  const spaceHit = (aSeeks && bSpace) || (bSeeks && aSpace);
  const investHit = hasDirectionalEvidence(a.investment, b.investment);
  const emotionHit = hasDirectionalEvidence(a.emotionSensitivity, b.emotionSensitivity);
  const conflictHit = (a.conflictInitiative >= 65 && b.conflictAvoidance >= 65 && hasDirectionalEvidence(a.conflictInitiative, b.conflictInitiative))
    || (b.conflictInitiative >= 65 && a.conflictAvoidance >= 65 && hasDirectionalEvidence(a.conflictAvoidance, b.conflictAvoidance));
  const finish = (item: Omit<RiskItem, "severity" | "mechanism"> & { score: number; mechanism: string }): RiskItem => {
    const level = severityFromStrength(item.score);
    return { title: item.title, severity: level, evidence: item.evidence, mechanism: `${riskTone(level)}${item.mechanism}`, suggestion: item.suggestion };
  };
  const candidates: Array<Omit<RiskItem, "severity" | "mechanism"> & { score: number; mechanism: string }> = [];
  if (replyHit) candidates.push({
    score: clamp(Math.max(a.replySensitivity - b.emotionExpression, b.replySensitivity - a.emotionExpression) * 0.7 + 20),
    title: "回复空窗被读成态度",
    evidence: `A的已读乱想指数为${a.replySensitivity}，表达指数为${a.emotionExpression}；B的已读乱想指数为${b.replySensitivity}，表达指数为${b.emotionExpression}。`,
    mechanism: a.replySensitivity >= b.replySensitivity
      ? "A更会把回复变慢读成态度，B更慢把状态说出来。"
      : "B更会把回复变慢读成态度，A更慢把状态说出来。",
    suggestion: "预计会晚回时，先说明当前状态和大概何时再联系。",
  });
  if (securityHit && hasDirectionalEvidence(a.securityNeed, b.securityNeed)) candidates.push({
    score: clamp(Math.abs(a.securityNeed - b.securityNeed) * 1.2),
    title: "安全感需求没有对齐",
    evidence: `A的安心需求为${a.securityNeed}，B的安心需求为${b.securityNeed}。`,
    mechanism: a.securityNeed > b.securityNeed
      ? "A更需要确认，B更容易把反复确认理解成不信任。"
      : "B更需要确认，A更容易把反复确认理解成不信任。",
    suggestion: "用一句具体事实说明关系还在，而不是等对方来猜。",
  });
  if (spaceHit) candidates.push({
    score: clamp(Math.max(Math.abs(a.companionship - b.independence), Math.abs(b.companionship - a.independence))),
    title: "靠近和独处抢同一个时段",
    evidence: `A的黏人指数为${a.companionship}、独处充电指数为${a.independence}；B的黏人指数为${b.companionship}、独处充电指数为${b.independence}。`,
    mechanism: aSeeks ? "A更用靠近确认关系，B更用后退恢复电量。" : "B更用靠近确认关系，A更用后退恢复电量。",
    suggestion: "把独处和相处都约出结束时间，而不是临时互相说服。",
  });
  if (investHit) candidates.push({
    score: clamp(Math.abs(a.investment - b.investment) * 1.3),
    title: "投入看起来不对称",
    evidence: `A的上头指数为${a.investment}，B的上头指数为${b.investment}。`,
    mechanism: a.investment > b.investment ? "A更用安排表达在乎，B保留自己的节奏。" : "B更用安排表达在乎，A保留自己的节奏。",
    suggestion: "只约定一件双方都确认的小事，并写明谁来发起。",
  });
  if (emotionHit) candidates.push({
    score: clamp(Math.abs(a.emotionSensitivity - b.emotionSensitivity) * 1.2),
    title: "情绪识别速度不同",
    evidence: `A的情绪雷达为${a.emotionSensitivity}，B的情绪雷达为${b.emotionSensitivity}。`,
    mechanism: directionLevel(a.emotionSensitivity, b.emotionSensitivity) === "clear"
      ? (a.emotionSensitivity > b.emotionSensitivity ? "A更快感到气氛变化，B还停留在事情本身。" : "B更快感到气氛变化，A还停留在事情本身。")
      : "两边对气氛的敏感度有一点差别，还没到完全错位。",
    suggestion: "先说观察到的具体变化，再问对方是不是也有同样感觉。",
  });
  if (conflictHit) {
    const aPursues = a.conflictInitiative >= b.conflictInitiative;
    candidates.push({
      score: clamp(Math.max(a.conflictInitiative, b.conflictInitiative) * 0.4 + Math.max(a.conflictAvoidance, b.conflictAvoidance) * 0.35 + Math.abs(a.communication - b.communication) * 0.25),
      title: "冲突节奏互相加码",
      evidence: `A的吵架解决欲为${a.conflictInitiative}、冷静指数为${a.conflictAvoidance}、开麦指数为${a.communication}；B的吵架解决欲为${b.conflictInitiative}、冷静指数为${b.conflictAvoidance}、开麦指数为${b.communication}。`,
      mechanism: aPursues ? "A更想马上把话说完，B更需要先暂停。" : "B更想马上把话说完，A更需要先暂停。",
      suggestion: "需要暂停时，先说清回来继续的时间，暂停期间不再追加质问。",
    });
  }
  const shared: Array<Omit<RiskItem, "severity" | "mechanism"> & { score: number; mechanism: string }> = [];
  if (bothCloseHigh(a, b, "independence")) shared.push({
    score: clamp(((a.independence + b.independence) / 2 - 50) * 1.6),
    title: "空间给得太默契",
    evidence: `A的独处充电指数为${a.independence}，B为${b.independence}；黏人指数分别是${a.companionship}和${b.companionship}。`,
    mechanism: "你们两个人都同时需要陪伴和空间，因此真正容易出现的问题不是谁追谁逃，而是双方都默认对方理解自己的节奏。",
    suggestion: "即使感觉差不多，也用一句事实确认彼此理解的是同一件事。",
  });
  if (bothCloseHigh(a, b, "communication")) shared.push({
    score: clamp(((a.communication + b.communication) / 2 - 50) * 1.4),
    title: "都以为自己已经说清楚",
    evidence: `A的开麦指数为${a.communication}，B的开麦指数为${b.communication}。`,
    mechanism: "两个人都比较愿意开口，也因此都可能觉得自己已经表达清楚，却没有确认对方理解的是同一件事。",
    suggestion: "说完一件事后，让对方用一句自己的话复述回来。",
  });
  if (bothCloseHigh(a, b, "conflictInitiative")) shared.push({
    score: clamp(((a.conflictInitiative + b.conflictInitiative) / 2 - 50) * 1.4),
    title: "两边都想马上推进",
    evidence: `A的吵架解决欲为${a.conflictInitiative}，B的吵架解决欲为${b.conflictInitiative}。`,
    mechanism: "两个人都想尽快处理问题，容易抢着进入解决方案，谁都还没被听完。",
    suggestion: "下一次同时想说完时，轮流各说一句，听完再回应。",
  });
  const picked = (candidates.length > 0 ? candidates : shared)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, candidates.length > 0 ? 3 : 2);
  if (picked.length > 0) return picked.map(finish);
  return [{
    title: "目前没有拉开的消耗机制",
    severity: "low",
    evidence: "主要维度还没有形成对立角色。",
    mechanism: "这值得留意，可能偶尔出现。双方还没有分成两个对立角色，不需要提前写成严重矛盾。",
    suggestion: "维持把状态说具体就够，不必为了预防而增加质问。",
  }];
}

function replyStance(scores: DimensionScores): "worry" | "quiet" | "wait" {
  if (scores.replySensitivity >= 65 && scores.replySensitivity >= scores.emotionExpression + MIN_GAP) return "worry";
  if (scores.emotionExpression <= 40) return "quiet";
  return "wait";
}

function spaceStance(scores: DimensionScores): "seek" | "space" | "mixed" {
  if (scores.companionship >= scores.independence + MIN_GAP && scores.companionship >= 65) return "seek";
  if (scores.independence >= scores.companionship + MIN_GAP && scores.independence >= 65) return "space";
  return "mixed";
}

function thinkStance(scores: DimensionScores): "logic" | "feeling" | "mixed" {
  if (scores.rationality >= 70 && scores.rationality >= scores.emotionSensitivity + MIN_GAP) return "logic";
  if (scores.emotionSensitivity >= 70 && scores.emotionSensitivity >= scores.rationality + MIN_GAP) return "feeling";
  return "mixed";
}

function misunderstandingsOf(a: DimensionScores, b: DimensionScores): MisunderstandingDetail[] {
  const items: MisunderstandingDetail[] = [];
  const replyA = replyStance(a);
  const replyB = replyStance(b);
  if (replyA !== replyB) {
    items.push({
      title: "回复变慢被理解成关系变化",
      trigger: "一方超过平时节奏还没有回复。",
      aInterpretation: replyA === "worry" ? "A会先怀疑是不是自己做错了什么。" : replyA === "quiet" ? "A多半只是还没准备好开口。" : "A会先等一等，不立刻下结论。",
      bInterpretation: replyB === "worry" ? "B会先怀疑是不是自己做错了什么。" : replyB === "quiet" ? "B多半只是还没准备好开口。" : "B会先等一等，不立刻下结论。",
      reality: "两边对同一段空窗使用了不同读法。",
      repair: "先说明正在忙，并给出大概恢复联系的时间。",
    });
  }
  const spaceA = spaceStance(a);
  const spaceB = spaceStance(b);
  if (spaceA !== spaceB && spaceA !== "mixed" && spaceB !== "mixed") {
    items.push({
      title: "想独处被理解成想离开",
      trigger: "一方提出要自己待一会儿。",
      aInterpretation: spaceA === "seek" ? "A容易把距离读成关系变淡。" : "A把独处当成恢复，不是拒绝。",
      bInterpretation: spaceB === "seek" ? "B容易把距离读成关系变淡。" : "B把独处当成恢复，不是拒绝。",
      reality: "靠近和充电使用了不同的语言。",
      repair: "说清独处到什么时候结束，以及结束后如何再联系。",
    });
  }
  const thinkA = thinkStance(a);
  const thinkB = thinkStance(b);
  if (thinkA !== thinkB && thinkA !== "mixed" && thinkB !== "mixed") {
    items.push({
      title: "讲办法被理解成不在乎感受",
      trigger: "气氛已经变了，一方开始分析原因。",
      aInterpretation: thinkA === "logic" ? "A会先找原因和下一步。" : "A需要先确认感受被看见。",
      bInterpretation: thinkB === "logic" ? "B会先找原因和下一步。" : "B需要先确认感受被看见。",
      reality: "一边在处理问题，一边还在等情绪被接住。",
      repair: "先复述对方的感受，再给一个具体办法。",
    });
  }
  return items;
}

function reaction(scores: DimensionScores, name: "A" | "B", pattern: ConflictPattern): string {
  if (pattern === "low-conflict") return `${name}的第一反应和对方接近，会先看气氛，而不是立刻追问或消失。`;
  if (pattern === "logic-emotion") {
    return scores.rationality >= scores.emotionSensitivity
      ? `${name}的第一反应是把事情理顺，容易跳过情绪确认。`
      : `${name}的第一反应是先确认感受有没有被看见。`;
  }
  if (scores.conflictInitiative >= 65 && scores.conflictInitiative >= scores.conflictAvoidance + 8) return `${name}的第一反应是想马上说清楚。`;
  if (scores.conflictAvoidance >= 65 && scores.conflictAvoidance >= scores.conflictInitiative) return `${name}的第一反应是先缓一缓。`;
  return `${name}的第一反应是先看气氛，确认安全后才说出真实想法。`;
}

export function conflictPatternOf(a: DimensionScores, b: DimensionScores): ConflictPattern {
  const initiativeGap = Math.abs(a.conflictInitiative - b.conflictInitiative);
  const avoidanceGap = Math.abs(a.conflictAvoidance - b.conflictAvoidance);
  const aPursue = a.conflictInitiative >= 65 && a.conflictInitiative >= a.conflictAvoidance + 8;
  const bPursue = b.conflictInitiative >= 65 && b.conflictInitiative >= b.conflictAvoidance + 8;
  const aWithdraw = a.conflictAvoidance >= 65 && a.conflictAvoidance >= a.conflictInitiative;
  const bWithdraw = b.conflictAvoidance >= 65 && b.conflictAvoidance >= b.conflictInitiative;
  if ((aPursue && bWithdraw) || (bPursue && aWithdraw)) return "pursue-withdraw";
  if (aPursue && bPursue && initiativeGap <= 12) return "mutual-pursue";
  if (aWithdraw && bWithdraw && avoidanceGap <= 12 && initiativeGap <= 12) return "low-conflict";
  if (aWithdraw && bWithdraw) return "mutual-withdraw";
  const logicEmotion = (a.rationality >= 70 && b.emotionSensitivity >= 70 && Math.abs(a.rationality - b.rationality) >= MIN_GAP)
    || (b.rationality >= 70 && a.emotionSensitivity >= 70 && Math.abs(a.emotionSensitivity - b.emotionSensitivity) >= MIN_GAP);
  if (logicEmotion) return "logic-emotion";
  if (initiativeGap <= 12 && avoidanceGap <= 12) return "low-conflict";
  return "low-conflict";
}

function conflictCycleOf(a: DimensionScores, b: DimensionScores): ConflictCycle {
  const pattern = conflictPatternOf(a, b);
  const cycles: Record<ConflictPattern, Omit<ConflictCycle, "pattern" | "aFirstReaction" | "bFirstReaction">> = {
    "pursue-withdraw": {
      triggers: ["问题出现后，一边想马上说完，一边需要先停住"],
      escalation: "追问提高频率，沉默就变得更短、更硬。",
      loop: "追问带来沉默，沉默又被解释成不在乎，于是追问继续。",
      breakpoint: "在第二轮追问开始前停住，改成约定回来继续的时间。",
      repairPlan: "暂停时必须说出回来的时间，回来后只谈一件事。",
    },
    "mutual-pursue": {
      triggers: ["两边都想立刻把话说完"],
      escalation: "两个人同时证明自己，音量和理由一起变多。",
      loop: "谁都没被听完，于是双方都再说一遍。",
      breakpoint: "先轮流各说一句，对方复述后再进入办法。",
      repairPlan: "每人只用一句「我感到什么、我需要什么」，然后只定一个下一步。",
    },
    "mutual-withdraw": {
      triggers: ["气氛变紧后两边都想先退出"],
      escalation: "谁也不开口，空档被两边同时补成冷淡。",
      loop: "一起沉默，一起等待对方先低头，事情就停在那里。",
      breakpoint: "由当时先注意到的人发一句很短的状态，而不是长篇质问。",
      repairPlan: "约一个很短的返回时间，回来只确认关系还在，不立刻复盘全部。",
    },
    "logic-emotion": {
      triggers: ["气氛已经变了，一边开始分析，一边还在等被理解"],
      escalation: "方案来得越快，感受越像被跳过。",
      loop: "讲道理被听成冷，讲感受被听成不解决问题，两边都再加码。",
      breakpoint: "先用一句复述感受，再决定要不要给办法。",
      repairPlan: "感受先落地，方案放到第二句。",
    },
    "low-conflict": {
      triggers: ["节奏接近时，真正的风险是一起忽略一件还没说清的小事"],
      escalation: "因为不像冲突，所以两边都默认对方懂了。",
      loop: "相似让人省去确认，未说出口的需要就一直停着。",
      breakpoint: "即使感觉差不多，也把需要说成一句具体的话。",
      repairPlan: "用一句事实确认彼此理解的是同一件事，而不是靠默契猜。",
    },
  };
  return { pattern, aFirstReaction: reaction(a, "A", pattern), bFirstReaction: reaction(b, "B", pattern), ...cycles[pattern] };
}

function boundariesFor(scores: DimensionScores, name: "A" | "B"): string[] {
  const lines: Array<{ score: number; text: string }> = [];
  if (scores.replySensitivity >= 60) lines.push({ score: scores.replySensitivity, text: `不要让${name}在没有说明的情况下长时间等待回复。` });
  if (scores.boundary >= 60 || scores.independence >= 65) lines.push({ score: scores.boundary + scores.independence, text: `不要在${name}已经说要独处时继续贴着追问。` });
  if (scores.securityNeed >= 65) lines.push({ score: scores.securityNeed, text: `不要用玩笑否定${name}对确定感的需要。` });
  if (scores.emotionExpression <= 40) lines.push({ score: 80 - scores.emotionExpression, text: `不要把${name}的短暂沉默直接定性成冷漠。` });
  if (scores.conflictAvoidance >= 65) lines.push({ score: scores.conflictAvoidance, text: `不要在${name}要求暂停时连续追加质问。` });
  if (scores.companionship >= 70) lines.push({ score: scores.companionship, text: `不要临时取消已经约好的相处，却不给${name}一个替代时间。` });
  return [...new Set(lines.sort((left, right) => right.score - left.score).map((item) => item.text))].slice(0, 3);
}

function sameDimensionWhy(_title: string, label: string, left: number, right: number): string {
  const level = directionLevel(left, right);
  if (level === "none") {
    return `这是大多数关系都值得提前约定的场景。A的${label}为${left}，B的${label}为${right}，两人比较接近，所以重点不是分出谁更高，而是把做法说清楚。`;
  }
  const higher = left >= right ? "A" : "B";
  const lower = left >= right ? "B" : "A";
  if (level === "mild") return `A的${label}为${left}，B的${label}为${right}。${higher}略高一些，说话时可以多照顾${lower}的节奏。`;
  return `A的${label}为${left}，B的${label}为${right}。${higher}明显更高，这个场景值得按这个差别提前说好。`;
}

function extraWhy(focus: boolean, line: string): string {
  return focus
    ? `这是你们当前比较值得准备的场景。${line}`
    : `这是一个实用备用场景，不代表你们已经出现了严重问题。${line}`;
}

function scenariosOf(a: DimensionScores, b: DimensionScores): CommunicationScenario[] {
  const core: CommunicationScenario[] = [
    {
      title: "消息暂时没回复",
      whySelected: sameDimensionWhy("消息暂时没回复", "已读乱想指数", a.replySensitivity, b.replySensitivity),
      aScript: "A可以说：我看到回复变慢会不安，你方便时告诉我大概什么时候能回。",
      bScript: "B可以说：我现在在忙，不是对你有意见，稍后我会回来回复。",
      whyItWorks: "把猜测换成时间和状态。",
    },
    {
      title: "气氛不对需要谈一谈",
      whySelected: !hasDirectionalEvidence(a.conflictInitiative, b.conflictInitiative) && !hasDirectionalEvidence(a.conflictAvoidance, b.conflictAvoidance)
        ? "这是大多数关系都值得提前约定的场景。你们目前没有表现出特别强的冲突节奏差异，因此重点不是谁更主动，而是把什么时候继续谈说清楚。"
        : `A的吵架解决欲为${a.conflictInitiative}，B的冷静指数为${b.conflictAvoidance}。${a.conflictInitiative >= b.conflictInitiative ? "A更倾向当下把问题说开，B更需要先缓冲" : "B更倾向当下把问题说开，A更需要先缓冲"}，所以这个场景值得提前约好暂停和返回方式。`,
      aScript: "A可以说：我想谈刚才那件事，也可以等你准备好，我们定一个时间。",
      bScript: "B可以说：我需要先缓一下，今晚或明天的具体时间再继续。",
      whyItWorks: "谈的是时间和感受，不是先判对错。",
    },
    {
      title: "想靠近或想独处",
      whySelected: !hasDirectionalEvidence(a.companionship, b.companionship) && !hasDirectionalEvidence(a.independence, b.independence)
        ? "这是大多数关系都值得提前约定的场景。你们目前没有特别强的靠近和独处落差，重点是把相处和独处的时间说具体。"
        : `A的黏人指数为${a.companionship}，B的独处充电指数为${b.independence}。${a.companionship >= b.independence ? "A更在意靠近，B更需要自己的空间" : "B更需要自己的空间，A更在意靠近"}，所以两边都要把结束时间说清楚。`,
      aScript: "A可以说：我想和你待一会儿，大约半小时，也可以改到你电量够的时候。",
      bScript: "B可以说：我想自己待一会儿，到某个时间再回来找你。",
      whyItWorks: "靠近和空间都有终点，不会互相否定。",
    },
  ];
  const extra: Array<CommunicationScenario & { score: number }> = [
    {
      score: Math.max(a.securityNeed, b.securityNeed),
      title: "缺乏安全感",
      whySelected: extraWhy(Math.max(a.securityNeed, b.securityNeed) >= 70, `A的安心需求为${a.securityNeed}，B的安心需求为${b.securityNeed}。`),
      aScript: "A可以说：我现在需要一句明确的确认，不是要你立刻解决全部问题。",
      bScript: "B可以说：关系还在，我今天能给你的确认是这一件具体的事。",
      whyItWorks: "确认被说成事实，而不是性格审判。",
    },
    {
      score: Math.max(a.emotionSensitivity, b.emotionSensitivity),
      title: "情绪低落",
      whySelected: extraWhy(Math.max(a.emotionSensitivity, b.emotionSensitivity) >= 70, `A的情绪雷达为${a.emotionSensitivity}，B的情绪雷达为${b.emotionSensitivity}。`),
      aScript: "A可以说：我有点低落，现在需要被听，先不需要方案。",
      bScript: "B可以说：我听到你低落，我先陪你说完，再问要不要一起想办法。",
      whyItWorks: "先接情绪，方案放到第二步。",
    },
    {
      score: Math.abs(a.dominance - b.dominance) + Math.abs(a.novelty - b.novelty),
      title: "临时改变计划",
      whySelected: extraWhy(Math.abs(a.dominance - b.dominance) >= DIRECTION_NONE, `A的掌舵指数为${a.dominance}，B的掌舵指数为${b.dominance}。`),
      aScript: "A可以说：计划要改，我先给两个可选时间。",
      bScript: "B可以说：我可以改，但需要知道新的时间和这是不是最后一次变更。",
      whyItWorks: "变化仍然有选项，不会只剩下一句随便。",
    },
    {
      score: Math.abs(a.conflictInitiative - b.conflictAvoidance),
      title: "吵架之后",
      whySelected: extraWhy(Math.abs(a.conflictInitiative - b.conflictAvoidance) >= DIRECTION_CLEAR, `A的吵架解决欲为${a.conflictInitiative}，B的冷静指数为${b.conflictAvoidance}。`),
      aScript: "A可以说：我先停住追问，我们在约定时间只复盘一件事。",
      bScript: "B可以说：我离开不是结束，我会在约定时间回来。",
      whyItWorks: "暂停被定义成会返回的步骤。",
    },
    {
      score: Math.max(a.companionship, b.companionship),
      title: "想获得陪伴",
      whySelected: extraWhy(Math.max(a.companionship, b.companionship) >= 70, `A的黏人指数为${a.companionship}，B的黏人指数为${b.companionship}。`),
      aScript: "A可以说：我今天想要一段不被打断的相处，大约半小时。",
      bScript: "B可以说：我可以给你这段时间，结束后我需要自己的恢复时间。",
      whyItWorks: "陪伴有长度，也给恢复留门。",
    },
    {
      score: Math.abs(a.emotionExpression - b.emotionExpression),
      title: "对方明显变冷",
      whySelected: extraWhy(hasDirectionalEvidence(a.emotionExpression, b.emotionExpression), `A的表达指数为${a.emotionExpression}，B的表达指数为${b.emotionExpression}。`),
      aScript: "A可以说：我感觉到你话变少了，我在意的是这个变化，不是要你立刻热情。",
      bScript: "B可以说：我话少是因为电量低，不是要结束关系。",
      whyItWorks: "描述变化，不给对方定罪。",
    },
    {
      score: Math.max(a.independence, b.independence),
      title: "一方特别忙",
      whySelected: extraWhy(Math.max(a.independence, b.independence) >= 70, `A的独处充电指数为${a.independence}，B的独处充电指数为${b.independence}。`),
      aScript: "A可以说：我接下来会比较忙，结束后我来找你。",
      bScript: "B可以说：我看到了，我等你说的那个时间，期间不再连续追问。",
      whyItWorks: "等待有一个说法，而不是一个假装算出来的钟点。",
    },
    {
      score: Math.abs(a.investment - b.investment),
      title: "感觉自己付出更多",
      whySelected: extraWhy(hasDirectionalEvidence(a.investment, b.investment), `A的上头指数为${a.investment}，B的上头指数为${b.investment}。`),
      aScript: "A可以说：我最近安排得更多，我需要你明确接住其中一件。",
      bScript: "B可以说：我这次负责这一件，并告诉你完成时间。",
      whyItWorks: "付出被拆成一件可完成的事。",
    },
  ];
  const ranked = extra.sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));
  const focusCount = ranked.filter((item) => item.score >= 70).length;
  const extraCount = Math.min(5, Math.max(3, focusCount));
  const picked = ranked.slice(0, extraCount);
  return [...core, ...picked].slice(0, 8).map(({ title, whySelected, aScript, bScript, whyItWorks }) => ({
    title, whySelected, aScript, bScript, whyItWorks,
  }));
}

function adviceFor(scores: DimensionScores, other: DimensionScores, name: "A" | "B", otherName: "A" | "B"): string[] {
  const lines: string[] = [];
  if (scores.conflictInitiative >= 65 && scores.conflictInitiative >= other.conflictInitiative + 12 && other.conflictAvoidance >= 60) {
    lines.push(`${name}想马上说清时，先把追问停在一句，给${otherName}缓冲时间。`);
  }
  if (scores.conflictAvoidance >= 65 && other.conflictInitiative >= scores.conflictInitiative + 12) {
    lines.push(`${name}需要暂停时，要说出回来的时间，不能直接消失。`);
  }
  if (scores.rationality >= 70 && other.emotionSensitivity >= 70 && scores.emotionSensitivity + MIN_GAP < other.emotionSensitivity) {
    lines.push(`${name}先确认${otherName}的感受被听见，再给方案。`);
  }
  if (scores.emotionSensitivity >= 70 && other.rationality >= 70 && scores.rationality + MIN_GAP < other.rationality) {
    lines.push(`${name}直接说出现在需要被听、被确认，还是要一个办法。`);
  }
  if (scores.independence >= 70 && scores.independence >= other.companionship && scores.independence >= scores.companionship + 8) {
    lines.push(`${name}需要空间时，把这段空间的结束时间说出来。`);
  }
  if (scores.companionship >= 70 && other.independence >= 70 && scores.companionship >= other.companionship + MIN_GAP) {
    lines.push(`${name}想靠近时，先给出时长，并允许${otherName}改期。`);
  }
  if (lines.length < 3 && Math.abs(scores.communication - other.communication) < MIN_GAP) {
    lines.push(`${name}和${otherName}的节奏接近，不确定时先说自己的状态，不要替对方下结论。`);
  }
  if (lines.length < 3) lines.push(`${name}下一次只提一件具体的事，并问${otherName}能不能接住。`);
  if (lines.length < 3) lines.push(`${name}听到没听懂的地方，先复述一句，再补充自己的需要。`);
  return [...new Set(lines)].slice(0, 3);
}

function patternActions(pattern: ConflictPattern): Array<{ category: ActionCategory; text: string }> {
  const pools: Record<ConflictPattern, Array<{ category: ActionCategory; text: string }>> = {
    "pursue-withdraw": [
      { category: "pause-and-return", text: "需要暂停时，先说清回来继续的时间，暂停期间不再追加质问。" },
      { category: "single-topic-conflict", text: "回来以后一次只处理一个具体问题，不把旧账一起打开。" },
      { category: "check-in", text: "平时不在吵架时，先约定一句“我需要暂停”要怎么说。" },
    ],
    "logic-emotion": [
      { category: "emotion-first", text: "气氛变了先复述感受，再决定要不要给办法。" },
      { category: "concrete-request", text: "需要被听的一方直接说出现在要倾听、确认，还是方案。" },
      { category: "single-topic-conflict", text: "一次只处理一个情绪点，不把分析和感受挤在同一句里。" },
    ],
    "low-conflict": [
      { category: "check-in", text: "即使感觉差不多，也用一句事实确认彼此理解的是同一件事。" },
      { category: "shared-plan", text: "把下一次相处写成具体时间，不要靠默契猜对方还想不想约。" },
      { category: "space-boundary", text: "空间可以继续给，但留一次主动确认，避免关系一起放假。" },
    ],
    "mutual-pursue": [
      { category: "single-topic-conflict", text: "下一次同时想说完时，轮流各说一句，听完再回应。" },
      { category: "emotion-first", text: "先确认对方听到的是哪一句，再进入办法。" },
      { category: "shared-plan", text: "谈完只留下一个下一步，并写明谁来做。" },
    ],
    "mutual-withdraw": [
      { category: "check-in", text: "下一次一起沉默时，由先注意到的人发一句很短的状态。" },
      { category: "pause-and-return", text: "退出之前说一个很短的返回时间，回来只确认关系还在。" },
      { category: "reassurance", text: "用一句事实说明关系还在，而不是等两边同时低头。" },
    ],
  };
  return pools[pattern];
}

function pairAdvice(pattern: ConflictPattern): string[] {
  const pools: Record<ConflictPattern, string[]> = {
    "pursue-withdraw": [
      "把暂停定义成会回来的步骤，而不是谈话结束。",
      "复盘时只留一个问题，其余先放下。",
      "选一件无关冲突的小事，写明谁发起。",
    ],
    "logic-emotion": [
      "感受先落地，方案放到下一句。",
      "谈完留下一个双方都认的具体时间。",
      "用一句事实确认对方听到的重点。",
    ],
    "low-conflict": [
      "默认对方懂了时，用一句事实确认你们说的是同一件事。",
      "把空间留着，同时约一个不会靠猜的相处时间。",
      "每周一次主动开口，内容可以很短。",
    ],
    "mutual-pursue": [
      "同时想说完时，强制轮流，不打断。",
      "听完先复述，再决定谁的问题先处理。",
      "结束时只保留一个共同下一步。",
    ],
    "mutual-withdraw": [
      "一起沉默时，指定一个人先发一句状态。",
      "离开前留下返回时间，回来不立刻复盘全部。",
      "用一句事实代替长时间的互相等待。",
    ],
  };
  const unique: string[] = [];
  const seen = new Set<ActionCategory>();
  for (const text of pools[pattern]) {
    const category = actionCategory(text);
    if (seen.has(category)) continue;
    seen.add(category);
    unique.push(text);
  }
  return unique.slice(0, 3);
}

function nextActionsOf(risks: RiskItem[], pattern: ConflictPattern): string[] {
  const chosen: Array<{ category: ActionCategory; text: string }> = [];
  const push = (text: string) => {
    const category = actionCategory(text);
    if (chosen.some((item) => item.category === category)) return;
    chosen.push({ category, text });
  };
  for (const risk of risks) {
    if (risk.title === "目前没有拉开的消耗机制") continue;
    push(risk.suggestion);
  }
  for (const item of patternActions(pattern)) push(item.text);
  push("选一件双方都认的小事，写明谁发起、什么时候做完。");
  push("预计会晚回时，先说明当前状态和大概何时再联系。");
  push("下一次只提一件具体的事，并问对方能不能接住。");
  return chosen.slice(0, 3).map((item) => item.text);
}

function sceneOf(name: string, pattern: ConflictPattern): DynamicScene {
  const scenes: Record<ConflictPattern, DynamicScene> = {
    "pursue-withdraw": {
      title: `${name}里最容易出现的一轮`,
      lines: [
        { speaker: "a", text: "你为什么又不说话？我们现在说清楚不行吗？" },
        { speaker: "b", text: "我不是不想说，我现在越说越乱，让我缓一下。" },
        { speaker: "a", text: "那你至少告诉我什么时候回来。" },
        { speaker: "b", text: "今晚我们继续，我不会就这样消失。" },
      ],
      punchline: "追问和暂停撞在一起，差的是返回时间。",
    },
    "mutual-pursue": {
      title: `${name}里最容易出现的一轮`,
      lines: [
        { speaker: "a", text: "你先听我说完。" },
        { speaker: "b", text: "我也有一句，你也先听我说完。" },
        { speaker: "a", text: "那我们轮流，一句一句来。" },
      ],
      punchline: "两个人都想解决，只是谁都还没被听完。",
    },
    "mutual-withdraw": {
      title: `${name}里最容易出现的一轮`,
      lines: [
        { speaker: "a", text: "……那先这样？" },
        { speaker: "b", text: "嗯，先这样。" },
        { speaker: "a", text: "我晚上发你一句，不是要马上谈完。" },
      ],
      punchline: "两边都退了一步，事情也一起停住了。",
    },
    "logic-emotion": {
      title: `${name}里最容易出现的一轮`,
      lines: [
        { speaker: "a", text: "我们先看看到底是哪里出了问题。" },
        { speaker: "b", text: "我现在不想分析，我想先知道你有没有听懂我难受。" },
        { speaker: "a", text: "我听到了。你难受。我们先停在这里，办法等一下再说。" },
      ],
      punchline: "一个已经在找原因，另一个还在等被接住。",
    },
    "low-conflict": {
      title: `${name}里最容易出现的一轮`,
      lines: [
        { speaker: "a", text: "我们好像都挺会给对方空间。" },
        { speaker: "b", text: "是。给着给着，我都不确定你还想不想约。" },
        { speaker: "a", text: "想。那就约一个具体时间，别靠猜。" },
      ],
      punchline: "不是谁追谁逃，是两个人都默认对方懂了。",
    },
  };
  return scenes[pattern];
}

function roastOf(name: string, pattern: ConflictPattern, who: WhoMoreInput | undefined): string {
  const lean = who && !who.tie && who.winner && who.winner !== "tie" && Math.abs(who.aPercent - who.bPercent) >= 20
    ? (who.id === "initiate"
      ? "先开口这件事，基本已经被一边接住了。"
      : who.id === "alone"
        ? "谁更需要独处，已经能从相处里看出来。"
        : "")
    : "";
  const lines: Record<ConflictPattern, string> = {
    "low-conflict": `${name}很会给空间，给着给着差点把关系也一起放假。`,
    "logic-emotion": `${name}里，一个已经开始排查原因，另一个还在等被接住。`,
    "pursue-withdraw": `${name}里，一个准备现场把话说完，另一个已经想先把通知关掉。`,
    "mutual-pursue": `${name}开会开得很快，只是两份发言稿同时按下了发送。`,
    "mutual-withdraw": `${name}的默契是一起沉默，沉默本身还不能把问题解决。`,
  };
  return `${lines[pattern]}${lean}`;
}

function summaryOf(input: {
  relationshipName: string;
  wording: WordingStrength;
  aName: string;
  bName: string;
  confidenceScore: number;
  eligibility: number;
  indices: IndexDetail[];
  similarities: FactItem[];
  differences: FactItem[];
  complements: RelationshipArchive["complements"];
  strengths: StrengthItem[];
  risks: RiskItem[];
  cycle: ConflictCycle;
  scenario: CommunicationScenario | undefined;
}): string {
  const close = input.wording === "strong"
    ? "可以把这份结果当成当前稳定的相处说明书。"
    : input.wording === "moderate"
      ? "可以把它当成当前比较明显的倾向，而不是唯一解释。"
      : "只能把它当成暂时更接近的结构，不能写成定论。";
  const rankedIndices = input.indices.slice().sort((left, right) => right.value - left.value);
  const parts = [
    `${LEAD[input.wording]}「${input.relationshipName}」。关系分数是${input.confidenceScore}，成立度是${input.eligibility}。`,
    `A目前更接近${input.aName}，B目前更接近${input.bName}。`,
    rankedIndices[0] && rankedIndices[1] ? `目前比较突出的是${rankedIndices[0].label}${rankedIndices[0].value}，和${rankedIndices[1].label}${rankedIndices[1].value}。` : "",
    input.similarities[0] ? `共同点里最清楚的是：${input.similarities[0].explanation ?? input.similarities[0].summary}` : "目前还没有足够突出、偏离中间的共同特质。",
    input.differences.length > 0 ? `真正拉开的地方是：${input.differences[0]?.summary ?? ""}` : "双方目前没有特别突出的结构性差异，不要把细小数值差写成主要矛盾。",
    input.complements.aOffers[0] || input.complements.bOffers[0]
      ? `互补成立的部分：${input.complements.aOffers[0]?.summary ?? ""}${input.complements.bOffers[0]?.summary ?? ""}`
      : "",
    input.strengths[0] ? `最大的优势是：${input.strengths[0].explanation}` : "",
    input.risks[0] ? `最需要看住的是：${input.risks[0].mechanism}` : "",
    `可以先做的一步是：${input.cycle.breakpoint}`,
    close,
  ].filter(Boolean);
  let text = parts.join("");
  if (input.differences.length === 0) text = text.replace(/最大的不同是[^。]*。/g, "");
  if (input.complements.aOffers.length === 0 && input.complements.bOffers.length === 0) text = text.replace(/A能补上[^。]*。/g, "");
  if (input.cycle.pattern === "low-conflict") text = text.replace(/追问带来沉默[^。]*。/g, "").replace(/一个追[^。]*。/g, "");
  if (input.risks[0]?.severity === "low") text = text.replace(/最值得优先处理的机制之一/g, "值得留意的轻微倾向");
  if (text.length < 300) {
    for (const item of rankedIndices) {
      if (text.length >= 320) break;
      text += item.explanation;
    }
  }
  return text.length > 600 ? text.slice(0, 600) : text;
}

export function explainWhoMore(item: WhoMoreInput): string {
  const dims = (item.reason?.dimensions ?? []).map((key) => DIMENSION_LABELS[key]).join("、");
  if (item.tie || item.winner === "tie") return `${item.title}接近，A为${item.aPercent}，B为${item.bPercent}，参考${dims}。`;
  return `${item.title}里${item.winner === "a" ? "A更高" : "B更高"}，A为${item.aPercent}，B为${item.bPercent}，参考${dims}。`;
}

export function buildRelationshipArchive(input: {
  a: DimensionScores;
  b: DimensionScores;
  aName: string;
  bName: string;
  relationshipName: string;
  indices: RelationshipIndices;
  evidence: RelationshipEvidence[];
  tier: SelectionTier;
  score: number;
  eligibility: number;
  top1Top2Gap: number;
  whoMore: WhoMoreInput[];
}): RelationshipArchive {
  const dimensionComparison = comparisonOf(input.a, input.b);
  const similarities = takeFacts(dimensionComparison, "similar");
  const differences = takeFacts(dimensionComparison, "different");
  const complements = complementsFrom(input.a, input.b);
  const detailed = indicesDetailed(input.a, input.b, input.indices);
  const strengths = strengthsOf(input.indices, similarities, complements);
  const risks = risksOf(input.a, input.b);
  const cycle = conflictCycleOf(input.a, input.b);
  const scenarios = scenariosOf(input.a, input.b);
  const who = [...input.whoMore].sort((left, right) => Math.abs(right.aPercent - right.bPercent) - Math.abs(left.aPercent - left.bPercent))[0];
  const whoMore = input.whoMore.map((item) => ({ ...item, explanation: explainWhoMore(item) }));
  const wording = wordingStrengthFor(input.tier);
  const scene = sceneOf(input.relationshipName, cycle.pattern);
  const swapScene = (cycle.pattern === "pursue-withdraw" && input.b.conflictInitiative > input.a.conflictInitiative)
    || (cycle.pattern === "logic-emotion" && input.b.rationality > input.a.rationality);
  return {
    relationshipConfidence: confidenceOf(input.tier, input.score, input.eligibility, input.top1Top2Gap, input.evidence),
    indicesDetailed: detailed,
    dimensionComparison,
    similarities,
    differences,
    differenceSummary: differences[0]?.summary ?? "双方目前没有特别突出的结构性差异。",
    complements,
    strengths,
    risks,
    misunderstandingsDetailed: misunderstandingsOf(input.a, input.b),
    conflictCycle: cycle,
    boundaries: { forA: boundariesFor(input.a, "A"), forB: boundariesFor(input.b, "B") },
    communicationScenarios: scenarios,
    dynamicScene: swapScene ? {
      ...scene,
      lines: scene.lines.map((line) => ({ ...line, speaker: line.speaker === "a" ? "b" as const : line.speaker === "b" ? "a" as const : line.speaker })),
    } : scene,
    dynamicRoast: roastOf(input.relationshipName, cycle.pattern, who),
    adviceForA: adviceFor(input.a, input.b, "A", "B"),
    adviceForB: adviceFor(input.b, input.a, "B", "A"),
    adviceForPair: pairAdvice(cycle.pattern),
    nextActions: nextActionsOf(risks, cycle.pattern),
    finalSummary: summaryOf({
      relationshipName: input.relationshipName,
      wording,
      aName: input.aName,
      bName: input.bName,
      confidenceScore: input.score,
      eligibility: input.eligibility,
      indices: detailed,
      similarities,
      differences,
      complements,
      strengths,
      risks,
      cycle,
      scenario: scenarios[0],
    }),
    whoMore,
  };
}

export function mapPartyTokens(text: string, viewerIsA: boolean): string {
  if (viewerIsA) return text.replaceAll("A", "你").replaceAll("B", "TA");
  return text.replaceAll("A", "\u0000").replaceAll("B", "你").replaceAll("\u0000", "TA");
}

function mapSide(side: "a" | "b" | "tie", viewerIsA: boolean): "you" | "ta" | "tie" {
  if (side === "tie") return "tie";
  return (side === "a") === viewerIsA ? "you" : "ta";
}

export function mapArchive(archive: RelationshipArchive, viewerIsA: boolean) {
  const text = (value: string) => mapPartyTokens(value, viewerIsA);
  const values = <T extends { aValue: number; bValue: number }>(item: T) => viewerIsA
    ? item
    : { ...item, aValue: item.bValue, bValue: item.aValue };
  return {
    relationshipConfidence: {
      ...archive.relationshipConfidence,
      reasons: archive.relationshipConfidence.reasons.map((item) => ({ ...item, text: text(item.text) })),
    },
    indicesDetailed: archive.indicesDetailed.map((item) => ({
      ...item,
      summary: text(item.summary),
      explanation: text(item.explanation),
      evidence: item.evidence.map(text),
    })),
    dimensionComparison: archive.dimensionComparison.map((item) => ({
      ...values(item),
      higherSide: mapSide(item.higherSide, viewerIsA),
      summary: text(item.summary),
    })),
    similarities: archive.similarities.map((item) => ({
      ...values(item),
      summary: text(item.summary),
      explanation: item.explanation ? text(item.explanation) : undefined,
    })),
    differences: archive.differences.map((item) => ({
      ...values(item),
      summary: text(item.summary),
      impact: item.impact ? text(item.impact) : undefined,
    })),
    differenceSummary: text(archive.differenceSummary),
    complements: {
      youOffer: (viewerIsA ? archive.complements.aOffers : archive.complements.bOffers).map((item) => ({ ...values(item), summary: text(item.summary) })),
      taOffer: (viewerIsA ? archive.complements.bOffers : archive.complements.aOffers).map((item) => ({ ...values(item), summary: text(item.summary) })),
    },
    strengths: archive.strengths.map((item) => ({ ...item, evidence: text(item.evidence), explanation: text(item.explanation) })),
    risks: archive.risks.map((item) => ({
      ...item,
      evidence: text(item.evidence),
      mechanism: text(item.mechanism),
      suggestion: text(item.suggestion),
    })),
    misunderstandingsDetailed: archive.misunderstandingsDetailed.map((item) => ({
      title: text(item.title),
      trigger: text(item.trigger),
      yourInterpretation: text(viewerIsA ? item.aInterpretation : item.bInterpretation),
      taInterpretation: text(viewerIsA ? item.bInterpretation : item.aInterpretation),
      reality: text(item.reality),
      repair: text(item.repair),
    })),
    conflictCycle: {
      pattern: archive.conflictCycle.pattern,
      triggers: archive.conflictCycle.triggers.map(text),
      yourFirstReaction: text(viewerIsA ? archive.conflictCycle.aFirstReaction : archive.conflictCycle.bFirstReaction),
      taFirstReaction: text(viewerIsA ? archive.conflictCycle.bFirstReaction : archive.conflictCycle.aFirstReaction),
      escalation: text(archive.conflictCycle.escalation),
      loop: text(archive.conflictCycle.loop),
      breakpoint: text(archive.conflictCycle.breakpoint),
      repairPlan: text(archive.conflictCycle.repairPlan),
    },
    boundaries: {
      forYou: (viewerIsA ? archive.boundaries.forB : archive.boundaries.forA).map(text),
      forTa: (viewerIsA ? archive.boundaries.forA : archive.boundaries.forB).map(text),
    },
    communicationScenarios: archive.communicationScenarios.map((item) => ({
      title: item.title,
      whySelected: text(item.whySelected),
      youScript: text(viewerIsA ? item.aScript : item.bScript),
      taScript: text(viewerIsA ? item.bScript : item.aScript),
      whyItWorks: text(item.whyItWorks),
    })),
    dynamicScene: {
      title: text(archive.dynamicScene.title),
      lines: archive.dynamicScene.lines.map((line) => ({
        speaker: line.speaker === "system" ? "system" : line.speaker === "a" ? (viewerIsA ? "you" : "ta") : (viewerIsA ? "ta" : "you"),
        text: text(line.text),
      })),
      punchline: text(archive.dynamicScene.punchline),
    },
    dynamicRoast: text(archive.dynamicRoast),
    adviceForYou: (viewerIsA ? archive.adviceForA : archive.adviceForB).map(text),
    adviceForTa: (viewerIsA ? archive.adviceForB : archive.adviceForA).map(text),
    adviceForPair: archive.adviceForPair.map(text),
    nextActions: archive.nextActions.map(text),
    finalSummary: text(archive.finalSummary),
  };
}
