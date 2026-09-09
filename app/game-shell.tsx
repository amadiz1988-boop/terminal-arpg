'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  advanceRoWorld,
  allocateNoviceSkill,
  allocateStatusPoint,
  BASE_EXP_REQUIREMENTS,
  createRoWorld,
  experienceProgress,
  JOB_EXP_REQUIREMENTS,
  resetStatusPoints,
  equipInventoryItem,
  type RoWorldEvent,
  type RoWorldState,
} from '@/game/ro/world/simulation';
import { loadFld2Gzip, type RoField } from '@/game/ro/world/fld2';
import {
  PRT_FILD08,
  PRT_FILD08_MONSTER_COUNT,
  PRT_FILD08_MONSTER_COUNTS,
} from '@/game/ro/content/prt-fild08';
import { PRT_FILD08_MONSTERS } from '@/game/ro/content/monsters';
import { EQUIPMENT } from '@/game/ro/content/equipment';
import {
  RESTORATION_CATEGORIES,
  RESTORATION_COMPLETED,
  RESTORATION_PERCENT,
  RESTORATION_TOTAL,
} from '@/game/ro/content/restoration-progress';
import { nextStatCost, type RoStatId } from '@/game/content/ro-stats';
import {
  renewalBaseAttack,
  renewalDisplayedAspd,
  renewalPlayerFlee,
  renewalPlayerHit,
} from '@/game/ro/formulas/renewal';
import { AUTOMATION_RULESET, RO_RULESET } from '@/game/ro/source';
import { RO_ZH_TW, zhTwActor, zhTwItem } from '@/game/ro/content/zh-tw';

type Panel =
  | 'status'
  | 'skills'
  | 'equipment'
  | 'inventory'
  | 'mapInfo'
  | 'automation'
  | 'progress';
type InventoryFilter =
  | 'all'
  | 'consumable'
  | 'equipment'
  | 'card'
  | 'ammo'
  | 'misc';
const PLAYER_NAME = '你';
const PLAYER_CLASS = '初心者';
const INVENTORY_FILTERS: ReadonlyArray<readonly [InventoryFilter, string]> = [
  ['all', '全部'],
  ['consumable', '消耗品'],
  ['equipment', '裝備'],
  ['card', '卡片'],
  ['ammo', '箭矢／彈藥'],
  ['misc', '其他'],
];
const ITEM_CATEGORIES: Record<string, InventoryFilter> = {
  Apple: 'consumable',
  Wing_Of_Fly: 'consumable',
  Carrot: 'consumable',
  Rainbow_Carrot: 'consumable',
  Green_Herb: 'consumable',
  Red_Herb: 'consumable',
  Knife_: 'equipment',
  Sword_: 'equipment',
  Club_: 'equipment',
  Club: 'equipment',
  Guard_: 'equipment',
  Poring_Card: 'card',
  Lunatic_Card: 'card',
  Fabre_Card: 'card',
  Pupa_Card: 'card',
  Novice_Poring_Card: 'card',
};
const EVENT_LABELS: Record<RoWorldEvent['type'], string> = {
  target: '目標',
  move: '移動',
  player_hit: '攻擊',
  player_miss: '未命中',
  monster_hit: '受傷',
  monster_miss: '閃避',
  death: '經驗',
  drop: '掉落',
  pickup: '拾取',
  heal: '恢復',
  use_item: '道具',
  base_level_up: '升級',
  job_level_up: '職業升級',
  player_death: '死亡',
  respawn: '重生',
};

