import { Prisma, TestStatus, UnlockType } from "@prisma/client";
import { QUESTIONS, QUESTION_VERSION, type OptionKey } from "../content/questions.js";
import { prisma } from "../db.js";
import {
  buildPairDetails,
  buildPairReport,
  buildPersonalHighlights,
  buildPersonalResult,
  LOCKED_ITEMS,
  readReportVersion,
  teaserOf,
  type StoredPairReport,
} from "../algorithms/compose.js";
import type { RelationshipCandidate, RelationshipEvidence } from "../algorithms/relationship.js";
import { mapArchive, type RelationshipArchive } from "../algorithms/archive.js";
import { mapWhoMoreItem, type WhoMoreInput } from "../algorithms/who-more.js";
import type { AnswerInput } from "../algorithms/scoring.js";
import { generateInviteCode, isInviteCode } from "../utils/crypto.js";
import { AppError, ErrorCodes } from "../utils/errors.js";
import { buildIcebergSunDossier } from "../content/iceberg-sun-dossier.js";

const REQUIRED_QUESTION_IDS = QUESTIONS.map((q) => q.id);

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function publicQuestions() {
  return QUESTIONS.map((q) => ({
    id: q.id,
    order: q.order,
    scene: q.scene,
    stem: q.stem,
    options: q.options.map((o) => ({ key: o.key, text: o.text })),
  }));
}

function assertParticipant(test: { creatorId: string; participantBId: string | null }, userId: string) {
  if (test.creatorId !== userId && test.participantBId !== userId) {
    throw new AppError(ErrorCodes.FORBIDDEN, "不是该测试参与者", 403);
  }
}

export async function createTest(userId: string, expiresDays: number) {
  const creator = await prisma.user.findUnique({
    where: { id: userId },
    include: { accessCode: true },
  });
  if (!creator) throw new AppError(ErrorCodes.UNAUTHORIZED, "用户不存在", 401);
  if (creator.accessRole === "guest") {
    throw new AppError(ErrorCodes.FORBIDDEN, "受邀者不能发起新测试，请先输入购买验证码", 403);
  }
  if (creator.accessRole === "buyer" && (!creator.accessCode || !creator.accessCode.isActive)) {
    throw new AppError(ErrorCodes.ACCESS_CODE_INVALID, "验证码已停用，无法发起新测试", 403);
  }
  let inviteCode = generateInviteCode();
  for (let i = 0; i < 100; i += 1) {
    const exists = await prisma.test.findUnique({ where: { inviteCode } });
    if (!exists) break;
    inviteCode = generateInviteCode();
  }

  const duplicate = await prisma.test.findUnique({ where: { inviteCode } });
  if (duplicate) {
    throw new AppError(ErrorCodes.INTERNAL, "邀请码生成失败，请稍后重试", 500);
  }

  const test = await prisma.test.create({
    data: {
      creatorId: userId,
      inviteCode,
      status: TestStatus.a_in_progress,
      questionVersion: QUESTION_VERSION,
      purchaseAccessCodeId: creator.accessRole === "buyer" ? creator.accessCodeId : null,
      expiresAt: new Date(Date.now() + expiresDays * 24 * 3600 * 1000),
    },
  });
  return serializeTest(test, userId);
}

export async function joinTest(userId: string, inviteCode: string) {
  const code = inviteCode.trim();
  if (!isInviteCode(code)) {
    throw new AppError(ErrorCodes.INVITE_NOT_FOUND, "邀请码不存在", 404);
  }
  const test = await prisma.test.findUnique({ where: { inviteCode: code } });
  if (!test) throw new AppError(ErrorCodes.INVITE_NOT_FOUND, "邀请码不存在", 404);
  if (test.expiresAt < new Date()) {
    await prisma.test.update({ where: { id: test.id }, data: { status: TestStatus.expired } });
    throw new AppError(ErrorCodes.INVITE_EXPIRED, "邀请码已过期", 400);
  }
  if (test.creatorId === userId) {
    throw new AppError(ErrorCodes.JOIN_OWN_TEST, "不能加入自己创建的测试", 400);
  }
  if (test.participantBId && test.participantBId !== userId) {
    throw new AppError(ErrorCodes.INVITE_TAKEN, "邀请码已被他人使用", 409);
  }
  if (test.status === TestStatus.expired) {
    throw new AppError(ErrorCodes.INVITE_EXPIRED, "邀请码已过期", 400);
  }
  const joinable: TestStatus[] = [TestStatus.a_completed, TestStatus.b_in_progress, TestStatus.completed];
  if (!joinable.includes(test.status)) {
    throw new AppError(ErrorCodes.INVALID_STATE, "对方还没有完成测试", 400);
  }

  if (test.participantBId === userId) {
    return serializeTest(test, userId);
  }

  const updated = await prisma.test.update({
    where: { id: test.id },
    data: { participantBId: userId, status: TestStatus.b_in_progress },
  });
  return serializeTest(updated, userId);
}

