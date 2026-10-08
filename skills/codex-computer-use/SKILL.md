---
name: codex-computer-use
description: Control browsers and local apps through the provided CUA or legacy @oai/sky tools inside the Codex app. Use when the session uses a custom (non-OpenAI) model and the user asks to operate browser or desktop UI, click, type, or take a screenshot. Prefer purpose-built connectors, APIs, or CLIs when they exist.
---

# Codex Computer Use

Choose the runtime from the tools actually offered in this session. A skill
file or a running desktop service does not make a missing tool callable.

## Chrome and browser tasks with the current browser tool

When `mcp__cua_repl__js` is offered, use it for Chrome, Edge, and the Codex
in-app browser. Read its tool instructions first. For an inventory of existing
browser sessions and tabs, the first invocation must contain exactly:

```js
await cua.getState();
```

For a named browser and known URL, prefer the documented direct browser entry
point (`createBrowserTab` or `getTab`) instead of combined inventory. After
initialization, browser-only `listBrowsers` and `listTabs` can inspect connected
browsers without querying native apps. If combined inventory times out, retry
once with the direct entry point for the requested browser and URL.

Read the returned documentation and state before the next call. Select the
requested browser and existing tab from the observed inventory, then use only
the APIs documented by the tool. Keep bindings in the provided REPL. Do not
import `@oai/sky` into this runtime. If its instructions disable native desktop
APIs, use its supported browser APIs for browser tasks.

A failed `getTab` or `createBrowserTab` call did not create its assigned
binding. Do not call that variable afterward. If the requested tab belongs to
another browser session, preserve that session's ownership. For an authorized
read of a known URL, create a separate tab at that same URL once and inspect
its returned state. If that fails, report the exact blocker and stop.

## Desktop tasks with the legacy node runtime

Use the following workflow only when `mcp__node_repl__js` is offered. The
runtime is `@oai/sky`, imported through that provided JavaScript tool.

## First: read the official skill

The official skill is authoritative. Read it before any computer-use work:

`~/.codex/plugins/cache/openai-bundled/computer-use/<version>/skills/computer-use/SKILL.md`

Find the latest `<version>` directory.

## Load the runtime (once per session)

Send this as ONE line through `mcp__node_repl__js`:

```js
globalThis.sky = (await import("@oai/sky")).sky;
nodeRepl.write("sky: " + typeof sky);
```

Confirm the output says `sky: object` before continuing. The import
connects to the SkyComputerUseService, which is already running.

## Rules

- Send code as ONE line, or use `@file:<path>` with a trailing newline.
  The runtime fires on newline; input without a trailing newline silently
  does nothing.
- Reuse the loaded `sky` runtime on later turns. Do not reinitialize.
- The first computer-use action may need approval in the app
  (Settings → Computer use). Common apps such as Safari and Chrome are
  usually pre-approved.
- Prefer purpose-built connectors, APIs, and CLIs over computer use when
  they exist. Computer use is for reading or operating app UI that nothing
  else can reach.
- Never start your own node_repl process and never write a side-channel
  driver. Use the tool you were given.

## If the tool is missing

If neither supported tool is offered for the requested action, report the
missing capability and end the turn. Do not repeatedly reread these files,
inspect browser process arguments or debug ports, recursively search runtime
directories, or import `@oai/sky` from a shell script to replace the missing
tool. A successful standalone import is not proof that Codex supplied a tool.
