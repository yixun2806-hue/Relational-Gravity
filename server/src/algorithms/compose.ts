import { PERSONALITY_BY_ID } from "../content/personalities.js";
import { DIMENSION_KEYS, DIMENSION_LABELS, type DimKey, type DimensionScores } from "../domain/dimensions.js";
import { computeIndices, INDEX_LABELS, type RelationshipIndices } from "./indices.js";
import { matchPersonality, type PersonalityMatch } from "./personality.js";
import { matchRelationship, type RelationshipCandidate, type RelationshipEvidence } from "./relationship.js";
import { scoreAnswers, type AnswerInput } from "./scoring.js";
import { buildRelationshipArchive, type RelationshipArchive } from "./archive.js";
import { computeWhoMore, type WhoMoreInput } from "./who-more.js";
import { buildNarrative } from "../content/narratives.js";

export interface PairReportBase {
  a: PersonalityMatch & { dimensionScores: DimensionScores };
  b: PersonalityMatch & { dimensionScores: DimensionScores };
  relationshipType: string;
  relationshipCode: string;
  relationshipName: string;
  subtitle: string;
  tagline: string;
  summary: string;
  indices: RelationshipIndices;
  indexLabels: typeof INDEX_LABELS;
  dimensionLabels: typeof DIMENSION_LABELS;
  whoMore: WhoMoreInput[];
  scene: ReturnType<typeof buildNarrative>["scene"];
  roast: string;
  advice: string[];
  misunderstandings: PairDetails["misunderstandings"];
  conflictPattern: PairDetails["conflictPattern"];
  communicationGuide: PairDetails["communicationGuide"];
}

export interface PairReportV1 extends PairReportBase {
  reportVersion?: 1;
}

export interface PairReportV2 extends PairReportBase, RelationshipArchive {
  reportVersion: 2;
  relationshipCandidates: RelationshipCandidate[];
  relationshipEvidence: RelationshipEvidence[];
}

export type PairReport = PairReportV1 | PairReportV2;

export type StoredPairReport = PairReportBase & {
  reportVersion?: unknown;
  relationshipCandidates?: RelationshipCandidate[];
  relationshipEvidence?: RelationshipEvidence[];
} & Partial<Omit<RelationshipArchive, "whoMore">>;

export type ReportVersionRead =
  | { kind: "v1"; version: 1 }
  | { kind: "v2"; version: 2 }
  | { kind: "unsupported"; version: number }
  | { kind: "invalid"; version: unknown };

export function readReportVersion(report: { reportVersion?: unknown }): ReportVersionRead {
  const version = report.reportVersion;
  if (version === undefined || version === 1) return { kind: "v1", version: 1 };
  if (version === 2) return { kind: "v2", version: 2 };
  if (typeof version === "number" && Number.isFinite(version)) return { kind: "unsupported", version };
  return { kind: "invalid", version };
}

export interface PersonalHighlight {
  id: DimKey;
  label: string;
  value: number;
  description: string;
}

export interface PairDetails {
  misunderstandings: Array<{
    id: string;
    title: string;
    aView: string;
    bView: string;
    bridge: string;
  }>;
  conflictPattern: {
    title: string;
    aReaction: string;
    bReaction: string;
    stuckAt: string;
    repair: string;
  };
  communicationGuide: Array<{
    scenario: string;
    forA: string;
    forB: string;
    why: string;
  }>;
}

export function buildPersonalResult(answers: AnswerInput[]) {
  const dimensionScores = scoreAnswers(answers);
  const personality = matchPersonality(dimensionScores);
  const def = PERSONALITY_BY_ID[personality.typeId];
  return { dimensionScores, personality, def };
}

const PERSONAL_HIGH: Record<DimKey, string> = {
  communication: "你倾向于把话说出来，关系里的冷场通常不会拖太久。",
  replySensitivity: "回复速度和语气变化很容易被你捕捉到，你需要清晰的回应。",
  securityNeed: "确定感会让你更放松，模糊和反复容易消耗你。",
  independence: "你靠独处恢复电量，留出空间反而更容易保持亲近。",
  companionship: "共同经历和稳定陪伴，是你感受关系的重要方式。",
  emotionSensitivity: "你很快能觉察气氛变化，也可能比别人更容易被情绪影响。",
  emotionExpression: "你的感受通常写在脸上，直接表达比让人猜更适合你。",
  conflictInitiative: "出现问题时你想尽快说开，悬着不处理会更难受。",
  conflictAvoidance: "冲突时你会先降温，需要一点时间才能把真实想法理清。",
  investment: "一旦认定一段关系，你会主动投入时间和注意力。",
  novelty: "新鲜体验能给关系充电，一成不变容易让你失去兴致。",
  boundary: "你清楚自己的舒适区，尊重边界是亲近能持续的前提。",
  dominance: "你习惯推动决定和安排下一步，在关系中常握着方向盘。",
  dependency: "重要关系会明显影响你的状态，稳定连接对你很重要。",
  rationality: "遇到问题时你会先找原因和方案，有时需要先照顾对方的感受。",
  abstract: "你喜欢跳跃的表达和共同的梗，被人接住脑回路会让你很开心。",
};

