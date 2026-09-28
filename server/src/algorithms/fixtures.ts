import { EMPTY_SCORES, type DimensionScores } from "../domain/dimensions.js";

const scores = (values: Partial<DimensionScores>): DimensionScores => ({
  ...EMPTY_SCORES,
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
  ...values,
});

export const PERSONALITY_FIXTURES: ReadonlyArray<{ typeId: string; scores: DimensionScores }> = [
  { typeId: "stubborn_free_cat", scores: scores({ independence: 94, boundary: 92, conflictAvoidance: 84, emotionExpression: 18, companionship: 24, dominance: 66, replySensitivity: 28 }) },
  { typeId: "solar_clingy_dog", scores: scores({ companionship: 95, communication: 88, investment: 88, dependency: 82, independence: 12, emotionExpression: 86, novelty: 66 }) },
  { typeId: "overthink_master", scores: scores({ replySensitivity: 98, emotionSensitivity: 92, securityNeed: 88, rationality: 24, communication: 42, conflictAvoidance: 66 }) },
  { typeId: "human_buffer", scores: scores({ conflictAvoidance: 94, rationality: 84, emotionSensitivity: 60, conflictInitiative: 16, novelty: 24, companionship: 62 }) },
  { typeId: "relation_pm", scores: scores({ dominance: 96, investment: 90, communication: 82, rationality: 82, novelty: 28, conflictInitiative: 78 }) },
  { typeId: "easygoing", scores: scores({ novelty: 62, conflictAvoidance: 80, dominance: 16, investment: 30, rationality: 46, abstract: 66, emotionExpression: 34 }) },
  { typeId: "spark_extrovert", scores: scores({ communication: 94, novelty: 92, abstract: 86, emotionExpression: 88, independence: 22, conflictAvoidance: 20 }) },
  { typeId: "silent_observer", scores: scores({ communication: 16, emotionSensitivity: 86, independence: 80, emotionExpression: 18, rationality: 74, replySensitivity: 66 }) },
  { typeId: "emotion_radar", scores: scores({ emotionSensitivity: 98, replySensitivity: 88, securityNeed: 80, companionship: 76, rationality: 28, boundary: 34 }) },
  { typeId: "human_powerbank", scores: scores({ companionship: 92, emotionSensitivity: 86, emotionExpression: 82, investment: 86, conflictAvoidance: 56, independence: 18 }) },
  { typeId: "boundary_guard", scores: scores({ boundary: 98, independence: 94, rationality: 78, dependency: 12, companionship: 22, communication: 54 }) },
  { typeId: "calm_defuser", scores: scores({ rationality: 98, conflictInitiative: 82, emotionExpression: 48, emotionSensitivity: 28, dominance: 78, abstract: 18 }) },
  { typeId: "brain_drift", scores: scores({ abstract: 99, novelty: 90, communication: 68, rationality: 24, investment: 48, emotionExpression: 70 }) },
  { typeId: "relation_scout", scores: scores({ investment: 92, replySensitivity: 90, emotionSensitivity: 88, securityNeed: 84, communication: 60, independence: 24 }) },
  { typeId: "whatever_bro", scores: scores({ emotionExpression: 16, dominance: 22, conflictAvoidance: 84, rationality: 68, boundary: 76, communication: 32 }) },
  { typeId: "soft_defense_tower", scores: scores({ conflictAvoidance: 76, emotionExpression: 24, securityNeed: 80, investment: 82, independence: 70, companionship: 62, boundary: 80 }) },
];

const pair = (
  typeId: string,
  a: Partial<DimensionScores>,
  b: Partial<DimensionScores>,
): { typeId: string; a: DimensionScores; b: DimensionScores } => ({ typeId, a: scores(a), b: scores(b) });

