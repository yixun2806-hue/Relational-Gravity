import { describe, expect, it } from "vitest";
import type { DimensionScores } from "../domain/dimensions.js";
import {
  ICEBERG_SUN_ROLE_THRESHOLDS,
  buildIcebergSunDossier,
  classifyTemperatureRoles,
  temperatureScore,
} from "./iceberg-sun-dossier.js";

const base = (partial: Partial<DimensionScores> = {}): DimensionScores => ({
  communication: 50,
  replySensitivity: 50,
  securityNeed: 50,
  independence: 50,
  companionship: 50,
  emotionSensitivity: 50,
  emotionExpression: 50,
  conflictInitiative: 50,
  conflictAvoidance: 50,
  investment: 50,
  novelty: 50,
  boundary: 50,
  dominance: 50,
  dependency: 50,
  rationality: 50,
  abstract: 50,
  ...partial,
});

const cold = base({ independence: 88, companionship: 28, emotionExpression: 24, communication: 38, rationality: 84 });
const warm = base({ independence: 22, companionship: 90, emotionExpression: 84, communication: 82, emotionSensitivity: 72 });

describe("iceberg sun role strategy", () => {
  it("places a clearly colder current user on the left", () => {
    const roles = classifyTemperatureRoles(
      { typeName: "嘴硬自由猫", dimensionScores: cold },
      { typeName: "太阳能黏人狗", dimensionScores: warm },
    );
    expect(roles.mode).toBe("clear");
    expect(roles.left.participant).toBe("you");
    expect(roles.left.roleLabel).toBe("稳定锚点");
    expect(roles.right.roleLabel).toBe("温度发起者");
  });

  it("swaps positions when the current user is warmer", () => {
    const roles = classifyTemperatureRoles(
      { typeName: "太阳能黏人狗", dimensionScores: warm },
      { typeName: "嘴硬自由猫", dimensionScores: cold },
    );
    expect(roles.mode).toBe("clear");
    expect(roles.left.participant).toBe("ta");
    expect(roles.right.participant).toBe("you");
  });

  it("uses neutral roles when both temperature scores are close", () => {
    const you = base({ communication: 54 });
    const ta = base({ communication: 50 });
    const roles = classifyTemperatureRoles(
      { typeName: "沉默观察员", dimensionScores: you },
      { typeName: "人间缓冲器", dimensionScores: ta },
    );
    expect(roles.difference).toBeLessThan(ICEBERG_SUN_ROLE_THRESHOLDS.balancedBelow);
    expect(roles.mode).toBe("balanced");
    expect(roles.left.roleLabel).toBe("冷暖平衡");
    expect(roles.note).toContain("更接近");
  });

  it("keeps the composite temperature score in the display range", () => {
    expect(temperatureScore(base())).toBeGreaterThanOrEqual(0);
    expect(temperatureScore(base())).toBeLessThanOrEqual(100);
  });
});

describe("iceberg sun dossier content", () => {
  it("does not generate a dossier for another relationship", () => {
    expect(buildIcebergSunDossier(source("cat_dog"))).toBeNull();
  });

  it("maps real indices and dynamic observations", () => {
    const dossier = buildIcebergSunDossier(source("iceberg_sun"));
    expect(dossier?.front.indices.map((item) => item.value)).toEqual([81, 66, 74, 78]);
    expect(dossier?.back.privateNote.title).toBe("你们把沉默理解成了两件事");
    expect(dossier?.back.blindSpot).toContain("空白");
    expect(dossier?.back.guides).toHaveLength(3);
    expect(dossier?.back.evidence.map((item) => item.id)).toEqual(["alone", "initiate"]);
  });
});

function source(relationshipType: string) {
  return {
    testId: "12345678-1234-1234-1234-12345678abcd",
    relationshipType,
    relationshipCode: "01",
    relationshipName: "冰山 × 小太阳",
    subtitle: "冷静照顾型",
    tagline: "一个需要空间，一个需要回应。",
    indices: {
      rapport: 81,
      companionship: 72,
      communication: 66,
      security: 74,
      freedom: 78,
      spark: 69,
      stability: 80,
      abstract: 58,
    },
    you: { typeName: "嘴硬自由猫", dimensionScores: cold },
    ta: { typeName: "太阳能黏人狗", dimensionScores: warm },
    whoMore: [
      { id: "alone", title: "谁更需要独处", aPercent: 68, bPercent: 32, note: "你更需要自己的空间。" },
      { id: "initiate", title: "谁更主动沟通", aPercent: 38, bPercent: 62, note: "TA 更常主动开场。" },
    ],
    misunderstandings: [
      {
        title: "你们把沉默理解成了两件事",
        yourView: "你只是需要一点时间把情绪理顺。",
        taView: "TA 容易把突然安静理解成距离变远。",
        bridge: "先说清楚会回来，再各自缓一会儿。",
      },
    ],
    conflictPattern: { stuckAt: "一个人留下空白，另一个人会用猜测把空白填满。" },
    communicationGuide: [
      { scenario: "消息暂时没有回复时", forYou: "可以说：我现在在忙，不是对你有意见；晚一点我会回来回复。" },
      { scenario: "气氛不对、需要谈一谈时", forYou: "可以说：我需要缓一下，不是拒绝沟通；我们今晚九点继续。" },
      { scenario: "想靠近或想自己待着时", forYou: "可以说：我想自己待一会儿充电，明天下午我们再一起做点什么。" },
    ],
  };
}
