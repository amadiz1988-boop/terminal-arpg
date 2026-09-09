'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { advanceRoWorld, createRoWorld, type RoWorldEvent, type RoWorldState } from '@/game/ro/world/simulation';
import { loadFld2Gzip, type RoField } from '@/game/ro/world/fld2';
import { PRT_FILD08, PRT_FILD08_PORING_COUNT } from '@/game/ro/content/prt-fild08';
import { PORING_RENEWAL } from '@/game/ro/content/poring';
import { renewalBaseAttack, renewalDisplayedAspd, renewalPlayerFlee, renewalPlayerHit } from '@/game/ro/formulas/renewal';
import { AUTOMATION_RULESET, RO_RULESET } from '@/game/ro/source';
import { RO_ZH_TW, zhTwActor, zhTwItem } from '@/game/ro/content/zh-tw';

type Panel = 'status' | 'equipment' | 'inventory' | 'mapInfo' | 'automation';
type InventoryFilter = 'all' | 'consumable' | 'equipment' | 'card' | 'ammo' | 'misc';
const PLAYER_NAME = '你';
const PLAYER_CLASS = '初心者';
const INVENTORY_FILTERS: ReadonlyArray<readonly [InventoryFilter, string]> = [['all', '全部'], ['consumable', '消耗品'], ['equipment', '裝備'], ['card', '卡片'], ['ammo', '箭矢／彈藥'], ['misc', '其他']];
const ITEM_CATEGORIES: Record<string, InventoryFilter> = { Apple: 'consumable', Wing_Of_Fly: 'consumable', Knife_: 'equipment', Poring_Card: 'card', Jellopy: 'misc', Sticky_Mucus: 'misc', Unripe_Apple: 'misc' };
const EVENT_LABELS: Record<RoWorldEvent['type'], string> = {
  target: '目標', move: '移動', player_hit: '攻擊', player_miss: '未命中', monster_hit: '受傷',
  monster_miss: '閃避', death: '擊倒', drop: '掉落', pickup: '拾取', heal: '恢復', use_item: '道具',
};

