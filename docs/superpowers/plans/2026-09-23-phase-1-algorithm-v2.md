# Phase 1 Algorithm V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为之后新完成的双人测试生成稳定、对称、可解释的 V2 人格与关系结果，同时完全保持 V1 历史报告可读。

**Architecture:** 使用可组合的 0–100 匹配原语和 24 条声明式规则，每条规则输出 score、eligibility、角色和 evidence。非对称规则同时计算两个方向，报告内部保存 A/B 中性事实，服务层统一映射为你/TA。

**Tech Stack:** TypeScript 5.8, Vitest 3, Prisma JSON storage, Node.js 20+

**Spec:** `docs/superpowers/specs/2026-09-23-phase-1-algorithm-v2-design.md`

## Global Constraints

- 不修改现有 30 道题、24 个关系名称、购买验证码、认证流程、路由或最终报告 UI。
- 不修改数据库 schema；V2 完整报告仍写入 `relationship_results.content` JSON。
- 不重算、不迁移、不覆盖历史报告；缺少 `reportVersion` 的 content 视为 V1。
- 新报告固定 `reportVersion: 2`；同样输入必须生成完全一致的结果。
- 不使用随机抽签、全局占比加权、运行时动态调平或 AI API。
- 所有生产代码改动遵循 RED→GREEN→REFACTOR，每个任务完成后运行相关测试。
- 内部 score/eligibility/competitionScore 保留浮点精度，仅 PairReport/API 输出舍入为整数。
- 正式 eligibility 必须同时通过总分 55 和全部 required anchors 的集中阈值 35。

## Execution Environment

- 下文所有 `npm ...` 命令均在项目根目录 `/Users/biwan-6/Desktop/关系型人格实验室` 执行。
- 直接 Node 脚本从项目根使用 `node server/scripts/...`；不在 `server/` 目录里重复加 `server/` 前缀。
- 每个 Task 结束时尝试 Git 检查；Git 可用则执行计划中的 commit，因缺少 Xcode Command Line Tools 不可用时跳过 commit，不中断开发，改为记录修改文件和测试输出。

---

### Task 1: 建立 0–100 匹配原语

**Files:**
- Modify: `server/src/algorithms/scoring.ts`
- Create: `server/src/algorithms/scoring.test.ts`

**Interfaces:**
- Produces: `matchHigh(value, start?, full?): number`
- Produces: `matchLow(value, start?, full?): number`
- Produces: `matchSimilar(a, b, tolerance?, maxGap?): number`
- Produces: `matchDifferent(a, b, start?, full?): number`
- Produces: `weightedMean(parts: ReadonlyArray<{ value: number; weight: number }>): number`
- Produces: `compareDimensionFingerprint(a, b): number`
- Produces: `clampFloat100(value): number`

- [ ] **Step 1: Write failing primitive boundary tests**

