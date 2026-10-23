import { getStore } from "@netlify/blobs";

const CAL_STORE="surj-intel-calibration", CAL_KEY="ledger-v1";
const STATS_STORE="surj-intel-shared-csv", STATS_KEY="published-player-stats";
function parseCsv(text){const rows=[];let row=[],field="",quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}else if(c==='"')quoted=true;else if(c===","){row.push(field);field="";}else if(c==="\n"){row.push(field);rows.push(row);row=[];field="";}else if(c!=="\r")field+=c;}if(field.length||row.length){row.push(field);rows.push(row);}return rows.filter(r=>r.some(v=>String(v).trim()!==""));}
function key(s){return String(s||"").trim().toLowerCase().replace(/^\uFEFF/,"").replace(/[\s\-\/]+/g,"_").replace(/[^a-z0-9_]/g,"").replace(/_+/g,"_");}
function normName(s){return String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");}
function num(v){if(v===undefined||v===null||String(v).trim()==="")return null;const n=Number(v);return Number.isFinite(n)?n:null;}
function getNum(row,idx,aliases){for(const a of aliases){const i=idx.get(a);if(i!==undefined){const n=num(row[i]);if(n!==null)return n;}}return null;}
function actualFor(market,row,idx){
 const map={
 "Receiving yards":["receiving_yards"],"Receptions":["receptions"],"Rushing yards":["rushing_yards"],"Passing yards":["passing_yards"],"Pass completions":["completions"],"Pass touchdowns":["passing_tds"],"Rush touchdowns":["rushing_tds"],"Receiving touchdowns":["receiving_tds"]
 };
 if(map[market])return getNum(row,idx,map[market]);
 if(market==="Rush + receiving yards"){const r=getNum(row,idx,["rushing_yards"]),v=getNum(row,idx,["receiving_yards"]);return r===null||v===null?null:r+v;}
 if(market==="Anytime touchdown"){const vals=["passing_tds","rushing_tds","receiving_tds"].map(k=>getNum(row,idx,[k]));return vals.every(v=>v===null)?null:vals.reduce((s,v)=>s+(v||0),0)>0?1:0;}
 return null;
}
function logit(p){const q=Math.max(0.001,Math.min(0.999,p));return Math.log(q/(1-q));}
function sigmoid(x){return 1/(1+Math.exp(-Math.max(-30,Math.min(30,x))));}
function fitPlatt(rows){
 if(rows.length<50||new Set(rows.map(x=>x.y)).size<2)return null;
 let a=0,b=1;
 for(let i=0;i<800;i++){let ga=0,gb=0;for(const r of rows){const x=logit(r.p),q=sigmoid(a+b*x);ga+=q-r.y;gb+=(q-r.y)*x;}const rate=0.01/rows.length;a-=rate*ga;b-=rate*gb;}
 if(!Number.isFinite(a)||!Number.isFinite(b))return null;
 return {a,b,n:rows.length,method:"Platt logistic calibration",updatedAt:new Date().toISOString()};
}
function metrics(predictions){
 const graded=predictions.filter(p=>p.gradedAt&&Number.isFinite(p.actual));
 const mae=graded.length?graded.reduce((s,p)=>s+Math.abs(p.mean-p.actual),0)/graded.length:null;
 const brierRows=graded.filter(p=>Number.isFinite(p.line)&&Number.isFinite(p.overProbability)&&p.actual!==p.line);
 const brier=brierRows.length?brierRows.reduce((s,p)=>s+(p.overProbability-(p.actual>p.line?1:0))**2,0)/brierRows.length:null;
 const bins=Array.from({length:10},(_,i)=>({range:`${i*10}-${(i+1)*10}%`,n:0,predicted:0,observed:0}));
 for(const p of brierRows){const i=Math.min(9,Math.floor(p.overProbability*10));bins[i].n++;bins[i].predicted+=p.overProbability;bins[i].observed+=p.actual>p.line?1:0;}
 const reliability=bins.filter(b=>b.n).map(b=>({...b,meanPredicted:b.predicted/b.n,observedRate:b.observed/b.n})).map(({range,n,meanPredicted,observedRate})=>({range,n,meanPredicted,observedRate}));
 return {gradedCount:graded.length,mae,brier,calibrationSample:brierRows.length,reliability};
}
export default async () => {
 const startedAt=new Date().toISOString();
 const calStore=getStore(CAL_STORE), sharedStore=getStore(STATS_STORE);
 const ledger=await calStore.get(CAL_KEY,{type:"json"})||{predictions:[],calibrators:{},lastRunAt:null,lastRun:null};
 const shared=await sharedStore.get(STATS_KEY,{type:"json"})||{};
 if(!shared.playerStatsCsv) return new Response(JSON.stringify({ok:false,error:"No shared player stats CSV available; retained existing ledger."}),{status:503,headers:{"content-type":"application/json"}});
 const rows=parseCsv(shared.playerStatsCsv), headers=(rows[0]||[]).map(key), idx=new Map(headers.map((h,i)=>[h,i]));
 const playerIx=["player_display_name","player_name","player"].map(k=>idx.get(k)).find(i=>i!==undefined);
 const seasonIx=idx.get("season"),weekIx=idx.get("week");
 if(playerIx===undefined||seasonIx===undefined||weekIx===undefined) return new Response(JSON.stringify({ok:false,error:"Shared player stats missing player/season/week columns."}),{status:422,headers:{"content-type":"application/json"}});
 const actuals=new Map();
 for(const row of rows.slice(1)){
  const name=normName(row[playerIx]),season=num(row[seasonIx]),week=num(row[weekIx]);if(!name||season===null||week===null)continue;
  actuals.set(`${name}|${season}|${week}`,{row,season,week});
 }
 let newlyGraded=0,unsupported=0;
 for(const p of ledger.predictions||[]){
  if(p.gradedAt||!p.targetSeason||!p.targetWeek)continue;
  const found=actuals.get(`${p.playerKey||normName(p.player)}|${p.targetSeason}|${p.targetWeek}`);
  if(!found)continue;
  const actual=actualFor(p.market,found.row,idx);
  if(actual===null){unsupported++;continue;}
  p.actual=actual;p.gradedAt=startedAt;p.gradeStatus="Graded";p.error=p.mean-actual;
  p.push=Number.isFinite(p.line)&&actual===p.line;
  newlyGraded++;
 }
 const byMarket={};
 for(const p of ledger.predictions||[]){
  if(!p.gradedAt||!Number.isFinite(p.actual)||!Number.isFinite(p.line)||!Number.isFinite(p.overProbability)||p.actual===p.line)continue;
  const market=p.market;(byMarket[market] ||= []).push({p:Number.isFinite(p.rawOverProbability)?p.rawOverProbability:p.overProbability,y:p.actual>p.line?1:0});
 }
 const calibrators={...(ledger.calibrators||{})};
 for(const [market,rows] of Object.entries(byMarket)){const fitted=fitPlatt(rows);if(fitted)calibrators[market]=fitted;}
 ledger.calibrators=calibrators;ledger.lastRunAt=startedAt;
 const m=metrics(ledger.predictions||[]);
 ledger.lastRun={...m,newlyGraded,unsupported,runAt:startedAt,source:"shared nflverse player stats",calibratorMarkets:Object.keys(calibrators)};
 await calStore.setJSON(CAL_KEY,ledger);
 console.log("SURJ INTEL weekly calibration",JSON.stringify({newlyGraded,unsupported,metrics:m,calibratorMarkets:Object.keys(calibrators)}));
 return new Response(JSON.stringify({ok:true,newlyGraded,unsupported,...m,runAt:startedAt,calibratorMarkets:Object.keys(calibrators)}),{headers:{"content-type":"application/json"}});
};
export const config={schedule:"0 12 * * 3"};