export const RELATIONSHIP_FIXTURES: ReadonlyArray<{
  typeId: string;
  a: DimensionScores;
  b: DimensionScores;
}> = [
  pair("iceberg_sun", { independence: 92, rationality: 90, emotionExpression: 8, companionship: 22 }, { independence: 25, companionship: 92, emotionExpression: 94, rationality: 38 }),
  pair("stubborn_soft", { emotionExpression: 8, conflictAvoidance: 94, independence: 62 }, { emotionExpression: 58, emotionSensitivity: 90, investment: 92, companionship: 62 }),
  pair("cat_dog", { independence: 94, companionship: 8, dependency: 25, boundary: 48 }, { independence: 8, companionship: 94, dependency: 38, boundary: 45 }),
  pair("plan_go_with_flow", { dominance: 96, rationality: 92, novelty: 25 }, { dominance: 5, rationality: 38, novelty: 94, investment: 38 }),
  pair("detective_missing", { replySensitivity: 98, securityNeed: 92, communication: 62 }, { communication: 5, emotionExpression: 8, independence: 68, replySensitivity: 22 }),
  pair("clingy_free", { companionship: 98, dependency: 92, independence: 10, boundary: 34 }, { companionship: 18, dependency: 12, independence: 98, boundary: 94 }),
  pair("rational_emotional", { rationality: 98, emotionSensitivity: 8, emotionExpression: 38 }, { rationality: 8, emotionSensitivity: 98, emotionExpression: 88 }),
  pair("active_passive", { communication: 98, dominance: 94, conflictInitiative: 72 }, { communication: 5, dominance: 8, conflictAvoidance: 56 }),
  pair("social_battery", { communication: 98, novelty: 92, abstract: 58 }, { communication: 4, novelty: 35, independence: 90, emotionSensitivity: 45 }),
  pair("spotlight_lowkey", { communication: 92, novelty: 98, abstract: 96, emotionExpression: 82 }, { communication: 12, novelty: 8, abstract: 25, independence: 62 }),
  pair("radar_wood", { emotionSensitivity: 98, replySensitivity: 92, emotionExpression: 62 }, { emotionSensitivity: 5, emotionExpression: 8, rationality: 62 }),
  pair("pm_slacker", { dominance: 98, investment: 96, rationality: 72 }, { dominance: 5, investment: 8, novelty: 92, conflictAvoidance: 62 }),
  pair("powder_extinguisher", { emotionSensitivity: 98, emotionExpression: 96, conflictInitiative: 88, rationality: 10 }, { rationality: 98, conflictAvoidance: 90, communication: 88, emotionExpression: 72 }),
  pair("ice_ice", { emotionExpression: 5, independence: 94, communication: 8, companionship: 28 }, { emotionExpression: 8, independence: 92, communication: 5, companionship: 25 }),
  pair("sun_sun", { companionship: 96, emotionExpression: 94, communication: 90, independence: 22 }, { companionship: 94, emotionExpression: 92, communication: 94, independence: 20 }),
  pair("spotlight_spotlight", { novelty: 96, abstract: 98, communication: 92 }, { novelty: 94, abstract: 96, communication: 94 }),
  pair("rumination_comfort", { replySensitivity: 98, emotionSensitivity: 96, securityNeed: 92, rationality: 25 }, { emotionExpression: 92, communication: 94, companionship: 92, rationality: 82 }),
  pair("hesitate_decide", { dominance: 5, conflictInitiative: 12, conflictAvoidance: 68 }, { dominance: 98, rationality: 90, conflictInitiative: 72 }),
  pair("grudge_forget", { replySensitivity: 98, investment: 94, emotionSensitivity: 88 }, { replySensitivity: 5, investment: 35, emotionSensitivity: 28, rationality: 92 }),
  pair("talk_now_later", { conflictInitiative: 98, communication: 96, emotionExpression: 72 }, { conflictAvoidance: 98, communication: 5, emotionExpression: 8, independence: 72 }),
  pair("sensitive_stable", { emotionSensitivity: 98, securityNeed: 92, replySensitivity: 82 }, { rationality: 98, emotionSensitivity: 5, replySensitivity: 8, conflictAvoidance: 62 }),
  pair("independent_independent", { independence: 98, boundary: 94, companionship: 12, dependency: 18 }, { independence: 96, boundary: 96, companionship: 10, dependency: 15 }),
  pair("together_together", { companionship: 98, dependency: 92, independence: 8, boundary: 35 }, { companionship: 96, dependency: 94, independence: 10, boundary: 38 }),
  pair("abstract_abstract", { abstract: 99, novelty: 94, communication: 62 }, { abstract: 98, novelty: 96, communication: 58 }),
];
