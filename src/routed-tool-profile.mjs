import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { STATE_DIR } from "./paths.mjs";
import { jsonIsUnambiguousForRewrite } from "./namespace-relay.mjs";

export const ROUTED_TOOL_PROFILES_PATH = path.join(STATE_DIR, "routed-tool-profiles.json");

// Operator-owned, model-scoped compatibility for clients that preflatten MCP
// names without supplying the canonical tool namespace inventory. Never guess
// a native identity from a delimiter in an ordinary function name.
export function readRoutedToolProfile(slug, filePath = ROUTED_TOOL_PROFILES_PATH) {
  if (!existsSync(filePath)) return undefined;
  const state = JSON.parse(readFileSync(filePath, "utf8"));
  if (state.version !== 1 || !state.models || typeof state.models !== "object" || Array.isArray(state.models)) {
    throw new Error("Invalid routed tool profile state.");
  }
  const profile = state.models[slug];
  if (!profile) return undefined;
  if (!profile.namespaces || typeof profile.namespaces !== "object" || Array.isArray(profile.namespaces)) {
    throw new Error("A routed tool profile requires explicit MCP namespace mappings.");
  }
  for (const [namespace, names] of Object.entries(profile.namespaces)) {
    if (!/^mcp__[A-Za-z0-9_-]+$/.test(namespace) || !Array.isArray(names) ||
      names.some((name) => typeof name !== "string" || !name)) {
      throw new Error("Invalid routed tool profile MCP namespace mapping.");
    }
  }
  for (const key of ["restrictMcpTools", "mergeDeferredAppTools"]) {
    if (profile[key] !== undefined && typeof profile[key] !== "boolean") {
      throw new Error(`Invalid routed tool profile ${key}.`);
    }
  }
  if (profile.streamPreludeMs !== undefined &&
    (!Number.isSafeInteger(profile.streamPreludeMs) || profile.streamPreludeMs < 1 || profile.streamPreludeMs > 600_000)) {
    throw new Error("Routed tool profile streamPreludeMs must be between 1 and 600000.");
  }
  return profile;
}

export function applyRoutedToolProfile(payload, profile) {
  if (!profile) return payload;
  const configured = new Set(Object.entries(profile.namespaces).flatMap(
    ([namespace, names]) => names.map((name) => `${namespace}__${name}`),
  ));
  const referenced = new Set();
  const remember = (value) => {
    const name = value?.name ?? value?.function?.name;
    if (typeof name === "string") referenced.add(value.namespace ? `${value.namespace}__${name}` : name);
  };
  for (const item of Array.isArray(payload.input) ? payload.input : []) {
    if (item.type === "function_call") remember(item);
  }
  remember(payload.tool_choice);
  for (const item of payload.tool_choice?.tools || []) remember(item);
  const tools = !profile.restrictMcpTools || !Array.isArray(payload.tools)
    ? payload.tools
    : payload.tools.flatMap((tool) => {
      if (tool.type === "namespace" && tool.name?.startsWith("mcp__")) {
        const children = (tool.tools || []).filter((child) => configured.has(`${tool.name}__${child.name}`) || referenced.has(`${tool.name}__${child.name}`));
        return children.length ? [{ ...tool, tools: children }] : [];
      }
      const name = tool.name ?? tool.function?.name;
      if (typeof name !== "string" || !name.startsWith("mcp__")) return [tool];
      return configured.has(name) || referenced.has(name) ? [tool] : [];
    });

  let metadata;
  const encoded = payload.client_metadata?.["x-codex-turn-metadata"];
  if (encoded !== undefined && (typeof encoded !== "string" || !jsonIsUnambiguousForRewrite(encoded))) {
    return { ...payload, tools };
  }
  try { metadata = encoded ? JSON.parse(encoded) : {}; } catch { return { ...payload, tools }; }
  // A client-provided inventory always takes precedence, including an empty
  // inventory. Explicit configuration supplies identity only when it is absent.
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata) ||
    Object.hasOwn(metadata, "tool_namespaces_info")) return { ...payload, tools };
  metadata.tool_namespaces_info = Object.fromEntries(Object.entries(profile.namespaces).map(
    ([namespace, names]) => [namespace, {
      name: namespace,
      functions: Object.fromEntries(names.map((name) => [name, {
        name, direct: true, source: { kind: "mcp", server_name: namespace.slice(5) },
      }])),
    }],
  ));
  return { ...payload, tools, client_metadata: {
    ...payload.client_metadata,
    "x-codex-turn-metadata": JSON.stringify(metadata),
  } };
}
