import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PERSONALITY_TYPES } from "../src/content/personalities.js";
import { QUESTIONS, type OptionKey } from "../src/content/questions.js";
import { RELATIONSHIP_TYPES } from "../src/content/relationships.js";
import { DIMENSION_KEYS, EMPTY_SCORES, type DimensionScores } from "../src/domain/dimensions.js";
import { PERSONALITY_FIXTURES, RELATIONSHIP_FIXTURES } from "../src/algorithms/fixtures.js";
import { computeIndices } from "../src/algorithms/indices.js";
import { matchPersonality } from "../src/algorithms/personality.js";
import { matchRelationship, type RelationshipCandidate, type RelationshipMatch } from "../src/algorithms/relationship.js";
import { scoreAnswers } from "../src/algorithms/scoring.js";

export interface DistributionRow {
  id: string;
  name: string;
  count: number;
  percentage: number;
  eligible: number;
  borderline: number;
  weak: number;
}

export interface DistributionSummary {
  seed: number;
  personalSamples: number;
  pairSamples: number;
  personalities: DistributionRow[];
  relationships: DistributionRow[];
  personalityHighest: DistributionRow;
  personalityLowest: DistributionRow;
  relationshipHighest: DistributionRow;
  relationshipLowest: DistributionRow;
  personalityUnreachable: string[];
  relationshipUnreachable: string[];
  tiers: { eligible: number; borderline: number; weak: number };
  tierRates: { eligible: number; borderline: number; weak: number };
  weakFallback: DistributionRow[];
  percentiles: {
    score: number[];
    eligibility: number[];
    competitionScore: number[];
    margin: number[];
    evidenceStrength: number[];
  };
  warnings: string[];
  failures: string[];
  ok: boolean;
}

const LEVELS = [0.1, 0.25, 0.5, 0.75, 0.9];

function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function percentage(count: number, total: number): number {
  if (total <= 0) return 0;
  return Number(((count / total) * 100).toFixed(2));
}

function quantile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(p * values.length) - 1));
  return Number(values[index]?.toFixed(4));
}

function percentiles(values: number[]): number[] {
  const sorted = values.slice().sort((left, right) => left - right);
  return LEVELS.map((level) => quantile(sorted, level));
}

function answerScores(next: () => number): DimensionScores {
  return scoreAnswers(QUESTIONS.map((question) => ({
    questionId: question.id,
    optionKey: question.options[Math.floor(next() * question.options.length)]?.key ?? "A",
  })));
}

function finiteInRange(value: number, max = 100): boolean {
  return Number.isFinite(value) && value >= 0 && value <= max;
}

function competitionOf(candidate: RelationshipCandidate): number {
  return (candidate as RelationshipCandidate & { competitionScore?: number }).competitionScore ?? Number.NaN;
}

function evidenceMean(candidate: RelationshipCandidate): number {
  if (candidate.evidence.length === 0) return Number.NaN;
  return candidate.evidence.reduce((sum, item) => sum + item.strength, 0) / candidate.evidence.length;
}

function rolesFlipped(forward: RelationshipMatch, reverse: RelationshipMatch): boolean {
  return forward.candidates.every((candidate, index) => {
    const other = reverse.candidates[index];
    if (!other || candidate.typeId !== other.typeId) return false;
    if (candidate.score !== other.score || candidate.eligibility !== other.eligibility) return false;
    if (candidate.roles.a !== other.roles.b || candidate.roles.b !== other.roles.a) return false;
    const flipped = candidate.evidence.map((item) => (item.role === "a" ? "b" : item.role === "b" ? "a" : "pair")).sort();
    const actual = other.evidence.map((item) => item.role).sort();
    return flipped.length === actual.length && flipped.every((role, roleIndex) => role === actual[roleIndex]);
  });
}

function vector(value: number, patch: Partial<DimensionScores> = {}): DimensionScores {
  return { ...EMPTY_SCORES, ...Object.fromEntries(DIMENSION_KEYS.map((key) => [key, value])), ...patch } as DimensionScores;
}

