import { createServer } from "node:http";
import { evaluateProject } from "./evaluate.js";
import { renderHtmlReport } from "./report.js";

const SECURITY_HEADERS = {
  "cache-control": "no-store",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff"
};

export async function serveReport(context, { host = "127.0.0.1", port = 4317 } = {}) {
  const server = createServer(async (request, response) => {
    try {
      if (request.url === "/health") {
        response.writeHead(200, { ...SECURITY_HEADERS, "content-type": "text/plain; charset=utf-8" });
        response.end("ok\n");
        return;
      }
      const result = await evaluateProject(context);
      if (request.url === "/report.json") {
        response.writeHead(200, { ...SECURITY_HEADERS, "content-type": "application/json; charset=utf-8" });
        response.end(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }
      if (request.url !== "/" && request.url !== "/index.html") {
        response.writeHead(404, { ...SECURITY_HEADERS, "content-type": "text/plain; charset=utf-8" });
        response.end("Not found\n");
        return;
      }
      response.writeHead(200, { ...SECURITY_HEADERS, "content-type": "text/html; charset=utf-8" });
      response.end(renderHtmlReport(result));
    } catch (error) {
      response.writeHead(500, { ...SECURITY_HEADERS, "content-type": "text/plain; charset=utf-8" });
      response.end(`Proofline report failed: ${error.message}\n`);
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  return server;
}