const PERSONAL_LOW: Record<DimKey, string> = {
  communication: "你更常先观察再开口，重要感受需要刻意说得更具体。",
  replySensitivity: "你不太会把回复速度等同于关系变化，也可能低估别人等待时的焦虑。",
  securityNeed: "你能容纳关系里的不确定，但记得给需要确认的人一点回应。",
  independence: "你更习惯通过陪伴恢复状态，独处可能不像连接那么有安定感。",
  companionship: "你不需要高频黏在一起，关系对你更像各自生活里的稳定连接。",
  emotionSensitivity: "你不容易被气氛带走，细微信号也可能需要对方直接说明。",
  emotionExpression: "你习惯把情绪放在心里，别人有时会误读为不在乎。",
  conflictInitiative: "你不爱主动开启冲突话题，问题可能因此被放得更久。",
  conflictAvoidance: "矛盾出现时你更愿意正面处理，语速太快时要给对方留一点缓冲。",
  investment: "你会保留自己的节奏，不轻易让一段关系占满生活。",
  novelty: "熟悉和稳定比变化更让你安心，你更喜欢可预期的相处方式。",
  boundary: "你愿意让亲近的人进入自己的生活，也要留意是否忽略了自己的界限。",
  dominance: "你不执着于掌控方向，但长期把决定交出去也可能累积不满。",
  dependency: "你的状态较少依赖一段关系，独立是优势，主动报到能减少距离感。",
  rationality: "你会先感受再分析，被理解之后才更容易进入解决问题的状态。",
  abstract: "你偏好清楚直接的表达，面对跳跃脑回路时会更需要上下文。",
};

export function buildPersonalHighlights(scores: DimensionScores): PersonalHighlight[] {
  return DIMENSION_KEYS
    .map((id) => ({ id, value: scores[id], distance: Math.abs(scores[id] - 50) }))
    .sort((left, right) => right.distance - left.distance)
    .slice(0, 3)
    .map(({ id, value }) => ({
      id,
      label: DIMENSION_LABELS[id],
      value,
      description: value >= 50 ? PERSONAL_HIGH[id] : PERSONAL_LOW[id],
    }));
}

export function buildPairDetails(a: DimensionScores, b: DimensionScores): PairDetails {
  const candidates = [
    {
      id: "reply",
      weight: Math.max(Math.abs(a.replySensitivity - b.emotionExpression), Math.abs(b.replySensitivity - a.emotionExpression)),
      title: "回复空窗，不一定代表关系降温",
      aView: responseView(a),
      bView: responseView(b),
      bridge: "忙或想安静时给一句明确预告；等待的一方先问事实，不替沉默写结局。",
    },
    {
      id: "distance",
      weight: Math.max(Math.abs(a.companionship - b.independence), Math.abs(b.companionship - a.independence)),
      title: "想靠近和想独处，可能同时发生",
      aView: distanceView(a),
      bView: distanceView(b),
      bridge: "把陪伴和独处都约成具体时间，后退一次不等于拒绝这段关系。",
    },
    {
      id: "conflict",
      weight: Math.abs(a.conflictInitiative - b.conflictInitiative) + Math.abs(a.conflictAvoidance - b.conflictAvoidance) / 2,
      title: "一个想现在说，一个可能需要缓冲",
      aView: conflictView(a),
      bView: conflictView(b),
      bridge: "先约定何时继续谈，再暂停；暂停要有返回时间，追问也要有结束点。",
    },
    {
      id: "logic",
      weight: Math.abs(a.rationality - b.rationality) + Math.abs(a.emotionSensitivity - b.emotionSensitivity) / 2,
      title: "解决问题和接住感受，顺序很重要",
      aView: logicView(a),
      bView: logicView(b),
      bridge: "先确认对方此刻想被理解还是想找方案，再决定讲感受还是讲办法。",
    },
    {
      id: "investment",
      weight: Math.abs(a.investment - b.investment) + Math.abs(a.securityNeed - b.securityNeed) / 2,
      title: "投入的方式不同，不等于在乎程度不同",
      aView: investmentView(a),
      bView: investmentView(b),
      bridge: "各自说出一种能被看见的在乎方式，别只用自己的标准给对方打分。",
    },
  ];

  const misunderstandings = candidates
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 3)
    .map(({ weight: _weight, ...item }) => item);

  return {
    misunderstandings,
    conflictPattern: {
      title: conflictTitle(a, b),
      aReaction: reactionOf(a),
      bReaction: reactionOf(b),
      stuckAt: stuckPoint(a, b),
      repair: repairPlan(a, b),
    },
    communicationGuide: [
      {
        scenario: "消息暂时没有回复时",
        forA: replySentence(a),
        forB: replySentence(b),
        why: "把状态说清楚，能减少对方用猜测补全空白。",
      },
      {
        scenario: "气氛不对、需要谈一谈时",
        forA: conflictSentence(a),
        forB: conflictSentence(b),
        why: "说明感受、需求和返回时间，比指责或消失更容易让谈话继续。",
      },
      {
        scenario: "想靠近或想自己待着时",
        forA: distanceSentence(a),
        forB: distanceSentence(b),
        why: "具体的时间和边界，能让亲近与空间不再互相否定。",
      },
    ],
  };
}

