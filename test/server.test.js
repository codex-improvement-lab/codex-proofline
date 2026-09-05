import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { loadManifest } from "../src/config.js";
import { serveReport } from "../src/server.js";
import { createTestDirectory, manifest, removeTestDirectory, writeJson } from "../test-support/helpers.js";

test("local server is read-only and sends restrictive headers", async (t) => {
  const directory = await createTestDirectory("server");
  t.after(() => removeTestDirectory(directory));
  const manifestPath = path.join(directory, "proofline.json");
  await writeJson(manifestPath, manifest());
  const server = await serveReport(await loadManifest(manifestPath), { host: "127.0.0.1", port: 0 });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;

  const response = await fetch(`${base}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-security-policy"), /default-src 'none'/u);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(await response.text(), /Proof, <em>not promises\.<\/em>/u);

  const missing = await fetch(`${base}/does-not-exist`);
  assert.equal(missing.status, 404);
});

