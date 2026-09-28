# Phase 1 算法 V2 设计

## 1. 范围与不可变约束

Phase 1 只处理个人人格匹配、关系类型匹配、A/B 对称性、视角映射、算法测试和分布模拟。不修改 30 道题、24 个关系名称、购买验证码、认证、路由、数据库 schema 或最终报告 UI。

新完成的测试生成 `reportVersion: 2`。历史 `relationship_results.content` 不重算、不覆盖、不迁移；缺少 `reportVersion` 时按 V1 读取。打开报告永远只读已保存 JSON。

## 2. 现有数据链路与 V2 边界

```text
30 道题
  → scoreAnswers: 16 维 0–100
  → matchPersonality: 16 人格 + optional secondary
  → computeIndices: 8 大关系指数
  → matchRelationshipV2: 24 条声明式规则
  → Top3 candidates + roles + evidence
  → PairReport V2
  → relationship_results.content
  → mapFull(V1 | V2, viewerRole)
```

V2 算法是纯函数：相同输入必须得到相同结果，不使用随机数、运行时分布、数据库当前数量或动态调平。

## 3. 通用匹配原语

所有原语输出 0–100，仅表示当前数据对某一特征的匹配程度。

```ts
type Score = number; // internal float, 0..100

high(x, start = 50, full = 80) = clamp((x - start) / (full - start) * 100)
low(x, start = 50, full = 20) = high(100 - x, 100 - start, 100 - full)
similar(a, b, tolerance = 10, maxGap = 55) = clamp((maxGap - abs(a - b)) / (maxGap - tolerance) * 100)
different(a, b, start = 15, full = 55) = clamp((abs(a - b) - start) / (full - start) * 100)
meanWeighted([{ value, weight }]) = sum(value * weight) / sum(weight)
```

上述原语、weighted score、eligibility 和 competitionScore 在内部全程保留浮点精度。排序、方向选择和破平均使用未舍入值；仅在写入 PairReport/API 时将 score 和 eligibility 通过 `Math.round` 转成 0–100 整数。`clampFloat100` 与现有输出用 `clamp100` 分离，避免提前舍入制造并列。

`μ(x,y)` 表示平均值，`Δ(x,y)` 表示 `different(x,y)`，`S(x,y)` 表示 `similar(x,y)`，`H(x)`/`L(x)` 表示 `high`/`low`。以下表中的权重和均为 1。

## 4. eligibility、fallback 与 Top3

每条规则产生：

```ts
interface RelationshipCandidate {
  typeId: string;
  score: number;              // 0..100，类型匹配程度
  eligibility: number;        // 0..100，成立条件完整度
  eligible: boolean;          // eligibility >= 55
  orientation: "a-b" | "b-a" | "symmetric";
  roles: { a: string; b: string };
  evidence: RelationshipEvidence[];
  tier: "eligible" | "borderline" | "weak";
  fallback: boolean;
}
```

- `score` 由特征匹配度直接计算，不参照全局分布调整。
- 每条规则将特征分为 `requiredAnchors` 与 `supportingFeatures`。集中常量 `MIN_ANCHOR_STRENGTH = 35`。正式成立必须同时满足 `eligibility >= 55` 且每个 required anchor 均 `>=35`；不允许核心条件为 0 却被支持特征补偿。
- `eligibility` 是 anchors 与 supporting features 的加权平均；总分 `>=35` 但未满足正式条件时为 borderline，`<35` 为 weak。Anchor 阈值只通过语义 fixture 和邻近负例校验，不根据随机分布反向调平。
- 竞争值 `competitionScore = score * (0.75 + 0.25 * eligibility / 100)`，只是将成立完整度融入该类型自身匹配度，不是分布调平。
- Top1 使用三级池：先在 eligible 池选；空时从 borderline 池选；两者均空时才从 weak 池真正 fallback。
- Top3 依次消费 eligible、borderline、weak 池补足 3 个。仅 weak 池项标记 `fallback: true`，并保留 tier/eligibility 供未来解释。不引入第 25 种关系。
- 稳定排序键为 `competitionScore desc, score desc, relationshipCode asc`，保证并列时可复现。
- 官方关系类型仍为 Top1。`typicality = clamp(50 + (top1.score - top2.score) * 2)` 仅供 Phase 2 解释，不参与竞争。

