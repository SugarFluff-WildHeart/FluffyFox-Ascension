# FluffyFox Ascension

Server-owned seasonal progression and reward tracking for Dune Docker Console.
Requires **Dune Docker v1.4.13 or newer**.

The addon uses Red-Blink's permissioned bridge to read players, inspect
verified progression, deliver rewards, and keep its own state in addon-owned
storage. It does not access Dune's database tables.

## Current scope

- Active season, player XP, tier, and claim tracking
- Player selection using `players:read`
- Safe local-preview mode when opened outside the console
- Idempotent reward delivery through `rewards.deliver`

The manifest asks for addon-owned storage and audited reward delivery. Each
delivery has a permanent deterministic request ID, so a retry cannot grant a
reward twice.

Request IDs use a fixed-length `ffa:` SHA-256 digest of the season, player,
tier, and reward index. On upgrade, stored legacy delivery IDs are reconciled
first; a pending or uncertain legacy delivery is never re-submitted under the
new ID format.

The add-on uses Web Crypto when available and a bundled SHA-256 implementation
when the Console runs from a plain-HTTP LAN address. Both paths produce the
same idempotency key.

The default track deliberately has no rewards configured. Add only reviewed
item IDs (or verified Building Set IDs) before publishing a reward-bearing
season; this prevents a placeholder item from being granted accidentally.

See [Reward Configuration](docs/reward-configuration.md) for the supported
tier format and reward contract.

Progression parsing follows the v1.4.13 bridge response: `level.level` and
`level.xp` are used directly; Story and Side Quest progress are counts of rows
where `complete === true`; Faction progress is the highest numeric `rank`
reported by a faction row.

## Repository Layout

```text
addon.json                 Addon identity, version, entry path, and permissions.
web/                       The addon page shown inside Dune Docker Console.
web/index.html             Addon HTML entry point.
web/addon.js               Your addon behavior.
web/addon.css              Your addon styling.
web/dune-addon-bridge.js   Small helper for calling console APIs.
docs/                      Focused docs for building and publishing.
examples/                  Copyable bridge request examples.
scripts/                   Validation and optional local packaging tools.
.github/workflows/         GitHub validation and release packaging.
```

Most addon developers only need to edit `addon.json` and files under `web/`.

## Quick Start

1. Click **Use this template** on GitHub.
2. Update `addon.json` with your addon details.
3. Update `data-addon-id` in `web/index.html` to match `addon.json.id`.
4. Build your UI in `web/`.
5. Validate locally:

   ```bash
   node scripts/validate.js
   ```

6. Commit and push your addon.
7. Create a version tag matching `addon.json.version`:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

GitHub Actions will validate, package, create the GitHub Release, and upload the addon zip plus its SHA-256 checksum.

## How Addons Are Listed

There are three repositories involved:

- **Template repo:** this starter project.
- **Your addon repo:** your addon code and GitHub Releases.
- **Community addon index:** the reviewed list shown in Dune Docker Console.

Community addon index:

```text
https://github.com/Red-Blink/dune-docker-addons
```

When your addon is ready, open a pull request to `dune-docker-addons`. Your PR should add `addons/<your-addon-id>.json` and update `index.json`.

The community index also owns addon lifecycle status, such as `active`, `deprecated`, `unsupported`, `removed`, and `blocked`. Do not put those lifecycle fields in your addon's `addon.json`; they are catalog metadata used by Dune Docker Console to warn users or block unsafe/abandoned addons.

## Docs

- [Getting Started](docs/getting-started.md)
- [Local Development](docs/local-development.md)
- [Bridge API](docs/bridge-api.md)
- [Permissions](docs/permissions.md)
- [Publishing](docs/publishing.md)

## Local Preview

You can open `web/index.html` directly in a browser for layout work. Use mock data there, then install the addon into a local Dune Docker Console instance to test the real bridge.

See [Local Development](docs/local-development.md) for the full local testing workflow.

For local packaging tests only:

```bash
bash scripts/package.sh
```
