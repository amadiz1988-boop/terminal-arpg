'use client';
/* oxlint-disable react/react-compiler, react-hooks/exhaustive-deps */

import { useEffect, useRef, useState } from 'react';
import { Activity, Anvil, Box, CircleDot, Coins, Infinity as InfinityIcon, Map, Pause, Play, Swords, TrendingUp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { CAMPAIGN } from '@/game/content/campaign';
import { CLASSES, SECOND_JOBS } from '@/game/content/classes';
import { CONTRACTS } from '@/game/content/contracts';
import { POLICIES as policies, SKILLS as skills } from '@/game/content/skills';
import { SUPPORT_ORDER, SUPPORTS } from '@/game/content/supports';
import { TALENT_BOARDS, TALENTS, type TalentBoardId } from '@/game/content/talents';
import type { ClassId, ContractId, Item, ItemSlot, OrbWallet, Policy, RunMode, SecondJobId, SkillId, SupportId } from '@/game/core/types';
import { addLink, addSocket, ascendItem, createStarterWeapon, essenceCraft, evaluateItem, formatAffixes, itemLinks, itemSockets, recolorSockets, refineItem, salvageValue } from '@/game/items/items';
import { resolveStats } from '@/game/modifiers/resolve-stats';
import { completeCampaignOperation } from '@/game/progression/campaign';
import { exchangeMaps } from '@/game/progression/maps';
import { nextPowerGoal, SLOT_LABELS, TIER_POWER_REQUIREMENTS, unlockedTier } from '@/game/progression/power';
import { contractFailureChance, getRunStopReason, progressPerTick, simulateMapCompletion } from '@/game/simulation/map';

type Log = { id: number; kind: string; text: string };
const EMPTY_ORBS: OrbWallet = { alteration: 0, chromatic: 0, fusing: 0, jeweller: 0 };
const COLOR_LABEL = { R: '紅', G: '綠', B: '藍', W: '白' } as const;

export function GameShell() {
  const [saveLoaded, setSaveLoaded] = useState(false);
  const [classChosen, setClassChosen] = useState(false);
  const [classId, setClassId] = useState<ClassId>('thief');
  const [secondJobId, setSecondJobId] = useState<SecondJobId>();
  const [ascendancyNodes, setAscendancyNodes] = useState<string[]>([]);
  const [talentBoard, setTalentBoard] = useState<TalentBoardId>('hunt');
  const [talents, setTalents] = useState<string[]>([]);
  const [skillId, setSkillId] = useState<SkillId>('venom');
  const [acquiredSkills, setAcquiredSkills] = useState<SkillId[]>(['venom']);
  const [skillLevels, setSkillLevels] = useState<Partial<Record<SkillId,number>>>({venom:1});
  const [acquiredSupports, setAcquiredSupports] = useState<SupportId[]>([]);
  const [selectedSupports, setSelectedSupports] = useState<SupportId[]>([]);
  const [policy, setPolicy] = useState<Policy>('full-clear');
  const [contractId, setContractId] = useState<ContractId>('scout');
  const [mode, setMode] = useState<RunMode>('count');
  const [goal, setGoal] = useState(5);
  const [tier, setTier] = useState(1);
  const [maps, setMaps] = useState([0, 0, 0, 0, 0, 0]);
  const [campaignStep, setCampaignStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [runs, setRuns] = useState(0);
  const [lifetimeRuns, setLifetimeRuns] = useState(0);
  const [totalKills, setTotalKills] = useState(0);
  const [xp, setXp] = useState(0);
  const [items, setItems] = useState<Item[]>([createStarterWeapon('thief')]);
  const [equipped, setEquipped] = useState<Partial<Record<ItemSlot, string>>>({ weapon: 'starter-weapon' });
  const [materials, setMaterials] = useState({ scrap: 0, essence: 0, core: 0 });
  const [orbs, setOrbs] = useState<OrbWallet>(EMPTY_ORBS);
  const [salvageMode, setSalvageMode] = useState<'off'|'common'|'smart'>('smart');
  const [logs, setLogs] = useState<Log[]>([{ id: 1, kind: 'SYS', text: '請選擇初心職業，終端將建立你的第一套裝備。' }]);
  const [sessionLoot, setSessionLoot] = useState({ items: 0, gems: 0, orbs: 0, xp: 0 });
  const [combatDetail, setCombatDetail] = useState<'compact'|'full'>('compact');
  const [chatInput, setChatInput] = useState('');
  const [chat, setChat] = useState<Array<{id:number;name:string;text:string}>>([{id:1,name:'系統',text:'區域頻道已連線。目前為單機預覽。'}]);
  const sessionStart = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const seedRef = useRef(824);

  const equippedItems = Object.fromEntries((Object.keys(SLOT_LABELS) as ItemSlot[]).map((slot) => [slot, items.find((item) => item.id === equipped[slot])])) as Partial<Record<ItemSlot, Item>>;
  const weapon = equippedItems.weapon;
  const linkCount = itemLinks(weapon);
  const supportCapacity = Math.max(0, linkCount - 1);
  const activeSkill = {...skills[skillId], baseDamage:Math.round(skills[skillId].baseDamage*(1+((skillLevels[skillId]??1)-1)*.06))};
  const build = { ...equippedItems, skill: activeSkill, supports: selectedSupports.map((id) => SUPPORTS[id]), supportSlots: linkCount, talents, classId, secondJobId, ascendancyNodes };
  const resolved = resolveStats(build);
  const dps = resolved.dps;
  const level = 1 + Math.floor(xp / 100);
  const maxTier = unlockedTier(dps);
  const powerGoal = nextPowerGoal(dps);
  const inCampaign = campaignStep < CAMPAIGN.length;
  const operation = CAMPAIGN[campaignStep];
  const talentPoints = Math.max(0, level - 1 - talents.length);
  const ascPoints = secondJobId ? Math.max(0, Math.min(3, Math.floor((level - 5) / 2)) - ascendancyNodes.length) : 0;
  const jobReady = level >= 6 && totalKills >= 180;
  const failureRisk = Math.round(contractFailureChance(build, tier, contractId) * 100);
  const evaluatedItems = items.map((item) => ({ item, evaluation: evaluateItem(item, build) })).sort((a,b) => Math.max(b.evaluation.dpsDelta,b.evaluation.survivalDelta,b.evaluation.clearDelta)-Math.max(a.evaluation.dpsDelta,a.evaluation.survivalDelta,a.evaluation.clearDelta));
  const bestUpgrade = evaluatedItems.find(({item,evaluation}) => equipped[item.slot] !== item.id && evaluation.classification === 'upgrade');

  const pushLogs = (entries: Array<[string,string]>) => setLogs((value) => [...value.slice(-115), ...entries.map(([kind,text], index) => ({ id: Date.now()+index+Math.random(), kind, text }))]);
  const pushLog = (kind:string,text:string) => pushLogs([[kind,text]]);

  const chooseClass = (id: ClassId) => {
    const definition = CLASSES[id];
    const starter = createStarterWeapon(id);
    setClassId(id); setClassChosen(true); setSecondJobId(undefined); setAscendancyNodes([]);
    setSkillId(definition.starterSkill); setAcquiredSkills([definition.starterSkill]); setSkillLevels({[definition.starterSkill]:1}); setItems([starter]); setEquipped({weapon:starter.id});
    setTalentBoard(id === 'thief' ? 'hunt' : id === 'mage' ? 'wisdom' : 'might');
    pushLogs([['JOB',`初心職業：${definition.name} · 固有特性「${definition.trait}」`],['ITEM',`取得 ${starter.name} · ${COLOR_LABEL[starter.sockets![0]]}洞`],['SKILL',`裝備技能寶石：${skills[definition.starterSkill].name}`]]);
  };

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get('fresh') === '1') window.localStorage.removeItem('terminal-arpg-save');
      const raw = window.localStorage.getItem('terminal-arpg-save');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.schemaVersion === 4) {
          setClassChosen(s.classChosen); setClassId(s.classId); setSecondJobId(s.secondJobId); setAscendancyNodes(s.ascendancyNodes); setTalentBoard(s.talentBoard); setTalents(s.talents);
          setSkillId(s.skillId); setAcquiredSkills(s.acquiredSkills); setSkillLevels(s.skillLevels??{[s.skillId]:1}); setAcquiredSupports(s.acquiredSupports); setSelectedSupports(s.selectedSupports); setPolicy(s.policy); setContractId(s.contractId);
          setMode(s.mode); setGoal(s.goal); setTier(s.tier); setMaps(s.maps); setCampaignStep(s.campaignStep); setLifetimeRuns(s.lifetimeRuns); setTotalKills(s.totalKills); setXp(s.xp);
          setItems(s.items); setEquipped(s.equipped); setMaterials(s.materials); setOrbs(s.orbs); setSalvageMode(s.salvageMode); seedRef.current=s.seed;
        }
      }
    } catch { /* Invalid saves fall back to a clean character. */ }
    setSaveLoaded(true);
  },[]);

  useEffect(() => {
    if (!saveLoaded || running) return;
    window.localStorage.setItem('terminal-arpg-save',JSON.stringify({schemaVersion:4,seed:seedRef.current,classChosen,classId,secondJobId,ascendancyNodes,talentBoard,talents,skillId,skillLevels,acquiredSkills,acquiredSupports,selectedSupports,policy,contractId,mode,goal,tier,maps,campaignStep,lifetimeRuns,totalKills,xp,items,equipped,materials,orbs,salvageMode}));
  },[saveLoaded,running,classChosen,classId,secondJobId,ascendancyNodes,talentBoard,talents,skillId,skillLevels,acquiredSkills,acquiredSupports,selectedSupports,policy,contractId,mode,goal,tier,maps,campaignStep,lifetimeRuns,totalKills,xp,items,equipped,materials,orbs,salvageMode]);

  const equipItem = (item:Item) => {
    const next = resolveStats({...build,[item.slot]:item,supportSlots:item.slot==='weapon'?itemLinks(item):linkCount});
    setEquipped(v=>({...v,[item.slot]:item.id}));
    if(item.slot==='weapon') setSelectedSupports(v=>v.slice(0,Math.max(0,itemLinks(item)-1)));
    pushLog('POWER',`換上 ${item.name} · DPS ${dps.toLocaleString()} → ${next.dps.toLocaleString()}`);
  };

  const spendOrb = (kind:keyof OrbWallet, transform:(item:Item)=>Item, label:string) => {
    if(!weapon || orbs[kind] < 1) return;
    const next=transform(weapon); setItems(v=>v.map(i=>i.id===weapon.id?next:i)); setOrbs(v=>({...v,[kind]:v[kind]-1}));
    pushLog('CRAFT',`${label}成功 · ${next.name} · 洞色 ${itemSockets(next).map(c=>COLOR_LABEL[c]).join('－')} · ${itemLinks(next)} 連`);
  };

  const finishMap = () => {
    if(inCampaign && operation){
      const reward=completeCampaignOperation(campaignStep,CLASSES[classId].starterSkill);
      if(reward.item) setItems(v=>[reward.item!,...v]);
      const support=SUPPORT_ORDER[campaignStep]; if(support)setAcquiredSupports(v=>v.includes(support)?v:[...v,support]);
      if(reward.materials)setMaterials(v=>({scrap:v.scrap+reward.materials!.scrap,essence:v.essence+reward.materials!.essence,core:v.core+reward.materials!.core}));
      if(reward.maps)setMaps(reward.maps); setXp(v=>v+reward.xp); setCampaignStep(v=>v+1); setRuns(1); setRunning(false); setProgress(100);
      pushLogs([['QUEST',`${operation.title} 完成 · ${operation.reward}`],['EXP',`角色 EXP +${reward.xp}`]]); return;
    }
    seedRef.current+=1; const result=simulateMapCompletion(seedRef.current,tier,policy,build,contractId);
    const completed=runs+1; setRuns(completed); setLifetimeRuns(v=>v+1); setXp(v=>v+result.xp); setTotalKills(v=>v+result.kills);
    if(result.success){
      const evaluation=evaluateItem(result.item,build); const auto=salvageMode==='common'?result.item.rarity==='COMMON':salvageMode==='smart'?evaluation.classification==='salvage'&&result.item.rarity!=='LEGENDARY':false;
      if(auto){const gain=salvageValue(result.item);setMaterials(v=>({scrap:v.scrap+gain.scrap,essence:v.essence+gain.essence,core:v.core+gain.core}));}
      else setItems(v=>[result.item,...v].slice(0,54));
      setOrbs(v=>({alteration:v.alteration+result.orbs.alteration,chromatic:v.chromatic+result.orbs.chromatic,fusing:v.fusing+result.orbs.fusing,jeweller:v.jeweller+result.orbs.jeweller}));
      setMaps(v=>{const n=[...v];n[1]+=1;if(result.mapDropTier>1)n[result.mapDropTier]+=1;return n;});
      if(result.gemDrop.type==='skill'){const id=result.gemDrop.id;const owned=acquiredSkills.includes(id);setAcquiredSkills(v=>v.includes(id)?v:[...v,id]);setSkillLevels(v=>({...v,[id]:(v[id]??0)+1}));pushLog('GEM',owned?`${skills[id].name} 寶石經驗 +1 · 升至 Lv.${(skillLevels[id]??1)+1}`:`技能寶石掉落：${skills[id].name} Lv.1 · ${COLOR_LABEL[skills[id].socketColor]}色`);}
      else {const id=result.gemDrop.id;setAcquiredSupports(v=>v.includes(id)?v:[...v,id]);pushLog('GEM',`輔助寶石掉落：${SUPPORTS[id].name} · ${COLOR_LABEL[SUPPORTS[id].socketColor]}色`);}
      const orbTotal=Object.values(result.orbs).reduce((a,b)=>a+b,0); setSessionLoot(v=>({items:v.items+(auto?0:1),gems:v.gems+1,orbs:v.orbs+orbTotal,xp:v.xp+result.xp}));
      pushLogs([[auto?'SALVAGE':'LOOT',auto?`${result.item.name} 自動分解`: `${result.item.rarity} ${result.item.name} · ${evaluation.dpsDelta>=0?'+':''}${evaluation.dpsDelta}% DPS`],['CURRENCY',`改造石 +${result.orbs.alteration} · 幻色石 +${result.orbs.chromatic} · 連結石 +${result.orbs.fusing} · 工匠石 +${result.orbs.jeweller}`],['EXP',`角色 EXP +${result.xp} · 本圖擊殺 ${result.kills}`]]);
    } else pushLog('DEATH',`${CONTRACTS[contractId].name} 失敗 · 保留少量經驗`);
    const projected=[...maps]; if(result.success){projected[1]+=1;if(result.mapDropTier>1)projected[result.mapDropTier]+=1;}
    const available=tier===1?1:projected[tier]; const reason=getRunStopReason({mode,completed,goal,elapsedMs:Date.now()-sessionStart.current,availableNext:available,tier});
    if(reason){setRunning(false);setProgress(100);pushLog('REPORT',`循環結束 · ${completed} 圖 · ${sessionLoot.items+(result.success?1:0)} 裝備 · ${sessionLoot.gems+(result.success?1:0)} 寶石 · ${sessionLoot.orbs+Object.values(result.orbs).reduce((a,b)=>a+b,0)} 通貨`);return;}
    window.setTimeout(()=>{if(tier>1)setMaps(v=>{const n=[...v];if(n[tier]>0)n[tier]-=1;return n;});setProgress(0);pushLog('ROUTE',`計算下一張 T${tier} 路線 · 座標 ${24+tier},${60+completed}`);},500);
  };

  useEffect(()=>{
    if(!running)return;
    const timer=window.setInterval(()=>setProgress(current=>{
      if(current>=100)return current;
      const next=Math.min(100,current+progressPerTick(build,tier,policy));
      const target=['波利','邪骸戰士','赤焰魔像','深淵守門者'][seedRef.current%4];
      for(let stage=Math.floor(current/20)+1;stage<=Math.floor(next/20);stage+=1){
        if(stage===1)pushLogs([['ROUTE',`移動至 ${target} · (${18+tier},${42+runs})`],['TARGET',`開始攻擊 ${target} · Lv.${tier*8}`]]);
        if(stage===2||stage===3){
          const delay=Math.max(70,Math.round(1000/(skills[skillId].attacksPerSecond*(1+(resolved.critChance/240)))));
          const rawCount=Math.min(8,Math.max(3,Math.round(skills[skillId].attacksPerSecond)));
          const hit=Math.max(1,Math.round(dps/skills[skillId].attacksPerSecond));
          const allRows=Array.from({length:rawCount},(_,i)=>{const crit=((i*29+seedRef.current+stage)%100)<Math.min(92,resolved.critChance);return [crit?'CRITICAL':'HIT',crit?`CRITICAL DAMAGE ${Math.round(hit*2.1).toLocaleString()} · ${skills[skillId].name} → ${target}`:`${skills[skillId].name} → ${target} (Dmg: ${hit.toLocaleString()}) (Delay: ${delay}ms)`] as [string,string];});
          let rows: Array<[string,string]>;
          if(combatDetail==='full')rows=allRows;
          else if(stage===3){const crits=allRows.filter(([kind])=>kind==='CRITICAL').length;rows=[['COMBO',`${skills[skillId].name} 第二輪 · ${rawCount} hits · ${crits} critical`]];}
          else if(secondJobId==='assassin')rows=allRows.filter(([kind],index)=>kind==='CRITICAL'||allRows.slice(0,index).filter(([prior])=>prior==='HIT').length<1);
          else rows=allRows.slice(0,2);
          const omitted=rawCount-rows.length;if(combatDetail==='compact'&&stage===2&&omitted>0)rows.push(['COMBO',`其餘 ${omitted} 擊合併 · 總連擊 ${rawCount}`]);pushLogs(rows);
        }
        if(stage===4)pushLogs([['SKILL',`使用 ${skills[skillId].name} · 清除 ${8+tier*4} 個目標`],['DROP','地面出現裝備、寶石與通貨訊號']]);
        if(stage===5)pushLog('BOSS',`首領房開啟 · 預估生命 ${Math.round(tier*resolved.bossDps*.8).toLocaleString()}`);
      }
      if(next>=100)window.setTimeout(finishMap,100);return next;
    }),330);
    return()=>window.clearInterval(timer);
  },[running,dps,tier,policy,skillId,runs,goal,mode,maps,contractId,combatDetail,secondJobId]);

  useEffect(()=>{logRef.current?.scrollTo({top:logRef.current.scrollHeight,behavior:'smooth'});},[logs]);

  const start=()=>{
    if(inCampaign){setRuns(0);setProgress(0);setRunning(true);pushLog('QUEST',`接受 ${operation.title} · ${operation.lesson}`);return;}
    if(tier>maxTier){pushLog('WARN',`有效 DPS 需達 ${TIER_POWER_REQUIREMENTS[tier].toLocaleString()} 才能進入 T${tier}`);return;}
    const startTier=tier===1||maps[tier]>0?tier:1;if(startTier!==tier){setTier(1);pushLog('RECOVER','高階圖已耗盡，切回無限 T1 繼續成長');}
    if(startTier>1)setMaps(v=>{const n=[...v];n[startTier]-=1;return n;});
    setRuns(0);setSessionLoot({items:0,gems:0,orbs:0,xp:0});setProgress(0);sessionStart.current=Date.now();setRunning(true);
    pushLogs([['AI',`啟動 T${startTier} · ${policies[policy][0]} · ${mode==='count'?`${goal} 張`:mode==='time'?`${goal*10} 秒`:'直到地圖耗盡'}`],['ROUTE','載入地圖資料 · 出生點 (12,08)']]);
  };

  const toggleSupport=(id:SupportId)=>{if(selectedSupports.includes(id)){setSelectedSupports(v=>v.filter(x=>x!==id));return;}if(selectedSupports.length>=supportCapacity){pushLog('WARN',`${linkCount} 連裝備僅能容納主技能與 ${supportCapacity} 顆輔助`);return;}setSelectedSupports(v=>[...v,id]);};
  const buyTalent=(id:string,requires?:string)=>{if(talentPoints<1||talents.includes(id)||(requires&&!talents.includes(requires)))return;setTalents(v=>[...v,id]);pushLog('TALENT',`配置天賦：${TALENTS.find(n=>n.id===id)?.name}`);};
  const upgradeMap=(from:number)=>{if(maps[from]<3)return;setMaps(v=>exchangeMaps(v,from));pushLog('MAP',`地圖三換一 · T${from} ×3 → T${from+1} ×1`);};

  if(!saveLoaded)return null;
  return <main className="min-h-screen bg-background text-foreground"><div className="scanlines" aria-hidden="true" />
    <header className="border-b border-border/80 bg-card/80"><div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3 sm:px-6"><div className="flex items-center gap-3"><div className="brand-mark"><CircleDot className="size-5"/></div><div><div className="flex gap-2"><h1 className="font-mono text-sm font-bold tracking-[.16em] text-primary">TERMINAL ARPG</h1><span className="rounded border border-primary/30 px-1.5 font-mono text-[9px] text-primary">ALPHA 0.7</span></div><p className="text-[11px] text-muted-foreground">RO 職業 × 技能寶石 × 自動遠征</p></div></div><div className="text-right font-mono text-xs"><b className="text-primary">Lv.{level} · {classChosen?(secondJobId?SECOND_JOBS[secondJobId].name:CLASSES[classId].name):'未選職'}</b><small className="block text-muted-foreground">DPS {dps.toLocaleString()}</small></div></div></header>
    {!classChosen&&<div className="mx-auto max-w-4xl px-4 py-12"><Panel title="選擇初心職業" icon={Swords}><p className="mb-5 text-sm text-muted-foreground">每個職業從一把新手武器與一顆技能寶石開始。技能不綁職業，後續都能靠掉落取得。</p><div className="grid gap-3 md:grid-cols-3">{(Object.keys(CLASSES) as ClassId[]).map(id=>{const c=CLASSES[id];return <button key={id} onClick={()=>chooseClass(id)} className="class-card"><small>一轉職業</small><b>{c.name}</b><strong>{c.trait}</strong><p>{c.description}</p><em>起始技能：{skills[c.starterSkill].name}</em></button>})}</div></Panel></div>}
    {classChosen&&<><div className="mx-auto grid max-w-[1500px] grid-cols-4 gap-2 px-4 pt-4 sm:grid-cols-5 sm:px-6"><Resource label="改造石" value={orbs.alteration} purpose="重鑄"/><Resource label="幻色石" value={orbs.chromatic} purpose="換色"/><Resource label="連結石" value={orbs.fusing} purpose="連洞"/><Resource label="工匠石" value={orbs.jeweller} purpose="加洞"/><div className="hidden sm:block"><Resource label="精華" value={materials.essence} purpose="保證詞綴"/></div></div>
    <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
      <aside className="space-y-4">
        <Panel title="戰力成長" icon={TrendingUp}><div className="flex justify-between"><div><small className="text-muted-foreground">有效 DPS</small><b className="block font-mono text-2xl text-primary">{dps.toLocaleString()}</b></div><div className="text-right"><small className="text-muted-foreground">下一階</small><b className="block text-sm">{powerGoal?`T${powerGoal.tier} · ${powerGoal.dps.toLocaleString()}`:'全開放'}</b></div></div>{bestUpgrade&&<Button className="mt-3 w-full" variant="secondary" disabled={running} onClick={()=>equipItem(bestUpgrade.item)}>換上最佳裝備 · +{Math.max(bestUpgrade.evaluation.dpsDelta,bestUpgrade.evaluation.survivalDelta,bestUpgrade.evaluation.clearDelta)}%</Button>}</Panel>
        {inCampaign?<Panel title={`新手遠征 ${campaignStep+1}/6`} icon={Map}><div className="mission-card"><small>介面教學</small><b>{operation.title}</b><p>{operation.briefing}</p><div><span>學習</span>{operation.lesson}</div><div><span>獎勵</span>{operation.reward}</div></div></Panel>:<Panel title="地圖裝置" icon={Map}><div className="grid grid-cols-5 gap-1">{[1,2,3,4,5].map(v=><button aria-label={`選擇 T${v} 地圖`} key={v} disabled={running||v>maxTier||(v>1&&maps[v]===0)} onClick={()=>setTier(v)} className={`tier-button ${tier===v?'active':''}`}><b>T{v}</b><small>{v===1?`∞ · 印 ${maps[1]}`:`×${maps[v]}`}</small></button>)}</div><div className="mt-3 grid grid-cols-4 gap-1">{[1,2,3,4].map(v=><button aria-label={`使用三張 T${v} 兌換一張 T${v+1}`} key={v} disabled={running||maps[v]<3} onClick={()=>upgradeMap(v)} className="mode-button">T{v} 三換一</button>)}</div><div className="mt-4 space-y-2">{(Object.keys(policies) as Policy[]).map(id=><button aria-label={`選擇${policies[id][0]}`} key={id} disabled={running} onClick={()=>setPolicy(id)} className={`setting-row ${policy===id?'active':''}`}><span><b>{policies[id][0]}</b><small>{policies[id][1]}</small></span><i aria-hidden="true"/></button>)}</div><div className="mt-3 grid grid-cols-3 gap-1">{(Object.keys(CONTRACTS) as ContractId[]).map(id=><button aria-label={`選擇${CONTRACTS[id].name}`} key={id} disabled={running} onClick={()=>setContractId(id)} className={`mode-button ${contractId===id?'active':''}`}>{CONTRACTS[id].name}</button>)}</div><p className="mt-2 text-[10px] text-muted-foreground">目前失敗風險 {failureRisk}%</p></Panel>}
        <Panel title={inCampaign?'任務執行':'持續執行'} icon={InfinityIcon}>{!inCampaign&&<><div className="grid grid-cols-3 gap-1">{([['count','次數'],['time','時間'],['empty','耗盡']] as const).map(([id,label])=><button key={id} disabled={running} onClick={()=>setMode(id)} className={`mode-button ${mode===id?'active':''}`}>{label}</button>)}</div>{mode!=='empty'&&<div className="mt-4"><div className="mb-2 flex justify-between text-xs"><span>{mode==='count'?'張數':'時間'}</span><b>{mode==='count'?`${goal} 張`:`${goal*10} 秒`}</b></div><Slider min={1} max={mode==='count'?30:18} value={[goal]} disabled={running} onValueChange={v=>setGoal(Array.isArray(v)?v[0]:v)}/></div>}</>}<Button className="run-button mt-4 w-full" onClick={running?()=>{setRunning(false);pushLog('PAUSE','玩家中止循環');}:start}>{running?<><Pause/>停止</>:<><Play/>{inCampaign?'執行任務':'啟動自動刷圖'}</>}</Button></Panel>
      </aside>
      <section className="min-w-0 space-y-4">
        <div className="character-hud"><div><b>{secondJobId?SECOND_JOBS[secondJobId].name:CLASSES[classId].name} Lv.{level}</b><small>{skills[skillId].name} · {CLASSES[classId].trait}</small></div><StatusBar label="HP" value={resolved.life} max={resolved.life} tone="hp"/><StatusBar label="MP" value={Math.round(140+level*22)} max={Math.round(140+level*22)} tone="mp"/><StatusBar label="EXP" value={xp%100} max={100} tone="xp"/></div>
        <div className="field-map" aria-label="地圖探索視圖">{Array.from({length:60},(_,i)=>{const player=Math.min(59,Math.floor(progress*.59));return <i key={i} className={i===player?'player':i===55?'boss':i%13===0?'monster':i%9===0?'wall':''}>{i===player?'◆':i===55?'B':i%13===0?'×':''}</i>})}<span>PLAYER ◆　MONSTER ×　BOSS B</span></div>
        <div className="terminal-grid"><div className="terminal-shell"><div className="terminal-titlebar"><span className="font-mono text-[10px] text-primary">戰鬥終端://T{tier}/{skills[skillId].name}</span><div className="flex gap-1"><button onClick={()=>setCombatDetail('compact')} className={combatDetail==='compact'?'active':''}>精簡</button><button onClick={()=>setCombatDetail('full')} className={combatDetail==='full'?'active':''}>完整</button></div><span className="font-mono text-[10px] text-muted-foreground">{running?`RUN ${runs+1}`:'IDLE'}</span></div><div ref={logRef} className="terminal-output">{logs.map(log=><div key={log.id} className={`log-line log-${log.kind.toLowerCase()}`}><time>{log.id===1?'00:00:00':new Date(log.id).toLocaleTimeString('zh-TW',{hour12:false}).slice(0,8)}</time><b>[{log.kind}]</b><span>{log.text}</span></div>)}{running&&<div className="terminal-cursor">&gt; attack.auto<i/></div>}</div></div><div className="chat-shell"><div className="chat-title">區域聊天 <span>單機預覽</span></div><div className="chat-output">{chat.map(row=><p key={row.id}><b>[{row.name}]</b> {row.text}</p>)}</div><form onSubmit={event=>{event.preventDefault();const text=chatInput.trim();if(!text)return;setChat(v=>[...v.slice(-30),{id:Date.now(),name:'你',text}]);setChatInput('');}}><input aria-label="聊天訊息" value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="輸入訊息…"/><button>送出</button></form></div></div>
        <div className="panel p-4"><div className="flex justify-between"><div><div className="section-label"><Activity className="size-3.5"/>T{tier} 探索 {progress}%</div><p className="mt-1 text-xs text-muted-foreground">本輪 {runs} 圖 · 累計 {lifetimeRuns} 圖 · T1 永久可進入</p></div><b className="font-mono text-xl text-primary">{totalKills} KILLS</b></div><div className="progress-track mt-3"><div className="progress-fill" style={{width:`${progress}%`}}/></div><div className="mt-3 grid grid-cols-4 gap-2"><Mini label="裝備" value={String(sessionLoot.items)}/><Mini label="寶石" value={String(sessionLoot.gems)}/><Mini label="通貨" value={String(sessionLoot.orbs)}/><Mini label="經驗" value={String(sessionLoot.xp)}/></div></div>
      </section>
      <aside className="space-y-4">
        {!secondJobId&&<Panel title="二轉挑戰" icon={Zap}><p className="mb-3 text-xs text-muted-foreground">Lv.6 且累計擊殺 180 後，可挑戰一條二轉路線。</p>{CLASSES[classId].jobs.map(id=>{const j=SECOND_JOBS[id];return <button key={id} disabled={!jobReady||running} onClick={()=>{setSecondJobId(id);pushLog('JOB',`二轉試煉完成 · ${j.name} · 獲得「${j.trait}」`);}} className="setting-row"><span><b>{j.name} · {j.trait}</b><small>{j.description}</small></span><em>{jobReady?'挑戰':'未達成'}</em></button>})}</Panel>}
        {secondJobId&&<Panel title={`${SECOND_JOBS[secondJobId].name}特殊節點 · ${ascPoints} 點`} icon={Zap}><div className="space-y-2">{SECOND_JOBS[secondJobId].nodes.map((n,i)=><button key={n.id} disabled={running||ascPoints<1||ascendancyNodes.includes(n.id)||(i>0&&!ascendancyNodes.includes(SECOND_JOBS[secondJobId].nodes[i-1].id))} onClick={()=>setAscendancyNodes(v=>[...v,n.id])} className={`setting-row ${ascendancyNodes.includes(n.id)?'active':''}`}><span><b>{n.name}</b><small>{n.description}</small></span><em>{ascendancyNodes.includes(n.id)?'已配置':'+'}</em></button>)}</div></Panel>}
        <Panel title={`天賦 · ${talentPoints} 點`} icon={TrendingUp}><div className="grid grid-cols-3 gap-1">{(Object.keys(TALENT_BOARDS) as TalentBoardId[]).map(id=><button key={id} onClick={()=>setTalentBoard(id)} className={`mode-button ${talentBoard===id?'active':''}`}>{TALENT_BOARDS[id].name}</button>)}</div><div className="mt-3 space-y-2">{TALENTS.filter(n=>n.board===talentBoard).map(n=><button key={n.id} disabled={running||talentPoints<1||talents.includes(n.id)||(!!n.requires&&!talents.includes(n.requires))} onClick={()=>buyTalent(n.id,n.requires)} className={`setting-row ${talents.includes(n.id)?'active':''}`}><span><b>{n.name}</b><small>{n.description}</small></span><em>{talents.includes(n.id)?'已配置':'+'}</em></button>)}</div>{talents.length>0&&<button disabled={running} onClick={()=>setTalents([])} className="mt-3 text-xs text-muted-foreground underline">免費重置天賦</button>}</Panel>
        <Panel title="技能寶石與連線" icon={Swords}><div className="space-y-2">{(Object.keys(skills) as SkillId[]).map(id=>{const s=skills[id],owned=acquiredSkills.includes(id);return <button key={id} disabled={running||!owned} onClick={()=>setSkillId(id)} className={`skill-card ${skillId===id?'active':''}`} style={{'--skill-color':s.color} as React.CSSProperties}><span className={`socket socket-${s.socketColor.toLowerCase()}`}>{s.socketColor}</span><span><b>{s.name} {owned?`Lv.${skillLevels[id]??1}`:''}</b><small>{owned?s.description:'尚未掉落'}</small></span><em>{owned?Math.round(s.baseDamage*(1+((skillLevels[id]??1)-1)*.06)):'LOCK'}</em></button>})}</div><div className="socket-chain mt-3">{itemSockets(weapon).map((c,i)=><span key={i} className={`socket socket-${c.toLowerCase()}`}>{c}{i<itemLinks(weapon)-1&&<i/>}</span>)}</div><p className="mt-2 text-[10px] text-muted-foreground">主技能占 1 洞。顏色吻合且位於連線內的輔助才生效。</p><div className="mt-3 space-y-2">{SUPPORT_ORDER.map(id=>{const s=SUPPORTS[id],owned=acquiredSupports.includes(id),active=selectedSupports.includes(id);return <button key={id} disabled={running||!owned} onClick={()=>toggleSupport(id)} className={`setting-row ${active?'active':''}`}><span><b><i className={`socket socket-${s.socketColor.toLowerCase()}`}>{s.socketColor}</i> {s.name}</b><small>{owned?s.description:'尚未掉落'}</small></span><em>{active?'已裝備':owned?'裝備':'LOCK'}</em></button>})}</div></Panel>
        {!inCampaign&&<Panel title="通貨打造" icon={Anvil}><div className="space-y-2"><Craft label="改造石：重鑄主詞綴" count={orbs.alteration} onClick={()=>spendOrb('alteration',refineItem,'改造')}/><Craft label="幻色石：改變洞色" count={orbs.chromatic} onClick={()=>spendOrb('chromatic',recolorSockets,'換色')}/><Craft label="工匠石：增加洞數" count={orbs.jeweller} onClick={()=>spendOrb('jeweller',addSocket,'打洞')}/><Craft label="連結石：增加連線" count={orbs.fusing} onClick={()=>spendOrb('fusing',addLink,'連線')}/><button disabled={materials.essence<1||!weapon} onClick={()=>{if(!weapon)return;const n=essenceCraft(weapon);setItems(v=>v.map(i=>i.id===weapon.id?n:i));setMaterials(v=>({...v,essence:v.essence-1}));}} className="craft-button">精華：保證新增一條詞綴 <em>×{materials.essence}</em></button><button disabled={materials.core<1||!weapon} onClick={()=>{if(!weapon)return;const n=ascendItem(weapon);setItems(v=>v.map(i=>i.id===weapon.id?n:i));setMaterials(v=>({...v,core:v.core-1}));}} className="craft-button">核心：升華裝備 <em>×{materials.core}</em></button></div></Panel>}
        <Panel title="六格裝備與背包" icon={Box}><div className="mb-3 grid grid-cols-2 gap-2">{(Object.keys(SLOT_LABELS) as ItemSlot[]).map(slot=><Equip key={slot} slot={SLOT_LABELS[slot]} item={equippedItems[slot]}/>)}</div><div className="mb-3 grid grid-cols-3 gap-1">{([['off','不分解'],['common','普通以下'],['smart','智慧分解']] as const).map(([id,label])=><button key={id} onClick={()=>setSalvageMode(id)} className={`mode-button ${salvageMode===id?'active':''}`}>{label}</button>)}</div><div className="inventory-list">{evaluatedItems.map(({item,evaluation})=>{const used=equipped[item.slot]===item.id;const gain=Math.max(evaluation.dpsDelta,evaluation.survivalDelta,evaluation.clearDelta);return <button key={item.id} disabled={running||used} onClick={()=>equipItem(item)} className={`inventory-item ${used?'equipped':''}`}><span className={`rarity rarity-${item.rarity.toLowerCase()}`}>{item.rarity}</span><span><b>{gain>=0?'+':''}{gain}% · {item.name}</b><small>{SLOT_LABELS[item.slot]} · {item.slot==='weapon'?`${itemLinks(item)} 連 · `:''}{formatAffixes(item)}</small></span><em>{used?'使用中':evaluation.classification==='upgrade'?'升級':'素材'}</em></button>})}</div></Panel>
      </aside>
    </div></>}
  </main>;
}

