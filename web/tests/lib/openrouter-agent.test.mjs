import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runAgent, spawnBuiltinAgent } from "../../src/lib/ai/openrouter-agent.mjs";
import { resolveAllowed } from "../../src/lib/ai/agent-tools.mjs";
import { assertPublicUrl, isPrivateAddress } from "../../src/lib/ai/url-guard.mjs";
import { resolveAiConfig, saveAiConfig, maskKey } from "../../src/lib/ai/provider-config.mjs";

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), "cafy-agent-")); }

/** A fake OpenRouter: `script` is a list of responders, one per request. */
async function mockServer(script) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const parsed = JSON.parse(body || "{}");
      seen.push({ auth: req.headers.authorization, body: parsed });
      const step = script[Math.min(seen.length - 1, script.length - 1)];
      const { status = 200, json } = step(parsed);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(json));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, seen, close: () => server.close() };
}

const text = (content) => () => ({ json: { choices: [{ message: { role: "assistant", content } }] } });

test("returns the model's text and authenticates with the key", async () => {
  const m = await mockServer([text("hello")]);
  const root = tmp();
  const out = await runAgent({ prompt: "hi", caps: { writes: false, network: false }, cfg: { apiKey: "sk-or-test", model: "x/y", baseUrl: m.baseUrl }, dataRoot: root, codeRoot: root });
  assert.equal(out, "hello");
  assert.equal(m.seen[0].auth, "Bearer sk-or-test");
  assert.equal(m.seen[0].body.model, "x/y");
  m.close();
});

test("runs read_file tool calls, then answers", async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, "cv.md"), "# Jane Doe");
  const m = await mockServer([
    () => ({ json: { choices: [{ message: { role: "assistant", content: "", tool_calls: [{ id: "1", type: "function", function: { name: "read_file", arguments: JSON.stringify({ path: "cv.md" }) } }] } }] } }),
    (req) => {
      const toolMsg = req.messages.find((x) => x.role === "tool");
      return { json: { choices: [{ message: { role: "assistant", content: `saw: ${toolMsg.content}` } }] } };
    },
  ]);
  const out = await runAgent({ prompt: "x", caps: { writes: false, network: false }, cfg: { apiKey: "k", model: "m", baseUrl: m.baseUrl }, dataRoot: root, codeRoot: root });
  assert.equal(out, "saw: # Jane Doe");
  m.close();
});

test("tools are only offered when the capability record grants them", async () => {
  const root = tmp();
  const m = await mockServer([text("ok")]);
  const names = async (caps) => {
    m.seen.length = 0;
    await runAgent({ prompt: "x", caps, cfg: { apiKey: "k", model: "m", baseUrl: m.baseUrl }, dataRoot: root, codeRoot: root });
    return m.seen[0].body.tools.map((t) => t.function.name);
  };
  assert.deepEqual(await names({ writes: false, network: false }), ["read_file", "list_dir"]);
  assert.deepEqual(await names({ writes: false, network: "fetch" }), ["read_file", "list_dir", "web_fetch"]);
  assert.ok((await names({ writes: true, network: "fetch" })).includes("write_file"));
  m.close();
});

test("maps provider failures to actionable messages", async () => {
  const root = tmp();
  for (const [status, re] of [[401, /rejected the API key/], [402, /out of credits/], [404, /could not run model/]]) {
    const m = await mockServer([() => ({ status, json: { error: { message: "nope" } } })]);
    await assert.rejects(runAgent({ prompt: "x", caps: { writes: false, network: false }, cfg: { apiKey: "k", model: "bad/model", baseUrl: m.baseUrl }, dataRoot: root, codeRoot: root }), re);
    m.close();
  }
});

test("a model that rejects our max_tokens is retried with its own limit", async () => {
  const root = tmp();
  const m = await mockServer([
    (req) => (req.max_tokens ? { status: 400, json: { error: { message: "max_tokens is too large: 16000. This model supports at most 8192 completion tokens" } } } : { json: { choices: [{ message: { role: "assistant", content: "fine" } }] } }),
  ]);
  const out = await runAgent({ prompt: "x", caps: { writes: false, network: false }, cfg: { apiKey: "k", model: "m", baseUrl: m.baseUrl }, dataRoot: root, codeRoot: root });
  assert.equal(out, "fine");
  assert.equal(m.seen.length, 2);
  assert.equal(m.seen[1].body.max_tokens, undefined);
  m.close();
});

test("a missing key explains how to connect one", async () => {
  const root = tmp();
  await assert.rejects(runAgent({ prompt: "x", caps: { writes: false, network: false }, cfg: { apiKey: "", model: "m", baseUrl: "http://x" }, dataRoot: root, codeRoot: root }), /Settings → AI provider/);
});