```ts
it("maps high, low, similar and different evidence to 0..100", () => {
  expect(matchHigh(50)).toBe(0);
  expect(matchHigh(80)).toBe(100);
  expect(matchLow(50)).toBe(0);
  expect(matchLow(20)).toBe(100);
  expect(matchSimilar(60, 65)).toBe(100);
  expect(matchSimilar(10, 90)).toBe(0);
  expect(matchDifferent(10, 10)).toBe(0);
  expect(matchDifferent(10, 80)).toBe(100);
  expect(weightedMean([{ value: 100, weight: 3 }, { value: 0, weight: 1 }])).toBe(75);
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `npm test -- --run src/algorithms/scoring.test.ts`
Expected: FAIL because the six exports do not exist.

- [ ] **Step 3: Implement the pure helpers**

Use the exact defaults and equations from spec sections 3 and 6. `weightedMean` must return 0 for no data, ignore no entries, and finish through `clampFloat100` without rounding. `compareDimensionFingerprint` must iterate `DIMENSION_KEYS`, compare the numeric sequence lexicographically, and return -1/0/1.

- [ ] **Step 4: Add property-style range and swap tests**

Loop over values `0..100` in increments of 5 and assert all match helpers remain in range; assert `matchSimilar(a,b) === matchSimilar(b,a)` and `matchDifferent(a,b) === matchDifferent(b,a)`.

- [ ] **Step 5: Run scoring tests**

Run: `npm test -- --run src/algorithms/scoring.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/algorithms/scoring.ts server/src/algorithms/scoring.test.ts
git commit -m "feat: add normalized relationship scoring primitives"
```

### Task 2: 修复 secondaryType 并校准 16 人格

**Files:**
- Modify: `server/src/algorithms/personality.ts`
- Modify: `server/src/content/personalities.ts`
- Create: `server/src/algorithms/fixtures.ts`
- Create: `server/src/algorithms/personality.test.ts`

**Interfaces:**
- Produces: `SECONDARY_TYPE_THRESHOLDS = { minScore: 68, maxGap: 6 }`
- Produces: `PERSONALITY_FIXTURES: ReadonlyArray<{ typeId: string; scores: DimensionScores }>`
- Keeps: `matchPersonality(scores): PersonalityMatch`

- [ ] **Step 1: Write the secondary regression test against a ranked helper**

Extract and export a small pure helper:

```ts
export function selectSecondary(
  top: { score: number },
  second?: { type: PersonalityTypeDef; score: number },
): { id: string; name: string } | null;
```

Test score pairs 86/83, 86/61, 74/68, 74/67 and exact gap 6/7. The first and exact-boundary valid cases return secondary; others return null.

- [ ] **Step 2: Run the secondary test and verify RED**

Run: `npm test -- --run src/algorithms/personality.test.ts`
Expected: FAIL because `selectSecondary` and thresholds do not exist.

- [ ] **Step 3: Implement thresholded secondary selection**

Set both `secondaryTypeId` and `secondaryTypeName` from the helper result. Never return a name when id is null.

- [ ] **Step 4: Add 16 constructive personality fixtures**

Create one hand-authored explicit `DimensionScores` vector per personality from the Chinese semantics, without importing, copying, spreading or transforming any prototype. Keep values within 0–100. Tests must enumerate all `PERSONALITY_TYPES` and assert exact set equality with fixture ids.

- [ ] **Step 5: Run fixtures and record failures before prototype changes**

Run: `npm test -- --run src/algorithms/personality.test.ts`
Expected: FAIL for any prototype whose region is unreachable or captured by a neighbor; preserve the failure list in the phase notes.

- [ ] **Step 6: Add fixed dimension weights and minimally calibrate prototypes**

First keep equal dimension weights and calibrate prototypes. Separately calculate the spec's effective-coverage formula offline and compare equal-weight versus clamped fixed-weight results on 16 fixtures, neighbor negatives and the fixed-seed distribution. Only store reviewed fixed constants if they demonstrably improve these checks; otherwise retain equal Euclidean distance. Adjust only prototype numeric values in `personalities.ts`; keep all ids, names, taglines and summaries byte-for-byte unchanged.

- [ ] **Step 7: Run personality tests**

Run: `npm test -- --run src/algorithms/personality.test.ts`
Expected: 16/16 fixtures PASS and secondary boundary tests PASS.

- [ ] **Step 8: Commit**

```bash
git add server/src/algorithms/personality.ts server/src/content/personalities.ts server/src/algorithms/fixtures.ts server/src/algorithms/personality.test.ts
git commit -m "fix: calibrate personality matching and secondary type"
```

### Task 3: 实现 24 条声明式关系规则

**Files:**
- Replace internals: `server/src/algorithms/relationship.ts`
- Extend: `server/src/algorithms/fixtures.ts`
- Create: `server/src/algorithms/relationship.test.ts`

**Interfaces:**
- Produces: `RelationshipEvidence`
- Produces: `RelationshipCandidate`
- Produces: `RelationshipMatch { type, score, eligibility, roles, evidence, candidates }`
- Keeps: `matchRelationship(a, b, indices): RelationshipMatch`
- Produces: `RELATIONSHIP_FIXTURES: ReadonlyArray<{ typeId: string; a: DimensionScores; b: DimensionScores }>`

- [ ] **Step 1: Write schema, range and Top3 failing tests**

For a simple pair, assert `score` and every candidate score/eligibility are integers in 0–100, candidates length is 3, candidate[0].typeId equals `match.type.id`, roles are present, and Top1 evidence length is 3–5.

- [ ] **Step 2: Run relationship tests and verify RED**

Run: `npm test -- --run src/algorithms/relationship.test.ts`
Expected: FAIL because the existing matcher returns only `{type, score}`.

- [ ] **Step 3: Define the rule types and evaluator**

Implement:

```ts
type Paradigm = "complement" | "similar" | "conflict" | "both-high" | "both-low" | "difference";
interface RelationshipRule {
  typeId: string;
  paradigm: Paradigm;
  symmetric: boolean;
  evaluate(first: DimensionScores, second: DimensionScores, indices: RelationshipIndices): RuleEvaluation;
}
```

`RuleEvaluation` contains score, eligibility, role names and evidence facts. Keep the 24 rules in relationship code order and implement every weight/formula from spec section 5.

Each rule must declare `requiredAnchors` and `supportingFeatures` from spec section 5.1. Centralize `MIN_ANCHOR_STRENGTH = 35`; `eligible` requires overall eligibility >=55 and every required anchor >=35.

- [ ] **Step 4: Implement orientation and deterministic tie-breaking**

For directional rules evaluate both orientations using unrounded floats. Compare competition score, raw score, then dimension fingerprint. For identical vectors and exact directional ties, emit `orientation: "symmetric"` with neutral roles. For global candidate order compare unrounded competition score, raw score, then relationship code. Assert no comparison uses argument position as a final tie-breaker.

- [ ] **Step 5: Implement eligibility pools, fallback and Top3**

Use three pools: formal eligible; borderline eligibility >=35; weak <35. Select Top1 from the first non-empty pool. Fill Top3 in eligible→borderline→weak order. Mark only weak candidates as fallback. Use `score * (0.75 + 0.25 * eligibility/100)` without early rounding.

- [ ] **Step 6: Implement evidence selection**

Each rule evaluation emits at least five facts with ids, dimension keys, values, strength and orientation-neutral A/B role. Select 3–5 by strength and stable id. Confirm text is produced from actual measured values and never solely from relationship type. Proxy-named relationships may only describe measured behavior; `grudge_forget` must say sustained attention to details/faster recovery, never assert that a person "is vindictive".

- [ ] **Step 7: Add 24 constructive fixtures and verify reachability**

Create hand-authored fixed A/B vectors from relationship semantics without importing or invoking rule definitions. The test must compare exact sets against all `RELATIONSHIP_TYPES`, assert each fixture's expected Top1, then assert the swapped fixture yields the same Top1.

- [ ] **Step 8: Add extreme and invariance tests**

Cover identical 0/25/50/75/100 vectors, opposite vectors, dual high independence/companionship/sensitivity/stability/abstract, dual low expression, companionship-vs-independence, reply-sensitivity-vs-low-expression, and initiative-vs-avoidance. Add neighbor negatives: only one side high independence/companionship must fail the corresponding both-high anchors; missing any required anchor for major complementary types must keep that rule out of eligible. Identical pairs must not select a directional difference type.

For every fixture and random symmetry sample compare the complete Top3: identical typeId order and unrounded internal score/eligibility, with roles and evidence A/B correctly reversed. Exact identical-vector ties must use neutral roles.

- [ ] **Step 9: Run relationship tests**

Run: `npm test -- --run src/algorithms/relationship.test.ts`
Expected: 24/24 fixtures, swap invariance, Top3, evidence and extremes PASS.

- [ ] **Step 10: Commit**

```bash
git add server/src/algorithms/relationship.ts server/src/algorithms/fixtures.ts server/src/algorithms/relationship.test.ts
git commit -m "feat: add symmetric normalized relationship rules"
```

### Task 4: 升级 whoMore 的可映射事实

**Files:**
- Modify: `server/src/algorithms/who-more.ts`
- Create: `server/src/algorithms/who-more.test.ts`

**Interfaces:**
- Extends: `WhoMoreItem` with `winner: "a" | "b" | "tie"` and `reason: { aScore: number; bScore: number; dimensions: DimKey[] }`
- Keeps: existing `aPercent`, `bPercent`, labels, tie and note for stored/API compatibility
- Produces: `mapWhoMoreItem(item, viewerIsA): WhoMoreView`

- [ ] **Step 1: Write failing A/B perspective tests**

Construct one A-leading, one B-leading and one tie item. Assert A and B views swap percentages, preserve title, map winner to `you/ta/tie`, and generate notes that name the correct side.

- [ ] **Step 2: Run whoMore test and verify RED**

Run: `npm test -- --run src/algorithms/who-more.test.ts`
Expected: FAIL because winner/reason/mapping do not exist.

- [ ] **Step 3: Store neutral winner and reason facts**

For all nine definitions, declare contributing `DimKey[]`; compute winner from percentages. Preserve current humorous text through templates keyed by winner rather than a single already-oriented note.

- [ ] **Step 4: Implement the view mapper and tests**

Map `a` to you for A viewer and ta for B viewer; map `b` oppositely. Derive `note` after mapping. Verify all nine rows for both viewers.

- [ ] **Step 5: Run whoMore tests**

Run: `npm test -- --run src/algorithms/who-more.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/algorithms/who-more.ts server/src/algorithms/who-more.test.ts
git commit -m "fix: make who-more results perspective safe"
```

### Task 5: 写入 PairReport V2，保留 V1 shape

**Files:**
- Modify: `server/src/algorithms/compose.ts`
- Modify: `server/src/algorithms/compose.test.ts`

**Interfaces:**
- Produces: `PairReportV1`, `PairReportV2`, `PairReport = PairReportV1 | PairReportV2`
- Produces: `readReportVersion(report): 1 | 2`
- `buildPairReport(...)` returns `PairReportV2`

- [ ] **Step 1: Write failing V2 composition tests**

Assert `buildPairReport` returns `reportVersion === 2`, three candidates, Top1 consistency, 3–5 relationshipEvidence items and unchanged legacy fields (`relationshipType`, `indices`, `whoMore`, `scene`, `advice`).

- [ ] **Step 2: Run compose tests and verify RED**

Run: `npm test -- --run src/algorithms/compose.test.ts`
Expected: FAIL because reportVersion/candidates/evidence are absent.

- [ ] **Step 3: Define versioned types without deleting fields**

Make V2 extend the existing saved shape. Add only `reportVersion`, `relationshipCandidates`, and `relationshipEvidence` in Phase 1. Missing version returns V1; exact value 2 returns V2; future numeric versions such as 3 return an explicit unsupported result; non-numeric versions are invalid rather than silently treated as V1.

- [ ] **Step 4: Wire matcher outputs into V2**

Use candidate score as the saved score; do not recompute or rescale it in compose. Preserve existing narrative and details generation unchanged for this phase.

- [ ] **Step 5: Run compose tests**

Run: `npm test -- --run src/algorithms/compose.test.ts`
Expected: PASS, including existing teaser privacy assertions.

- [ ] **Step 6: Commit**

```bash
git add server/src/algorithms/compose.ts server/src/algorithms/compose.test.ts
git commit -m "feat: persist versioned pair report candidates"
```

### Task 6: 统一 V1/V2 报告读取和 A/B 视角

**Files:**
- Modify: `server/src/services/test-service.ts`
- Create: `server/src/services/test-service.test.ts`
- Preserve: existing `server/src/services/admin-session.test.ts`, `server/src/services/admin-service.test.ts`

**Interfaces:**
- Extracts/exports for test: `mapFull(report: PairReport, iAmA: boolean)`
- Consumes: `readReportVersion`, `mapWhoMoreItem`
- Produces: V1-compatible full view plus optional V2 candidates/evidence

- [ ] **Step 1: Create literal V1 and V2 saved-content fixtures**

V1 fixture must omit `reportVersion`, candidates and evidence. V2 fixture must contain them and deliberately give A/B different dimension values, roles, evidence and whoMore winners.

- [ ] **Step 2: Write failing compatibility and perspective tests**

Assert both fixtures map without throwing. For V1, assert current API fields remain available. For V2, assert A view is you=A, B view is you=B, and percentages, whoMore notes, candidate roles, evidence roles, misunderstanding views, conflict reactions, communication scripts and scene speakers all invert consistently.

- [ ] **Step 3: Run service tests and verify RED**

Run: `npm test -- --run src/services/test-service.test.ts`
Expected: FAIL on B-view note and absent V2 mapping.

- [ ] **Step 4: Refactor mapFull into one perspective boundary**

Keep report storage A/B-neutral. Add small mappers for party token, role record, evidence and whoMore. Branch only for optional V2 fields; use current `buildPairDetails` fallback when V1 lacks paid-detail fields.

- [ ] **Step 5: Prove history reads do not rebuild**

In the getRelationship service test, spy on or inject the report builder boundary and assert zero calls while returning an existing V1 and existing V2 relationship content. Do not add any write in `getRelationship`.

- [ ] **Step 6: Run service and full unit tests**

Run: `npm test -- --run src/services/test-service.test.ts`
Expected: PASS.

Run: `npm test`
Expected: all existing and new unit tests PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/services/test-service.ts server/src/services/test-service.test.ts
git commit -m "fix: map v1 and v2 reports by viewer perspective"
```

