const API = 'https://api.gridirondata.com/api/v1';
const json = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) });
export async function handler(event) {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Use GET.' });
  const key = process.env.GRIDIRON_DATA_API_KEY;
  if (!key) return json(503, { error: 'Set GRIDIRON_DATA_API_KEY in Netlify environment variables, then redeploy.' });
  const q = event.queryStringParameters || {};
  const name = String(q.player || '').trim();
  const position = String(q.position || '').trim().toUpperCase();
  const opponent = String(q.opponent || '').trim().toUpperCase();
  if (!name || !['QB','RB','WR','TE','K','DST'].includes(position)) return json(400, { error: 'Enter a player name and valid position.' });
  try {
    const url = `${API}/players?name=${encodeURIComponent(name)}&position=${encodeURIComponent(position)}`;
    const r = await fetch(url, { headers: { 'x-api-key': key }, signal: AbortSignal.timeout(12000) });
    const raw = await r.json().catch(() => ({}));
    if (!r.ok) return json(r.status, { error: raw.error || raw.message || `GridIron Data returned HTTP ${r.status}.`, reason: raw.reason || null, upgrade_url: raw.upgrade_url || null });
    const p = raw.player || raw.data || raw;
    const vs = p.vs_opponent || raw.vs_opponent || {};
    const opp = opponent ? (vs[opponent] || vs[({LA:'LAR',LAR:'LA',JAC:'JAX',JAX:'JAC',WSH:'WAS',WAS:'WSH'})[opponent]] || null) : null;
    return json(200, {
      player: p.player_name || p.name || name,
      player_id: p.player_id || `${name}#${position}`,
      position: p.position || position,
      team: p.team || null,
      injury_status: p.injury_status || p.status || p.availability || 'Unknown',
      injury_updated_at: p.injury_updated_at || p.updated_at || null,
      opponent,
      opponent_history: opp ? { games_played: opp.games_played ?? null, avg_actual: opp.avg_actual ?? null, avg_projected: opp.avg_projected ?? null, avg_deviation: opp.avg_deviation ?? null, by_season: opp.by_season || null } : null,
      source: 'GridIron Data player profile',
      note: 'Injury status is provider-reported and may not reflect the latest official inactive announcement. Opponent history shown here is fantasy-point context, not a direct yards/receptions adjustment.'
    });
  } catch (e) {
    return json(502, { error: `Could not reach GridIron Data: ${e.message}` });
  }
}