function checkExtremes(failures: string[]) {
  const match = (a: DimensionScores, b: DimensionScores) => matchRelationship(a, b, computeIndices(a, b));
  const expectType = (label: string, typeId: string) => {
    const fixture = RELATIONSHIP_FIXTURES.find((item) => item.typeId === typeId);
    if (!fixture || match(fixture.a, fixture.b).type.id !== typeId) failures.push(`extreme ${label} did not reach ${typeId}`);
  };
  expectType("both-high-independence", "independent_independent");
  expectType("both-high-companionship", "together_together");
  expectType("both-high-abstract", "abstract_abstract");
  expectType("both-low-expression", "ice_ice");
  expectType("sensitive-vs-stable", "sensitive_stable");
  expectType("companionship-vs-independence", "clingy_free");
  expectType("reply-vs-expression", "detective_missing");
  expectType("initiative-vs-avoidance", "talk_now_later");

  const same = vector(50);
  if (!match(same, same).candidates.every((item) => item.orientation === "symmetric")) failures.push("extreme identical neutral vectors");
  const low = vector(0);
  const high = vector(100);
  if (match(low, high).type.id !== match(high, low).type.id) failures.push("extreme opposite vectors");
  const sensitiveA = vector(50, { emotionSensitivity: 98, replySensitivity: 92 });
  const sensitiveB = vector(50, { emotionSensitivity: 95, replySensitivity: 88 });
  const sensitiveForward = match(sensitiveA, sensitiveB);
  if (sensitiveForward.type.id !== match(sensitiveB, sensitiveA).type.id || sensitiveForward.candidates.some((item) => !finiteInRange(item.score))) {
    failures.push("extreme both-high sensitivity");
  }
  for (const optionKey of ["A", "B", "C", "D"] as OptionKey[]) {
    const scores = scoreAnswers(QUESTIONS.map((question) => ({ questionId: question.id, optionKey })));
    const result = match(scores, scores);
    if (result.candidates.some((item) => !finiteInRange(item.score) || !finiteInRange(item.eligibility))) {
      failures.push(`extreme all-${optionKey}`);
    }
  }
}

function emptyRow(id: string, name: string): DistributionRow {
  return { id, name, count: 0, percentage: 0, eligible: 0, borderline: 0, weak: 0 };
}

function finishRows(rows: DistributionRow[], total: number) {
  for (const row of rows) row.percentage = percentage(row.count, total);
}

function ends(rows: DistributionRow[]): { highest: DistributionRow; lowest: DistributionRow } {
  const sorted = rows.slice().sort((left, right) => right.count - left.count || left.id.localeCompare(right.id));
  return { highest: sorted[0] ?? emptyRow("none", "none"), lowest: sorted[sorted.length - 1] ?? emptyRow("none", "none") };
}

function flagShares(label: string, rows: DistributionRow[], warnings: string[], failures: string[]) {
  for (const row of rows) {
    if (!Number.isFinite(row.percentage) || row.count < 0) failures.push(`${label} ${row.id} has an invalid count`);
    if (row.percentage > 30) failures.push(`${label} ${row.name} ${row.percentage}% exceeds 30%`);
    else if (row.percentage > 25) warnings.push(`${label} ${row.name} ${row.percentage}% is above 25%`);
  }
}

