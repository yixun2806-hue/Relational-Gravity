import { describe, expect, it } from "vitest";
import { PERSONALITY_TYPES, type PersonalityTypeDef } from "../content/personalities.js";
import { QUESTIONS } from "../content/questions.js";
import { PERSONALITY_FIXTURES } from "./fixtures.js";
import { matchPersonality, SECONDARY_TYPE_THRESHOLDS, selectSecondary } from "./personality.js";
import { scoreAnswers } from "./scoring.js";

const secondary = PERSONALITY_TYPES[1] as PersonalityTypeDef;

describe("secondary personality", () => {
  it("requires both a close gap and a minimum score", () => {
    expect(selectSecondary({ score: 86 }, { type: secondary, score: 83 })?.id).toBe(secondary.id);
    expect(selectSecondary({ score: 86 }, { type: secondary, score: 61 })).toBeNull();
    expect(selectSecondary({ score: 74 }, { type: secondary, score: 68 })?.id).toBe(secondary.id);
    expect(selectSecondary({ score: 74 }, { type: secondary, score: 67 })).toBeNull();
    expect(selectSecondary({ score: 75 }, { type: secondary, score: 68 })).toBeNull();
    expect(SECONDARY_TYPE_THRESHOLDS).toEqual({ minScore: 68, maxGap: 6 });
  });
});

describe("personality reachability", () => {
  it("defines an independent constructive fixture for every personality", () => {
    expect(new Set(PERSONALITY_FIXTURES.map((item) => item.typeId))).toEqual(
      new Set(PERSONALITY_TYPES.map((item) => item.id)),
    );
  });

  it.each(PERSONALITY_FIXTURES)("reaches $typeId", ({ typeId, scores }) => {
    expect(matchPersonality(scores).typeId).toBe(typeId);
  });

  it("does not let one prototype monopolize deterministic answer-space samples", () => {
    let state = 0x5eed1234;
    const next = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    };
    const counts = new Map<string, number>();
    const sampleSize = 2_000;
    for (let sample = 0; sample < sampleSize; sample += 1) {
      const scores = scoreAnswers(QUESTIONS.map((question) => ({
        questionId: question.id,
        optionKey: question.options[Math.floor(next() * question.options.length)]!.key,
      })));
      const id = matchPersonality(scores).typeId;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const largestShare = Math.max(...counts.values()) / sampleSize;
    expect(largestShare).toBeLessThanOrEqual(0.3);
  });
});
