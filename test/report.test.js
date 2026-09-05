import assert from "node:assert/strict";
import test from "node:test";
import { renderHtmlReport, renderMarkdownReport } from "../src/report.js";

const RESULT = {
  project: "Unsafe <script>alert(1)</script>",
  ready: false,
  readinessPercent: 0,
  generatedAt: "2026-08-22T00:00:00.000Z",
  manifestPath: "proofline.json",
  summary: {
    totalCriteria: 1,
    verifiedCriteria: 0,
    totalProofs: 1,
    verifiedProofs: 0,
    criterionCounts: { verified: 0, missing: 1, stale: 0, "declared-only": 0, failed: 0 },
    proofCounts: { verified: 0, missing: 1, stale: 0, "declared-only": 0, failed: 0 }
  },
  criteria: [{
    id: "AC-01",
    statement: "Render <strong>safely</strong>",
    status: "missing",
    proofs: [{
      id: "ui",
      ref: "AC-01/ui",
      kind: "screenshot",
      label: "UI | screenshot",
      status: "missing",
      reason: "No evidence has been recorded.",
      record: null
    }]
  }]
};

test("HTML report escapes project-controlled text", () => {
  const html = renderHtmlReport(RESULT);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/u);
  assert.match(html, /Unsafe &lt;script&gt;alert/u);
  assert.match(html, /Render &lt;strong&gt;safely/u);
  assert.match(html, /id="gap-tour"/u);
  assert.match(html, /aria-keyshortcuts="G"/u);
  assert.match(html, /id="gap-next"/u);
  assert.match(html, /gapInspector\.dataset\.status/u);
  assert.match(html, /data-proof-reason="No evidence has been recorded\."/u);
});

test("Markdown report escapes table separators", () => {
  const markdown = renderMarkdownReport(RESULT);
  assert.match(markdown, /UI \\| screenshot/u);
  assert.match(markdown, /EVIDENCE GAPS/u);
});