export function runDistribution(input: { personalSamples: number; pairSamples: number; seed: number }): DistributionSummary {
  const warnings: string[] = [];
  const failures: string[] = [];
  const next = lcg(input.seed);
  const personalities = PERSONALITY_TYPES.map((item) => emptyRow(item.id, item.name));
  const relationships = RELATIONSHIP_TYPES.map((item) => emptyRow(item.id, item.name));
  const personalityIndex = new Map(personalities.map((row) => [row.id, row]));
  const relationshipIndex = new Map(relationships.map((row) => [row.id, row]));
  const scores: number[] = [];
  const eligibilities: number[] = [];
  const competitions: number[] = [];
  const margins: number[] = [];
  const evidenceStrengths: number[] = [];
  const tiers = { eligible: 0, borderline: 0, weak: 0 };
  let swapMismatches = 0;
  let invalidSamples = 0;

  try {
    if (new Set(PERSONALITY_FIXTURES.map((item) => item.typeId)).size !== PERSONALITY_TYPES.length) {
      failures.push("personality fixtures are not 16/16");
    }
    if (new Set(RELATIONSHIP_FIXTURES.map((item) => item.typeId)).size !== RELATIONSHIP_TYPES.length) {
      failures.push("relationship fixtures are not 24/24");
    }
    for (const fixture of PERSONALITY_FIXTURES) {
      if (matchPersonality(fixture.scores).typeId !== fixture.typeId) failures.push(`personality fixture missed ${fixture.typeId}`);
    }
    for (const fixture of RELATIONSHIP_FIXTURES) {
      if (matchRelationship(fixture.a, fixture.b, computeIndices(fixture.a, fixture.b)).type.id !== fixture.typeId) {
        failures.push(`relationship fixture missed ${fixture.typeId}`);
      }
    }
    checkExtremes(failures);

    for (let sample = 0; sample < input.personalSamples; sample += 1) {
      const dimensionScores = answerScores(next);
      if (DIMENSION_KEYS.some((key) => !finiteInRange(dimensionScores[key]))) invalidSamples += 1;
      const id = matchPersonality(dimensionScores).typeId;
      const row = personalityIndex.get(id);
      if (!row) failures.push(`unknown personality ${id}`);
      else row.count += 1;
    }

    for (let sample = 0; sample < input.pairSamples; sample += 1) {
      const a = answerScores(next);
      const b = answerScores(next);
      const forward = matchRelationship(a, b, computeIndices(a, b));
      const reverse = matchRelationship(b, a, computeIndices(b, a));
      const top = forward.candidates[0];
      const second = forward.candidates[1];
      if (!top || !second) {
        failures.push("relationship sample missing Top2");
        continue;
      }
      if (!rolesFlipped(forward, reverse)) swapMismatches += 1;
      const competition = competitionOf(top);
      const evidence = evidenceMean(top);
      if (!finiteInRange(top.score) || !finiteInRange(top.eligibility) || !Number.isFinite(competition) || !Number.isFinite(evidence)) {
        invalidSamples += 1;
      }
      tiers[top.tier] += 1;
      const row = relationshipIndex.get(top.typeId);
      if (!row) failures.push(`unknown relationship ${top.typeId}`);
      else {
        row.count += 1;
        row[top.tier] += 1;
      }
      scores.push(top.score);
      eligibilities.push(top.eligibility);
      competitions.push(competition);
      margins.push(top.score - second.score);
      evidenceStrengths.push(evidence);
    }
    if (swapMismatches > 0) failures.push(`swap mismatch ${swapMismatches}`);
    if (invalidSamples > 0) failures.push(`invalid sample values ${invalidSamples}`);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : "distribution threw");
  }

  finishRows(personalities, input.personalSamples);
  finishRows(relationships, input.pairSamples);
  const personalityCount = personalities.reduce((sum, row) => sum + row.count, 0);
  const relationshipCount = relationships.reduce((sum, row) => sum + row.count, 0);
  if (personalityCount !== input.personalSamples) failures.push("personality counts do not sum to the sample size");
  if (relationshipCount !== input.pairSamples) failures.push("relationship counts do not sum to the sample size");
  flagShares("personality", personalities, warnings, failures);
  flagShares("relationship", relationships, warnings, failures);

  const personalityEnds = ends(personalities);
  const relationshipEnds = ends(relationships);
  const weakTotal = tiers.weak;
  const weakFallback = relationships
    .filter((row) => row.weak > 0)
    .map((row) => ({ ...row, count: row.weak, percentage: percentage(row.weak, weakTotal) }))
    .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id));

  return {
    seed: input.seed,
    personalSamples: input.personalSamples,
    pairSamples: input.pairSamples,
    personalities,
    relationships,
    personalityHighest: personalityEnds.highest,
    personalityLowest: personalityEnds.lowest,
    relationshipHighest: relationshipEnds.highest,
    relationshipLowest: relationshipEnds.lowest,
    personalityUnreachable: personalities.filter((row) => row.count === 0).map((row) => row.name),
    relationshipUnreachable: relationships.filter((row) => row.count === 0).map((row) => row.name),
    tiers,
    tierRates: {
      eligible: percentage(tiers.eligible, input.pairSamples),
      borderline: percentage(tiers.borderline, input.pairSamples),
      weak: percentage(tiers.weak, input.pairSamples),
    },
    weakFallback,
    percentiles: {
      score: percentiles(scores),
      eligibility: percentiles(eligibilities),
      competitionScore: percentiles(competitions),
      margin: percentiles(margins),
      evidenceStrength: percentiles(evidenceStrengths),
    },
    warnings: [...new Set(warnings)],
    failures: [...new Set(failures)],
    ok: failures.length === 0,
  };
}