function formatClock(ms: number) {
  const total = Math.trunc(ms / 1000);
  return `${String(Math.trunc(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function eventText(event: RoWorldEvent) {
  const monsterId =
    event.type === 'monster_hit' || event.type === 'monster_miss'
      ? (event.actorId ?? 'PORING')
      : (event.targetId ?? event.actorId ?? 'PORING');
  const monster = zhTwActor(monsterId);
  switch (event.type) {
    case 'target':
      return `鎖定 ${monster} · 座標 (${event.position?.x}, ${event.position?.y})`;
    case 'move':
      return `前往 (${event.position?.x}, ${event.position?.y})`;
    case 'player_hit':
      return `${PLAYER_NAME}普通攻擊 → ${monster} · 傷害 ${event.amount} · 生命 ${event.remainingHp}/${event.maximumHp}`;
    case 'player_miss':
      return `${PLAYER_NAME}攻擊 ${monster} · 未命中`;
    case 'monster_hit':
      return `${monster} 攻擊${PLAYER_NAME} · 傷害 ${event.amount} · 生命 ${event.remainingHp}/${event.maximumHp}`;
    case 'monster_miss':
      return `${monster} 攻擊${PLAYER_NAME} · 未命中`;
    case 'death':
      return `${zhTwActor(event.actorId)} 死亡 · 人物經驗 +${event.amount}（${event.baseExpCurrent}/${event.baseExpRequired} · ${(((event.baseExpCurrent ?? 0) / (event.baseExpRequired ?? 1)) * 100).toFixed(1)}%）· 職業經驗 +${event.jobAmount}（${event.jobExpCurrent}/${event.jobExpRequired} · ${(((event.jobExpCurrent ?? 0) / (event.jobExpRequired ?? 1)) * 100).toFixed(1)}%）`;
    case 'drop':
      return `${zhTwActor(event.actorId)} 掉落 ${zhTwItem(event.item ?? '')}`;
    case 'pickup':
      return `拾取 ${zhTwItem(event.item ?? '')}`;
    case 'heal':
      return `自然恢復 HP +${event.amount}`;
    case 'use_item':
      return `使用 ${zhTwItem(event.item ?? '')} · 生命 +${event.amount}`;
    case 'base_level_up':
      return `你的人物等級提升至 ${event.baseLevel} · 獲得能力點 ${event.statusPointsGained}`;
    case 'job_level_up':
      return `你的職業等級提升至 ${event.jobLevel} · 獲得技能點 ${event.skillPointsGained}`;
    case 'player_death':
      return '你已死亡 · OpenKore 等待 4 秒後送出重生';
    case 'respawn':
      return `你在儲存點復活 · 生命與魔力完全恢復 · (${event.position?.x}, ${event.position?.y})`;
  }
}

function FieldMap({ field, world }: { field: RoField; world: RoWorldState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const size = 720;
    canvas.width = size;
    canvas.height = size;
    context.fillStyle = '#000';
    context.fillRect(0, 0, size, size);
    const image = context.createImageData(field.width, field.height);
    const player = world.player.position;
    for (let y = 0; y < field.height; y += 1)
      for (let x = 0; x < field.width; x += 1) {
        const offset = y * field.width + x;
        const pixel = ((field.height - 1 - y) * field.width + x) * 4;
        const walkable = (field.cells[offset] & 1) !== 0;
        const rgb = walkable ? [91, 113, 91] : [13, 18, 13];
        image.data[pixel] = rgb[0];
        image.data[pixel + 1] = rgb[1];
        image.data[pixel + 2] = rgb[2];
        image.data[pixel + 3] = 255;
      }
    const buffer = document.createElement('canvas');
    buffer.width = field.width;
    buffer.height = field.height;
    buffer.getContext('2d')?.putImageData(image, 0, 0);
    context.imageSmoothingEnabled = false;
    context.drawImage(buffer, 0, 0, size, size);
    const scale = size / field.width;
    for (const monster of world.monsters) {
      if (
        !monster.alive ||
        Math.abs(monster.position.x - player.x) > 20 ||
        Math.abs(monster.position.y - player.y) > 20
      )
        continue;
      context.beginPath();
      context.fillStyle = monster.engaged
        ? '#ff3232'
        : PRT_FILD08_MONSTERS[monster.monster].mapColor;
      context.shadowColor = context.fillStyle;
      context.shadowBlur = monster.engaged ? 12 : 3;
      context.arc(
        monster.position.x * scale,
        (field.height - monster.position.y) * scale,
        monster.engaged ? 5 : 3,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    const hurt = [...world.events]
      .reverse()
      .find((event) => event.type === 'monster_hit');
    context.shadowColor = '#5dff9c';
    context.shadowBlur = 14;
    context.fillStyle =
      hurt && world.nowMs - hurt.atMs < 450 ? '#ff3030' : '#5dff9c';
    context.fillRect(
      player.x * scale - 5,
      (field.height - player.y) * scale - 5,
      10,
      10,
    );
  }, [field, world]);
  return (
    <canvas
      ref={canvasRef}
      className="field-canvas"
      aria-label="prt_fild08 即時小地圖"
    />
  );
}

export function GameShell() {
  const [field, setField] = useState<RoField>();
  const [world, setWorld] = useState<RoWorldState>();
  const [running, setRunning] = useState(true);
  const [panel, setPanel] = useState<Panel>('status');
  const [inventoryFilter, setInventoryFilter] =
    useState<InventoryFilter>('all');
  const [loadError, setLoadError] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadFld2Gzip(PRT_FILD08.fieldUrl)
      .then((loaded) => {
        setField(loaded);
        setWorld(createRoWorld(loaded, 824));
      })
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : String(error)),
      );
  }, []);
  useEffect(() => {
    if (!field) return;
    const timer = window.setInterval(
      () =>
        setWorld((current) =>
          current ? advanceRoWorld(current, field, 150, running) : current,
        ),
      150,
    );
    return () => window.clearInterval(timer);
  }, [field, running]);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [world?.events.length]);
  const visibleEvents = useMemo(
    () => world?.events.slice(-120) ?? [],
    [world?.events],
  );
  const inventoryCount = world
    ? Object.values(world.inventory).reduce((sum, value) => sum + value, 0)
    : 0;
  const alive = world?.monsters.filter((monster) => monster.alive).length ?? 0;
  const baseProgress = experienceProgress(
    world?.player.baseExp ?? 0,
    BASE_EXP_REQUIREMENTS,
  );
  const jobProgress = experienceProgress(
    world?.player.jobExp ?? 0,
    JOB_EXP_REQUIREMENTS,
  );
  const novice = {
    level: world?.player.baseLevel ?? 1,
    ...(world?.player.stats ?? {
      str: 1,
      agi: 1,
      vit: 1,
      int: 1,
      dex: 1,
      luk: 1,
    }),
  };
  const weaponAttack =
    EQUIPMENT[world?.player.equipment.rightHand ?? '']?.attack ?? 0;
  const atk = renewalBaseAttack(novice),
    hit = renewalPlayerHit(novice),
    flee = renewalPlayerFlee(novice);
  const aspd = renewalDisplayedAspd(novice, 55);

  if (loadError)
    return (
      <main className="loading-screen">
        <strong>地圖載入失敗</strong>
        <code>{loadError}</code>
      </main>
    );
  if (!field || !world)
    return (
      <main className="loading-screen">正在讀取普隆德拉原野地圖資料...</main>
    );

  return (
    <main className="ro-desktop">
      <section className="ro-window basic-window">
        <WindowTitle title="基本資訊" trailing={PLAYER_NAME} />
        <div className="basic-grid">
          <div className="portrait">{PLAYER_CLASS}</div>
          <div className="identity">
            <b>{PLAYER_NAME}</b>
            <span>{PLAYER_CLASS}</span>
            <small>
              人物等級 {world.player.baseLevel}　職業等級{' '}
              {world.player.jobLevel}
            </small>
          </div>
          <Meter
            label="生命"
            value={world.player.hp}
            max={world.player.maxHp}
            tone="hp"
          />
          <Meter
            label="魔力"
            value={world.player.sp}
            max={world.player.maxSp}
            tone="sp"
          />
          <div className="exp-values">
            <ExpMeter
              label={`人物 Lv. ${baseProgress.level}`}
              progress={baseProgress}
            />
            <ExpMeter
              label={`職業 Lv. ${jobProgress.level}`}
              progress={jobProgress}
            />
          </div>
          <div className="weight">
            負重 {inventoryCount * 2} / 2000　 Zeny 0
          </div>
        </div>
      </section>

      <div className="workspace-title">
        <span>
          鬼島傳說 ·{' '}
          {world.status === 'dead'
            ? '死亡等待重生'
            : running
              ? '掛機中'
              : '已暫停'}
        </span>
        <label>
          掛機地圖{' '}
          <select aria-label="掛機地圖">
            <option>{RO_ZH_TW.maps.prt_fild08} · 怪物 Lv.1</option>
          </select>
        </label>
      </div>

      <section className="workspace-grid">
        <div className="left-stack">
          <section className="ro-window map-window">
            <WindowTitle
              title={RO_ZH_TW.maps.prt_fild08}
              trailing={`怪物 ${alive}/${PRT_FILD08_MONSTER_COUNT}`}
            />
            <FieldMap field={field} world={world} />
            <div className="map-caption">
              ■ 玩家　● 波利　● 瘋兔　● 綠棉蟲　● 蛹　● 小波利　
              <span>● 交戰中</span>
            </div>
          </section>
          <section className="ro-window control-window">
            <button onClick={() => setRunning((value) => !value)}>
              {running ? '停止掛機' : '繼續掛機'}
            </button>
            <span>
              {running
                ? 'OpenKore 正在控制角色'
                : '角色已停止，世界與怪物仍持續運作'}
            </span>
          </section>
        </div>

        <section className="console-window">
          <div className="console-title">
            OpenKore 戰鬥終端　[{running ? '連線中' : '已暫停'}]
          </div>
          <div className="console-output" ref={logRef} data-testid="combat-log">
            <p className="system-line">
              [系統] 已進入普隆德拉原野，自動索敵與拾取已啟用。
            </p>
            {visibleEvents.map((event, index) => (
              <p
                className={`event-${event.type}`}
                key={`${event.atMs}-${event.type}-${index}`}
              >
                <time>{formatClock(event.atMs)}</time>
                <b>[{EVENT_LABELS[event.type]}]</b>
                <span>{eventText(event)}</span>
              </p>
            ))}
            <i className="caret" />
          </div>
          <div className="hang-stats" data-testid="hang-stats">
            <b>本次掛機統計</b>
            <span>
              時間 <strong>{formatClock(world.nowMs)}</strong>
            </span>
            <span>
              擊倒 <strong>{world.kills}</strong>
            </span>
            <span>
              人物經驗 <strong>{world.player.baseExp.toLocaleString()}</strong>
            </span>
            <span>
              職業經驗 <strong>{world.player.jobExp.toLocaleString()}</strong>
            </span>
            <span>
              死亡 <strong>{world.deaths}</strong>
            </span>
            <div className="picked-items">
              <b>拾取物品</b>
              {Object.entries(world.inventory).length === 0 ? (
                <span>尚未拾取</span>
              ) : (
                Object.entries(world.inventory).map(([item, count]) => (
                  <span key={item}>
                    {zhTwItem(item)} × {count}
                  </span>
                ))
              )}
            </div>
          </div>
        </section>

        <div className="detail-stack">
          <nav className="ro-tabs">
            {(
              [
                ['status', '能力'],
                ['skills', '技能'],
                ['equipment', '裝備'],
                ['inventory', '道具'],
                ['mapInfo', '地圖情報'],
                ['automation', '掛機設定'],
                ['progress', '還原進度'],
              ] as const
            ).map(([id, label]) => (
              <button
                className={panel === id ? 'active' : ''}
                key={id}
                onClick={() => setPanel(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <section className="ro-window detail-window">
            <WindowTitle
              title={
                panel === 'status'
                  ? '人物能力'
                  : panel === 'skills'
                    ? '技能欄'
                    : panel === 'equipment'
                      ? '裝備欄'
                      : panel === 'inventory'
                        ? '道具欄'
                        : panel === 'mapInfo'
                          ? '地圖情報'
                          : panel === 'progress'
                            ? 'RO 還原進度'
                            : 'OpenKore 掛機設定'
              }
              trailing="革新制"
            />
            {panel === 'status' && (
              <div className="status-panel">
                <div className="primary-stats">
                  {(
                    [
                      ['力量 STR', 'str'],
                      ['敏捷 AGI', 'agi'],
                      ['體力 VIT', 'vit'],
                      ['智力 INT', 'int'],
                      ['靈巧 DEX', 'dex'],
                      ['幸運 LUK', 'luk'],
                    ] as const
                  ).map(([label, id]) => (
                    <div key={id}>
                      <b>{label}</b>
                      <span>
                        {world.player.stats[id]}{' '}
                        <button
                          disabled={
                            world.player.statusPoints <
                            nextStatCost(world.player.stats[id])
                          }
                          onClick={() =>
                            setWorld((current) =>
                              current
                                ? allocateStatusPoint(current, id as RoStatId)
                                : current,
                            )
                          }
                        >
                          ＋
                        </button>
                      </span>
                    </div>
                  ))}
                  <button
                    className="reset-stats"
                    onClick={() =>
                      setWorld((current) =>
                        current ? resetStatusPoints(current) : current,
                      )
                    }
                  >
                    全部重置
                  </button>
                </div>
                <div className="derived-stats">
                  <div>
                    物理攻擊 ATK{' '}
                    <b>
                      {atk} + {weaponAttack}
                    </b>
                  </div>
                  <div>
                    物理防禦 DEF <b>0 + 0</b>
                  </div>
                  <div>
                    魔法攻擊 MATK{' '}
                    <b>{Math.trunc(world.player.stats.int * 1.5)} + 1</b>
                  </div>
                  <div>
                    魔法防禦 MDEF <b>{world.player.stats.int}</b>
                  </div>
                  <div>
                    命中 HIT <b>{hit}</b>
                  </div>
                  <div>
                    迴避 FLEE <b>{flee}</b>
                  </div>
                  <div>
                    暴擊 CRITICAL{' '}
                    <b>{1 + Math.trunc(world.player.stats.luk / 3)}</b>
                  </div>
                  <div>
                    攻速 ASPD <b>{aspd}</b>
                  </div>
                  <div>
                    能力點 <b>{world.player.statusPoints}</b>
                  </div>
                </div>
                <SourceNote
                  text={`rAthena Renewal ${RO_RULESET.commit.slice(0, 8)}；Lv.1 依玩家規則為 0 點`}
                />
              </div>
            )}
            {panel === 'skills' && (
              <div className="skill-panel">
                <header>
                  剩餘技能點 <b>{world.player.skillPoints}</b>
                </header>
                <div className="skill-row">
                  <span>基本技能</span>
                  <b>Lv. {world.player.skills.NV_BASIC} / 9</b>
                  <button
                    disabled={
                      world.player.skillPoints < 1 ||
                      world.player.skills.NV_BASIC >= 9
                    }
                    onClick={() =>
                      setWorld((current) =>
                        current ? allocateNoviceSkill(current) : current,
                      )
                    }
                  >
                    學習
                  </button>
                  <small>初心者技能。解鎖交易、表情、組隊等基本系統。</small>
                </div>
                <div className="skill-row locked">
                  <span>緊急治療</span>
                  <b>Lv. 0 / 1</b>
                  <button disabled>任務未完成</button>
                  <small>任務技能，需完成原廠前置任務。</small>
                </div>
                <SourceNote text={`rAthena skill_tree.yml · Novice`} />
              </div>
            )}
            {panel === 'equipment' && (
              <div className="equipment-panel">
                <Slot name="頭上段" />
                <Slot name="頭下段" />
                <Slot
                  name="右手"
                  item={
                    world.player.equipment.rightHand
                      ? zhTwItem(world.player.equipment.rightHand)
                      : undefined
                  }
                  detail={
                    world.player.equipment.rightHand
                      ? `物理攻擊 ${EQUIPMENT[world.player.equipment.rightHand]?.attack} · ${EQUIPMENT[world.player.equipment.rightHand]?.slots} 洞`
                      : undefined
                  }
                />
                <Slot
                  name="左手"
                  item={
                    world.player.equipment.leftHand
                      ? zhTwItem(world.player.equipment.leftHand)
                      : undefined
                  }
                  detail={
                    world.player.equipment.leftHand
                      ? `物理防禦 ${EQUIPMENT[world.player.equipment.leftHand]?.defense} · ${EQUIPMENT[world.player.equipment.leftHand]?.slots} 洞`
                      : undefined
                  }
                />
                <Slot name="鎧甲" item="棉襯衫" detail="物理防禦 10" />
                <Slot name="披肩" />
                <Slot name="鞋子" />
                <Slot name="飾品" />
                <Slot name="飾品" />
              </div>
            )}
            {panel === 'inventory' && (
              <InventoryPanel
                inventory={world.inventory}
                filter={inventoryFilter}
                onFilterChange={setInventoryFilter}
                total={inventoryCount}
                level={world.player.baseLevel}
                onEquip={(item) =>
                  setWorld((current) =>
                    current ? equipInventoryItem(current, item) : current,
                  )
                }
              />
            )}
            {panel === 'mapInfo' && <MapInformation />}
            {panel === 'automation' && (
              <div className="config-panel">
                <Setting
                  label="固定掛機地圖"
                  value={RO_ZH_TW.maps.prt_fild08}
                />
                <Setting label="自動攻擊" value="開啟" />
                <Setting label="自動拾取" value="開啟" />
                <Setting label="生命低於 50% 使用蘋果" value="開啟" />
                <Setting label="攻擊 MVP" value="關閉" />
                <Setting label="死亡後自動重生" value="4 秒" />
                <Setting label="DEMO 儲存點" value="普隆德拉南門入口" />
                <SourceNote
                  text={`OpenKore ${AUTOMATION_RULESET.commit.slice(0, 8)}`}
                />
              </div>
            )}
            {panel === 'progress' && <ProgressPanel />}
          </section>
        </div>
      </section>
      <footer className="release-note">
        R0.6 · RO 還原 {RESTORATION_PERCENT}% ·
        地圖、怪物、戰鬥、成長、經驗與掉落共用同一份模擬狀態
      </footer>
    </main>
  );
}

function WindowTitle({ title, trailing }: { title: string; trailing: string }) {
  return (
    <div className="window-title">
      <b>{title}</b>
      <span>{trailing}</span>
      <i>×</i>
    </div>
  );
}
function Meter({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: 'hp' | 'sp';
}) {
  return (
    <div className="meter">
      <b>{label}</b>
      <div>
        <i className={tone} style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span>
        {value} / {max}
      </span>
    </div>
  );
}
function ExpMeter({
  label,
  progress,
}: {
  label: string;
  progress: { current: number; required: number; percent: number };
}) {
  return (
    <div className="exp-meter">
      <b>{label}</b>
      <div>
        <i style={{ width: `${progress.percent}%` }} />
      </div>
      <span>
        {progress.current.toLocaleString()} /{' '}
        {progress.required.toLocaleString()}　{progress.percent.toFixed(1)}%
      </span>
    </div>
  );
}
function Slot({
  name,
  item,
  detail,
}: {
  name: string;
  item?: string;
  detail?: string;
}) {
  return (
    <div className="slot">
      <span>{name}</span>
      <b>{item ?? '空'}</b>
      {detail && <small>{detail}</small>}
    </div>
  );
}
function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="setting">
      <i />
      <code>{label}</code>
      <b>{value}</b>
    </div>
  );
}
function SourceNote({ text }: { text: string }) {
  return <p className="source-note">資料來源：{text}</p>;
}

function InventoryPanel({
  inventory,
  filter,
  onFilterChange,
  total,
  level,
  onEquip,
}: {
  inventory: Record<string, number>;
  filter: InventoryFilter;
  onFilterChange: (filter: InventoryFilter) => void;
  total: number;
  level: number;
  onEquip: (item: string) => void;
}) {
  const entries = Object.entries(inventory).filter(
    ([item]) => filter === 'all' || ITEM_CATEGORIES[item] === filter,
  );
  return (
    <div className="inventory-panel">
      <nav className="inventory-filters" aria-label="道具分類">
        {INVENTORY_FILTERS.map(([id, label]) => (
          <button
            type="button"
            className={filter === id ? 'active' : ''}
            key={id}
            onClick={() => onFilterChange(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {entries.length === 0 ? (
        <p>此分類目前沒有道具</p>
      ) : (
        entries.map(([item, count]) => (
          <div className="item-row" key={item}>
            <i>□</i>
            <b>{zhTwItem(item)}</b>
            <span>{count}</span>
            {EQUIPMENT[item] && (
              <button
                disabled={level < EQUIPMENT[item].equipLevelMin}
                onClick={() => onEquip(item)}
              >
                {level < EQUIPMENT[item].equipLevelMin
                  ? `Lv.${EQUIPMENT[item].equipLevelMin}`
                  : '裝備'}
              </button>
            )}
          </div>
        ))
      )}
      <footer>
        目前分類 {entries.reduce((sum, [, count]) => sum + count, 0)} 件／背包共{' '}
        {total} 件
      </footer>
    </div>
  );
}

function MapInformation() {
  return (
    <div className="map-info-panel">
      <header>
        <b>{RO_ZH_TW.maps.prt_fild08}</b>
        <span>地圖代碼 prt_fild08 · 400×400</span>
      </header>
      {Object.values(PRT_FILD08_MONSTERS).map((monster) => (
        <section className="monster-card" key={monster.aegisName}>
          <h3>
            {monster.nameZhTw}{' '}
            <small>
              Lv.{monster.level} ·{' '}
              {
                PRT_FILD08_MONSTER_COUNTS[
                  monster.aegisName as keyof typeof PRT_FILD08_MONSTER_COUNTS
                ]
              }{' '}
              隻
            </small>
          </h3>
          <div className="monster-facts">
            <span>
              生命 <b>{monster.hp}</b>
            </span>
            <span>
              物理攻擊{' '}
              <b>
                {monster.attackMin}～{monster.attackMax}
              </b>
            </span>
            <span>
              物理防禦 <b>{monster.defense}</b>
            </span>
            <span>
              魔法防禦 <b>{monster.magicDefense}</b>
            </span>
            <span>
              種族 <b>{monster.raceZhTw}</b>
            </span>
            <span>
              體型 <b>{monster.sizeZhTw}</b>
            </span>
            <span>
              屬性 <b>{monster.elementZhTw}</b>
            </span>
            <span>
              人物／職業經驗{' '}
              <b>
                {monster.baseExp}／{monster.jobExp}
              </b>
            </span>
          </div>
          <h4>掉落物</h4>
          <div className="drop-table">
            {monster.drops.map((drop, index) => (
              <div key={`${drop.item}-${index}`}>
                <span>{zhTwItem(drop.item)}</span>
                <b>{drop.ratePerTenThousand / 100}%</b>
              </div>
            ))}
          </div>
        </section>
      ))}
      <SourceNote
        text={`rAthena ${RO_RULESET.commit.slice(0, 8)}；繁中名稱採 twRO 資料層`}
      />
    </div>
  );
}

function ProgressPanel() {
  return (
    <div className="progress-panel">
      <header>
        <b>{RESTORATION_PERCENT}%</b>
        <span>
          {RESTORATION_COMPLETED} / {RESTORATION_TOTAL} 個驗收項目完成
        </span>
      </header>
      {RESTORATION_CATEGORIES.map((item) => (
        <div className="progress-row" key={item.name}>
          <div>
            <b>{item.name}</b>
            <span>
              {item.completed}/{item.total}
            </span>
          </div>
          <meter min="0" max={item.total} value={item.completed} />
          <small>{item.evidence}</small>
        </div>
      ))}
    </div>
  );
}
