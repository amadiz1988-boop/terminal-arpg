/** Configuration contract only. rAthena remains execution authority. */
export const CONFIG_VERSION = 1;
export const clone = (value) => JSON.parse(JSON.stringify(value));
export const SUPPLY_RULE_ACTIONS = Object.freeze(['default', 'ignore', 'discard', 'sell', 'store', 'keep']);
export const PICKUP_FLAGS = Object.freeze({ DROP: -1, SKIP: 0, PICKUP: 1, PRIORITY: 2 });
export const COMBAT_PROFILES = Object.freeze(['MELEE_DAMAGE', 'RANGED_DAMAGE', 'SKILL_CAST', 'HYBRID_DAMAGE', 'HEAL_SUPPORT', 'COMBAT_SUPPORT', 'FOLLOW_SUPPORT', 'PASSIVE_FOLLOW']);
export const FIXED_POLICY = Object.freeze({
  loot: Object.freeze({ autoLoot: true, autoStore: false }),
  butterflyWing: Object.freeze({ itemId: 602, presenceBased: true, nonConsumable: true, weight: 0, required: true }),
  flyWing: Object.freeze({ itemId: 601, presenceBased: true, nonConsumable: true, weight: 0 }),
});
export const PROFILE_DEFINITIONS = Object.freeze(Object.fromEntries([
  ['MELEE_DAMAGE','近戰普攻',2,true], ['RANGED_DAMAGE','遠程普攻',2,true],
  ['SKILL_CAST','純技能攻擊',2,false], ['HYBRID_DAMAGE','普攻加技能',2,true],
  ['HEAL_SUPPORT','治療支援',-1,false], ['COMBAT_SUPPORT','戰鬥支援',-1,false],
  ['FOLLOW_SUPPORT','跟隨支援',-1,false], ['PASSIVE_FOLLOW','被動跟隨',-1,false],
].map(([key,label,attackMode,useWeapon]) => [key,{label,attackMode,useWeapon}])));
export const getConfigPath = (value, path) => path.split('.').reduce((node,key) => node?.[key],value);
export function setConfigPath(value, path, next) {
  const keys = path.split('.'); const last = keys.pop(); let cursor = value;
  for (const key of keys) cursor = cursor[key] ??= {};
  cursor[last] = next;
}
const field = (path,label,type,value,options={}) => ({path,label,type,default:value,...options});
const num = (path,label,value=0,options={}) => field(path,label,'number',value,{min:0,max:30000,...options});
const txt = (path,label,value='',options={}) => field(path,label,'text',value,options);
const flag = (path,label,value=false,options={}) => field(path,label,'checkbox',value,options);
const select = (path,label,value,options,labels) => field(path,label,'select',value,{options,labels});
const conditions = [txt('conditions.hp','HP 條件'),txt('conditions.sp','SP 條件'),
  txt('conditions.whenStatusActive','持有狀態'),txt('conditions.whenStatusInactive','缺少狀態'),
  num('conditions.timeout','施放間隔（秒）',0,{step:0.1,max:3600000}),
  txt('conditions.onAction','目前動作'), txt('conditions.notOnAction','排除動作'),
  txt('conditions.inInventory','背包條件'),txt('conditions.aggressives','敵人數條件'),
  flag('conditions.inLockOnly','限掛機地圖'),flag('conditions.notInTown','限城鎮外')];
const skillBase = [txt('skill','技能名稱／代碼','',{required:true}),num('level','等級',1,{matureKey:'lvl',max:100}),
  flag('disabled','停用此列'),num('maxCastTime','最長施法時間（秒）',0,{max:3600000,step:0.1}),
  num('minCastTime','最短施法時間（秒）',0,{max:3600000,step:0.1})];
const distanceFields = [txt('dist','距離條件','1'),txt('maxDist','最大距離條件','1')];
const quantityFields = [txt('item','道具名稱／ID','501',{required:true}),flag('disabled','停用此列'),
  num('minAmount','低於數量',2,{nullable:true}),num('maxAmount','補到數量',100),num('batchSize','每批數量',100,{nullable:true})];
