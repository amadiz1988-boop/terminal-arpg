'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { advanceRoWorld, createRoWorld, type RoWorldEvent, type RoWorldState } from '@/game/ro/world/simulation';
import { loadFld2Gzip, type RoField } from '@/game/ro/world/fld2';
import { PRT_FILD08, PRT_FILD08_PORING_COUNT } from '@/game/ro/content/prt-fild08';
import { PORING_RENEWAL } from '@/game/ro/content/poring';
import { renewalBaseAttack, renewalDisplayedAspd, renewalPlayerFlee, renewalPlayerHit } from '@/game/ro/formulas/renewal';
import { AUTOMATION_RULESET, RO_RULESET } from '@/game/ro/source';

type Panel = 'status' | 'equipment' | 'inventory' | 'automation';

const ITEM_LABELS: Record<string, string> = {
  Jellopy: 'Jellopy', Knife_: 'Knife [3]', Sticky_Mucus: 'Sticky Mucus', Apple: 'Apple',
  Wing_Of_Fly: 'Fly Wing', Unripe_Apple: 'Unripe Apple', Poring_Card: 'Poring Card',
};
const EVENT_LABELS: Record<RoWorldEvent['type'], string> = {
  target: 'TARGET', move: 'MOVE', player_hit: 'ATTACK', player_miss: 'MISS', monster_hit: 'DAMAGE',
  monster_miss: 'DODGE', death: 'DEAD', drop: 'DROP', pickup: 'PICKUP', heal: 'REGEN', use_item: 'ITEM',
};

