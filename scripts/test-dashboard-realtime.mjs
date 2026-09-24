import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const dashboardClient=await readFile('ops/ro-stack/dashboard/app.js','utf8');
if(!dashboardClient.includes('EVENT_POLL_INTERVAL_MS = 300'))throw new Error('event polling load limit missing');
if(!dashboardClient.includes('POLL_RETRY_MAX_MS = 5000'))throw new Error('poll retry backoff missing');

const origin=process.env.RO_DEMO_ORIGIN??'http://127.0.0.1:8788';
const fixture=JSON.parse(await readFile('.local/ro-stack/multiplayer-test-v2-credentials.json','utf8'));
const sessions=await Promise.all([1,2,3].map(async index=>{
  const response=await fetch(`${origin}/api/account`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:`gate2_${String(index).padStart(2,'0')}`,password:fixture.password,sex:index%2?'M':'F'})});
  if(!response.ok)throw new Error(`realtime login failed: ${response.status}`);
  return{cookie:response.headers.get('set-cookie')?.split(';')[0]??'',cursor:null};
}));

const timings=[];
for(let round=0;round<20;round++){
  await Promise.all(sessions.map(async session=>{
    const started=performance.now(),query=session.cursor===null?'':`?cursor=${session.cursor}`;
    const response=await fetch(`${origin}/api/events${query}`,{headers:{cookie:session.cookie}}),body=await response.json();
    timings.push(performance.now()-started);
    if(!response.ok||!Number.isInteger(body.cursor)||!Array.isArray(body.lines)||!Object.hasOwn(body,'live'))throw new Error('invalid incremental event response');
    if(session.cursor!==null&&body.cursor<session.cursor)throw new Error('event cursor moved backwards');
    session.cursor=body.cursor;
  }));
}
timings.sort((a,b)=>a-b);
const p95=timings[Math.ceil(timings.length*.95)-1],maximum=timings.at(-1),average=timings.reduce((sum,value)=>sum+value,0)/timings.length;
if(p95>150)throw new Error(`event API p95 ${p95.toFixed(1)}ms exceeded 150ms`);
console.log(JSON.stringify({result:'REALTIME_EVENT_PASS',requests:timings.length,averageMs:Number(average.toFixed(1)),p95Ms:Number(p95.toFixed(1)),maxMs:Number(maximum.toFixed(1)),clientPollMs:300,retryMaxMs:5000},null,2));