export const CONFIG_ROW_SCHEMAS = Object.freeze({
  buy: [...quantityFields,txt('npc','商人位置'),txt('npc_steps','商店對話','b'),num('distance','互動距離',3),
    txt('standpoint','站位'),num('price','單價',0,{nullable:true,max:2000000000}),txt('zeny','Zeny 條件'),flag('isMarket','市場商店'),flag('onlyIdentified','只買已鑑定'),...conditions],
  withdraw: [...quantityFields,flag('passive','只在存倉時提領'),...conditions],
  itemRule: [txt('item','道具名稱／ID','501',{required:true}),num('keepAmount','最少保留量'),
    select('pickup','拾取',1,[-1,0,1,2],['丟棄','略過','拾取','優先拾取']),
    flag('storage','存倉'),flag('sell','販售'),flag('cartAdd','入車'),flag('cartGet','出車')],
  attackSkill: [...skillBase,...distanceFields,num('maxAttempts','最大嘗試'),num('maxUses','每目標上限'),
    txt('monsters','限定怪物'),txt('notMonsters','排除怪物'),txt('previousDamage','前次傷害條件'),
    flag('isSelfSkill','對自身施放'),flag('isStartSkill','起手技能'),txt('target_hp','目標 HP'),
    txt('target_whenStatusInactive','目標缺少狀態'),num('target_timeout','同目標間隔（秒）',0,{step:0.1,max:3600000}),...conditions],
  selfSkill: [...skillBase,flag('smartEncore','Smart Encore'),flag('noSmartHeal','停用 Smart Heal'),...conditions],
  partySkill: [...skillBase,...distanceFields,txt('target','隊友名稱'),txt('target_hp','隊友 HP'),
    txt('target_whenStatusInactive','隊友缺少狀態'),flag('notPartyOnly','不限隊伍'),flag('isSelfSkill','對自身施放'),flag('noSmartHeal','停用 Smart Heal'),...conditions],
  itemUse: [txt('item','補品名稱／ID','501',{required:true}),flag('disabled','停用此列'),...conditions],
  target: [txt('monster','怪物名稱／ID','',{required:true}),select('attack','攻擊策略',1,[-1,0,1,2,3],['忽略','反擊','主動','強制主動','挑釁一次']),
    num('teleport','傳送策略',0,{min:-100,max:3600}),flag('search','只在搜尋時攻擊'),flag('skillcancel','中斷施法'),
    num('lv','角色等級下限'),num('joblv','職業等級下限'),num('hp','HP 絕對值下限',0,{max:2000000000}),num('sp','SP 絕對值下限',0,{max:2000000000}),num('weight','敵人數權重',1,{step:0.1})],
});
const serviceFields = (name,label,key) => [flag(`supply.services.${name}.enabled`,label,true,{group:'服務',matureKey:key}),
  txt(`supply.services.${name}.npc`,`${label} NPC`, '',{group:'NPC 進階',advanced:true,matureKey:`${key}_npc`}),
  txt(`supply.services.${name}.npc_steps`,`${label} 對話`,name==='sell'?'s':'',{group:'NPC 進階',advanced:true,matureKey:`${key}_npc_steps`}),
  num(`supply.services.${name}.distance`,`${label} 距離`,3,{group:'NPC 進階',advanced:true,matureKey:`${key}_distance`})];
