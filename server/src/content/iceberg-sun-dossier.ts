import type { RelationshipIndices } from "../algorithms/indices.js";
import type { DimensionScores } from "../domain/dimensions.js";

export const ICEBERG_SUN_ID = "iceberg_sun";

export type DossierParticipant = "you" | "ta";
export type TemperatureRoleMode = "clear" | "relative" | "balanced";

export interface DossierRole {
  participant: DossierParticipant;
  participantLabel: string;
  personalityName: string;
  roleLabel: "稳定锚点" | "温度发起者" | "冷暖平衡";
  symbol: "ice" | "sun" | "balance";
  temperature: number;
}

export interface TemperatureRoles {
  mode: TemperatureRoleMode;
  difference: number;
  left: DossierRole;
  right: DossierRole;
  note: string;
}

export interface IcebergSunDossier {
  version: "iceberg-sun-v1";
  relationshipType: typeof ICEBERG_SUN_ID;
  front: {
    archiveLabel: string;
    collectionNumber: string;
    caseNumber: string;
    relationshipName: string;
    subtitle: string;
    definition: string;
    roles: TemperatureRoles;
    indices: Array<{ key: keyof RelationshipIndices; label: string; value: number }>;
    formula: { firstLine: string; secondLine: string };
    keywords: string[];
    easterEgg: string;
    annotation: string;
  };
  back: {
    archiveLabel: string;
    collectionNumber: string;
    caseNumber: string;
    privateNote: {
      title: string;
      yourView: string;
      taView: string;
      bridge: string;
    };
    evidence: Array<{
      id: string;
      label: string;
      youValue: number;
      taValue: number;
      note: string;
    }>;
    bestPart: string;
    blindSpot: string;
    guides: Array<{ scenario: string; text: string }>;
    footer: string;
  };
}

interface DossierSource {
  testId: string;
  relationshipType: string;
  relationshipCode: string;
  relationshipName: string;
  subtitle: string;
  tagline: string;
  indices: RelationshipIndices;
  you: { typeName: string; dimensionScores: DimensionScores };
  ta: { typeName: string; dimensionScores: DimensionScores };
  whoMore: Array<{
    id: string;
    title: string;
    aPercent: number;
    bPercent: number;
    note: string;
  }>;
  misunderstandings: Array<{
    title: string;
    yourView: string;
    taView: string;
    bridge: string;
  }>;
  conflictPattern: { stuckAt: string };
  communicationGuide: Array<{ scenario: string; forYou: string }>;
}

const ROLE_CLEAR_THRESHOLD = 12;
const ROLE_BALANCED_THRESHOLD = 6;

export function temperatureScore(scores: DimensionScores): number {
  const score =
    scores.companionship * 0.22 +
    scores.emotionExpression * 0.2 +
    scores.communication * 0.16 +
    scores.emotionSensitivity * 0.1 +
    scores.replySensitivity * 0.08 +
    scores.securityNeed * 0.08 +
    scores.investment * 0.06 +
    (100 - scores.independence) * 0.06 +
    (100 - scores.rationality) * 0.04;
  return Math.round(score);
}

export function classifyTemperatureRoles(
  you: { typeName: string; dimensionScores: DimensionScores },
  ta: { typeName: string; dimensionScores: DimensionScores },
): TemperatureRoles {
  const youTemperature = temperatureScore(you.dimensionScores);
  const taTemperature = temperatureScore(ta.dimensionScores);
  const signedDifference = youTemperature - taTemperature;
  const difference = Math.abs(signedDifference);

  if (difference < ROLE_BALANCED_THRESHOLD) {
    return {
      mode: "balanced",
      difference,
      left: makeRole("you", you.typeName, "冷暖平衡", "balance", youTemperature),
      right: makeRole("ta", ta.typeName, "冷暖平衡", "balance", taTemperature),
      note: "你们其实比结果名字看起来更接近。",
    };
  }

  const youIsWarmer = signedDifference > 0;
  const cool = youIsWarmer
    ? makeRole("ta", ta.typeName, "稳定锚点", "ice", taTemperature)
    : makeRole("you", you.typeName, "稳定锚点", "ice", youTemperature);
  const warm = youIsWarmer
    ? makeRole("you", you.typeName, "温度发起者", "sun", youTemperature)
    : makeRole("ta", ta.typeName, "温度发起者", "sun", taTemperature);
  const mode: TemperatureRoleMode = difference >= ROLE_CLEAR_THRESHOLD ? "clear" : "relative";

  return {
    mode,
    difference,
    left: cool,
    right: warm,
    note: mode === "clear" ? "一个留住空间，一个带来回应。" : "这是相对倾向，不是给任何一方贴标签。",
  };
}