## 5. 24 种关系的声明式规则

“角色 1/2”对非对称类型会同时计算 A→B 与 B→A，选更高的方向；对称类型只计算一次。

| # | typeId / 名称 | 范式与角色 | eligibility | 0–100 score |
|---|---|---|---|---|
| 01 | `iceberg_sun` 冰山 × 小太阳 | 互补：1=冰山，2=太阳 | `mean(H(1.independence), L(1.expression), H(2.companionship), H(2.expression), Δ(expression))` | `mean(.2H(1.rationality), .2H(1.independence), .2H(2.companionship), .2H(2.expression), .2Δ(expression))` |
| 02 | `stubborn_soft` 嘴硬 × 心软 | 互补：1=嘴硬，2=心软 | `mean(L(1.expression), H(1.avoidance), H(2.sensitivity), H(2.investment))` | `mean(.3L(1.expression), .2H(1.avoidance), .25H(2.sensitivity), .25H(2.investment))` |
| 03 | `cat_dog` 猫 × 狗 | 差异：1=猫，2=狗 | `mean(H(1.independence), L(1.companionship), H(2.companionship), L(2.independence))` | `mean(.25H(1.independence), .2L(1.companionship), .25H(2.companionship), .2L(2.independence), .1Δ(companionship))` |
| 04 | `plan_go_with_flow` 计划 × 随缘 | 差异：1=计划，2=随缘 | `mean(H(1.dominance), H(1.rationality), L(2.dominance), H(2.novelty))` | `mean(.3H(1.dominance), .2H(1.rationality), .25L(2.dominance), .15H(2.novelty), .1Δ(dominance))` |
| 05 | `detective_missing` 侦探 × 失踪人口 | 冲突：1=侦探，2=失踪 | `mean(H(1.replySensitivity), H(1.securityNeed), L(2.communication), L(2.expression))` | `mean(.3H(1.replySensitivity), .2H(1.securityNeed), .25L(2.communication), .15L(2.expression), .1Δ(replySensitivity, expression))` |
| 06 | `clingy_free` 黏人 × 自由 | 互补：1=黏人，2=自由 | `mean(H(1.companionship), H(1.dependency), H(2.independence), H(2.boundary))` | `mean(.3H(1.companionship), .15H(1.dependency), .3H(2.independence), .15H(2.boundary), .1Δ(companionship, independence))` |
| 07 | `rational_emotional` 理性 × 感性 | 互补：1=理性，2=感性 | `mean(H(1.rationality), L(1.sensitivity), H(2.sensitivity), L(2.rationality))` | `mean(.3H(1.rationality), .2L(1.sensitivity), .3H(2.sensitivity), .1L(2.rationality), .1Δ(rationality))` |
| 08 | `active_passive` 主动 × 被动 | 差异：1=主动，2=被动 | `mean(H(1.communication), H(1.dominance), L(2.communication), L(2.dominance))` | `mean(.3H(1.communication), .2H(1.dominance), .25L(2.communication), .15L(2.dominance), .1Δ(communication))` |
| 09 | `social_battery` 社牛 × 社恐 | 差异：1=社牛，2=社恐 | `mean(H(1.communication), H(1.novelty), L(2.communication), H(2.independence))` | `mean(.3H(1.communication), .2H(1.novelty), .3L(2.communication), .1H(2.independence), .1Δ(communication))` |
| 10 | `spotlight_lowkey` 显眼包 × 低调王 | 差异：1=显眼，2=低调 | `mean(H(1.novelty), H(1.abstract), H(1.communication), L(2.novelty), L(2.communication))` | `mean(.2H(1.novelty), .2H(1.abstract), .2H(1.communication), .2L(2.novelty), .1L(2.communication), .1Δ(novelty))` |
| 11 | `radar_wood` 情绪雷达 × 情绪木头 | 差异：1=雷达，2=木头 | `mean(H(1.sensitivity), H(1.replySensitivity), L(2.sensitivity), L(2.expression))` | `mean(.35H(1.sensitivity), .15H(1.replySensitivity), .3L(2.sensitivity), .1L(2.expression), .1Δ(sensitivity))` |
| 12 | `pm_slacker` 关系项目经理 × 快乐摸鱼王 | 差异：1=PM，2=摸鱼 | `mean(H(1.dominance), H(1.investment), L(2.dominance), L(2.investment), H(2.novelty))` | `mean(.25H(1.dominance), .25H(1.investment), .2L(2.dominance), .15L(2.investment), .15H(2.novelty))` |
| 13 | `powder_extinguisher` 火药桶 × 灭火器 | 冲突：1=高情绪反应，2=降温安抚 | anchors: `H(1.sensitivity), H(1.expression), H(2.rationality), max(H(2.communication),H(2.expression))`；support: `H(1.conflictInitiative), L(1.rationality), H(2.avoidance)` | `mean(.22H(1.sensitivity), .2H(1.expression), .12H(1.conflictInitiative), .08L(1.rationality), .22H(2.rationality), .1H(2.avoidance), .06max(H(2.communication),H(2.expression)))` |
| 14 | `ice_ice` 冰山 × 冰山 | 双低/双高：对称 | `mean(L(a.expression), L(b.expression), H(a.independence), H(b.independence), L(a.communication), L(b.communication))` | `mean(.3 commonLow(expression), .25 commonHigh(independence), .25 commonLow(communication), .2S(expression))` |
| 15 | `sun_sun` 小太阳 × 小太阳 | 双高：对称 | `mean(H(a.companionship), H(b.companionship), H(a.expression), H(b.expression), H(a.communication), H(b.communication))` | `mean(.35 commonHigh(companionship), .3 commonHigh(expression), .2 commonHigh(communication), .15S(companionship))` |
| 16 | `spotlight_spotlight` 显眼包 × 显眼包 | 双高：对称 | `mean(H(a.novelty), H(b.novelty), H(a.abstract), H(b.abstract), H(a.communication), H(b.communication))` | `mean(.3 commonHigh(novelty), .3 commonHigh(abstract), .25 commonHigh(communication), .15S(novelty))` |
| 17 | `rumination_comfort` 内耗王 × 安抚王 | 互补：1=内耗，2=安抚 | anchors: `H(1.replySensitivity), H(1.sensitivity), max(H(2.expression),H(2.communication)), H(2.companionship)`；support: `H(1.securityNeed), H(2.rationality)` | `mean(.2H(1.replySensitivity), .18H(1.sensitivity), .12H(1.securityNeed), .18H(2.expression), .16H(2.communication), .1H(2.companionship), .06H(2.rationality))` |
| 18 | `hesitate_decide` 纠结王 × 决策王 | 差异：1=纠结，2=决策 | `mean(L(1.dominance), L(1.conflictInitiative), H(2.dominance), H(2.rationality))` | `mean(.3L(1.dominance), .15L(1.conflictInitiative), .35H(2.dominance), .1H(2.rationality), .1Δ(dominance))` |
| 19 | `grudge_forget` 记仇王 × 转头忘 | 代理差异：1=持续在意细节，2=较快翻篇 | anchors: `H(1.replySensitivity), H(1.investment), L(2.replySensitivity), Δ(replySensitivity)`；support: `H(1.sensitivity), H(2.rationality)` | `mean(.25H(1.replySensitivity), .2H(1.investment), .15H(1.sensitivity), .2L(2.replySensitivity), .1H(2.rationality), .1Δ(replySensitivity))` |
| 20 | `talk_now_later` 主动沟通 × 冷处理 | 冲突：1=现在谈，2=冷处理 | anchors: `H(1.conflictInitiative), H(1.communication), H(2.avoidance), L(2.communication), L(2.expression)`；support: `H(2.independence)` | `mean(.28H(1.conflictInitiative), .24H(1.communication), .22H(2.avoidance), .12L(2.communication), .1L(2.expression), .04H(2.independence))` |
| 21 | `sensitive_stable` 高敏感 × 高稳定 | 互补：1=敏感，2=稳定 | anchors: `H(1.sensitivity), H(1.securityNeed), H(2.rationality), L(2.sensitivity), L(2.replySensitivity)`；support: `H(2.avoidance)` | `mean(.28H(1.sensitivity), .14H(1.securityNeed), .28H(2.rationality), .15L(2.sensitivity), .12L(2.replySensitivity), .03H(2.avoidance))` |
| 22 | `independent_independent` 高独立 × 高独立 | 双高：对称 | `mean(H(a.independence), H(b.independence), H(a.boundary), H(b.boundary))` | `mean(.4 commonHigh(independence), .3 commonHigh(boundary), .15 commonLow(companionship), .15S(independence))` |
| 23 | `together_together` 高陪伴 × 高陪伴 | 双高：对称 | `mean(H(a.companionship), H(b.companionship), H(a.dependency), H(b.dependency))` | `mean(.45 commonHigh(companionship), .25 commonHigh(dependency), .15 commonLow(independence), .15S(companionship))` |
| 24 | `abstract_abstract` 高抽象 × 高抽象 | 双高：对称 | `mean(H(a.abstract), H(b.abstract), H(a.novelty), H(b.novelty))` | `mean(.5 commonHigh(abstract), .2 commonHigh(novelty), .15 indices.abstract, .15S(abstract))` |