function readArg(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = Number(process.argv[index + 1]);
  if (!Number.isInteger(value) || value < 0) throw new Error(`invalid --${name}`);
  return value;
}

function printSummary(summary: DistributionSummary) {
  console.log(`seed ${summary.seed}  personal ${summary.personalSamples}  pairs ${summary.pairSamples}`);
  console.log("\n# personalities");
  for (const row of summary.personalities) console.log(`${row.name}\t${row.count}\t${row.percentage}`);
  console.log(`highest\t${summary.personalityHighest.name}\t${summary.personalityHighest.percentage}`);
  console.log(`lowest\t${summary.personalityLowest.name}\t${summary.personalityLowest.percentage}`);
  console.log(`unreachable\t${summary.personalityUnreachable.join(", ") || "none"}`);
  console.log("\n# relationships");
  for (const row of summary.relationships) {
    console.log(`${row.name}\t${row.count}\t${row.percentage}\t${row.eligible}\t${row.borderline}\t${row.weak}`);
  }
  console.log(`highest\t${summary.relationshipHighest.name}\t${summary.relationshipHighest.percentage}`);
  console.log(`lowest\t${summary.relationshipLowest.name}\t${summary.relationshipLowest.percentage}`);
  console.log(`unreachable\t${summary.relationshipUnreachable.join(", ") || "none"}`);
  console.log(`\n# tiers\t${summary.tierRates.eligible}\t${summary.tierRates.borderline}\t${summary.tierRates.weak}`);
  console.log("# weak fallback");
  for (const row of summary.weakFallback.slice(0, 5)) console.log(`${row.name}\t${row.count}\t${row.percentage}`);
  console.log(`# percentiles\t${summary.percentiles.score.join("/")}`);
  console.log(`eligibility\t${summary.percentiles.eligibility.join("/")}`);
  console.log(`competition\t${summary.percentiles.competitionScore.join("/")}`);
  console.log(`margin\t${summary.percentiles.margin.join("/")}`);
  console.log(`evidence\t${summary.percentiles.evidenceStrength.join("/")}`);
  for (const warning of summary.warnings) console.log(`WARNING ${warning}`);
  for (const failure of summary.failures) console.log(`FAILURE ${failure}`);
}

function invokedDirectly(): boolean {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

if (invokedDirectly()) {
  try {
    const summary = runDistribution({
      personalSamples: readArg("personal-samples", 100000),
      pairSamples: readArg("pair-samples", 50000),
      seed: readArg("seed", 20260923),
    });
    printSummary(summary);
    writeFileSync(new URL("./algorithm-distribution.latest.json", import.meta.url), `${JSON.stringify(summary, null, 2)}\n`);
    process.exitCode = summary.ok ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
