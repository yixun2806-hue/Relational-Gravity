#!/usr/bin/env node
/**
 * Production P0. Runs inside the API container.
 * Real flow: 6-digit purchase code -> buyer starts a test -> guest joins ->
 * both completions unlock the full report for A and B together.
 */
import { createHash, randomInt } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.API_BASE || "http://127.0.0.1:3000";
const results = [];
const prisma = new PrismaClient();

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

function assert(name, cond, detail = "") {
  record(name, Boolean(cond), cond ? detail : detail || "assertion failed");
  return Boolean(cond);
}

async function raw(path, { method = "GET", token, body, expectStatus } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (expectStatus && res.status !== expectStatus) {
    throw new Error(`${method} ${path} expected ${expectStatus} got ${res.status} ${json?.message || ""}`);
  }
  return { status: res.status, json };
}

async function api(path, opts = {}) {
  const { json, status } = await raw(path, opts);
  if (!json || json.code !== 0) {
    const err = new Error(json?.message || `${path} failed`);
    err.status = status;
    err.code = json?.code;
    throw err;
  }
  return json.data;
}

function pickAnswers(questions, key) {
  return questions.map((q) => ({ questionId: q.id, optionKey: key }));
}

async function completeAll(token, testId, questions, key) {
  const answers = pickAnswers(questions, key);
  for (let i = 0; i < answers.length; i += 10) {
    await api(`/api/tests/${testId}/answers`, {
      method: "PUT",
      token,
      body: { answers: answers.slice(i, i + 10) },
    });
  }
  return api(`/api/tests/${testId}/complete`, { method: "POST", token });
}

function mapTokens(text, viewerIsA) {
  if (typeof text !== "string") return text;
  if (viewerIsA) return text.replaceAll("A", "你").replaceAll("B", "TA");
  return text.replaceAll("A", "\u0000").replaceAll("B", "你").replaceAll("\u0000", "TA");
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function prepareCode() {
  const agent = await prisma.agent.upsert({
    where: { name: "P0_TEST" },
    update: { deletedAt: null },
    create: { name: "P0_TEST" },
  });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const taken = await prisma.reportAccessCode.findUnique({ where: { code }, select: { id: true } });
    if (taken) continue;
    try {
      const created = await prisma.reportAccessCode.create({
        data: {
          code,
          agentId: agent.id,
          channel: "P0_TEST",
          priceFen: 990,
          priceVariant: "fen_990",
        },
        select: { id: true, code: true },
      });
      return created;
    } catch (error) {
      if (error?.code === "P2002") continue;
      throw error;
    }
  }
  throw new Error("could not allocate a P0 access code");
}

function archiveOk(full) {
  const problems = [];
  if (full?.reportVersion?.kind !== "v2" || full?.reportVersion?.version !== 2) problems.push("reportVersion");
  if (!full?.relationshipConfidence) problems.push("relationshipConfidence");
  if (full?.indicesDetailed?.length !== 8) problems.push("indices");
  if (full?.dimensionComparison?.length !== 16) problems.push("dimensions");
  if (full?.whoMore?.length !== 9) problems.push("whoMore");
  const scenes = full?.communicationScenarios?.length ?? -1;
  if (scenes < 6 || scenes > 8) problems.push("scenarios");
  if (full?.nextActions?.length !== 3) problems.push("nextActions");
  if (!full?.finalSummary) problems.push("finalSummary");
  if (!full?.relationshipCandidates) problems.push("candidates");
  if (!full?.relationshipEvidence) problems.push("evidence");
  return problems;
}

