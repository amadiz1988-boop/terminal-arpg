'use client';
/* oxlint-disable react/react-compiler, react-hooks/exhaustive-deps */

import { useEffect, useRef, useState } from 'react';
import { Activity, Box, ChevronsUp, CircleDot, Crosshair, Flame, Infinity as InfinityIcon, Map, Pause, Play, Shield, Swords, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { POLICIES as policies, SKILLS as skills } from '@/game/content/skills';
import { CAMPAIGN } from '@/game/content/campaign';
import { CONTRACTS, MASTERIES } from '@/game/content/contracts';
import type { ContractId, Item, MasteryId, Policy, RunMode as Mode, SkillId } from '@/game/core/types';
import { createStarterWeapon, evaluateItem, formatAffixes, generateItem, refineItem, salvageValue } from '@/game/items/items';
import { resolveStats } from '@/game/modifiers/resolve-stats';
import { completeCampaignOperation } from '@/game/progression/campaign';
import { contractFailureChance, getRunStopReason, progressPerTick, selectNextTier, simulateMapCompletion } from '@/game/simulation/map';

type Log = { id: number; kind: string; text: string };
const skillIcons = { ember: Flame, arc: Zap, quake: Shield } as const;

export function GameShell() {
  const [saveLoaded, setSaveLoaded] = useState(false);
  const [skillId, setSkillId] = useState<SkillId>('ember');
  const [policy, setPolicy] = useState<Policy>('full-clear');
  const [mode, setMode] = useState<Mode>('count');
  const [goal, setGoal] = useState(5);
  const [tier, setTier] = useState(1);
  const [maps, setMaps] = useState([0, 0, 0, 0, 0, 0]);
  const [campaignStep, setCampaignStep] = useState(0);
  const [acquiredSkills, setAcquiredSkills] = useState<SkillId[]>(['ember']);
  const [selectedUnlock, setSelectedUnlock] = useState<SkillId>('arc');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [runs, setRuns] = useState(0);
  const [totalKills, setTotalKills] = useState(0);
  const [currency, setCurrency] = useState(0);
  const [xp, setXp] = useState(0);
  const [items, setItems] = useState<Item[]>([createStarterWeapon()]);
  const [equipped, setEquipped] = useState<{ weapon?: string; armor?: string }>({ weapon: 'starter-weapon' });
  const [materials, setMaterials] = useState({ scrap: 0, essence: 0, core: 0 });
  const [salvageMode, setSalvageMode] = useState<'off'|'common'|'smart'>('common');
  const [contractId, setContractId] = useState<ContractId>('scout');
  const [masteries, setMasteries] = useState<Record<MasteryId, number>>({ power: 0, tempo: 0, guard: 0 });
  const [huntTarget, setHuntTarget] = useState<'weapon'|'armor'|'materials'>('weapon');
  const [huntProgress, setHuntProgress] = useState(0);
  const [logs, setLogs] = useState<Log[]>([{ id: 1, kind: 'SYS', text: '自動刷圖核心已就緒，請設定循環條件。' }]);
  const sessionStart = useRef(0);
  const runStart = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const seedRef = useRef(824);
  const skill = skills[skillId];
  const weapon = items.find((item) => item.id === equipped.weapon);
  const armor = items.find((item) => item.id === equipped.armor);
  const resolved = resolveStats({ skill, weapon, armor, masteries });
  const dps = resolved.dps;
  const failureRisk = Math.round(contractFailureChance({ skill, weapon, armor, masteries }, tier, contractId) * 100);
  const evaluatedItems = items.map((item) => ({ item, evaluation: evaluateItem(item, { skill, weapon, armor, masteries }) })).sort((a, b) => Math.max(b.evaluation.dpsDelta, b.evaluation.survivalDelta) - Math.max(a.evaluation.dpsDelta, a.evaluation.survivalDelta));
  const level = 1 + Math.floor(xp / 100);
  const spentMastery = Object.values(masteries).reduce((sum, value) => sum + value, 0);
  const masteryPoints = Math.max(0, Math.floor((level - 1) / 2) - spentMastery);
  const noMaps = maps.slice(1).every((count) => count === 0);
  const inCampaign = campaignStep < CAMPAIGN.length;
  const operation = CAMPAIGN[campaignStep];
  const blueprintSkill = campaignStep > 2 ? skills[selectedUnlock] : skills.ember;

  const pushLog = (kind: string, text: string) => setLogs((value) => [...value.slice(-70), { id: Date.now() + Math.random(), kind, text }]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('terminal-arpg-save');
      if (raw) {
        const save = JSON.parse(raw);
        if (save.schemaVersion === 1) {
          setSkillId(save.skillId); setPolicy(save.policy); setMode(save.mode); setGoal(save.goal); setTier(save.tier);
          setMaps(save.maps); setCampaignStep(save.campaignStep); setAcquiredSkills(save.acquiredSkills);
          setSelectedUnlock(save.selectedUnlock); setCurrency(save.currency); setXp(save.xp); setItems(save.items.filter((item: Item, index: number, all: Item[]) => all.findIndex((candidate) => candidate.id === item.id) === index));
          setEquipped(save.equipped); setMaterials(save.materials); setTotalKills(save.totalKills); setSalvageMode(save.salvageMode ?? 'common');
          setContractId(save.contractId ?? 'scout'); setMasteries(save.masteries ?? { power: 0, tempo: 0, guard: 0 });
          setHuntTarget(save.huntTarget ?? 'weapon'); setHuntProgress(save.huntProgress ?? 0);
          seedRef.current = save.seed ?? 824 + (save.totalKills ?? 0);
        }
      }
    } catch { /* Corrupt local saves fall back to the versioned starter state. */ }
    setSaveLoaded(true);
  }, []);

  useEffect(() => {
    if (!saveLoaded || running) return;
    window.localStorage.setItem('terminal-arpg-save', JSON.stringify({ schemaVersion: 1, seed: seedRef.current, skillId, policy, mode, goal, tier, maps, campaignStep, acquiredSkills, selectedUnlock, currency, xp, items, equipped, materials, totalKills, salvageMode, contractId, masteries, huntTarget, huntProgress }));
  }, [saveLoaded, running, skillId, policy, mode, goal, tier, maps, campaignStep, acquiredSkills, selectedUnlock, currency, xp, items, equipped, materials, totalKills, salvageMode, contractId, masteries, huntTarget, huntProgress]);

  const finishMap = () => {
    const completed = runs + 1;
    if (inCampaign && operation) {
      const reward = completeCampaignOperation(campaignStep, selectedUnlock);
      if (reward.item) setItems((value) => [reward.item!, ...value]);
      if (reward.unlockSkill) setAcquiredSkills((value) => value.includes(reward.unlockSkill!) ? value : [...value, reward.unlockSkill!]);
      if (reward.materials) setMaterials((value) => ({ scrap: value.scrap + reward.materials!.scrap, essence: value.essence + reward.materials!.essence, core: value.core + reward.materials!.core }));
      if (reward.maps) setMaps(reward.maps);
      setRuns(1); setXp((value) => value + reward.xp); setCurrency((value) => value + reward.currency);
      setRunning(false); setProgress(100); setCampaignStep((value) => value + 1);
      pushLog('QUEST', `${operation.title} 完成 · ${operation.reward}${reward.item ? ` · ${reward.item.name}` : ''}`);
      return;
    }
    seedRef.current += 1;
    const result = simulateMapCompletion(seedRef.current, tier, policy, { skill, weapon, armor, masteries }, contractId);
    const newCurrency = result.currency;
    const mapDropTier = result.mapDropTier;
    const drop = result.item;
    const dropEvaluation = evaluateItem(drop, { skill, weapon, armor, masteries });
    const shouldSalvage = salvageMode === 'common' ? drop.rarity === 'COMMON' : salvageMode === 'smart' ? dropEvaluation.classification === 'salvage' && drop.rarity !== 'LEGENDARY' : false;
    setRuns(completed); setCurrency((v) => v + newCurrency); setXp((v) => v + result.xp);
    if (result.success) {
      const nextHunt = huntProgress + 1;
      if (nextHunt >= 4) {
        if (huntTarget === 'materials') setMaterials((value) => ({ scrap: value.scrap + 8, essence: value.essence + 2, core: value.core + 1 }));
        else setItems((value) => [generateItem(seedRef.current + 4040, tier * 18 + 20, huntTarget), ...value].slice(0, 24));
        setHuntProgress(0); pushLog('HUNT', `${huntTarget === 'weapon' ? '武器' : huntTarget === 'armor' ? '護甲' : '材料'}獵取完成 · 目標獎勵已送達`);
      } else setHuntProgress(nextHunt);
    }
    if (!result.success) {
      pushLog('DEATH', `${CONTRACTS[contractId].name} 失敗 · 保留少量經驗，未取得戰利品`);
    } else if (shouldSalvage) {
      const gained = salvageValue(drop);
      setMaterials((value) => ({ scrap: value.scrap + gained.scrap, essence: value.essence + gained.essence, core: value.core + gained.core }));
    } else {
      setItems((value) => [drop, ...value].slice(0, 24));
    }
    if (result.success) setMaps((value) => { const next = [...value]; next[mapDropTier] += 1; return next; });
    if (result.success) pushLog(shouldSalvage ? 'SALVAGE' : 'LOOT', shouldSalvage ? `${drop.rarity} ${drop.name} 自動分解 · 廢料 +${salvageValue(drop).scrap}` : `${drop.rarity} ${drop.name} · ${dropEvaluation.dpsDelta >= 0 ? '+' : ''}${dropEvaluation.dpsDelta}% DPS · 通貨 +${newCurrency} · T${mapDropTier} 地圖 +1`);
    const projectedMaps = [...maps]; if (result.success) projectedMaps[mapDropTier] += 1;
    const nextTier = selectNextTier(projectedMaps, tier) ?? tier;
    const availableNext = projectedMaps.slice(1).reduce((sum, value) => sum + value, 0);
    const reason = getRunStopReason({ mode, completed, goal, elapsedMs: Date.now() - sessionStart.current, availableNext, tier: nextTier });
    if (reason) {
      setRunning(false); setProgress(100); pushLog('EXIT', `循環完成，共刷 ${completed} 張地圖 · ${reason}。`); return;
    }
    window.setTimeout(() => {
      setMaps((value) => { const next = [...value]; if (next[nextTier] > 0) next[nextTier] -= 1; return next; });
      setTier(nextTier); setProgress(0); runStart.current = Date.now(); pushLog('MAP', `自動${nextTier!==tier?`升階至 T${nextTier}`:`投入下一張 T${nextTier}`}，總庫存剩餘 ${Math.max(0, availableNext - 1)} 張。`);
    }, 650);
  };

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 100) return current;
        const speed = progressPerTick({ skill, weapon, armor }, tier, policy);
        const next = Math.min(100, current + speed);
        const stage = Math.floor(next / 20);
        if (stage !== Math.floor(current / 20)) {
          const events = [
            ['SCAN', `T${tier} 怪群已鎖定，威脅等級 ${tier * 17}`],
            ['CAST', `${skill.name} 清除 ${7 + tier * 2} 個目標`],
            ['DROP', `拾取餘燼碎片 ×${tier + 2}`],
            ['RARE', `遭遇稀有敵人，生命 ${tier * 8200}`],
            ['BOSS', policy === 'boss-rush' ? '切換首領配置，集中火力' : '首領區域已加入路徑'],
          ];
          const event = events[Math.min(stage - 1, 4)]; if (event) pushLog(event[0], event[1]);
          setTotalKills((v) => v + 5 + tier * 2);
        }
        if (next >= 100) window.setTimeout(finishMap, 120);
        return next;
      });
    }, 360);
    return () => window.clearInterval(timer);
  }, [running, dps, tier, policy, skill.name, runs, goal, mode, maps, huntProgress, huntTarget]);

  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }); }, [logs]);

  const start = () => {
    if (inCampaign && operation) {
      if (campaignStep === 1 && !armor) { pushLog('WARN', '先從背包裝上剛取得的護甲，確認數值變化。'); return; }
      setRuns(0); setProgress(0); sessionStart.current = Date.now(); runStart.current = Date.now(); setRunning(true);
      pushLog('QUEST', `接受 ${operation.title} · ${operation.lesson}`); return;
    }
    const startTier = maps[tier] > 0 ? tier : selectNextTier(maps, tier);
    if (!startTier) { pushLog('WARN', '所有地圖已耗盡，先執行免費邊境巡邏。'); return; }
    setTier(startTier);
    setMaps((value) => { const next = [...value]; next[startTier] -= 1; return next; });
    setRuns(0); setProgress(0); sessionStart.current = Date.now(); runStart.current = Date.now(); setRunning(true);
    pushLog('AI', `啟動 ${CONTRACTS[contractId].name} · ${policies[policy][0]} · T${startTier} · ${mode === 'count' ? `${goal} 張` : mode === 'time' ? `${goal * 10} 秒` : '直到地圖耗盡'}`);
  };

  return <main className="min-h-screen bg-background text-foreground">
    <div className="scanlines" aria-hidden="true" />
    <header className="border-b border-border/80 bg-card/80 backdrop-blur-xl"><div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3 sm:px-6"><div className="flex items-center gap-3"><div className="brand-mark"><CircleDot className="size-5" /></div><div><div className="flex items-center gap-2"><h1 className="font-mono text-sm font-bold tracking-[.18em] text-primary">TERMINAL ARPG</h1><span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-.5 font-mono text-[9px] text-primary">ALPHA 0.4</span></div><p className="text-[11px] text-muted-foreground">目標獵取 · 自動升階 · 永不卡死</p></div></div><div className="flex gap-4 font-mono text-xs"><span>Lv.{level}</span><span className="text-amber-300">◈ {currency}</span><span className="hidden text-muted-foreground sm:inline">廢料 {materials.scrap} · 精華 {materials.essence}</span><span className="hidden text-muted-foreground sm:inline">XP {xp % 100}/100</span></div></div></header>

    <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[300px_minmax(0,1fr)_330px]">
      <aside className="space-y-4">
        {inCampaign && operation ? <Panel title="行動指引" icon={Crosshair}>
          <div className="mission-card"><small>BUILD 啟動進度 {campaignStep}/6</small><b>{operation.title}</b><p>{operation.briefing}</p><div><span>學習</span>{operation.lesson}</div><div><span>獎勵</span>{operation.reward}</div></div>
          {campaignStep === 2 && <div className="mt-3"><div className="field-label">選擇技能分支</div><div className="mt-2 grid grid-cols-2 gap-2"><button disabled={running} onClick={() => setSelectedUnlock('arc')} className={`mode-button ${selectedUnlock==='arc'?'active':''}`}>裂空電弧</button><button disabled={running} onClick={() => setSelectedUnlock('quake')} className={`mode-button ${selectedUnlock==='quake'?'active':''}`}>玄鐵震地</button></div></div>}
        </Panel> : <Panel title="地圖終端" icon={Map}>
          <div className="grid grid-cols-5 gap-1">{[1,2,3,4,5].map((value) => <button key={value} disabled={running || maps[value] === 0} onClick={() => setTier(value)} className={`tier-button ${tier === value ? 'active' : ''}`}><b>T{value}</b><small>×{maps[value]}</small></button>)}</div>
          <div className="mt-4 space-y-2"><div className="field-label">刷圖策略</div>{(Object.keys(policies) as Policy[]).map((id) => <button key={id} aria-label={`${policies[id][0]}：${policies[id][1]}`} disabled={running} onClick={() => setPolicy(id)} className={`setting-row ${policy === id ? 'active' : ''}`}><span><b>{policies[id][0]}</b><small>{policies[id][1]}</small></span><i aria-hidden="true" /></button>)}</div>
          <div className="mt-4 space-y-2"><div className="flex items-center justify-between"><div className="field-label">地圖契約</div><b className={failureRisk>20?'text-xs text-red-400':'text-xs text-emerald-400'}>失敗風險 {failureRisk}%</b></div>{(Object.keys(CONTRACTS) as ContractId[]).map((id) => <button key={id} aria-label={`${CONTRACTS[id].name}：${CONTRACTS[id].description}`} disabled={running} onClick={() => setContractId(id)} className={`setting-row ${contractId === id ? 'active' : ''}`}><span><b>{CONTRACTS[id].name}</b><small>{CONTRACTS[id].description}</small></span><i aria-hidden="true" /></button>)}</div>
        </Panel>}
        <Panel title={inCampaign ? '任務執行' : '持續執行'} icon={InfinityIcon}>
          {!inCampaign && <>
          <div className="grid grid-cols-3 gap-1">{([['count','次數'],['time','時間'],['empty','耗盡']] as const).map(([id,label]) => <button key={id} disabled={running} onClick={() => setMode(id)} className={`mode-button ${mode === id ? 'active' : ''}`}>{label}</button>)}</div>
          {mode !== 'empty' && <div className="mt-4"><div className="mb-2 flex justify-between text-[11px] text-muted-foreground"><span>{mode === 'count' ? '目標張數' : '目標時間'}</span><b className="font-mono text-primary">{mode === 'count' ? `${goal} 張` : `${goal * 10} 秒`}</b></div><Slider aria-label={mode === 'count' ? '目標張數' : '目標時間'} min={1} max={mode === 'count' ? 20 : 12} value={[goal]} disabled={running} onValueChange={(v) => setGoal(Array.isArray(v) ? v[0] : v)} /></div>}
          <div className="mt-4"><div className="field-label">自動分解</div><div className="mt-2 grid grid-cols-3 gap-1">{([['off','關閉'],['common','普通'],['smart','智慧']] as const).map(([id,label])=><button key={id} disabled={running} onClick={()=>setSalvageMode(id)} className={`mode-button ${salvageMode===id?'active':''}`}>{label}</button>)}</div><p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{salvageMode==='off'?'全部裝備進入背包':salvageMode==='common'?'普通裝備自動轉為廢料':'依目前 Build 評分，自動分解無效裝備'}</p></div>
          </>}
          {!inCampaign && noMaps && <button className="craft-button mb-3 w-full" onClick={()=>{setMaps([0,3,0,0,0,0]);setMaterials(v=>({...v,scrap:v.scrap+3}));setTier(1);pushLog('RECOVER','完成免費邊境巡邏 · T1 地圖 +3 · 廢料 +3');}}>邊境巡邏 <span>免費恢復 3 張 T1</span></button>}
          <Button className="run-button mt-4 w-full" onClick={running ? () => { setRunning(false); pushLog('PAUSE','玩家中止自動循環'); } : start}>{running ? <><Pause />停止執行</> : <><Play />{inCampaign?'執行目前任務':'啟動自動刷圖'}</>}</Button>
        </Panel>
      </aside>

      <section className="min-w-0 space-y-4">
        <div className="terminal-shell"><div className="terminal-titlebar"><span className="font-mono text-[10px] text-primary">AUTOMATION://T{tier}/{policy}</span><span className="font-mono text-[10px] text-muted-foreground">{running ? `RUN ${runs + 1}` : 'IDLE'}</span></div><div ref={logRef} className="terminal-output">{logs.map((log) => <div key={log.id} className={`log-line log-${log.kind.toLowerCase()}`}><time>{log.id===1?'00:00:00':new Date(log.id).toLocaleTimeString('zh-TW',{hour12:false}).slice(0,8)}</time><b>[{log.kind}]</b><span>{log.text}</span></div>)}{running && <div className="terminal-cursor">&gt; automation.run<i /></div>}</div></div>
        <div className="panel p-4"><div className="flex items-end justify-between"><div><div className="section-label"><Activity className="size-3.5" />T{tier} 地圖進度</div><p className="mt-1 text-xs text-muted-foreground">本次循環已完成 {runs} 張 · 庫存剩餘 {maps[tier]} 張</p></div><b className="font-mono text-2xl text-primary">{progress}%</b></div><div className="progress-track mt-3"><div className="progress-fill" style={{width:`${progress}%`}} /></div><div className="mt-3 grid grid-cols-3 gap-2"><Mini label="有效 DPS" value={dps.toLocaleString()} /><Mini label="總擊殺" value={totalKills.toString()} /><Mini label="本輪地圖" value={runs.toString()} /></div></div>
      </section>

      <aside className="space-y-4">
        {!inCampaign && <Panel title="獵取目標" icon={Crosshair}><div className="grid grid-cols-3 gap-1">{([['weapon','武器'],['armor','護甲'],['materials','材料']] as const).map(([id,label])=><button key={id} disabled={running} onClick={()=>setHuntTarget(id)} className={`mode-button ${huntTarget===id?'active':''}`}>{label}</button>)}</div><div className="mt-3 flex items-center justify-between text-xs"><span>追蹤進度</span><b className="text-primary">{huntProgress}/4</b></div><div className="progress-track mt-2"><div className="progress-fill" style={{width:`${huntProgress*25}%`}} /></div><p className="blueprint-next">每完成四張地圖，必定取得指定類型的高階獎勵。</p></Panel>}
        {!inCampaign && <Panel title={`專精核心 · 可用 ${masteryPoints}`} icon={Zap}><div className="space-y-2">{(Object.keys(MASTERIES) as MasteryId[]).map((id)=><button key={id} disabled={running||masteryPoints<1||masteries[id]>=5} onClick={()=>setMasteries(v=>({...v,[id]:v[id]+1}))} className="setting-row"><span><b>{MASTERIES[id].name} Lv.{masteries[id]}</b><small>{MASTERIES[id].description}</small></span><em>{masteries[id]>=5?'MAX':masteryPoints>0?'+':'待升級'}</em></button>)}</div><p className="blueprint-next">每提升 2 級取得 1 點。高風險契約需要同步強化輸出與生存。</p></Panel>}
        <Panel title="BUILD 藍圖" icon={ChevronsUp}>
          <div className="blueprint-head"><span>{blueprintSkill.name}藍圖</span><b>{Math.min(6,1+campaignStep)}/6</b></div>
          <div className="blueprint-list">
            {['穿焰矢','第一件護甲','升級武器',blueprintSkill.name,'自動化權限',`${blueprintSkill.tags.at(-1)} 增幅器`].map((label,index)=><div key={`${label}-${index}`} className={campaignStep>=index?'done':''}><i>{campaignStep>=index?'✓':'○'}</i><span>{label}</span>{campaignStep===index&&<em>目前目標</em>}</div>)}
          </div>
          {inCampaign && <p className="blueprint-next">下一步：{operation?.title}<br/>{operation?.lesson}</p>}
        </Panel>
        <Panel title="技能配置" icon={Swords}>
          <div className="space-y-2">{(Object.keys(skills) as SkillId[]).map((id) => { const data=skills[id]; const Icon=skillIcons[id]; const acquired=acquiredSkills.includes(id); return <button key={id} disabled={running||!acquired} onClick={() => setSkillId(id)} className={`skill-card ${skillId===id?'active':''}`} style={{'--skill-color':data.color} as React.CSSProperties}><Icon className="size-4"/><span><b>{data.name}</b><small>{acquired?data.description:'尚未取得 · 行動 02'}</small></span><em>{acquired?data.baseDamage:'LOCK'}</em></button>; })}</div>
        </Panel>
        <Panel title="裝備背包" icon={Box}>
          <div className="mb-3 grid grid-cols-2 gap-2"><Equip slot="武器" item={weapon} /><Equip slot="護甲" item={armor} /></div>
          {!inCampaign && <button disabled={running||materials.scrap<5||!weapon} onClick={()=>{if(!weapon)return;setItems((value)=>value.map((item)=>item.id===weapon.id?refineItem(item):item));setMaterials((value)=>({...value,scrap:value.scrap-5}));pushLog('CRAFT',`${weapon.name} 完成校準，第一詞綴數值 +1`);}} className="craft-button">校準武器 <span>消耗 5 廢料</span></button>}
          <div className="inventory-list">{evaluatedItems.map(({item,evaluation}) => { const isEquipped=equipped[item.slot]===item.id; const comparisons: Array<[number,string]>=item.slot==='weapon'?[[evaluation.dpsDelta,'DPS'],[evaluation.clearDelta,'清圖']]:[[evaluation.survivalDelta,'生存'],[evaluation.clearDelta,'清圖']]; const [delta,metric]=comparisons.sort((a,b)=>b[0]-a[0])[0]; return <button key={item.id} disabled={running || isEquipped} onClick={() => setEquipped((v) => ({...v,[item.slot]:item.id}))} className={`inventory-item ${isEquipped?'equipped':''}`}><span className={`rarity rarity-${item.rarity.toLowerCase()}`}>{item.rarity}</span><span><b>{delta>=0?'+':''}{delta}% {metric} · {item.name}</b><small>{item.slot==='weapon'?'武器':'護甲'} · {formatAffixes(item)}</small></span><em>{isEquipped?'使用中':evaluation.classification==='upgrade'?'升級':'裝備'}</em></button>; })}</div>
        </Panel>
      </aside>
    </div>
  </main>;
}

function Panel({title,icon:Icon,children}:{title:string;icon:typeof Activity;children:React.ReactNode}) { return <section className="panel p-4"><div className="section-label"><Icon className="size-3.5"/>{title}</div><div className="mt-3">{children}</div></section>; }
function Mini({label,value}:{label:string;value:string}) { return <div className="metric-tile"><small>{label}</small><b>{value}</b></div>; }
function Equip({slot,item}:{slot:string;item?:Item}) { return <div className="equip-slot"><small>{slot}</small><b>{item?.name??'空'}</b><span>{item?formatAffixes(item):'尚未裝備'}</span></div>; }