`commonHigh(x)=mean(H(a.x),H(b.x))`，`commonLow(x)=mean(L(a.x),L(b.x))`。表中 `expression` 为 `emotionExpression`，`sensitivity` 为 `emotionSensitivity`，`avoidance` 为 `conflictAvoidance`。交叉差值如 `Δ(replySensitivity, expression)` 指定向角色 1 和角色 2 的对应字段差异。

关系名称不等于直接测量项。`grudge_forget` 只能依据回复敏感、情绪敏感、投入和理性推断“持续在意细节/较快翻篇”，evidence 禁止宣称某人“就是记仇”。`social_battery`、`plan_go_with_flow` 等同理：evidence 只能陈述已测量的沟通、新鲜、掌控、理性等行为特征，不扩大为社交或人格事实。

### 5.1 Anchor 矩阵

下表是实现时的 required/supporting 唯一来源。所有 required 项均必须达到 `MIN_ANCHOR_STRENGTH`。

| typeId | required anchors | supporting features |
|---|---|---|
| iceberg_sun | 1 low expression; 2 high expression; expression difference | 1 independence/rationality; 2 companionship |
| stubborn_soft | 1 low expression/high avoidance; 2 sensitivity/investment | expression difference |
| cat_dog | 1 high independence; 2 high companionship; companionship difference | 1 low companionship; 2 low independence |
| plan_go_with_flow | 1 high dominance; 2 low dominance; dominance difference | 1 rationality; 2 novelty |
| detective_missing | 1 high reply sensitivity; 2 low communication/low expression | 1 security need; cross-role difference |
| clingy_free | 1 high companionship; 2 high independence; cross-role difference | 1 dependency; 2 boundary |
| rational_emotional | 1 high rationality; 2 high sensitivity; rationality difference | 1 low sensitivity; 2 low rationality |
| active_passive | 1 high communication; 2 low communication; communication difference | dominance contrast |
| social_battery | 1 high communication; 2 low communication; communication difference | 1 novelty; 2 independence |
| spotlight_lowkey | 1 high novelty/abstract; 2 low novelty/communication | novelty difference |
| radar_wood | 1 high sensitivity; 2 low sensitivity; sensitivity difference | 1 reply sensitivity; 2 low expression |
| pm_slacker | 1 high dominance/investment; 2 low dominance | 2 low investment/high novelty |
| powder_extinguisher | 1 high sensitivity/expression; 2 high rationality; 2 communication or expression | 1 initiative/low rationality; 2 avoidance |
| ice_ice | both low expression; both high independence | both low communication; expression similarity |
| sun_sun | both high companionship; both high expression | both high communication; companionship similarity |
| spotlight_spotlight | both high novelty; both high abstract | both high communication; novelty similarity |
| rumination_comfort | 1 high reply sensitivity/sensitivity; 2 communication or expression; 2 companionship | 1 security need; 2 rationality |
| hesitate_decide | 1 low dominance; 2 high dominance; dominance difference | 1 low initiative; 2 rationality |
| grudge_forget | 1 high reply sensitivity/investment; 2 low reply sensitivity; reply-sensitivity difference | 1 sensitivity; 2 rationality |
| talk_now_later | 1 high initiative/communication; 2 high avoidance/low communication/low expression | 2 independence |
| sensitive_stable | 1 high sensitivity/security; 2 high rationality/low sensitivity/low reply sensitivity | 2 avoidance |
| independent_independent | both high independence; both high boundary | both low companionship; independence similarity |
| together_together | both high companionship; both high dependency | both low independence; companionship similarity |
| abstract_abstract | both high abstract | both high novelty; abstract index/similarity |

