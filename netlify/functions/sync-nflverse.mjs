import { getStore } from "@netlify/blobs";

const STORE_NAME = "surj-intel-shared-csv";
const STORE_KEY = "published-player-stats";
const SEASONS = [2023, 2024, 2025, 2026];
const MAX_TEXT_BYTES = 8 * 1024 * 1024;

// Small RFC-4180-compatible CSV parser/serializer. We retain only fields used by
// SURJ INTEL so the shared store stays compact and never receives market data.
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ""; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => String(v).trim() !== ""));
}
function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function preserveUnavailableSeasons(freshCsv, savedCsv, fetchedSeasons) {
  if (!savedCsv || typeof savedCsv !== "string") return freshCsv;
  const fresh = parseCsv(freshCsv), saved = parseCsv(savedCsv);
  if (fresh.length < 2 || saved.length < 2) return freshCsv;
  const freshHeaders = fresh[0].map(h => String(h).trim().toLowerCase());
  const savedHeaders = saved[0].map(h => String(h).trim().toLowerCase());
  const freshSeason = freshHeaders.indexOf("season"), savedSeason = savedHeaders.indexOf("season");
  if (freshSeason < 0 || savedSeason < 0) return freshCsv;
  const fetched = new Set(fetchedSeasons.map(Number));
  const headers = [...new Set([...freshHeaders, ...savedHeaders])];
  const mapRow = (row, sourceHeaders) => headers.map(h => {
    const i = sourceHeaders.indexOf(h);
    return i >= 0 ? (row[i] ?? "") : "";
  });
  const out = [headers, ...fresh.slice(1).map(r => mapRow(r, freshHeaders))];
  for (const row of saved.slice(1)) {
    const season = Number(row[savedSeason]);
    if (Number.isFinite(season) && !fetched.has(season)) out.push(mapRow(row, savedHeaders));
  }
  const csv = out.map(row => row.map(csvEscape).join(",")).join("\n");
  if (new TextEncoder().encode(csv).byteLength > MAX_TEXT_BYTES) {
    throw new Error("Merged dataset exceeds storage safety limit; retaining the previously saved dataset.");
  }
  return csv;
}

function compactCsv(text, kind) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error(`${kind}: empty CSV`);
  const headers = rows[0].map(h => String(h).trim().toLowerCase());
  const seasonIx = headers.indexOf("season");
  const weekIx = headers.indexOf("week");
  if (seasonIx < 0 || weekIx < 0) throw new Error(`${kind}: season/week columns missing`);
  const wanted = kind === "playerStats"
    ? ["player_display_name", "player_name", "team", "position", "season", "week", "opponent", "opponent_team", "receiving_yards", "receptions", "targets", "air_yards", "yards_after_catch", "receiving_air_yards", "receiving_yards_after_catch", "receiving_epa", "rushing_epa", "passing_epa", "target_share", "air_yards_share", "racr", "adot", "receiving_first_downs", "rushing_yards", "carries", "rushing_first_downs", "passing_yards", "passing_attempts", "completions", "passing_tds", "passing_interceptions", "rushing_tds", "receiving_tds"]
    : ["player", "player_name", "player_display_name", "pfr_player_name", "team", "season", "week", "offense_pct", "offense_percent", "offense_snap_pct", "offense_snap_percentage", "offense_snaps", "offense_snap_count"];
  const selected = wanted.map(k => headers.indexOf(k)).map((ix, j) => ({ ix, key: wanted[j] })).filter(x => x.ix >= 0);
  if (!selected.some(x => x.key === "season") || !selected.some(x => x.key === "week")) throw new Error(`${kind}: required columns missing`);
  const out = [selected.map(x => x.key)];
  for (const row of rows.slice(1)) {
    const season = Number(row[seasonIx]);
    const week = Number(row[weekIx]);
    if (!SEASONS.includes(season) || !Number.isFinite(week) || week < 1) continue;
    out.push(selected.map(x => row[x.ix] ?? ""));
  }
  if (out.length < 2) throw new Error(`${kind}: no valid 2023–2026 rows`);
  return out.map(row => row.map(csvEscape).join(",")).join("\n");
}
async function fetchSeason(kind, season) {
  const url = kind === "playerStats"
    ? `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${season}.csv`
    : `https://github.com/nflverse/nflverse-data/releases/download/snap_counts/snap_counts_${season}.csv`;
  const response = await fetch(url, { headers: { accept: "text/csv,*/*" }, signal: AbortSignal.timeout(18000) });
  if (!response.ok) throw new Error(`${kind} ${season}: source returned ${response.status}`);
  return response.text();
}
async function collect(kind) {
  const downloads = await Promise.allSettled(SEASONS.map(season => fetchSeason(kind, season).then(csv => ({ season, csv }))));
  const good = downloads.filter(x => x.status === "fulfilled").map(x => x.value);
  if (!good.length) throw new Error(`${kind}: no season downloads succeeded`);
  const compacted = good.map(x => compactCsv(x.csv, kind));
  const parsed = compacted.map(parseCsv);
  const header = [...new Set(parsed.flatMap(data => data[0]))];
  const rows = [header];
  for (const data of parsed) {
    const indexes = header.map(h => data[0].indexOf(h));
    for (const row of data.slice(1)) rows.push(indexes.map(ix => ix >= 0 ? row[ix] ?? "" : ""));
  }
  const csv = rows.map(row => row.map(csvEscape).join(",")).join("\n");
  if (new TextEncoder().encode(csv).byteLength > MAX_TEXT_BYTES) throw new Error(`${kind}: compacted CSV exceeds ${MAX_TEXT_BYTES} bytes`);
  const failures = downloads.flatMap((x, i) => x.status === "rejected"
    ? [{ season: SEASONS[i], message: String(x.reason?.message || x.reason) }]
    : []);
  return { csv, seasons: good.map(x => x.season), rows: rows.length - 1, failures };
}

