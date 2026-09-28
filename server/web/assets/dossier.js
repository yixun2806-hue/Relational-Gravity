/* global window */
(function () {
  const YOU = "#5577A8";
  const TA = "#D98670";
  const STAMP = { strong: "高度典型", moderate: "比较明显", tentative: "更接近" };
  const RISK = { low: "留意", medium: "重点留意", high: "优先处理" };
  const CORE = [
    ["rapport", "默契"],
    ["communication", "沟通"],
    ["security", "安心"],
    ["stability", "稳定"],
  ];

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function num(value) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  }

  function list(items) {
    return Array.isArray(items) ? items.filter(Boolean) : [];
  }

  function sheet(no, title, body, extra) {
    return `<section class="dos-sheet ${extra || ""}">${no ? `<p class="dos-no">${esc(no)}</p>` : ""}${title ? `<h2>${esc(title)}</h2>` : ""}${body}</section>`;
  }

  function pairBars(you, ta) {
    const y = num(you);
    const t = num(ta);
    const row = (name, value, tone) => `<div class="dos-who"><div class="dos-who-top"><span class="${tone}">${name}</span><b>${value}%</b></div><div class="dos-track" role="progressbar" aria-label="${name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"><i class="${tone}" style="width:${value}%"></i></div></div>`;
    return `<div class="dos-bars">${row("你", y, "you")}${row("TA", t, "ta")}</div>`;
  }

  function indexCard(item) {
    const value = num(item.value);
    return `<article class="dos-index-card"><header><h3>${esc(item.label || item.key)}</h3><b>${value}%</b></header><small>${esc(item.levelLabel || "")}</small><div class="dos-meter" role="progressbar" aria-label="${esc(item.label || item.key)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"><i style="width:${value}%"></i></div><p>${esc(item.summary || "")}</p></article>`;
  }

  function indexRow(item, open) {
    const value = num(item.value);
    const evidence = list(item.evidence).map((line) => `<li>${esc(line)}</li>`).join("");
    return `<details class="dos-index" ${open ? "open" : ""}><summary><span>${esc(item.label || item.key)}</span><b>${value}%</b><small>${esc(item.levelLabel || "")}</small></summary><div class="dos-meter" role="progressbar" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100"><i style="width:${value}%"></i></div><p>${esc(item.summary || "")}</p><p>${esc(item.explanation || "")}</p>${evidence ? `<ul>${evidence}</ul>` : ""}</details>`;
  }

  window.renderRelationshipDossier = function renderRelationshipDossier(full, teaser) {
    const confidence = full.relationshipConfidence || {};
    const stamp = STAMP[confidence.wordingStrength] || "更接近";
    const you = full.you || {};
    const ta = full.ta || {};
    const indices = full.indices || {};
    const detailed = list(full.indicesDetailed);
    const byKey = Object.fromEntries(detailed.map((item) => [item.key, item]));
    const dims = list(full.dimensionComparison);
    const highlights = dims.slice().sort((a, b) => num(b.importance) - num(a.importance)).slice(0, 6);
    const evidence = (list(confidence.reasons).length ? list(confidence.reasons) : list(full.relationshipEvidence))
      .filter((item) => num(item.strength) > 0)
      .slice(0, 5)
      .map((item) => ({ ...item, text: String(item.text || "").replace(/，?\s*当前支持度\s*\d+%?/g, "").replace(/当前值/g, "") }));
    const similarities = list(full.similarities);
    const differences = list(full.differences);
    const youOffer = list(full.complements && full.complements.youOffer);
    const taOffer = list(full.complements && full.complements.taOffer);
    const whoMore = list(full.whoMore);
    const misunderstandings = list(full.misunderstandingsDetailed);
    const cycle = full.conflictCycle || {};
    const lowConflict = cycle.pattern === "low-conflict";
    const forYou = list(full.boundaries && full.boundaries.forYou);
    const forTa = list(full.boundaries && full.boundaries.forTa);
    const strengths = list(full.strengths);
    const risks = list(full.risks);
    const scenes = list(full.communicationScenarios);
    const lines = full.dynamicScene && Array.isArray(full.dynamicScene.lines) ? full.dynamicScene.lines : [];
    const adviceYou = list(full.adviceForYou);
    const adviceTa = list(full.adviceForTa);
    const advicePair = list(full.adviceForPair);
    const actions = list(full.nextActions).slice(0, 3);

    const core = `<div class="dos-core">${CORE.map(([key, label]) => {
      const item = byKey[key] || { key, label, value: indices[key], summary: "" };
      return indexCard({ ...item, label: item.label || label });
    }).join("")}</div>`;
    const allIndices = (detailed.length ? detailed : CORE.map(([key, label]) => ({ key, label, value: indices[key] }))).map((item, index) => indexRow(item, index < 2)).join("");

    const highlightHtml = `<div class="dos-highlights">${highlights.map((item) => `<article class="dos-note"><h3>${esc(item.label)}</h3>${pairBars(item.aValue, item.bValue)}<p>${esc(item.summary || "")}</p></article>`).join("")}</div>`;
    const allDims = dims.map((item) => `<article class="dos-dim"><h3>${esc(item.label)}</h3>${pairBars(item.aValue, item.bValue)}<p>相差 ${Math.abs(num(item.aValue) - num(item.bValue))} · ${esc(item.summary || "")}</p></article>`).join("");

    const similarHtml = similarities.length
      ? `<div class="dos-slips">${similarities.map((item) => `<article class="dos-slip"><h3>${esc(item.summary || "共同点")}</h3><p>你 ${num(item.aValue)}% · TA ${num(item.bValue)}%</p><p>${esc(item.explanation || "")}</p></article>`).join("")}</div>`
      : `<p class="dos-empty">目前没有特别突出的共同高特征。</p>`;
    const diffHtml = differences.length
      ? differences.map((item) => `<article class="dos-split"><div>${pairBars(item.aValue, item.bValue)}</div><p>${esc(item.summary || "")}</p><p>${esc(item.impact || "")}</p></article>`).join("")
      : `<p class="dos-empty">${esc(full.differenceSummary || "你们目前没有特别突出的结构性差异。")}</p>`;
    const offer = (title, items) => items.length ? `<div class="dos-offer"><h3>${title}</h3>${items.map((item) => `<p>${esc(item.summary || "")}</p>`).join("")}</div>` : "";
    const complementHtml = youOffer.length || taOffer.length
      ? `${offer("你能补给 TA", youOffer)}${offer("TA 能补给你", taOffer)}`
      : `<p class="dos-empty">你们目前更像同频，而不是明显互补。</p>`;

    const whoHtml = whoMore.map((item) => `<article class="dos-who-card"><h3>${esc(item.title)}</h3>${item.tie || item.winner === "tie" ? `<p class="dos-tie">差不多</p>` : ""}${pairBars(item.aPercent, item.bPercent)}<p>${esc(item.explanation || item.note || "")}</p></article>`).join("");
    const misHtml = misunderstandings.length
      ? misunderstandings.map((item) => `<article class="dos-case"><h3>${esc(item.title)}</h3><p><b>发生了什么</b> ${esc(item.trigger)}</p><p class="you"><b>你可能会怎么理解</b> ${esc(item.yourInterpretation)}</p><p class="ta"><b>TA 可能怎么理解</b> ${esc(item.taInterpretation)}</p><p><b>真正卡住的地方</b> ${esc(item.reality)}</p><p><b>怎么修</b> ${esc(item.repair)}</p></article>`).join("")
      : `<p class="dos-empty">目前没有明显的典型误解模式。</p>`;
    const cycleHtml = `<ol class="dos-cycle ${lowConflict ? "is-soft" : ""}"><li><b>触发</b> ${esc(list(cycle.triggers).join("；"))}</li><li class="you"><b>你</b> ${esc(cycle.yourFirstReaction)}</li><li class="ta"><b>TA</b> ${esc(cycle.taFirstReaction)}</li><li><b>往后会怎样</b> ${esc(cycle.escalation)}</li><li><b>循环</b> ${esc(cycle.loop)}</li><li class="cut"><b>${lowConflict ? "可以先停在这里" : "从这里打断循环"}</b> ${esc(cycle.breakpoint)}</li><li><b>修复</b> ${esc(cycle.repairPlan)}</li></ol>`;
    const boundaryHtml = `${forYou.length ? `<div><h3>和 TA 相处时，你最好知道</h3><ul>${forYou.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>` : ""}${forTa.length ? `<div><h3>和你相处时，TA 最好知道</h3><ul>${forTa.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>` : ""}` || `<p class="dos-empty">目前没有需要单独标出的相处边界。</p>`;
    const strengthHtml = strengths.length ? `<div class="dos-balance">${strengths.map((item) => `<article class="dos-check"><h3>${esc(item.title)}</h3><p>${esc(item.evidence)}</p><p>${esc(item.explanation)}</p></article>`).join("")}</div>` : `<p class="dos-empty">目前没有单独标成优势的项目。</p>`;
    const riskHtml = risks.length ? `<div class="dos-balance">${risks.map((item) => `<article class="dos-risk is-${esc(item.severity || "low")}"><p class="dos-flag">${esc(RISK[item.severity] || "留意")}</p><h3>${esc(item.title)}</h3><p>${esc(item.evidence)}</p><p>${esc(item.mechanism)}</p><p><b>可以怎么做</b> ${esc(item.suggestion)}</p></article>`).join("")}</div>` : `<p class="dos-empty">目前没有需要优先处理的消耗机制。</p>`;
    const sceneHtml = scenes.map((item, index) => `<article class="dos-script ${index >= 3 ? "is-extra" : ""}"><h3>${esc(item.title)}</h3><p class="dos-why">${esc(item.whySelected)}</p><blockquote class="you"><span>你</span>${esc(item.youScript)}</blockquote><blockquote class="ta"><span>TA</span>${esc(item.taScript)}</blockquote><p>${esc(item.whyItWorks)}</p></article>`).join("");
    const playHtml = `<section class="dos-sheet dos-break"><p class="dos-no">剧场</p><h2>你们的关系名场面</h2><div class="dos-play"><h3>${esc(full.dynamicScene && full.dynamicScene.title)}</h3>${lines.map((line) => `<p class="dos-line-say ${esc(line.speaker)}"><span>${line.speaker === "ta" ? "TA" : line.speaker === "you" ? "你" : "旁白"}</span>${esc(line.text)}</p>`).join("")}<p class="dos-punch">${esc(full.dynamicScene && full.dynamicScene.punchline)}</p></div></section>`;

    return `<div id="reportCapture" class="report-capture dos-report" style="--you:${YOU};--ta:${TA}">
      ${sheet("", "", `<div class="dos-cover-top"><div><p class="dos-kicker">关系档案</p><p class="dos-file-no">ARCHIVE ${esc(teaser.relationshipCode || "")}</p></div><div class="dos-seal" aria-label="关系典型程度"><strong>${esc(stamp)}</strong><small>典型度 ${num(confidence.typicality)}%</small></div></div><h1 class="dos-title">${esc(teaser.relationshipName)}</h1><p class="dos-tag">${esc(teaser.tagline || full.tagline || "")}</p><p class="dos-sub">${esc(teaser.subtitle || full.subtitle || "")}</p><p class="dos-lead">${esc(full.summary || "")}</p>`, "dos-cover")}
      ${sheet("02", "为什么你们会是这种关系", evidence.map((item, index) => `<article class="dos-evidence ${index < 2 ? "is-lead" : "is-late"}"><b>0${index + 1}</b><p>${esc(item.text)}</p><em>支持度 ${num(item.strength)}%</em></article>`).join("") || `<p class="dos-empty">${esc(full.summary || "")}</p>`)}
      ${sheet("03", "你和 TA 的关系人格", `<div class="dos-people"><article class="dos-file you"><i>你</i><h3>${esc(you.typeName)}</h3><p class="hand">${esc(you.tagline)}</p><p class="dos-bio">${esc(you.summary)}</p></article><article class="dos-file ta"><i>TA</i><h3>${esc(ta.typeName)}</h3><p class="hand">${esc(ta.tagline)}</p><p class="dos-bio">${esc(ta.summary)}</p></article></div>`)}
      ${sheet("04", "先看四个核心指数", core)}
      ${sheet("05", "你们最值得看的几项", highlightHtml || `<p class="dos-empty">这次没有单独抽出对照项。</p>`)}
      ${sheet("06", "关系核心指数", allIndices)}
      ${playHtml}
      ${sheet("07", "完整的 16 项对照", `<div class="dos-grid">${allDims}</div>`)}
      ${sheet("08", "你们最像的地方", similarHtml)}
      ${sheet("09", "你们最不一样的地方", diffHtml)}
      ${sheet("10", "你们怎么互补", complementHtml)}
      ${sheet("11", "谁更", `<div class="dos-grid">${whoHtml}</div>`)}
      ${sheet("", "", `<p class="dos-roast">${esc(full.dynamicRoast || full.roast || "")}</p>`, "dos-roast-wrap")}
      ${sheet("13", "最容易误解彼此的事", misHtml)}
      ${sheet("14", lowConflict ? "你们更容易卡在哪里" : "典型冲突循环", cycleHtml, lowConflict ? "is-soft" : "")}
      ${sheet("15", "相处时最好知道的边界", boundaryHtml)}
      ${sheet("16", "这份关系里的有利条件", strengthHtml)}
      ${sheet("17", "最值得留意的地方", riskHtml)}
      ${sheet("18", "沟通时可以怎么说", `${sceneHtml}<button class="dos-more" type="button">展开更多沟通场景</button>`)}
      ${sheet("19", "分别给你们的提醒", `<div class="dos-advice-grid"><div>${adviceYou.map((item) => `<p class="dos-advice you">${esc(item)}</p>`).join("") || `<p class="dos-empty">这次没有单独写给你的建议。</p>`}</div><div>${adviceTa.map((item) => `<p class="dos-advice ta">${esc(item)}</p>`).join("") || `<p class="dos-empty">这次没有单独写给 TA 的建议。</p>`}</div></div>`)}
      ${sheet("21", "给你们两个人的建议", advicePair.map((item) => `<p class="dos-advice pair">${esc(item)}</p>`).join("") || `<p class="dos-empty">这次没有共同建议。</p>`)}
      ${sheet("22", "接下来最值得做的 3 件事", actions.map((item, index) => `<p class="dos-task"><b>0${index + 1}</b>${esc(item)}</p>`).join(""))}
      ${sheet("23", "写在这份档案最后", `<div class="dos-letter"><p>${esc(full.finalSummary || full.summary || "")}</p></div>`)}
      <p class="dos-foot">本报告基于双方本次答题结果生成。关系编号 ${esc(teaser.relationshipCode || "")}。仅供娱乐和自我探索，不构成心理、医疗或专业诊断。</p>
    </div>`;
  };
})();