## 6. A/B 对称性与角色

1. 非对称规则使用同一函数分别计算 `(a,b)` 和 `(b,a)`。
2. 选择更高的未舍入 `competitionScore`；并列时使用与 A/B 无关的特征指纹定向（角色 1/2 的维度向量按 `DIMENSION_KEYS` 序列化后字典序比较），不使用输入位置破平。若 A/B 向量完全相同且 directional rule 并列，使用 `orientation: "symmetric"` 和 neutral roles，不伪造角色归属。
3. 类型排序最终使用 relationship code 破平，因此 `match(a,b).typeId === match(b,a).typeId`。
4. candidate 内部保存 `roles.a/roles.b`。API 输出由统一 `mapFull(report, viewer)` 将 A/B 映射为“你/TA”。
5. `whoMore` 不保存已写死的“你/TA”结论；V2 保存 `winner: "a" | "b" | "tie"` 与中性 reason facts，映射时生成对应视角文案。V1 保留旧字段并在 B 视角使用明确的旧文案翻转表。

## 7. evidence 生成

每个规则的评分特征同时带有证据元数据：

```ts
interface RelationshipEvidence {
  id: string;
  dimensionKeys: DimKey[];
  strength: number;
  aValue: number;
  bValue: number;
  role: "a" | "b" | "pair";
  text: string; // 内部 A/B 中性描述，服务层转为你/TA
}
```