test("spawnBuiltinAgent behaves like a child process: stdout, close(0)", async () => {
  const child = spawnBuiltinAgent(async () => "answer");
  child.stdout.setEncoding("utf8");
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  const code = await new Promise((r) => child.on("close", r));
  assert.equal(code, 0);
  assert.equal(out, "answer");
});

test("spawnBuiltinAgent reports failures on stderr with a non-zero close", async () => {
  const child = spawnBuiltinAgent(async () => { throw new Error("boom"); });
  child.stderr.setEncoding("utf8");
  let err = "";
  child.stderr.on("data", (d) => (err += d));
  const code = await new Promise((r) => child.on("close", r));
  assert.equal(code, 1);
  assert.match(err, /boom/);
});

test("file tools stay inside the data and engine folders", () => {
  const data = tmp(); const code = tmp();
  fs.writeFileSync(path.join(data, "cv.md"), "x");
  fs.writeFileSync(path.join(data, ".env"), "SECRET=1");
  fs.mkdirSync(path.join(data, "config"));
  fs.writeFileSync(path.join(data, "config", "ai-provider.json"), "{}");
  fs.writeFileSync(path.join(code, "oferta.md"), "y");
  assert.ok(resolveAllowed("cv.md", [data, code]).endsWith("cv.md"));
  assert.ok(resolveAllowed("oferta.md", [data, code]).endsWith("oferta.md"));
  assert.throws(() => resolveAllowed("../../etc/passwd", [data, code]));
  assert.throws(() => resolveAllowed("/etc/passwd", [data, code]));
  assert.throws(() => resolveAllowed(".env", [data, code]), /not available/);
  assert.throws(() => resolveAllowed("config/ai-provider.json", [data, code]), /not available/);
  const outside = tmp();
  fs.writeFileSync(path.join(outside, "s.txt"), "s");
  fs.symlinkSync(outside, path.join(data, "link"));
  assert.throws(() => resolveAllowed("link/s.txt", [data, code]));
});

test("web_fetch refuses private, loopback and metadata targets", async () => {
  for (const u of ["http://127.0.0.1/x", "http://localhost:3000", "http://169.254.169.254/latest/meta-data", "http://10.0.0.5", "http://[::1]/", "file:///etc/passwd", "http://user:pw@example.com"]) {
    await assert.rejects(assertPublicUrl(u, async () => [{ address: "93.184.216.34" }]), undefined, u);
  }
  await assert.rejects(assertPublicUrl("http://rebind.example", async () => [{ address: "10.1.1.1" }]), /public/);
  await assert.doesNotReject(assertPublicUrl("https://boards.greenhouse.io/x", async () => [{ address: "93.184.216.34" }]));
  assert.ok(isPrivateAddress("::ffff:10.0.0.1"));
  assert.ok(!isPrivateAddress("8.8.8.8"));
});

test("saved key is encrypted at rest and env wins over it", () => {
  const root = tmp();
  const env = { AUTH_SECRET: "server-secret" };
  saveAiConfig(root, { apiKey: "sk-or-v1-abcdef123456", model: "a/b" }, { env });
  const file = fs.readFileSync(path.join(root, "config", "ai-provider.json"), "utf8");
  assert.ok(!file.includes("abcdef123456"));
  const cfg = resolveAiConfig(root, env);
  assert.equal(cfg.apiKey, "sk-or-v1-abcdef123456");
  assert.equal(cfg.source, "saved");
  assert.equal(cfg.model, "a/b");
  assert.equal(resolveAiConfig(root, { ...env, OPENROUTER_API_KEY: "sk-env" }).source, "env");
  assert.equal(resolveAiConfig(root, { AUTH_SECRET: "other" }).apiKey, "");
  assert.equal(maskKey("sk-or-v1-abcdef123456"), "sk-or-v…3456");
});

test("a hosted server will not store a key in clear", () => {
  assert.throws(() => saveAiConfig(tmp(), { apiKey: "sk-x" }, { env: {}, hosted: true }), /AUTH_SECRET/);
});

test("on a hosted site with no AUTH_SECRET, the Blob token protects a saved key", () => {
  const root = tmp();
  const env = { BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_abc_123" };
  saveAiConfig(root, { apiKey: "sk-or-v1-zzzzzzzzzz1234" }, { env, hosted: true });
  assert.ok(!fs.readFileSync(path.join(root, "config", "ai-provider.json"), "utf8").includes("zzzzzzzzzz"));
  assert.equal(resolveAiConfig(root, env).apiKey, "sk-or-v1-zzzzzzzzzz1234");
});
