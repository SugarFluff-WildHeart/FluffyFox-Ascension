# Reward Configuration

FluffyFox Ascension ships with an empty track so it cannot grant an unreviewed
reward. Before opening a season, configure its tiers in addon-owned storage
with reviewed Dune Docker v1.4.13 identifiers.

## Tier format

The tiers are stored under:

```text
ascension:season:<season-id>:tiers
```

Each tier uses a verified progression category and one or more rewards:

```json
[
  {
    "tier": 1,
    "category": "level",
    "requirement": 5,
    "title": "First Steps",
    "rewards": [
      {
        "type": "item",
        "id": "REVIEWED_ITEM_ID",
        "amount": 1,
        "quality": 1,
        "label": "Water supply"
      }
    ]
  }
]
```

| Reward type | Required fields | Notes |
| --- | --- | --- |
| `item` | `id`, `amount` | `id` is delivered as `itemId`; `quality` is optional. |
| `xp` | `amount` | No item identifier is sent. |
| `intel` | `amount` | No item identifier is sent. |
| `currency` | `currencyId`, `amount` | `currencyId` must be an integer from `0` through `32767`; it is forwarded as `currencyId`. |
| `building-unlock` | `id` | `id` is delivered as `itemId`; delivery always uses `amount: 1`. |

Use the Console-supported addon configuration/storage workflow to write this
value. If your Console build does not provide a configuration editor yet, open
the add-on iframe in browser developer tools and run this bridge call with your
reviewed tier array:

```js
await window.DuneAddon.request("addon.storage.put", {
  key: "ascension:season:s1:tiers",
  value: reviewedTiers
});
```

Replace `s1` with the active season ID and `reviewedTiers` with the JSON array
above. Reload the add-on afterwards. Do not edit database tables or Console
state files. Every change should be tested on a non-production player first.
The add-on keeps reward buttons disabled until a tier contains at least one
reviewed reward.
