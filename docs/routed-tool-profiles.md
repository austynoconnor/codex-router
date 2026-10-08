# Model-scoped tool compatibility profiles

Optional operator state at `routed-tool-profiles.json` in the router state
directory supports local models whose Codex client sends flattened MCP names
without `tool_namespaces_info`. Profiles are read for each routed request; no
profile means the normal tool surface and stream limits remain unchanged.

```json
{
  "version": 1,
  "models": {
    "local-provider/local-model": {
      "namespaces": {
        "mcp__cua_repl": ["js", "js_reset"]
      },
      "restrictMcpTools": true,
      "mergeDeferredAppTools": false,
      "streamPreludeMs": 600000
    }
  }
}
```

Each namespace and child name is an explicit operator assertion of the native
MCP identity. The router uses it only when the client omitted its canonical
inventory, and only for exact function definitions in the live request. It
never creates a missing browser tool or guesses identity from `__`. A supplied
inventory, malformed metadata, duplicate JSON keys, or unstable JSON numbers
are not overwritten.

`restrictMcpTools` optionally keeps only configured MCP definitions. Ordinary
functions remain available. Declared tools referenced by function-call history
or a forced/allowed tool choice are retained. For that retained history to be
executable on a client lacking canonical metadata, configure the corresponding
native identity too. The profile does not rewrite or discard transcript history.

`mergeDeferredAppTools: false` disables the router's extra deferred app-tool
snapshot for that model. The live client definitions remain available. Use this
when a desktop client already sends the complete app toolset, so duplicate
definitions do not inflate local inference prompts.

`streamPreludeMs` sets that model's empty-stream prelude and stall allowance,
between 1 and 600000 milliseconds. It remains bounded; terminal empty responses
are still errors. Larger limits allow slow prompt processing but do not make
inference faster. Other models retain the configured/default router limit.

For browser work, select the named browser directly through a documented CUA
entry point. After initialization, use browser-only `listBrowsers` and `listTabs`
when appropriate. If combined `getState` times out on native-app inventory,
retry a direct browser entry point once; do not build a shell browser driver.
