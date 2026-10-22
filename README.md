# SURJ INTEL v10: NFL Control Center

This release refreshes the dashboard with a premium navy-and-white sports broadcast look while preserving the existing projection, live game odds, live player props, Best Props Finder, CSV imports, snap-share controls, historical backtest, injury/context lookup, team-defense adjustment, export, and local prop board.

## Visual redesign
- Navy masthead, bold all-caps sports typography, white analytics panels, blue accent rules, and gold highlight accents.
- Dashboard navigation for Game Center, Live Props, Best Props, Player Stats, Research Board, and Matchup Tools.
- Game odds render as responsive matchup strips with team-abbreviation monogram badges. These are text marks, not copied official team logos. Use official logo assets only when you have permission or a suitable license.
- Responsive tables and controls for mobile and desktop.

# SURJ INTEL Live Starter

Mobile-friendly NFL research dashboard with:
- A Netlify serverless function for The Odds API game lines, plus a PropLine player-props function using a server-side secret.
- Live NFL game moneylines when a valid provider key/plan supports them.
- Manual player-prop entry with estimated probability, break-even probability, probability gap, and EV per $100.
- Local browser storage and CSV export.

## Live player props under $25/month
The included `live-props.mjs` function uses PropLine's API, whose published pricing page advertises a free tier with 1,000 requests/day and 60+ player prop markets. NFL coverage varies by bookmaker and market, and its docs note that major US sportsbook NFL props may be seasonal/not available on every book. Create a free key at https://prop-line.com/ and set `PROP_LINE_API_KEY` in Netlify environment variables. Test that your requested NFL props actually return before relying on the feed. No subscription is required to test the free tier. The app also retains manual prop entry as a fallback.

## Easiest deployment (phone-accessible website)
1. Create a free account at https://github.com/ and create a new repository named `surj-intel`.
2. Upload the contents of this folder to the repository (not the ZIP file itself).
3. Create a free account at https://www.netlify.com/ and choose **Add new site → Import an existing project**.
4. Connect GitHub and select `surj-intel`. Netlify should detect `netlify.toml`. Deploy.
5. Sign up for The Odds API at https://the-odds-api.com/ and copy the API key.
6. In Netlify, open **Site configuration → Environment variables** and add `PROP_LINE_API_KEY` with your private PropLine key. You may also keep `ODDS_API_KEY` if you want the game-moneyline function to work.
7. Trigger a redeploy. Open your Netlify site URL on your phone and tap **Refresh live props**. The game odds button uses the separate `ODDS_API_KEY` and remains independent.

## Keep the key safe
Never put the key in `index.html`, commit it to GitHub, or send it in a chat. Only store it in Netlify environment variables.

## Local preview
Open `index.html` directly for manual prop entry and calculations. The live-odds button will not work locally because it calls a Netlify function. To test the whole app locally, install Netlify CLI and run `netlify dev`.

## Current limitations
- The provider-reported injury lookup and historical matchup context are available in v7 when GRIDIRON_DATA_API_KEY is configured. Official game-day inactives, pure team defensive rankings, and weather are not guaranteed to be automatic. Snap shares can be imported from a compatible nflverse snap-count CSV.
- Player props can be loaded from the included PropLine function when the API returns coverage, or entered manually.
- Projection probabilities are estimates from simple distribution assumptions, not a validated betting system.
- This app does not place bets.

## Free historical NFL statistics
The nflverse project publishes free historical/player data and updates player stats nightly after game days. See https://nflreadr.nflverse.com/ and https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html. The dashboard includes a historical-stat-driven baseline projection, recent usage adjustment, rolling backtest, and the v7 context lookup described below.

## Historical statistics import
Open the dashboard, click the nflverse releases link in the Historical NFL Stats panel, download the Player Summary Stats `player_stats.csv` asset, then use **Import player_stats.csv**. The browser processes the file locally. The current importer filters the 2026 season and shows recent per-player results for supported columns; it is a descriptive lookup, not yet a calibrated forecast model.


