// Public nflverse team-game data -> market-specific opponent context.
// Cached in-memory for six hours per warm function instance. No API key required.
const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=3600', ...extraHeaders },
  body: JSON.stringify(body)
});
const cache = new Map();
const ALIASES = { LA: 'LAR', JAC: 'JAX', JAX: 'JAC', WSH: 'WAS', WAS: 'WSH' };
function parseCSV(text) {
  const rows=[]; let row=[], field='', quoted=false;
  for(let i=0;i<text.length;i++) { const c=text[i];
    if(quoted) { if(c==='"' && text[i+1]==='"'){field+='"';i++;} else if(c==='"') quoted=false; else field+=c; }
    else if(c==='"') quoted=true; else if(c===','){row.push(field);field='';} else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';} else field+=c;
  }
  if(field.length||row.length){row.push(field.replace(/\r$/,''));rows.push(row);} return rows;
}
function num(v){ if(v==null||v===''||v==='NA'||v==='null') return null; const n=Number(v); return Number.isFinite(n)?n:null; }
function pick(headers, candidates){ for(const c of candidates){const i=headers.indexOf(c);if(i>=0)return i;}return -1; }
async function getDataset(season){
  const cached=cache.get(season); if(cached&&Date.now()-cached.at<6*60*60*1000)return {...cached, cached:true};
  const urls=[
    `https://github.com/nflverse/nflverse-data/releases/download/team_stats/team_stats_${season}.csv`,
    `https://github.com/nflverse/nflverse-data/releases/download/team_stats/team_stats_${season}_REG.csv`
  ];
  let last='No supported public team-stat CSV was found.';
  for(const url of urls){
    try{const r=await fetch(url,{headers:{'user-agent':'GridironEdge/1.0'},signal:AbortSignal.timeout(18000)}); if(!r.ok){last=`nflverse returned HTTP ${r.status} for the ${season} team stats asset.`;continue;}
      const csv=await r.text(); if(csv.length<100||csv.slice(0,100).toLowerCase().includes('<!doctype html')){last='The nflverse download was not a CSV.';continue;}
      const rows=parseCSV(csv); if(rows.length<2){last='The downloaded team-stat CSV was empty.';continue;}
      const headers=rows[0].map(x=>x.trim()); const data=rows.slice(1).filter(r=>r.length>1);
      const team=pick(headers,['team']), opp=pick(headers,['opponent_team','opponent','opp']);
      const seasonIx=pick(headers,['season']), week=pick(headers,['week']);
      if(team<0||opp<0){last=`Downloaded team stats but could not identify team/opponent columns. Found: ${headers.slice(0,20).join(', ')}`;continue;}
      const statCols={
        passing_yards:pick(headers,['passing_yards','pass_yards','passing_yards_gained']),
        passing_tds:pick(headers,['passing_tds','pass_touchdowns','passing_touchdowns']),
        rushing_yards:pick(headers,['rushing_yards','rush_yards','rushing_yards_gained']),
        rushing_tds:pick(headers,['rushing_tds','rush_touchdowns','rushing_touchdowns']),
        completions:pick(headers,['completions','passing_completions','complete_pass']),
        receptions:pick(headers,['receptions','receiving_receptions','catches'])
      };
      const records=data.map(r=>({team:String(r[team]||'').toUpperCase(),opp:String(r[opp]||'').toUpperCase(),season:seasonIx>=0?num(r[seasonIx]):season,week:week>=0?num(r[week]):null,stats:Object.fromEntries(Object.entries(statCols).map(([k,i])=>[k,i>=0?num(r[i]):null]))})).filter(r=>r.team&&r.opp&&r.season===season);
      if(!records.length){last='No team-game rows found for that season.';continue;}
      const result={records,headers,at:Date.now(),source:url}; cache.set(season,result); return result;
    }catch(e){last=e.message;}
  }
  throw new Error(`${last} Try again later or import a team-game CSV manually in a future version.`);
}
const marketMap={
  'Passing yards':{stat:'passing_yards',label:'passing yards allowed'},'Pass yards':{stat:'passing_yards',label:'passing yards allowed'},
  'Pass touchdowns':{stat:'passing_tds',label:'passing TDs allowed'},'Passing TDs':{stat:'passing_tds',label:'passing TDs allowed'},
  'Rushing yards':{stat:'rushing_yards',label:'rushing yards allowed'},'Rush yards':{stat:'rushing_yards',label:'rushing yards allowed'},
  'Rush touchdowns':{stat:'rushing_tds',label:'rushing TDs allowed'},'Rushing TDs':{stat:'rushing_tds',label:'rushing TDs allowed'},
  'Receptions':{stat:'receptions',fallback:'completions',label:'receptions/completions allowed'},
  'Pass completions':{stat:'completions',label:'completions allowed'},'Completions':{stat:'completions',label:'completions allowed'},
  'Receiving yards':{stat:'passing_yards',label:'passing yards allowed (team-level proxy for receiving yards)'},
  'Rush + receiving yards':{stat:'rushing_yards',secondary:'passing_yards',label:'rush + pass yards allowed (rough team-level proxy)'}
};
export async function handler(event){
 if(event.httpMethod!=='GET')return json(405,{error:'Use GET.'});
 const q=event.queryStringParameters||{}; const season=Number(q.season||new Date().getUTCFullYear());
 const opponent=String(q.opponent||'').trim().toUpperCase(); const market=String(q.market||'').trim();
 if(!Number.isInteger(season)||season<1999||season>2100)return json(400,{error:'Invalid season.'});
 if(!opponent)return json(400,{error:'Choose an opponent team code.'});
 const config=marketMap[market]; if(!config)return json(400,{error:`Market “${market}” is not supported for automatic team defense. Choose passing/rushing yards, receptions/completions, or passing/rushing TDs.`});
 try{
   const ds=await getDataset(season); const alias=ALIASES[opponent]||opponent; let stat=config.stat;
   if(!ds.records.some(r=>r.stats[stat]!=null) && config.fallback && ds.records.some(r=>r.stats[config.fallback]!=null)) stat=config.fallback;
   if(!ds.records.some(r=>r.stats[stat]!=null))return json(422,{error:`The ${season} team stats file did not include the ${stat} field. Available fields: ${ds.headers.join(', ')}`});
   const games=ds.records.filter(r=>r.opp===opponent||r.opp===alias).filter(r=>r.stats[stat]!=null);
   // Each row is an offense's game. Its opponent is the defense that allowed those stats.
   const all=[]; for(const r of games){let value=r.stats[stat];if(config.secondary){const sec=r.stats[config.secondary];if(sec==null)continue;value+=sec;}all.push({defense:r.opp,week:r.week,value});}
   const defenseRows=all.filter(r=>r.defense===opponent||r.defense===alias);
   // Above rows are keyed by the offense's opponent. Restricting to selected defense yields its allowed totals.
   if(defenseRows.length<2)return json(422,{error:`Only ${defenseRows.length} usable game(s) found for ${opponent} in ${season}; need at least 2 to estimate a matchup factor.`});
   const average=arr=>arr.reduce((s,x)=>s+x,0)/arr.length;
   const values=defenseRows.map(r=>r.value); const allowed=average(values);
   // League average for the same stat among all team-game rows (one offense per game).
   const leagueValues=ds.records.map(r=>{const a=r.stats[stat];if(a==null)return null;if(config.secondary){const b=r.stats[config.secondary];return b==null?null:a+b;}return a;}).filter(v=>v!=null&&Number.isFinite(v));
   if(!leagueValues.length)return json(422,{error:`Could not calculate league baseline for ${stat}.`});
   const league=average(leagueValues); const raw=league>0?(allowed/league)-1:0; const adjustment=Math.max(-.15,Math.min(.15,raw));
   const sorted=[...ds.records].filter(r=>r.stats[stat]!=null).map(r=>({defense:r.opp,value:config.secondary&&r.stats[config.secondary]!=null?r.stats[stat]+r.stats[config.secondary]:r.stats[stat]})).filter(r=>r.defense).reduce((m,r)=>{if(!m.has(r.defense))m.set(r.defense,[]);m.get(r.defense).push(r.value);return m;},new Map());
   const rank=[...sorted.entries()].map(([team,arr])=>({team,avg:average(arr)})).sort((a,b)=>b.avg-a.avg).findIndex(x=>x.team===opponent||x.team===alias)+1;
   return json(200,{season,opponent,market,stat,label:config.label,games:defenseRows.length,allowed_per_game:Number(allowed.toFixed(2)),league_per_game:Number(league.toFixed(2)),raw_adjustment_pct:Number((raw*100).toFixed(1)),adjustment_pct:Number((adjustment*100).toFixed(1)),rank_from_most_allowed:rank||null,teams_ranked:sorted.size,cached:!!ds.cached,source:'nflverse public team-game stats',source_url:ds.source,updated_at:new Date(ds.at).toISOString(),method:'Allowed per-game average divided by league per-game average; shrunk only by a hard ±15% cap. This is a descriptive heuristic, not a validated causal projection adjustment.',warning:config.secondary?'This market uses a combined team-stat proxy and is less precise than player-level defensive splits.':market==='Receiving yards'?'Team passing yards allowed is only a proxy for receiving-yard matchup and does not adjust for receiver position or targets.':'Defensive stats are based on available team-game data; early-season samples are noisy.'});
 }catch(e){return json(502,{error:`Could not load automatic opponent-defense data: ${e.message}`,help:'The free nflverse team-stat release may not yet include this season or its asset name may have changed.'});}
}
