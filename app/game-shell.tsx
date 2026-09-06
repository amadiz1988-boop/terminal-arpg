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
import { isSupportCompatible, SUPPORT_ORDER, SUPPORTS } from '@/game/content/supports';
import { TALENT_BOARDS, TALENTS, type TalentBoardId } from '@/game/content/talents';
import type { ClassId, ContractId, Item, ItemSlot, MarketListing, OrbWallet, Policy, RunMode, SecondJobId, SkillId, SupportId } from '@/game/core/types';
import { addLink, addSocket, ascendItem, createStarterWeapon, essenceCraft, evaluateItem, formatAffixes, generateItem, itemLinks, itemSockets, recolorSockets, refineItem, salvageValue } from '@/game/items/items';
import { acceptInventoryDrops, repairEquippedItems } from '@/game/items/inventory';
import { spendWallet } from '@/game/economy/wallet';
import { resolveStats } from '@/game/modifiers/resolve-stats';
import { completeCampaignOperation } from '@/game/progression/campaign';
import { exchangeMaps } from '@/game/progression/maps';
import { nextPowerGoal, SLOT_LABELS, TIER_POWER_REQUIREMENTS, unlockedTier } from '@/game/progression/power';
import { contractFailureChance, generateMonsterPacks, generateMonsterPopulation, getRunStopReason, progressPerTick, simulateMapCompletion } from '@/game/simulation/map';