export function buildPairReportFromScores(aScores: DimensionScores, bScores: DimensionScores): PairReportV2 {
  const aPersonality = matchPersonality(aScores);
  const bPersonality = matchPersonality(bScores);
  const indices = computeIndices(aScores, bScores);
  const rel = matchRelationship(aScores, bScores, indices);
  const narrative = buildNarrative(rel.type, aScores, bScores, indices);
  const details = buildPairDetails(aScores, bScores);
  const top = rel.candidates[0];
  const second = rel.candidates[1];
  const archive = buildRelationshipArchive({
    a: aScores,
    b: bScores,
    aName: aPersonality.typeName,
    bName: bPersonality.typeName,
    relationshipName: rel.type.name,
    indices,
    evidence: rel.evidence,
    tier: top?.tier ?? "weak",
    score: rel.score,
    eligibility: rel.eligibility,
    top1Top2Gap: rel.score - (second?.score ?? rel.score),
    whoMore: computeWhoMore(aScores, bScores),
  });

  return {
    reportVersion: 2,
    relationshipCandidates: rel.candidates,
    relationshipEvidence: rel.evidence,
    a: { ...aPersonality, dimensionScores: aScores },
    b: { ...bPersonality, dimensionScores: bScores },
    relationshipType: rel.type.id,
    relationshipCode: rel.type.code,
    relationshipName: rel.type.name,
    subtitle: rel.type.subtitle,
    tagline: rel.type.tagline,
    summary: rel.type.summary,
    indices,
    indexLabels: INDEX_LABELS,
    dimensionLabels: DIMENSION_LABELS,
    scene: narrative.scene,
    roast: narrative.roast,
    advice: narrative.advice,
    ...details,
    ...archive,
  };
}

export function buildPairReport(
  aAnswers: AnswerInput[],
  bAnswers: AnswerInput[],
): PairReportV2 {
  const a = buildPersonalResult(aAnswers);
  const b = buildPersonalResult(bAnswers);
  return buildPairReportFromScores(a.dimensionScores, b.dimensionScores);
}

function responseView(scores: DimensionScores) {
  if (scores.replySensitivity >= 62) return "回复变慢时，你更容易先确认是不是哪里出了问题。";
  if (scores.emotionExpression <= 42) return "你可能只是没准备好开口，却容易被理解成冷淡。";
  return "你通常不会只凭一次回复变化下结论，但仍需要知道对方的状态。";
}

function distanceView(scores: DimensionScores) {
  return scores.independence > scores.companionship
    ? "你更需要独处恢复，靠得太紧时会本能后退一点。"
    : "你更容易通过见面和回应确认连接，距离拉长时会有落差。";
}

function conflictView(scores: DimensionScores) {
  if (scores.conflictInitiative >= 62) return "问题出现时你想尽快说清楚，拖延会让你更焦虑。";
  if (scores.conflictAvoidance >= 62) return "气氛紧张时你需要先降温，被连续追问会更难表达。";
  return "你会观察气氛再决定要不要开口，容易等到问题自己过去。";
}

