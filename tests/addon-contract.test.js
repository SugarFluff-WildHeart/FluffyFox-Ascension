const test = require("node:test");
const assert = require("node:assert/strict");
const fixture = require("./fixtures/progression.json");
const { normalizeProgression, rewardDeliveryPayload, deliveryRequestId, seasonState } = require("../web/addon-contract.js");

test("normalizes the v1.4.13 progression response without coercing arrays", () => {
  assert.deepEqual(normalizeProgression(fixture), { capabilities: fixture.capabilities, level: 18, xp: 2450, story: 2, sideQuests: 1, faction: 6 });
});

const delivery = (reward) => rewardDeliveryPayload({ requestId: "season:s1:player:player-1:tier:3:reward:0", playerId: "player-1", reward });

test("normalizes an item reward with optional quality", () => {
  assert.deepEqual(delivery({ type: "item", id: "Reviewed_Item_123", amount: 2, quality: 5 }), { requestId: "season:s1:player:player-1:tier:3:reward:0", playerId: "player-1", type: "item", itemId: "Reviewed_Item_123", amount: 2, quality: 5 });
});

test("normalizes XP and Intel rewards without item fields", () => {
  assert.deepEqual(delivery({ type: "xp", amount: 100 }), { requestId: "season:s1:player:player-1:tier:3:reward:0", playerId: "player-1", type: "xp", amount: 100 });
  assert.deepEqual(delivery({ type: "intel", amount: 25 }), { requestId: "season:s1:player:player-1:tier:3:reward:0", playerId: "player-1", type: "intel", amount: 25 });
});

test("normalizes numeric currency rewards and preserves currency ID zero", () => {
  assert.deepEqual(delivery({ type: "currency", currencyId: 0, amount: 750 }), { requestId: "season:s1:player:player-1:tier:3:reward:0", playerId: "player-1", type: "currency", amount: 750, currencyId: 0 });
  assert.deepEqual(delivery({ type: "currency", currencyId: "32767", amount: 1 }), { requestId: "season:s1:player:player-1:tier:3:reward:0", playerId: "player-1", type: "currency", amount: 1, currencyId: 32767 });
});

test("rejects non-numeric and out-of-range currency IDs", () => {
  assert.throws(() => delivery({ type: "currency", currencyId: "solari", amount: 750 }), /numeric currencyId/);
  assert.throws(() => delivery({ type: "currency", currencyId: 32768, amount: 750 }), /numeric currencyId/);
  assert.throws(() => delivery({ type: "currency", id: null, amount: 750 }), /numeric currencyId/);
});

test("normalizes Building Set rewards as one itemId unlock", () => {
  assert.deepEqual(delivery({ type: "building-unlock", id: "Reviewed_Building_Set_7", amount: 99, quality: 2 }), { requestId: "season:s1:player:player-1:tier:3:reward:0", playerId: "player-1", type: "building-unlock", amount: 1, itemId: "Reviewed_Building_Set_7", quality: 2 });
});

test("hashes request IDs with allowed fixed-length characters for player IDs containing #", async () => {
  const input = { seasonId: "s1", playerId: "RedBlink#75570", tier: 3, rewardIndex: 0 };
  const requestId = await deliveryRequestId(input);
  assert.match(requestId, /^ffa:[a-f0-9]{64}$/);
  assert.equal(requestId.length, 68);
  assert.equal(await deliveryRequestId(input), requestId);
  assert.notEqual(await deliveryRequestId({ ...input, playerId: "RedBlink75570" }), requestId);
});

test("hashes very long delivery tuples without exceeding the request-ID limit", async () => {
  const requestId = await deliveryRequestId({ seasonId: "season-".repeat(100), playerId: `player-${"x".repeat(5000)}`, tier: 999999, rewardIndex: 999999 });
  assert.match(requestId, /^ffa:[a-f0-9]{64}$/);
  assert.ok(requestId.length <= 128);
});

test("blocks claims outside the active season", () => {
  const now = new Date("2026-09-13T00:00:00.000Z");
  assert.equal(seasonState({ startsAt: "2026-09-14T00:00:00.000Z" }, now), "upcoming");
  assert.equal(seasonState({ endsAt: "2026-09-12T00:00:00.000Z" }, now), "ended");
  assert.equal(seasonState({ startsAt: "2026-09-12T00:00:00.000Z", endsAt: "2026-09-14T00:00:00.000Z" }, now), "active");
});
