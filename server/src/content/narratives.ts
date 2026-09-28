import type { RelationshipTypeDef } from "./relationships.js";
import type { DimensionScores } from "../domain/dimensions.js";
import type { RelationshipIndices } from "../algorithms/indices.js";

export interface SceneLine {
  speaker: "you" | "ta" | "system";
  text: string;
}

export interface SceneContent {
  title: string;
  lines: SceneLine[];
  punchline: string;
}

const SCENES: Record<string, SceneContent> = {
  iceberg_sun: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "你怎么不说话？" },
      { speaker: "ta", text: "没事。" },
      { speaker: "you", text: "你是不是生气了？" },
      { speaker: "ta", text: "没有。" },
      { speaker: "you", text: "真的？" },
      { speaker: "ta", text: "真的。" },
    ],
    punchline: "很好，一场高质量安静正在加载。",
  },
  stubborn_soft: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "……" },
      { speaker: "ta", text: "……" },
      { speaker: "you", text: "那我先走了。" },
      { speaker: "ta", text: "嗯。" },
      { speaker: "you", text: "（其实都在等对方回头）" },
    ],
    punchline: "谁先开口谁输，但你们其实都想赢回这句。",
  },
  cat_dog: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "我们待一会儿？" },
      { speaker: "ta", text: "我想自己待着。" },
      { speaker: "you", text: "那我陪你自己待着。" },
      { speaker: "ta", text: "……这不叫自己。" },
    ],
    punchline: "靠近和空间要轮班，别同一秒上岗。",
  },
  plan_go_with_flow: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "周六下午两点，我订好了。" },
      { speaker: "ta", text: "哦今天周六啊。" },
      { speaker: "you", text: "……你看看群。" },
      { speaker: "ta", text: "到时候再说也行吧。" },
    ],
    punchline: "策划案遇上随机刷新，请预留缓冲时间。",
  },
  detective_missing: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "在吗？" },
      { speaker: "ta", text: "（三个小时后）刚看到。" },
      { speaker: "you", text: "我已经把今天复盘了三遍。" },
      { speaker: "ta", text: "我就是在忙啊。" },
    ],
    punchline: "一句「我在忙」能关掉整季内耗。",
  },
  clingy_free: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "今晚来吗？" },
      { speaker: "ta", text: "我想在家躺平。" },
      { speaker: "you", text: "那我过来躺。" },
      { speaker: "ta", text: "我的意思是自己躺。" },
    ],
    punchline: "陪伴和空间都是充电，插头别插错。",
  },
  rational_emotional: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "所以问题的本质是——" },
      { speaker: "ta", text: "我现在不想听本质。" },
      { speaker: "you", text: "那你想怎样？" },
      { speaker: "ta", text: "想被接住一下。" },
    ],
    punchline: "方案可以排队，情绪最好插队。",
  },
  active_passive: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "吃什么？" },
      { speaker: "ta", text: "都行。" },
      { speaker: "you", text: "火锅？" },
      { speaker: "ta", text: "可以。" },
      { speaker: "you", text: "那你到底想吃什么？" },
      { speaker: "ta", text: "我都可以啊。" },
    ],
    punchline: "「都可以」是世界上最难回答的问题之一。",
  },
  social_battery: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "我们去那边跟他们打个招呼。" },
      { speaker: "ta", text: "你去，我在这站着。" },
      { speaker: "you", text: "你就说一句。" },
      { speaker: "ta", text: "我已经说了「嗯」。" },
    ],
    punchline: "你负责说，TA 负责活着回来。",
  },
  spotlight_lowkey: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "我再讲一个。" },
      { speaker: "ta", text: "（已经默默举起手机）" },
      { speaker: "you", text: "你有在听吗？" },
      { speaker: "ta", text: "在拍。这就是听。" },
    ],
    punchline: "一个出镜，一个存档，其实很分工。",
  },
  radar_wood: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "你怎么了？" },
      { speaker: "ta", text: "我没怎么啊。" },
      { speaker: "you", text: "你刚才那口气。" },
      { speaker: "ta", text: "我有口气吗？" },
    ],
    punchline: "一个收到信号，一个根本没发射。",
  },
  pm_slacker: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "我把明天排好了。" },
      { speaker: "ta", text: "明天不是还有明天吗。" },
      { speaker: "you", text: "链接我发你了。" },
      { speaker: "ta", text: "哦我滑过去了。" },
    ],
    punchline: "行程安排 × 随机刷新，请设置已读回执。",
  },
  powder_extinguisher: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "我就说一句。" },
      { speaker: "ta", text: "你已经说了八段。" },
      { speaker: "you", text: "因为这件事很重要！" },
      { speaker: "ta", text: "先喝口水。" },
    ],
    punchline: "一个点火，一个善后。灭火器也需要休息。",
  },
  ice_ice: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "……" },
      { speaker: "ta", text: "……" },
      { speaker: "you", text: "那……你先说？" },
      { speaker: "ta", text: "你先。" },
    ],
    punchline: "谁先说话谁输。建议引入第三方话题：天气。",
  },
  sun_sun: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "我们再来一轮！" },
      { speaker: "ta", text: "好，我再约两个人。" },
      { speaker: "you", text: "要不要再加点？" },
      { speaker: "ta", text: "要。" },
    ],
    punchline: "两个人一起发光，记得给房间开个窗。",
  },
  spotlight_spotlight: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "看我这个。" },
      { speaker: "ta", text: "先看我这个。" },
      { speaker: "system", text: "周围人已经开始后退。" },
    ],
    punchline: "场面已经不受控，但这正是乐趣。",
  },
  rumination_comfort: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "我是不是说错话了。" },
      { speaker: "ta", text: "没有。" },
      { speaker: "you", text: "那为什么空气不太对。" },
      { speaker: "ta", text: "空气挺对的，来，坐一下。" },
    ],
    punchline: "脑内小剧场需要人间客服，也请给客服下班时间。",
  },
  hesitate_decide: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "这个也行……那个也行……" },
      { speaker: "ta", text: "选左边。" },
      { speaker: "you", text: "会不会右边更好。" },
      { speaker: "ta", text: "那右边。走了。" },
    ],
    punchline: "纠结是过程，拍板是服务。请互相感谢。",
  },
  grudge_forget: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "你还记得上次那件事吗？" },
      { speaker: "ta", text: "哪件？" },
      { speaker: "you", text: "就是那件。" },
      { speaker: "ta", text: "我已经忘了。" },
    ],
    punchline: "一个人存档，一个人清缓存。请定期同步。",
  },
  talk_now_later: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "我们现在把话说开。" },
      { speaker: "ta", text: "明天再说行不行。" },
      { speaker: "you", text: "现在。" },
      { speaker: "ta", text: "我现在说出来会更乱。" },
    ],
    punchline: "约定一个谈的时间，比立刻谈更重要。",
  },
  sensitive_stable: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "你是不是有点不对。" },
      { speaker: "ta", text: "我挺好的。" },
      { speaker: "you", text: "那我怎么有点慌。" },
      { speaker: "ta", text: "我在这。" },
    ],
    punchline: "一个负责想，一个负责稳。这套组合其实能托住场。",
  },
  independent_independent: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "你最近怎样？" },
      { speaker: "ta", text: "还行。你呢？" },
      { speaker: "you", text: "也还行。" },
      { speaker: "ta", text: "那就好。" },
    ],
    punchline: "自由充足。偶尔主动报个到，平行宇宙才能相交。",
  },
  together_together: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "你去哪。" },
      { speaker: "ta", text: "倒个水。" },
      { speaker: "you", text: "那我跟你。" },
      { speaker: "ta", text: "厨房离客厅七步。" },
    ],
    punchline: "连体婴文学成立。请给水壶一点独处时间。",
  },
  abstract_abstract: {
    title: "你们最可能出现的场景",
    lines: [
      { speaker: "you", text: "你懂我那个意思吧。" },
      { speaker: "ta", text: "懂，就是那个。" },
      { speaker: "you", text: "对对对。" },
      { speaker: "system", text: "在场第三个人：我可以走了吗？" },
    ],
    punchline: "梗密度超标。这是天赋。",
  },
};