### Task 7: 新增可复现分布模拟

**Files:**
- Create: `server/scripts/algorithm-distribution.ts`
- Create: `server/scripts/algorithm-distribution.test.ts`
- Modify: `server/package.json`

**Interfaces:**
- Produces: `runDistribution({ personalSamples, pairSamples, seed }): DistributionSummary`
- Adds script: `"algorithm:distribution": "tsx scripts/algorithm-distribution.ts"`

- [ ] **Step 1: Write failing deterministic simulator test**

Run 500 personal and 250 pair samples twice with seed 42. Assert summaries deep-equal, all counts sum to sample totals, percentages are finite, and fallback count is reported.

- [ ] **Step 2: Run simulator test and verify RED**

Run: `npm test -- --run scripts/algorithm-distribution.test.ts`
Expected: FAIL because the simulator does not exist.

- [ ] **Step 3: Implement a local seeded PRNG and argument parser**

Use a small deterministic unsigned 32-bit generator inside the script; do not add a dependency. Default to 100,000 personal samples, 50,000 pair samples and seed 20260923. Generate answer keys uniformly only for anomaly detection.

- [ ] **Step 4: Implement summary and thresholds**

Return counts/percentages for all known ids, unreachable ids, highest/lowest entries, fallback rate and Top1−Top2 buckets. Exit nonzero only when a known type is absent from constructive fixtures, a distribution count is invalid, or one type exceeds 30%; print warnings at >25%.