function viewerOk(view, stored, viewerIsA) {
  const you = viewerIsA ? stored.a : stored.b;
  const ta = viewerIsA ? stored.b : stored.a;
  const problems = [];
  if (view.you?.typeName !== you.typeName) problems.push("you");
  if (view.ta?.typeName !== ta.typeName) problems.push("ta");
  const dims = stored.dimensionComparison || [];
  if ((view.dimensionComparison || []).length !== dims.length) problems.push("dim-len");
  for (let i = 0; i < dims.length; i += 1) {
    const seen = view.dimensionComparison[i];
    const aValue = viewerIsA ? dims[i].aValue : dims[i].bValue;
    const bValue = viewerIsA ? dims[i].bValue : dims[i].aValue;
    if (seen.aValue !== aValue || seen.bValue !== bValue) problems.push(`dim-${i}`);
    if (seen.summary !== mapTokens(dims[i].summary, viewerIsA)) problems.push(`dim-text-${i}`);
  }
  const who = stored.whoMore || [];
  for (let i = 0; i < who.length; i += 1) {
    const seen = view.whoMore[i];
    const aPercent = viewerIsA ? who[i].aPercent : who[i].bPercent;
    const bPercent = viewerIsA ? who[i].bPercent : who[i].aPercent;
    if (seen.aPercent !== aPercent || seen.bPercent !== bPercent) problems.push(`who-${i}`);
    if (seen.aLabel !== "你" || seen.bLabel !== "TA") problems.push(`who-label-${i}`);
  }
  const adviceYou = viewerIsA ? stored.adviceForA : stored.adviceForB;
  const adviceTa = viewerIsA ? stored.adviceForB : stored.adviceForA;
  if (JSON.stringify(view.adviceForYou) !== JSON.stringify((adviceYou || []).map((item) => mapTokens(item, viewerIsA)))) {
    problems.push("advice");
  }
  if (JSON.stringify(view.adviceForTa) !== JSON.stringify((adviceTa || []).map((item) => mapTokens(item, viewerIsA)))) {
    problems.push("advice-ta");
  }
  const scenes = stored.communicationScenarios || [];
  for (let i = 0; i < scenes.length; i += 1) {
    const seen = view.communicationScenarios[i];
    const youScript = mapTokens(viewerIsA ? scenes[i].aScript : scenes[i].bScript, viewerIsA);
    const taScript = mapTokens(viewerIsA ? scenes[i].bScript : scenes[i].aScript, viewerIsA);
    if (seen.youScript !== youScript || seen.taScript !== taScript) problems.push(`scene-${i}`);
  }
  return problems;
}

