import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { applyRoutedToolProfile, readRoutedToolProfile } from "../src/routed-tool-profile.mjs";
import { chatProviderToolSurface } from "../src/chat-tool-surface.mjs";
import { buildNamespaceLookups, recoverPreflattenedMcpTools, rewriteNamespaceFunctionCall } from "../src/namespace-relay.mjs";

const profile = {
  namespaces: { mcp__cua_repl: ["js"] },
  restrictMcpTools: true,
  mergeDeferredAppTools: false,
  streamPreludeMs: 600000,
};
const fn = (name) => ({ type: "function", name, parameters: { type: "object" } });
const payload = () => ({ tools: [fn("exec_command"), fn("mcp__cua_repl__js"), fn("mcp__unused__large_tool")], input: [] });

test("unconfigured models retain the exact client request", () => {
  const original = payload();
  assert.equal(applyRoutedToolProfile(original), original);
});

test("explicit profile limits MCP definitions and retains ordinary tools without mutation", () => {
  const original = payload();
  const result = applyRoutedToolProfile(original, profile);
  assert.deepEqual(result.tools.map((t) => t.name), ["exec_command", "mcp__cua_repl__js"]);
  assert.equal(original.tools.length, 3);
  assert.equal(original.client_metadata, undefined);
});

test("a preflattened browser call is restored using explicit operator identity", () => {
  const result = applyRoutedToolProfile(payload(), profile);
  const flat = chatProviderToolSurface(result.tools, "local-test", profile);
  assert.equal(flat.tools.length, 2);
  assert.equal(recoverPreflattenedMcpTools(flat.tools, result.client_metadata, flat.namespaces), true);
  const call = rewriteNamespaceFunctionCall({ type: "response.output_item.done", item: { type: "function_call", name: "mcp__cua_repl__js", arguments: '{"code":"await cua.getState();"}' } }, buildNamespaceLookups(flat.namespaces)).item;
  assert.equal(call.namespace, "mcp__cua_repl");
  assert.equal(call.name, "js");
  assert.equal(call.arguments, '{"code":"await cua.getState();"}');
});

test("a profile never creates tools absent from the client request", () => {
  const result = applyRoutedToolProfile({ tools: [fn("exec_command")] }, profile);
  const flat = chatProviderToolSurface(result.tools, "local-test", profile);
  assert.equal(recoverPreflattenedMcpTools(flat.tools, result.client_metadata, flat.namespaces), false);
  assert.deepEqual(flat.tools.map((t) => t.name), ["exec_command"]);
});

test("client namespace inventories and malformed metadata are never overwritten", () => {
  for (const encoded of ['{"tool_namespaces_info":{}}', '{broken', '{"a":1,"a":2}', '{"number":9007199254740993}']) {
    const result = applyRoutedToolProfile({ ...payload(), client_metadata: { "x-codex-turn-metadata": encoded } }, profile);
    assert.equal(result.client_metadata["x-codex-turn-metadata"], encoded);
  }
});

test("history and forced tool choices retain their declared definitions", () => {
  for (const additions of [
    { input: [{ type: "function_call", name: "mcp__unused__large_tool" }] },
    { input: [{ type: "function_call", namespace: "mcp__unused", name: "large_tool" }] },
    { tool_choice: { type: "function", name: "mcp__unused__large_tool" } },
    { tool_choice: { type: "allowed_tools", tools: [{ type: "function", name: "mcp__unused__large_tool" }] } },
  ]) assert.equal(applyRoutedToolProfile({ ...payload(), ...additions }, profile).tools.length, 3);
});

test("native namespaces are filtered by exact configured child identity", () => {
  const result = applyRoutedToolProfile({ tools: [{ type: "namespace", name: "mcp__cua_repl", tools: [fn("js"), fn("unknown")] }] }, profile);
  assert.deepEqual(result.tools[0].tools.map((t) => t.name), ["js"]);
});

test("profile reader is model scoped, bounded, and rejects invalid mappings", (t) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "routed-tool-profile-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "profile.json");
  assert.equal(readRoutedToolProfile("local", file), undefined);
  writeFileSync(file, JSON.stringify({ version: 1, models: { local: profile } }));
  assert.deepEqual(readRoutedToolProfile("local", file), profile);
  assert.equal(readRoutedToolProfile("cloud", file), undefined);
  for (const invalid of [
    { ...profile, namespaces: { functions: ["js"] } },
    { ...profile, streamPreludeMs: 600001 },
    { ...profile, restrictMcpTools: "yes" },
  ]) {
    writeFileSync(file, JSON.stringify({ version: 1, models: { local: invalid } }));
    assert.throws(() => readRoutedToolProfile("local", file));
  }
});