- [ ] **Step 5: Run the small deterministic test**

Run: `npm test -- --run scripts/algorithm-distribution.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full simulation and save output for phase report**

Run: `npm run algorithm:distribution -- --personal-samples 100000 --pair-samples 50000 --seed 20260923`
Expected: prints complete 16/24 tables, no invalid counts, no type above 30%. Any 25–30% warning must be investigated and reported rather than hidden.

- [ ] **Step 7: Commit**

```bash
git add server/scripts/algorithm-distribution.ts server/scripts/algorithm-distribution.test.ts server/package.json
git commit -m "test: add deterministic algorithm distribution audit"
```

### Task 8: Phase 1 全量验证与停机点

**Files:**
- Modify only if verification exposes a Phase 1 defect; do not touch Web UI.

**Interfaces:**
- Consumes all previous tasks.
- Produces the Phase 1 report requested by the user.

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: exit 0, no ESLint errors.

- [ ] **Step 2: Run TypeScript check**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Run all unit/integration tests**

Run: `npm run test`
Expected: exit 0; report exact files/tests passed.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 5: Run P0 API integration when dependencies are available**

Run: `npm run dev` in a dedicated session, then `node server/scripts/p0-e2e.mjs` using the existing environment. Expected: exit 0. If database/Redis/environment prerequisites are unavailable, report the exact failure and do not claim P0 passed.

- [ ] **Step 6: Re-run the full distribution audit**

Run: `npm run algorithm:distribution -- --personal-samples 100000 --pair-samples 50000 --seed 20260923`
Expected: deterministic output matching Task 7, with 16/16 and 24/24 constructive fixtures confirmed.

- [ ] **Step 7: Audit prohibited changes**

Compare the final diff and confirm: questions unchanged; relationship names unchanged; no Prisma migration/schema change; purchase/auth/routes unchanged; `server/web/index.html` unchanged; no historical rewrite path added.

- [ ] **Step 8: Stop and deliver the Phase 1 report**

List exact modified files, logic per file, explicitly unchanged areas, exact commands and outputs, distribution tables, extreme-case results, and every remaining failure. Do not start Phase 2.
