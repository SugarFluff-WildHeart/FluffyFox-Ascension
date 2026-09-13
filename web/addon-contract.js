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

  const SHA256_CONSTANTS = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rotateRight(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
  function sha256Hex(bytes) {
    const message = Array.from(bytes);
    const bitLength = message.length * 8;
    message.push(0x80);
    while ((message.length % 64) !== 56) message.push(0);
    const high = Math.floor(bitLength / 0x100000000);
    const low = bitLength >>> 0;
    [high, low].forEach((word) => message.push((word >>> 24) & 255, (word >>> 16) & 255, (word >>> 8) & 255, word & 255));
    const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const words = new Uint32Array(64);
    for (let offset = 0; offset < message.length; offset += 64) {
      for (let index = 0; index < 16; index += 1) words[index] = (message[offset + index * 4] << 24) | (message[offset + index * 4 + 1] << 16) | (message[offset + index * 4 + 2] << 8) | message[offset + index * 4 + 3];
      for (let index = 16; index < 64; index += 1) {
        const a = rotateRight(words[index - 15], 7) ^ rotateRight(words[index - 15], 18) ^ (words[index - 15] >>> 3);
        const b = rotateRight(words[index - 2], 17) ^ rotateRight(words[index - 2], 19) ^ (words[index - 2] >>> 10);
        words[index] = (words[index - 16] + a + words[index - 7] + b) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = hash;
      for (let index = 0; index < 64; index += 1) {
        const sigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
        const choose = (e & f) ^ (~e & g);
        const temp1 = (h + sigma1 + choose + SHA256_CONSTANTS[index] + words[index]) >>> 0;
        const sigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (sigma0 + majority) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      hash[0] = (hash[0] + a) >>> 0; hash[1] = (hash[1] + b) >>> 0; hash[2] = (hash[2] + c) >>> 0; hash[3] = (hash[3] + d) >>> 0;
      hash[4] = (hash[4] + e) >>> 0; hash[5] = (hash[5] + f) >>> 0; hash[6] = (hash[6] + g) >>> 0; hash[7] = (hash[7] + h) >>> 0;
    }
    return hash.map((word) => word.toString(16).padStart(8, "0")).join("");
  }

  async function deliveryRequestId({ seasonId, playerId, tier, rewardIndex }, cryptoImplementation = globalThis.crypto) {
    if (seasonId === undefined || playerId === undefined || tier === undefined || rewardIndex === undefined) {
      throw new Error("A delivery request ID requires seasonId, playerId, tier, and rewardIndex.");
    }
    const tuple = JSON.stringify([String(seasonId), String(playerId), String(tier), String(rewardIndex)]);
    const bytes = new TextEncoder().encode(tuple);
    const hex = cryptoImplementation?.subtle
      ? Array.from(new Uint8Array(await cryptoImplementation.subtle.digest("SHA-256", bytes)), (byte) => byte.toString(16).padStart(2, "0")).join("")
      : sha256Hex(bytes);
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

  return { normalizeProgression, rewardDeliveryPayload, deliveryRequestId, sha256Hex, seasonState };
});
