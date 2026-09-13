# Local Development

You do not need to publish your addon before testing it.

The normal development loop is:

1. Build the UI locally with mock data.
2. Validate the addon files.
3. Copy the addon into a local Dune Docker Console install.
4. Enable it locally and test the real bridge.
5. Publish only when you are ready for other server owners to install it.

## 1. Build The UI Locally

An addon is a static web page loaded inside Dune Docker Console as an iframe.
FluffyFox Ascension's secure progression and reward actions require **Dune Docker v1.4.13 or newer**.
You can use plain HTML, React, Vue, Svelte, Vite, or any other frontend setup as
long as the final addon package contains:

```text
addon.json
web/index.html
web/...
```

For quick layout work, open the template directly:

```bash
open web/index.html
```

On Linux without `open`, use your browser's **File > Open** option.

When the page is opened directly in a browser, the real Dune Docker Console
bridge is not available. Use mock data for this part.

## 2. Mock The Bridge Locally

The template includes the bridge helper at:

```text
web/dune-addon-bridge.js
```

When your addon is inside Dune Docker Console, calls like this go through the
real bridge:

```js
const result = await window.DuneAddon.request("players.summary.list");
```

When your addon is opened directly in a browser, there is no parent console
iframe. For that case, add a small mock in your own addon code:

```js
async function loadPlayersForDevelopment() {
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

This lets you build the UI quickly without needing a running server for every
CSS or layout change.

## 3. Validate Before Testing

Run the validator from your addon repo:

```bash
node scripts/validate.js
```

This checks `addon.json`, the entry path, and requested permissions.

## 4. Test Privately In Dune Docker Console

Install the add-on through the Dune Docker Console **Addons** screen, then
enable it there and approve the requested scoped permissions. Do not edit
Console state files directly; the Console owns installation, enablement, and
permission approval state.

Open the installed add-on from the Console to test the real bridge. Verify
player rows, progression capability flags, a non-delivery refresh, and one
test reward using a reviewed identifier on a non-production player.

## 5. Updating Your Local Test Copy

After making changes, use the Console's add-on update or reinstall flow, then
refresh the Console page. Do not replace files in the Console runtime or edit
its state files directly.

## 6. Package Locally

When you want to verify the release package:

```bash
bash scripts/package.sh
```

This creates:

```text
dist/<addon-id>-<version>.zip
dist/<addon-id>-<version>.zip.sha256
```

## 7. Publishing Comes Later

Private testing does not require a pull request.

Only submit to the community addon index when your addon is ready for public
discovery in Dune Docker Console.

The community index repo is:

```text
https://github.com/Red-Blink/dune-docker-addons
```
