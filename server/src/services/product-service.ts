import { Prisma, TestStatus, UnlockType } from "@prisma/client";
import type { AppConfig } from "../config.js";
import { prisma } from "../db.js";
import { AppError, ErrorCodes } from "../utils/errors.js";
import { getRelationship } from "./test-service.js";
import { requireNumericAccessCode } from "./admin-service.js";

export function getFullReportOffer(config: AppConfig) {
  return {
    productId: "full_pair_report",
    title: "完整双人关系报告",
    priceFen: config.REPORT_PRICE_FEN,
    priceLabel: `¥${(config.REPORT_PRICE_FEN / 100).toFixed(1)}`,
    priceVariant: config.REPORT_PRICE_VARIANT,
    prerequisite: "需要你和 TA 都完成 30 道题",
    entitlement: "任意一方解锁一次，两个人都能查看",
    benefits: [
      "你们最容易误解彼此的地方",
      "发生矛盾时各自的真实反应",
      "更容易被对方听懂的表达方式",
      "谁更主动、想多、嘴硬和先低头",
      "专属关系场景与可执行建议",
    ],
  };
}

export async function redeemFullReport(testId: string, userId: string, rawCode: string) {
  const code = requireNumericAccessCode(rawCode);
  const test = await prisma.test.findUnique({ where: { id: testId } });
  if (!test) throw new AppError(ErrorCodes.NOT_FOUND, "测试不存在", 404);
  if (test.creatorId !== userId && test.participantBId !== userId) {
    throw new AppError(ErrorCodes.FORBIDDEN, "不是该测试参与者", 403);
  }
  if (test.status !== TestStatus.completed || !test.participantBId) {
    throw new AppError(ErrorCodes.RELATIONSHIP_PENDING, "需要双方完成答题后才能解锁", 409);
  }

  const accessCode = await prisma.reportAccessCode.findUnique({ where: { code } });
  if (!accessCode || !accessCode.isActive) {
    throw new AppError(ErrorCodes.ACCESS_CODE_INVALID, "解锁码无效，请检查后重试", 400);
  }

  const existingUnlock = await prisma.resultUnlock.findFirst({
    where: { testId, unlockType: UnlockType.FULL_RESULT, unlockStatus: "granted" },
  });
  if (existingUnlock) return getRelationship(testId, userId);

  await prisma.$transaction(async (tx) => {
    const participants = [test.creatorId, test.participantBId].filter((id): id is string => Boolean(id));
    for (const participantId of participants) {
      await tx.resultUnlock.upsert({
        where: {
          testId_userId_unlockType: {
            testId,
            userId: participantId,
            unlockType: UnlockType.FULL_RESULT,
          },
        },
        update: { unlockStatus: "granted" },
        create: {
          testId,
          userId: participantId,
          unlockType: UnlockType.FULL_RESULT,
        },
      });
    }
    await tx.reportAccessCode.update({
      where: { id: accessCode.id },
      data: { useCount: { increment: 1 }, lastUsedAt: new Date() },
    });
    await tx.event.create({
      data: {
        userId,
        testId,
        eventName: "purchase_redeemed",
        properties: {
          priceFen: accessCode.priceFen,
          priceVariant: accessCode.priceVariant,
          channel: accessCode.channel,
          accessCodeId: accessCode.id,
        } as Prisma.InputJsonValue,
      },
    });
    await tx.event.create({
      data: {
        userId,
        testId,
        eventName: "access_code_used",
        properties: {
          accessCodeId: accessCode.id,
          agentId: accessCode.agentId,
          priceFen: accessCode.priceFen,
          source: "full_report",
          code: accessCode.code,
        } as Prisma.InputJsonValue,
      },
    });
  });

  return getRelationship(testId, userId);
}
