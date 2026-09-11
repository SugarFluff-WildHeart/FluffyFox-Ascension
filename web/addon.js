(function () {
  "use strict";

  const VERSION = "0.3.2";
  const store = {
    active: "ascension:active-season",
    season: (id) => `ascension:season:${id}`,
    tiers: (id) => `ascension:season:${id}:tiers`,
    categories: (id) => `ascension:season:${id}:categories`,
    progress: (seasonId, playerId) => `ascension:season:${seasonId}:player:${playerId}:progress`
  };
  const DEFAULT_SEASON = { id: "s1", name: "Arrakis Rising", startsAt: "2026-09-12T00:00:00.000Z", endsAt: null };
  const DEFAULT_TIERS = [
    [1, 5, "First Steps", 1], [2, 10, "Desert Walker", 2], [3, 15, "Survivor", 3], [4, 20, "Spice Hunter", 4], [5, 25, "Ascendant", 5]
  ].map(([tier, requirement, title, amount]) => ({ tier, category: "level", requirement, title, rewards: [{ type: "item", id: "WaterBottle_1", amount, label: "Water supply" }] }));
  const DEFAULT_CATEGORIES = [
    { id: "level", label: "Level", progressionKey: "level", enabled: true },
    { id: "story", label: "Story", progressionKey: "story", enabled: true },
    { id: "side-quest", label: "Side Quests", progressionKey: "sideQuest", enabled: true },
    { id: "faction", label: "Faction", progressionKey: "faction", enabled: true },
    { id: "exploration", label: "Exploration", enabled: false, reason: "Not verified by the core" },
    { id: "achievement", label: "Achievement", enabled: false, reason: "Not verified by the core" }
  ];
  const state = { players: [], season: null, tiers: [], categories: DEFAULT_CATEGORIES, progression: {}, progress: { deliveries: {}, completedTiers: [] }, loading: false, timer: null };
  const $ = (selector) => document.querySelector(selector);

  function request(action, payload = {}) {
    if (!window.DuneAddon?.request) throw new Error("Dune addon bridge is unavailable.");
    return window.DuneAddon.request(action, payload);
  }
  function log(message, error = false) {
    const el = $("#log"); if (!el) return;
    el.textContent += `[${new Date().toLocaleTimeString()}] ${message}\n`;
    el.scrollTop = el.scrollHeight; if (error) el.classList.add("error");
  }
  async function get(key) { const result = await request("addon.storage.get", { key }); return result && Object.hasOwn(result, "value") ? result.value : result; }
  async function put(key, value) { return request("addon.storage.put", { key, value }); }
  function currentPlayer() { return state.players.find((player) => player.playerId === $("#playerSelect")?.value) || null; }
  function name(player) { return player?.name || player?.displayName || player?.playerId || "Unknown player"; }
  function enabled(key) { const flags = state.progression.capabilities; if (!flags || !Object.hasOwn(flags, key)) return true; const value = flags[key]; return value === true || value?.enabled === true || value?.available === true; }
  function value(category) {
    const data = state.progression.data || state.progression;
    if (category.id === "level") return Number(data.level || 0);
    if (category.id === "story") return Number(data.story?.progress ?? data.story ?? 0);
    if (category.id === "side-quest") return Number(data.sideQuests?.completed ?? data.sideQuest?.completed ?? data.sideQuest ?? 0);
    if (category.id === "faction") return Number(data.faction?.rank ?? data.faction?.progress ?? data.faction ?? 0);
    return 0;
  }
  function eligible(tier) { const category = state.categories.find((entry) => entry.id === tier.category); return Boolean(category?.enabled && enabled(category.progressionKey) && value(category) >= Number(tier.requirement || 0)); }
  function done(tier) { return state.progress.completedTiers.includes(tier.tier); }
  function deliveryId(playerId, tier, rewardIndex) { return `season:${state.season.id}:player:${playerId}:tier:${tier.tier}:reward:${rewardIndex}`; }

  async function ensureStorage() {
    const existing = await get(store.active);
    if (existing?.id) return existing;
    await put(store.active, DEFAULT_SEASON);
    await Promise.all([put(store.season(DEFAULT_SEASON.id), DEFAULT_SEASON), put(store.tiers(DEFAULT_SEASON.id), DEFAULT_TIERS), put(store.categories(DEFAULT_SEASON.id), DEFAULT_CATEGORIES)]);
    log("Created the default season in addon storage."); return DEFAULT_SEASON;
  }
  async function loadSeason() {
    state.season = await ensureStorage();
    state.tiers = (await get(store.tiers(state.season.id))) || DEFAULT_TIERS;
    state.categories = (await get(store.categories(state.season.id))) || DEFAULT_CATEGORIES;
    $("#seasonName").textContent = state.season.name;
    $("#seasonDates").textContent = formatDates(state.season);
    if ($("#seasonStart")) $("#seasonStart").value = datetime(state.season.startsAt);
    if ($("#seasonEnd")) $("#seasonEnd").value = datetime(state.season.endsAt);
  }
  async function loadPlayers() {
    const result = await request("players.summary.list");
    if (!Array.isArray(result?.rows)) throw new Error("players.summary.list did not return result.rows.");
    state.players = result.rows.filter((row) => typeof row.playerId === "string" && row.playerId);
    const select = $("#playerSelect"), old = select.value; select.replaceChildren();
    state.players.forEach((row) => { const option = document.createElement("option"); option.value = row.playerId; option.textContent = name(row); select.append(option); });
    if (state.players.some((row) => row.playerId === old)) select.value = old;
    log(`Loaded ${state.players.length} player(s).`);
  }
  async function loadPlayer() {
    const player = currentPlayer(); if (!player || !state.season) return;
    state.progression = await request("players.progression.get", { playerId: player.playerId });
    state.progress = (await get(store.progress(state.season.id, player.playerId))) || { deliveries: {}, completedTiers: [] };
    await reconcileDeliveries(player);
    $("#playerLevel").textContent = value({ id: "level" }) || "—"; render();
  }

  function render() {
    const unlocked = state.tiers.filter(eligible), level = value({ id: "level" });
    $("#currentTier").textContent = `${unlocked.at(-1)?.tier || 0} / ${state.tiers.length}`;
    $("#xpValue").textContent = `${level} Level`; $("#xpStat").textContent = `${level} Level`;
    $("#claimedValue").textContent = String(state.progress.completedTiers.length);
    $("#automationStatus").textContent = "Refresh checks the selected player";
    const root = $("#tiers"); root.replaceChildren();
    for (const tier of state.tiers) {
      const card = document.createElement("article"), unlockedTier = eligible(tier), complete = done(tier);
      card.className = `tier ${unlockedTier ? "unlocked" : "locked"}`;
      const rewardText = tier.rewards.map((reward) => `${reward.label || reward.id} ×${reward.amount}`).join(", ");
      card.innerHTML = `<span class="tier-number">${tier.tier}</span><div><h3>${escape(tier.title)}</h3><p>${escape(tier.category)} · ${tier.requirement} required · ${escape(rewardText)}</p></div>`;
      const button = document.createElement("button"); button.type = "button"; button.disabled = !currentPlayer() || !unlockedTier || complete;
      button.textContent = complete ? "Delivered" : unlockedTier ? "Deliver rewards" : "Locked"; button.onclick = () => deliver(tier); card.append(button); root.append(card);
    }
    const categories = $("#categories"); if (!categories) return; categories.replaceChildren();
    state.categories.forEach((category) => { const supported = category.enabled && enabled(category.progressionKey), card = document.createElement("article"); card.className = "category"; card.innerHTML = `<strong>${escape(category.label)}</strong><span class="category-state ${supported ? "available" : "pending"}">${supported ? `Available · ${value(category)}` : escape(category.reason || "Unavailable")}</span>`; categories.append(card); });
  }
  async function deliver(tier) {
    const player = currentPlayer(); if (!player || !eligible(tier) || done(tier)) return;
    let delivered = true;
    for (const [index, reward] of tier.rewards.entries()) {
      const requestId = deliveryId(player.playerId, tier, index);
      const result = await request("rewards.deliver", { requestId, playerId: player.playerId, type: reward.type, id: reward.id, amount: reward.amount });
      const status = result?.status || "uncertain"; state.progress.deliveries[requestId] = { status, updatedAt: new Date().toISOString() };
      if (status === "delivered") await request("players.message.send", { requestId: `${requestId}:message`, playerId: player.playerId, message: `FluffyFox Ascension reward delivered: ${reward.label || reward.id}.` }).catch(() => null);
      else { delivered = false; log(status === "pending" ? `Tier ${tier.tier} is queued for delivery.` : `Tier ${tier.tier} needs manual delivery review.`, status === "uncertain"); }
    }
    if (delivered) { state.progress.completedTiers = [...new Set([...state.progress.completedTiers, tier.tier])]; log(`Tier ${tier.tier} delivered to ${name(player)}.`); }
    await put(store.progress(state.season.id, player.playerId), state.progress); render();
  }
  async function notifyDelivered(player, requestId, reward) {
    const delivery = state.progress.deliveries[requestId];
    if (delivery.messageSubmitted) return;
    try {
      await request("players.message.send", { requestId: `${requestId}:message`, playerId: player.playerId, message: `FluffyFox Ascension reward delivered: ${reward.label || reward.id}.` });
      delivery.messageSubmitted = true;
    } catch (error) {
      log(`Reward was delivered, but its private notification could not be submitted: ${error.message}`);
    }
  }
  async function reconcileDeliveries(player) {
    let changed = false;
    for (const [requestId, delivery] of Object.entries(state.progress.deliveries)) {
      if (delivery.status !== "pending") continue;
      let status;
      try { status = (await request("rewards.status", { requestId }))?.status || "uncertain"; }
      catch (error) { log(`Could not check queued reward status: ${error.message}`, true); continue; }
      if (status !== delivery.status) { delivery.status = status; delivery.updatedAt = new Date().toISOString(); changed = true; }
      if (status === "uncertain") log("A queued reward needs manual delivery review.", true);
    }
    for (const tier of state.tiers) {
      if (done(tier)) continue;
      const requestIds = tier.rewards.map((_, index) => deliveryId(player.playerId, tier, index));
      if (!requestIds.length || !requestIds.every((requestId) => state.progress.deliveries[requestId]?.status === "delivered")) continue;
      for (const [index, reward] of tier.rewards.entries()) await notifyDelivered(player, requestIds[index], reward);
      state.progress.completedTiers.push(tier.tier); changed = true;
      log(`Queued Tier ${tier.tier} reward delivery completed for ${name(player)}.`);
    }
    if (changed) await put(store.progress(state.season.id, player.playerId), state.progress);
  }
  async function saveDates() { if (!state.season) return; state.season.startsAt = $("#seasonStart")?.value ? new Date($("#seasonStart").value).toISOString() : null; state.season.endsAt = $("#seasonEnd")?.value ? new Date($("#seasonEnd").value).toISOString() : null; await put(store.active, state.season); await put(store.season(state.season.id), state.season); $("#seasonDates").textContent = formatDates(state.season); log("Season dates saved in addon storage."); }
  async function refresh() { if (state.loading) return; state.loading = true; $("#refresh").disabled = true; try { await loadPlayers(); await loadSeason(); await loadPlayer(); } catch (error) { log(error.message, true); } finally { state.loading = false; $("#refresh").disabled = false; } }
  function autoRefresh() { const seconds = Number($("#refreshInterval")?.value || 0); if (state.timer) clearInterval(state.timer); state.timer = seconds ? setInterval(refresh, seconds * 1000) : null; }
  function escape(value) { return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[c]); }
  function formatDates(season) { return `${season.startsAt ? new Date(season.startsAt).toLocaleDateString() : "Open"} — ${season.endsAt ? new Date(season.endsAt).toLocaleDateString() : "No end date"}`; }
  function datetime(value) { if (!value) return ""; const date = new Date(value), p = (v) => String(v).padStart(2, "0"); return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`; }
  document.addEventListener("DOMContentLoaded", () => { $("#initialize")?.addEventListener("click", async () => { await ensureStorage(); await refresh(); }); $("#refresh")?.addEventListener("click", refresh); $("#playerSelect")?.addEventListener("change", loadPlayer); $("#syncLevel")?.addEventListener("click", loadPlayer); $("#addXp")?.addEventListener("click", () => log("Manual XP adjustment is disabled: the core progression API is authoritative.")); $("#saveSeasonDates")?.addEventListener("click", saveDates); $("#refreshInterval")?.addEventListener("change", autoRefresh); autoRefresh(); log(`FluffyFox Ascension v${VERSION} loaded.`); refresh(); });
})();
