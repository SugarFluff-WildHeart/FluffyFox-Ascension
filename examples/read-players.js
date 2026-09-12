async function loadPlayers() {
  const result = await window.DuneAddon.request("players.summary.list");
  return result.rows || [];
}