export async function getTest(testId: string, userId: string) {
  const test = await prisma.test.findUnique({ where: { id: testId } });
  if (!test) throw new AppError(ErrorCodes.NOT_FOUND, "测试不存在", 404);
  assertParticipant(test, userId);
  const progress = await answerCount(testId, userId);
  const unlock = await findPairUnlock(testId);
  return {
    ...serializeTest(test, userId),
    answeredCount: progress,
    totalQuestions: QUESTIONS.length,
    unlocked: Boolean(unlock && unlock.unlockStatus === "granted"),
    peerUnlocked: Boolean(unlock),
  };
}

export async function upsertAnswers(
  testId: string,
  userId: string,
  answers: Array<{ questionId: string; optionKey: string }>,
) {
  const test = await prisma.test.findUnique({ where: { id: testId } });
  if (!test) throw new AppError(ErrorCodes.NOT_FOUND, "测试不存在", 404);
  assertParticipant(test, userId);
  const role = test.creatorId === userId ? "A" : "B";
  if (test.status === TestStatus.expired) {
    throw new AppError(ErrorCodes.ALREADY_COMPLETED, "测试已过期，不能再提交", 400);
  }
  if (test.status === TestStatus.completed) {
    throw new AppError(ErrorCodes.ALREADY_COMPLETED, "测试已完成，不能再提交", 400);
  }
  if (role === "A" && test.status !== TestStatus.a_in_progress && test.status !== TestStatus.created) {
    throw new AppError(ErrorCodes.ALREADY_COMPLETED, "测试已完成，不能再提交", 400);
  }

  const validIds = new Set(QUESTIONS.map((q) => q.id));
  const ops = answers
    .filter((item) => validIds.has(item.questionId) && ["A", "B", "C", "D"].includes(item.optionKey))
    .map((item) =>
      prisma.testAnswer.upsert({
        where: {
          testId_userId_questionId: {
            testId,
            userId,
            questionId: item.questionId,
          },
        },
        update: { optionKey: item.optionKey },
        create: {
          testId,
          userId,
          questionId: item.questionId,
          optionKey: item.optionKey,
        },
      }),
    );
  await prisma.$transaction(ops);
  return { answeredCount: await answerCount(testId, userId), totalQuestions: QUESTIONS.length };
}

