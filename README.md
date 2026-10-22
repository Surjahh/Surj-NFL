# Gridiron Edge Live Starter

Mobile-friendly NFL research dashboard with:
- A Netlify serverless function for The Odds API game lines, plus a PropLine player-props function using a server-side secret.
- Live NFL game moneylines when a valid provider key/plan supports them.
- Manual player-prop entry with estimated probability, break-even probability, probability gap, and EV per $100.
- Local browser storage and CSV export.

## Live player props under $25/month
The included `live-props.mjs` function uses PropLine's API, whose published pricing page advertises a free tier with 1,000 requests/day and 60+ player prop markets. NFL coverage varies by bookmaker and market, and its docs note that major US sportsbook NFL props may be seasonal/not available on every book. Create a free key at https://prop-line.com/ and set `PROP_LINE_API_KEY` in Netlify environment variables. Test that your requested NFL props actually return before relying on the feed. No subscription is required to test the free tier. The app also retains manual prop entry as a fallback.

## Easiest deployment (phone-accessible website)
1. Create a free account at https://github.com/ and create a new repository named `gridiron-edge`.
2. Upload the contents of this folder to the repository (not the ZIP file itself).
3. Create a free account at https://www.netlify.com/ and choose **Add new site → Import an existing project**.
4. Connect GitHub and select `gridiron-edge`. Netlify should detect `netlify.toml`. Deploy.
5. Sign up for The Odds API at https://the-odds-api.com/ and copy the API key.
6. In Netlify, open **Site configuration → Environment variables** and add `PROP_LINE_API_KEY` with your private PropLine key. You may also keep `ODDS_API_KEY` if you want the game-moneyline function to work.
7. Trigger a redeploy. Open your Netlify site URL on your phone and tap **Refresh live props**. The game odds button uses the separate `ODDS_API_KEY` and remains independent.

## Keep the key safe
Never put the key in `index.html`, commit it to GitHub, or send it in a chat. Only store it in Netlify environment variables.

## Local preview
Open `index.html` directly for manual prop entry and calculations. The live-odds button will not work locally because it calls a Netlify function. To test the whole app locally, install Netlify CLI and run `netlify dev`.

## Current limitations / next upgrades
- Live game odds only; no automated player props, injury reports, or current player stats are connected yet.
- Player props are manual inputs. Historical player stats can be integrated next from nflverse public data.
- Probability estimates use a simple normal approximation for most yardage markets. This is not a validated betting model; touchdown probability is intentionally shown as N/A.
- This app does not place bets.


## Free historical NFL statistics
The nflverse project publishes free historical/player data and updates player stats nightly after game days. See https://nflreadr.nflverse.com/ and https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html. The current dashboard still requires manual projections; historical-stat-driven projections are the next development step.

## Historical statistics import
Open the dashboard, click the nflverse releases link in the Historical NFL Stats panel, download the Player Summary Stats `player_stats.csv` asset, then use **Import player_stats.csv**. The browser processes the file locally. The current importer filters the 2026 season and shows recent per-player results for supported columns; it is a descriptive lookup, not yet a calibrated forecast model.