function logicView(scores: DimensionScores) {
  return scores.rationality >= 58
    ? "你习惯先梳理原因和办法，善意的分析有时会被听成不理解。"
    : "你需要先确认感受被看见，太快进入方案会让你觉得被跳过。";
}

function investmentView(scores: DimensionScores) {
  return scores.investment >= 60
    ? "你会用主动安排和持续关注表达在乎，也期待这份投入被回应。"
    : "你会保留自己的节奏，在乎未必表现为高频联系或安排。";
}

function reactionOf(scores: DimensionScores) {
  if (scores.conflictInitiative >= 68) return "你倾向于马上追问和澄清，希望问题当场结束。";
  if (scores.conflictAvoidance >= 68) return "你会先安静或离开现场，等情绪降下来再组织语言。";
  if (scores.rationality >= 65) return "你会快速分析原因并提出方案，容易跳过情绪确认。";
  return "你会先感受气氛，确认安全后才愿意把真实想法说出来。";
}

function conflictTitle(a: DimensionScores, b: DimensionScores) {
  const paceGap = Math.abs(a.conflictInitiative - b.conflictInitiative);
  if (paceGap >= 22) return "你们的矛盾常卡在处理节奏不同";
  if (a.conflictAvoidance >= 62 && b.conflictAvoidance >= 62) return "你们都想降温，问题却可能一起被搁置";
  if (a.conflictInitiative >= 62 && b.conflictInitiative >= 62) return "你们都想说清楚，容易同时抢着证明自己";
  return "你们不是没话说，而是需要更安全的开场";
}

function stuckPoint(a: DimensionScores, b: DimensionScores) {
  if (Math.max(a.replySensitivity - b.emotionExpression, b.replySensitivity - a.emotionExpression) >= 25) {
    return "敏感的一方把沉默读成态度，沉默的一方又因压力更不想说。";
  }
  if (Math.abs(a.rationality - b.rationality) >= 22) {
    return "一方急着解决问题，另一方还在等自己的感受被看见。";
  }
  return "你们容易讨论谁更有道理，却忘了先说清楚各自真正需要什么。";
}

function repairPlan(a: DimensionScores, b: DimensionScores) {
  const needsPause = a.conflictAvoidance >= 62 || b.conflictAvoidance >= 62;
  return needsPause
    ? "先用一句话确认关系仍然安全，再暂停 20—60 分钟，并约定回来继续谈的具体时间。"
    : "每人先用一句「我感到……我需要……」陈述，再轮流复述对方的意思，最后只定一个下一步。";
}

function replySentence(scores: DimensionScores) {
  return scores.replySensitivity >= 62
    ? "可以说：我看到你暂时没回，会有点不安；你方便时告诉我大概什么时候能聊。"
    : "可以说：我现在在忙，不是对你有意见；晚一点我会回来回复。";
}

function conflictSentence(scores: DimensionScores) {
  return scores.conflictAvoidance >= 62
    ? "可以说：我需要缓一下，不是拒绝沟通；我们今晚九点继续。"
    : "可以说：我现在有点着急，但我想先听懂你的感受，再说我的想法。";
}

function distanceSentence(scores: DimensionScores) {
  return scores.independence > scores.companionship
    ? "可以说：我想自己待一会儿充电，明天下午我们再一起做点什么。"
    : "可以说：我今天很想和你待一会儿，你能给我半小时完整的陪伴吗？";
}

export function teaserOf(report: PairReportBase) {
  return {
    relationshipCode: report.relationshipCode,
    relationshipName: report.relationshipName,
    subtitle: report.subtitle,
    tagline: report.tagline,
    rapport: report.indices.rapport,
    companionship: report.indices.companionship,
    spark: report.indices.spark,
    security: report.indices.security,
    abstract: report.indices.abstract,
    aTypeName: report.a.typeName,
    bTypeName: report.b.typeName,
  };
}

export const LOCKED_ITEMS = [
  { id: "cares", title: "谁更在乎这段关系" },
  { id: "overthink", title: "谁更容易想多" },
  { id: "triggered", title: "谁更容易破防" },
  { id: "alone", title: "谁更需要独处" },
  { id: "initiate", title: "谁更主动沟通" },
  { id: "mode", title: "你们最离谱的相处模式" },
  { id: "scene", title: "你们的专属名场面" },
  { id: "advice", title: "系统给你们的相处建议" },
];