export async function completeTest(testId: string, userId: string) {
  const test = await prisma.test.findUnique({ where: { id: testId } });
  if (!test) throw new AppError(ErrorCodes.NOT_FOUND, "测试不存在", 404);
  assertParticipant(test, userId);

  const answers = await prisma.testAnswer.findMany({ where: { testId, userId } });
  const answeredIds = new Set(answers.map((a) => a.questionId));
  if (REQUIRED_QUESTION_IDS.some((id) => !answeredIds.has(id))) {
    throw new AppError(ErrorCodes.INCOMPLETE_ANSWERS, "答题未完成，不能交卷", 400);
  }

  const mapped: AnswerInput[] = answers.map((a) => ({
    questionId: a.questionId,
    optionKey: a.optionKey as OptionKey,
  }));
  const personal = buildPersonalResult(mapped);
  const role = test.creatorId === userId ? "A" : "B";
  const personalityView = {
    typeId: personal.personality.typeId,
    typeName: personal.personality.typeName,
    tagline: personal.personality.tagline,
    summary: personal.personality.summary,
  };

  const existingPersonality = await prisma.personalityResult.findUnique({
    where: { testId_userId: { testId, userId } },
  });
  if (existingPersonality) {
    if (role === "A") {
      return {
        role,
        inviteCode: test.inviteCode,
        personality: personalityView,
        waitingForPeer: test.status !== TestStatus.completed,
      };
    }
    if (test.status === TestStatus.completed) {
      return { role, inviteCode: test.inviteCode, personality: personalityView, waitingForPeer: false };
    }
  }

  await prisma.personalityResult.upsert({
    where: { testId_userId: { testId, userId } },
    update: {
      personalityType: personal.personality.typeId,
      secondaryType: personal.personality.secondaryTypeId,
      dimensionScores: personal.dimensionScores,
      typeScores: personal.personality.typeScores,
      role,
    },
    create: {
      testId,
      userId,
      role,
      personalityType: personal.personality.typeId,
      secondaryType: personal.personality.secondaryTypeId,
      dimensionScores: personal.dimensionScores,
      typeScores: personal.personality.typeScores,
    },
  });

  if (role === "A") {
    if (test.status === TestStatus.a_in_progress || test.status === TestStatus.created) {
      await prisma.test.update({
        where: { id: testId },
        data: { status: TestStatus.a_completed },
      });
    }
    const latest = await prisma.test.findUnique({ where: { id: testId } });
    return {
      role,
      inviteCode: (latest ?? test).inviteCode,
      personality: personalityView,
      waitingForPeer: (latest ?? test).status !== TestStatus.completed,
    };
  }

  const existingRel = await prisma.relationshipResult.findUnique({ where: { testId } });
  if (existingRel && test.status === TestStatus.completed) {
    return { role, inviteCode: test.inviteCode, personality: personalityView, waitingForPeer: false };
  }

  const creatorAnswers = await prisma.testAnswer.findMany({
    where: { testId, userId: test.creatorId },
  });
  const report = buildPairReport(
    creatorAnswers.map((a) => ({ questionId: a.questionId, optionKey: a.optionKey as OptionKey })),
    mapped,
  );

  const completionOps: Prisma.PrismaPromise<unknown>[] = [
    prisma.relationshipResult.upsert({
      where: { testId },
      update: {
        relationshipType: report.relationshipType,
        indices: asJson(report.indices),
        whoMore: asJson(report.whoMore),
        scene: asJson(report.scene),
        roast: report.roast,
        advice: asJson(report.advice),
        content: asJson(report),
      },
      create: {
        testId,
        relationshipType: report.relationshipType,
        indices: asJson(report.indices),
        whoMore: asJson(report.whoMore),
        scene: asJson(report.scene),
        roast: report.roast,
        advice: asJson(report.advice),
        content: asJson(report),
      },
    }),
    prisma.test.update({
      where: { id: testId },
      data: { status: TestStatus.completed, completedAt: new Date() },
    }),
  ];
  if (test.purchaseAccessCodeId && test.participantBId) {
    for (const participantId of [test.creatorId, test.participantBId]) {
      completionOps.push(prisma.resultUnlock.upsert({
        where: {
          testId_userId_unlockType: { testId, userId: participantId, unlockType: UnlockType.FULL_RESULT },
        },
        update: { unlockStatus: "granted" },
        create: { testId, userId: participantId, unlockType: UnlockType.FULL_RESULT },
      }));
    }
  }
  await prisma.$transaction(completionOps);

  return {
    role,
    inviteCode: test.inviteCode,
    personality: personalityView,
    waitingForPeer: false,
  };
}

export async function getPersonalResult(testId: string, userId: string) {
  const test = await prisma.test.findUnique({ where: { id: testId } });
  if (!test) throw new AppError(ErrorCodes.NOT_FOUND, "测试不存在", 404);
  assertParticipant(test, userId);
  const mine = await prisma.personalityResult.findUnique({
    where: { testId_userId: { testId, userId } },
  });
  if (!mine) throw new AppError(ErrorCodes.NOT_FOUND, "还没有个人结果", 404);
  const { matchPersonality } = await import("../algorithms/personality.js");
  const scores = mine.dimensionScores as Parameters<typeof matchPersonality>[0];
  const personality = matchPersonality(scores);
  return {
    role: mine.role,
    inviteCode: test.inviteCode,
    status: test.status,
    waitingForPeer: test.status !== TestStatus.completed,
    personality: {
      typeId: personality.typeId,
      typeName: personality.typeName,
      tagline: personality.tagline,
      summary: personality.summary,
      secondaryTypeName: personality.secondaryTypeName,
    },
    highlights: buildPersonalHighlights(scores),
  };
}

