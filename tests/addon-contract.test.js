const test = require("node:test");
const assert = require("node:assert/strict");
const fixture = require("./fixtures/progression.json");
const { normalizeProgression, rewardDeliveryPayload, seasonState } = require("../web/addon-contract.js");

test("normalizes the v1.4.13 progression response without coercing arrays", () => {
  assert.deepEqual(normalizeProgression(fixture), { capabilities: fixture.capabilities, level: 18, xp: 2450, story: 2, sideQuests: 1, faction: 6 });
});

test("uses the exact item reward delivery contract", () => {
  assert.deepEqual(rewardDeliveryPayload({ requestId: "season:s1:player:player-1:tier:3:reward:0", playerId: "player-1", reward: { type: "item", id: "Reviewed_Item_123", amount: 2 } }), { requestId: "season:s1:player:player-1:tier:3:reward:0", playerId: "player-1", type: "item", itemId: "Reviewed_Item_123", amount: 2 });
});

test("blocks claims outside the active season", () => {
  const now = new Date("2026-09-13T00:00:00.000Z");
  assert.equal(seasonState({ startsAt: "2026-09-14T00:00:00.000Z" }, now), "upcoming");
  assert.equal(seasonState({ endsAt: "2026-09-12T00:00:00.000Z" }, now), "ended");
  assert.equal(seasonState({ startsAt: "2026-09-12T00:00:00.000Z", endsAt: "2026-09-14T00:00:00.000Z" }, now), "active");
});
