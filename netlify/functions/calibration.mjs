import { getStore } from "@netlify/blobs";

const STORE = "surj-intel-calibration";
const KEY = "ledger-v1";
const MAX_RECORDS = 20000;
const cors = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const json = (data, status=200) => new Response(JSON.stringify(data), { status, headers: cors });
function cleanString(v, max=160) { return String(v ?? "").trim().slice(0,max); }
function validNum(v, min=-1e9, max=1e9) { const n=Number(v); return Number.isFinite(n)&&n>=min&&n<=max?n:null; }
function normalizeName(s) { return String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,""); }
function emptyLedger(){return {predictions:[], calibrators:{}, lastRunAt:null, lastRun:null};}
async function readLedger(){const store=getStore(STORE);return (await store.get(KEY,{type:"json"}))||emptyLedger();}
async function writeLedger(data){await getStore(STORE).setJSON(KEY,data);}
function summarize(ledger){
 const graded=ledger.predictions.filter(p=>p.gradedAt&&Number.isFinite(p.actual));
 const errors=graded.map(p=>Math.abs(p.mean-p.actual));
 const brierRows=graded.filter(p=>Number.isFinite(p.line)&&Number.isFinite(p.overProbability)&&p.push!==true);
 const brierRowsScored=brierRows.map(p=>({p:p.overProbability,y:p.actual>p.line?1:0}));
 const brier=brierRowsScored.length?brierRowsScored.reduce((s,x)=>s+(x.p-x.y)**2,0)/brierRowsScored.length:null;
 return {gradedCount:graded.length,mae:errors.length?errors.reduce((a,b)=>a+b,0)/errors.length:null,brier,calibrationSample:brierRowsScored.length,lastRunAt:ledger.lastRunAt,lastRun:ledger.lastRun,calibrators:ledger.calibrators||{},status:"Connected",notes:"Grades use saved pregame projections and completed player stats. Brier score includes only predictions with a valid line and probability; pushes are excluded."};
}
export default async (request) => {
 if(request.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
 try {
  const ledger=await readLedger();
  if(request.method==="GET") return json(summarize(ledger));
  if(request.method!=="POST") return json({error:"Method not allowed"},405);
  const body=await request.json().catch(()=>null);
  if(!body||body.action!=="savePrediction"||!body.prediction) return json({error:"Expected action savePrediction and a prediction"},400);
  const x=body.prediction;
  const player=cleanString(x.player,100), market=cleanString(x.market,80);
  const season=validNum(x.targetSeason,2023,2035), week=validNum(x.targetWeek,1,22), mean=validNum(x.mean,0,2000), sd=validNum(x.sd,0.01,1000);
  if(!player||!market||!season||!week||mean===null||sd===null) return json({error:"Player, market, target season/week, mean, and positive standard deviation are required"},400);
  const id=cleanString(x.predictionId,100)||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const existing=ledger.predictions.findIndex(p=>p.predictionId===id);
  const line=x.line===null||x.line===""||x.line===undefined?null:validNum(x.line,-10000,10000);
  const overProbability=x.overProbability===null||x.overProbability===undefined?null:validNum(x.overProbability,0,1);
  const rawOverProbability=x.rawOverProbability===null||x.rawOverProbability===undefined?overProbability:validNum(x.rawOverProbability,0,1);
  const record={predictionId:id,player,playerKey:normalizeName(player),market,mean,sd,sample:validNum(x.sample,0,10000)||0,line,odds:x.odds===null?null:validNum(x.odds,-10000,10000),side:x.side==="Under"?"Under":"Over",overProbability,rawOverProbability,targetSeason:season,targetWeek:week,matchup:cleanString(x.matchup,100),projectionType:cleanString(x.projectionType,40),modelVersion:"surj-adaptive-v18.3",createdAt:cleanString(x.createdAt,50)||new Date().toISOString(),gradedAt:null,actual:null,gradeStatus:"Pending target result"};
  if(existing>=0) { const old=ledger.predictions[existing]; if(old.gradedAt) return json({predictionId:id,gradeStatus:"Already graded"}); ledger.predictions[existing]={...old,...record}; }
  else ledger.predictions.unshift(record);
  ledger.predictions=ledger.predictions.slice(0,MAX_RECORDS);
  await writeLedger(ledger);
  return json({ok:true,predictionId:id,gradeStatus:"Pending target result"});
 } catch(e){console.error("calibration API error",e);return json({error:"Calibration storage unavailable"},500);}
};
