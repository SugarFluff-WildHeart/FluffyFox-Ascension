# Bridge API

Addons run inside an iframe. They call back into Dune Docker Console through the bridge helper in `web/dune-addon-bridge.js`. The actions below require **Dune Docker v1.4.13 or newer**.

Use it like this:

```js
const result = await window.DuneAddon.request("players.summary.list");
```

## Available Actions

| Action | Required permission | Purpose |
| --- | --- | --- |
| `players.summary.list` | `players:read` | Read player rows from `result.rows`. |
| `players.progression.get` | `players:read` | Read verified level, journey, and faction progression for `{ playerId }`. |
| `addon.storage.get/list/put/delete` | `files:addon-data` | Store add-on-owned season and player state. |
| `rewards.deliver/status/list` | `rewards:grant` | Submit and check idempotent reward deliveries. |
| `players.message.send/status/list` | `players:message` | Send optional private player messages. |

Keep bridge calls small and explicit. Ask only for the permissions your addon actually uses.

## Local Development

The real bridge exists only when your addon is opened inside Dune Docker Console.
If you open `web/index.html` directly in a browser, use mock data for local UI
work.

Example:

```js
async function getPlayers() {
  if (window.parent === window) {
    return [
      {
        name: "Local Test Player",
        level: 42,
        faction: "Atreides",
        guild: "Dev Guild",
        status: "Online",
        map: "Survival_1"
      }
    ];
  }

  const result = await window.DuneAddon.request("players.summary.list");
  return result.rows || [];
}
```

For testing real bridge calls before publishing, install the addon into your own
local Dune Docker Console instance. See [Local Development](local-development.md).