export default async () => {
  const store = getStore(STORE_NAME);
  const saved = await store.get(STORE_KEY, { type: "json" }) || {};
  const next = {
    playerStatsCsv: typeof saved.playerStatsCsv === "string" ? saved.playerStatsCsv : "",
    snapCountsCsv: typeof saved.snapCountsCsv === "string" ? saved.snapCountsCsv : "",
    updatedAt: saved.updatedAt || null,
    autoSync: saved.autoSync || null
  };
  const result = { startedAt: new Date().toISOString(), updated: [], errors: [] };
  const syncResults = await Promise.allSettled([collect("playerStats"), collect("snapCounts")]);
  for (let i = 0; i < syncResults.length; i++) {
    const kind = i === 0 ? "playerStats" : "snapCounts";
    const outcome = syncResults[i];
    if (outcome.status === "fulfilled") {
      const data = outcome.value;
      if (kind === "playerStats") next.playerStatsCsv = preserveUnavailableSeasons(data.csv, next.playerStatsCsv, data.seasons);
      else next.snapCountsCsv = preserveUnavailableSeasons(data.csv, next.snapCountsCsv, data.seasons);
      data.rows = Math.max(0, parseCsv(kind === "playerStats" ? next.playerStatsCsv : next.snapCountsCsv).length - 1);
      result.updated.push({ kind, seasons: data.seasons, retainedUnavailableSeasons: data.failures.map(x => x.season), rows: data.rows });
      for (const failure of data.failures) result.errors.push({ kind, season: failure.season, message: failure.message, retainedPreviousSeasonData: true });
    } else {
      result.errors.push({ kind, message: String(outcome.reason?.message || outcome.reason) });
      console.error("nflverse sync failed", kind, outcome.reason);
    }
  }
  // Do not replace a healthy dataset with an empty partial sync. Existing data is
  // retained per-kind when that kind's fetch/validation fails.
  if (result.updated.length) {
    next.updatedAt = new Date().toISOString();
    next.autoSync = { at: next.updatedAt, source: "nflverse releases", result };
    await store.setJSON(STORE_KEY, next);
  }
  console.log("SURJ INTEL nflverse sync result", JSON.stringify(result));
  return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
};

export const config = { schedule: "0 */6 * * *" };
