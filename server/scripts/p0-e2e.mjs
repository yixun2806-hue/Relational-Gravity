#!/usr/bin/env node
/**
 * P0 真实 API 集成测试。在服务器本机跑：node scripts/p0-e2e.mjs
 * 只打 127.0.0.1，不改基础设施。
 */
const BASE = process.env.API_BASE || "http://127.0.0.1:3000";
const results = [];

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? `  — ${detail}` : ""}`);
}

function assert(name, cond, detail = "") {
  record(name, Boolean(cond), cond ? detail : detail || "assertion failed");
}

async function raw(path, { method = "GET", token, body, expectStatus } = {}) {
  const headers = {};
  if (body) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (expectStatus && res.status !== expectStatus) {
    throw new Error(`${method} ${path} expected ${expectStatus} got ${res.status} ${JSON.stringify(json)}`);
  }
  return { status: res.status, json };
}

async function api(path, opts = {}) {
  const { json, status } = await raw(path, opts);
  if (!json || json.code !== 0) {
    const err = new Error(json?.message || `${path} failed`);
    err.status = status;
    err.code = json?.code;
    err.body = json;
    throw err;
  }
  return json.data;
}

async function login(mockOpenid) {
  return api("/api/auth/login", {
    method: "POST",
    body: { code: `dev-${mockOpenid}`, mockOpenid },
  });
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

function lockedKeys(payload) {
  const teaser = payload.teaser || {};
  const leaks = [];
  if (payload.full != null) leaks.push("full!=null");
  for (const k of ["whoMore", "scene", "roast", "advice", "dimensionScores"]) {
    if (k in teaser) leaks.push(`teaser.${k}`);
  }
  if (teaser.indices && (teaser.indices.whoMore || teaser.indices.freedom != null && payload.unlocked === false)) {
    // freedom is paid; companionship/spark/security/abstract are LEVEL1
  }
  return leaks;
}

async function main() {
  const stamp = Date.now();
  const aOpen = `p0-a-${stamp}`;
  const bOpen = `p0-b-${stamp}`;
  const cOpen = `p0-c-${stamp}`;

  const health = await api("/health");
  assert("GET /health", health.status === "ok");
  const apiHealth = await api("/api/health");
  assert("GET /api/health", apiHealth.status === "ok");

  const unauth = await raw("/api/tests", { method: "POST", expectStatus: 401 });
  assert("未授权访问", unauth.json?.code === 40101);

  const a = await login(aOpen);
  const b = await login(bOpen);
  const c = await login(cOpen);
  assert("Auth mock A/B", Boolean(a.token && b.token && a.userId !== b.userId));

  const questionsPack = await api("/api/questions", { token: a.token });
  const questions = questionsPack.questions;
  assert("Questions 30", questions.length === 30, String(questions.length));
  const hasScores = questions.some(
    (q) => q.scores || q.options?.some((o) => o.scores || o.scoreVector),
  );
  assert("Questions 不返回 scoring", !hasScores);

  const created = await api("/api/tests", { method: "POST", token: a.token });
  assert("Create Test", Boolean(created.id && created.inviteCode && created.role === "A"));
  const testId = created.id;
  const inviteCode = created.inviteCode;

  const bJoinTooSoon = await raw("/api/tests/join", {
    method: "POST",
    token: b.token,
    body: { inviteCode },
  });
  assert("A 未完成时 B 不能加入", bJoinTooSoon.json?.code === 40008);

  const aEarlyRel = await raw(`/api/tests/${testId}/relationship`, { token: a.token });
  assert("A 完成前无关系报告", aEarlyRel.status === 409 || aEarlyRel.json?.code === 40901);

  const aComplete = await completeAll(a.token, testId, questions, "A");
  assert("A Complete + personality", aComplete.role === "A" && aComplete.waitingForPeer === true && Boolean(aComplete.personality?.typeName));

  const aRepeatComplete = await api(`/api/tests/${testId}/complete`, { method: "POST", token: a.token });
  assert("重复完成测试 A 幂等", aRepeatComplete.waitingForPeer === true);

  const aRepeatAnswers = await raw(`/api/tests/${testId}/answers`, {
    method: "PUT",
    token: a.token,
    body: { answers: [{ questionId: questions[0].id, optionKey: "B" }] },
  });
  assert("重复提交答案被拒绝", aRepeatAnswers.json?.code === 40006);

  const aJoinOwn = await raw("/api/tests/join", {
    method: "POST",
    token: a.token,
    body: { inviteCode },
  });
  assert("A 加入自己的邀请码", aJoinOwn.json?.code === 40004);

  const ghost = await raw("/api/tests/join", {
    method: "POST",
    token: b.token,
    body: { inviteCode: "ZZZZZZ" },
  });
  assert("不存在邀请码", ghost.json?.code === 40001);

  const badId = await raw("/api/tests/not-a-uuid/relationship", { token: a.token });
  assert("非法 testId", badId.status === 400);

  const missing = await raw("/api/tests/00000000-0000-4000-8000-000000000000", { token: a.token });
  assert("不存在的 test", missing.status === 404 || missing.json?.code === 40401);

  const bJoin = await api("/api/tests/join", { method: "POST", token: b.token, body: { inviteCode } });
  assert("Join Test", bJoin.id === testId && bJoin.role === "B");

  const bJoinAgain = await api("/api/tests/join", { method: "POST", token: b.token, body: { inviteCode } });
  assert("B 重复加入幂等", bJoinAgain.id === testId);

  const cJoin = await raw("/api/tests/join", { method: "POST", token: c.token, body: { inviteCode } });
  assert("同一邀请码绑定第二个 B", cJoin.json?.code === 40003);

  const bComplete = await completeAll(b.token, testId, questions, "D");
  assert("B Complete", bComplete.role === "B" && bComplete.waitingForPeer === false);

  const bRepeatComplete = await api(`/api/tests/${testId}/complete`, { method: "POST", token: b.token });
  assert("重复完成测试 B 幂等", bRepeatComplete.waitingForPeer === false);

  const aTeaser = await api(`/api/tests/${testId}/relationship`, { token: a.token });
  const bTeaser = await api(`/api/tests/${testId}/relationship`, { token: b.token });
  assert("A teaser", aTeaser.unlocked === false && aTeaser.full === null && Boolean(aTeaser.teaser.relationshipName));
  assert("B teaser", bTeaser.unlocked === false && bTeaser.full === null);
  assert(
    "LEVEL1 基础指数",
    [aTeaser.teaser.rapport, aTeaser.teaser.companionship, aTeaser.teaser.spark, aTeaser.teaser.security, aTeaser.teaser.abstract]
      .every((n) => typeof n === "number"),
  );
  assert("A teaser 无 full 泄漏", lockedKeys(aTeaser).length === 0, lockedKeys(aTeaser).join(","));
  assert("B teaser 无 full 泄漏", lockedKeys(bTeaser).length === 0, lockedKeys(bTeaser).join(","));

  const stranger = await raw(`/api/tests/${testId}/relationship`, { token: c.token });
  assert("非参与者不能看关系", stranger.status === 403 || stranger.json?.code === 40301);

  const aCardLocked = await raw(`/api/tests/${testId}/card`, { token: a.token });
  assert("未解锁请求 card", aCardLocked.status === 403 || aCardLocked.json?.code === 40302);

  const aSession = await api("/api/ads/session", { method: "POST", token: a.token, body: { testId } });
  assert("Ad Session", Boolean(aSession.nonce && aSession.sessionId && aSession.unlockType === "FULL_RESULT"));
  const ttlMs = new Date(aSession.expiresAt).getTime() - Date.now();
  assert("Nonce TTL", ttlMs > 10_000 && ttlMs <= 310_000, `ttl=${Math.round(ttlMs / 1000)}s`);

  const aUnlock = await api(`/api/tests/${testId}/unlock`, {
    method: "POST",
    token: a.token,
    body: { nonce: aSession.nonce, unlockType: "FULL_RESULT" },
  });
  assert("A Unlock", aUnlock.unlocked === true && aUnlock.full != null && aUnlock.full.whoMore?.length > 0);

  const aReuseNonce = await raw(`/api/tests/${testId}/unlock`, {
    method: "POST",
    token: a.token,
    body: { nonce: aSession.nonce, unlockType: "FULL_RESULT" },
  });
  assert(
    "Nonce 只能用一次 / 重复 unlock 幂等",
    aReuseNonce.json?.data?.unlocked === true || aReuseNonce.json?.code === 40011,
    `status=${aReuseNonce.status} code=${aReuseNonce.json?.code}`,
  );

  const aFull = await api(`/api/tests/${testId}/relationship`, { token: a.token });
  const bStill = await api(`/api/tests/${testId}/relationship`, { token: b.token });
  assert("情况 A：A full=true", aFull.unlocked === true && aFull.full != null);
  assert("情况 A：B full=null", bStill.unlocked === false && bStill.full === null);

  const aAgainSession = await api("/api/ads/session", { method: "POST", token: a.token, body: { testId } });
  assert("已解锁再申请 session", aAgainSession.alreadyUnlocked === true && aAgainSession.relationship?.full != null);

  const aUnlockAgain = await api(`/api/tests/${testId}/unlock`, {
    method: "POST",
    token: a.token,
    body: { nonce: aSession.nonce, unlockType: "FULL_RESULT" },
  });
  assert("重复 unlock 幂等返回 full", aUnlockAgain.unlocked === true && aUnlockAgain.full != null);

  const aCard = await api(`/api/tests/${testId}/card`, { token: a.token });
  assert(
    "关系卡字段",
    Boolean(aCard.relationshipName && aCard.yourTypeName && aCard.taTypeName) &&
      [aCard.rapport, aCard.companionship, aCard.spark, aCard.security, aCard.freedom, aCard.abstract].every(
        (n) => typeof n === "number",
      ),
  );

  const bSession = await api("/api/ads/session", { method: "POST", token: b.token, body: { testId } });
  const bStolen = await raw(`/api/tests/${testId}/unlock`, {
    method: "POST",
    token: c.token,
    body: { nonce: bSession.nonce, unlockType: "FULL_RESULT" },
  });
  assert("Nonce 绑定 user", bStolen.status >= 400, `status=${bStolen.status} code=${bStolen.json?.code}`);

  const bUnlock = await api(`/api/tests/${testId}/unlock`, {
    method: "POST",
    token: b.token,
    body: { nonce: bSession.nonce, unlockType: "FULL_RESULT" },
  });
  assert("B Unlock", bUnlock.unlocked === true && bUnlock.full != null);

  const aBoth = await api(`/api/tests/${testId}/relationship`, { token: a.token });
  const bBoth = await api(`/api/tests/${testId}/relationship`, { token: b.token });
  assert("情况 C：双方 full", aBoth.unlocked === true && bBoth.unlocked === true && aBoth.full != null && bBoth.full != null);

  const pair2 = await api("/api/tests", { method: "POST", token: a.token });
  await completeAll(a.token, pair2.id, questions, "C");
  await api("/api/tests/join", { method: "POST", token: b.token, body: { inviteCode: pair2.inviteCode } });
  await completeAll(b.token, pair2.id, questions, "B");
  const b2Session = await api("/api/ads/session", { method: "POST", token: b.token, body: { testId: pair2.id } });
  const b2Unlock = await api(`/api/tests/${pair2.id}/unlock`, {
    method: "POST",
    token: b.token,
    body: { nonce: b2Session.nonce, unlockType: "FULL_RESULT" },
  });
  const a2Locked = await api(`/api/tests/${pair2.id}/relationship`, { token: a.token });
  assert("情况 B：B full=true", b2Unlock.unlocked === true && b2Unlock.full != null);
  assert("情况 B：A full=null", a2Locked.unlocked === false && a2Locked.full === null);

  const { execFileSync } = await import("node:child_process");
  const counts = execFileSync(
    "docker",
    [
      "exec",
      "relab-postgres",
      "psql",
      "-U",
      "relab",
      "-d",
      "relab",
      "-tA",
      "-c",
      `select (select count(*) from relationship_results where test_id='${testId}')||','||(select count(*) from result_unlocks where test_id='${testId}' and unlock_type='FULL_RESULT');`,
    ],
    { encoding: "utf8" },
  ).trim();
  const [relCount, unlockCount] = counts.split(",").map((n) => Number(n));
  assert("relationship_result 幂等仅 1 条", relCount === 1, String(relCount));
  assert("result_unlocks 各 1 条", unlockCount === 2, String(unlockCount));

  const expireTest = await api("/api/tests", { method: "POST", token: a.token });
  await completeAll(a.token, expireTest.id, questions, "B");
  execFileSync(
    "docker",
    [
      "exec",
      "relab-postgres",
      "psql",
      "-U",
      "relab",
      "-d",
      "relab",
      "-c",
      `update tests set expires_at = now() - interval '1 day' where id='${expireTest.id}';`,
    ],
    { encoding: "utf8" },
  );
  const expiredJoin = await raw("/api/tests/join", {
    method: "POST",
    token: b.token,
    body: { inviteCode: expireTest.inviteCode },
  });
  assert("过期邀请码", expiredJoin.json?.code === 40002);

  console.log("\n==== SUMMARY ====");
  const failed = results.filter((r) => !r.pass);
  console.log(`passed=${results.filter((r) => r.pass).length} failed=${failed.length}`);
  if (failed.length) {
    for (const f of failed) console.log(" -", f.name, f.detail);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("E2E crashed:", error.message);
  if (error.body) console.error(JSON.stringify(error.body));
  console.log("\n==== SUMMARY SO FAR ====");
  for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}`);
  process.exit(1);
});
