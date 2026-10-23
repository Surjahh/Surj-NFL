# SURJ INTEL v18 · Projection-Only Dashboard

## What changed from v17

- Built from the uploaded `surj-intel-stealth-titanium-v17.zip` package.
- Sportsbook line and odds panels are hidden from all visible dashboard surfaces: Game Center, Moneyline Intelligence, Live Props, sportsbook CSV import, and the old line-based Best Props Finder.
- The research board is now an **Adaptive Projection Board** that stores player, matchup, market, projection type, projected mean, standard deviation, sample size, and evidence notes.
- Projection CSV exports contain projection data only. They do not include sportsbook lines or prices.
- Existing game-odds and player-prop provider functions remain available for optional future value analysis.
- Successful provider responses are snapshotted to the separate Netlify Blobs store `surj-intel-market-data`, using `game-odds-latest` and `player-props-latest` keys.
- A Netlify Scheduled Function (`sync-nflverse`) refreshes player stats and snap counts from official nflverse release assets every six hours, retaining 2023–2026 rows and only the columns needed for projections. If a source fetch fails validation, the last good dataset for that source is retained.
- Shared player stats and snap counts remain isolated in `surj-intel-shared-csv`. Odds snapshots are never written to that store.
- The dashboard's **Refresh data** action can refresh the separate server-side market snapshots for optional future value analysis, but the odds surfaces are hidden from the dashboard.

## Deploy

1. Download and unzip this package.
2. Deploy the extracted folder to Netlify, preserving the site's existing environment variables.
3. Keep `ODDS_API_KEY` and `PROP_LINE_API_KEY` set only in Netlify environment variables if optional market snapshots should continue to refresh.
4. Keep `SURJ_CSV_UPLOAD_TOKEN` set if shared player-stat publishing is enabled.
5. Confirm the shared player stats and snap counts load. The scheduled sync runs on published Netlify deploys; use Netlify Functions → `sync-nflverse` → Run now to test it immediately. Build a projection and save it to the board. Auto-generated saved projections refresh when new shared data is loaded; manually entered projections remain manual.

## Storage boundaries

- `surj-intel-shared-csv`: player statistics and snap counts only.
- `surj-intel-market-data`: optional latest game-odds and player-prop snapshots, isolated from shared stats.
- Browser local storage `surj-intel-v18-projections`: saved projection-only board. Line and odds fields are not copied into this store.

## Automatic data refresh

- `sync-nflverse.mjs` runs every six hours on Netlify Scheduled Functions. Netlify scheduled functions run in UTC and only execute on published deploys.
- It fetches the official `stats_player_week_YEAR.csv` and `snap_counts_YEAR.csv` release assets for 2023–2026, validates required columns, compacts the fields, and writes only player statistics and snap counts to `surj-intel-shared-csv`.
- Sportsbook data remains in the separate `surj-intel-market-data` store; the scheduled NFL data sync never reads or writes market odds.

## Adaptive projection engine v1

- Uses multi-season player-week data from 2023–2026 when present in the imported nflverse CSV. Player histories are grouped by player, team, and season so season transitions do not become one continuous player log.
- Trains a global ridge-regression model on lagged features (season mean, recent mean, EWMA, last result, short trend, variability, and sample size). Every training row uses only games before its target game.
- Blends the regression forecast conservatively with a recency-weighted shrinkage baseline. If training history is insufficient, it falls back to the baseline and labels that status.
- Tracks training example counts, residual error, a time-ordered holdout diagnostic, and a rolling walk-forward comparison against the baseline.
- Projection intervals are approximate uncertainty ranges, not sportsbook-line probabilities. Model quality must be assessed against future games; in-sample residuals can be optimistic.
- The CSV import supports additional available fields such as targets, air yards, yards after catch, EPA, target share, air-yards share, carries, passing attempts, and touchdowns. Features are used only when present; route participation and separation require another provider and are not inferred.
- Market snapshot writes are best-effort. A storage failure is logged but does not block a provider response.
- Odds providers require valid server-side keys, sufficient API quota, and provider coverage for the requested markets.
- Do not commit API keys or upload tokens to the repository.


## v18.2 update: sportsbook panels restored

- Restored Game Center live odds, Moneyline Intelligence, Live NFL Player Props, sportsbook CSV import, and Best Props Finder dashboard panels.
- Restored line/odds controls in the manual projection research form.
- Kept odds integrations and market snapshots separate from shared player statistics and snap counts.
- Adaptive projection inputs remain player-performance/context based; sportsbook lines are available for separate comparison and optional value analysis.


## v18.3 weekly grading and calibration

- New `/.netlify/functions/calibration` endpoint stores pregame projection records in a dedicated `surj-intel-calibration` Blobs store, separate from shared player stats and sportsbook market storage.
- Saved projections with target season/week are submitted to the server-side ledger. A target week is required for automatic grading.
- New `weekly-calibration` scheduled function runs Wednesdays at 12:00 UTC, after the normal nflverse sync cadence, and grades predictions when final weekly player stats become available.
- Supported grading metrics: receiving yards, receptions, rushing yards, passing yards, completions, passing TDs, rushing TDs, receiving TDs, rush + receiving yards, and anytime touchdown.
- Weekly diagnostics include MAE, Brier score, 10-bin reliability data, sample sizes, and per-market Platt calibration when at least 50 non-push graded outcomes with both classes are available.
- The browser loads stored per-market Platt calibrators and applies them to new over probabilities when a market has at least 50 graded non-push examples with both outcomes. Raw probabilities are retained separately for future recalibration. Markets without a validated calibrator use the uncalibrated estimate and should be labeled accordingly. Calibration remains a statistical adjustment, not proof of profitable betting.
- Predictions without a target week, unsupported markets (such as longest reception), missing player rows, or unavailable final stats remain ungraded rather than being assigned a guessed outcome.
- Sportsbook lines are optional inputs for evaluating over/under probabilities, but they are not mixed into shared player-stat storage.
- Deployment requires Netlify Blobs availability. Weekly grading requires the scheduled nflverse sync and final stat rows to be available in the shared store.
