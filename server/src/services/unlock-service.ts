import { AdSessionStatus, Prisma, UnlockType } from "@prisma/client";
import { createHash } from "node:crypto";
import type { Redis } from "ioredis";
import type { AppConfig } from "../config.js";
import { prisma } from "../db.js";
import { randomNonce, sha256 } from "../utils/crypto.js";
import { AppError, ErrorCodes } from "../utils/errors.js";
import { getRelationship } from "./test-service.js";

const UNLOCK_TYPE = UnlockType.FULL_RESULT;

interface NonceBind {
  testId: string;
  userId: string;
  unlockType: "FULL_RESULT";
  sessionId: string;
}

export async function createAdSession(config: AppConfig, redis: Redis, testId: string, userId: string) {
  const rel = await getRelationship(testId, userId);
  if (rel.unlocked) {
    throw new AppError(ErrorCodes.ALREADY_UNLOCKED, "该类型已解锁，直接返回完整结果", 400);
  }

  await hitRateLimit(redis, `ad:rl:session:${userId}`, 8, 60);

  const nonce = randomNonce();
  const nonceHash = sha256(nonce);
  const ttl = config.AD_SESSION_TTL_SECONDS;
  const session = await prisma.adSession.create({
    data: {
      testId,
      userId,
      nonceHash,
      status: AdSessionStatus.started,
      expiresAt: new Date(Date.now() + ttl * 1000),
    },
  });

  await rememberNonce(redis, nonceHash, {
    testId,
    userId,
    unlockType: "FULL_RESULT",
    sessionId: session.id,
  }, ttl);

  return { sessionId: session.id, nonce, expiresAt: session.expiresAt, unlockType: UNLOCK_TYPE };
}

export async function unlockFullResult(
  config: AppConfig,
  redis: Redis,
  testId: string,
  userId: string,
  nonce: string,
) {
  await hitRateLimit(redis, `ad:rl:unlock:${userId}`, 12, 60);

  const existing = await prisma.resultUnlock.findUnique({
    where: {
      testId_userId_unlockType: { testId, userId, unlockType: UNLOCK_TYPE },
    },
  });
  if (existing && existing.unlockStatus === "granted") {
    return getRelationship(testId, userId);
  }

  const nonceHash = sha256(nonce);
  const bind = await readNonceBind(redis, nonceHash);
  if (bind) {
    if (bind.userId !== userId || bind.testId !== testId || bind.unlockType !== "FULL_RESULT") {
      throw new AppError(ErrorCodes.AD_SESSION_INVALID, "广告凭证与当前用户或测试不匹配", 400);
    }
  }

  const session = await prisma.adSession.findFirst({
    where: { testId, userId, nonceHash },
    orderBy: { createdAt: "desc" },
  });
  if (!session) {
    throw new AppError(ErrorCodes.AD_SESSION_INVALID, "广告会话不存在或已过期", 400);
  }
  if (session.status === AdSessionStatus.consumed) {
    throw new AppError(ErrorCodes.AD_NONCE_USED, "广告凭证已使用", 400);
  }
  if (session.status !== AdSessionStatus.started || session.expiresAt < new Date()) {
    throw new AppError(ErrorCodes.AD_SESSION_INVALID, "广告会话不存在或已过期", 400);
  }
  const elapsed = (Date.now() - session.createdAt.getTime()) / 1000;
  if (config.P0_E2E !== "true" && elapsed < config.AD_UNLOCK_MIN_SECONDS) {
    throw new AppError(ErrorCodes.AD_NOT_FINISHED, "广告未完成，拒绝解锁", 400);
  }

  const outcome = await prisma.$transaction(async (tx) => {
    const consumed = await tx.adSession.updateMany({
      where: { id: session.id, status: AdSessionStatus.started },
      data: { status: AdSessionStatus.consumed, consumedAt: new Date() },
    });
    if (consumed.count !== 1) return "nonce_used" as const;
    try {
      await tx.resultUnlock.create({
        data: {
          testId,
          userId,
          unlockType: UNLOCK_TYPE,
          adSessionId: session.id,
        },
      });
      return "ok" as const;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return "already" as const;
      }
      throw error;
    }
  });

  if (outcome === "nonce_used") {
    const granted = await prisma.resultUnlock.findUnique({
      where: { testId_userId_unlockType: { testId, userId, unlockType: UNLOCK_TYPE } },
    });
    if (granted && granted.unlockStatus === "granted") {
      return getRelationship(testId, userId);
    }
    throw new AppError(ErrorCodes.AD_NONCE_USED, "广告凭证已使用", 400);
  }

  await consumeNonceBind(redis, nonceHash);
  return getRelationship(testId, userId);
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

async function hitRateLimit(redis: Redis, key: string, max: number, windowSec: number) {
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSec);
    if (count > max) {
      throw new AppError(ErrorCodes.UNLOCK_RATE_LIMIT, "操作过于频繁，请稍后再试", 429);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
  }
}

async function rememberNonce(redis: Redis, nonceHash: string, payload: NonceBind, ttl: number) {
  try {
    await redis.set(`ad:nonce:${nonceHash}`, JSON.stringify(payload), "EX", ttl);
  } catch {
    // Redis 失败时仍以 Postgres 会话为准，不阻断广告流程
  }
}

async function readNonceBind(redis: Redis, nonceHash: string): Promise<NonceBind | null> {
  try {
    const raw = await redis.get(`ad:nonce:${nonceHash}`);
    if (!raw) return null;
    return JSON.parse(raw) as NonceBind;
  } catch {
    return null;
  }
}

async function consumeNonceBind(redis: Redis, nonceHash: string) {
  try {
    await redis.del(`ad:nonce:${nonceHash}`);
  } catch {
    // ignore
  }
}