- 从该候选规则的特征中按 `strength desc, id asc` 选 3–5 条。
- 只输出当前数值实际支持的证据（`strength >= 45`）；不足 3 条时用该规则中最强的对比事实补足，文案使用“偏高/偏低/接近/差异”而不声称强成立。
- evidence 由维度值和规则元数据生成，不从关系名称直接套固定文案。
- Top1 的 evidence 写入 `relationshipEvidence`；Top3 每项保留自己的精简 evidence，Phase 2 可直接使用。

## 8. 16 人格校准

保留“16 维原型欧氏距离”，但避免未定义维度默认 50 导致原型聚集在中心。

1. 对全部 4^30 答案空间不做枚举；使用 100,000 组固定种子均匀答案估计每维度的均值和标准差，仅作离线校准依据。
2. 默认保持 16 维等权。只有离线对照实验能证明覆盖权重更好时才启用加权：`effectiveCoverage[d] = sum(questionOptionRange[d]^2) / sum(allDimensionRange^2)`；`rawWeight[d] = 1 / sqrt(effectiveCoverage[d])`；再归一化使 16 维权重平均为 1，并 clamp 到 `[0.75, 1.25]` 后再次归一化。权重必须以离线审阅后的固定常量入库，不得运行时计算或调整。若 16/16 可达性、邻近负例或分布稳定性没有明确改善，V2 继续使用等权并只校准 prototype。
3. 调整 16 个 prototype 时保留人格语义中的 5–7 个主特征，并为其他关键反向维度给出明确值，不把“未写”等同于中性。
4. 每种人格建立一个构造性 `DimensionScores` fixture，必须匹配自身。随机分布不强求平均，但不允许不可达，单类 >30% 报错，25–30% 警告并需人工解释。
5. 原型校准不修改人格 id、名称、tagline 或 summary。