type Log = { id: number; kind: string; text: string };
const EMPTY_ORBS: OrbWallet = { alteration: 0, chromatic: 0, fusing: 0, jeweller: 0 };
const COLOR_LABEL = { R: '紅', G: '綠', B: '藍', W: '白' } as const;
const ORB_LABEL:Record<keyof OrbWallet,string>={alteration:'改造石',chromatic:'幻色石',fusing:'連結石',jeweller:'工匠石'};
type StashPage={id:string;name:string;items:Item[]};
const DEMO_LISTING:MarketListing={id:'demo-market-1',owner:'旅人#017',item:generateItem(95001,36,'helmet'),priceOrb:'chromatic',price:2};

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
  const [gemHostSlot,setGemHostSlot]=useState<ItemSlot>('weapon');
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
  const [itemFilter,setItemFilter]=useState<'all'|'upgrade'|'rare'|'socketed'>('all');
  const [stashPages,setStashPages]=useState<StashPage[]>([{id:'stash-1',name:'倉庫一',items:[]},{id:'stash-2',name:'倉庫二',items:[]},{id:'stash-3',name:'倉庫三',items:[]}]);
  const [activeStashId,setActiveStashId]=useState('stash-1');
  const [listings,setListings]=useState<MarketListing[]>([DEMO_LISTING]);
  const [saleDraft,setSaleDraft]=useState<{itemId:string;priceOrb:keyof OrbWallet;price:number}>({itemId:'',priceOrb:'chromatic',price:2});
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
  const socketItem=equippedItems[gemHostSlot];
  const linkCount = itemLinks(socketItem);
  const supportCapacity = Math.max(0, linkCount - 1);
  const activeSkill = {...skills[skillId], baseDamage:Math.round(skills[skillId].baseDamage*(1+((skillLevels[skillId]??1)-1)*.06))};
  const build = { ...equippedItems, skill: activeSkill, socketItem, socketSlot:gemHostSlot, supports: selectedSupports.map((id) => SUPPORTS[id]), supportSlots: linkCount, talents, classId, secondJobId, ascendancyNodes };
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
  const filteredItems=evaluatedItems.filter(({item,evaluation})=>itemFilter==='all'||itemFilter==='upgrade'&&evaluation.classification==='upgrade'||itemFilter==='rare'&&(item.rarity==='RARE'||item.rarity==='LEGENDARY')||itemFilter==='socketed'&&itemSockets(item).length>0);
  const activeStash=stashPages.find(page=>page.id===activeStashId)??stashPages[0];
  const bestUpgrade = evaluatedItems.find(({item,evaluation}) => equipped[item.slot] !== item.id && evaluation.classification === 'upgrade');
  const mapPopulation=generateMonsterPopulation(seedRef.current+1);
  const mapPacks=generateMonsterPacks(seedRef.current+1,mapPopulation);
  const packByPosition=new globalThis.Map(mapPacks.map(pack=>[pack.position,pack] as const));

  const pushLogs = (entries: Array<[string,string]>) => setLogs((value) => [...value.slice(-115), ...entries.map(([kind,text], index) => ({ id: Date.now()+index+Math.random(), kind, text }))]);
  const pushLog = (kind:string,text:string) => pushLogs([[kind,text]]);

  const chooseClass = (id: ClassId) => {
    const definition = CLASSES[id];
    const starter = createStarterWeapon(id);
    setClassId(id); setClassChosen(true); setSecondJobId(undefined); setAscendancyNodes([]);
    setSkillId(definition.starterSkill); setGemHostSlot('weapon');setAcquiredSkills([definition.starterSkill]); setSkillLevels({[definition.starterSkill]:1}); setItems([starter]); setEquipped({weapon:starter.id});
    setTalentBoard(id === 'thief' ? 'hunt' : id === 'mage' ? 'wisdom' : 'might');
    pushLogs([['JOB',`初心職業：${definition.name} · 固有特性「${definition.trait}」`],['ITEM',`取得 ${starter.name} · ${COLOR_LABEL[starter.sockets![0]]}洞`],['SKILL',`裝備技能寶石：${skills[definition.starterSkill].name}`]]);
  };

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get('fresh') === '1') window.localStorage.removeItem('terminal-arpg-save');
      const raw = window.localStorage.getItem('terminal-arpg-save');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.schemaVersion === 4||s.schemaVersion===5) {
          setClassChosen(s.classChosen); setClassId(s.classId); setSecondJobId(s.secondJobId); setAscendancyNodes(s.ascendancyNodes); setTalentBoard(s.talentBoard); setTalents(s.talents);
          setSkillId(s.skillId); setAcquiredSkills(s.acquiredSkills); setSkillLevels(s.skillLevels??{[s.skillId]:1}); setAcquiredSupports(s.acquiredSupports); setSelectedSupports(s.selectedSupports); setPolicy(s.policy); setContractId(s.contractId);
          setMode(s.mode); setGoal(s.goal); setTier(s.tier); setMaps(s.maps); setCampaignStep(s.campaignStep); setLifetimeRuns(s.lifetimeRuns); setTotalKills(s.totalKills); setXp(s.xp);
          const loadedItems:Item[]=s.items??[];setItems(loadedItems); setEquipped(repairEquippedItems(loadedItems,s.equipped??{})); setMaterials(s.materials); setOrbs(s.orbs); setSalvageMode(s.salvageMode); seedRef.current=s.seed;
          setGemHostSlot(s.gemHostSlot??'weapon');if(s.stashPages)setStashPages(s.stashPages);if(s.activeStashId)setActiveStashId(s.activeStashId);if(s.listings)setListings(s.listings);
        }
      }
    } catch { /* Invalid saves fall back to a clean character. */ }
    setSaveLoaded(true);
  },[]);

  useEffect(() => {
    if (!saveLoaded || running) return;
    window.localStorage.setItem('terminal-arpg-save',JSON.stringify({schemaVersion:5,seed:seedRef.current,classChosen,classId,secondJobId,ascendancyNodes,talentBoard,talents,skillId,skillLevels,acquiredSkills,acquiredSupports,selectedSupports,gemHostSlot,policy,contractId,mode,goal,tier,maps,campaignStep,lifetimeRuns,totalKills,xp,items,equipped,materials,orbs,salvageMode,stashPages,activeStashId,listings}));
  },[saveLoaded,running,classChosen,classId,secondJobId,ascendancyNodes,talentBoard,talents,skillId,skillLevels,acquiredSkills,acquiredSupports,selectedSupports,gemHostSlot,policy,contractId,mode,goal,tier,maps,campaignStep,lifetimeRuns,totalKills,xp,items,equipped,materials,orbs,salvageMode,stashPages,activeStashId,listings]);

  const equipItem = (item:Item) => {
    const replacesSocket=item.slot===gemHostSlot;const next = resolveStats({...build,[item.slot]:item,socketItem:replacesSocket?item:socketItem,supportSlots:replacesSocket?itemLinks(item):linkCount});
    setEquipped(v=>({...v,[item.slot]:item.id}));
    if(replacesSocket)setSelectedSupports(v=>v.slice(0,Math.max(0,itemLinks(item)-1)));
    pushLog('POWER',`換上 ${item.name} · DPS ${dps.toLocaleString()} → ${next.dps.toLocaleString()}`);
  };

  const spendOrb = (kind:keyof OrbWallet, transform:(item:Item)=>Item, label:string) => {
    if(!weapon || orbs[kind] < 1) return;
    const next=transform(weapon);if(next===weapon||JSON.stringify(next)===JSON.stringify(weapon)){pushLog('WARN',`${label}無法再改善這件裝備，通貨未扣除`);return;}const paid=spendWallet(orbs,kind);if(!paid)return;setItems(v=>v.map(i=>i.id===weapon.id?next:i)); setOrbs(paid);
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
    let acquiredThisRun=0;
    const completed=runs+1; setRuns(completed); setLifetimeRuns(v=>v+1); setXp(v=>v+result.xp); setTotalKills(v=>v+result.kills);
    if(result.success){
      const processed=result.items.map(item=>{const evaluation=evaluateItem(item,build);const auto=salvageMode==='common'?item.rarity==='COMMON':salvageMode==='smart'?evaluation.classification==='salvage'&&item.rarity!=='LEGENDARY':false;return {item,evaluation,auto};});
      const kept=processed.filter(entry=>!entry.auto);const acceptedItems=acceptInventoryDrops(items,kept.map(entry=>entry.item));const acceptedIds=new Set(acceptedItems.map(item=>item.id));const accepted=kept.filter(entry=>acceptedIds.has(entry.item.id));const overflow=kept.length-accepted.length;
      acquiredThisRun=accepted.length;
      const recycled=processed.filter(entry=>entry.auto).reduce((sum,entry)=>{const gain=salvageValue(entry.item);return {scrap:sum.scrap+gain.scrap,essence:sum.essence+gain.essence,core:sum.core+gain.core};},{scrap:0,essence:0,core:0});
      if(recycled.scrap+recycled.essence+recycled.core>0)setMaterials(v=>({scrap:v.scrap+recycled.scrap,essence:v.essence+recycled.essence,core:v.core+recycled.core}));
      if(accepted.length>0)setItems(v=>[...accepted.map(entry=>entry.item),...v].slice(0,100));
      setOrbs(v=>({alteration:v.alteration+result.orbs.alteration,chromatic:v.chromatic+result.orbs.chromatic,fusing:v.fusing+result.orbs.fusing,jeweller:v.jeweller+result.orbs.jeweller}));
      setMaps(v=>{const n=[...v];n[1]+=1;if(result.mapDropTier>1)n[result.mapDropTier]+=1;return n;});
      if(result.gemDrop.type==='skill'){const id=result.gemDrop.id;const owned=acquiredSkills.includes(id);setAcquiredSkills(v=>v.includes(id)?v:[...v,id]);setSkillLevels(v=>({...v,[id]:(v[id]??0)+1}));pushLog('GEM',owned?`${skills[id].name} 寶石經驗 +1 · 升至 Lv.${(skillLevels[id]??1)+1}`:`技能寶石掉落：${skills[id].name} Lv.1 · ${COLOR_LABEL[skills[id].socketColor]}色`);}
      else {const id=result.gemDrop.id;setAcquiredSupports(v=>v.includes(id)?v:[...v,id]);pushLog('GEM',`輔助寶石掉落：${SUPPORTS[id].name} · ${COLOR_LABEL[SUPPORTS[id].socketColor]}色`);}
      const strongest=processed.toSorted((a,b)=>Math.max(b.evaluation.dpsDelta,b.evaluation.clearDelta,b.evaluation.survivalDelta)-Math.max(a.evaluation.dpsDelta,a.evaluation.clearDelta,a.evaluation.survivalDelta))[0];
      const orbTotal=Object.values(result.orbs).reduce((a,b)=>a+b,0); setSessionLoot(v=>({items:v.items+accepted.length,gems:v.gems+1,orbs:v.orbs+orbTotal,xp:v.xp+result.xp}));
      pushLogs([['MONSTER',`怪物 ${result.monsters.total} · 普通 ${result.monsters.normal}／魔法 ${result.monsters.magic}／稀有 ${result.monsters.rare}／特殊 ${result.monsters.special}／首領 1`],...(result.specialEncounter?[['SECRET','發現迷霧中的異變旅人 · 彩蛋事件啟動 · 掉落加成'] as [string,string]]:[]),['LOOT',`掉落 ${result.items.length} 件 · 拾取 ${accepted.length} · 分解 ${processed.length-kept.length}${strongest?` · 最佳 ${strongest.evaluation.dpsDelta>=0?'+':''}${strongest.evaluation.dpsDelta}% DPS`:''}`],...(overflow>0?[['BAG',`背包 100/100 · ${overflow} 件裝備留在地面，通貨照常拾取`] as [string,string]]:[]),['CURRENCY',`改造石 +${result.orbs.alteration} · 幻色石 +${result.orbs.chromatic} · 連結石 +${result.orbs.fusing} · 工匠石 +${result.orbs.jeweller}`],['EXP',`角色 EXP +${result.xp} · 本圖擊殺 ${result.kills}`]]);
    } else pushLog('DEATH',`${CONTRACTS[contractId].name} 失敗 · 保留少量經驗`);
    const projected=[...maps]; if(result.success){projected[1]+=1;if(result.mapDropTier>1)projected[result.mapDropTier]+=1;}
    const available=tier===1?1:projected[tier]; const reason=getRunStopReason({mode,completed,goal,elapsedMs:Date.now()-sessionStart.current,availableNext:available,tier});
    if(reason){setRunning(false);setProgress(100);pushLog('REPORT',`循環結束 · ${completed} 圖 · ${sessionLoot.items+acquiredThisRun} 件入袋 · ${sessionLoot.gems+(result.success?1:0)} 寶石 · ${sessionLoot.orbs+Object.values(result.orbs).reduce((a,b)=>a+b,0)} 通貨`);return;}
    window.setTimeout(()=>{if(tier>1)setMaps(v=>{const n=[...v];if(n[tier]>0)n[tier]-=1;return n;});setProgress(0);pushLog('ROUTE',`計算下一張 T${tier} 路線 · 座標 ${24+tier},${60+completed}`);},500);
  };

  useEffect(()=>{
    if(!running)return;
    const timer=window.setInterval(()=>setProgress(current=>{
      if(current>=100)return current;
      const next=Math.min(100,current+progressPerTick(build,tier,policy));
      const target=['波利','邪骸戰士','赤焰魔像','深淵守門者'][seedRef.current%4];
      for(let stage=Math.floor(current/20)+1;stage<=Math.floor(next/20);stage+=1){
        if(stage===1)pushLogs([['ROUTE',`迷霧揭露 · 移動至混合怪群 (${18+tier},${42+runs})`],['TARGET',`普通、魔法與稀有怪混編 · ${target} Lv.${tier*8}`]]);
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
        if(stage===4)pushLogs([['SKILL',`使用 ${skills[skillId].name} · 已清除沿途混合怪群`],['DROP','魔法、稀有與特殊怪掉落訊號優先標記']]);
        if(stage===5)pushLog('BOSS',`抵達地圖末端 · 首領區域開啟 · 唯一首領生命 ${Math.round(tier*resolved.bossDps*.8).toLocaleString()}`);
      }
      if(next>=100)window.setTimeout(finishMap,100);return next;
    }),330);
    return()=>window.clearInterval(timer);
  },[running,dps,tier,policy,skillId,runs,goal,mode,maps,contractId,combatDetail,secondJobId,items.length,salvageMode]);

  useEffect(()=>{logRef.current?.scrollTo({top:logRef.current.scrollHeight,behavior:'smooth'});},[logs]);

  const start=()=>{
    if(inCampaign){setRuns(0);setProgress(0);setRunning(true);pushLog('QUEST',`接受 ${operation.title} · ${operation.lesson}`);return;}
    if(tier>maxTier){pushLog('WARN',`有效 DPS 需達 ${TIER_POWER_REQUIREMENTS[tier].toLocaleString()} 才能進入 T${tier}`);return;}
    const startTier=tier===1||maps[tier]>0?tier:1;if(startTier!==tier){setTier(1);pushLog('RECOVER','高階圖已耗盡，切回無限 T1 繼續成長');}
    if(startTier>1)setMaps(v=>{const n=[...v];n[startTier]-=1;return n;});
    setRuns(0);setSessionLoot({items:0,gems:0,orbs:0,xp:0});setProgress(0);sessionStart.current=Date.now();setRunning(true);
    pushLogs([['AI',`啟動 T${startTier} · ${policies[policy][0]} · ${mode==='count'?`${goal} 張`:mode==='time'?`${goal*10} 秒`:'直到地圖耗盡'}`],['ROUTE','載入地圖資料 · 出生點 (12,08)']]);
  };

  const toggleSupport=(id:SupportId)=>{if(selectedSupports.includes(id)){setSelectedSupports(v=>v.filter(x=>x!==id));return;}if(!isSupportCompatible(SUPPORTS[id],skills[skillId].tags)){pushLog('WARN',`${SUPPORTS[id].name} 無法輔助「${skills[skillId].name}」的 ${skills[skillId].tags.join('／')} 標籤`);return;}if(selectedSupports.length>=supportCapacity){pushLog('WARN',`${linkCount} 連裝備僅能容納主技能與 ${supportCapacity} 顆輔助`);return;}setSelectedSupports(v=>[...v,id]);};
  const insertSkill=(id:SkillId)=>{const current=equippedItems[gemHostSlot];const candidates=(Object.keys(SLOT_LABELS) as ItemSlot[]).filter(slot=>{const item=equippedItems[slot];return item&&itemSockets(item).some(color=>color==='W'||color===skills[id].socketColor);});const host=current&&candidates.includes(gemHostSlot)?gemHostSlot:candidates[0];if(!host){pushLog('WARN',`沒有已裝備的 ${COLOR_LABEL[skills[id].socketColor]}洞或白洞，無法插入 ${skills[id].name}`);return;}setGemHostSlot(host);setSkillId(id);const capacity=Math.max(0,itemLinks(equippedItems[host])-1);setSelectedSupports(v=>v.filter(supportId=>isSupportCompatible(SUPPORTS[supportId],skills[id].tags)).slice(0,capacity));pushLog('SOCKET',`${skills[id].name} 已插入${SLOT_LABELS[host]} · 僅同一連線內的輔助生效`);};
  const storeItem=(item:Item)=>{if(equipped[item.slot]===item.id)return;setItems(v=>v.filter(entry=>entry.id!==item.id));setStashPages(v=>v.map(page=>page.id===activeStashId?{...page,items:[item,...page.items]}:page));pushLog('STASH',`${item.name} 已移入「${activeStash.name}」`);};
  const withdrawItem=(item:Item)=>{if(items.length>=100){pushLog('WARN','背包已滿 100/100，無法取出倉庫裝備');return;}if(listings.some(listing=>listing.item.id===item.id)){pushLog('WARN','拍賣中的裝備已鎖定，請先取消上架');return;}setStashPages(v=>v.map(page=>page.id===activeStashId?{...page,items:page.items.filter(entry=>entry.id!==item.id)}:page));setItems(v=>[item,...v]);pushLog('STASH',`${item.name} 已取回背包`);};
  const listForSale=(item:Item)=>{if(saleDraft.itemId!==item.id){setSaleDraft(v=>({...v,itemId:item.id}));return;}setListings(v=>[...v,{id:`listing-${Date.now()}`,owner:'你',item,priceOrb:saleDraft.priceOrb,price:Math.max(1,saleDraft.price)}]);setSaleDraft(v=>({...v,itemId:''}));pushLog('MARKET',`${item.name} 已上架 · ${ORB_LABEL[saleDraft.priceOrb]} ×${Math.max(1,saleDraft.price)}`);};
  const cancelListing=(listing:MarketListing)=>{setListings(v=>v.filter(entry=>entry.id!==listing.id));pushLog('MARKET',`${listing.item.name} 已取消上架並解除鎖定`);};
  const buyListing=(listing:MarketListing)=>{if(items.length>=100){pushLog('WARN','背包已滿 100/100，無法購買');return;}const paid=spendWallet(orbs,listing.priceOrb,listing.price);if(!paid){pushLog('WARN',`${ORB_LABEL[listing.priceOrb]}不足，無法購買`);return;}setOrbs(paid);setItems(v=>[{...listing.item,id:`${listing.item.id}-bought-${Date.now()}`},...v]);setListings(v=>v.filter(entry=>entry.id!==listing.id));pushLog('MARKET',`購買成功 · ${listing.item.name} 已送入背包`);};
  const buyTalent=(id:string,requires?:string)=>{if(talentPoints<1||talents.includes(id)||(requires&&!talents.includes(requires)))return;setTalents(v=>[...v,id]);pushLog('TALENT',`配置天賦：${TALENTS.find(n=>n.id===id)?.name}`);};
  const upgradeMap=(from:number)=>{if(maps[from]<3)return;setMaps(v=>exchangeMaps(v,from));pushLog('MAP',`地圖三換一 · T${from} ×3 → T${from+1} ×1`);};

  if(!saveLoaded)return null;
  return <main className="min-h-screen bg-background text-foreground"><div className="scanlines" aria-hidden="true" />
    <header className="border-b border-border/80 bg-card/80"><div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3 sm:px-6"><div className="flex items-center gap-3"><div className="brand-mark"><CircleDot className="size-5"/></div><div><div className="flex gap-2"><h1 className="font-mono text-sm font-bold tracking-[.16em] text-primary">TERMINAL ARPG</h1><span className="rounded border border-primary/30 px-1.5 font-mono text-[9px] text-primary">ALPHA 0.8</span></div><p className="text-[11px] text-muted-foreground">RO 職業 × 技能寶石 × 自動遠征</p></div></div><div className="text-right font-mono text-xs"><b className="text-primary">Lv.{level} · {classChosen?(secondJobId?SECOND_JOBS[secondJobId].name:CLASSES[classId].name):'未選職'}</b><small className="block text-muted-foreground">DPS {dps.toLocaleString()}</small></div></div></header>
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
        <div className="map-frame"><div className="map-population"><b>本圖 {mapPopulation.total} 隻</b><span>普通 {mapPopulation.normal}</span><span className="magic-text">魔法 {mapPopulation.magic}</span><span className="rare-text">稀有 {mapPopulation.rare}</span><span className="special-text">特殊 {mapPopulation.special}</span><span>首領 1</span></div><div className="field-map" aria-label="大型迷霧地圖探索視圖">{Array.from({length:240},(_,i)=>{const reveal=Math.max(8,Math.floor(progress*2.4));const player=Math.min(219,Math.max(5,reveal-3));const pack=packByPosition.get(i);const boss=i===230;const hidden=i>reveal||(boss&&progress<96);const tone=pack?(pack.special?'special':pack.rare?'rare':pack.magic?'magic':'monster'):i%17===0?'wall':'';const title=pack?`混合怪群：普通 ${pack.normal}／魔法 ${pack.magic}／稀有 ${pack.rare}／特殊 ${pack.special}`:boss?'首領區域：唯一首領':'';return <i key={i} title={title} className={hidden?'fog':i===player?'player':boss?'boss':tone}>{hidden?'':i===player?'◆':boss?'B':pack?'×':''}</i>})}<span>◆ 玩家　× 混合怪群　B 首領區域　深色為未探索迷霧</span></div></div>
        <div className="terminal-grid"><div className="terminal-shell"><div className="terminal-titlebar"><span className="font-mono text-[10px] text-primary">戰鬥終端://T{tier}/{skills[skillId].name}</span><div className="flex gap-1"><button onClick={()=>setCombatDetail('compact')} className={combatDetail==='compact'?'active':''}>精簡</button><button onClick={()=>setCombatDetail('full')} className={combatDetail==='full'?'active':''}>完整</button></div><span className="font-mono text-[10px] text-muted-foreground">{running?`RUN ${runs+1}`:'IDLE'}</span></div><div ref={logRef} className="terminal-output">{logs.map(log=><div key={log.id} className={`log-line log-${log.kind.toLowerCase()}`}><time>{log.id===1?'00:00:00':new Date(log.id).toLocaleTimeString('zh-TW',{hour12:false}).slice(0,8)}</time><b>[{log.kind}]</b><span>{log.text}</span></div>)}{running&&<div className="terminal-cursor">&gt; attack.auto<i/></div>}</div></div><div className="chat-shell"><div className="chat-title">區域聊天 <span>單機預覽</span></div><div className="chat-output">{chat.map(row=><p key={row.id}><b>[{row.name}]</b> {row.text}</p>)}</div><form onSubmit={event=>{event.preventDefault();const text=chatInput.trim();if(!text)return;setChat(v=>[...v.slice(-30),{id:Date.now(),name:'你',text}]);setChatInput('');}}><input aria-label="聊天訊息" value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="輸入訊息…"/><button>送出</button></form></div></div>
        <div className="panel p-4"><div className="flex justify-between"><div><div className="section-label"><Activity className="size-3.5"/>T{tier} 探索 {progress}%</div><p className="mt-1 text-xs text-muted-foreground">本輪 {runs} 圖 · 累計 {lifetimeRuns} 圖 · T1 永久可進入</p></div><b className="font-mono text-xl text-primary">{totalKills} KILLS</b></div><div className="progress-track mt-3"><div className="progress-fill" style={{width:`${progress}%`}}/></div><div className="mt-3 grid grid-cols-4 gap-2"><Mini label="裝備" value={String(sessionLoot.items)}/><Mini label="寶石" value={String(sessionLoot.gems)}/><Mini label="通貨" value={String(sessionLoot.orbs)}/><Mini label="經驗" value={String(sessionLoot.xp)}/></div></div>
      </section>
      <aside className="space-y-4">
        {!secondJobId&&<Panel title="二轉挑戰" icon={Zap}><p className="mb-3 text-xs text-muted-foreground">Lv.6 且累計擊殺 180 後，可挑戰一條二轉路線。</p>{CLASSES[classId].jobs.map(id=>{const j=SECOND_JOBS[id];return <button key={id} disabled={!jobReady||running} onClick={()=>{setSecondJobId(id);pushLog('JOB',`二轉試煉完成 · ${j.name} · 獲得「${j.trait}」`);}} className="setting-row"><span><b>{j.name} · {j.trait}</b><small>{j.description}</small></span><em>{jobReady?'挑戰':'未達成'}</em></button>})}</Panel>}
        {secondJobId&&<Panel title={`${SECOND_JOBS[secondJobId].name}特殊節點 · ${ascPoints} 點`} icon={Zap}><div className="space-y-2">{SECOND_JOBS[secondJobId].nodes.map((n,i)=><button key={n.id} disabled={running||ascPoints<1||ascendancyNodes.includes(n.id)||(i>0&&!ascendancyNodes.includes(SECOND_JOBS[secondJobId].nodes[i-1].id))} onClick={()=>setAscendancyNodes(v=>[...v,n.id])} className={`setting-row ${ascendancyNodes.includes(n.id)?'active':''}`}><span><b>{n.name}</b><small>{n.description}</small></span><em>{ascendancyNodes.includes(n.id)?'已配置':'+'}</em></button>)}</div></Panel>}
        <Panel title={`天賦 · ${talentPoints} 點`} icon={TrendingUp}><div className="grid grid-cols-3 gap-1">{(Object.keys(TALENT_BOARDS) as TalentBoardId[]).map(id=><button key={id} onClick={()=>setTalentBoard(id)} className={`mode-button ${talentBoard===id?'active':''}`}>{TALENT_BOARDS[id].name}</button>)}</div><div className="mt-3 space-y-2">{TALENTS.filter(n=>n.board===talentBoard).map(n=><button key={n.id} disabled={running||talentPoints<1||talents.includes(n.id)||(!!n.requires&&!talents.includes(n.requires))} onClick={()=>buyTalent(n.id,n.requires)} className={`setting-row ${talents.includes(n.id)?'active':''}`}><span><b>{n.name}</b><small>{n.description}</small></span><em>{talents.includes(n.id)?'已配置':'+'}</em></button>)}</div>{talents.length>0&&<button disabled={running} onClick={()=>setTalents([])} className="mt-3 text-xs text-muted-foreground underline">免費重置天賦</button>}</Panel>
        <Panel title="已插入的寶石與寶石背包" icon={Swords}><div className="socket-host"><small>目前插入</small><b>{socketItem?`${SLOT_LABELS[gemHostSlot]} · ${socketItem.name}`:'沒有可用裝備'}</b><SocketSummary item={socketItem}/><span>{skills[skillId].name} + {selectedSupports.map(id=>SUPPORTS[id].name).join(' + ')||'無輔助'}</span></div><p className="mt-2 text-[10px] text-muted-foreground">只有插入同一件裝備連線內的寶石才會生效。下方只列出實際取得的寶石。</p><div className="mt-3 space-y-2">{(Object.keys(skills) as SkillId[]).filter(id=>acquiredSkills.includes(id)).map(id=>{const s=skills[id],inserted=skillId===id;return <button key={id} disabled={running} onClick={()=>insertSkill(id)} className={`skill-card ${inserted?'active':''}`} style={{'--skill-color':s.color} as React.CSSProperties}><span className={`socket socket-${s.socketColor.toLowerCase()}`}>{s.socketColor}</span><span><b>{s.name} Lv.{skillLevels[id]??1}</b><small>{s.description} · 標籤：{s.tags.join('／')}</small></span><em>{inserted?`已插入${SLOT_LABELS[gemHostSlot]}`:'插入'}</em></button>})}</div><div className="mt-3 space-y-2">{SUPPORT_ORDER.filter(id=>acquiredSupports.includes(id)).map(id=>{const s=SUPPORTS[id],compatible=isSupportCompatible(s,skills[skillId].tags),active=selectedSupports.includes(id)&&compatible;return <button key={id} disabled={running||(!compatible&&!active)} onClick={()=>toggleSupport(id)} className={`setting-row ${active?'active':''}`}><span><b><i className={`socket socket-${s.socketColor.toLowerCase()}`}>{s.socketColor}</i> {s.name}</b><small>{s.description} · 需求：{s.requiredSkillTags.join('／')}</small></span><em>{active?'已插入':compatible?'插入連線':'不相容'}</em></button>})}</div></Panel>
        {!inCampaign&&<Panel title="通貨打造" icon={Anvil}><div className="space-y-2"><Craft label="改造石：重鑄主詞綴" count={weapon?orbs.alteration:0} onClick={()=>spendOrb('alteration',refineItem,'改造')}/><Craft label="幻色石：改變洞色" count={weapon?orbs.chromatic:0} onClick={()=>spendOrb('chromatic',recolorSockets,'換色')}/><Craft label="工匠石：增加洞數" count={weapon?orbs.jeweller:0} onClick={()=>spendOrb('jeweller',addSocket,'打洞')}/><Craft label="連結石：增加連線" count={weapon?orbs.fusing:0} onClick={()=>spendOrb('fusing',addLink,'連線')}/><button disabled={materials.essence<1||!weapon} onClick={()=>{if(!weapon)return;const n=essenceCraft(weapon);setItems(v=>v.map(i=>i.id===weapon.id?n:i));setMaterials(v=>({...v,essence:v.essence-1}));}} className="craft-button">精華：保證新增一條詞綴 <em>×{materials.essence}</em></button><button disabled={materials.core<1||!weapon} onClick={()=>{if(!weapon)return;const n=ascendItem(weapon);setItems(v=>v.map(i=>i.id===weapon.id?n:i));setMaterials(v=>({...v,core:v.core-1}));}} className="craft-button">核心：升華裝備 <em>×{materials.core}</em></button></div></Panel>}
        <Panel title={`六格裝備與背包 · ${items.length}/100`} icon={Box}><div className="mb-3 grid grid-cols-2 gap-2">{(Object.keys(SLOT_LABELS) as ItemSlot[]).map(slot=><Equip key={slot} slot={SLOT_LABELS[slot]} item={equippedItems[slot]}/>)}</div><div className="mb-2 grid grid-cols-3 gap-1">{([['off','不分解'],['common','普通以下'],['smart','智慧分解']] as const).map(([id,label])=><button key={id} onClick={()=>setSalvageMode(id)} className={`mode-button ${salvageMode===id?'active':''}`}>{label}</button>)}</div><div className="mb-3 grid grid-cols-4 gap-1">{([['all','全部'],['upgrade','升級'],['rare','稀有+'],['socketed','有洞']] as const).map(([id,label])=><button key={id} onClick={()=>setItemFilter(id)} className={`mode-button ${itemFilter===id?'active':''}`}>{label}</button>)}</div><div className="inventory-list">{filteredItems.map(({item,evaluation})=>{const used=equipped[item.slot]===item.id;const gain=Math.max(evaluation.dpsDelta,evaluation.survivalDelta,evaluation.clearDelta);return <div className="inventory-row" key={item.id}><button disabled={running||used} onClick={()=>equipItem(item)} className={`inventory-item ${used?'equipped':''}`}><span className={`rarity rarity-${item.rarity.toLowerCase()}`}>{item.rarity}</span><span><b>{gain>=0?'+':''}{gain}% · {item.name}</b><small>{SLOT_LABELS[item.slot]} · Lv.{item.itemLevel} · {formatAffixes(item)}</small><SocketSummary item={item}/></span><em>{used?'使用中':evaluation.classification==='upgrade'?'換裝':'查看'}</em></button><button className="stash-action" disabled={running||used} onClick={()=>storeItem(item)}>存</button></div>})}</div></Panel>
        <Panel title="倉庫 · 基礎三頁" icon={Box}><div className="grid grid-cols-3 gap-1">{stashPages.map(page=><button key={page.id} onClick={()=>setActiveStashId(page.id)} className={`mode-button ${activeStashId===page.id?'active':''}`}>{page.name} · {page.items.length}</button>)}</div><input className="stash-name" aria-label="自訂倉庫標籤名稱" value={activeStash.name} onChange={event=>setStashPages(v=>v.map(page=>page.id===activeStashId?{...page,name:event.target.value.slice(0,12)}:page))}/><div className="inventory-list">{activeStash.items.map(item=>{const listing=listings.find(entry=>entry.item.id===item.id);return <div className="stash-item" key={item.id}><div><b>{item.name}</b><small>{SLOT_LABELS[item.slot]} · {item.rarity} · Lv.{item.itemLevel}</small><SocketSummary item={item}/></div>{listing?<button onClick={()=>cancelListing(listing)}>取消上架</button>:<div className="stash-actions"><button onClick={()=>withdrawItem(item)}>取出</button><button onClick={()=>listForSale(item)}>{saleDraft.itemId===item.id?'確認上架':'標價'}</button></div>}{saleDraft.itemId===item.id&&!listing&&<div className="sale-draft"><select value={saleDraft.priceOrb} onChange={event=>setSaleDraft(v=>({...v,priceOrb:event.target.value as keyof OrbWallet}))}>{(Object.keys(ORB_LABEL) as Array<keyof OrbWallet>).map(id=><option key={id} value={id}>{ORB_LABEL[id]}</option>)}</select><input aria-label="售價數量" type="number" min="1" max="999" value={saleDraft.price} onChange={event=>setSaleDraft(v=>({...v,price:Math.max(1,Number(event.target.value))}))}/></div>}</div>})}</div></Panel>
        <Panel title="拍賣場 · 單機市場預覽" icon={Coins}><p className="mb-2 text-[10px] text-muted-foreground">公開多人市場將在帳號與伺服器資料庫接通後共用。交易規則已生效。</p><div className="inventory-list">{listings.map(listing=><div className="market-item" key={listing.id}><span><b>{listing.item.name}</b><small>{listing.owner} · {listing.item.rarity} · {ORB_LABEL[listing.priceOrb]} ×{listing.price}</small><SocketSummary item={listing.item}/></span><button onClick={()=>listing.owner==='你'?cancelListing(listing):buyListing(listing)}>{listing.owner==='你'?'取消':'購買'}</button></div>)}</div></Panel>
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
function SocketSummary({item}:{item?:Item}){const sockets=itemSockets(item),links=itemLinks(item);return <span className="socket-summary">{sockets.length===0?<small>無洞 · 無連線</small>:<>{sockets.map((color,index)=><i key={index} className={`socket-mini socket-${color.toLowerCase()}`}>{color}{index<links-1&&<u/>}</i>)}<small>{sockets.length} 洞 · {links} 連 · {sockets.map(color=>COLOR_LABEL[color]).join('／')}</small></>}</span>}