function formatClock(ms: number) {
  const total = Math.trunc(ms / 1000);
  return `${String(Math.trunc(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function eventText(event: RoWorldEvent) {
  const monster = event.type === 'monster_hit' || event.type === 'monster_miss'
    ? event.actorId ?? 'PORING'
    : event.targetId ?? event.actorId ?? 'PORING';
  switch (event.type) {
    case 'target': return `鎖定 ${monster} · 座標 (${event.position?.x}, ${event.position?.y})`;
    case 'move': return `前往 (${event.position?.x}, ${event.position?.y})`;
    case 'player_hit': return `Novice 普通攻擊 → ${monster} · Dmg ${event.amount} · HP ${event.remainingHp}/${event.maximumHp}`;
    case 'player_miss': return `Novice 攻擊 ${monster} · Miss`;
    case 'monster_hit': return `${monster} 攻擊 Novice · Dmg ${event.amount} · HP ${event.remainingHp}/${event.maximumHp}`;
    case 'monster_miss': return `${monster} 攻擊 Novice · Miss`;
    case 'death': return `${event.actorId} 死亡 · Base EXP +${PORING_RENEWAL.baseExp} · Job EXP +${PORING_RENEWAL.jobExp}`;
    case 'drop': return `${event.actorId} 掉落 ${ITEM_LABELS[event.item ?? ''] ?? event.item}`;
    case 'pickup': return `拾取 ${ITEM_LABELS[event.item ?? ''] ?? event.item}`;
    case 'heal': return `自然恢復 HP +${event.amount}`;
    case 'use_item': return `使用 ${ITEM_LABELS[event.item ?? ''] ?? event.item} · HP +${event.amount}`;
  }
}

function FieldMap({ field, world }: { field: RoField; world: RoWorldState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const size = 720;
    canvas.width = size; canvas.height = size;
    context.fillStyle = '#000'; context.fillRect(0, 0, size, size);
    const image = context.createImageData(field.width, field.height);
    const player = world.player.position;
    for (let y = 0; y < field.height; y += 1) for (let x = 0; x < field.width; x += 1) {
      const offset = y * field.width + x;
      const pixel = offset * 4;
      const walkable = (field.cells[offset] & 1) !== 0;
      const rgb = walkable ? [91, 113, 91] : [13, 18, 13];
      image.data[pixel] = rgb[0]; image.data[pixel + 1] = rgb[1]; image.data[pixel + 2] = rgb[2]; image.data[pixel + 3] = 255;
    }
    const buffer = document.createElement('canvas'); buffer.width = field.width; buffer.height = field.height;
    buffer.getContext('2d')?.putImageData(image, 0, 0);
    context.imageSmoothingEnabled = false; context.drawImage(buffer, 0, 0, size, size);
    const scale = size / field.width;
    for (const monster of world.monsters) {
      if (!monster.alive || Math.abs(monster.position.x - player.x) > 20 || Math.abs(monster.position.y - player.y) > 20) continue;
      context.beginPath(); context.fillStyle = monster.engaged ? '#ff3232' : '#ff98c1';
      context.shadowColor = context.fillStyle; context.shadowBlur = monster.engaged ? 12 : 3;
      context.arc(monster.position.x * scale, (field.height - monster.position.y) * scale, monster.engaged ? 5 : 3, 0, Math.PI * 2); context.fill();
    }
    const hurt = [...world.events].reverse().find((event) => event.type === 'monster_hit');
    context.shadowColor = '#5dff9c'; context.shadowBlur = 14;
    context.fillStyle = hurt && world.nowMs - hurt.atMs < 450 ? '#ff3030' : '#5dff9c';
    context.fillRect(player.x * scale - 5, (field.height - player.y) * scale - 5, 10, 10);
  }, [field, world]);
  return <canvas ref={canvasRef} className="field-canvas" aria-label="prt_fild08 即時小地圖" />;
}

export function GameShell() {
  const [field, setField] = useState<RoField>();
  const [world, setWorld] = useState<RoWorldState>();
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [panel, setPanel] = useState<Panel>('status');
  const [loadError, setLoadError] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadFld2Gzip(PRT_FILD08.fieldUrl).then((loaded) => { setField(loaded); setWorld(createRoWorld(loaded, 824)); })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : String(error)));
  }, []);
  useEffect(() => {
    if (!field || !running) return;
    const timer = window.setInterval(() => setWorld((current) => current ? advanceRoWorld(current, field, 150 * speed) : current), 150);
    return () => window.clearInterval(timer);
  }, [field, running, speed]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [world?.events.length]);
  const reset = useCallback(() => { if (field) setWorld(createRoWorld(field, 824)); }, [field]);

  const visibleEvents = useMemo(() => world?.events.slice(-120) ?? [], [world?.events]);
  const inventoryCount = world ? Object.values(world.inventory).reduce((sum, value) => sum + value, 0) : 0;
  const alive = world?.monsters.filter((monster) => monster.alive).length ?? 0;
  const novice = { level: 1, str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 };
  const atk = renewalBaseAttack(novice), hit = renewalPlayerHit(novice), flee = renewalPlayerFlee(novice);
  const aspd = renewalDisplayedAspd({ agi: 1, dex: 1 }, 55);

  if (loadError) return <main className="loading-screen"><strong>地圖載入失敗</strong><code>{loadError}</code></main>;
  if (!field || !world) return <main className="loading-screen">Loading prt_fild08.fld2...</main>;

  return <main className="ro-desktop">
    <section className="ro-window basic-window">
      <WindowTitle title="Basic Information" trailing="Novice" />
      <div className="basic-grid">
        <div className="portrait">Novice</div>
        <div className="identity"><b>初心者</b><span>Base Lv. 1　Job Lv. 1</span></div>
        <Meter label="HP" value={world.player.hp} max={world.player.maxHp} tone="hp" />
        <Meter label="SP" value={11} max={11} tone="sp" />
        <div className="exp-values">Base EXP {world.player.baseExp.toLocaleString()}<br />Job EXP {world.player.jobExp.toLocaleString()}</div>
        <div className="weight">Weight {inventoryCount * 2} / 2000　 Zeny 0</div>
      </div>
    </section>

    <div className="workspace-title">鬼島傳說 · {running ? '掛機中' : '已暫停'} · prt_fild08 · {speed}x</div>
    <nav className="ro-tabs">{([['status','能力'],['equipment','裝備'],['inventory','道具'],['automation','設定']] as const).map(([id,label]) => <button className={panel === id ? 'active' : ''} key={id} onClick={() => setPanel(id)}>{label}</button>)}</nav>

    <section className="workspace-grid">
      <div className="left-stack">
        <section className="ro-window map-window"><WindowTitle title="Map" trailing={`Poring ${alive}/${PRT_FILD08_PORING_COUNT}`} /><FieldMap field={field} world={world} /><div className="map-caption">■ Player　● Poring　<span>● Battle</span></div></section>
        <section className="ro-window control-window"><button onClick={() => setRunning((value) => !value)}>{running ? '停止掛機' : '繼續掛機'}</button><label>速度 <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}><option value={1}>1x</option><option value={4}>4x QA</option></select></label><button onClick={reset}>重置</button></section>
      </div>

      <section className="console-window"><div className="console-title">OpenKore Console　[{running ? 'connected' : 'paused'}]</div><div className="console-output" ref={logRef} data-testid="combat-log"><p className="system-line">[系統] Connected. Entering prt_fild08. Auto-attack enabled.</p>{visibleEvents.map((event,index) => <p className={`event-${event.type}`} key={`${event.atMs}-${event.type}-${index}`}><time>{formatClock(event.atMs)}</time><b>[{EVENT_LABELS[event.type]}]</b><span>{eventText(event)}</span></p>)}<i className="caret" /></div></section>

      <section className="ro-window detail-window"><WindowTitle title={panel === 'status' ? 'Status' : panel === 'equipment' ? 'Equipment' : panel === 'inventory' ? 'Item' : 'OpenKore Config'} trailing="Renewal" />
        {panel === 'status' && <div className="status-panel"><div className="primary-stats">{['Str','Agi','Vit','Int','Dex','Luk'].map((stat) => <div key={stat}><b>{stat}</b><span>1 + 0</span></div>)}</div><div className="derived-stats"><div>Atk <b>{atk} + 17</b></div><div>Def <b>0 + 0</b></div><div>Matk <b>1 + 1</b></div><div>Mdef <b>0 + 0</b></div><div>Hit <b>{hit}</b></div><div>Flee <b>{flee}</b></div><div>Critical <b>1</b></div><div>Aspd <b>{aspd}</b></div><div>Status Point <b>0</b></div></div><SourceNote text={`rAthena Renewal ${RO_RULESET.commit.slice(0,8)}`} /></div>}
        {panel === 'equipment' && <div className="equipment-panel"><Slot name="Upper Head" /><Slot name="Lower Head" /><Slot name="Right Hand" item="Knife" detail="ATK 17 · Dagger" /><Slot name="Left Hand" /><Slot name="Armor" item="Cotton Shirt" detail="DEF 10" /><Slot name="Garment" /><Slot name="Shoes" /><Slot name="Accessory" /><Slot name="Accessory" /></div>}
        {panel === 'inventory' && <div className="inventory-panel">{Object.entries(world.inventory).length === 0 && <p>Empty</p>}{Object.entries(world.inventory).map(([item,count]) => <div className="item-row" key={item}><i>□</i><b>{ITEM_LABELS[item] ?? item}</b><span>{count}</span></div>)}<footer>{inventoryCount} item(s)</footer></div>}
        {panel === 'automation' && <div className="config-panel"><Setting label="lockMap" value="prt_fild08" /><Setting label="attackAuto" value="2" /><Setting label="itemsTakeAuto" value="2" /><Setting label="useSelf_item Apple" value="hp <= 50%" /><Setting label="attackMVP" value="0" /><SourceNote text={`OpenKore ${AUTOMATION_RULESET.commit.slice(0,8)}`} /></div>}
      </section>
    </section>
    <footer className="release-note">R0.1 · field 400×400 · fixed seed 824 · map, combat, EXP and loot share one simulation state</footer>
  </main>;
}

function WindowTitle({ title, trailing }: { title: string; trailing: string }) { return <div className="window-title"><b>{title}</b><span>{trailing}</span><i>×</i></div>; }
function Meter({ label, value, max, tone }: { label: string; value: number; max: number; tone: 'hp' | 'sp' }) { return <div className="meter"><b>{label}</b><div><i className={tone} style={{ width: `${value / max * 100}%` }} /></div><span>{value} / {max}</span></div>; }
function Slot({ name, item, detail }: { name: string; item?: string; detail?: string }) { return <div className="slot"><span>{name}</span><b>{item ?? 'Empty'}</b>{detail && <small>{detail}</small>}</div>; }
function Setting({ label, value }: { label: string; value: string }) { return <div className="setting"><i /><code>{label}</code><b>{value}</b></div>; }
function SourceNote({ text }: { text: string }) { return <p className="source-note">Source: {text}</p>; }
