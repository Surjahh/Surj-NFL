import { getStore } from "@netlify/blobs";
export default async () => {
  const key = Netlify.env.get("PROP_LINE_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({
      error: "PROP_LINE_API_KEY is not set in Netlify environment variables.",
      props: []
    }), { status: 503, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }
  try {
    const url = new URL("https://api.prop-line.com/v1/sports/americanfootball_nfl/odds");
    const markets = [
      "h2h","spreads","totals","player_pass_yds","player_pass_tds",
      "player_pass_completions","player_rush_yds","player_rush_tds",
      "player_reception_yds","player_receptions","player_reception_tds",
      "player_rush_reception_yds","player_anytime_td","player_longest_completion",
      "player_reception_longest"
    ];
    url.searchParams.set("markets", markets.join(","));
    url.searchParams.set("apiKey", key);
    const response = await fetch(url, { headers: { "accept": "application/json" } });
    const body = await response.text();
    if (!response.ok) {
      return new Response(JSON.stringify({
        error: `PropLine returned HTTP ${response.status}. Check the API key, quota, and current NFL market coverage.`,
        detail: body.slice(0, 400), props: []
      }), { status: response.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
    }
    const data = JSON.parse(body);
    const events = Array.isArray(data) ? data : (data.events || data.data || []);
    const props = [];
    for (const ev of events) {
      const matchup = `${ev.away_team || "Away"} @ ${ev.home_team || "Home"}`;
      for (const book of (ev.bookmakers || [])) {
        for (const market of (book.markets || [])) {
          if (!market.key || !market.key.startsWith("player_")) continue;
          const grouped = new Map();
          for (const o of (market.outcomes || [])) {
            const player = o.description || o.participant || o.player || o.name || "Unknown player";
            const point = o.point ?? null;
            const k = `${player}|${point}`;
            if (!grouped.has(k)) grouped.set(k, { player, point, over: null, under: null });
            const row = grouped.get(k);
            if (/over|yes/i.test(o.name || "")) row.over = o.price;
            if (/under|no/i.test(o.name || "")) row.under = o.price;
          }
          for (const row of grouped.values()) {
            props.push({
              event_id: ev.id, matchup, player: row.player,
              market: market.key, point: row.point, over: row.over, under: row.under,
              book: book.title || book.key || "Book",
              updated: market.last_update || book.last_update || ""
            });
          }
        }
      }
    }
    const marketNames = {
      player_pass_yds:"Passing yards", player_pass_tds:"Pass TDs",
      player_pass_completions:"Completions", player_rush_yds:"Rushing yards",
      player_rush_tds:"Rush TDs", player_reception_yds:"Receiving yards",
      player_receptions:"Receptions", player_reception_tds:"Receiving TDs",
      player_rush_reception_yds:"Rush + receiving yards", player_anytime_td:"Anytime TD",
      player_longest_completion:"Longest completion", player_reception_longest:"Longest reception"
    };
    for (const p of props) p.market = marketNames[p.market] || p.market;
    const retrievedAt = new Date().toISOString();
    // Player-prop market snapshots are stored separately from shared player statistics.
    try { await getStore("surj-intel-market-data").setJSON("player-props-latest", { retrieved_at: retrievedAt, source: "PropLine", props }); }
    catch (storageError) { console.error("Market snapshot storage unavailable:", storageError); }
    return new Response(JSON.stringify({
      props,
      events_count: events.length,
      source: "PropLine",
      retrieved_at: retrievedAt,
      remaining_requests: response.headers.get("x-daily-remaining"),
      note: "Free tier advertises 1,000 requests/day. NFL player-prop coverage varies by sportsbook and market; a successful API response can contain no NFL props."
    }), { status: 200, headers: { "content-type": "application/json", "cache-control": "public, max-age=60" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Could not reach PropLine.", detail: String(err), props: [] }), {
      status: 502, headers: { "content-type": "application/json", "cache-control": "no-store" }
    });
  }
};