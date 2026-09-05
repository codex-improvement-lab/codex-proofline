import path from "node:path";
import {
  formatAge,
  formatDuration,
  shortHash,
  STATUS_ORDER
} from "./util.js";

const STATUS_META = {
  verified: { label: "Verified", symbol: "✓" },
  missing: { label: "Missing", symbol: "○" },
  stale: { label: "Stale", symbol: "◷" },
  "declared-only": { label: "Declared only", symbol: "!" },
  failed: { label: "Failed", symbol: "×" }
};

function escapeMarkdown(value) {
  return String(value ?? "—")
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function environmentLabel(record) {
  if (!record?.environment) return "—";
  const environment = record.environment;
  return environment.label || `${environment.platform} ${environment.release}`;
}

function receiptSummary(proof) {
  const record = proof.record;
  if (!record) return "No receipt";
  if (record.kind === "claim") return record.note || "Declaration only";
  if (record.kind === "command") {
    return [
      `exit ${record.result?.exitCode ?? "?"}`,
      formatDuration(record.result?.durationMs),
      `stdout ${shortHash(record.result?.stdoutSha256)}`,
      ...(record.inputs?.digest ? [`inputs ${shortHash(record.inputs.digest)}`] : []),
      `receipt ${shortHash(record.receipt)}`
    ].join(" · ");
  }
  return [
    record.artifact?.path || "unknown artifact",
    `${record.artifact?.bytes ?? "?"} bytes`,
    `file ${shortHash(record.artifact?.sha256)}`,
    `receipt ${shortHash(record.receipt)}`
  ].join(" · ");
}

function commandSummary(proof) {
  if (proof.record?.kind !== "command") return null;
  return proof.record.command?.map((part) => {
    const text = String(part);
    return /\s/u.test(text) ? JSON.stringify(text) : text;
  }).join(" ");
}

function evidenceTimeLabel(proof, now) {
  const record = proof.record;
  if (!record) return "—";
  if (record.kind === "claim" || record.observed === false) {
    return `declared ${formatAge(record.declaredAt, now)} · ${record.declaredAt}`;
  }
  if (!record.observedAt) return "—";
  let label = `observed ${formatAge(record.observedAt, now)} · ${record.observedAt}`;
  const observedTime = Date.parse(record.observedAt);
  const recordedTime = Date.parse(record.recordedAt);
  if (Number.isFinite(recordedTime) && Math.abs(recordedTime - observedTime) > 1000) {
    label += ` · logged ${record.recordedAt}`;
  }
  return label;
}

export function renderMarkdownReport(result) {
  const now = new Date(result.generatedAt);
  const lines = [
    `# Proofline · ${result.project}`,
    "",
    `> **${result.ready ? "READY" : "EVIDENCE GAPS"}** · ${result.summary.verifiedCriteria}/${result.summary.totalCriteria} acceptance criteria verified · ${result.summary.verifiedProofs}/${result.summary.totalProofs} proof lines verified`,
    "",
    `Generated: ${result.generatedAt}`,
    "",
    "| Acceptance criterion | Status | Proof lines |",
    "| --- | --- | --- |"
  ];

  for (const criterion of result.criteria) {
    const meta = STATUS_META[criterion.status];
    const verified = criterion.proofs.filter((proof) => proof.status === "verified").length;
    lines.push(
      `| ${escapeMarkdown(`${criterion.id} — ${criterion.statement}`)} | ${meta.symbol} ${meta.label} | ${verified}/${criterion.proofs.length} |`
    );
  }

  for (const criterion of result.criteria) {
    const meta = STATUS_META[criterion.status];
    lines.push("", `## ${meta.symbol} ${criterion.id} · ${meta.label}`, "", criterion.statement, "");
    lines.push("| Proof line | Kind | Status | Evidence time | Environment | Receipt |", "| --- | --- | --- | --- | --- | --- |");
    for (const proof of criterion.proofs) {
      const proofMeta = STATUS_META[proof.status];
      const command = commandSummary(proof);
      const label = command ? `${proof.label} \`${escapeMarkdown(command)}\`` : proof.label;
      lines.push(
        `| ${escapeMarkdown(label)} | ${proof.kind} | ${proofMeta.symbol} ${proofMeta.label} | ${escapeMarkdown(evidenceTimeLabel(proof, now))} | ${escapeMarkdown(environmentLabel(proof.record))} | ${escapeMarkdown(receiptSummary(proof))} |`
      );
      if (proof.status !== "verified") {
        lines.push(`| ↳ ${escapeMarkdown(proof.reason)} |  |  |  |  |  |`);
      }
    }
  }

  lines.push(
    "",
    "---",
    "",
    "Proofline receipts are local, tamper-evident records—not cryptographic attestations. A screenshot receipt proves the captured file bytes, timestamp, and declared environment label; it does not by itself prove visual correctness, physical-device use, external-platform state, or real-user validation.",
    ""
  );
  return lines.join("\n");
}

function renderProofCard(proof, now) {
  const meta = STATUS_META[proof.status];
  const command = commandSummary(proof);
  const observed = evidenceTimeLabel(proof, now);
  return `
    <article class="proof-card status-${escapeHtml(proof.status)}" data-status="${escapeHtml(proof.status)}" data-proof-label="${escapeHtml(proof.label)}" data-proof-reason="${escapeHtml(proof.reason)}">
      <div class="proof-card__topline">
        <span class="kind">${escapeHtml(proof.kind)}</span>
        <span class="status-pill"><span aria-hidden="true">${meta.symbol}</span> ${escapeHtml(meta.label)}</span>
      </div>
      <h3>${escapeHtml(proof.label)}</h3>
      <p class="reason">${escapeHtml(proof.reason)}</p>
${command ? `      <div class="command"><span>$</span><code>${escapeHtml(command)}</code></div>` : ""}
      <dl>
        <div><dt>Evidence time</dt><dd>${escapeHtml(observed)}</dd></div>
        <div><dt>Environment</dt><dd>${escapeHtml(environmentLabel(proof.record))}</dd></div>
        <div><dt>Receipt</dt><dd>${escapeHtml(receiptSummary(proof))}</dd></div>
      </dl>
    </article>`.trim();
}

function renderCriterion(criterion, now) {
  const meta = STATUS_META[criterion.status];
  const verified = criterion.proofs.filter((proof) => proof.status === "verified").length;
  return `
    <section class="criterion-row" data-status="${escapeHtml(criterion.status)}">
      <article class="criterion-card status-${escapeHtml(criterion.status)}">
        <div class="criterion-card__eyebrow">Acceptance criterion</div>
        <div class="criterion-card__id">${escapeHtml(criterion.id)}</div>
        <h2>${escapeHtml(criterion.statement)}</h2>
        <div class="criterion-card__footer">
          <span class="status-pill"><span aria-hidden="true">${meta.symbol}</span> ${escapeHtml(meta.label)}</span>
          <span>${verified}/${criterion.proofs.length} proof lines</span>
        </div>
      </article>
      <div class="connector" aria-hidden="true"><span></span></div>
      <div class="proof-stack">
        ${criterion.proofs.map((proof) => renderProofCard(proof, now)).join("\n")}
      </div>
    </section>`.trim();
}

export function renderHtmlReport(result) {
  const now = new Date(result.generatedAt);
  const statusButtons = STATUS_ORDER.map((status) => {
    const count = result.summary.proofCounts[status];
    const meta = STATUS_META[status];
    return `<button class="filter" data-filter="${status}" type="button"><span>${meta.symbol}</span>${escapeHtml(meta.label)} <b>${count}</b></button>`;
  }).join("\n");
  const criteria = result.criteria.map((criterion) => renderCriterion(criterion, now)).join("\n");
  const generatedFile = path.basename(result.manifestPath || "proofline.json");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>Proofline · ${escapeHtml(result.project)}</title>
  <style>
    :root {
      --ink: #f1f4e8;
      --muted: #929b91;
      --base: #0b0d0c;
      --panel: #111512;
      --panel-2: #171c18;
      --line: #29312b;
      --verified: #b7f34a;
      --missing: #8c9690;
      --stale: #ffbd59;
      --declared-only: #be8cff;
      --failed: #ff6b66;
      --shadow: 0 24px 80px rgba(0, 0, 0, .35);
    }
    * { box-sizing: border-box; }
    html { background: var(--base); }
    body {
      margin: 0;
      color: var(--ink);
      background:
        radial-gradient(circle at 88% 6%, rgba(183, 243, 74, .10), transparent 24rem),
        linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px),
        var(--base);
      background-size: auto, 34px 34px, 34px 34px, auto;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      min-height: 100vh;
    }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      background: linear-gradient(100deg, rgba(255,255,255,.018), transparent 22%, transparent 78%, rgba(183,243,74,.022));
    }
    .shell { width: min(1320px, calc(100% - 40px)); margin: 0 auto; padding: 32px 0 72px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 760; letter-spacing: -.02em; }
    .mark { width: 28px; height: 28px; display: grid; place-items: center; border: 1px solid var(--verified); color: var(--verified); transform: rotate(45deg); }
    .mark span { transform: rotate(-45deg); font-size: 14px; }
    .generated { color: var(--muted); font: 12px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace; text-align: right; }
    .hero { display: grid; grid-template-columns: 1.45fr .55fr; gap: 28px; align-items: end; padding: 92px 0 48px; border-bottom: 1px solid var(--line); }
    .kicker { margin: 0 0 18px; color: var(--verified); font: 700 12px/1 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .18em; text-transform: uppercase; }
    h1 { margin: 0; max-width: 900px; font-size: clamp(46px, 7vw, 96px); line-height: .91; letter-spacing: -.068em; font-weight: 760; }
    h1 em { color: var(--muted); font-style: normal; }
    .hero-copy { margin: 24px 0 0; max-width: 680px; color: #b8c0b9; font-size: 18px; line-height: 1.55; }
    .score { padding: 26px; background: rgba(17,21,18,.84); border: 1px solid var(--line); box-shadow: var(--shadow); }
    .score__label { color: var(--muted); font: 700 11px/1 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .14em; text-transform: uppercase; }
    .score__number { margin-top: 12px; font-size: 74px; line-height: 1; letter-spacing: -.07em; }
    .score__number span { color: var(--muted); font-size: 30px; }
    .meter { height: 7px; margin-top: 22px; background: #232923; overflow: hidden; }
    .meter span { display: block; width: ${result.readinessPercent}%; height: 100%; background: var(--verified); box-shadow: 0 0 24px rgba(183,243,74,.55); }
    .score__state { display: flex; justify-content: space-between; margin-top: 12px; color: ${result.ready ? "var(--verified)" : "var(--stale)"}; font: 700 12px/1 ui-monospace, SFMono-Regular, Consolas, monospace; text-transform: uppercase; }
    .toolbar { position: sticky; top: 0; z-index: 10; display: flex; gap: 9px; align-items: center; flex-wrap: wrap; padding: 18px 0; background: rgba(11,13,12,.91); backdrop-filter: blur(16px); border-bottom: 1px solid var(--line); }
    .toolbar__label { margin-right: 6px; color: var(--muted); font: 700 11px/1 ui-monospace, SFMono-Regular, Consolas, monospace; text-transform: uppercase; letter-spacing: .12em; }
    button { color: inherit; font: inherit; }
    .filter { display: flex; gap: 7px; align-items: center; padding: 8px 11px; background: transparent; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); cursor: pointer; font-size: 12px; }
    .filter b { color: var(--ink); font-weight: 700; }
    .filter:hover, .filter.active { border-color: #59645c; background: var(--panel-2); color: var(--ink); }
    .filter-all { margin-left: auto; }
    .gap-tour { display: flex; gap: 8px; align-items: center; padding: 9px 13px; border: 1px solid var(--failed); background: rgba(255,107,102,.08); color: #ffd1cf; cursor: pointer; font: 700 11px/1 ui-monospace, SFMono-Regular, Consolas, monospace; text-transform: uppercase; letter-spacing: .06em; }
    .gap-tour:hover { background: rgba(255,107,102,.16); box-shadow: 0 0 28px rgba(255,107,102,.12); }
    .gap-tour:disabled { border-color: var(--line); color: var(--muted); background: transparent; cursor: default; }
    .gap-tour__pulse { width: 7px; height: 7px; border-radius: 50%; background: var(--failed); box-shadow: 0 0 0 0 rgba(255,107,102,.4); animation: gap-pulse 1.5s ease infinite; }
    .gap-tour:disabled .gap-tour__pulse { background: var(--verified); animation: none; }
    .gap-tour kbd, .gap-inspector kbd { padding: 3px 5px; border: 1px solid currentColor; background: transparent; color: inherit; font: 700 9px/1 ui-monospace, SFMono-Regular, Consolas, monospace; opacity: .72; }
    main { padding-top: 22px; }
    .criterion-row { display: grid; grid-template-columns: minmax(260px, .78fr) 54px minmax(420px, 1.55fr); gap: 0; align-items: stretch; margin: 20px 0; }
    .criterion-row.is-hidden { display: none; }
    .criterion-card, .proof-card { position: relative; background: rgba(17,21,18,.92); border: 1px solid var(--line); }
    .criterion-card { display: flex; min-height: 218px; flex-direction: column; padding: 24px; overflow: hidden; }
    .criterion-card::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--status); }
    .criterion-card__eyebrow, .kind, dt { color: var(--muted); font: 700 10px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .12em; text-transform: uppercase; }
    .criterion-card__id { margin-top: 30px; color: var(--status); font: 700 12px/1 ui-monospace, SFMono-Regular, Consolas, monospace; }
    .criterion-card h2 { margin: 12px 0 30px; font-size: 24px; line-height: 1.22; letter-spacing: -.035em; }
    .criterion-card__footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: auto; color: var(--muted); font-size: 12px; }
    .connector { position: relative; min-height: 100%; }
    .connector::before { content: ""; position: absolute; top: 50%; left: 0; right: 0; border-top: 1px solid #465048; }
    .connector span { position: absolute; top: calc(50% - 4px); right: -1px; width: 8px; height: 8px; background: var(--verified); border-radius: 50%; box-shadow: 0 0 0 5px rgba(183,243,74,.08); }
    .proof-stack { display: grid; gap: 10px; }
    .proof-card { --status: var(--missing); padding: 19px 20px; border-left: 3px solid var(--status); }
    .proof-card { transition: opacity 180ms ease, transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease; }
    body.gap-tour-active .proof-card:not(.is-tour-target) { opacity: .24; }
    .proof-card.is-tour-target { z-index: 2; border-color: var(--status); box-shadow: 0 0 0 1px var(--status), 0 18px 60px rgba(0,0,0,.52), -8px 0 28px color-mix(in srgb, var(--status) 18%, transparent); transform: translateX(-5px); }
    .proof-card__topline { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .status-pill { display: inline-flex; align-items: center; gap: 6px; color: var(--status); font: 700 10px/1 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .08em; text-transform: uppercase; }
    .proof-card h3 { margin: 14px 0 5px; font-size: 16px; letter-spacing: -.015em; }
    .reason { margin: 0; color: #a9b1aa; font-size: 13px; line-height: 1.45; }
    .command { display: flex; gap: 10px; margin-top: 14px; padding: 10px 12px; overflow: auto; background: #090b0a; border: 1px solid #202620; color: #d8ded5; font: 12px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace; }
    .command span { color: var(--verified); }
    dl { display: grid; grid-template-columns: 1fr 1fr 1.4fr; gap: 10px; margin: 16px 0 0; padding-top: 14px; border-top: 1px solid var(--line); }
    dl div { min-width: 0; }
    dd { margin: 5px 0 0; color: #c4cbc4; font: 11px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace; overflow-wrap: anywhere; }
    .status-verified { --status: var(--verified); }
    .status-missing { --status: var(--missing); }
    .status-stale { --status: var(--stale); }
    .status-declared-only { --status: var(--declared-only); }
    .status-failed { --status: var(--failed); }
    .notice { margin-top: 42px; padding: 20px 22px; border: 1px solid var(--line); background: rgba(17,21,18,.82); color: var(--muted); font-size: 12px; line-height: 1.65; }
    .notice strong { color: var(--ink); }
    .gap-inspector { --gap-color: var(--failed); position: fixed; z-index: 40; right: 22px; bottom: 22px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px; align-items: end; width: min(580px, calc(100vw - 44px)); padding: 17px 18px; border: 1px solid var(--gap-color); background: rgba(11,13,12,.96); box-shadow: 0 24px 80px rgba(0,0,0,.6); backdrop-filter: blur(18px); }
    .gap-inspector[hidden] { display: none; }
    .gap-inspector[data-status="missing"] { --gap-color: var(--missing); }
    .gap-inspector[data-status="stale"] { --gap-color: var(--stale); }
    .gap-inspector[data-status="declared-only"] { --gap-color: var(--declared-only); }
    .gap-inspector[data-status="failed"] { --gap-color: var(--failed); }
    .gap-inspector::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 4px; background: var(--gap-color); box-shadow: 0 0 24px color-mix(in srgb, var(--gap-color) 55%, transparent); }
    .gap-inspector__copy { min-width: 0; }
    .gap-inspector__copy > span { color: var(--gap-color); font: 700 10px/1 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .14em; text-transform: uppercase; }
    .gap-inspector strong { display: block; margin-top: 8px; font-size: 16px; }
    .gap-inspector p { margin: 6px 0 0; color: #b7beb7; font-size: 12px; line-height: 1.5; }
    .gap-inspector__actions { display: flex; gap: 7px; align-items: center; }
    .gap-inspector button { min-height: 34px; padding: 0 10px; border: 1px solid var(--line); background: transparent; color: var(--muted); cursor: pointer; font: 700 10px/1 ui-monospace, SFMono-Regular, Consolas, monospace; text-transform: uppercase; }
    .gap-inspector #gap-next { display: inline-flex; gap: 7px; align-items: center; border-color: var(--gap-color); color: var(--ink); }
    .gap-inspector #gap-next:hover { background: color-mix(in srgb, var(--gap-color) 14%, transparent); }
    @keyframes gap-pulse { 50% { box-shadow: 0 0 0 7px rgba(255,107,102,0); } }
    footer { display: flex; justify-content: space-between; gap: 20px; padding-top: 24px; color: #687169; font: 11px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace; }
    @media (max-width: 900px) {
      .hero { grid-template-columns: 1fr; padding-top: 64px; }
      .score { max-width: 360px; }
      .criterion-row { grid-template-columns: 1fr; gap: 10px; }
      .connector { display: none; }
      dl { grid-template-columns: 1fr; }
      .filter-all { margin-left: 0; }
    }
    @media (max-width: 540px) {
      .shell { width: min(100% - 24px, 1320px); padding-top: 20px; }
      header { align-items: flex-start; }
      .hero { padding-top: 48px; }
      h1 { font-size: 48px; }
      .hero-copy { font-size: 15px; }
      .generated { max-width: 180px; }
      .criterion-card { min-height: 190px; }
      .gap-inspector { grid-template-columns: 1fr; }
      footer { flex-direction: column; }
    }
    @media print {
      body { background: #fff; color: #111; }
      .shell { width: 100%; padding: 20px; }
      .toolbar { display: none; }
      .gap-inspector { display: none; }
      .criterion-card, .proof-card, .score, .notice { break-inside: avoid; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header>
      <div class="brand"><span class="mark" aria-hidden="true"><span>PL</span></span> Codex Proofline</div>
      <div class="generated">${escapeHtml(generatedFile)}<br>${escapeHtml(result.generatedAt)}</div>
    </header>
    <section class="hero">
      <div>
        <p class="kicker">Acceptance → evidence</p>
        <h1>Proof, <em>not promises.</em></h1>
        <p class="hero-copy">${escapeHtml(result.project)} connects every acceptance criterion to observed commands, files, screenshots, environments, and timestamps—then makes the gaps impossible to miss.</p>
      </div>
      <aside class="score" aria-label="Readiness score">
        <div class="score__label">Acceptance readiness</div>
        <div class="score__number">${result.summary.verifiedCriteria}<span>/${result.summary.totalCriteria}</span></div>
        <div class="meter"><span></span></div>
        <div class="score__state"><span>${result.ready ? "Ready" : "Evidence gaps"}</span><span>${result.readinessPercent}%</span></div>
      </aside>
    </section>
    <nav class="toolbar" aria-label="Filter proof lines">
      <span class="toolbar__label">Proof lines</span>
      ${statusButtons}
      <button class="gap-tour" id="gap-tour" type="button" aria-keyshortcuts="G" ${result.summary.totalProofs === result.summary.verifiedProofs ? "disabled" : ""}><span class="gap-tour__pulse"></span>${result.summary.totalProofs === result.summary.verifiedProofs ? "No gaps" : "Inspect next gap"} <b>${result.summary.totalProofs - result.summary.verifiedProofs}</b><kbd aria-hidden="true">G</kbd></button>
      <button class="filter filter-all active" data-filter="all" type="button">Show all <b>${result.summary.totalProofs}</b></button>
    </nav>
    <main>
      ${criteria}
      <aside class="notice"><strong>Evidence boundary.</strong> These are local, tamper-evident receipts—not cryptographic attestations. Screenshot receipts verify captured bytes, time, and a declared environment label; they do not independently prove visual correctness, physical-device use, external-platform state, or real-user validation.</aside>
    </main>
    <footer><span>PROOFLINE / LOCAL RECEIPT GRAPH</span><span>${result.summary.verifiedProofs}/${result.summary.totalProofs} proof lines verified</span></footer>
  </div>
  <aside class="gap-inspector" id="gap-inspector" aria-live="polite" hidden>
    <div class="gap-inspector__copy">
      <span id="gap-index">Evidence gap</span>
      <strong id="gap-title"></strong>
      <p id="gap-reason"></p>
    </div>
    <div class="gap-inspector__actions">
      <button id="gap-next" type="button">Next gap <kbd aria-hidden="true">G</kbd></button>
      <button id="gap-close" type="button" aria-label="Close gap tour">Exit</button>
    </div>
  </aside>
  <script>
    const buttons = [...document.querySelectorAll('[data-filter]')];
    const rows = [...document.querySelectorAll('.criterion-row')];
    const gapCards = [...document.querySelectorAll('.proof-card')].filter(card => card.dataset.status !== 'verified');
    const gapTour = document.querySelector('#gap-tour');
    const gapInspector = document.querySelector('#gap-inspector');
    const gapIndex = document.querySelector('#gap-index');
    const gapTitle = document.querySelector('#gap-title');
    const gapReason = document.querySelector('#gap-reason');
    let activeGap = -1;

    function stopGapTour() {
      activeGap = -1;
      document.body.classList.remove('gap-tour-active');
      gapInspector.hidden = true;
      delete gapInspector.dataset.status;
      for (const card of gapCards) card.classList.remove('is-tour-target');
    }

    function showGap(index) {
      if (!gapCards.length) return;
      activeGap = (index + gapCards.length) % gapCards.length;
      for (const item of buttons) item.classList.toggle('active', item.dataset.filter === 'all');
      for (const row of rows) row.classList.remove('is-hidden');
      for (const card of gapCards) card.classList.remove('is-tour-target');
      const card = gapCards[activeGap];
      card.classList.add('is-tour-target');
      document.body.classList.add('gap-tour-active');
      gapInspector.hidden = false;
      gapInspector.dataset.status = card.dataset.status;
      gapIndex.textContent = 'Evidence gap ' + (activeGap + 1) + ' / ' + gapCards.length + ' · ' + card.dataset.status;
      gapTitle.textContent = card.dataset.proofLabel;
      gapReason.textContent = card.dataset.proofReason;
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    gapTour?.addEventListener('click', () => showGap(activeGap + 1));
    document.querySelector('#gap-next')?.addEventListener('click', () => showGap(activeGap + 1));
    document.querySelector('#gap-close')?.addEventListener('click', stopGapTour);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && activeGap >= 0) stopGapTour();
      if (event.key.toLowerCase() === 'g' && !event.ctrlKey && !event.metaKey && !event.altKey) showGap(activeGap + 1);
    });
    for (const button of buttons) {
      button.addEventListener('click', () => {
        stopGapTour();
        const filter = button.dataset.filter;
        for (const item of buttons) item.classList.toggle('active', item === button);
        for (const row of rows) {
          const matches = filter === 'all' || [...row.querySelectorAll('.proof-card')].some(card => card.dataset.status === filter);
          row.classList.toggle('is-hidden', !matches);
        }
      });
    }
  </script>
</body>
</html>`;
}
