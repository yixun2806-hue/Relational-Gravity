import type { DimensionScores, DimKey } from "../domain/dimensions.js";
import { clamp100 } from "./scoring.js";

export interface WhoMoreReason {
  aScore: number;
  bScore: number;
  dimensions: DimKey[];
}

export interface WhoMoreItem {
  id: string;
  title: string;
  aPercent: number;
  bPercent: number;
  aLabel: string;
  bLabel: string;
  tie: boolean;
  note: string;
  winner: "a" | "b" | "tie";
  reason: WhoMoreReason;
  explanation?: string;
}

export type WhoMoreInput = {
  id: string;
  title: string;
  aPercent: number;
  bPercent: number;
  aLabel?: string;
  bLabel?: string;
  tie: boolean;
  note: string;
  winner?: "a" | "b" | "tie";
  reason?: WhoMoreReason;
  explanation?: string;
};

export interface WhoMoreView {
  id: string;
  title: string;
  aPercent: number;
  bPercent: number;
  aLabel: "你";
  bLabel: "TA";
  tie: boolean;
  note: string;
  winner: "you" | "ta" | "tie";
  reason?: {
    youScore: number;
    taScore: number;
    dimensions: DimKey[];
  };
  explanation?: string;
}

interface Copy {
  you: string;
  ta: string;
  tie: string;
}

const COPY: Record<string, Copy> = {
  cares: { you: "投入更明显一点。", ta: "TA 把这段关系放得更靠前。", tie: "在乎程度半斤八两。" },
  overthink: { you: "三个点也能写成一部剧。", ta: "TA 的脑内小剧场更勤快。", tie: "两个人都能把空气写成剧本。" },
  triggered: { you: "气氛一变你先接收到。", ta: "TA 的雷达更灵敏。", tie: "两边都挺容易被气氛带动。" },
  alone: { you: "充电方式是把自己关一会儿。", ta: "TA 更需要自己的空间。", tie: "你们都需要一点独自呼吸的窗口。" },
  initiate: { you: "开场通常是你。", ta: "开口的人更常是 TA。", tie: "谁先说话几乎靠缘分。" },
  apologize: { you: "僵住的时候，你比较容易先开口。", ta: "先破冰的人更常是 TA。", tie: "谁先低头，今晚看运气。" },
  hardmouth: { you: "没事，你说没事。", ta: "TA 更擅长「我没事」。", tie: "两张嘴都很硬。" },
  disappear: { you: "需要空间时可能暂时掉线。", ta: "TA 更常变成短暂失踪人口。", tie: "掉线风险差不多，提前说一声就好。" },
  whatever: { you: "「都可以」是你的高频技能。", ta: "TA 更常把选择踢回来。", tie: "两个人都会把方向盘让来让去。" },
};

const LEGACY_NOTE_FOR_OTHER_VIEWER: Record<string, string> = Object.values(COPY).reduce<Record<string, string>>((acc, copy) => {
  acc[copy.you] = copy.ta;
  acc[copy.ta] = copy.you;
  acc[copy.tie] = copy.tie;
  return acc;
}, {});

function split(aRaw: number, bRaw: number): { aPercent: number; bPercent: number; tie: boolean } {
  const a = Math.max(1, aRaw);
  const b = Math.max(1, bRaw);
  const aPercent = clamp100((a / (a + b)) * 100);
  const bPercent = 100 - aPercent;
  return { aPercent, bPercent, tie: Math.abs(aPercent - 50) <= 6 };
}

function storedWinner(aPercent: number, bPercent: number, tie: boolean): "a" | "b" | "tie" {
  if (tie) return "tie";
  return aPercent >= bPercent ? "a" : "b";
}

function mapPartyTokens(text: string, viewerIsA: boolean): string {
  if (viewerIsA) return text.replaceAll("A", "你").replaceAll("B", "TA");
  return text.replaceAll("A", "\u0000").replaceAll("B", "你").replaceAll("\u0000", "TA");
}

function viewerWinner(winner: "a" | "b" | "tie", viewerIsA: boolean): "you" | "ta" | "tie" {
  if (winner === "tie") return "tie";
  const viewerSide = viewerIsA ? "a" : "b";
  return winner === viewerSide ? "you" : "ta";
}

