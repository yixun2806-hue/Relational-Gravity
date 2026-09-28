import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const prisma = new PrismaClient();
const runId = randomUUID();
let testId = "";
let accessCodeId = "";
const userIds = [];

async function call(path, token, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json();
  if (!response.ok || body.code !== 0) {
    throw new Error(`${path} failed: ${response.status} ${body.message ?? "unknown"}`);
  }
  return body.data;
}

async function login(role) {
  const result = await call("/api/auth/login", "", {
    method: "POST",
    body: JSON.stringify({ code: runId, mockOpenid: `product-e2e-${runId}-${role}` }),
  });
  userIds.push(result.userId);
  return result.token;
}

async function main() {
  const tokenA = await login("a");
  const tokenB = await login("b");
  const questionPack = await call("/api/questions", tokenA);
  const created = await call("/api/tests", tokenA, { method: "POST", body: "{}" });
  testId = created.id;

  const answersA = questionPack.questions.map((question) => ({ questionId: question.id, optionKey: "A" }));
  const answersB = questionPack.questions.map((question) => ({ questionId: question.id, optionKey: "D" }));
  await call(`/api/tests/${testId}/answers`, tokenA, { method: "PUT", body: JSON.stringify({ answers: answersA }) });
  const completedA = await call(`/api/tests/${testId}/complete`, tokenA, { method: "POST", body: "{}" });
  if (!completedA.waitingForPeer) throw new Error("A should wait for peer");

  await call("/api/tests/join", tokenB, {
    method: "POST",
    body: JSON.stringify({ inviteCode: created.inviteCode }),
  });
  await call(`/api/tests/${testId}/answers`, tokenB, { method: "PUT", body: JSON.stringify({ answers: answersB }) });
  await call(`/api/tests/${testId}/complete`, tokenB, { method: "POST", body: "{}" });

  const locked = await call(`/api/tests/${testId}/relationship`, tokenA);
  if (locked.unlocked || locked.full) throw new Error("report should start locked");

  const code = `E2E-${runId.slice(0, 8).toUpperCase()}`;
  const accessCode = await prisma.reportAccessCode.create({
    data: { code, priceFen: 1, priceVariant: "e2e", channel: "e2e" },
  });
  accessCodeId = accessCode.id;
  const unlockedA = await call(`/api/tests/${testId}/redeem`, tokenA, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  const unlockedB = await call(`/api/tests/${testId}/relationship`, tokenB);
  if (!unlockedA.unlocked || !unlockedA.full) throw new Error("buyer did not receive full report");
  if (!unlockedB.unlocked || !unlockedB.full) throw new Error("peer did not share the full report");
  if (unlockedA.full.misunderstandings.length !== 3) throw new Error("paid insights are incomplete");
  console.log("PASS product e2e: personal result, pair report, one code and shared unlock");
}

async function cleanup() {
  if (testId) await prisma.event.deleteMany({ where: { testId } });
  if (accessCodeId) await prisma.reportAccessCode.deleteMany({ where: { id: accessCodeId } });
  if (testId) await prisma.test.deleteMany({ where: { id: testId } });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
}

main()
  .finally(cleanup)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