function formatClock(ms: number) {
  const total = Math.trunc(ms / 1000);
  return `${String(Math.trunc(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function eventText(event: RoWorldEvent) {
  const monsterId = event.type === 'monster_hit' || event.type === 'monster_miss'
    ? event.actorId ?? 'PORING'
    : event.targetId ?? event.actorId ?? 'PORING';
  const monster = zhTwActor(monsterId);
  switch (event.type) {
    case 'target': return `鎖定 ${monster} · 座標 (${event.position?.x}, ${event.position?.y})`;
    case 'move': return `前往 (${event.position?.x}, ${event.position?.y})`;
    case 'player_hit': return `${PLAYER_NAME}普通攻擊 → ${monster} · 傷害 ${event.amount} · 生命 ${event.remainingHp}/${event.maximumHp}`;
    case 'player_miss': return `${PLAYER_NAME}攻擊 ${monster} · 未命中`;
    case 'monster_hit': return `${monster} 攻擊${PLAYER_NAME} · 傷害 ${event.amount} · 生命 ${event.remainingHp}/${event.maximumHp}`;
    case 'monster_miss': return `${monster} 攻擊${PLAYER_NAME} · 未命中`;
    case 'death': return `${zhTwActor(event.actorId)} 死亡 · 人物經驗 +${PORING_RENEWAL.baseExp} · 職業經驗 +${PORING_RENEWAL.jobExp}`;
    case 'drop': return `${zhTwActor(event.actorId)} 掉落 ${zhTwItem(event.item ?? '')}`;
    case 'pickup': return `拾取 ${zhTwItem(event.item ?? '')}`;
    case 'heal': return `自然恢復 HP +${event.amount}`;
    case 'use_item': return `使用 ${zhTwItem(event.item ?? '')} · 生命 +${event.amount}`;
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
      const pixel = ((field.height - 1 - y) * field.width + x) * 4;
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
  const [panel, setPanel] = useState<Panel>('status');
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>('all');
  const [loadError, setLoadError] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadFld2Gzip(PRT_FILD08.fieldUrl).then((loaded) => { setField(loaded); setWorld(createRoWorld(loaded, 824)); })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : String(error)));
  }, []);
  useEffect(() => {
    if (!field || !running) return;
    const timer = window.setInterval(() => setWorld((current) => current ? advanceRoWorld(current, field, 150) : current), 150);
    return () => window.clearInterval(timer);
  }, [field, running]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [world?.events.length]);
  const visibleEvents = useMemo(() => world?.events.slice(-120) ?? [], [world?.events]);
  const inventoryCount = world ? Object.values(world.inventory).reduce((sum, value) => sum + value, 0) : 0;
  const alive = world?.monsters.filter((monster) => monster.alive).length ?? 0;
  const novice = { level: 1, str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 };
  const atk = renewalBaseAttack(novice), hit = renewalPlayerHit(novice), flee = renewalPlayerFlee(novice);
  const aspd = renewalDisplayedAspd({ agi: 1, dex: 1 }, 55);

  if (loadError) return <main className="loading-screen"><strong>地圖載入失敗</strong><code>{loadError}</code></main>;
  if (!field || !world) return <main className="loading-screen">正在讀取普隆德拉原野地圖資料...</main>;

  return <main className="ro-desktop">
    <section className="ro-window basic-window">
      <WindowTitle title="基本資訊" trailing={PLAYER_NAME} />
      <div className="basic-grid">
        <div className="portrait">{PLAYER_CLASS}</div>
        <div className="identity"><b>{PLAYER_NAME}</b><span>{PLAYER_CLASS}</span><small>人物等級 1　職業等級 1</small></div>
        <Meter label="生命" value={world.player.hp} max={world.player.maxHp} tone="hp" />
        <Meter label="魔力" value={11} max={11} tone="sp" />
        <div className="exp-values">人物經驗 {world.player.baseExp.toLocaleString()}<br />職業經驗 {world.player.jobExp.toLocaleString()}</div>
        <div className="weight">負重 {inventoryCount * 2} / 2000　 Zeny 0</div>
      </div>
    </section>

    <div className="workspace-title"><span>鬼島傳說 · {running ? '掛機中' : '已暫停'}</span><label>掛機地圖 <select aria-label="掛機地圖"><option>{RO_ZH_TW.maps.prt_fild08} · 怪物 Lv.1</option></select></label></div>

    <section className="workspace-grid">
      <div className="left-stack">
        <section className="ro-window map-window"><WindowTitle title={RO_ZH_TW.maps.prt_fild08} trailing={`波利 ${alive}/${PRT_FILD08_PORING_COUNT}`} /><FieldMap field={field} world={world} /><div className="map-caption">■ 玩家　● 波利　<span>● 交戰中</span></div></section>
        <section className="ro-window control-window"><button onClick={() => setRunning((value) => !value)}>{running ? '停止掛機' : '繼續掛機'}</button><span>停止後會從目前位置接續</span></section>
      </div>

      <section className="console-window"><div className="console-title">OpenKore 戰鬥終端　[{running ? '連線中' : '已暫停'}]</div><div className="console-output" ref={logRef} data-testid="combat-log"><p className="system-line">[系統] 已進入普隆德拉原野，自動索敵與拾取已啟用。</p>{visibleEvents.map((event,index) => <p className={`event-${event.type}`} key={`${event.atMs}-${event.type}-${index}`}><time>{formatClock(event.atMs)}</time><b>[{EVENT_LABELS[event.type]}]</b><span>{eventText(event)}</span></p>)}<i className="caret" /></div><div className="hang-stats" data-testid="hang-stats"><b>本次掛機統計</b><span>時間 <strong>{formatClock(world.nowMs)}</strong></span><span>擊倒 <strong>{world.kills}</strong></span><span>人物經驗 <strong>{world.player.baseExp.toLocaleString()}</strong></span><span>職業經驗 <strong>{world.player.jobExp.toLocaleString()}</strong></span><div className="picked-items"><b>拾取物品</b>{Object.entries(world.inventory).length === 0 ? <span>尚未拾取</span> : Object.entries(world.inventory).map(([item, count]) => <span key={item}>{zhTwItem(item)} × {count}</span>)}</div></div></section>

      <div className="detail-stack"><nav className="ro-tabs">{([['status','能力'],['equipment','裝備'],['inventory','道具'],['mapInfo','地圖情報'],['automation','掛機設定']] as const).map(([id,label]) => <button className={panel === id ? 'active' : ''} key={id} onClick={() => setPanel(id)}>{label}</button>)}</nav><section className="ro-window detail-window"><WindowTitle title={panel === 'status' ? '人物能力' : panel === 'equipment' ? '裝備欄' : panel === 'inventory' ? '道具欄' : panel === 'mapInfo' ? '地圖情報' : 'OpenKore 掛機設定'} trailing="革新制" />
        {panel === 'status' && <div className="status-panel"><div className="primary-stats">{[['力量 STR',1],['敏捷 AGI',1],['體力 VIT',1],['智力 INT',1],['靈巧 DEX',1],['幸運 LUK',1]].map(([stat,value]) => <div key={stat}><b>{stat}</b><span>{value} + 0</span></div>)}</div><div className="derived-stats"><div>物理攻擊 ATK <b>{atk} + 17</b></div><div>物理防禦 DEF <b>0 + 0</b></div><div>魔法攻擊 MATK <b>1 + 1</b></div><div>魔法防禦 MDEF <b>0 + 0</b></div><div>命中 HIT <b>{hit}</b></div><div>迴避 FLEE <b>{flee}</b></div><div>暴擊 CRITICAL <b>1</b></div><div>攻速 ASPD <b>{aspd}</b></div><div>能力點 <b>0</b></div></div><SourceNote text={`rAthena Renewal ${RO_RULESET.commit.slice(0,8)}`} /></div>}
        {panel === 'equipment' && <div className="equipment-panel"><Slot name="頭上段" /><Slot name="頭下段" /><Slot name="右手" item="短劍" detail="物理攻擊 17 · 短劍類" /><Slot name="左手" /><Slot name="鎧甲" item="棉襯衫" detail="物理防禦 10" /><Slot name="披肩" /><Slot name="鞋子" /><Slot name="飾品" /><Slot name="飾品" /></div>}
        {panel === 'inventory' && <InventoryPanel inventory={world.inventory} filter={inventoryFilter} onFilterChange={setInventoryFilter} total={inventoryCount} />}
        {panel === 'mapInfo' && <MapInformation />}
        {panel === 'automation' && <div className="config-panel"><Setting label="固定掛機地圖" value={RO_ZH_TW.maps.prt_fild08} /><Setting label="自動攻擊" value="開啟" /><Setting label="自動拾取" value="開啟" /><Setting label="生命低於 50% 使用蘋果" value="開啟" /><Setting label="攻擊 MVP" value="關閉" /><SourceNote text={`OpenKore ${AUTOMATION_RULESET.commit.slice(0,8)}`} /></div>}
      </section></div>
    </section>
    <footer className="release-note">R0.3 · 地圖 400×400 · 固定種子 824 · 地圖、戰鬥、經驗與掉落共用同一份模擬狀態</footer>
  </main>;
}

function WindowTitle({ title, trailing }: { title: string; trailing: string }) { return <div className="window-title"><b>{title}</b><span>{trailing}</span><i>×</i></div>; }
function Meter({ label, value, max, tone }: { label: string; value: number; max: number; tone: 'hp' | 'sp' }) { return <div className="meter"><b>{label}</b><div><i className={tone} style={{ width: `${value / max * 100}%` }} /></div><span>{value} / {max}</span></div>; }
function Slot({ name, item, detail }: { name: string; item?: string; detail?: string }) { return <div className="slot"><span>{name}</span><b>{item ?? '空'}</b>{detail && <small>{detail}</small>}</div>; }
function Setting({ label, value }: { label: string; value: string }) { return <div className="setting"><i /><code>{label}</code><b>{value}</b></div>; }
function SourceNote({ text }: { text: string }) { return <p className="source-note">資料來源：{text}</p>; }

function InventoryPanel({ inventory, filter, onFilterChange, total }: { inventory: Record<string, number>; filter: InventoryFilter; onFilterChange: (filter: InventoryFilter) => void; total: number }) {
  const entries = Object.entries(inventory).filter(([item]) => filter === 'all' || ITEM_CATEGORIES[item] === filter);
  return <div className="inventory-panel"><nav className="inventory-filters" aria-label="道具分類">{INVENTORY_FILTERS.map(([id, label]) => <button type="button" className={filter === id ? 'active' : ''} key={id} onClick={() => onFilterChange(id)}>{label}</button>)}</nav>{entries.length === 0 ? <p>此分類目前沒有道具</p> : entries.map(([item,count]) => <div className="item-row" key={item}><i>□</i><b>{zhTwItem(item)}</b><span>{count}</span></div>)}<footer>目前分類 {entries.reduce((sum, [, count]) => sum + count, 0)} 件／背包共 {total} 件</footer></div>;
}

function MapInformation() {
  return <div className="map-info-panel">
    <header><b>{RO_ZH_TW.maps.prt_fild08}</b><span>地圖代碼 prt_fild08 · 400×400</span></header>
    <section className="monster-card"><h3>波利 <small>Lv.1</small></h3><div className="monster-facts"><span>生命 <b>{PORING_RENEWAL.hp}</b></span><span>物理攻擊 <b>{PORING_RENEWAL.attackMin}～{PORING_RENEWAL.attackMax}</b></span><span>物理防禦 <b>{PORING_RENEWAL.defense}</b></span><span>魔法防禦 <b>{PORING_RENEWAL.magicDefense}</b></span><span>種族 <b>植物</b></span><span>體型 <b>中型</b></span><span>屬性 <b>水 1</b></span><span>攻擊距離 <b>1 格</b></span><span>人物經驗 <b>{PORING_RENEWAL.baseExp}</b></span><span>職業經驗 <b>{PORING_RENEWAL.jobExp}</b></span></div>
      <h4>掉落物</h4><div className="drop-table">{PORING_RENEWAL.drops.map((drop,index) => <div key={`${drop.item}-${index}`}><span>{zhTwItem(drop.item)}</span><b>{drop.ratePerTenThousand / 100}%</b></div>)}</div>
    </section>
    <SourceNote text={`rAthena ${RO_RULESET.commit.slice(0,8)}；繁中名稱採 twRO 資料層`} />
  </div>;
}
