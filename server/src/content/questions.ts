import type { ScoreDelta } from "../domain/dimensions.js";

export const QUESTION_VERSION = 1;

export type OptionKey = "A" | "B" | "C" | "D";

export interface QuestionOptionDef {
  key: OptionKey;
  text: string;
  scores: ScoreDelta;
}

export interface QuestionDef {
  id: string;
  order: number;
  scene: string;
  stem: string;
  options: [QuestionOptionDef, QuestionOptionDef, QuestionOptionDef, QuestionOptionDef];
}

export const QUESTIONS: QuestionDef[] = [
  {
    id: "q01",
    order: 1,
    scene: "TA 突然半天没回你",
    stem: "你第一反应更接近？",
    options: [
      { key: "A", text: "没事，可能在忙", scores: { rationality: 8, independence: 6, replySensitivity: 0 } },
      { key: "B", text: "有点奇怪，但我不会问", scores: { replySensitivity: 6, conflictAvoidance: 7, emotionExpression: 1 } },
      { key: "C", text: "开始脑补是不是我说错话", scores: { replySensitivity: 10, emotionSensitivity: 8, securityNeed: 7 } },
      { key: "D", text: "直接问：你干嘛去了？", scores: { communication: 9, conflictInitiative: 6, replySensitivity: 4 } },
    ],
  },
  {
    id: "q02",
    order: 2,
    scene: "约好晚上一起吃饭",
    stem: "你通常会怎么推进？",
    options: [
      { key: "A", text: "提前把餐厅订好", scores: { dominance: 8, investment: 7, rationality: 6 } },
      { key: "B", text: "到时候再说", scores: { novelty: 6, dominance: 1, rationality: 2 } },
      { key: "C", text: "先问 TA 想吃什么", scores: { communication: 7, companionship: 6, emotionSensitivity: 5 } },
      { key: "D", text: "谁先决定谁负责", scores: { boundary: 7, abstract: 4, dominance: 3 } },
    ],
  },
  {
    id: "q03",
    order: 3,
    scene: "你生气的时候",
    stem: "更常见的是？",
    options: [
      { key: "A", text: "自己消化", scores: { conflictAvoidance: 8, independence: 6, emotionExpression: 1 } },
      { key: "B", text: "希望对方主动发现", scores: { emotionSensitivity: 7, communication: 2, securityNeed: 6 } },
      { key: "C", text: "直接说出来", scores: { emotionExpression: 9, communication: 8, conflictInitiative: 6 } },
      { key: "D", text: "嘴上说没事", scores: { conflictAvoidance: 9, emotionExpression: 2, replySensitivity: 5 } },
    ],
  },
  {
    id: "q04",
    order: 4,
    scene: "周末突然空出来",
    stem: "你更想？",
    options: [
      { key: "A", text: "自己待着充电", scores: { independence: 10, companionship: 1, boundary: 7 } },
      { key: "B", text: "立刻约 TA 出来", scores: { companionship: 10, communication: 6, independence: 1 } },
      { key: "C", text: "看 TA 方不方便再决定", scores: { emotionSensitivity: 6, dependency: 5, communication: 4 } },
      { key: "D", text: "找点新鲜的事做", scores: { novelty: 9, abstract: 6, investment: 4 } },
    ],
  },
  {
    id: "q05",
    order: 5,
    scene: "和 TA 意见不合",
    stem: "你更容易？",
    options: [
      { key: "A", text: "现在就想聊清楚", scores: { conflictInitiative: 10, communication: 7, conflictAvoidance: 1 } },
      { key: "B", text: "先冷一冷再说", scores: { conflictAvoidance: 8, independence: 5, rationality: 5 } },
      { key: "C", text: "讲道理拆解问题", scores: { rationality: 10, conflictInitiative: 5, emotionExpression: 4 } },
      { key: "D", text: "说「都行」先把场面圆过去", scores: { conflictAvoidance: 7, emotionExpression: 2, dominance: 1 } },
    ],
  },
  {
    id: "q06",
    order: 6,
    scene: "连续几天高强度相处",
    stem: "你的状态更像？",
    options: [
      { key: "A", text: "还行，甚至还想再待", scores: { companionship: 9, dependency: 6, independence: 1 } },
      { key: "B", text: "开始想自己的空间", scores: { independence: 9, boundary: 8, companionship: 2 } },
      { key: "C", text: "人在，但精神已退房", scores: { conflictAvoidance: 5, independence: 6, emotionExpression: 2 } },
      { key: "D", text: "会明白说「我要缓缓」", scores: { boundary: 9, communication: 7, emotionExpression: 6 } },
    ],
  },
  {
    id: "q07",
    order: 7,
    scene: "今天发生一件小事",
    stem: "你会不会分享给 TA？",
    options: [
      { key: "A", text: "想到就发", scores: { communication: 8, companionship: 7, investment: 6 } },
      { key: "B", text: "攒着见面再说", scores: { independence: 5, communication: 3, rationality: 4 } },
      { key: "C", text: "看 TA 最近忙不忙", scores: { emotionSensitivity: 7, replySensitivity: 5, boundary: 4 } },
      { key: "D", text: "发一条很抽象的表情包", scores: { abstract: 9, communication: 4, novelty: 5 } },
    ],
  },
  {
    id: "q08",
    order: 8,
    scene: "一起做个决定（旅行 / 聚餐 / 项目）",
    stem: "你的角色更像？",
    options: [
      { key: "A", text: "拉表格、订时间、推进落地", scores: { dominance: 10, investment: 8, rationality: 7 } },
      { key: "B", text: "随缘，到时候看感觉", scores: { novelty: 7, dominance: 1, conflictAvoidance: 5 } },
      { key: "C", text: "负责提奇怪但好玩的选项", scores: { abstract: 8, novelty: 8, communication: 5 } },
      { key: "D", text: "你们定，我配合", scores: { dominance: 1, dependency: 6, conflictAvoidance: 6 } },
    ],
  },
  {
    id: "q09",
    order: 9,
    scene: "TA 今天回消息变短了",
    stem: "你怎么理解？",
    options: [
      { key: "A", text: "可能只是没空", scores: { rationality: 8, replySensitivity: 1, securityNeed: 2 } },
      { key: "B", text: "隐隐不安，但先观察", scores: { securityNeed: 7, replySensitivity: 7, conflictAvoidance: 5 } },
      { key: "C", text: "我会找个由头确认一下", scores: { communication: 7, securityNeed: 6, investment: 5 } },
      { key: "D", text: "我也变短，对等输出", scores: { boundary: 6, conflictAvoidance: 4, independence: 5 } },
    ],
  },
  {
    id: "q10",
    order: 10,
    scene: "TA 开了个很冷的玩笑",
    stem: "你更可能？",
    options: [
      { key: "A", text: "接上，一起抽象", scores: { abstract: 10, novelty: 6, communication: 5 } },
      { key: "B", text: "笑一下，但没太懂", scores: { abstract: 2, emotionSensitivity: 4, conflictAvoidance: 4 } },
      { key: "C", text: "先看 TA 是不是在试探情绪", scores: { emotionSensitivity: 9, replySensitivity: 5, rationality: 3 } },
      { key: "D", text: "认真问：你什么意思？", scores: { communication: 6, rationality: 6, abstract: 1 } },
    ],
  },
  {
    id: "q11",
    order: 11,
    scene: "问你「今天吃什么 / 去哪 / 怎么办」",
    stem: "你的高频回答是？",
    options: [
      { key: "A", text: "都可以", scores: { dominance: 0, emotionExpression: 1, conflictAvoidance: 7 } },
      { key: "B", text: "给两个选项让 TA 选", scores: { dominance: 5, communication: 6, rationality: 5 } },
      { key: "C", text: "直接拍板", scores: { dominance: 9, conflictInitiative: 5, investment: 4 } },
      { key: "D", text: "反问：你呢？", scores: { communication: 5, dependency: 4, emotionSensitivity: 4 } },
    ],
  },
  {
    id: "q12",
    order: 12,
    scene: "原定见面，TA 临时有事取消",
    stem: "你内心更接近？",
    options: [
      { key: "A", text: "理解，改期就好", scores: { rationality: 8, securityNeed: 2, boundary: 5 } },
      { key: "B", text: "有点失落，但不会说", scores: { securityNeed: 7, emotionExpression: 2, investment: 6 } },
      { key: "C", text: "会说出来有点失望", scores: { emotionExpression: 8, communication: 7, securityNeed: 5 } },
      { key: "D", text: "开始想这段关系是不是降温了", scores: { replySensitivity: 8, securityNeed: 9, investment: 7 } },
    ],
  },
  {
    id: "q13",
    order: 13,
    scene: "已经很晚了",
    stem: "你更想？",
    options: [
      { key: "A", text: "自己安静收工", scores: { independence: 8, companionship: 1, boundary: 6 } },
      { key: "B", text: "找 TA 再说两句", scores: { companionship: 8, communication: 6, dependency: 5 } },
      { key: "C", text: "看 TA 还在不在线再决定", scores: { replySensitivity: 6, dependency: 5, emotionSensitivity: 5 } },
      { key: "D", text: "发个莫名其妙的东西试试水", scores: { abstract: 8, novelty: 6, communication: 4 } },
    ],
  },
  {
    id: "q14",
    order: 14,
    scene: "出现一个具体问题要解决",
    stem: "你的路径是？",
    options: [
      { key: "A", text: "列事实，找方案", scores: { rationality: 10, conflictInitiative: 6, emotionExpression: 3 } },
      { key: "B", text: "先处理情绪再谈事", scores: { emotionSensitivity: 8, emotionExpression: 6, companionship: 5 } },
      { key: "C", text: "能拖就拖", scores: { conflictAvoidance: 8, novelty: 2, investment: 2 } },
      { key: "D", text: "谁更急谁来主导", scores: { dominance: 4, boundary: 6, communication: 3 } },
    ],
  },
  {
    id: "q15",
    order: 15,
    scene: "一群人在场",
    stem: "你和 TA 的组合更像？",
    options: [
      { key: "A", text: "我负责说话，TA 负责在", scores: { communication: 8, abstract: 5, companionship: 4 } },
      { key: "B", text: "我负责观察，TA 负责场", scores: { emotionSensitivity: 7, communication: 2, independence: 5 } },
      { key: "C", text: "两个人一起热闹", scores: { novelty: 7, communication: 7, abstract: 6 } },
      { key: "D", text: "两个人一起边缘观察", scores: { independence: 6, communication: 2, conflictAvoidance: 5 } },
    ],
  },
  {
    id: "q16",
    order: 16,
    scene: "最近各自都很忙",
    stem: "你会？",
    options: [
      { key: "A", text: "减少联系，等空窗", scores: { independence: 7, boundary: 6, investment: 3 } },
      { key: "B", text: "再忙也要保持存在感", scores: { investment: 9, companionship: 7, communication: 6 } },
      { key: "C", text: "会不安，但假装没事", scores: { securityNeed: 8, emotionExpression: 2, replySensitivity: 6 } },
      { key: "D", text: "约个短会把节奏对齐", scores: { dominance: 6, rationality: 7, investment: 6 } },
    ],
  },
  {
    id: "q17",
    order: 17,
    scene: "TA 看起来心情不好",
    stem: "你第一动作是？",
    options: [
      { key: "A", text: "问：你怎么了？", scores: { emotionSensitivity: 8, communication: 7, companionship: 6 } },
      { key: "B", text: "陪着，不多问", scores: { companionship: 7, conflictAvoidance: 5, emotionSensitivity: 5 } },
      { key: "C", text: "先观察，不确定就不打扰", scores: { boundary: 7, independence: 5, emotionSensitivity: 4 } },
      { key: "D", text: "给解决方案", scores: { rationality: 8, conflictInitiative: 5, emotionSensitivity: 2 } },
    ],
  },
  {
    id: "q18",
    order: 18,
    scene: "TA 想看你手机 / 问你行程很细",
    stem: "你的感受更接近？",
    options: [
      { key: "A", text: "不太舒服，这是边界", scores: { boundary: 10, independence: 7, securityNeed: 2 } },
      { key: "B", text: "可以理解，说明在意", scores: { securityNeed: 6, dependency: 6, boundary: 2 } },
      { key: "C", text: "看具体问什么，一事一议", scores: { rationality: 7, boundary: 6, communication: 5 } },
      { key: "D", text: "我会反过来也问得很细", scores: { dependency: 7, securityNeed: 7, investment: 5 } },
    ],
  },
  {
    id: "q19",
    order: 19,
    scene: "已经两天没主动联系",
    stem: "你更可能？",
    options: [
      { key: "A", text: "我先发", scores: { communication: 9, investment: 7, dependency: 4 } },
      { key: "B", text: "等 TA 先找我", scores: { dominance: 3, conflictAvoidance: 6, replySensitivity: 5 } },
      { key: "C", text: "不觉得需要天天联系", scores: { independence: 8, boundary: 7, companionship: 1 } },
      { key: "D", text: "心里已经排了小剧场", scores: { replySensitivity: 9, securityNeed: 8, emotionSensitivity: 6 } },
    ],
  },
  {
    id: "q20",
    order: 20,
    scene: "你自己状态很低",
    stem: "你希望 TA？",
    options: [
      { key: "A", text: "主动来陪一下", scores: { companionship: 9, dependency: 8, securityNeed: 6 } },
      { key: "B", text: "给我空间，别围过来", scores: { independence: 9, boundary: 8, companionship: 1 } },
      { key: "C", text: "听我讲，先别给道理", scores: { emotionExpression: 8, emotionSensitivity: 6, rationality: 1 } },
      { key: "D", text: "帮我把事情理清楚", scores: { rationality: 7, conflictInitiative: 4, emotionExpression: 4 } },
    ],
  },
  {
    id: "q21",
    order: 21,
    scene: "两个人都有点纠结",
    stem: "最后通常谁拍板？",
    options: [
      { key: "A", text: "我", scores: { dominance: 9, conflictInitiative: 6, communication: 5 } },
      { key: "B", text: "TA", scores: { dominance: 1, dependency: 7, conflictAvoidance: 5 } },
      { key: "C", text: "一起耗到必须选", scores: { conflictAvoidance: 6, rationality: 3, novelty: 3 } },
      { key: "D", text: "用奇怪的方法随机一下", scores: { abstract: 8, novelty: 7, dominance: 3 } },
    ],
  },
  {
    id: "q22",
    order: 22,
    scene: "聊天气氛突然变平",
    stem: "你会？",
    options: [
      { key: "A", text: "丢一个梗把场救回来", scores: { abstract: 9, novelty: 7, communication: 6 } },
      { key: "B", text: "认真问是不是哪里不对", scores: { emotionSensitivity: 8, communication: 7, securityNeed: 5 } },
      { key: "C", text: "也跟着安静", scores: { conflictAvoidance: 7, independence: 5, communication: 1 } },
      { key: "D", text: "开启新话题推进", scores: { dominance: 6, investment: 6, communication: 6 } },
    ],
  },
  {
    id: "q23",
    order: 23,
    scene: "明明有点不对，但还没撕破",
    stem: "谁先低头？",
    options: [
      { key: "A", text: "我比较容易先开口", scores: { conflictAvoidance: 6, emotionExpression: 7, communication: 6 } },
      { key: "B", text: "我会等 TA 先动", scores: { dominance: 6, conflictAvoidance: 5, emotionExpression: 2 } },
      { key: "C", text: "用行动示好，不直接说", scores: { emotionExpression: 3, investment: 6, conflictAvoidance: 6 } },
      { key: "D", text: "当成没发生，时间会冲淡", scores: { conflictAvoidance: 8, rationality: 4, replySensitivity: 2 } },
    ],
  },
  {
    id: "q24",
    order: 24,
    scene: "难得有一整天自由时间",
    stem: "理想状态是？",
    options: [
      { key: "A", text: "完全属于自己", scores: { independence: 10, companionship: 0, boundary: 8 } },
      { key: "B", text: "大部分时间和 TA 一起", scores: { companionship: 10, dependency: 7, independence: 1 } },
      { key: "C", text: "各玩各的，但要在同一个空间", scores: { companionship: 5, independence: 6, boundary: 5 } },
      { key: "D", text: "安排一件从没做过的事", scores: { novelty: 9, investment: 5, abstract: 4 } },
    ],
  },
  {
    id: "q25",
    order: 25,
    scene: "这段关系最近的存在感",
    stem: "你更在意？",
    options: [
      { key: "A", text: "TA 是不是还把我放在心上", scores: { securityNeed: 9, investment: 7, replySensitivity: 6 } },
      { key: "B", text: "我自己有没有被绑太紧", scores: { boundary: 8, independence: 7, dependency: 1 } },
      { key: "C", text: "我们有没有一起往前走", scores: { investment: 8, dominance: 5, rationality: 5 } },
      { key: "D", text: "好不好玩，气场还在不在", scores: { novelty: 7, abstract: 6, investment: 4 } },
    ],
  },
  {
    id: "q26",
    order: 26,
    scene: "计划好的事突然要改",
    stem: "你的反应？",
    options: [
      { key: "A", text: "有点烦，但可以调", scores: { rationality: 6, novelty: 3, boundary: 4 } },
      { key: "B", text: "正好，原来那样也一般", scores: { novelty: 8, conflictAvoidance: 4, dominance: 2 } },
      { key: "C", text: "会问清楚为什么改", scores: { communication: 7, rationality: 6, securityNeed: 4 } },
      { key: "D", text: "如果没跟我商量，会不舒服", scores: { boundary: 8, dominance: 5, securityNeed: 6 } },
    ],
  },
  {
    id: "q27",
    order: 27,
    scene: "你突然很想找 TA",
    stem: "你会？",
    options: [
      { key: "A", text: "直接说：在吗，想找你", scores: { emotionExpression: 9, communication: 8, companionship: 7 } },
      { key: "B", text: "找个借口再发", scores: { emotionExpression: 3, conflictAvoidance: 6, replySensitivity: 4 } },
      { key: "C", text: "忍住，等更自然的时机", scores: { independence: 6, boundary: 5, emotionExpression: 2 } },
      { key: "D", text: "发一张毫无上下文的图", scores: { abstract: 9, communication: 4, novelty: 5 } },
    ],
  },
  {
    id: "q28",
    order: 28,
    scene: "出现误会",
    stem: "你习惯？",
    options: [
      { key: "A", text: "立刻解释，把逻辑铺开", scores: { rationality: 9, communication: 8, conflictInitiative: 6 } },
      { key: "B", text: "先生气，再决定说不说", scores: { emotionSensitivity: 7, conflictInitiative: 5, emotionExpression: 5 } },
      { key: "C", text: "不解释，看 TA 懂不懂", scores: { conflictAvoidance: 7, emotionExpression: 1, replySensitivity: 6 } },
      { key: "D", text: "用轻松的话把事揭过", scores: { abstract: 6, conflictAvoidance: 6, communication: 5 } },
    ],
  },
  {
    id: "q29",
    order: 29,
    scene: "你们的聊天窗口",
    stem: "更像哪种？",
    options: [
      { key: "A", text: "信息密度很高，有事说事", scores: { communication: 7, rationality: 6, abstract: 2 } },
      { key: "B", text: "梗、表情包、跳跃话题", scores: { abstract: 10, novelty: 7, communication: 5 } },
      { key: "C", text: "常常已读，过一会儿才回", scores: { independence: 6, replySensitivity: 2, communication: 2 } },
      { key: "D", text: "会反复确认对方意思", scores: { replySensitivity: 8, emotionSensitivity: 7, securityNeed: 6 } },
    ],
  },
  {
    id: "q30",
    order: 30,
    scene: "如果给这段关系打一个此刻的投入分",
    stem: "你更诚实的是？",
    options: [
      { key: "A", text: "挺上心的，愿意花精力", scores: { investment: 10, dependency: 6, companionship: 6 } },
      { key: "B", text: "重要，但不要绑死我", scores: { boundary: 8, independence: 7, investment: 5 } },
      { key: "C", text: "走一步看一步", scores: { novelty: 5, investment: 3, rationality: 4 } },
      { key: "D", text: "我在，但表达得很克制", scores: { investment: 6, emotionExpression: 2, conflictAvoidance: 6 } },
    ],
  },
];
