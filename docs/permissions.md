# Permissions

FluffyFox Ascension requires **Dune Docker v1.4.13 or newer**. The Console
asks the server owner to approve these scoped permissions during installation.
The add-on does not request database access.

| Permission | Used for |
| --- | --- |
| `players:read` | Load `players.summary.list` rows and verified player progression. |
| `files:addon-data` | Store seasons, tier rewards, and delivery state in isolated addon storage. |
| `rewards:grant` | Submit idempotent item, XP, Intel, currency, and Building Set deliveries. |
| `players:message` | Send optional private delivery notifications. |

Do not add `database:read` or `database:write`. Seasons and reward state use
`addon.storage.*`, never Console database queries or state-file edits.

```json
{
  "permissions": [
    "players:read",
    "files:addon-data",
    "rewards:grant",
    "players:message"
  ]
}
```
