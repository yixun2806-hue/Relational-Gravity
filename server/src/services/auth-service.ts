import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config.js";
import { prisma } from "../db.js";
import { sha256 } from "../utils/crypto.js";
import { AppError, ErrorCodes } from "../utils/errors.js";
import { requireNumericAccessCode } from "./admin-service.js";

export async function loginWithAccessCode(config: AppConfig, rawCode: string) {
  const code = requireNumericAccessCode(rawCode);
  const accessCode = await prisma.reportAccessCode.findUnique({ where: { code } });
  if (!accessCode || !accessCode.isActive) {
    throw new AppError(ErrorCodes.ACCESS_CODE_INVALID, "验证码无效，请检查后重试", 400);
  }
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { loginKey: `buyer:${randomUUID()}`, accessRole: "buyer", accessCodeId: accessCode.id },
    });
    await tx.reportAccessCode.update({
      where: { id: accessCode.id },
      data: { useCount: { increment: 1 }, lastUsedAt: new Date() },
    });
    await tx.event.create({
      data: {
        userId: created.id,
        eventName: "access_code_used",
        properties: {
          accessCodeId: accessCode.id,
          agentId: accessCode.agentId,
          priceFen: accessCode.priceFen,
          source: "web_login",
          code: accessCode.code,
        },
      },
    });
    return created;
  });
  const token = await issueSession(config, user.id);
  return { token, userId: user.id, accessRole: user.accessRole };
}

export async function loginForP0(config: AppConfig, mockOpenid: string) {
  if (config.P0_E2E !== "true") {
    throw new AppError(ErrorCodes.UNAUTHORIZED, "未登录或 token 失效", 401);
  }
  const loginKey = `p0:${mockOpenid}`;
  const existing = await prisma.user.findUnique({ where: { loginKey } });
  const user = existing ?? await prisma.$transaction(async (tx) => {
    const accessCode = await tx.reportAccessCode.create({
      data: {
        code: `p0${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        priceFen: 0,
        priceVariant: "p0",
        channel: "p0",
        isActive: true,
      },
    });
    return tx.user.create({
      data: { loginKey, accessRole: "buyer", accessCodeId: accessCode.id },
    });
  });
  const token = await issueSession(config, user.id);
  return { token, userId: user.id, accessRole: user.accessRole };
}

export async function loginAsWebGuest(config: AppConfig) {
  const user = await prisma.user.create({
    data: { loginKey: `guest:${randomUUID()}`, accessRole: "guest" },
  });
  const token = await issueSession(config, user.id);
  return { token, userId: user.id, accessRole: user.accessRole };
}

async function issueSession(config: AppConfig, userId: string) {
  const token = jwt.sign({ sub: userId }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });
  return token;
}