## 9. secondaryType 阈值

阈值集中在 `personality.ts`：

```ts
export const SECONDARY_TYPE_THRESHOLDS = {
  minScore: 68,
  maxGap: 6,
} as const;
```

只有 `second.score >= 68 && top.score - second.score <= 6` 时返回第二人格的 id 和 name，否则两者均为 `null`。边界用例覆盖差 6/差 7、分数 68/67。

## 10. V1/V2 兼容

- `PairReportV1` 按当前已保存字段定义；`PairReportV2` 为不删字段的扩展，新增 `reportVersion: 2`、`relationshipCandidates`、`relationshipEvidence`。
- `readReportVersion(content)` 对缺少版本返回 1，值 2 进入 V2 分支。其他数字版本返回 `{ kind: "unsupported", version }`，由安全兼容分支仅暴露已知通用字段，不伪装成 V1；非数字版本视为损坏数据并返回明确错误。
- `mapFull` 使用存在性检查和 fallback，不假定 V1 拥有新字段。V1 输出保持现有 API shape；V2 可附加新字段，但 Phase 1 UI 不消费。
- 服务只在 B 完成、尚无 relationship result 时调用 `buildPairReport`。`getRelationship` 不调用算法重算已存 content。
- 本阶段不新增自动重算路由。显式 `rebuild-report <testId>` 仅作未来扩展点，不实现，避免扩大授权面。

## 11. 测试矩阵

构造性 fixture 与实现必须独立：人格 fixture 不得从 prototype 复制或生成，关系 fixture 不得调用 relationship rule 反向生成。它们是根据中文语义手工编写的固定 `DimensionScores`，与生产规则只通过公开输入/输出相交。

| 类别 | 要求 |
|---|---|
| secondary | 接近且过最低分返回 secondary；差距过大或分数过低返回 null |
| 人格可达 | 16 个构造性 fixture 逐一匹配预期 id |
| 关系可达 | 24 个 `DimensionScores` pair fixture 逐一匹配预期 id，每个有 3–5 evidence |
| 对称性 | 24 fixture + 固定种子随机 pair 验证 swap 后 Top3 typeId 顺序、未舍入 score、eligibility 一致，roles 和 evidence A/B 正确翻转 |
| 范围 | 所有 candidate score/eligibility、8 indices、whoMore percentage 为 0–100 |
| 相同 | 完全相同 pair 不得匹配依赖巨大差异的 01–13、17–21 |
| 相反 | 完全相反 pair 应落入差异/互补型，evidence 能指出最强差异 |
| 选项极端 | 双方全 A/B/C/D 分别固定结果，交换后不变 |
| 指定极端 | 双高独立、双高陪伴、双高敏感、敏感+稳定、双高抽象、双低表达、高陪伴+高独立、高回复敏感+低表达、冲突主动+冲突回避 |
| 邻近负例 | 双高独立/双高陪伴/双冰山/双太阳的正例之外，单方高值必须使对应双高类型 anchor 失败；主要互补型缺失任一 required anchor 时不得进入 eligible 池 |
| Top3 | 长度 3、排序稳定、Top1 等于正式 relationshipType、无合格候选时 fallback 仍有结果 |
| 视角 | A 看 you=A/ta=B，B 看 you=B/ta=A；whoMore 的数字、winner、note、roles、evidence、scene 同步翻转 |
| V1/未来版本 | 无 reportVersion/candidates/evidence 的 fixture 能 mapFull，不触发重算；版本 3 进入 unsupported 分支而非 V1 |
| V2 兼容 | reportVersion=2 的 fixture 能 mapFull，新字段保留并正确映射 |
| 稳定性 | 同一输入连续运行 100 次结果完全一致 |