function Panel({title,icon:Icon,children}:{title:string;icon:typeof Activity;children:React.ReactNode}){return <section className="panel p-4"><div className="section-label"><Icon className="size-3.5"/>{title}</div><div className="mt-3">{children}</div></section>}
function Mini({label,value}:{label:string;value:string}){return <div className="metric-tile"><small>{label}</small><b>{value}</b></div>}
function Equip({slot,item}:{slot:string;item?:Item}){return <div className="equip-slot"><small>{slot}</small><b>{item?.name??'空'}</b><span>{item?`${item.slot==='weapon'?`${itemLinks(item)} 連 · `:''}${formatAffixes(item)}`:'等待掉落'}</span></div>}
function Resource({label,value,purpose}:{label:string;value:number;purpose:string}){return <div className="resource-tile"><Coins/><span><small>{label}</small><b>{value}</b></span><em>{purpose}</em></div>}
function Craft({label,count,onClick}:{label:string;count:number;onClick:()=>void}){return <button disabled={count<1} onClick={onClick} className="craft-button"><span>{label}</span><em>×{count}</em></button>}
function StatusBar({label,value,max,tone}:{label:string;value:number;max:number;tone:string}){return <div className="status-bar"><span><b>{label}</b><em>{value}/{max}</em></span><i><u className={tone} style={{width:`${Math.min(100,value/max*100)}%`}}/></i></div>}
