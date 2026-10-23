# SURJ INTEL v18.3.1 · Repair build

This repair build preserves the v18.3 dashboard and fixes the missing odds helpers, Best Props Finder probability calculation, Game Center count rendering, and refresh-button wiring. It also hardens automatic NFL data sync so a temporarily unavailable season file does not erase that season's last successfully saved data.

## Deploy

1. Download and extract the ZIP.
2. Deploy the extracted folder to the existing Netlify site. The `netlify.toml` publishes the project root and uses `netlify/functions` for functions.
3. Keep existing environment variables configured in Netlify. Never put keys in browser code or commit them to the ZIP.
4. After deployment, open the site and click **Refresh player data**. Confirm that player stats, game odds, live props, and calibration status each report their own connection state.
5. Test a projection from imported/shared player stats, then test CSV import and the Best Props Finder. If a provider is not configured, that panel should show a setup message rather than breaking unrelated features.

## Optional Netlify environment variables

- `ODDS_API_KEY`: game moneyline/spread/total feed from The Odds API.
- `PROP_LINE_API_KEY`: live NFL player props from PropLine, subject to current provider coverage and quota.
- `GRIDIRON_DATA_API_KEY`: provider-based player availability/context lookup.
- `SURJ_CSV_UPLOAD_TOKEN`: authorizes publishing player-stat and snap-count CSVs to shared storage.

The website can still load without optional API keys. Provider-backed panels will display their own setup or unavailable status. Netlify Blobs must be available for shared stats, market snapshots, and calibration history.

## Data and storage boundaries

- `surj-intel-shared-csv`: player stats and snap counts only.
- `surj-intel-market-data`: separate latest game-odds and player-prop snapshots.
- `surj-intel-calibration`: saved predictions, grading results, and calibration coefficients.
- Browser local storage `surj-intel-v18-projections`: the user's saved projection board.

Sportsbook prices are not written into shared player-stat storage. A CSV imported from a sportsbook stays in the browser session. Saved projection exports include projection fields and evidence, not sportsbook lines or odds.

## Automatic NFL data sync

`sync-nflverse.mjs` runs every six hours (UTC) and requests the nflverse `stats_player_week_YEAR.csv` and `snap_counts_YEAR.csv` release assets for 2023–2026. It compacts the fields used by the dashboard. If a specific season's asset is unavailable, the last saved rows for that season are retained while successfully downloaded seasons are refreshed. The sync result records any unavailable season files.

## Adaptive projections and calibration

- Projection estimates use player-game history and available usage/context fields, with a conservative ridge-regression blend when enough prior examples exist and a baseline fallback otherwise.
- Snap counts inform playing-time trend adjustments when player names match.
- Projection intervals are estimates, not guarantees. Validate forecasts against future games and do not interpret market discrepancies as guaranteed profit.
- Weekly grading runs Wednesdays at 12:00 UTC when final player stats are available. It supports the markets documented in the calibration function; unsupported or missing results remain ungraded.

## Repair verification

This package was checked for JavaScript syntax, missing static DOM IDs, startup execution, shared CSV and snap-count import, full refresh orchestration, odds rendering, live-prop rendering, and Best Props Finder execution using mock provider responses. Live API keys, Netlify deployment, provider availability, and real-world data freshness still require verification in the deployed site.