## Projection engine (v5)
Import the weekly 2026 nflverse Player Summary Stats CSV in the Historical Stats panel. In the prop board, enter or select the player, choose a supported market, optionally enter opponent/role/availability/environment percentage adjustments, and click **Build projection from imported stats**. The engine combines season average, last-four-game average, and an exponentially recency-weighted average; shrinks small samples toward the season mean; estimates standard deviation from recent and season-wide variation; and records its assumptions in the evidence notes. It supports yards, receptions, completions, TD counts, rush + receiving yards, and anytime TD baseline estimates.

The Historical Stats panel includes a rolling backtest. It forecasts each later game using only that player's earlier games and reports MAE, RMSE, and bias. This is a useful sanity check, not independent proof of predictive performance: samples may be small, and the current model does not automatically incorporate injuries, snap share, opponent defense, weather, or sportsbook consensus.

## Projection engine (v5 upgrade)
- Uses a weighted blend of season average, last-four-game average, and an exponentially recency-weighted average.
- Shrinks the blended estimate toward the season average when the sample is small, reducing overreaction to a few games.
- Estimates uncertainty from the last eight games and season-wide variance.
- Adds optional manual percentage adjustments for opponent, player role/usage, availability, and game environment. These are user-entered assumptions, not automatically sourced injury/weather/defensive data.
- Supports passing/rushing/receiving yards, receptions, completions, pass/rush/receiving TD counts, rush + receiving yards, and anytime TD baseline. Yardage/volume probabilities use a normal approximation; TD counts use a Poisson approximation.
- Player names are suggested from the imported CSV. The data is processed locally in the browser.

Important: the model is a transparent starting point, not a trained or backtested betting system. Don't treat its probability gaps as proven value. Before using it for real decisions, test projections against held-out weeks, compare calibration to actual outcomes, and incorporate player participation/snaps, opponent-adjusted usage, injuries, and sportsbook market consensus.


## Projection engine (v6 usage upgrade)
- In addition to the player summary CSV, click **Import snap_counts.csv** and import the nflverse weekly snap-count CSV for the 2026 season. The importer looks for player, week, and offensive snap percentage columns (commonly `player`, `week`, and `offense_pct`).
- When a player name matches across files, the projection estimates recent offensive snap-share change (last four games versus season average) and adds a bounded, visible usage adjustment to the manual role adjustment. It reports the snap-share inputs in the evidence notes. This is a heuristic, not a causal estimate of how many yards each snap creates.
- The **Player availability** selector offers explicit default reductions for questionable, limited, doubtful, and out statuses. These are conservative editable assumptions, not an official injury feed. Confirm official reports; selecting OUT blocks a normal projection.
- Historical player stats and snap-count files are processed locally in the browser and are not uploaded. The dashboard still does not automatically fetch injury reports, weather, or opponent defensive metrics.

## v7: automatic injury and opponent context
This version adds a Netlify function `netlify/functions/gridiron-context.mjs` that calls GridIron Data's player profile endpoint server-side. Add `GRIDIRON_DATA_API_KEY` under Netlify environment variables; never put the key in `index.html` or commit it to GitHub. Get a key at https://www.gridirondata.com/pages/docs.html. The provider currently advertises a free tier with 50 requests/month for player lookups and current-week projections. Its $5/month Basic tier adds broader stats, snaps, matchup endpoints; the $29/month Pro tier is required for its dedicated game-day injury-changes feed. This keeps the initial integration under the stated $25/month budget, but does not provide continuous game-day injury-change alerts.

Use **Automatic injury & matchup context** to look up a player's reported injury status and provider matchup history. The injury result is provider-reported, may not reflect the latest official inactive announcement, and must be verified before kickoff. Use **Apply reported availability** to map the status into the existing editable availability adjustment. Do not treat the lookup as an official inactive feed.

The **Calculate stat-specific opponent factor from imported logs** button uses the player's imported game-by-game stats for the selected market against the selected opponent. It requires at least two direct matchup games, shrinks the observed difference toward the player's overall average, and caps the adjustment at +/-15%. This is a player-vs-opponent historical split, not a pure opponent defensive rating, and is particularly noisy with small samples. The importer supports `opponent` or `opponent_team` columns; if the selected CSV lacks opponent data, this adjustment will not be available.

