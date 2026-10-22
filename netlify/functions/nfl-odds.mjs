export default async (request, context) => {
  const key = Netlify.env.get("ODDS_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({
      error: "ODDS_API_KEY is not set in Netlify environment variables.",
      games: []
    }), { status: 503, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }
  try {
    const url = new URL("https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/");
    url.searchParams.set("regions", "us");
    url.searchParams.set("markets", "h2h");
    url.searchParams.set("oddsFormat", "american");
    url.searchParams.set("dateFormat", "iso");
    url.searchParams.set("apiKey", key);
    const response = await fetch(url, { headers: { "accept": "application/json" } });
    const text = await response.text();
    if (!response.ok) {
      return new Response(JSON.stringify({
        error: `Odds provider returned HTTP ${response.status}. Check your key, quota, and plan.`,
        detail: text.slice(0, 500),
        games: []
      }), { status: response.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
    }
    const raw = JSON.parse(text);
    const games = raw.map(g => ({
      id: g.id,
      sport_key: g.sport_key,
      commence_time: g.commence_time,
      home_team: g.home_team,
      away_team: g.away_team,
      bookmakers: (g.bookmakers || []).map(b => ({
        key: b.key, title: b.title, last_update: b.last_update,
        markets: (b.markets || []).filter(m => ["h2h", "spreads", "totals"].includes(m.key))
      }))
    }));
    return new Response(JSON.stringify({
      games,
      source: "The Odds API",
      retrieved_at: new Date().toISOString(),
      remaining_requests: response.headers.get("x-requests-remaining"),
      note: "Free-tier access varies. This function requests game moneylines only to maximize compatibility."
    }), { status: 200, headers: { "content-type": "application/json", "cache-control": "public, max-age=60" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Could not reach the odds provider.", detail: String(err), games: [] }), {
      status: 502, headers: { "content-type": "application/json", "cache-control": "no-store" }
    });
  }
};