export async function getRelationship(testId: string, userId: string) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: { relationship: true, personalities: true },
  });
  if (!test) throw new AppError(ErrorCodes.NOT_FOUND, "测试不存在", 404);
  assertParticipant(test, userId);
  if (test.status !== TestStatus.completed || !test.relationship) {
    throw new AppError(ErrorCodes.RELATIONSHIP_PENDING, "关系报告尚未生成", 409);
  }

  const report = test.relationship.content as unknown as StoredPairReport;
  const pairUnlock = await findPairUnlock(testId);
  const unlocked = Boolean(pairUnlock);
  const peerUnlocked = unlocked;
  const iAmA = test.creatorId === userId;
  const teaser = {
    ...teaserOf(report),
    relationshipType: report.relationshipType,
    yourTypeName: iAmA ? report.a.typeName : report.b.typeName,
    taTypeName: iAmA ? report.b.typeName : report.a.typeName,
  };

  return {
    unlocked,
    peerUnlocked,
    teaser,
    lockedItems: LOCKED_ITEMS,
    full: unlocked ? mapFull(report, iAmA) : null,
  };
}

export async function getCardPayload(testId: string, userId: string) {
  const rel = await getRelationship(testId, userId);
  if (!rel.unlocked || !rel.full) {
    throw new AppError(ErrorCodes.NOT_UNLOCKED, "未解锁，不能生成关系卡片", 403);
  }
  const dossier = buildIcebergSunDossier({
    testId,
    relationshipType: rel.teaser.relationshipType,
    relationshipCode: rel.teaser.relationshipCode,
    relationshipName: rel.teaser.relationshipName,
    subtitle: rel.teaser.subtitle,
    tagline: rel.teaser.tagline,
    indices: rel.full.indices,
    you: rel.full.you,
    ta: rel.full.ta,
    whoMore: rel.full.whoMore,
    misunderstandings: rel.full.misunderstandings,
    conflictPattern: rel.full.conflictPattern,
    communicationGuide: rel.full.communicationGuide,
  });
  return {
    relationshipCode: rel.teaser.relationshipCode,
    relationshipName: rel.teaser.relationshipName,
    subtitle: rel.teaser.subtitle,
    tagline: rel.teaser.tagline,
    rapport: rel.teaser.rapport,
    companionship: rel.full.indices.companionship,
    spark: rel.full.indices.spark,
    security: rel.full.indices.security,
    freedom: rel.full.indices.freedom,
    abstract: rel.full.indices.abstract,
    yourTypeName: rel.teaser.yourTypeName,
    taTypeName: rel.teaser.taTypeName,
    summary: rel.full.summary,
    dossier,
  };
}