export function buildIcebergSunDossier(source: DossierSource): IcebergSunDossier | null {
  if (source.relationshipType !== ICEBERG_SUN_ID) return null;
  const observation = source.misunderstandings[0] ?? {
    title: "安静与回应使用了不同的语言",
    yourView: "你会按自己的节奏表达在乎。",
    taView: "TA 会用另一种方式确认连接。",
    bridge: "把空间和回应说具体，比让彼此猜更省力。",
  };
  const evidenceIds = new Set(["alone", "initiate"]);
  const evidence = source.whoMore
    .filter((item) => evidenceIds.has(item.id))
    .map((item) => ({
      id: item.id,
      label: item.id === "alone" ? "需要独处" : "主动靠近",
      youValue: Math.round(item.aPercent),
      taValue: Math.round(item.bPercent),
      note: item.note,
    }));
  const guides = source.communicationGuide.slice(0, 3).map((item) => ({
    scenario: shortScenario(item.scenario),
    text: item.forYou.replace(/^可以说：/, ""),
  }));

  return {
    version: "iceberg-sun-v1",
    relationshipType: ICEBERG_SUN_ID,
    front: {
      archiveLabel: "关系引力",
      collectionNumber: "01 / 24",
      caseNumber: `CASE NO. ${source.relationshipCode}-${caseSuffix(source.testId)}`,
      relationshipName: source.relationshipName,
      subtitle: source.subtitle,
      definition: source.tagline,
      roles: classifyTemperatureRoles(source.you, source.ta),
      indices: [
        { key: "rapport", label: "默契", value: Math.round(source.indices.rapport) },
        { key: "communication", label: "沟通", value: Math.round(source.indices.communication) },
        { key: "security", label: "安心", value: Math.round(source.indices.security) },
        { key: "freedom", label: "独处", value: Math.round(source.indices.freedom) },
      ],
      formula: {
        firstLine: "一点空间 + 一句回应",
        secondLine: "= 这段关系最舒服的温度。",
      },
      keywords: ["稳定陪伴", "嘴硬心软", "默契补位", "情绪托底"],
      easterEgg: "你们最浪漫的事，可能只是：一个没有追问，一个记得回来。",
      annotation: "温差，不等于距离。",
    },
    back: {
      archiveLabel: "关系引力",
      collectionNumber: "01 / 24",
      caseNumber: `CASE NO. ${source.relationshipCode}-${caseSuffix(source.testId)}`,
      privateNote: observation,
      evidence,
      bestPart: "你们珍贵的地方，是一个不急着追问，一个也没有真的走远。",
      blindSpot: source.conflictPattern.stuckAt,
      guides,
      footer: "娱乐型关系观察 · 不构成心理或医疗建议",
    },
  };
}

function makeRole(
  participant: DossierParticipant,
  personalityName: string,
  roleLabel: DossierRole["roleLabel"],
  symbol: DossierRole["symbol"],
  temperature: number,
): DossierRole {
  return {
    participant,
    participantLabel: participant === "you" ? "你" : "TA",
    personalityName,
    roleLabel,
    symbol,
    temperature,
  };
}

function caseSuffix(testId: string) {
  const suffix = testId.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase();
  return suffix || "0001";
}

function shortScenario(value: string) {
  return value.replace(/时$/, "").replace(/、需要谈一谈/, "");
}

export const ICEBERG_SUN_ROLE_THRESHOLDS = {
  balancedBelow: ROLE_BALANCED_THRESHOLD,
  clearAtOrAbove: ROLE_CLEAR_THRESHOLD,
} as const;
