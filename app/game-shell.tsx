'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ChevronsUp, CircleDot, Coins, Crosshair, Flame, Gauge, Play, RotateCcw, Shield, Skull, Sparkles, Swords, TimerReset } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

type Policy = 'full-clear' | 'boss-rush' | 'currency';
type BuildId = 'ember' | 'arc' | 'warden';
type LogKind = 'SYS' | 'AI' | 'MOVE' | 'SCAN' | 'CAST' | 'CRIT' | 'KILL' | 'DROP' | 'BOSS' | 'EXIT';
type LogLine = { id: number; time: string; kind: LogKind; message: string };

const builds = {
  ember: { name: '餘燼獵手', skill: '穿焰矢', damage: 1380, attackSpeed: 2.8, crit: 36, move: 128, accent: '#ff8a47', description: '暴擊與單體傷害平衡', icon: Flame },
  arc: { name: '雷鏈術士', skill: '裂空電弧', damage: 1020, attackSpeed: 3.6, crit: 29, move: 146, accent: '#7dd3fc', description: '高速清除密集怪群', icon: Sparkles },
  warden: { name: '玄鐵守衛', skill: '震地重擊', damage: 1690, attackSpeed: 2.1, crit: 21, move: 112, accent: '#c4b5fd', description: '穩定生存與強力重擊', icon: Shield },
} as const;

const policyInfo: Record<Policy, { name: string; target: string; detail: string }> = {
  'full-clear': { name: '全圖掃蕩', target: '目標探索率', detail: '追求擊殺與完整探索' },
  'boss-rush': { name: '首領突襲', target: '找到首領', detail: '發現首領後立即交戰' },
  currency: { name: '通貨獵人', target: '事件完成', detail: '優先清除高價值怪群' },
};

const initialLogs: LogLine[] = [
  { id: 1, time: '00:00.000', kind: 'SYS', message: '戰鬥模擬器已就緒' },
  { id: 2, time: '00:00.012', kind: 'AI', message: '等待執行刷圖策略...' },
];

function nowLabel(startedAt: number) {
  const elapsed = Math.max(0, Date.now() - startedAt);
  return `00:${Math.floor(elapsed / 1000).toString().padStart(2, '0')}.${(elapsed % 1000).toString().padStart(3, '0')}`;
}

function createEvent(step: number, build: (typeof builds)[BuildId], policy: Policy): Omit<LogLine, 'id' | 'time'> {
  const cycle: Array<Omit<LogLine, 'id' | 'time'>> = [
    { kind: 'MOVE', message: `前往區域 ${String.fromCharCode(65 + Math.floor(step / 4))}-${(step % 7) + 1}` },
    { kind: 'SCAN', message: `發現 ${5 + (step % 8)} 個敵對目標` },
    { kind: 'CAST', message: `${build.skill} 命中怪群，連鎖判定完成` },
    { kind: step % 3 === 0 ? 'CRIT' : 'KILL', message: step % 3 === 0 ? `${Math.round(build.damage * 2.34).toLocaleString()} 暴擊傷害` : `怪群清除，用時 ${(0.7 + (step % 5) * 0.13).toFixed(2)} 秒` },
    { kind: 'DROP', message: step % 2 === 0 ? `拾取：餘燼碎片 ×${2 + (step % 4)}` : '拾取：稀有裝備' },
  ];
  if (step === 17) return { kind: 'BOSS', message: policy === 'boss-rush' ? '偵測到深淵監守者，切換首領配置' : '發現首領區域，加入路徑佇列' };
  if (step === 22) return { kind: 'BOSS', message: `深淵監守者承受 ${Math.round(build.damage * 5.8).toLocaleString()} 傷害` };
  return cycle[step % cycle.length];
}

