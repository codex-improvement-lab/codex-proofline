const VERDICT_META = {
  changed: { label: "Changed", symbol: "~" },
  added: { label: "Added", symbol: "+" },
  removed: { label: "Removed", symbol: "−" },
  unchanged: { label: "Unchanged", symbol: "=" }
};

const STATUS_META = {
  verified: { label: "Verified", symbol: "✓" },
  missing: { label: "Missing", symbol: "○" },
  stale: { label: "Stale", symbol: "◷" },
  "declared-only": { label: "Declared only", symbol: "!" },
  failed: { label: "Failed", symbol: "×" }
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderContractText(item, emptyLabel, tag = "p") {
  if (!item) return `<${tag} class="contract-empty">${escapeHtml(emptyLabel)}</${tag}>`;
  return `<${tag}><strong>${escapeHtml(item.goal)}</strong><span>${escapeHtml(item.acceptance)}</span></${tag}>`;
}

function renderFinding(finding) {
  const meta = VERDICT_META[finding.verdict];
  return `
    <article class="redline-row verdict-${finding.verdict}" data-change-id="${escapeHtml(finding.id)}" data-verdict="${finding.verdict}">
      <div class="change-stamp"><span>${meta.symbol}</span><b>${escapeHtml(meta.label)}</b><code>${escapeHtml(finding.id)}</code></div>
      <div class="contract-side contract-before">
        <small>Before</small>
        ${renderContractText(finding.before, "Not present in the prior contract", finding.verdict === "removed" || finding.verdict === "changed" ? "del" : "p")}
      </div>
      <div class="fault" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="contract-side contract-after">
        <small>After</small>
        ${renderContractText(finding.after, "Removed from the target contract", finding.verdict === "added" || finding.verdict === "changed" ? "ins" : "p")}
      </div>
      <button class="trace-button" type="button" data-trace-change="${escapeHtml(finding.id)}" ${finding.verdict === "unchanged" ? "disabled" : ""}>Trace impact</button>
    </article>`.trim();
}

function renderEvidence(proof) {
  const meta = STATUS_META[proof.status];
  const impacts = proof.impactedBy.map((impact) => `${impact.id} ${impact.verdict}`).join(" · ");
  return `
    <article class="evidence-row ${proof.impactedBy.length ? "is-impacted" : "is-shielded"} status-${proof.status}" data-evidence-id="${escapeHtml(proof.id)}" data-dependencies="${escapeHtml(proof.dependsOn.join(" "))}">
      <div class="wave-mark" aria-hidden="true"><i></i><i></i><span>${meta.symbol}</span></div>
      <div class="evidence-copy">
        <div class="evidence-topline"><code>${escapeHtml(proof.id)}</code><span class="status">${meta.symbol} ${escapeHtml(meta.label)}</span></div>
        <h3>${escapeHtml(proof.label)}</h3>
        <p>${escapeHtml(proof.contractImpactReason ?? "No changed contract item lies on this proof line's declared dependency path.")}</p>
        <div class="dependency-line"><span>Explicit dependency</span>${proof.dependsOn.map((item) => `<code>${escapeHtml(item)}</code>`).join("")}</div>
      </div>
      <div class="impact-readout">
        <small>${proof.impactedBy.length ? "Impact" : "Isolation"}</small>
        <strong>${escapeHtml(impacts || "Unchanged path")}</strong>
        <span>${escapeHtml(proof.baseStatus)} → ${escapeHtml(proof.status)}</span>
        <small>Observed contract</small>
        <span>${escapeHtml(proof.goalBinding?.observationRevision ?? "Unbound receipt; prior supplied by caller")}</span>
        <small>Compared against</small>
        <span>${escapeHtml(proof.goalBinding?.targetRevision ?? "See target revision")}</span>
      </div>
    </article>`.trim();
}

function renderAction(proof, index) {
  const action = proof.action;
  if (!action) return "";
  return `
    <li>
      <span>${String(index + 1).padStart(2, "0")}</span>
      <div><strong>${escapeHtml(action.label)}</strong>${action.command ? `<code>${escapeHtml(action.command)}</code>` : ""}</div>
      <b>${escapeHtml(action.kind)}</b>
    </li>`.trim();
}

export function renderGoalDeltaHtml(delta) {
  const orderedFindings = [...delta.findings].sort((left, right) => {
    const order = { changed: 0, added: 1, removed: 2, unchanged: 3 };
    return order[left.verdict] - order[right.verdict] || (left.id < right.id ? -1 : 1);
  });
  const impacted = delta.evidence.filter((proof) => proof.impactedBy.length > 0);
  const shielded = delta.evidence.filter((proof) => proof.impactedBy.length === 0);
  const actions = delta.evidence.filter((proof) => proof.action);
  const firstSource = delta.sources[0];
  const secondSource = delta.sources[1];
  const counts = delta.summary.counts;
  const actionableChanges = orderedFindings.filter((finding) => finding.verdict !== "unchanged");
  const primaryFault = actionableChanges[0] ?? null;
  const primaryFaultTarget = primaryFault?.affectedEvidenceIds.length
    ? primaryFault.affectedEvidenceIds.join(" · ")
    : primaryFault?.verdict === "added"
      ? "No proof dependency declared"
      : "No existing proof line affected";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${escapeHtml(delta.title)}</title>
  <style>
    :root {
      --paper: #f1ead8;
      --ink: #171815;
      --night: #11130f;
      --night-2: #191c16;
      --muted: #8d927f;
      --line: #373b30;
      --acid: #c8ff3d;
      --red: #ff554f;
      --amber: #ffb547;
      --cyan: #77e4d4;
      --violet: #c7a1ff;
    }
    * { box-sizing: border-box; }
    html { background: var(--night); scroll-behavior: smooth; }
    body { margin: 0; min-width: 320px; color: var(--paper); background: var(--night); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body::before { content: ""; position: fixed; inset: 0; pointer-events: none; opacity: .25; background: repeating-linear-gradient(0deg, transparent 0 26px, rgba(255,255,255,.026) 27px), radial-gradient(circle at 70% 0, rgba(255,85,79,.11), transparent 34rem); }
    code, small, .eyebrow, .metric span, .change-stamp, .status, .trace-button, .dependency-line, .impact-readout, .next-actions li > span, .next-actions li > b { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
    .shell { position: relative; width: min(1240px, calc(100% - 40px)); margin: 0 auto; padding: 28px 0 80px; }
    header { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding-bottom: 18px; border-bottom: 1px solid var(--line); }
    .brand { display: flex; gap: 12px; align-items: center; font-weight: 800; letter-spacing: -.02em; }
    .brand-mark { display: grid; width: 31px; height: 31px; place-items: center; border: 1px solid var(--red); color: var(--red); font: 800 17px/1 ui-monospace, monospace; transform: rotate(45deg); }
    .brand-mark span { transform: rotate(-45deg); }
    .revision-id { color: var(--muted); font: 11px/1.5 ui-monospace, monospace; text-align: right; }
    .hero { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(360px, .8fr); gap: 54px; padding: 70px 0 56px; }
    .eyebrow { margin: 0 0 20px; color: var(--red); font-size: 11px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
    h1 { margin: 0; max-width: 820px; font-size: clamp(56px, 9vw, 116px); line-height: .82; letter-spacing: -.075em; }
    h1 span { display: block; color: transparent; -webkit-text-stroke: 1px #777c6a; }
    .headline { max-width: 700px; margin: 28px 0 0; color: #c1c5b5; font-size: 20px; line-height: 1.5; }
    .impact-meter { align-self: end; border: 1px solid var(--line); background: rgba(25,28,22,.88); }
    .meter-head { padding: 18px 20px; border-bottom: 1px solid var(--line); color: var(--muted); font: 800 10px/1 ui-monospace, monospace; letter-spacing: .14em; text-transform: uppercase; }
    .meter-shift { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; padding: 24px 20px; }
    .meter-shift div { display: grid; gap: 5px; }
    .meter-shift div:last-child { text-align: right; }
    .meter-shift small { color: var(--muted); text-transform: uppercase; }
    .meter-shift strong { font-size: 43px; line-height: 1; }
    .meter-shift i { width: 72px; height: 1px; background: linear-gradient(90deg, var(--acid), var(--red)); position: relative; }
    .meter-shift i::after { content: ""; position: absolute; right: 0; top: -4px; border: 4px solid transparent; border-left-color: var(--red); }
    .meter-note { padding: 16px 20px; border-top: 1px solid var(--line); color: var(--amber); font: 700 12px/1.5 ui-monospace, monospace; }
    .meter-focus { display: grid; gap: 7px; padding: 16px 20px; border-top: 1px solid var(--line); }
    .meter-focus small { color: var(--red); font: 800 9px/1 ui-monospace, monospace; letter-spacing: .14em; text-transform: uppercase; }
    .meter-focus strong { font-size: 14px; }
    .meter-focus span { color: #8f9584; font: 10px/1.45 ui-monospace, monospace; overflow-wrap: anywhere; }
    .revision-rail { position: relative; display: grid; grid-template-columns: 1fr 72px 1fr; align-items: center; padding: 22px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
    .revision-rail div { display: grid; gap: 5px; }
    .revision-rail div:last-child { text-align: right; }
    .revision-rail span { color: var(--muted); font: 800 10px/1 ui-monospace, monospace; text-transform: uppercase; letter-spacing: .12em; }
    .revision-rail strong { font-size: 20px; }
    .rail-fault { width: 2px; height: 50px; margin: auto; background: var(--red); transform: skew(-16deg); box-shadow: 0 0 24px rgba(255,85,79,.5); }
    .metrics { display: grid; grid-template-columns: repeat(5, 1fr); border-bottom: 1px solid var(--line); }
    .metric { min-height: 106px; padding: 20px; border-right: 1px solid var(--line); }
    .metric:last-child { border-right: 0; }
    .metric span { color: var(--muted); font-size: 9px; letter-spacing: .12em; text-transform: uppercase; }
    .metric strong { display: block; margin-top: 10px; font-size: 31px; }
    .metric.is-hot strong { color: var(--red); }
    section { padding-top: 64px; }
    .section-head { display: flex; justify-content: space-between; align-items: end; gap: 24px; margin-bottom: 18px; }
    .section-head p { max-width: 600px; margin: 0; color: var(--muted); line-height: 1.55; }
    h2 { margin: 0; font-size: clamp(30px, 5vw, 58px); line-height: .95; letter-spacing: -.05em; }
    .redline-sheet { border-top: 1px solid var(--line); }
    .redline-row { position: relative; display: grid; grid-template-columns: 118px minmax(0, 1fr) 54px minmax(0, 1fr) 112px; min-height: 168px; border-bottom: 1px solid var(--line); transition: opacity 160ms ease, background 160ms ease; }
    .change-stamp { display: grid; align-content: center; gap: 8px; padding: 18px; border-right: 1px solid var(--line); color: var(--muted); font-size: 10px; text-transform: uppercase; }
    .change-stamp span { color: var(--verdict); font-size: 28px; line-height: 1; }
    .change-stamp code { color: var(--paper); overflow-wrap: anywhere; }
    .contract-side { display: grid; min-width: 0; overflow-wrap: anywhere; align-content: center; gap: 10px; padding: 22px 28px; }
    .contract-side small { color: var(--muted); font-size: 9px; letter-spacing: .14em; text-transform: uppercase; }
    .contract-side p, .contract-side del, .contract-side ins { display: grid; gap: 8px; margin: 0; color: inherit; text-decoration-thickness: 1px; text-decoration-color: var(--verdict); }
    .contract-side strong { font-size: 16px; line-height: 1.35; }
    .contract-side span { color: #aeb3a3; font-size: 13px; line-height: 1.5; }
    .contract-side ins { text-decoration: none; border-left: 2px solid var(--verdict); padding-left: 14px; }
    .contract-empty { color: #737868 !important; font-style: italic; }
    .fault { display: grid; place-items: center; border-left: 1px solid var(--line); border-right: 1px solid var(--line); overflow: hidden; }
    .fault i { width: 2px; height: 44px; background: var(--verdict); transform: skew(-16deg); box-shadow: 0 0 18px color-mix(in srgb, var(--verdict) 55%, transparent); }
    .fault i:nth-child(2) { transform: skew(18deg) translateY(-4px); }
    .trace-button { align-self: center; justify-self: center; width: 82px; min-height: 48px; padding: 8px; border: 1px solid var(--verdict); background: transparent; color: var(--paper); cursor: pointer; font-size: 9px; line-height: 1.35; text-transform: uppercase; }
    .trace-button:hover, .trace-button.is-active { background: var(--verdict); color: var(--night); }
    .trace-button:disabled { border-color: var(--line); color: #676c5d; cursor: default; }
    .verdict-changed { --verdict: var(--red); }
    .verdict-added { --verdict: var(--acid); }
    .verdict-removed { --verdict: var(--violet); }
    .verdict-unchanged { --verdict: #69705f; }
    body.is-tracing .redline-row:not(.is-trace-source), body.is-tracing .evidence-row:not(.is-wave-hit) { opacity: .18; }
    body.is-tracing .evidence-row.is-wave-hit { background: rgba(255,85,79,.075); border-color: var(--red); }
    .shockwave { display: grid; gap: 0; border-top: 1px solid var(--line); }
    .evidence-row { --status: var(--muted); display: grid; grid-template-columns: 86px minmax(0, 1fr) minmax(210px, .38fr); align-items: stretch; min-height: 152px; border-bottom: 1px solid var(--line); transition: opacity 160ms ease, background 160ms ease; }
    .wave-mark { position: relative; display: grid; place-items: center; overflow: hidden; border-right: 1px solid var(--line); }
    .wave-mark i { position: absolute; width: 22px; height: 22px; border: 1px solid var(--status); border-radius: 50%; opacity: .65; }
    .wave-mark i:nth-child(2) { width: 48px; height: 48px; opacity: .24; }
    .wave-mark span { z-index: 1; color: var(--status); font: 800 17px/1 ui-monospace, monospace; }
    .evidence-copy { min-width: 0; overflow-wrap: anywhere; align-self: center; padding: 22px 28px; }
    .evidence-topline { display: flex; gap: 14px; justify-content: space-between; align-items: center; }
    .evidence-topline code { color: var(--muted); font-size: 11px; }
    .status { color: var(--status); font-size: 10px; font-weight: 800; text-transform: uppercase; }
    .evidence-copy h3 { margin: 10px 0 4px; font-size: 18px; }
    .evidence-copy p { margin: 0; color: #a9ae9f; font-size: 13px; line-height: 1.55; }
    .dependency-line { display: flex; gap: 7px; flex-wrap: wrap; align-items: center; margin-top: 14px; color: #737868; font-size: 9px; text-transform: uppercase; }
    .dependency-line code { max-width: 100%; overflow-wrap: anywhere; padding: 4px 6px; border: 1px solid var(--line); color: #c7cbbe; }
    .impact-readout { display: grid; min-width: 0; overflow-wrap: anywhere; align-content: center; gap: 9px; padding: 22px; border-left: 1px solid var(--line); }
    .impact-readout small { color: var(--muted); font-size: 9px; letter-spacing: .12em; text-transform: uppercase; }
    .impact-readout strong { color: var(--status); font-size: 13px; line-height: 1.4; }
    .impact-readout span { color: #8b9181; font: 11px/1.4 ui-monospace, monospace; }
    .status-verified { --status: var(--acid); }
    .status-stale { --status: var(--amber); }
    .status-failed { --status: var(--red); }
    .status-missing { --status: #8c9284; }
    .status-declared-only { --status: var(--violet); }
    .shield-label { margin: 36px 0 12px; color: var(--acid); font: 800 10px/1 ui-monospace, monospace; letter-spacing: .14em; text-transform: uppercase; }
    .next-actions ol { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
    .next-actions li { display: grid; grid-template-columns: 66px minmax(0, 1fr) auto; gap: 22px; align-items: center; min-height: 96px; border-bottom: 1px solid var(--line); }
    .next-actions li > span { color: var(--red); font-size: 12px; }
    .next-actions li div { display: grid; gap: 9px; }
    .next-actions li strong { font-size: 15px; }
    .next-actions li code { overflow-x: auto; color: #abb19f; font-size: 11px; white-space: nowrap; }
    .next-actions li > b { padding: 7px 9px; border: 1px solid var(--line); color: var(--muted); font-size: 9px; text-transform: uppercase; }
    .uncovered { margin-top: 16px; padding: 18px 20px; border: 1px solid var(--amber); color: #d4d0c0; font-size: 13px; line-height: 1.55; }
    .uncovered strong { color: var(--amber); }
    footer { display: flex; justify-content: space-between; gap: 20px; margin-top: 72px; padding-top: 20px; border-top: 1px solid var(--line); color: #6f7465; font: 10px/1.5 ui-monospace, monospace; }
    @media (max-width: 860px) {
      .hero { grid-template-columns: 1fr; gap: 34px; }
      .impact-meter { max-width: 520px; }
      .metrics { grid-template-columns: repeat(3, 1fr); }
      .metric:nth-child(3) { border-right: 0; }
      .metric:nth-child(n+4) { border-top: 1px solid var(--line); }
      .redline-row { grid-template-columns: 86px 1fr 30px 1fr; }
      .trace-button { grid-column: 2 / 5; width: calc(100% - 36px); margin: 0 18px 14px; min-height: 36px; }
      .evidence-row { grid-template-columns: 70px 1fr; }
      .impact-readout { grid-column: 2; border-left: 0; border-top: 1px solid var(--line); }
    }
    @media (max-width: 540px) {
      .shell { width: min(100% - 24px, 1240px); padding-top: 18px; }
      header { align-items: flex-start; }
      .revision-id { max-width: 190px; overflow-wrap: anywhere; }
      .hero { padding: 48px 0 38px; }
      h1 { font-size: 58px; }
      .headline { font-size: 16px; }
      .revision-rail { grid-template-columns: 1fr 32px 1fr; }
      .revision-rail strong { font-size: 14px; overflow-wrap: anywhere; }
      .metrics { grid-template-columns: 1fr 1fr; }
      .metric { min-height: 86px; border-top: 1px solid var(--line); }
      .metric:nth-child(2n) { border-right: 0; }
      .metric:first-child, .metric:nth-child(2) { border-top: 0; }
      .metric:last-child { grid-column: 1 / -1; }
      section { padding-top: 48px; }
      .section-head { display: block; }
      .section-head p { margin-top: 14px; }
      .redline-row { grid-template-columns: 68px 18px 1fr; }
      .change-stamp { grid-row: 1 / 3; padding: 12px; }
      .contract-side { grid-column: 3; padding: 18px; }
      .contract-before { border-bottom: 1px solid var(--line); }
      .fault { grid-column: 2; grid-row: 1 / 3; border-left: 0; }
      .trace-button { grid-column: 3; margin: 0 18px 14px; width: calc(100% - 36px); }
      .evidence-row { grid-template-columns: 52px 1fr; }
      .evidence-copy, .impact-readout { padding: 18px; }
      .evidence-topline { align-items: flex-start; flex-direction: column; gap: 7px; }
      .next-actions li { grid-template-columns: 34px 1fr; padding: 16px 0; }
      .next-actions li > b { grid-column: 2; justify-self: start; }
      footer { flex-direction: column; }
    }
    @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; transition: none !important; } }
    @media print { body { color: #111; background: #fff; } body::before, .trace-button { display: none; } .shell { width: 100%; padding: 20px; } }
  </style>
</head>
<body>
  <div class="shell">
    <header>
      <div class="brand"><span class="brand-mark" aria-hidden="true"><span>Δ</span></span> Codex Proofline / Goal Delta</div>
      <div class="revision-id">${escapeHtml(delta.sourceRevision)}<br>${escapeHtml(delta.generatedAt)}</div>
    </header>

    <main>
      <section class="hero">
        <div>
          <p class="eyebrow">Revision redline · evidence shockwave</p>
          <h1>When the goal <span>moves.</span></h1>
          <p class="headline">${escapeHtml(delta.summary.headline)}</p>
        </div>
        <aside class="impact-meter" aria-label="Evidence impact summary">
          <div class="meter-head">Verified proof lines before / usable now</div>
          <div class="meter-shift"><div><small>Local base</small><strong>${delta.summary.beforeVerifiedEvidence}</strong></div><i aria-hidden="true"></i><div><small>Target</small><strong>${delta.summary.afterVerifiedEvidence}</strong></div></div>
          <div class="meter-note">${counts.newlyStaleEvidence} newly stale · ${counts.rerunEvidence} rerun · ${counts.retireEvidence} retire</div>
${primaryFault ? `          <div class="meter-focus"><small>First fault path</small><strong>${escapeHtml(primaryFault.id)} · ${escapeHtml(primaryFault.verdict)}</strong><span>${escapeHtml(primaryFaultTarget)}</span></div>` : ""}
        </aside>
      </section>

      <div class="revision-rail" aria-label="Compared contract revisions">
        <div><span>Prior stratum</span><strong>${escapeHtml(firstSource.revision)}</strong></div>
        <i class="rail-fault" aria-hidden="true"></i>
        <div><span>Target stratum</span><strong>${escapeHtml(secondSource.revision)}</strong></div>
      </div>

      <div class="metrics" aria-label="Contract delta counts">
        <div class="metric is-hot"><span>Changed</span><strong>${counts.changed}</strong></div>
        <div class="metric"><span>Added</span><strong>${counts.added}</strong></div>
        <div class="metric"><span>Removed</span><strong>${counts.removed}</strong></div>
        <div class="metric"><span>Unchanged</span><strong>${counts.unchanged}</strong></div>
        <div class="metric is-hot"><span>Affected evidence</span><strong>${counts.affectedEvidence}</strong></div>
      </div>

      <section aria-labelledby="redline-title">
        <div class="section-head"><h2 id="redline-title">Revision redline</h2><p>Contract items are matched only by stable ID. Whole goal and acceptance fields are compared byte-for-byte after JSON parsing; no semantic guesswork is used.</p></div>
        <div class="redline-sheet">
          ${orderedFindings.map(renderFinding).join("\n")}
        </div>
      </section>

      <section aria-labelledby="shockwave-title">
        <div class="section-head"><h2 id="shockwave-title">Evidence shockwave</h2><p>Impact travels only along the declared dependency labels below. A contract change can turn observed green evidence <strong>stale</strong>; it never invents a sixth evidence state.</p></div>
        <div class="shockwave">
          ${impacted.map(renderEvidence).join("\n") || '<p class="uncovered">No proof line lies on a changed dependency path.</p>'}
        </div>
${shielded.length ? `        <p class="shield-label">Shielded strata · unrelated proof lines retain their state</p><div class="shockwave">${shielded.map(renderEvidence).join("\n")}</div>` : ""}
      </section>

      <section class="next-actions" aria-labelledby="actions-title">
        <div class="section-head"><h2 id="actions-title">Next observation</h2><p>These steps are derived from proof kind, environment contract, stored command tokens, and explicit dependencies.</p></div>
        <ol>${actions.map(renderAction).join("\n")}</ol>
${delta.uncoveredAddedItems.length ? `        <div class="uncovered"><strong>New proof surface:</strong> ${escapeHtml(delta.uncoveredAddedItems.join(", "))} has no declared evidence dependency. Add a Proofline proof line and dependency before claiming the target contract is covered.</div>` : ""}
      </section>
    </main>

    <footer><span>PROOFLINE / CONTRACT REVISION IMPACT</span><span>Five evidence states preserved: verified · missing · stale · declared-only · failed</span></footer>
  </div>
  <script>
    const changes = ${JSON.stringify(actionableChanges.map((finding) => finding.id))};
    const rows = [...document.querySelectorAll('[data-change-id]')];
    const evidence = [...document.querySelectorAll('[data-evidence-id]')];
    const buttons = [...document.querySelectorAll('[data-trace-change]')];
    let active = -1;
    function clearTrace() {
      active = -1;
      document.body.classList.remove('is-tracing');
      for (const row of rows) row.classList.remove('is-trace-source');
      for (const proof of evidence) proof.classList.remove('is-wave-hit');
      for (const button of buttons) button.classList.remove('is-active');
    }
    function trace(changeId) {
      if (!changeId) return clearTrace();
      document.body.classList.add('is-tracing');
      for (const row of rows) row.classList.toggle('is-trace-source', row.dataset.changeId === changeId);
      for (const proof of evidence) proof.classList.toggle('is-wave-hit', proof.dataset.dependencies.split(' ').includes(changeId));
      for (const button of buttons) button.classList.toggle('is-active', button.dataset.traceChange === changeId);
      document.querySelector('[data-evidence-id].is-wave-hit')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    for (const button of buttons) button.addEventListener('click', () => {
      const index = changes.indexOf(button.dataset.traceChange);
      if (active === index) return clearTrace();
      active = index;
      trace(changes[active]);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') clearTrace();
      if (event.key.toLowerCase() === 'd' && !event.ctrlKey && !event.metaKey && !event.altKey && changes.length) {
        active = (active + 1) % changes.length;
        trace(changes[active]);
      }
    });
  </script>
</body>
</html>`;
}