export async function listMine(userId: string) {
  const tests = await prisma.test.findMany({
    where: { OR: [{ creatorId: userId }, { participantBId: userId }] },
    include: { relationship: true, personalities: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return tests.map((test) => {
    const mine = test.personalities.find((p) => p.userId === userId);
    return {
      id: test.id,
      status: test.status,
      inviteCode: test.inviteCode,
      role: test.creatorId === userId ? "A" : "B",
      createdAt: test.createdAt,
      relationshipName:
        test.relationship && test.status === TestStatus.completed
          ? (test.relationship.content as unknown as ReturnType<typeof buildPairReport>).relationshipName
          : null,
      personalityType: mine?.personalityType ?? null,
    };
  });
}

function mapPartyText(text: string, viewerIsA: boolean): string {
  if (viewerIsA) return text.replaceAll("A", "你").replaceAll("B", "TA");
  return text.replaceAll("A", "\u0000").replaceAll("B", "你").replaceAll("\u0000", "TA");
}

function mapEvidence(item: RelationshipEvidence, viewerIsA: boolean) {
  const role = item.role === "pair" ? "pair" : item.role === "a" ? (viewerIsA ? "you" : "ta") : (viewerIsA ? "ta" : "you");
  return {
    ...item,
    role,
    aValue: viewerIsA ? item.aValue : item.bValue,
    bValue: viewerIsA ? item.bValue : item.aValue,
    text: mapPartyText(item.text, viewerIsA),
  };
}

function mapCandidate(candidate: RelationshipCandidate, viewerIsA: boolean) {
  const orientation = candidate.orientation === "symmetric" || viewerIsA
    ? candidate.orientation
    : candidate.orientation === "a-b"
      ? "b-a"
      : "a-b";
  return {
    ...candidate,
    orientation,
    roles: viewerIsA
      ? { you: candidate.roles.a, ta: candidate.roles.b }
      : { you: candidate.roles.b, ta: candidate.roles.a },
    evidence: candidate.evidence.map((item) => mapEvidence(item, viewerIsA)),
  };
}

export function mapFull(report: StoredPairReport, iAmA: boolean) {
  const version = readReportVersion(report);
  if (version.kind === "invalid") {
    throw new AppError(ErrorCodes.INVALID_STATE, "报告版本无效", 422);
  }
  const you = iAmA ? report.a : report.b;
  const ta = iAmA ? report.b : report.a;
  const whoMore = report.whoMore.map((item: WhoMoreInput) => mapWhoMoreItem(item, iAmA));
  const scene = {
    ...report.scene,
    lines: report.scene.lines.map((line) => {
      if (iAmA) return line;
      if (line.speaker === "you") return { ...line, speaker: "ta" as const };
      if (line.speaker === "ta") return { ...line, speaker: "you" as const };
      return line;
    }),
  };
  const details = report.misunderstandings && report.conflictPattern && report.communicationGuide
    ? {
        misunderstandings: report.misunderstandings,
        conflictPattern: report.conflictPattern,
        communicationGuide: report.communicationGuide,
      }
    : buildPairDetails(report.a.dimensionScores, report.b.dimensionScores);
  const misunderstandings = details.misunderstandings.map((item) =>
    iAmA
      ? { id: item.id, title: item.title, yourView: item.aView, taView: item.bView, bridge: item.bridge }
      : { id: item.id, title: item.title, yourView: item.bView, taView: item.aView, bridge: item.bridge },
  );
  const conflictPattern = iAmA
    ? {
        title: details.conflictPattern.title,
        yourReaction: details.conflictPattern.aReaction,
        taReaction: details.conflictPattern.bReaction,
        stuckAt: details.conflictPattern.stuckAt,
        repair: details.conflictPattern.repair,
      }
    : {
        title: details.conflictPattern.title,
        yourReaction: details.conflictPattern.bReaction,
        taReaction: details.conflictPattern.aReaction,
        stuckAt: details.conflictPattern.stuckAt,
        repair: details.conflictPattern.repair,
      };
  const communicationGuide = details.communicationGuide.map((item) =>
    iAmA
      ? { scenario: item.scenario, forYou: item.forA, forTa: item.forB, why: item.why }
      : { scenario: item.scenario, forYou: item.forB, forTa: item.forA, why: item.why },
  );
  const mapped = {
    reportVersion: version,
    summary: report.summary,
    indices: report.indices,
    indexLabels: report.indexLabels,
    you: {
      typeName: you.typeName,
      tagline: you.tagline,
      summary: you.summary,
      dimensionScores: you.dimensionScores,
    },
    ta: {
      typeName: ta.typeName,
      tagline: ta.tagline,
      summary: ta.summary,
      dimensionScores: ta.dimensionScores,
    },
    whoMore,
    scene,
    roast: report.roast,
    advice: report.advice,
    dimensionLabels: report.dimensionLabels,
    misunderstandings,
    conflictPattern,
    communicationGuide,
  };
  const withCandidates = version.kind === "v2" && report.relationshipCandidates && report.relationshipEvidence
    ? {
        ...mapped,
        relationshipCandidates: report.relationshipCandidates.map((candidate) => mapCandidate(candidate, iAmA)),
        relationshipEvidence: report.relationshipEvidence.map((item) => mapEvidence(item, iAmA)),
      }
    : mapped;
  if (version.kind !== "v2" || !report.relationshipConfidence || !report.dimensionComparison || !report.conflictCycle) {
    return withCandidates;
  }
  return { ...withCandidates, ...mapArchive(report as StoredPairReport & RelationshipArchive, iAmA) };
}

async function findPairUnlock(testId: string) {
  return prisma.resultUnlock.findFirst({
    where: {
      testId,
      unlockType: UnlockType.FULL_RESULT,
      unlockStatus: "granted",
    },
  });
}

async function answerCount(testId: string, userId: string) {
  return prisma.testAnswer.count({ where: { testId, userId } });
}

function serializeTest(
  test: {
    id: string;
    inviteCode: string;
    status: TestStatus;
    creatorId: string;
    participantBId: string | null;
    expiresAt: Date;
    questionVersion: number;
  },
  userId: string,
) {
  return {
    id: test.id,
    inviteCode: test.inviteCode,
    status: test.status,
    role: test.creatorId === userId ? "A" : "B",
    expiresAt: test.expiresAt,
    questionVersion: test.questionVersion,
    hasPeer: Boolean(test.participantBId),
  };
}