## Netlify environment variables
- `PROP_LINE_API_KEY` (optional, live player props)
- `ODDS_API_KEY` (optional, live game odds)
- `GRIDIRON_DATA_API_KEY` (optional, provider-reported injury status and opponent context)

## v8: automatic team defense by prop market
The new `netlify/functions/defense-matchups.mjs` endpoint attempts to retrieve the public nflverse team-game CSV for the selected season, then aggregates opponent offensive production allowed by defense. It computes allowed-per-game against the league average and returns a market-specific descriptive factor, capped at +/-15%. No additional API key or paid plan is required for this function.

In the dashboard, open **Automatic team defense by prop market**, choose the opponent, season and market, click **Load team defense**, review the sample size and baseline, then click **Apply adjustment to projection**. The factor is copied into the existing opponent adjustment field and the evidence notes. Click **Build projection from imported stats** again to recalculate the mean with that factor applied.

Supported public team-game proxies include passing yards, rushing yards, pass completions/receptions, passing touchdowns, rushing touchdowns, and combined rush + pass yards. Receiving yards are approximated with team passing yards allowed; this does not distinguish WR/TE/RB or account for target share. Some team-stat releases may omit a requested field or may not yet be published for the current season. If so, the endpoint reports the missing asset/field instead of inventing a rating. Public data is cached for up to six hours per warm function instance, and the response includes source, sample size, league average, ranking, and methodology.

**Model caution:** this is an early-season descriptive factor, not a validated predictive model. The +/-15% cap is a safety bound, not a learned coefficient. Don't interpret a high allowed average as proof a player will beat a line. Evaluate the feature in rolling out-of-sample backtests before relying on it. No new API key is required; existing `PROP_LINE_API_KEY`, `ODDS_API_KEY`, and `GRIDIRON_DATA_API_KEY` settings remain unchanged.

## v9: Best Props Finder
The Best Props Finder ranks live player-prop lines against the locally imported weekly player stats. To use it, refresh live props, import the current-season `player_stats.csv`, open **Best Props Finder**, set a minimum estimated hit probability and minimum player-game sample, choose a sort order, and click **Find likely props**. The table shows the selected side, projection, model-estimated hit chance, available sportsbook price, price gap versus American-odds break-even probability, estimated EV per $100, and number of games used. Click **Add** to transfer the candidate to the research calculator.

The finder only produces a candidate when it can match the player, map the market to an imported stat, find a line and price, and meet the chosen minimum sample. The default is 4 games and 55% estimated hit probability. You can lower the filters to explore smaller samples, but those are less reliable. It deduplicates identical player/market/line/side candidates across books and retains the price with the better estimated EV. The default sort is hit probability; use price edge or EV to look for potential value instead.

**Critical limitation:** these are uncalibrated baseline estimates using weighted historical averages and a normal/Poisson approximation, not a validated prediction model. The listed price edge and EV are only as good as those probabilities. It does not automatically adjust each candidate for current injury status, snap share, weather, team defense or correlation; use the other dashboard panels and verify current lines before making decisions. It is research-only and does not place bets.


## v11: SURJ INTEL Moneyline Intelligence
The Moneyline Intelligence panel reuses the existing `/.netlify/functions/nfl-odds` feed and `ODDS_API_KEY` setting. It analyzes every game returned by the odds provider, removes each book's vig from the two moneyline prices, averages those no-vig probabilities as a market-anchored baseline, converts the baseline into fair American odds, and compares the baseline with the best listed price for each team. It ranks price discrepancies, supports all-games/value-only/upset-watch filters, and shows a confidence indicator based on number of books and price agreement.

Important limitation: this is a market-anchored baseline, not an independent team-strength model. The price edge is a market-consensus-versus-best-book discrepancy, not a validated predictive advantage. The upset watch flags underdogs with at least a 35% baseline win probability; it does not mean the underdog is a good wager. Odds availability varies by provider and book. Test live responses after deploying, and do not interpret confidence labels as certainty or guaranteed profit. No additional API key is required.


## v12 visual theme update

This package updates the SURJ INTEL interface to a black-and-red theme with electric-blue accents across navigation, moneyline cards, player-prop tables, inputs, buttons, badges, charts, and responsive layouts. Existing Netlify functions and environment-variable names are preserved.


