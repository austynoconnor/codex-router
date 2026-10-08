---
name: codex-in-app-browser
description: Drive the Codex in-app browser through its provided CUA or legacy node_repl runtime. Use when a custom (non-OpenAI) model session needs to open, navigate, inspect, click, type, or take a screenshot in the Codex browser panel.
---

# Codex In-App Browser

Choose the runtime from the tools actually offered in this session.

## Current browser tool

If `mcp__cua_repl__js` is offered, read its tool instructions and use it.
To open a requested URL visibly in the Codex browser, the first invocation
may contain exactly one entry-point call:

```js
let tab = await cua.createBrowserTab("iab", url, { visible: true });
```

Use the user's actual URL. For an existing tab, use the documented `getTab`
entry point; for an inventory, use `await cua.getState();` as the entire first
invocation. Read its returned documentation and state before interacting.
Use only its documented APIs and preserve the REPL bindings between calls.
Do not bootstrap the legacy browser client inside this runtime.
If combined inventory times out, use the direct in-app browser entry point
once. After initialization, prefer browser-only inventories for browser tasks.
When a binding call fails, its assigned variable is unavailable. Inspect the
error and recover once with a fresh tab if authorized; do not call a variable
whose initialization failed.

## Legacy node runtime

Use the remaining instructions only when `mcp__node_repl__js` is offered.

## First: read the official skill

The official skill is authoritative. Read it before any browser work:

`~/.codex/plugins/cache/openai-bundled/browser/<version>/skills/control-in-app-browser/SKILL.md`

Find the latest `<version>` directory (for example `26.803.41515`).

## Bootstrap (once per session)

Send this as ONE line through `mcp__node_repl__js`:

```js
if (globalThis.agent?.browsers == null) { const { setupBrowserRuntime } = await import("<plugin root>/scripts/browser-client.mjs"); globalThis.agent = await setupBrowserRuntime(); }
```

Replace `<plugin root>` with the browser plugin path. Then bind the
in-app browser and read its documentation:

```js
globalThis.iab = await agent.browsers.get("iab");
nodeRepl.write(await iab.documentation());
```

Read the complete documentation output before interacting with the page.

## Rules

- Send code as ONE line, or use `@file:<path>` with a trailing newline.
  The runtime fires on newline; input without a trailing newline silently
  does nothing.
- Reuse the existing `agent` and `iab` bindings on later turns. Do not
  reinitialize.
- `open_in_codex` only OPENS a tab. It cannot click, type, or read. Use
  `mcp__node_repl__js` for interaction.
- Never start your own node_repl process and never write a side-channel
  driver. Use the tool you were given.

## If the tool is missing

If neither supported browser tool is offered, report the missing capability
and end the turn. Do not repeatedly search for installed runtimes, start a
separate node process, or construct a browser driver from shell commands.