export const GHOST_ISLAND_SUPPLY_CONFIG_SCHEMA = Object.freeze({
  title:'補給設定', fields:[
    flag('supply.enabled','啟用自動補給',false,{group:'基本'}),
    num('supply.weightTriggerPercent','負重觸發',75,{min:40,max:88,group:'基本',matureKey:'itemsMaxWeight_sellOrStore'}),
    num('supply.inventorySlotTrigger','背包格數觸發',99,{max:1000,group:'基本',matureKey:'itemsMaxNum_sellOrStore'}),
    ...serviceFields('storage','存倉','storageAuto'),...serviceFields('sell','販售','sellAuto'),
    flag('supply.services.buy.enabled','採購',true,{group:'服務'}),flag('supply.services.withdraw.enabled','提領',false,{group:'服務'}),
    num('supply.services.storage.minZeny','存倉最低 Zeny',50,{max:2000000000,group:'NPC 進階',advanced:true,matureKey:'minStorageZeny'}),
    flag('supply.services.storage.keepOpen','保持倉庫開啟',false,{group:'NPC 進階',advanced:true,matureKey:'storageAuto_keepOpen'}),
    flag('supply.tools.butterflyWing.required','蝴蝶翅膀需存在',true,{group:'固定政策',fixed:true}),
    flag('supply.loot.autoLoot','自動拾取',true,{group:'固定政策',fixed:true}),flag('supply.loot.autoStore','自動存放拾取物',false,{group:'固定政策',fixed:true}),
  ], arrays:[
    {path:'supply.services.buy.rules',title:'採購道具',kind:'buy',matureKey:'buyAuto'},
    {path:'supply.services.withdraw.rules',title:'提領道具',kind:'withdraw',matureKey:'getAuto',advanced:true},
    {path:'supply.itemRules',title:'道具保護與拾取規則',kind:'itemRule'},
  ],
});
export const GHOST_ISLAND_COMBAT_CONFIG_SCHEMA = Object.freeze({
  title:'戰鬥設定',fields:[
    {...select('combat.profile','戰鬥模式','MELEE_DAMAGE',COMBAT_PROFILES),group:'模式'},
    {...select('combat.attack.mode','攻擊策略',2,[-1,0,1,2],['完全停攻','只反擊','協助攻擊','主動攻擊']),group:'攻擊',matureKey:'attackAuto'},
    flag('combat.attack.useWeapon','使用武器普攻',true,{group:'攻擊',matureKey:'attackUseWeapon'}),
    num('combat.attack.distance','攻擊距離',1,{max:30,step:0.1,group:'攻擊',matureKey:'attackDistance'}),
    num('combat.attack.maxDistance','最大攻擊距離',1,{max:30,step:0.1,group:'攻擊',matureKey:'attackMaxDistance'}),
    flag('combat.attack.routeToLock','返回鎖定地圖',true,{group:'目標進階',advanced:true,matureKey:'attackAuto_routeToLock'}),
    flag('combat.attack.checkLOS','檢查視線',true,{group:'目標進階',advanced:true,matureKey:'attackCheckLOS'}),
    flag('combat.attack.canSnipe','允許狙擊',false,{group:'目標進階',advanced:true,matureKey:'attackCanSnipe'}),
    flag('combat.attack.changeTarget','允許改換目標',true,{group:'目標進階',advanced:true,matureKey:'attackChangeTarget'}),
    num('combat.attack.maxRouteDistance','最大追擊距離',100,{group:'目標進階',advanced:true,matureKey:'attackMaxRouteDistance'}),
    num('combat.attack.maxRouteTime','最大追擊時間（秒）',4,{step:0.1,group:'目標進階',advanced:true,matureKey:'attackMaxRouteTime'}),
    flag('combat.follow.enabled','跟隨隊友',false,{group:'跟隨',matureKey:'follow'}),txt('combat.follow.target','跟隨對象','',{group:'跟隨',matureKey:'followTarget'}),
    num('combat.follow.distanceMin','最小跟隨距離',3,{max:30,group:'跟隨',matureKey:'followDistanceMin'}),num('combat.follow.distanceMax','最大跟隨距離',6,{max:30,group:'跟隨',matureKey:'followDistanceMax'}),
    flag('combat.travel.flyWing.enabled','允許蒼蠅翅膀',true,{group:'生存'}),
    txt('combat.travel.teleport.hp','低 HP 傳送條件','10%',{group:'生存',matureKey:'teleportAuto_hp'}),
    txt('combat.travel.teleport.sp','低 SP 傳送條件','',{group:'生存',matureKey:'teleportAuto_sp'}),
    flag('combat.travel.teleport.lostTarget','失去目標時傳送',false,{group:'生存',matureKey:'teleportAuto_lostTarget'}),
    flag('combat.travel.teleport.dropTarget','放棄目標時傳送',false,{group:'生存',matureKey:'teleportAuto_dropTarget'}),
  ],arrays:[
    {path:'combat.skills.attackSlots',title:'攻擊技能',kind:'attackSkill',matureKey:'attackSkillSlot'},
    {path:'combat.skills.selfSkills',title:'自身恢復與 Buff',kind:'selfSkill',matureKey:'useSelf_skill'},
    {path:'combat.skills.partySkills',title:'隊伍治療與 Buff',kind:'partySkill',matureKey:'partySkill',advanced:true},
    {path:'combat.itemUse',title:'補品使用條件',kind:'itemUse',matureKey:'useSelf_item',advanced:true},
    {path:'combat.targets',title:'怪物目標策略',kind:'target',advanced:true},
  ],
});
export const CONFIG_FORM_SCHEMA = Object.freeze({supply:GHOST_ISLAND_SUPPLY_CONFIG_SCHEMA,combat:GHOST_ISLAND_COMBAT_CONFIG_SCHEMA});
const allFields = Object.values(CONFIG_FORM_SCHEMA).flatMap(section=>section.fields);
const allArrays = Object.values(CONFIG_FORM_SCHEMA).flatMap(section=>section.arrays);
export function defaultConfigRow(kind) {
  const row = {}; for (const descriptor of CONFIG_ROW_SCHEMAS[kind]) setConfigPath(row,descriptor.path,clone(descriptor.default)); return row;
}
export function defaultCanonicalConfig(revision=0) {
  const config = {version:CONFIG_VERSION,revision};
  for (const descriptor of allFields) setConfigPath(config,descriptor.path,clone(descriptor.default));
  for (const descriptor of allArrays) setConfigPath(config,descriptor.path,[]);
  config.supply.services.buy.rules.push({...defaultConfigRow('buy'),minAmount:20,maxAmount:100});
  config.supply.tools.butterflyWing = clone(FIXED_POLICY.butterflyWing);
  config.combat.travel.flyWing = {...clone(FIXED_POLICY.flyWing),enabled:true};
  config.combat.loot = clone(FIXED_POLICY.loot);
  return config;
}
const isRecord = value => value !== null && typeof value==='object' && !Array.isArray(value);
function validateField(errors,descriptor,value,path) {
  const fail = message => errors.push({path,message});
  if (descriptor.nullable && value===null) return;
  if (descriptor.type==='checkbox' && typeof value!=='boolean') fail(`${descriptor.label}必須是布林值`);
  if (descriptor.type==='number' && (!Number.isFinite(value) || value<descriptor.min || value>descriptor.max || (!descriptor.step && !Number.isInteger(value)))) fail(`${descriptor.label}數值超出範圍`);
  if (descriptor.type==='select' && !descriptor.options.includes(value)) fail(`${descriptor.label}選項無效`);
  if (descriptor.type==='text' && (typeof value!=='string' || value.length>240 || /[\r\n{}\x00-\x1f]/.test(value) || descriptor.required && !value.trim())) fail(`${descriptor.label}格式無效`);
  if (descriptor.fixed && value!==descriptor.default) fail(`${descriptor.label}是固定政策`);
}
export function validateCanonicalConfig(config) {
  const errors=[]; const fail=(path,message)=>errors.push({path,message});
  if (!isRecord(config)) return [{path:'$',message:'設定必須是物件'}];
  if (config.version!==CONFIG_VERSION) fail('version','不支援的設定版本');
  if (!Number.isSafeInteger(config.revision) || config.revision<0) fail('revision','設定版本必須是非負整數');
  for(const descriptor of allFields) validateField(errors,descriptor,getConfigPath(config,descriptor.path),descriptor.path);
  for(const descriptor of allArrays) {
    const rows=getConfigPath(config,descriptor.path);
    if (!Array.isArray(rows) || rows.length>300) { fail(descriptor.path,'設定列必須是最多 300 筆的陣列'); continue; }
    const identities=new Set();
    rows.forEach((row,index)=>{
      const path=`${descriptor.path}[${index}]`;
      if (!isRecord(row)) { fail(path,'設定列必須是物件'); return; }
      for(const field of CONFIG_ROW_SCHEMAS[descriptor.kind]) validateField(errors,field,getConfigPath(row,field.path),`${path}.${field.path}`);
      if(['buy','withdraw'].includes(descriptor.kind) && row.minAmount!==null && row.maxAmount<row.minAmount) fail(path,'補到數量不可低於觸發數量');
      if(descriptor.kind==='itemRule') {
        if(identities.has(row.item)) fail(path,'道具規則重複'); identities.add(row.item);
        if(['601','602'].includes(row.item) && (row.pickup<1 || row.storage || row.sell || row.cartAdd)) fail(path,'永久傳送道具必須保留在背包');
      }
    });
  }
  for(const [path,fixed] of [['supply.tools.butterflyWing',FIXED_POLICY.butterflyWing],['combat.travel.flyWing',FIXED_POLICY.flyWing],['combat.loot',FIXED_POLICY.loot]]) {
    for(const [key,value] of Object.entries(fixed)) if(getConfigPath(config,`${path}.${key}`)!==value) fail(`${path}.${key}`,'固定政策不可變更');
  }
  return errors;
}
export function assertCanonicalConfig(config) {
  const details=validateCanonicalConfig(config); if(details.length) { const error=new Error('設定驗證失敗'); error.code='CONFIG_VALIDATION_FAILED'; error.details=details; throw error; } return config;
}
function parseConfig(configText) {
  const scalars={}; const blocks=[]; let current=null;
  for(const raw of String(configText??'').split(/\r?\n/)) {
    const line=raw.replace(/\s*#.*$/,'').trim(); if(!line) continue;
    if(current) {
      if(line==='}') { blocks.push(current); current=null; continue; }
      const pair=line.match(/^(\S+)(?:\s+(.*))?$/); if(pair) current.values[pair[1]]=pair[2]??'';
    } else {
      const block=line.match(/^(\w+)(?:\s+(.+?))?\s*\{$/);
      if(block) current={kind:block[1],name:(block[2]??'').trim(),values:{}};
      else { const pair=line.match(/^(\S+)(?:\s+(.*))?$/); if(pair) scalars[pair[1]]=pair[2]??''; }
    }
  }
  if(current) throw new Error('legacy_config_unclosed_block');
  return {scalars,blocks};
}
const decode = (descriptor,value) => descriptor.type==='checkbox' ? Number(value)!==0 : descriptor.type==='number' ? value==='' && descriptor.nullable ? null : Number(value) : descriptor.type==='select' && typeof descriptor.default==='number' ? Number(value) : String(value);
const gameplayKey = key => /^(?:attack|useSelf_|partySkill|buyAuto|sellAuto|storageAuto|getAuto|items(?:Take|Gather|Max)|teleportAuto|follow|minStorageZeny|relogAfterStorage)/.test(key) && !/password|encrypt|token|secret/i.test(key);
export function migrateLegacyConfig({supplyCycle={},configText='',skillAutomation={},itemsControlText='',pickupText='',monControlText='',source='legacy'}={}) {
  const config=defaultCanonicalConfig(0); const mappings=[]; const unmapped=[];
  const parsed=parseConfig(configText); const retained={supplyCycle:clone(supplyCycle),scalars:{},blocks:[],itemsControl:[],pickup:[],monControl:[]};
  const add=(legacy,canonical,disposition='MIGRATE',reason='沿用成熟欄位語意')=>mappings.push({legacy,canonical,disposition,reason});
  const knownKeys=new Set();
  for(const descriptor of allFields) {
    const key=descriptor.matureKey;
    if(!key || parsed.scalars[key]===undefined) continue;
    knownKeys.add(key); setConfigPath(config,descriptor.path,decode(descriptor,parsed.scalars[key])); add(`config.txt ${key}`,descriptor.path);
  }
  for(const [key,value] of Object.entries(parsed.scalars)) if(gameplayKey(key)) {
    retained.scalars[key]=value;
    if(!knownKeys.has(key) && !/^(attackSkillSlot|useSelf_skill|partySkill|buyAuto|getAuto|useSelf_item)_\d+(?:_|$)/.test(key)) unmapped.push(`config.txt ${key} 已保留，尚未提供欄位映射`);
  }
  for(const [legacy,path] of Object.entries({enabled:'supply.enabled',returnWeight:'supply.weightTriggerPercent',store:'supply.services.storage.enabled',sell:'supply.services.sell.enabled',buy:'supply.services.buy.enabled'})) {
    if(supplyCycle[legacy]!==undefined) { setConfigPath(config,path,supplyCycle[legacy]); add(`supply-cycle.json.${legacy}`,path); }
  }
  const arrayByMature=new Map(allArrays.filter(x=>x.matureKey).map(x=>[x.matureKey,x]));
  const blocks=[...parsed.blocks]; const flattened=new Map();
  for(const [key,value] of Object.entries(parsed.scalars)) {
    const match=key.match(/^(attackSkillSlot|useSelf_skill|partySkill|buyAuto|getAuto|useSelf_item)_(\d+)(?:_(.+))?$/); if(!match) continue;
    const id=`${match[1]}:${match[2]}`; const block=flattened.get(id)??{kind:match[1],name:'',values:{}};
    if(match[3]) block.values[match[3]]=value; else block.name=value;
    flattened.set(id,block);
  }
  blocks.push(...flattened.values());
  const seenArrays=new Set();
  for(const block of blocks) {
    if(!arrayByMature.has(block.kind)) { if(gameplayKey(block.kind)) { retained.blocks.push(block); unmapped.push(`${block.kind} 區塊已保留待映射`); } continue; }
    if(!block.name) continue; // Empty upstream template, no player policy.
    retained.blocks.push(block);
    const descriptor=arrayByMature.get(block.kind); const row=defaultConfigRow(descriptor.kind); const consumed=new Set();
    row[descriptor.kind.endsWith('Skill')?'skill':'item']=block.name;
    for(const field of CONFIG_ROW_SCHEMAS[descriptor.kind]) {
      const key=field.matureKey??field.path.replace(/^conditions\./,'');
      if(block.values[key]!==undefined) { setConfigPath(row,field.path,decode(field,block.values[key])); consumed.add(key); }
    }
    for(const key of Object.keys(block.values)) if(!consumed.has(key) && block.values[key]!=='') unmapped.push(`${block.kind} ${block.name}.${key} 已保留待映射`);
    if(!seenArrays.has(descriptor.path)) { setConfigPath(config,descriptor.path,[]); seenArrays.add(descriptor.path); }
    getConfigPath(config,descriptor.path).push(row); add(`${block.kind} ${block.name}`,descriptor.path,'ADAPT');
  }
  if(supplyCycle.redPotionMin!==undefined || supplyCycle.redPotionMax!==undefined) {
    const rules=config.supply.services.buy.rules; let row=rules.find(row=>row.item==='501');
    if(!row) { row=defaultConfigRow('buy'); rules.push(row); }
    if(supplyCycle.redPotionMin!==undefined) row.minAmount=Number(supplyCycle.redPotionMin);
    if(supplyCycle.redPotionMax!==undefined) row.maxAmount=Number(supplyCycle.redPotionMax);
    add('supply-cycle.json.redPotionMin/redPotionMax','supply.services.buy.rules[item=501].minAmount/maxAmount','ADAPT');
  }
  const policyRows=new Map();
  const parseControls=(input,kind)=>String(input??'').split(/\r?\n/).map(line=>line.replace(/\s*#.*$/,'').trim()).filter(Boolean).map(line=>{
    retained[kind].push(line); return line;
  });
  for(const line of parseControls(itemsControlText,'itemsControl')) {
    const match=line.match(/^(.+?)\s+(\d+)\s+([01])\s+([01])(?:\s+([01]))?(?:\s+([01]))?$/);
    if(!match) { unmapped.push(`items_control 無法映射：${line}`); continue; }
    const row={...defaultConfigRow('itemRule'),item:match[1],keepAmount:Number(match[2]),storage:match[3]==='1',sell:match[4]==='1',cartAdd:match[5]==='1',cartGet:match[6]==='1'};
    policyRows.set(row.item,row); add(`items_control ${row.item}`,'supply.itemRules[]','ADAPT');
  }
  for(const line of parseControls(pickupText,'pickup')) {
    const match=line.match(/^(.+?)\s+(-1|0|1|2)$/); if(!match) { unmapped.push(`pickupitems 無法映射：${line}`); continue; }
    const row=policyRows.get(match[1])??{...defaultConfigRow('itemRule'),item:match[1]}; row.pickup=Number(match[2]); policyRows.set(row.item,row); add(`pickupitems ${row.item}`,'supply.itemRules[].pickup','ADAPT');
  }
  for(const rule of Array.isArray(supplyCycle.rules)?supplyCycle.rules:[]) {
    if(!SUPPLY_RULE_ACTIONS.includes(rule.action)) { unmapped.push(`未知道具規則 ${rule.itemId} 已保留`); continue; }
    const row={...defaultConfigRow('itemRule'),item:String(rule.itemId)};
    if(rule.action==='ignore') row.pickup=0; if(rule.action==='discard') row.pickup=-1;
    row.storage=rule.action==='store'; row.sell=rule.action==='sell';
    if(rule.action!=='default') policyRows.set(row.item,row);
    add(`supply-cycle.json.rules[${rule.itemId}]=${rule.action}`,'supply.itemRules[]','ADAPT');
  }
  // Global policy suppresses automatic deposit defaults; explicit service rules remain configurable.
  const allRule=policyRows.get('all'); if(allRule?.storage) { allRule.storage=false; add('items_control all autostore','supply.loot.autoStore','ADAPT','GLOBAL_AUTOSTORE=NO'); }
  for(const item of ['601','602']) if(policyRows.has(item)) { Object.assign(policyRows.get(item),{pickup:1,storage:false,sell:false,cartAdd:false,keepAmount:1}); add(`items_control ${item}`,'permanent travel tool policy','ADAPT','永久道具固定保留，原值保留於遷移記錄'); }
  config.supply.itemRules=[...policyRows.values()];
  for(const line of parseControls(monControlText,'monControl')) {
    const match=line.match(/^(.+?)\s+(-?\d+)((?:\s+-?[\d.]+)*)$/); if(!match) {unmapped.push(`mon_control 無法映射：${line}`);continue;}
    const row=defaultConfigRow('target'); row.monster=match[1]; const values=[match[2],...match[3].trim().split(/\s+/).filter(Boolean)];
    ['attack','teleport','search','skillcancel','lv','joblv','hp','sp','weight'].forEach((key,i)=>{if(values[i]!==undefined) row[key]=['search','skillcancel'].includes(key)?Number(values[i])!==0:Number(values[i]);});
    config.combat.targets.push(row);add(`mon_control ${row.monster}`,'combat.targets[]','ADAPT');
  }
  for(const [key,kind,path] of [['attack','attackSkill','attackSlots'],['self','selfSkill','selfSkills'],['buff','selfSkill','selfSkills']]) {
    const slot=skillAutomation[key]; if(!slot) continue;
    const row=defaultConfigRow(kind); row.skill=String(slot.handle??slot.skill??''); row.level=Number(slot.level??slot.lvl??1);
    if(slot.minimumSp!==undefined) row.conditions.sp=`> ${slot.minimumSp}%`;
    if(slot.hpBelow!==undefined) row.conditions.hp=`< ${slot.hpBelow}%`;
    if(slot.status) row.conditions.whenStatusInactive=String(slot.status);
    const rows=config.combat.skills[path]; if(!rows.some(existing=>existing.skill===row.skill)) rows.push(row);
    add(`skillAutomation.${key}`,`combat.skills.${path}`,'REMOVE_DUPLICATE','舊技能入口併入唯一設定契約');
  }
  for(const key of Object.keys(supplyCycle)) if(!['enabled','returnWeight','store','sell','buy','redPotionMin','redPotionMax','rules'].includes(key)) unmapped.push(`supply-cycle.json.${key} 已保留待映射`);
  if(config.combat.attack.mode===-1) config.combat.profile=config.combat.skills.selfSkills.some(row=>/heal/i.test(row.skill))?'HEAL_SUPPORT':config.combat.skills.partySkills.length?'COMBAT_SUPPORT':'PASSIVE_FOLLOW';
  else config.combat.profile=!config.combat.attack.useWeapon?'SKILL_CAST':config.combat.skills.attackSlots.length?'HYBRID_DAMAGE':config.combat.attack.maxDistance>2?'RANGED_DAMAGE':'MELEE_DAMAGE';
  add('GLOBAL_AUTOLOOT/GLOBAL_AUTOSTORE','supply.loot','KEEP','專案固定政策');
  const migration={source,sourceVersion:'legacy-openkore-web-v1',mappings,unmapped:[...new Set(unmapped)],retained,policy:{fixedOverlays:['GLOBAL_AUTOLOOT=YES','GLOBAL_AUTOSTORE=NO','Butterfly presence/non-consumable/weight=0','Fly default=ON']}};
  assertCanonicalConfig(config); return {config,migration};
}
const encode=value=>typeof value==='boolean'?value?1:0:value===null?'':value;
export function canonicalToOpenKorePreview(config) {
  assertCanonicalConfig(config);
  const lines=allFields.filter(field=>field.matureKey).map(field=>`${field.matureKey} ${encode(getConfigPath(config,field.path))}`);
  lines.push('itemsTakeAuto 2');
  for(const service of ['storage','sell']) if(!config.supply.enabled) lines.push(`${service==='storage'?'storageAuto':'sellAuto'} 0`);
  for(const descriptor of allArrays.filter(array=>array.matureKey)) {
    for(const row of getConfigPath(config,descriptor.path)) {
      const identity=row.skill??row.item; lines.push(`${descriptor.matureKey} ${identity} {`);
      for(const field of CONFIG_ROW_SCHEMAS[descriptor.kind]) {
        if(['skill','item'].includes(field.path))continue;
        const key=field.matureKey??field.path.replace(/^conditions\./,'');
        let value=getConfigPath(row,field.path);
        if(key==='disabled' && descriptor.path.startsWith('supply.')) value=value || !config.supply.enabled || !getConfigPath(config,descriptor.path.replace(/\.rules$/,'.enabled'));
        lines.push(`\t${key} ${encode(value)}`);
      }
      lines.push('}');
    }
  }
  const items=config.supply.itemRules.filter(row=>!['601','602','all'].includes(row.item));
  const all=config.supply.itemRules.find(row=>row.item==='all');
  return {configText:lines.join('\n')+'\n',
    pickupitems:[`all ${all?.pickup??1}`,...items.map(row=>`${row.item} ${row.pickup}`),'601 1','602 1'].join('\n')+'\n',
    itemsControl:[`all ${all?.keepAmount??0} 0 ${all?.sell?1:0} 0 0`,...items.map(row=>`${row.item} ${row.keepAmount} ${encode(row.storage)} ${encode(row.sell)} ${encode(row.cartAdd)} ${encode(row.cartGet)}`),'601 1 0 0 0 0','602 1 0 0 0 0'].join('\n')+'\n',
    monControl:config.combat.targets.map(row=>`${row.monster} ${['attack','teleport','search','skillcancel','lv','joblv','hp','sp','weight'].map(key=>encode(row[key])).join(' ')}`).join('\n'),
    policy:{flyWingEnabled:config.combat.travel.flyWing.enabled,butterflyWing:FIXED_POLICY.butterflyWing},
    applied:false,capability:'CONFIG_ONLY_ADAPTER_PREVIEW',
    unsupported:['PA native supply/combat configuration command is unavailable; preview is never dispatched']};
}
export function applyProfileTemplate(config,profile) {
  if(!COMBAT_PROFILES.includes(profile))throw new Error('戰鬥模式無效');
  const next=clone(config); next.combat.profile=profile;
  next.combat.attack.mode=PROFILE_DEFINITIONS[profile].attackMode; next.combat.attack.useWeapon=PROFILE_DEFINITIONS[profile].useWeapon;
  next.combat.follow.enabled=['FOLLOW_SUPPORT','PASSIVE_FOLLOW'].includes(profile);
  return next;
}