const ROASTS: Record<string, string> = {
  iceberg_sun: "这段关系最大的问题不是不合，而是一个觉得「我很稳定」，一个觉得「你是不是不在乎」。",
  stubborn_soft: "你们不是不在意，是都在等对方先把壳卸下来。",
  cat_dog: "一个疯狂靠近，一个礼貌后退。这不是拒绝，是电量管理。",
  plan_go_with_flow: "一个人已经把下一步排好，另一个人还停留在「有下一步吗」。",
  detective_missing: "一个负责推理，一个负责失踪。建议把「在忙」设成快捷回复。",
  clingy_free: "陪伴需求碰上自由需求。谁也不该道歉，但要说清楚什么时候见。",
  rational_emotional: "讲道理很有用，但别在对方还没落地的时候讲。",
  active_passive: "一个负责开场，一个负责都可以。方向盘别一直让来让去。",
  social_battery: "你负责把场打开，TA 负责把电量活着带回来。这是分工，不是冷淡。",
  spotlight_lowkey: "一个负责发光，一个负责记录。别互相改造职业。",
  radar_wood: "「你怎么了」碰上「我没怎么」。请改用具体描述，例如「你回得比平时短」。",
  pm_slacker: "项目经理已经发了日程，摸鱼王还在随机刷新。进度条需要人工同步。",
  powder_extinguisher: "点火很快，灭火也很快。请轮流当灭火器。",
  ice_ice: "稳定得像两座冰山。默契有，开口少。偶尔破个冰不会死。",
  sun_sun: "热量充足，记得留一点阴影处给彼此单独待着。",
  spotlight_spotlight: "你们把气氛拉满了。很好玩，也请给旁边的人一条退路。",
  rumination_comfort: "你负责想太多，TA 负责说没事。客服位很重要，但不要通宵。",
  hesitate_decide: "纠结是认真，拍板是承担。选完就走，别回头再开盘。",
  grudge_forget: "一个人还在复盘，另一个人已经把存档删了。请声明哪些事要记住。",
  talk_now_later: "一个要现在聊清楚，一个要冷却。把「何时谈」谈清楚，比把内容谈清楚更先。",
  sensitive_stable: "雷达和减震器是一套好零件。别把敏感叫作作，也别把稳定叫冷。",
  independent_independent: "空间多到可以开两间房。记得偶尔敲一下隔壁。",
  together_together: "黏是双向技能。很好，也给门留一条缝。",
  abstract_abstract: "你们的语言系统已经脱离公共频道。这很酷，记得翻译给世界。",
};