export function mapWhoMoreItem(item: WhoMoreInput, viewerIsA: boolean): WhoMoreView {
  const winner = item.winner ?? storedWinner(item.aPercent, item.bPercent, item.tie);
  const viewed = viewerWinner(winner, viewerIsA);
  const copy = COPY[item.id];
  const note = item.winner
    ? copy?.[viewed] ?? item.note
    : viewerIsA
      ? item.note
      : LEGACY_NOTE_FOR_OTHER_VIEWER[item.note] ?? item.note;
  return {
    id: item.id,
    title: item.title,
    aPercent: viewerIsA ? item.aPercent : item.bPercent,
    bPercent: viewerIsA ? item.bPercent : item.aPercent,
    aLabel: "你",
    bLabel: "TA",
    tie: item.tie || winner === "tie",
    note,
    winner: viewed,
    reason: item.reason
      ? {
          youScore: viewerIsA ? item.reason.aScore : item.reason.bScore,
          taScore: viewerIsA ? item.reason.bScore : item.reason.aScore,
          dimensions: item.reason.dimensions,
        }
        : undefined,
    explanation: item.explanation ? mapPartyTokens(item.explanation, viewerIsA) : undefined,
  };
}

export function computeWhoMore(a: DimensionScores, b: DimensionScores): WhoMoreItem[] {
  const defs: Array<{
    id: string;
    title: string;
    a: number;
    b: number;
    dimensions: DimKey[];
  }> = [
    {
      id: "cares",
      title: "谁更在乎这段关系",
      a: a.investment * 0.7 + a.dependency * 0.3 + a.securityNeed * 0.2,
      b: b.investment * 0.7 + b.dependency * 0.3 + b.securityNeed * 0.2,
      dimensions: ["investment", "dependency", "securityNeed"],
    },
    {
      id: "overthink",
      title: "谁更容易想多",
      a: a.replySensitivity * 0.5 + a.emotionSensitivity * 0.3 + a.securityNeed * 0.2,
      b: b.replySensitivity * 0.5 + b.emotionSensitivity * 0.3 + b.securityNeed * 0.2,
      dimensions: ["replySensitivity", "emotionSensitivity", "securityNeed"],
    },
    {
      id: "triggered",
      title: "谁更容易破防",
      a: a.emotionSensitivity * 0.6 + a.securityNeed * 0.3 + (100 - a.rationality) * 0.2,
      b: b.emotionSensitivity * 0.6 + b.securityNeed * 0.3 + (100 - b.rationality) * 0.2,
      dimensions: ["emotionSensitivity", "securityNeed", "rationality"],
    },
    {
      id: "alone",
      title: "谁更需要独处",
      a: a.independence * 0.7 + a.boundary * 0.3,
      b: b.independence * 0.7 + b.boundary * 0.3,
      dimensions: ["independence", "boundary"],
    },
    {
      id: "initiate",
      title: "谁更主动沟通",
      a: a.communication * 0.6 + a.emotionExpression * 0.3 + a.conflictInitiative * 0.2,
      b: b.communication * 0.6 + b.emotionExpression * 0.3 + b.conflictInitiative * 0.2,
      dimensions: ["communication", "emotionExpression", "conflictInitiative"],
    },
    {
      id: "apologize",
      title: "谁更容易先低头",
      a: a.conflictAvoidance * 0.5 + (100 - a.dominance) * 0.3 + a.emotionExpression * 0.15,
      b: b.conflictAvoidance * 0.5 + (100 - b.dominance) * 0.3 + b.emotionExpression * 0.15,
      dimensions: ["conflictAvoidance", "dominance", "emotionExpression"],
    },
    {
      id: "hardmouth",
      title: "谁更容易嘴硬",
      a: a.conflictAvoidance * 0.35 + (100 - a.emotionExpression) * 0.4 + a.dominance * 0.2,
      b: b.conflictAvoidance * 0.35 + (100 - b.emotionExpression) * 0.4 + b.dominance * 0.2,
      dimensions: ["conflictAvoidance", "emotionExpression", "dominance"],
    },
    {
      id: "disappear",
      title: "谁更可能突然消失",
      a: a.independence * 0.45 + a.conflictAvoidance * 0.3 + (100 - a.investment) * 0.2,
      b: b.independence * 0.45 + b.conflictAvoidance * 0.3 + (100 - b.investment) * 0.2,
      dimensions: ["independence", "conflictAvoidance", "investment"],
    },
    {
      id: "whatever",
      title: "谁更容易说「都可以」",
      a: (100 - a.dominance) * 0.45 + (100 - a.conflictInitiative) * 0.3 + (100 - a.emotionExpression) * 0.25,
      b: (100 - b.dominance) * 0.45 + (100 - b.conflictInitiative) * 0.3 + (100 - b.emotionExpression) * 0.25,
      dimensions: ["dominance", "conflictInitiative", "emotionExpression"],
    },
  ];

  return defs.map((item) => {
    const splitResult = split(item.a, item.b);
    const winner = storedWinner(splitResult.aPercent, splitResult.bPercent, splitResult.tie);
    return {
      id: item.id,
      title: item.title,
      aPercent: splitResult.aPercent,
      bPercent: splitResult.bPercent,
      aLabel: "A",
      bLabel: "B",
      tie: splitResult.tie,
      note: "",
      winner,
      reason: { aScore: item.a, bScore: item.b, dimensions: item.dimensions },
    };
  });
}