export function GameShell() {
  const [buildId, setBuildId] = useState<BuildId>('ember');
  const [policy, setPolicy] = useState<Policy>('full-clear');
  const [target, setTarget] = useState(90);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [progress, setProgress] = useState(0);
  const [kills, setKills] = useState(0);
  const [loot, setLoot] = useState(0);
  const [boss, setBoss] = useState<'未發現' | '已發現' | '已擊殺'>('未發現');
  const [logs, setLogs] = useState<LogLine[]>(initialLogs);
  const startedAt = useRef(Date.now());
  const terminalRef = useRef<HTMLDivElement>(null);
  const build = builds[buildId];
  const effectiveDps = useMemo(() => Math.round(build.damage * build.attackSpeed * (1 + (build.crit / 100) * 1.5)), [build]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setProgress((current) => {
        const increment = policy === 'boss-rush' ? 5 : policy === 'currency' ? 3 : 4;
        const next = Math.min(100, current + increment);
        const step = Math.floor(next / increment);
        const event = createEvent(step, build, policy);
        setLogs((items) => [...items.slice(-48), { ...event, id: Date.now(), time: nowLabel(startedAt.current) }]);
        setKills((value) => value + 4 + (step % 7));
        if (event.kind === 'DROP') setLoot((value) => value + 3 + (step % 5));
        if (event.kind === 'BOSS') setBoss(step >= 22 ? '已擊殺' : '已發現');
        const reachedTarget = policy === 'full-clear' && next >= target;
        const bossDone = policy === 'boss-rush' && step >= 22;
        const currencyDone = policy === 'currency' && next >= Math.min(target, 76);
        if (reachedTarget || bossDone || currencyDone || next >= 100) {
          window.clearInterval(timer); setRunning(false); setFinished(true);
          setLogs((items) => [...items, { id: Date.now() + 1, time: nowLabel(startedAt.current), kind: 'EXIT', message: `${policyInfo[policy].name}條件達成，開啟返程傳送門` }]);
        }
        return next;
      });
    }, 430);
    return () => window.clearInterval(timer);
  }, [running, build, policy, target]);

  useEffect(() => { terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight, behavior: 'smooth' }); }, [logs]);

  const startRun = () => {
    startedAt.current = Date.now(); setProgress(0); setKills(0); setLoot(0); setBoss('未發現'); setFinished(false);
    setLogs([
      { id: Date.now(), time: '00:00.000', kind: 'SYS', message: '載入地圖：灰燼礦坑 T1' },
      { id: Date.now() + 1, time: '00:00.010', kind: 'AI', message: `啟用策略：${policyInfo[policy].name}，使用技能：${build.skill}` },
    ]);
    setRunning(true);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="scanlines" aria-hidden="true" />
      <header className="border-b border-border/80 bg-card/65 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3"><div className="brand-mark"><CircleDot className="size-5" /></div><div><div className="flex items-center gap-2"><h1 className="font-mono text-sm font-bold tracking-[0.18em] text-primary">TERMINAL ARPG</h1><span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-primary">ALPHA 0.1</span></div><p className="text-[11px] text-muted-foreground">自動戰鬥實驗終端</p></div></div>
          <div className="hidden items-center gap-5 text-xs text-muted-foreground md:flex"><span className="flex items-center gap-1.5"><span className="status-dot" />伺服器在線</span><span>賽季：先行測試</span><span className="font-mono">角色 Lv.12</span></div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)_270px]">
        <aside className="space-y-4">
          <section className="panel p-4"><div className="section-label"><Swords className="size-3.5" />BUILD PROFILE</div><div className="mt-3 space-y-2">{(Object.keys(builds) as BuildId[]).map((id) => { const item = builds[id]; const Icon = item.icon; return <button key={id} onClick={() => !running && setBuildId(id)} disabled={running} className={`build-option ${buildId === id ? 'active' : ''}`} style={{ '--build-accent': item.accent } as React.CSSProperties}><span className="build-icon"><Icon className="size-4" /></span><span className="min-w-0 text-left"><strong>{item.name}</strong><small>{item.description}</small></span></button>; })}</div></section>
          <section className="panel p-4"><div className="section-label"><Crosshair className="size-3.5" />RUN POLICY</div><div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-muted/40 p-1 lg:grid-cols-1">{(Object.keys(policyInfo) as Policy[]).map((id) => <button key={id} disabled={running} onClick={() => setPolicy(id)} className={`policy-button ${policy === id ? 'active' : ''}`}><span>{policyInfo[id].name}</span><small className="hidden lg:block">{policyInfo[id].detail}</small></button>)}</div><div className="mt-4"><div className="mb-2 flex justify-between font-mono text-[11px] text-muted-foreground"><span>離場探索率</span><span className="text-primary">{target}%</span></div><Slider value={[target]} min={55} max={100} step={5} disabled={running} onValueChange={(value) => setTarget(Array.isArray(value) ? value[0] : value)} /></div></section>
          <section className="panel grid grid-cols-2 gap-px overflow-hidden p-0"><Stat label="有效 DPS" value={effectiveDps.toLocaleString()} icon={Activity} /><Stat label="暴擊率" value={`${build.crit}%`} icon={Crosshair} /><Stat label="攻擊速度" value={`${build.attackSpeed}/s`} icon={Gauge} /><Stat label="移動速度" value={`${build.move}%`} icon={ChevronsUp} /></section>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="terminal-shell"><div className="terminal-titlebar"><div className="flex items-center gap-2"><span className="terminal-light red" /><span className="terminal-light amber" /><span className="terminal-light green" /></div><span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">COMBAT://ASHEN-MINE/T1</span><span className="font-mono text-[10px] text-muted-foreground">{running ? 'RUNNING' : finished ? 'COMPLETE' : 'IDLE'}</span></div><div ref={terminalRef} className="terminal-output" aria-live="polite">{logs.map((line) => <div key={line.id} className={`log-line log-${line.kind.toLowerCase()}`}><time>{line.time}</time><b>[{line.kind}]</b><span>{line.message}</span></div>)}{running && <div className="terminal-cursor"><span>&gt;</span><i /></div>}</div><div className="terminal-command"><span>&gt;</span><span className="text-muted-foreground">{running ? 'automation.run --watch' : finished ? 'run.summary --latest' : 'awaiting command'}</span></div></div>
          <div className="panel p-4"><div className="mb-2 flex items-center justify-between gap-4"><div><div className="section-label"><CircleDot className="size-3.5" />MAP EXPLORATION</div><p className="mt-1 text-xs text-muted-foreground">灰燼礦坑 · 區域等級 12 · 怪物密度 84%</p></div><strong className="font-mono text-2xl text-primary">{progress}%</strong></div><div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div><div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><span className="font-mono text-[11px] text-muted-foreground">EXIT: {policyInfo[policy].target} · BOSS: {boss}</span><Button onClick={running ? () => setRunning(false) : startRun} className="run-button" size="lg">{running ? <><TimerReset />中止並返回</> : finished ? <><RotateCcw />再次刷圖</> : <><Play />開始刷圖</>}</Button></div></div>
        </section>

        <aside className="space-y-4">
          <section className="panel p-4"><div className="section-label"><Gauge className="size-3.5" />LIVE METRICS</div><div className="mt-3 space-y-3"><Metric label="擊殺數" value={kills.toString()} hint="mobs" icon={Skull} /><Metric label="戰利品分數" value={loot.toString()} hint="value" icon={Coins} /><Metric label="探索進度" value={`${progress}%`} hint="map" icon={CircleDot} /><Metric label="首領狀態" value={boss} hint="boss" icon={Swords} /></div></section>
          <section className="panel overflow-hidden p-0"><div className="border-b border-border/70 p-4"><div className="section-label"><Sparkles className="size-3.5" />LATEST LOOT</div></div><div className="divide-y divide-border/60"><Loot rarity="RARE" name="熔火指環" mod="+18% 火焰傷害" /><Loot rarity="MAGIC" name="迅捷皮靴" mod="+12% 移動速度" /><Loot rarity="CURRENCY" name="餘燼碎片" mod={`目前持有 ${loot}`} /></div></section>
          <section className="panel p-4"><div className="flex items-start gap-3"><div className="rounded-md bg-primary/10 p-2 text-primary"><CircleDot className="size-4" /></div><div><p className="text-xs font-semibold">ALPHA 測試目標</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">嘗試三種 Build 與刷圖策略，找出最快完成地圖的組合。</p></div></div></section>
        </aside>
      </div>
    </main>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Activity }) { return <div className="border-r border-b border-border/60 p-3"><Icon className="mb-2 size-3.5 text-primary" /><span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span><strong className="mt-1 block font-mono text-sm">{value}</strong></div>; }
function Metric({ label, value, hint, icon: Icon }: { label: string; value: string; hint: string; icon: typeof Activity }) { return <div className="flex items-center gap-3"><span className="metric-icon"><Icon className="size-4" /></span><span className="min-w-0 flex-1"><small>{label}</small><strong>{value}</strong></span><span className="font-mono text-[9px] uppercase text-muted-foreground">{hint}</span></div>; }
function Loot({ rarity, name, mod }: { rarity: string; name: string; mod: string }) { return <div className="loot-row"><span className={`rarity rarity-${rarity.toLowerCase()}`}>{rarity}</span><div><strong>{name}</strong><small>{mod}</small></div></div>; }