## 12. 分布模拟

新增 `server/scripts/algorithm-distribution.ts`，使用内置的可复现 PRNG（默认 seed `20260923`），默认 100,000 个个人答卷和 50,000 组 pair，支持 `--samples` 和 `--seed`。

输出：样本量、seed、16 人格数量/百分比、24 关系数量/百分比、不可达列表、最高/最低占比、fallback 率、Top1-Top2 差值分布、单类 >25% 警告、>30% 失败。脚本只用于 QA，输出不反馈到算法。

构造性 fixture 测试与随机模拟分开：“全部可达”由 fixture 保证，随机样本中未出现某类型只作警告，不通过加权强行出现。

## 13. 预计修改文件

| 文件 | 责任 |
|---|---|
| `server/src/algorithms/scoring.ts` | 通用 0–100 匹配原语和稳定比较工具 |
| `server/src/algorithms/personality.ts` | secondary 阈值、加权原型距离 |
| `server/src/content/personalities.ts` | 校准 16 个 prototype，不改 id/名称/文案 |
| `server/src/algorithms/relationship.ts` | 声明式 24 规则、eligibility、Top3、roles、evidence、fallback |
| `server/src/algorithms/who-more.ts` | V2 中性 winner/reason 结构，保留旧字段兼容 |
| `server/src/algorithms/compose.ts` | PairReport V1/V2 类型、reportVersion=2、candidates/evidence |
| `server/src/services/test-service.ts` | V1/V2 读取、统一 A/B 视角映射，不重算历史报告 |
| `server/src/algorithms/personality.test.ts` | secondary 边界与 16 人格可达 |
| `server/src/algorithms/relationship.test.ts` | 24 关系可达、对称、Top3、evidence、极端值 |
| `server/src/services/test-service.test.ts` | V1/V2 兼容与 A/B 视角 |
| `server/src/algorithms/fixtures.ts` | 人格/关系构造性 fixture，仅供测试和 QA 脚本 |
| `server/scripts/algorithm-distribution.ts` | 固定种子分布模拟 |
| `server/package.json` | `algorithm:distribution` 命令 |

## 14. Phase 1 验收门槛

- 16/16 人格构造性可达、24/24 关系构造性可达。
- 所有关系 fixture 交换 A/B 后 typeId 不变；随机对称测试无反例。
- 每个 Top1 有 3–5 条可追溯 evidence；Top3 稳定且可复现。
- 100,000/50,000 固定种子模拟无单一类型 >30%；25–30% 必须在阶段报告说明。
- V1 历史 fixture 和 V2 新 fixture 均可读取，打开时不调用 `buildPairReport`。
- `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build` 通过；P0 脚本在所需服务可用时执行并如实报告。

## 15. 执行环境

所有根级 `npm run ...` 命令从项目根目录 `/Users/biwan-6/Desktop/关系型人格实验室` 执行；直接执行 server 脚本时要么从项目根目录使用 `node server/scripts/...`，要么从 `server/` 使用 `node scripts/...`，不混用。当前机器 Git 因缺少 Xcode Command Line Tools 不可用；每任务完成时先检测 Git，可用则提交，不可用则跳过 commit 且继续开发，并记录该任务的修改文件与真实测试输出。
