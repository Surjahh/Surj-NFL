# Gridiron Edge Live Starter

Mobile-friendly NFL research dashboard with:
- A Netlify serverless function that proxies The Odds API using a server-side secret.
- Live NFL game moneylines when a valid provider key/plan supports them.
- Manual player-prop entry with estimated probability, break-even probability, probability gap, and EV per $100.
- Local browser storage and CSV export.

## Important data limitation
The included function requests `h2h` game markets only. The Odds API documents NFL player props as a higher-tier feature, which is likely outside the stated <$25/month budget. Do not assume a free key includes player props. This starter therefore lets you enter the current prop line and price manually while using your own projection. It does not fabricate live props or label demo projections as real.

## Easiest deployment (phone-accessible website)
1. Create a free account at https://github.com/ and create a new repository named `gridiron-edge`.
2. Upload the contents of this folder to the repository (not the ZIP file itself).
3. Create a free account at https://www.netlify.com/ and choose **Add new site → Import an existing project**.
4. Connect GitHub and select `gridiron-edge`. Netlify should detect `netlify.toml`. Deploy.
5. Sign up for The Odds API at https://the-odds-api.com/ and copy the API key.
6. In Netlify, open **Site configuration → Environment variables** and add:
   - Key: `ODDS_API_KEY`
   - Value: your private API key
   Scope: Functions (or all scopes if Netlify presents only that option).
7. Trigger a redeploy. Open your Netlify site URL on your phone and tap **Refresh live data**.

## Keep the key safe
Never put the key in `index.html`, commit it to GitHub, or send it in a chat. Only store it in Netlify environment variables.

## Local preview
Open `index.html` directly for manual prop entry and calculations. The live-odds button will not work locally because it calls a Netlify function. To test the whole app locally, install Netlify CLI and run `netlify dev`.

## Current limitations / next upgrades
- Live game odds only; no automated player props, injury reports, or current player stats are connected yet.
- Player props are manual inputs. Historical player stats can be integrated next from nflverse public data.
- Probability estimates use a simple normal approximation for most yardage markets. This is not a validated betting model; touchdown probability is intentionally shown as N/A.
- This app does not place bets.