const ADVICE: Record<string, string[]> = {
  iceberg_sun: [
    "热的那一方：把「你在吗」说成具体需求。",
    "冷的那一方：忙的时候回一句「在，晚一点说」。",
    "空间不是疏远，回应也不是黏人。",
  ],
  stubborn_soft: ["先低头不是输，是让这段关系继续。", "把「我没事」改成「我需要一点时间」。", "别用沉默当谈判。"],
  cat_dog: ["约定靠近和独处的轮班。", "想待在一起时说出口，想自己待也说出口。", "别把后退理解成不喜欢。"],
  plan_go_with_flow: ["计划的人留 20% 空白。", "随缘的人至少回一句收到。", "用共同日历，少用灵魂感应。"],
  detective_missing: ["空窗超过约定时间，报备一句。", "乱想的一方先问事实，再写剧本。", "已读不是结论。"],
  clingy_free: ["陪伴要预约，空间也要预约。", "拒绝一次见面不等于拒绝这段关系。", "见面前先问电量。"],
  rational_emotional: ["先接情绪，再给方案。", "感性的一方尽量说「我现在需要被听」。", "理性的一方把道理放到第二段。"],
  active_passive: ["少说都可以，多给一个真偏好。", "主动的人也可以把选择权还回去一次。", "「你定」请附带两个选项。"],
  social_battery: ["出门前商量社交时长。", "社牛负责开场，社恐负责撤退信号。", "回家后允许安静，不必立刻复盘。"],
  spotlight_lowkey: ["出镜的人别逼对方表演。", "低调的人用小事回应就够。", "掌声和镜头可以轮流。"],
  radar_wood: ["木头一方学习播报状态。", "雷达一方少做无证据推理。", "用「我观察到」代替「你肯定是」。"],
  pm_slacker: ["日程发出来要有确认。", "摸鱼不是错误，失联才是。", "每周只推一个必须落地的约定。"],
  powder_extinguisher: ["点火前数三秒。", "灭火的人可以说「我今晚接不住」。", "事后复盘，不在火上复盘。"],
  ice_ice: ["每周一次主动开场，哪怕很短。", "把在意说出来，对方收不到脑电波。", "沉默可以是舒适，也可以是卡住，要标注。"],
  sun_sun: ["热情很好，留白也是照顾。", "其中一人低电量时，允许缩小活动半径。", "别用能量比拼谁更在乎。"],
  spotlight_spotlight: ["把舞台让出 30% 给安静。", "玩梗可以，确认对方跟上了。", "热闹结束后一起落地。"],
  rumination_comfort: ["内耗的人把担心写成一句问句。", "安抚的人设定可接时长。", "「我在」比长篇大论好用。"],
  hesitate_decide: ["纠结限时五分钟。", "决策的人说明理由，一句就够。", "选完不回头翻盘。"],
  grudge_forget: ["重要的事要明确「请记住」。", "转头忘的人不要说「不就是小事」。", "复盘一次，然后归档。"],
  talk_now_later: ["冲突来了先约时间：今晚十点或明天上午。", "冷却不是消失。", "到点就要谈，不要无限延期。"],
  sensitive_stable: ["稳定的一方多报两句平安。", "敏感的一方把感受说具体。", "稳不是冷，想也不是错。"],
  independent_independent: ["定期签到，哪怕很短。", "别默认对方不需要被想起。", "自由里加一点主动。"],
  together_together: ["每天留一段互不打扰的时间。", "黏人可以，监视不行。", "各自有一点小世界，回来才有新的可聊。"],
  abstract_abstract: ["梗之后补一句人话。", "重要约定不要只发表情包。", "抽象是娱乐，对齐是生活。"],
};

export function buildNarrative(
  type: RelationshipTypeDef,
  _a: DimensionScores,
  _b: DimensionScores,
  _indices: RelationshipIndices,
): { scene: SceneContent; roast: string; advice: string[] } {
  return {
    scene: SCENES[type.id] ?? SCENES.iceberg_sun,
    roast: ROASTS[type.id] ?? ROASTS.iceberg_sun,
    advice: ADVICE[type.id] ?? ADVICE.iceberg_sun,
  };
}