## v13: sportsbook odds and player-prop CSV import
The new **Import CSV** panel accepts moneyline CSVs or player-prop line CSVs. CSV contents are processed in the browser only; no file is uploaded to Netlify.

### Moneyline CSV format
Required headers: `home_team`, `away_team`, `home_odds`, `away_odds`. Optional: `bookmaker` (or `book` / `sportsbook`) and `commence_time` (or `start_time`, `game_time`, `date`, `kickoff`). Each row represents one game at one book. Odds should be American (for example `-125` or `+110`). Include the book column if you have multiple books so the app can compare prices.

### Player props CSV format
Required headers: `player`, `market`, `line`, and either both `over_odds` / `under_odds` columns or `side` / `odds` columns with one row per side. Optional: `matchup`, `bookmaker` (or `book` / `sportsbook`), `updated_at`. Supported common markets include passing yards, pass TDs, completions, rushing yards, rush TDs, receiving yards, receptions, receiving TDs, rush + receiving yards, anytime TD, longest reception, and interceptions. Unknown market labels still display in Live Props but may not be supported by Best Props Finder. American odds are recommended. The importer also recognizes a `format` or `odds_format` value of `decimal` for decimal prices.

### Example templates
- `templates/sportsbook-moneyline-template.csv`
- `templates/player-props-template.csv`

CSV-imported moneylines feed Game Center and Moneyline Intelligence and are merged with live API games when matchup/date matches. CSV-imported player lines appear in Live NFL player props and can be copied into Research; they also feed Best Props Finder when the market maps to imported historical player stats. Imported data is held in page memory for the current tab and is not persisted after reload. Re-import a file after refreshing. This import does not create a live feed or verify whether the lines are current.


## v14: Compact dashboard layout
- Keeps the black/red identity with electric-blue data accents.
- Uses a sticky horizontal navigation bar and compact spacing across summary cards, forms, tables, and game tiles.
- Moves Best Props Finder and Moneyline Intelligence near the top so ranked opportunities are seen sooner.
- Adds accessible Collapse/Expand controls to dashboard cards. Secondary tools start collapsed to reduce initial page length; clicking navigation expands the destination section.
- Retains all existing DOM IDs, CSV templates/import behavior, player-prop tools, moneyline analysis, and Netlify functions/environment variable names.

### Deploy v14
1. Extract the ZIP.
2. Replace matching files in the GitHub repository connected to the existing Netlify site, preserving `netlify/functions/` and `templates/`.
3. Commit and wait for Netlify's deploy to complete.
4. Keep existing `ODDS_API_KEY`, `PROP_LINE_API_KEY`, and `GRIDIRON_DATA_API_KEY` environment variables in Netlify. Do not put keys in source files.
5. Test the sticky navigation, collapse controls, CSV templates/import, moneyline refresh, player-prop refresh, and Best Props Finder. Live data still depends on provider access and valid keys.


## v15: shared storage (superseded by v16)
The v15 release briefly allowed shared sportsbook-line CSV uploads. In v16, that behavior is removed. The shared endpoint now stores only historical player statistics and optional snap counts, and clears the legacy v15 sportsbook CSV record when the endpoint is accessed. Follow the v16 workflow below.

## v16: persist player statistics, not sportsbook lines
- Shared Netlify Blobs storage is now reserved only for `player_stats.csv` and optional `snap_counts.csv`. The shared endpoint rejects moneyline and sportsbook player-prop CSV upload kinds.
- In the Historical Player Statistics panel, import `player_stats.csv`, enter the private `SURJ_CSV_UPLOAD_TOKEN` value, then click **Publish player stats**. Optionally import and publish `snap_counts.csv` too.
- Published historical stats are loaded automatically for every visitor. Publishing one dataset preserves the other. The upload token is never embedded in website source.
- The sportsbook CSV importer remains local to the current browser session and does not save lines to shared storage. Existing live odds and player-prop API functions remain in place.
- Deploy by replacing the website files in the connected GitHub repository and committing the changes. In Netlify, keep `SURJ_CSV_UPLOAD_TOKEN` plus any existing API environment variables, then trigger a fresh deploy.