async function main() {
  const prior = await prisma.relationshipResult.findMany({ select: { id: true, content: true } });
  const priorDigest = new Map(prior.map((row) => [row.id, digest(row.content)]));

  const health = await api("/health");
  assert("GET /health", health.status === "ok");
  const apiHealth = await api("/api/health");
  assert("GET /api/health", apiHealth.status === "ok");

  const unauth = await raw("/api/tests", { method: "POST" });
  assert("未授权访问", unauth.status === 401 && unauth.json?.code === 40101);

  const access = await prepareCode();
  console.log(`p0_code_id=${access.id} tail=${access.code.slice(-2)}`);

  const buyer = await api("/api/web/auth/activate", { method: "POST", body: { code: access.code } });
  assert("验证码登录", Boolean(buyer.token && buyer.userId && buyer.accessRole === "buyer"));
  const reused = await api("/api/web/auth/activate", { method: "POST", body: { code: access.code } });
  assert("验证码可重复登录且不是一次性作废", reused.userId !== buyer.userId);
  const codeRow = await prisma.reportAccessCode.findUnique({ where: { id: access.id } });
  assert("验证码仍有效且计入使用次数", codeRow?.isActive === true && codeRow.useCount >= 2 && codeRow.channel === "P0_TEST");

  const guest = await api("/api/web/auth/guest", { method: "POST", body: {} });
  const stranger = await api("/api/web/auth/guest", { method: "POST", body: {} });
  assert("受邀者登录", Boolean(guest.token && guest.accessRole === "guest"));

  const questionsPack = await api("/api/questions", { token: buyer.token });
  const questions = questionsPack.questions;
  assert("Questions 30", questions.length === 30, String(questions.length));
  const hasScores = questions.some((q) => q.scores || q.options?.some((o) => o.scores || o.scoreVector));
  assert("Questions 不返回 scoring", !hasScores);

  const created = await api("/api/tests", { method: "POST", token: buyer.token });
  assert("Create Test", Boolean(created.id && created.inviteCode && created.role === "A"));
  const testId = created.id;
  console.log(`p0_test_id=${testId}`);

  const tooSoon = await raw("/api/tests/join", {
    method: "POST",
    token: guest.token,
    body: { inviteCode: created.inviteCode },
  });
  assert("A 未完成时 B 不能加入", tooSoon.json?.code === 40008);

  const early = await raw(`/api/tests/${testId}/relationship`, { token: buyer.token });
  assert("双方完成前无关系报告", early.status === 409 || early.json?.code === 40901);

  const aComplete = await completeAll(buyer.token, testId, questions, "A");
  assert("A Complete", aComplete.role === "A" && aComplete.waitingForPeer === true && Boolean(aComplete.personality?.typeName));
  const aAgain = await api(`/api/tests/${testId}/complete`, { method: "POST", token: buyer.token });
  assert("重复完成测试 A 幂等", aAgain.waitingForPeer === true);

  const joined = await api("/api/tests/join", {
    method: "POST",
    token: guest.token,
    body: { inviteCode: created.inviteCode },
  });
  assert("B join", joined.id === testId && joined.role === "B");
  const taken = await raw("/api/tests/join", {
    method: "POST",
    token: stranger.token,
    body: { inviteCode: created.inviteCode },
  });
  assert("邀请码已被占用", taken.json?.code === 40003);

  const bComplete = await completeAll(guest.token, testId, questions, "D");
  assert("B Complete", bComplete.role === "B" && bComplete.waitingForPeer === false);
  const bAgain = await api(`/api/tests/${testId}/complete`, { method: "POST", token: guest.token });
  assert("重复完成测试 B 幂等", bAgain.waitingForPeer === false);

  const aView = await api(`/api/tests/${testId}/relationship`, { token: buyer.token });
  const bView = await api(`/api/tests/${testId}/relationship`, { token: guest.token });
  assert("双方共享完整报告", aView.unlocked === true && bView.unlocked === true && aView.full != null && bView.full != null);
  assert("A 再读仍是完整报告", (await api(`/api/tests/${testId}/relationship`, { token: buyer.token })).unlocked === true);
  const blocked = await raw(`/api/tests/${testId}/relationship`, { token: stranger.token });
  assert("非参与者不能看关系", blocked.status === 403 || blocked.json?.code === 40301);

  const storedRow = await prisma.relationshipResult.findUnique({ where: { testId } });
  const stored = storedRow?.content;
  assert("relationship_result 仅 1 条", (await prisma.relationshipResult.count({ where: { testId } })) === 1);
  assert("content.reportVersion=2", stored?.reportVersion === 2);
  const archiveProblems = archiveOk(aView.full);
  assert("V2 extended archive", archiveProblems.length === 0, archiveProblems.join(","));
  assert("B 报告同样是完整 V2", archiveOk(bView.full).length === 0, archiveOk(bView.full).join(","));

  const aViewer = viewerOk(aView.full, stored, true);
  const bViewer = viewerOk(bView.full, stored, false);
  assert("A viewer you=A ta=B", aViewer.length === 0, aViewer.join(","));
  assert("B viewer you=B ta=A", bViewer.length === 0, bViewer.join(","));

  const unlocks = await prisma.resultUnlock.count({
    where: { testId, unlockType: "FULL_RESULT", unlockStatus: "granted" },
  });
  assert("A/B 各有一条已授予解锁", unlocks === 2, String(unlocks));

  const untouched = [];
  for (const [id, hash] of priorDigest) {
    const row = await prisma.relationshipResult.findUnique({ where: { id }, select: { content: true } });
    if (!row || digest(row.content) !== hash) untouched.push(id);
  }
  assert("历史 relationship_results 未被改写", untouched.length === 0, String(untouched.length));

  const expireTest = await api("/api/tests", { method: "POST", token: buyer.token });
  await completeAll(buyer.token, expireTest.id, questions, "B");
  await prisma.test.update({
    where: { id: expireTest.id },
    data: { expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });
  const expired = await raw("/api/tests/join", {
    method: "POST",
    token: guest.token,
    body: { inviteCode: expireTest.inviteCode },
  });
  assert("过期邀请码", expired.json?.code === 40002);

  console.log("\n==== SUMMARY ====");
  const failed = results.filter((r) => !r.pass);
  console.log(`passed=${results.filter((r) => r.pass).length} failed=${failed.length}`);
  if (failed.length) {
    for (const item of failed) console.log(" -", item.name, item.detail);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("E2E crashed:", error.message);
    console.log("\n==== SUMMARY SO FAR ====");
    for (const item of results) console.log(`${item.pass ? "PASS" : "FAIL"}  ${item.name}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
