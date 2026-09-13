(function () {
  "use strict";
  const VERSION = "0.3.7";
  const Contract = window.FluffyFoxAscensionContract;
  const store = { active: "ascension:active-season", season: (id) => `ascension:season:${id}`, tiers: (id) => `ascension:season:${id}:tiers`, categories: (id) => `ascension:season:${id}:categories`, progress: (seasonId, playerId) => `ascension:season:${seasonId}:player:${playerId}:progress` };
  const DEFAULT_SEASON = { id: "s1", name: "Arrakis Rising", startsAt: "2026-09-12T00:00:00.000Z", endsAt: null };
  // No placeholder rewards are shipped. Add only reviewed IDs through addon storage.
  const DEFAULT_TIERS = [[1, 5, "First Steps"], [2, 10, "Desert Walker"], [3, 15, "Survivor"], [4, 20, "Spice Hunter"], [5, 25, "Ascendant"]].map(([tier, requirement, title]) => ({ tier, category: "level", requirement, title, rewards: [] }));
  const DEFAULT_CATEGORIES = [
    { id: "level", label: "Level", progressionKey: "level", enabled: true }, { id: "story", label: "Story", progressionKey: "story", enabled: true }, { id: "side-quest", label: "Side Quests", progressionKey: "sideQuests", enabled: true }, { id: "faction", label: "Faction", progressionKey: "faction", enabled: true }, { id: "exploration", label: "Exploration", enabled: false, reason: "Not verified by the core" }, { id: "achievement", label: "Achievement", enabled: false, reason: "Not verified by the core" }
  ];
  const THEMES = { gold: ["#f0eee7", "#b7b0a4", "#f0b653", "#966322", "240 182 83"], cyan: ["#e6fbff", "#b4dce5", "#70d6f5", "#277c93", "112 214 245"], pink: ["#fff0f8", "#e5bdd2", "#ff9dcc", "#a63d6e", "255 157 204"], green: ["#edfff2", "#b9dbc3", "#7dffae", "#2b8c50", "125 255 174"], purple: ["#f7efff", "#d5bee8", "#c998ff", "#7143a1", "201 152 255"], warm: ["#fff2df", "#dfc5a3", "#f4a261", "#aa5722", "244 162 97"] };
  const state = { players: [], season: null, tiers: [], categories: DEFAULT_CATEGORIES, progression: {}, progress: { deliveries: {}, completedTiers: [] }, loading: false, timer: null };
  const $ = (selector) => document.querySelector(selector);

  function request(action, payload = {}) { if (!window.DuneAddon?.request) throw new Error("Dune addon bridge is unavailable."); return window.DuneAddon.request(action, payload); }
  function log(message, error = false) { const el = $("#log"); if (!el) return; el.textContent += `[${new Date().toLocaleTimeString()}] ${message}\n`; el.scrollTop = el.scrollHeight; if (error) el.classList.add("error"); }
  async function get(key) { const result = await request("addon.storage.get", { key }); return result && Object.hasOwn(result, "value") ? result.value : result; }
  async function put(key, value) { return request("addon.storage.put", { key, value }); }
  function currentPlayer() { return state.players.find((player) => player.playerId === $("#playerSelect")?.value) || null; }
  function name(player) { return player?.name || player?.displayName || player?.playerId || "Unknown player"; }
  function seasonStatus() { return Contract.seasonState(state.season); }
  function enabled(key) { const flags = state.progression.capabilities; if (!key || !flags || !Object.hasOwn(flags, key)) return false; const flag = flags[key]; return flag === true || flag?.enabled === true || flag?.available === true; }
  function value(category) { return Number(state.progression[category.id === "side-quest" ? "sideQuests" : category.id] || 0); }
  function eligible(tier) { const category = state.categories.find((entry) => entry.id === tier.category); return seasonStatus() === "active" && Boolean(category?.enabled && enabled(category.progressionKey) && value(category) >= Number(tier.requirement || 0)); }
  function done(tier) { return state.progress.completedTiers.includes(tier.tier); }
  function legacyDeliveryId(playerId, tier, rewardIndex) { return `season:${state.season.id}:player:${playerId}:tier:${tier.tier}:reward:${rewardIndex}`; }
  async function deliveryId(playerId, tier, rewardIndex) { return Contract.deliveryRequestId({ seasonId: state.season.id, playerId, tier: tier.tier, rewardIndex }); }
  async function deliveryKeys(playerId, tier, rewardIndex) { return { current: await deliveryId(playerId, tier, rewardIndex), legacy: legacyDeliveryId(playerId, tier, rewardIndex) }; }
  function storedDelivery(keys) { return state.progress.deliveries[keys.current] ? { requestId: keys.current, delivery: state.progress.deliveries[keys.current] } : state.progress.deliveries[keys.legacy] ? { requestId: keys.legacy, delivery: state.progress.deliveries[keys.legacy] } : null; }
  function safeTiers(tiers) { if (!Array.isArray(tiers)) return DEFAULT_TIERS; return tiers.map((tier) => ({ ...tier, rewards: Array.isArray(tier.rewards) ? tier.rewards.filter((reward) => reward?.id !== "WaterBottle_1") : [] })); }

  async function ensureStorage() { const existing = await get(store.active); if (existing?.id) return existing; await put(store.active, DEFAULT_SEASON); await Promise.all([put(store.season(DEFAULT_SEASON.id), DEFAULT_SEASON), put(store.tiers(DEFAULT_SEASON.id), DEFAULT_TIERS), put(store.categories(DEFAULT_SEASON.id), DEFAULT_CATEGORIES)]); log("Created the default season in addon storage."); return DEFAULT_SEASON; }
  async function loadSeason() { state.season = await ensureStorage(); state.tiers = safeTiers((await get(store.tiers(state.season.id))) || DEFAULT_TIERS); state.categories = (await get(store.categories(state.season.id))) || DEFAULT_CATEGORIES; $("#seasonName").textContent = state.season.name; $("#seasonDates").textContent = formatDates(state.season); if ($("#seasonStart")) $("#seasonStart").value = datetime(state.season.startsAt); if ($("#seasonEnd")) $("#seasonEnd").value = datetime(state.season.endsAt); }
  async function loadPlayers() { const result = await request("players.summary.list"); if (!Array.isArray(result?.rows)) throw new Error("players.summary.list did not return result.rows."); state.players = result.rows.filter((row) => typeof row.playerId === "string" && row.playerId); const select = $("#playerSelect"), old = select.value; select.replaceChildren(); state.players.forEach((row) => { const option = document.createElement("option"); option.value = row.playerId; option.textContent = name(row); select.append(option); }); if (state.players.some((row) => row.playerId === old)) select.value = old; log(`Loaded ${state.players.length} player(s).`); }
  async function loadPlayer() { const player = currentPlayer(); if (!player || !state.season) return; if (!Contract) throw new Error("FluffyFox Ascension bridge contract helper is unavailable."); state.progression = Contract.normalizeProgression(await request("players.progression.get", { playerId: player.playerId })); state.progress = (await get(store.progress(state.season.id, player.playerId))) || { deliveries: {}, completedTiers: [] }; await reconcileDeliveries(player); render(); }

  function render() {
    const level = value({ id: "level" });
    const unlocked = state.tiers.filter((tier) => eligible(tier));
    const next = state.tiers.find((tier) => Number(tier.requirement) > level);
    const cap = next ? Number(next.requirement) : Math.max(...state.tiers.map((tier) => Number(tier.requirement)), 1);
    const percent = Math.min(100, Math.round((level / cap) * 100));
    $("#currentTier").textContent = `${unlocked.at(-1)?.tier || 0} / ${state.tiers.length}`; $("#playerLevel").textContent = level || "—"; $("#xpValue").textContent = `${state.progression.xp || 0} XP · Level ${level}`; $("#xpStat").textContent = `${state.progression.xp || 0} XP`; $("#xpBar").style.width = `${percent}%`; $("#seasonProgressPercent").textContent = `${percent}%`; $("#xpNext").textContent = next ? `Level ${next.requirement} unlocks Tier ${next.tier}` : "All listed tiers unlocked"; $("#claimedValue").textContent = String(state.progress.completedTiers.length);
    const status = seasonStatus(); $("#automationStatus").textContent = status === "active" ? "Refresh checks the selected player" : status === "upcoming" ? "Claims open when the season starts" : "This season has ended";
    const root = $("#tiers"); root.replaceChildren();
    for (const tier of state.tiers) { const card = document.createElement("article"), unlockedTier = eligible(tier), complete = done(tier), hasRewards = tier.rewards.length > 0; card.className = `tier ${unlockedTier ? "unlocked" : "locked"}`; const rewardText = hasRewards ? tier.rewards.map((reward) => `${reward.label || reward.id} ×${reward.amount}`).join(", ") : "No reviewed reward configured"; card.innerHTML = `<span class="tier-number">${tier.tier}</span><div><h3>${escape(tier.title)}</h3><p>${escape(tier.category)} · ${tier.requirement} required · ${escape(rewardText)}</p></div>`; const button = document.createElement("button"); button.type = "button"; button.disabled = !currentPlayer() || !unlockedTier || complete || !hasRewards; button.textContent = complete ? "Delivered" : !hasRewards ? "Reward setup required" : status === "upcoming" ? "Season not started" : status === "ended" ? "Season ended" : unlockedTier ? "Deliver rewards" : "Locked"; button.onclick = () => deliver(tier); card.append(button); root.append(card); }
    const categories = $("#categories"); if (!categories) return; categories.replaceChildren(); state.categories.forEach((category) => { const supported = category.enabled && enabled(category.progressionKey), card = document.createElement("article"); card.className = "category"; card.innerHTML = `<strong>${escape(category.label)}</strong><span class="category-state ${supported ? "available" : "pending"}">${supported ? `Available · ${value(category)}` : escape(category.reason || "Not verified by the core")}</span>`; categories.append(card); });
  }
  async function deliver(tier) {
    const player = currentPlayer(); if (!player || !tier.rewards.length || done(tier)) return;
    if (seasonStatus() !== "active") { log("Reward claims are unavailable outside the active season.", true); render(); return; }
    if (!eligible(tier)) return;
    let delivered = true;
    try {
      for (const [index, reward] of tier.rewards.entries()) {
        const keys = await deliveryKeys(player.playerId, tier, index);
        const existing = storedDelivery(keys);
        if (existing) {
          if (existing.delivery.status === "delivered") await notifyDelivered(player, existing.requestId, reward);
          else { delivered = false; log(existing.delivery.status === "pending" ? `Tier ${tier.tier} has a legacy or current reward queued for delivery.` : `Tier ${tier.tier} has a reward requiring manual delivery review.`, existing.delivery.status === "uncertain"); }
          continue;
        }
        const result = await request("rewards.deliver", Contract.rewardDeliveryPayload({ requestId: keys.current, playerId: player.playerId, reward }));
        const status = result?.status || "uncertain";
        state.progress.deliveries[keys.current] = { status, updatedAt: new Date().toISOString() };
        await put(store.progress(state.season.id, player.playerId), state.progress);
        if (status === "delivered") await notifyDelivered(player, keys.current, reward);
        else { delivered = false; log(status === "pending" ? `Tier ${tier.tier} is queued for delivery.` : `Tier ${tier.tier} needs manual delivery review.`, status === "uncertain"); }
      }
      if (delivered) { state.progress.completedTiers = [...new Set([...state.progress.completedTiers, tier.tier])]; await put(store.progress(state.season.id, player.playerId), state.progress); log(`Tier ${tier.tier} delivered to ${name(player)}.`); }
    } catch (error) {
      try { await put(store.progress(state.season.id, player.playerId), state.progress); } catch (saveError) { log(`Could not persist delivery progress: ${saveError.message}`, true); }
      log(`Tier ${tier.tier} delivery failed: ${error.message}`, true);
    }
    render();
  }
  async function notifyDelivered(player, requestId, reward) { const delivery = state.progress.deliveries[requestId]; if (delivery.messageSubmitted) return; try { await request("players.message.send", { requestId: `${requestId}:message`, playerId: player.playerId, message: `FluffyFox Ascension reward delivered: ${reward.label || reward.id}.` }); delivery.messageSubmitted = true; } catch (error) { log(`Reward was delivered, but its private notification could not be submitted: ${error.message}`); } }
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
      const records = await Promise.all(tier.rewards.map(async (reward, index) => ({ reward, existing: storedDelivery(await deliveryKeys(player.playerId, tier, index)) })));
      if (!records.length || !records.every(({ existing }) => existing?.delivery.status === "delivered")) continue;
      for (const { reward, existing } of records) await notifyDelivered(player, existing.requestId, reward);
      state.progress.completedTiers.push(tier.tier); changed = true; log(`Queued Tier ${tier.tier} reward delivery completed for ${name(player)}.`);
    }
    if (changed) await put(store.progress(state.season.id, player.playerId), state.progress);
  }
  async function saveDates() { if (!state.season) return; state.season.startsAt = $("#seasonStart")?.value ? new Date($("#seasonStart").value).toISOString() : null; state.season.endsAt = $("#seasonEnd")?.value ? new Date($("#seasonEnd").value).toISOString() : null; if (state.season.startsAt && state.season.endsAt && Date.parse(state.season.endsAt) <= Date.parse(state.season.startsAt)) throw new Error("Season end must be after its start."); await put(store.active, state.season); await put(store.season(state.season.id), state.season); $("#seasonDates").textContent = formatDates(state.season); log("Season dates saved in addon storage."); render(); }
  function applyAppearance() { const opacity = Math.min(96, Math.max(35, Number($("#backgroundOpacity").value))), blur = Math.min(28, Math.max(4, Number($("#backgroundBlur").value))), theme = THEMES[$("#colorPreset").value] || THEMES.gold, root = document.documentElement; root.style.setProperty("--ui-opacity", (opacity / 100).toFixed(2)); root.style.setProperty("--ui-blur", `${blur}px`); ["--text", "--muted", "--accent", "--accent-dark", "--accent-rgb"].forEach((key, index) => root.style.setProperty(key, theme[index])); $("#opacityValue").textContent = `${opacity}%`; $("#blurValue").textContent = `${blur}px`; localStorage.setItem("fluffyfox-ui-opacity", String(opacity)); localStorage.setItem("fluffyfox-ui-blur", String(blur)); localStorage.setItem("fluffyfox-text-theme", $("#colorPreset").value); }
  function loadAppearance() { const opacity = localStorage.getItem("fluffyfox-ui-opacity"), blur = localStorage.getItem("fluffyfox-ui-blur"), theme = localStorage.getItem("fluffyfox-text-theme"); if (opacity) $("#backgroundOpacity").value = opacity; if (blur) $("#backgroundBlur").value = blur; if (theme && THEMES[theme]) $("#colorPreset").value = theme; applyAppearance(); }
  async function refresh() { if (state.loading) return; state.loading = true; $("#refresh").disabled = true; try { await loadPlayers(); await loadSeason(); await loadPlayer(); } catch (error) { log(error.message, true); } finally { state.loading = false; $("#refresh").disabled = false; } }
  function autoRefresh() { const seconds = Number($("#refreshInterval")?.value || 0); if (state.timer) clearInterval(state.timer); state.timer = seconds ? setInterval(refresh, seconds * 1000) : null; }
  function escape(value) { return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[c]); }
  function formatDates(season) { return `${season.startsAt ? new Date(season.startsAt).toLocaleDateString() : "Open"} — ${season.endsAt ? new Date(season.endsAt).toLocaleDateString() : "No end date"}`; }
  function datetime(value) { if (!value) return ""; const date = new Date(value), p = (v) => String(v).padStart(2, "0"); return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`; }
  document.addEventListener("DOMContentLoaded", () => { $("#initialize")?.addEventListener("click", async () => { await ensureStorage(); await refresh(); }); $("#refresh")?.addEventListener("click", refresh); $("#playerSelect")?.addEventListener("change", loadPlayer); $("#syncLevel")?.addEventListener("click", loadPlayer); $("#saveSeasonDates")?.addEventListener("click", () => saveDates().catch((error) => log(error.message, true))); $("#refreshInterval")?.addEventListener("change", autoRefresh); ["#backgroundOpacity", "#backgroundBlur"].forEach((selector) => $(selector)?.addEventListener("input", applyAppearance)); $("#colorPreset")?.addEventListener("change", applyAppearance); loadAppearance(); autoRefresh(); log(`FluffyFox Ascension v${VERSION} loaded.`); refresh(); });
})();
