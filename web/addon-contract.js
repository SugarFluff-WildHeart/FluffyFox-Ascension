(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FluffyFoxAscensionContract = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function completedCount(rows) {
    return Array.isArray(rows) ? rows.filter((row) => row && row.complete === true).length : 0;
  }

  // Faction rank is the highest numeric `rank` reported by any faction row.
  // It is a rank state, not a count of completed faction journeys.
  function factionRank(rows) {
    if (!Array.isArray(rows)) return 0;
    return rows.reduce((highest, row) => Math.max(highest, number(row?.rank)), 0);
  }

  function normalizeProgression(result) {
    const data = result?.data || result || {};
    return {
      capabilities: data.capabilities || {},
      level: number(data.level?.level),
      xp: number(data.level?.xp),
      story: completedCount(data.story),
      sideQuests: completedCount(data.sideQuests),
      faction: factionRank(data.faction)
    };
  }

  function rewardDeliveryPayload({ requestId, playerId, reward }) {
    if (!requestId || !playerId || !reward?.type) throw new Error("A reward delivery requires requestId, playerId, and type.");
    const amount = number(reward.amount);
    if (amount <= 0) throw new Error("Reward quantity must be greater than zero.");
    const payload = { requestId, playerId, type: reward.type, amount };
    if (reward.type === "item" || reward.type === "building-unlock") {
      if (!reward.id) throw new Error(`${reward.type} rewards require a reviewed item ID.`);
      payload.itemId = reward.id;
      if (reward.quality !== undefined) payload.quality = reward.quality;
      if (reward.type === "building-unlock") payload.amount = 1;
    } else if (reward.type === "currency") {
      const currencyId = reward.currencyId ?? reward.id;
      const numericCurrencyId = Number(currencyId);
      if ((typeof currencyId !== "number" && typeof currencyId !== "string") || String(currencyId).trim() === "" || !Number.isInteger(numericCurrencyId) || numericCurrencyId < 0 || numericCurrencyId > 32767) {
        throw new Error("Currency rewards require a numeric currencyId from 0 through 32767.");
      }
      payload.currencyId = numericCurrencyId;
    } else if (reward.type !== "xp" && reward.type !== "intel") {
      throw new Error(`Unsupported reward type: ${reward.type}`);
    }
    return payload;
  }

  async function deliveryRequestId({ seasonId, playerId, tier, rewardIndex }) {
    if (seasonId === undefined || playerId === undefined || tier === undefined || rewardIndex === undefined) {
      throw new Error("A delivery request ID requires seasonId, playerId, tier, and rewardIndex.");
    }
    if (!globalThis.crypto?.subtle) throw new Error("Secure hashing is unavailable in this browser context.");
    const tuple = JSON.stringify([String(seasonId), String(playerId), String(tier), String(rewardIndex)]);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(tuple));
    const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `ffa:${hex}`;
  }

  function seasonState(season, now = new Date()) {
    const current = now.getTime();
    const startsAt = season?.startsAt ? Date.parse(season.startsAt) : NaN;
    const endsAt = season?.endsAt ? Date.parse(season.endsAt) : NaN;
    if (Number.isFinite(startsAt) && current < startsAt) return "upcoming";
    if (Number.isFinite(endsAt) && current >= endsAt) return "ended";
    return "active";
  }

  return { normalizeProgression, rewardDeliveryPayload, deliveryRequestId, seasonState };
});
