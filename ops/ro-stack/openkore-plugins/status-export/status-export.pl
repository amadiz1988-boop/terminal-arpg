package GhostIsland::StatusExport;

use strict;
use utf8;
use AI;
use Plugins;
use Globals qw($accountID $char $field $messageSender $monstersList $net $npcsList $playersList $questList %ai_v %clan %config %itemHandType_lut %talk);
use Commands;
use Misc;
use Network;
use Settings;
use Skill;
use I18N qw(bytesToString);
use File::Spec;
use Time::HiRes qw(time);
use Utils qw(calcPosition);

my $name = 'ghost-island-status-export';
my $last_write = 0;
my $job_route_key = '';
my $dialog_cancel_until = 0;
my $last_dialog_cancel = 0;
my $dialog_cancel_started_at = 0;
my $job_resume_pending = 0;
my $job_resume_after = 0;
my $last_job_route_retry = 0;
my $last_job_resume_retry = 0;
my $job_resume_started_at = 0;
my $job_resume_dialog_started_at = 0;
my $job_resume_recovery_attempts = 0;
my $last_job_respawn = 0;
my $onboarding_active = 0;
my $onboarding_completed = 0;
my $onboarding_phase = '';
my $onboarding_started_at = 0;
my $onboarding_last_action = 0;
my $onboarding_ai_mode = '';
my $onboarding_dialog_owned = 0;
my $onboarding_dialog_choice = 1;
my $onboarding_dialog_started_at = 0;
my $onboarding_dialog_phase = '';
my $onboarding_dialog_seen = 0;
my $onboarding_original_auto_talk;
my %onboarding_dialog_completed;
my $eden_active = 0;
my $eden_completed = 0;
my $eden_task_id = 'member';
my $eden_error = '';
my $eden_phase = '';
my $eden_started_at = 0;
my $eden_last_action = 0;
my $eden_phase_started_at = 0;
my $eden_dialog_owned = 0;
my $eden_dialog_seen = 0;
my $eden_dialog_started_at = 0;
my $eden_dialog_phase = '';
my $eden_select_step = 0;
my $eden_text_step = 0;
my $eden_original_auto_talk;
my $eden_original_items_take_auto;
my $eden_training_stage_hint = 0;
my $eden_last_quest_id = 0;
my $eden_target_missing_since = 0;
my $eden_route_stuck_count = 0;
my $eden_npc_failures = 0;
my $eden_return_started_at = 0;
my $eden_exit_recovery_attempted = 0;
my $eden_return_kafra_dialog_owned = 0;
my $eden_return_kafra_dialog_seen = 0;
my $eden_return_kafra_dialog_started_at = 0;
my $eden_return_kafra_select_step = 0;
my $eden_return_kafra_choice = 0;
my $eden_return_kafra_attempts = 0;
my $eden_supply_active = 0;
my $eden_supply_started_at = 0;
my $eden_supply_original_attack;
my $eden_supply_original_take;
my @task_events;
my $last_task_event_key = '';
my $last_task_map = '';
my $last_task_x;
my $last_task_y;
my $last_position_changed_at = time;
my $onboarding_stuck_pending = 0;
my $last_stuck_recovery = 0;
my $archer_repair_attempts = 0;
my $last_archer_repair = 0;
my $expanded_repair_attempts = 0;
my $last_expanded_repair = 0;
my $supply_guard_checked = 0;
my $supply_retry_after = 0;
my $supply_storage_started_weight;
my %supply_buy_original_limits;
my %onboarding_phase_info = (
  starting => ['準備新生訓練', '正在確認角色與 Renewal 任務狀態。', ''],
  respawning => ['返回重生點', '角色已倒下，等待伺服器完成重生。', ''],
  ship_wounded => ['尋找受傷的劍士', '前往船艙內與受傷的劍士交談。', '受傷的劍士'],
  ship_exit => ['離開沉船船艙', '正在前往船艙出口。', '船艙出口'],
  island_captain => ['向船長報到', '正在前往漂流島船長的位置。', '船長 Carocc'],
  island_lumin => ['初次相遇', '正在尋找 Lumin 並聽取新生引導。', 'Lumin'],
  island_lumber => ['第一次戰鬥', '戰鬥中，正在取得任務所需木材。', '訓練怪物'],
  island_sailor => ['回報第一次戰鬥', '材料已備妥，正在返回水手身邊。', '水手'],
  sail_izlude => ['前往伊斯魯得島', '正在前往碼頭搭船。', '碼頭'],
  izlude_captain => ['抵達伊斯魯得島', '正在向學院引導員報到。', '學院引導員'],
  izlude_hun_intro => ['尋找 Hun', '正在前往 Hun 的位置。', 'Hun'],
  izlude_hun_drink => ['飲用清涼飲料', '正在使用任務提供的飲料。', 'Hun'],
  izlude_hun_finish => ['回報清涼飲料', '正在與 Hun 完成入學前教學。', 'Hun'],
  academy_route => ['前往新生學院', '正在前往克里圖拉學院櫃檯。', '新生學院櫃檯'],
  academy_registration => ['新生學院報到', '正在辦理克里圖拉學院新生登記。', '學院櫃檯'],
  academy_pet_intro => ['學院基礎介紹', '正在與學院講師完成基礎介紹。', '學院講師'],
  academy_training_route => ['前往訓練場', '正在前往新生學院訓練場。', '新生訓練場'],
  academy_training_heal => ['訓練中補給', '生命低於安全門檻，正在使用新手藥水。', ''],
  academy_basic_skill => ['提升基本技能', '正在使用技能點完成初心者基本技能。', ''],
  academy_training => ['新生戰鬥訓練', '戰鬥中，目標為初心者 Job Lv.10。', '訓練怪物'],
  academy_return => ['返回新生學院', '訓練條件已完成，正在返回學院。', '結業引導員'],
  academy_graduation => ['辦理一轉結業', '正在向結業引導員確認一轉資格。', '結業引導員'],
  academy_exit => ['離開新手村', '一轉已完成，正在前往普隆德拉原野 08。', '結業引導員'],
  returning_hunt => ['前往第一張掛機地圖', '正在前往普隆德拉原野 08，抵達後會自動開始掛機。', '普隆德拉原野 08'],
  awaiting_map => ['新生訓練完成', '已抵達普隆德拉原野 08並開始掛機。後續可依角色等級選擇推薦地圖。', '普隆德拉原野 08']
);
my %eden_phase_info = (
  route_officer => ['前往伊甸園傳送員', '正由普隆德拉南門前往伊甸園傳送員。', '伊甸園傳送員'],
  enter_headquarters => ['進入伊甸園總部', '正在使用遊戲內建伊甸園傳送服務。', '伊甸園傳送員'],
  route_secretary => ['尋找伊甸園秘書', '已抵達伊甸園總部，正在前往秘書 Lime Evenor。', '秘書 Lime Evenor'],
  register_member => ['辦理伊甸園入團', '正在依官方流程填寫成員資料。', '秘書 Lime Evenor'],
  equipment_accept => ['接取 Lv.12 裝備訓練', '正在與 Instructor Boya 對話並接取原生任務 7128。', 'Instructor Boya'],
  equipment_route_field => ['前往沙漠訓練地圖', '正在前往夢羅克南東方綠洲。', 'moc_fild11'],
  equipment_dog => ['與 Talking Dog 對話', '正在同步下一個原生沙漠訓練任務。', 'Talking Dog'],
  equipment_hunt_condor => ['擊殺 Condor', '正在完成原生任務 7129。', 'Condor 10 隻'],
  equipment_hunt_wolf => ['擊殺 Baby Desert Wolf', '正在完成原生任務 7130。', 'Baby Desert Wolf 10 隻'],
  equipment_hunt_scorpion => ['擊殺 Scorpion', '正在完成原生任務 7131。', 'Scorpion 5 隻'],
  equipment26_accept => ['接取 Lv.26 裝備訓練', '正在與 Instructor Boya 對話並接取原生任務 7138。', 'Instructor Boya'],
  equipment26_route_field => ['前往幽靈洞穴', '正在前往 Payon Cave 一樓。', 'pay_dun00'],
  equipment26_karl => ['與 Eden Member Karl 對話', '正在同步幽靈洞穴的原生任務階段。', 'Eden Member Karl'],
  equipment26_hunt_skeleton => ['擊殺 Skeleton', '正在完成原生任務 7139。', 'Skeleton 15 隻'],
  equipment26_hunt_poporing => ['擊殺 Poporing', '正在完成原生任務 7140。', 'Poporing 10 隻'],
  equipment26_report_boya => ['返回 Instructor Boya', '幽靈洞穴訓練完成，正在回報原生任務 7141。', 'Instructor Boya'],
  equipment26_reward => ['領取第二套裝備', '正在向 Administrator Michael 領取原生 Lv.26 裝備。', 'Administrator Michael'],
  equipment_sync_target => ['同步任務目標', '正在等候 OpenKore 收到原生 mob_goal 與 mob_count。', '任務怪物'],
  equipment_report_boya => ['返回 Instructor Boya', '沙漠訓練完成，正在回報原生任務 7132。', 'Instructor Boya'],
  equipment_reward => ['領取第一套裝備', '正在向 Administrator Michael 領取四件原生伊甸園裝備。', 'Administrator Michael'],
  equipment_supply => ['任務途中補給', '恢復品不足，正在回城販售戰利品並補齊消耗品。', '普隆德拉道具商'],
  equipment_returning_hunt => ['返回掛機地圖', '裝備已取得，正在前往目前等級的推薦掛機地圖。', '等級推薦地圖'],
  equipment_complete => ['Lv.12 裝備訓練完成', '四件原生伊甸園裝備已存入角色道具欄。', '第一套伊甸園裝備'],
  returning_hunt => ['返回掛機地圖', '伊甸園入團完成，正在前往目前等級的推薦掛機地圖。', '等級推薦地圖'],
  complete => ['伊甸園入團完成', '已取得伊甸園徽章並恢復等級推薦掛機。', '等級推薦地圖']
);
my %job_routes = (
  swordman => ['iz_ac01', 60, 67],
  mage => ['iz_ac01', 60, 67],
  archer => ['iz_ac01', 60, 67],
  acolyte => ['iz_ac01', 60, 67],
  merchant => ['iz_ac01', 60, 67],
  thief => ['iz_ac01', 60, 67],
  supernovice => ['iz_ac01', 60, 67],
  taekwon => ['iz_ac01', 60, 67],
  gunslinger => ['iz_ac01', 60, 67],
  ninja => ['iz_ac01', 60, 67],
);

sub job_route_target {
  my ($job) = @_;
  return $job_routes{$job};
}

sub job_route_distance {
  return 3;
}

sub job_resume_target {
  my $level = $char ? number_or_zero($char->{lv}) : 1;
  return ['pay_dun00', 73, 78] if $level >= 26;
  return ['moc_fild11', 180, 253] if $level >= 12;
  return ['prt_fild08', 170, 374];
}
Plugins::register($name, 'Exports the authoritative OpenKore status packet snapshot.', \&unload, \&unload);
my $hooks = Plugins::addHooks(
  ['mainLoop_pre', \&export_status],
  ['AI_storage_auto_limit_reached', \&prefer_sell_before_storage],
  ['ai_canStartStorageSellBuy', \&guard_auto_supply_start],
  ['AI_storage_auto_queued', \&record_supply_storage_start],
  ['AI_storage_auto_completed', \&finish_supply_storage_cycle],
  ['AI_buy_auto_queued', \&reserve_storage_zeny],
  ['AI_buy_auto_completed', \&restore_supply_buy_limits],
  ['packet_pubMsg', \&record_public_chat],
  ['packet_selfChat', \&record_self_chat],
  ['packet_privMsg', \&record_private_chat],
  ['packet_sentPM', \&record_sent_private_chat],
  ['packet_partyMsg', \&record_party_chat],
  ['packet_guildMsg', \&record_guild_chat],
  ['packet_clanMsg', \&record_clan_chat],
  ['packet_pre/battleground_message', \&record_battleground_chat],
  ['packet_sysMsg', \&record_system_chat],
  ['npc_chat', \&record_channel_chat],
  ['packet_emotion', \&record_emotion],
  ['packet_skillfail', \&record_social_failure],
  ['npc_talk', \&record_task_npc_talk],
  ['quest_mission_updated', \&record_task_mission],
  ['route', \&record_route_status]
);

sub prefer_sell_before_storage {
  my (undef, $args) = @_;
  return if !$config{sellAuto} || !$config{sellAuto_npc};
  # OpenKore checks storage before selling when both share the weight trigger.
  # Defer that first storage attempt so the normal sell -> buy -> storage chain
  # can liquidate loot before evaluating the character's buying power.
  $args->{return} = 1;
}

sub eden_equipment_task_active {
  return $eden_active
    && ($eden_task_id eq 'equipment12' || $eden_task_id eq 'equipment26');
}

sub guard_auto_supply_start {
  my (undef, $args) = @_;
  if (eden_equipment_task_active() && !$eden_supply_active) {
    $args->{return} = 1;
    return;
  }
  $args->{return} = 1 if time < $supply_retry_after;
}

sub record_supply_storage_start {
  $supply_storage_started_weight = Misc::percent_weight($char)
    if $char && !defined($supply_storage_started_weight);
}

sub finish_supply_storage_cycle {
  return if !$char || !defined($supply_storage_started_weight);
  my $current_weight = Misc::percent_weight($char);
  my $return_weight = number_or_zero($config{itemsMaxWeight_sellOrStore});
  if ($return_weight > 0
    && $current_weight >= $return_weight
    && $current_weight >= $supply_storage_started_weight) {
    $supply_retry_after = time + 300;
    append_task_event(
      'recovery',
      '補給暫停重試',
      '本次補給未降低負重，5分鐘後再嘗試，角色先留在目前流程。',
      '',
      join('|', 'supply_backoff', int($current_weight), int($supply_retry_after))
    );
  } else {
    $supply_retry_after = 0;
  }
  undef $supply_storage_started_weight;
}

sub reserve_storage_zeny {
  return if !$char || !$config{storageAuto};
  my $reserve = number_or_zero($config{minStorageZeny});
  return if $reserve < 1;
  for (my $index = 0; exists $config{"buyAuto_$index"}; $index++) {
    next if $config{"buyAuto_${index}_disabled"};
    my $price = number_or_zero($config{"buyAuto_${index}_price"});
    my $maximum = number_or_zero($config{"buyAuto_${index}_maxAmount"});
    next if $price < 1 || $maximum < 1;
    my $item_id = number_or_zero($config{"buyAuto_$index"});
    next if $item_id < 1;
    my $current = $char->inventory->sumByNameID(
      $item_id,
      $config{"buyAuto_${index}_onlyIdentified"}
    );
    my $available = number_or_zero($char->{zeny}) - $reserve;
    $available = 0 if $available < 0;
    my $safe_maximum = $current + int($available / $price);
    next if $safe_maximum >= $maximum;
    $supply_buy_original_limits{$index} = {
      maxAmount => $config{"buyAuto_${index}_maxAmount"},
      batchSize => $config{"buyAuto_${index}_batchSize"}
    };
    $config{"buyAuto_${index}_maxAmount"} = $safe_maximum;
    $config{"buyAuto_${index}_batchSize"} = $safe_maximum - $current;
  }
}

sub restore_supply_buy_limits {
  for my $index (keys %supply_buy_original_limits) {
    $config{"buyAuto_${index}_maxAmount"} =
      $supply_buy_original_limits{$index}{maxAmount};
    $config{"buyAuto_${index}_batchSize"} =
      $supply_buy_original_limits{$index}{batchSize};
  }
  %supply_buy_original_limits = ();
}

sub unload {
  &restore_supply_buy_limits;
  Plugins::delHooks($hooks);
}

sub number_or_zero {
  my ($value) = @_;
  return defined($value) ? 0 + $value : 0;
}

sub json_string {
  my ($value) = @_;
  $value = '' if !defined($value);
  $value =~ s/\\/\\\\/g;
  $value =~ s/"/\\"/g;
  $value =~ s/\r/\\r/g;
  $value =~ s/\n/\\n/g;
  $value =~ s/\t/\\t/g;
  return '"' . $value . '"';
}

sub append_task_event {
  my ($type, $title, $detail, $target, $key) = @_;
  $type ||= 'info';
  $title ||= '任務更新';
  $detail ||= '';
  $target ||= '';
  $key ||= join('|', $type, $title, $detail, $target);
  return if $key eq $last_task_event_key;
  $last_task_event_key = $key;
  push @task_events, {
    at => int(time * 1000), type => $type, title => $title,
    detail => $detail, target => $target,
    map => $field ? $field->baseName : ''
  };
  shift @task_events while @task_events > 80;
}

sub task_event_json {
  my ($event) = @_;
  return '{"at":' . number_or_zero($event->{at})
    . ',"type":' . json_string($event->{type})
    . ',"title":' . json_string($event->{title})
    . ',"detail":' . json_string($event->{detail})
    . ',"target":' . json_string($event->{target})
    . ',"map":' . json_string($event->{map}) . '}';
}

sub clear_skill_automation_slot {
  my ($prefix) = @_;
  foreach my $suffix ('', '_lvl', '_dist', '_maxDist', '_maxCastTime',
    '_minCastTime', '_isSelfSkill', '_sp', '_hp', '_timeout', '_disabled',
    '_whenStatusInactive', '_notWhileSitting', '_zeny',
    '_whenEquip_Right_Hand_Type', '_inInventoryID') {
    configModify($prefix . $suffix, undef, 1);
  }
}

sub skill_automation_json {
  my ($prefix, $mode) = @_;
  my $handle = $config{$prefix} || '';
  return 'null' if !$handle || number_or_zero($config{$prefix . '_disabled'});
  my $sp = $config{$prefix . '_sp'} || '';
  my $hp = $config{$prefix . '_hp'} || '';
  my ($minimum_sp) = $sp =~ /^(\d+)\.\./;
  my ($hp_below) = $hp =~ /\.\.(\d+)%$/;
  return '{"mode":' . json_string($mode)
    . ',"handle":' . json_string($handle)
    . ',"level":' . number_or_zero($config{$prefix . '_lvl'})
    . ',"minimumSp":' . number_or_zero($minimum_sp)
    . ',"hpBelow":' . number_or_zero($hp_below)
    . ',"conditionReady":' . (Misc::checkSelfCondition($prefix) ? 'true' : 'false')
    . ',"selfTarget":' . (number_or_zero($config{$prefix . '_isSelfSkill'}) ? 'true' : 'false')
    . '}';
}

sub record_task_npc_talk {
  my ($hook, $args) = @_;
  return if !$onboarding_active && !$eden_active;
  my $npc = $args->{name} || $talk{name} || 'NPC';
  my $message = $args->{msg} || $talk{msg} || '';
  $message =~ s/\^[a-fA-F0-9]{6}//g;
  $message =~ s/^\s+|\s+$//g;
  my @lines = grep { $_ !~ /^\s*$/ && $_ !~ /^\[[^\]]+\]\s*$/ } split(/\r?\n/, $message);
  return if !@lines;
  $message = $lines[-1];
  $message = substr($message, -500) if length($message) > 500;
  return if $message eq '';
  my %dialog_translations = (
    'Shall we go to the garden of Criatura Academy?' => '要前往克里圖拉學院的庭園嗎？',
    'All right, come this way.' => '好，請跟我來。'
  );
  if (exists $dialog_translations{$message}) {
    $message = $dialog_translations{$message};
  } elsif ($message =~ /[A-Za-z]{3}/ && $message !~ /[\x{4e00}-\x{9fff}]/) {
    my $info = $eden_active
      ? $eden_phase_info{$eden_phase}
      : $onboarding_phase_info{$onboarding_phase};
    $message = $info ? $info->[1] : 'NPC 已回應目前任務。';
  }
  $npc =~ s/#.*$//;
  $npc = '新生學院引導員' if $npc =~ /Adept Adventurer/i;
  $npc = '學院櫃檯人員' if $npc =~ /Academy Receptionist/i;
  $npc = '學院結業導師' if $npc =~ /Academy Graduation/i;
  $npc = '伊甸園傳送員' if $npc =~ /Eden Teleport Officer/i;
  $npc = '秘書 Lime Evenor' if $npc =~ /Secretary Lime Evenor/i;
  append_task_event('dialog', "與 $npc 對話", $message, $npc,
    join('|', 'dialog', $npc, $message));
}

sub record_task_mission {
  my ($hook, $args) = @_;
  return if !$onboarding_active && !$eden_active;
  my $count = number_or_zero($args->{count});
  my $goal = number_or_zero($args->{goal});
  my $mob_id = number_or_zero($args->{mobID});
  append_task_event('battle', '任務戰鬥進度', "目標怪物 $mob_id：$count / $goal",
    '任務目標', join('|', 'mission', number_or_zero($args->{questID}), $mob_id, $count, $goal));
}

sub record_route_status {
  my ($hook, $args) = @_;
  return if (!$onboarding_active && !$eden_active) || ($args->{status} || '') ne 'stuck';
  $onboarding_stuck_pending = 1;
  if ($eden_active && ($eden_task_id eq 'equipment12' || $eden_task_id eq 'equipment26')) {
    $eden_route_stuck_count++;
    fail_eden_task('route_failed') if $eden_route_stuck_count >= 3;
  }
}

sub actor_json {
  my ($actor, $engaged) = @_;
  my $pos = calcPosition($actor);
  return join('',
    '{"id":', json_string(unpack('H*', $actor->{ID} || '')),
    ',"name":', json_string($actor->name),
    ',"x":', number_or_zero($pos->{x}),
    ',"y":', number_or_zero($pos->{y}),
    ',"engaged":', $engaged ? 'true' : 'false',
    '}'
  );
}

sub inventory_json {
  my ($item) = @_;
  my $weapon_type = '';
  if ($itemHandType_lut{$item->{nameID}}
    && defined($itemHandType_lut{$item->{nameID}}{type})) {
    $weapon_type = $itemHandType_lut{$item->{nameID}}{type};
  }
  return join('',
    '{"binId":', number_or_zero($item->{binID}),
    ',"itemKey":', json_string(unpack('H*', $item->{ID} || '')),
    ',"itemId":', number_or_zero($item->{nameID}),
    ',"name":', json_string($item->{name}),
    ',"amount":', number_or_zero($item->{amount}),
    ',"equipped":', $item->{equipped} ? 'true' : 'false',
    ',"equipMask":', number_or_zero($item->{equipped}),
    ',"equipTarget":', number_or_zero($item->{type_equip}),
    ',"itemType":', number_or_zero($item->{type}),
    ',"weaponType":', json_string($weapon_type),
    ',"refine":', number_or_zero($item->{upgrade}),
    ',"identified":', $item->{identified} ? 'true' : 'false',
    ',"usable":', $item->usable ? 'true' : 'false',
    ',"equippable":', $item->equippable ? 'true' : 'false',
    ',"mergeable":', $item->mergeable ? 'true' : 'false',
    '}'
  );
}

sub inventory_item_from_argument {
  my ($argument) = @_;
  return undef if !$char || !$char->inventory->isReady();
  if ($argument =~ /^id:([a-f0-9]+)$/i) {
    return $char->inventory->getByID(pack('H*', $1));
  }
  return $char->inventory->get(0 + $argument) if $argument =~ /^\d+$/;
  return undef;
}

sub nearby_npc_at {
  my ($map, $x, $y, $range) = @_;
  return undef if !$char || !$field || !$npcsList;
  return undef if $field->baseName ne $map;
  my $char_pos = calcPosition($char);
  foreach my $npc (@{ $npcsList->getItems }) {
    my $pos = calcPosition($npc);
    next if number_or_zero($pos->{x}) != $x || number_or_zero($pos->{y}) != $y;
    return $npc if abs($char_pos->{x} - $x) <= $range && abs($char_pos->{y} - $y) <= $range;
  }
  return undef;
}

sub nearby_job_npc {
  my ($job) = @_;
  return undef if !$job_routes{$job};
  my ($map, $x, $y) = @{ $job_routes{$job} };
  return nearby_npc_at($map, $x, $y, 6);
}

sub onboarding_map_matches {
  my ($map, $base) = @_;
  return 0 if !defined($map);
  return $map =~ /^\Q$base\E(?:0[1-4]|_[a-d])?$/ ? 1 : 0;
}

sub is_onboarding_map {
  my ($map) = @_;
  return onboarding_map_matches($map, 'iz_int')
    || onboarding_map_matches($map, 'int_land')
    || onboarding_map_matches($map, 'izlude')
    || onboarding_map_matches($map, 'iz_ac01')
    || $map eq 'new_1-3';
}

sub quest_state {
  my ($quest_id) = @_;
  return 0 if !$questList || !exists $questList->{$quest_id};
  return $questList->{$quest_id}{active} ? 1 : 2;
}

sub inventory_amount {
  my ($name_id) = @_;
  return 0 if !$char || !$char->inventory->isReady();
  my $item = $char->inventory->getByNameID($name_id);
  return $item ? number_or_zero($item->{amount}) : 0;
}

sub is_eden_eligible_job {
  my ($job_id) = @_;
  $job_id = number_or_zero($job_id);
  return 1 if $job_id >= 1 && $job_id <= 6;
  return scalar grep { $_ == $job_id } (21, 23, 24, 25, 4046);
}

sub set_onboarding_phase {
  my ($phase) = @_;
  return if $onboarding_phase eq $phase;
  $onboarding_phase = $phase;
  my $info = $onboarding_phase_info{$phase};
  append_task_event('action', $info->[0], $info->[1], $info->[2], "phase|$phase") if $info;
}

sub process_stuck_recovery {
  return if !$onboarding_stuck_pending || (!$onboarding_active && !$eden_active) || !$char || !$field;
  return if time - $last_stuck_recovery < 2.0;
  my $pos = calcPosition($char);
  my @offsets = ([1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]);
  foreach my $offset (@offsets) {
    my $x = number_or_zero($pos->{x}) + $offset->[0];
    my $y = number_or_zero($pos->{y}) + $offset->[1];
    next if !$field->isWalkable($x, $y) || $field->isCellOccupied({x => $x, y => $y});
    my $seconds = int(time - $last_position_changed_at);
    Commands::run('move ' . $field->baseName . " $x $y 0");
    append_task_event('recovery', '尋路自動修正', "原地停留 ${seconds} 秒，改向一步後重新尋路。", '',
      join('|', 'stuck', $field->baseName, $pos->{x}, $pos->{y}, int(time)));
    $last_stuck_recovery = time;
    last;
  }
  $onboarding_stuck_pending = 0;
}

sub update_task_position {
  return if !$char || !$field;
  my $pos = calcPosition($char);
  my $map = $field->baseName;
  if ($map ne $last_task_map
    || !defined($last_task_x) || !defined($last_task_y)
    || number_or_zero($pos->{x}) != $last_task_x
    || number_or_zero($pos->{y}) != $last_task_y) {
    if ($last_task_map ne '' && $map ne $last_task_map) {
      append_task_event('map', '抵達新地圖', "目前位置：$map（$pos->{x}, $pos->{y}）", '',
        join('|', 'map', $map));
    }
    $last_task_map = $map;
    $last_task_x = number_or_zero($pos->{x});
    $last_task_y = number_or_zero($pos->{y});
    $last_position_changed_at = time;
  }
}

sub onboarding_action_ready {
  my ($delay) = @_;
  $delay = 0.7 if !defined($delay);
  return time - $onboarding_last_action >= $delay;
}

sub set_onboarding_ai {
  my ($mode) = @_;
  return if $onboarding_ai_mode eq $mode;
  Commands::run("ai $mode");
  $onboarding_ai_mode = $mode;
}

sub onboarding_move {
  my ($map, $x, $y, $distance) = @_;
  set_onboarding_ai('manual');
  return if !AI::isIdle() || !onboarding_action_ready(1.0);
  Commands::run("move $map $x $y $distance");
  $onboarding_last_action = time;
}

sub onboarding_talk_at {
  my ($map, $x, $y, $range, $choice) = @_;
  set_onboarding_ai('manual');
  my $npc = nearby_npc_at($map, $x, $y, $range);
  if (!$npc) {
    my $char_pos = calcPosition($char);
    my $approach_x = $x;
    my $approach_y = $y;
    my $delta_x = number_or_zero($char_pos->{x}) - $x;
    my $delta_y = number_or_zero($char_pos->{y}) - $y;
    if (abs($delta_x) >= abs($delta_y)) {
      $approach_x += $delta_x < 0 ? -1 : 1;
      $approach_y = number_or_zero($char_pos->{y});
    } else {
      $approach_x = number_or_zero($char_pos->{x});
      $approach_y += $delta_y < 0 ? -1 : 1;
    }
    my $approach = $field->closestWalkableSpot(
      { x => $approach_x, y => $approach_y },
      $range > 1 ? $range : 1
    );
    onboarding_move(
      $map,
      $approach ? $approach->{x} : $x,
      $approach ? $approach->{y} : $y,
      0
    );
    return;
  }
  return if !AI::isIdle() || !onboarding_action_ready(0.7);
  $onboarding_dialog_owned = 1;
  $onboarding_dialog_choice = $choice || 1;
  $onboarding_dialog_started_at = time;
  $onboarding_dialog_phase = $onboarding_phase;
  $onboarding_dialog_seen = 0;
  Commands::run('talk ' . number_or_zero($npc->{binID}));
  $onboarding_last_action = time;
}

sub process_onboarding_dialog {
  if (!$talk{ID}) {
    if ($onboarding_dialog_owned && $onboarding_dialog_seen) {
      $onboarding_dialog_completed{$onboarding_dialog_phase} = 1;
      $onboarding_dialog_owned = 0;
      $onboarding_dialog_seen = 0;
      return 0;
    }
    if ($onboarding_dialog_owned && time - $onboarding_dialog_started_at > 20.0) {
      $onboarding_dialog_owned = 0;
    }
    return 0;
  }
  return 0 if !$onboarding_active || !$onboarding_dialog_owned;
  $onboarding_dialog_seen = 1;
  return 1 if !onboarding_action_ready(0.25);
  my $stage = $ai_v{'npc_talk'}{'talk'} || '';
  if ($stage eq 'next') {
    $messageSender->sendTalkContinue($talk{ID});
  } elsif ($stage eq 'select' && $talk{responses}) {
    my $count = scalar @{ $talk{responses} };
    my $choice = $onboarding_dialog_choice;
    $choice = 1 if $choice < 1 || $choice > $count;
    $messageSender->sendTalkResponse($talk{ID}, $choice);
  } elsif ($stage eq 'close') {
    $onboarding_dialog_completed{$onboarding_phase} = 1;
    $messageSender->sendTalkCancel($talk{ID});
  } else {
    return 1;
  }
  $onboarding_last_action = time;
  return 1;
}

sub finish_onboarding {
  set_onboarding_ai('manual');
  if (defined($onboarding_original_auto_talk)) {
    configModify('autoTalkCont', $onboarding_original_auto_talk, 1);
  }
  $onboarding_active = 0;
  $onboarding_completed = 1;
  set_onboarding_phase('returning_hunt');
  $job_resume_pending = 1;
  $job_resume_after = time + 1;
  $last_job_resume_retry = 0;
  $job_route_key = '';
  $onboarding_dialog_owned = 0;
  $onboarding_dialog_seen = 0;
}

sub process_archer_onboarding_repair {
  return if !$field || !$char || number_or_zero($char->{jobID}) != 3;
  return if !$char->inventory->isReady();
  my $bow = $char->inventory->getByNameID(1742);
  return if !$bow;
  return if number_or_zero($char->{lv}) >= 4
    && $bow->{equipped}
    && $field->baseName eq 'prt_fild08';
  return if $archer_repair_attempts >= 4 || time - $last_archer_repair < 3;
  $messageSender->sendChat('@terminal_archer_repair');
  $archer_repair_attempts++;
  $last_archer_repair = time;
}

sub set_eden_phase {
  my ($phase) = @_;
  return if $eden_phase eq $phase;
  $eden_phase = $phase;
  $eden_phase_started_at = time;
  $eden_route_stuck_count = 0;
  my $info = $eden_phase_info{$phase};
  append_task_event('action', $info->[0], $info->[1], $info->[2], "eden_phase|$phase") if $info;
}

sub restore_eden_settings {
  configModify('autoTalkCont', $eden_original_auto_talk, 1)
    if defined($eden_original_auto_talk);
  configModify('itemsTakeAuto', $eden_original_items_take_auto, 1)
    if defined($eden_original_items_take_auto);
}

sub supply_guard_path {
  my @control_folders = Settings::getControlFolders();
  return if !@control_folders;
  return File::Spec->catfile($control_folders[0], '..', 'supply-guard.txt');
}

sub write_supply_guard {
  my $path = supply_guard_path();
  return 0 if !$path;
  my $temporary = $path . '.tmp';
  open(my $file, '>:encoding(UTF-8)', $temporary) or return 0;
  print $file 'attackAuto=' . number_or_zero($eden_supply_original_attack) . "\n";
  print $file 'itemsTakeAuto=' . number_or_zero($eden_supply_original_take) . "\n";
  close($file) or return 0;
  return rename($temporary, $path) ? 1 : 0;
}

sub clear_supply_guard {
  my $path = supply_guard_path();
  unlink($path) if $path && -f $path;
}

sub recover_interrupted_supply {
  return if $supply_guard_checked;
  my $path = supply_guard_path();
  if (!$path || !-f $path) {
    $supply_guard_checked = 1;
    return;
  }
  open(my $file, '<:encoding(UTF-8)', $path) or return;
  my %saved;
  while (my $line = <$file>) {
    chomp($line);
    my ($key, $value) = split(/=/, $line, 2);
    $saved{$key} = $value if defined($key) && defined($value) && $value =~ /^\d+$/;
  }
  close($file);
  configModify('attackAuto', $saved{attackAuto}, 1)
    if defined($saved{attackAuto});
  configModify('itemsTakeAuto', $saved{itemsTakeAuto}, 1)
    if defined($saved{itemsTakeAuto});
  clear_supply_guard();
  $supply_guard_checked = 1;
  append_task_event(
    'recovery',
    '補給中斷復原',
    '已還原自動攻擊與拾取設定。',
    '',
    'supply_guard_recovered'
  );
}

sub fail_eden_task {
  my ($error) = @_;
  return if !$eden_active;
  AI::clear();
  Commands::run('ai manual');
  configModify('attackAuto', $eden_supply_original_attack, 1)
    if $eden_supply_active && defined($eden_supply_original_attack);
  restore_eden_settings();
  $eden_error = $error;
  $eden_active = 0;
  $eden_completed = 0;
  $eden_dialog_owned = 0;
  $eden_dialog_seen = 0;
  $eden_supply_active = 0;
  $eden_supply_started_at = 0;
  clear_supply_guard();
  append_task_event('recovery', '伊甸園任務停止', $error, '', "eden_error|$error");
}

sub equip_eden_rewards {
  return if !$char || !$char->inventory->isReady();
  my @equipped;
  foreach my $item_id (5583, 2560, 2456, 15009, 2457, 15010,
    1192, 13423, 13050, 16004, 1747, 1650, 13112, 1699) {
    my $item = $char->inventory->getByNameID($item_id);
    next if !$item || !$item->equippable || $item->{equipped};
    $item->equip;
    push @equipped, $item->{name} || $item_id;
  }
  if (number_or_zero($char->{jobID}) == 3) {
    my $arrow = $char->inventory->getByNameID(1750);
    if ($arrow && $arrow->equippable && !$arrow->{equipped}) {
      $arrow->equip;
      push @equipped, $arrow->{name} || 1750;
    }
  }
  append_task_event(
    'action',
    '自動穿上伊甸園裝備',
    '已送出裝備指令：' . join('、', @equipped),
    '裝備欄',
    join('|', 'eden_auto_equip', $eden_task_id, @equipped)
  ) if @equipped;
}

sub start_eden_equipment26_chain {
  return 0 if $eden_task_id ne 'equipment12';
  my $level = number_or_zero($char->{lv});
  return 0 if $level < 26 || $level >= 33;
  $eden_task_id = 'equipment26';
  $eden_active = 1;
  $eden_completed = 0;
  $eden_error = '';
  $eden_started_at = time;
  $eden_last_action = 0;
  $eden_phase_started_at = 0;
  $eden_dialog_owned = 0;
  $eden_dialog_seen = 0;
  $eden_dialog_phase = '';
  $eden_select_step = 0;
  $eden_text_step = 0;
  $eden_training_stage_hint = 12;
  $eden_last_quest_id = 0;
  $eden_target_missing_since = 0;
  $eden_route_stuck_count = 0;
  $eden_npc_failures = 0;
  $eden_supply_active = 0;
  $eden_supply_started_at = 0;
  $job_resume_pending = 0;
  append_task_event(
    'action',
    '接續 Lv.26 裝備訓練',
    '角色等級符合條件，正在接續下一階段原生伊甸園任務。',
    'Instructor Boya',
    'eden_equipment26_chain'
  );
  set_eden_phase('equipment26_accept');
  return 1;
}

sub process_eden_supply {
  my $equipment_task = $eden_active
    && ($eden_task_id eq 'equipment12' || $eden_task_id eq 'equipment26');
  return 0 if !$equipment_task && !$job_resume_pending;
  return 0 if !$char->inventory->isReady();
  my $red_potions = inventory_amount(501);
  if (!$eden_supply_active) {
    return 0 if $red_potions > 20;
    if ($field && $field->baseName eq 'moc_para01') {
      set_eden_phase('equipment_supply');
      eden_exit_step();
      return 1;
    }
    configModify('teleportAuto_idle', 0, 1)
      if number_or_zero($config{teleportAuto_idle}) != 0;
    $eden_supply_original_attack = $config{attackAuto};
    $eden_supply_original_take = $config{itemsTakeAuto};
    if (!write_supply_guard()) {
      append_task_event(
        'recovery',
        '補給安全鎖建立失敗',
        '保留目前戰鬥設定並略過本次補給。',
        '',
        'supply_guard_write_failed'
      );
      return 0;
    }
    configModify('attackAuto', 0, 1)
      if number_or_zero($config{attackAuto}) != 0;
    configModify('itemsTakeAuto', 0, 1)
      if number_or_zero($config{itemsTakeAuto}) != 0;
    $messageSender->sendTalkCancel($talk{ID}) if $talk{ID};
    $eden_dialog_owned = 0;
    $eden_dialog_seen = 0;
    AI::clear();
    Commands::run('ai auto');
    AI::queue('sellAuto');
    $eden_supply_active = 1;
    $eden_supply_started_at = time;
    set_eden_phase('equipment_supply');
    return 1;
  }
  if ($red_potions > 20) {
    configModify('attackAuto', $eden_supply_original_attack, 1)
      if defined($eden_supply_original_attack);
    configModify('itemsTakeAuto', $eden_supply_original_take, 1)
      if defined($eden_supply_original_take);
    undef $eden_supply_original_attack;
    undef $eden_supply_original_take;
    $eden_supply_active = 0;
    $eden_supply_started_at = 0;
    $eden_last_action = 0;
    clear_supply_guard();
    append_task_event(
      'action',
      '補給完成',
      "紅色藥水已補至 $red_potions 個，正在返回任務地圖。",
      $equipment_task
        ? ($eden_task_id eq 'equipment26' ? 'pay_dun00' : 'moc_fild11')
        : job_resume_target()->[0],
      join('|', 'eden_supply_complete', $eden_task_id, $red_potions)
    );
    return 0;
  }
  if (time - $eden_supply_started_at >= 180.0) {
    if ($equipment_task) {
      fail_eden_task('insufficient_zeny');
    } else {
      AI::clear();
      Commands::run('ai manual');
      configModify('attackAuto', $eden_supply_original_attack, 1)
        if defined($eden_supply_original_attack);
      configModify('itemsTakeAuto', $eden_supply_original_take, 1)
        if defined($eden_supply_original_take);
      undef $eden_supply_original_attack;
      undef $eden_supply_original_take;
      $job_resume_pending = 0;
      $eden_supply_active = 0;
      clear_supply_guard();
      append_task_event('recovery', '補給停止', 'insufficient_zeny', '',
        'hunt_supply_insufficient_zeny');
    }
    return 1;
  }
  return 1 if AI::inQueue('sellAuto', 'buyAuto', 'storageAuto', 'route', 'mapRoute', 'teleport', 'NPC');
  return 1;
}

sub eden_equipment_rewards_complete {
  foreach my $item_id (5583, 2560, 2456, 15009) {
    return 0 if inventory_amount($item_id) < 1;
  }
  return 1;
}

sub eden_equipment26_rewards_complete {
  return inventory_amount(2457) > 0 && inventory_amount(15010) > 0;
}

sub eden_equipment_quest_id {
  return 0 if !$questList;
  my @quest_ids = $eden_task_id eq 'equipment26'
    ? (7138, 7139, 7140, 7141)
    : (7128, 7129, 7130, 7131, 7132);
  foreach my $quest_id (@quest_ids) {
    if (exists $questList->{$quest_id}) {
      $eden_last_quest_id = $quest_id;
      return $quest_id;
    }
  }
  return 0;
}

sub eden_equipment_mission {
  my ($quest_id, $mob_id) = @_;
  return undef if !$questList || !exists $questList->{$quest_id}{missions};
  foreach my $mission (values %{ $questList->{$quest_id}{missions} }) {
    return $mission if number_or_zero($mission->{mob_id}) == $mob_id;
  }
  return undef;
}

sub eden_equipment_hunt {
  my ($quest_id, $mob_id, $phase) = @_;
  my $mission = eden_equipment_mission($quest_id, $mob_id);
  if (!$mission || number_or_zero($mission->{mob_goal}) < 1) {
    if (!$eden_target_missing_since) {
      $eden_target_missing_since = time;
      set_eden_phase('equipment_sync_target');
    } elsif (time - $eden_target_missing_since >= 15.0) {
      fail_eden_task('target_unresolved');
    }
    return 1;
  }
  $eden_target_missing_since = 0;
  my $count = number_or_zero($mission->{mob_count});
  my $goal = number_or_zero($mission->{mob_goal});
  if ($count >= $goal) {
    if ($eden_phase ne 'equipment_dog') {
      Commands::run('ai manual');
      AI::clear();
      set_eden_phase('equipment_dog');
    }
    eden_talk_at('moc_fild11', 180, 253, 7);
    return 1;
  }
  set_eden_phase($phase);
  configModify('teleportAuto_idle', 1, 1)
    if number_or_zero($config{teleportAuto_idle}) != 1;
  configModify('lockMap', 'moc_fild11', 1) if ($config{lockMap} || '') ne 'moc_fild11';
  Commands::run('ai auto') if AI::action() eq 'manual' || AI::isIdle();
  return 1;
}

sub eden_equipment26_hunt {
  my ($quest_id, $mob_id, $phase) = @_;
  my $mission = eden_equipment_mission($quest_id, $mob_id);
  if (!$mission || number_or_zero($mission->{mob_goal}) < 1) {
    if (!$eden_target_missing_since) {
      $eden_target_missing_since = time;
      set_eden_phase('equipment_sync_target');
    } elsif (time - $eden_target_missing_since >= 15.0) {
      fail_eden_task('target_unresolved');
    }
    return 1;
  }
  $eden_target_missing_since = 0;
  my $count = number_or_zero($mission->{mob_count});
  my $goal = number_or_zero($mission->{mob_goal});
  if ($count >= $goal) {
    configModify('lockMap', '', 1) if ($config{lockMap} || '') ne '';
    Commands::run('ai manual') if AI::action() ne 'manual';
    AI::clear();
    set_eden_phase('equipment26_karl');
    eden_move('pay_arche', 41, 136, 7);
    return 1;
  }
  set_eden_phase($phase);
  configModify('teleportAuto_idle', 1, 1)
    if number_or_zero($config{teleportAuto_idle}) != 1;
  configModify('lockMap', 'pay_dun00', 1) if ($config{lockMap} || '') ne 'pay_dun00';
  Commands::run('ai auto') if AI::action() eq 'manual' || AI::isIdle();
  return 1;
}

sub eden_action_ready {
  my ($delay) = @_;
  $delay = 0.7 if !defined($delay);
  return time - $eden_last_action >= $delay;
}

sub eden_move {
  my ($map, $x, $y, $distance) = @_;
  configModify('teleportAuto_idle', 0, 1)
    if number_or_zero($config{teleportAuto_idle}) != 0;
  return if !AI::isIdle() || !eden_action_ready(1.0);
  Commands::run("move $map $x $y $distance");
  $eden_last_action = time;
}

sub eden_talk_at {
  my ($map, $x, $y, $range) = @_;
  configModify('teleportAuto_idle', 0, 1)
    if number_or_zero($config{teleportAuto_idle}) != 0;
  my $npc = nearby_npc_at($map, $x, $y, $range);
  if (!$npc) {
    eden_move($map, $x, $y, 2);
    return;
  }
  return if !AI::isIdle() || !eden_action_ready(0.7);
  $eden_dialog_owned = 1;
  $eden_dialog_seen = 0;
  $eden_dialog_started_at = time;
  $eden_dialog_phase = $eden_phase;
  $eden_select_step = 0;
  $eden_text_step = 0;
  $messageSender->sendTalk($npc->{ID});
  $eden_last_action = time;
}

sub process_eden_dialog {
  if (!$talk{ID}) {
    if ($eden_dialog_owned && $eden_dialog_phase eq 'enter_headquarters'
      && $field && $field->baseName eq 'moc_para01') {
      $eden_dialog_owned = 0;
      $eden_dialog_seen = 0;
      return 0;
    }
    if ($eden_dialog_owned && $eden_dialog_seen) {
      $eden_dialog_owned = 0;
      $eden_dialog_seen = 0;
      return 0;
    }
    if ($eden_dialog_owned && time - $eden_dialog_started_at > 30.0) {
      $eden_dialog_owned = 0;
      $eden_dialog_seen = 0;
      $eden_npc_failures++;
      if (($eden_task_id eq 'equipment12' || $eden_task_id eq 'equipment26')
        && $eden_npc_failures >= 3) {
        fail_eden_task('npc_failed');
      }
    }
    return $eden_dialog_owned ? 1 : 0;
  }
  return 0 if !$eden_active || !$eden_dialog_owned;
  $eden_dialog_seen = 1;
  return 1 if !eden_action_ready(0.35);
  my $stage = $ai_v{'npc_talk'}{'talk'} || '';
  if ($stage eq 'next') {
    $messageSender->sendTalkContinue($talk{ID});
  } elsif ($stage eq 'select' && $talk{responses}) {
    my %choices = (
      enter_headquarters => [1],
      register_member => [2, 1],
      equipment_accept => [2, 1, 1],
      equipment_dog => [2],
      equipment_reward => [1, 2],
      equipment26_reward => [1, 2]
    );
    my $phase_choices = $choices{$eden_phase} || [1];
    my $choice = $phase_choices->[$eden_select_step] || 1;
    $messageSender->sendTalkResponse($talk{ID}, $choice);
    $eden_select_step++;
  } elsif ($stage eq 'text') {
    $messageSender->sendTalkText($talk{ID}, $char->{name});
    $eden_text_step++;
  } elsif ($stage eq 'close') {
    $messageSender->sendTalkCancel($talk{ID});
  } else {
    return 1;
  }
  $eden_last_action = time;
  return 1;
}

sub finish_eden_enrollment {
  AI::clear();
  Commands::run('ai manual');
  $eden_dialog_owned = 0;
  $eden_dialog_seen = 0;
  append_task_event('action', '伊甸園入團完成', '已取得伊甸園徽章。',
    '伊甸園徽章', 'eden_member_complete');
  my $level = number_or_zero($char->{lv});
  if (($level >= 12 && $level < 20) || ($level >= 26 && $level < 33)) {
    $eden_task_id = $level >= 26 ? 'equipment26' : 'equipment12';
    $eden_active = 1;
    $eden_completed = 0;
    $eden_error = '';
    $eden_started_at = time;
    $eden_last_action = 0;
    $eden_phase_started_at = 0;
    $eden_training_stage_hint = 0;
    $eden_last_quest_id = 0;
    $eden_target_missing_since = 0;
    $eden_route_stuck_count = 0;
    $eden_npc_failures = 0;
    $eden_supply_active = 0;
    $eden_supply_started_at = 0;
    $eden_original_items_take_auto = $config{itemsTakeAuto};
    configModify('itemsTakeAuto', 0, 1)
      if number_or_zero($config{itemsTakeAuto}) != 0;
    set_eden_phase($eden_task_id eq 'equipment26'
      ? 'equipment26_accept' : 'equipment_accept');
    return;
  }
  configModify('autoTalkCont', 0, 1);
  $eden_active = 0;
  $eden_completed = 1;
  set_eden_phase('returning_hunt');
  $eden_return_started_at = time;
  $eden_exit_recovery_attempted = 0;
  $job_resume_pending = 1;
  $job_resume_after = time + 1;
  $last_job_resume_retry = 0;
}

sub finish_eden_equipment {
  AI::clear();
  Commands::run('ai manual');
  if ($talk{ID}) {
    $messageSender->sendTalkCancel($talk{ID});
    $dialog_cancel_until = time + 3;
  }
  $eden_dialog_owned = 0;
  $eden_dialog_seen = 0;
  my $tier = $eden_task_id eq 'equipment26' ? '第二套' : '第一套';
  append_task_event('action', '任務完成', "由 rAthena 原生 NPC 發放${tier}伊甸園裝備。",
    '伊甸園裝備', 'eden_equipment_reward_complete');
  return if start_eden_equipment26_chain();
  restore_eden_settings();
  $eden_active = 0;
  $eden_completed = 1;
  $eden_supply_active = 0;
  $eden_supply_started_at = 0;
  set_eden_phase('equipment_returning_hunt');
  $eden_return_started_at = time;
  $eden_exit_recovery_attempted = 0;
  $job_resume_pending = 1;
  $job_resume_after = time + 1;
  $last_job_resume_retry = 0;
  $job_route_key = '';
}

sub process_eden_exit_dialog {
  return 0 if !$talk{ID};
  return 1 if !eden_action_ready(0.35);
  my $stage = $ai_v{'npc_talk'}{'talk'} || '';
  if ($stage eq 'next') {
    $messageSender->sendTalkContinue($talk{ID});
  } elsif ($stage eq 'select' && $talk{responses}) {
    $messageSender->sendTalkResponse($talk{ID}, 5);
  } elsif ($stage eq 'close') {
    $messageSender->sendTalkCancel($talk{ID});
  } else {
    return 1;
  }
  $eden_last_action = time;
  return 1;
}

sub process_eden {
  return 0 if !$eden_active || !$char || !$field || !$net
    || $net->getState() != Network::IN_GAME;
  my $member = inventory_amount(6219) > 0 || inventory_amount(22508) > 0;
  if ($eden_task_id eq 'member' && $member) {
    return 1 if process_eden_exit_dialog();
    finish_eden_enrollment();
    return 1;
  }
  if ($eden_task_id eq 'equipment12' && $member
    && $eden_dialog_phase eq 'register_member') {
    return 1 if process_eden_exit_dialog();
    $eden_dialog_owned = 0;
    $eden_dialog_seen = 0;
  }
  if (($eden_task_id eq 'equipment12' && eden_equipment_rewards_complete())
    || ($eden_task_id eq 'equipment26' && eden_equipment26_rewards_complete())) {
    return 1 if process_eden_exit_dialog();
    finish_eden_equipment();
    return 1;
  }
  return 1 if process_eden_dialog();
  return 1 if time - $eden_started_at < 1.5;
  return 1 if number_or_zero($char->{dead});
  return 1 if process_eden_supply();
  if ((($eden_task_id eq 'equipment12'
      && $eden_phase =~ /^(?:route_officer|enter_headquarters|route_secretary|equipment_route_field|equipment_report_boya)$/)
    || ($eden_task_id eq 'equipment26'
      && $eden_phase =~ /^(?:route_officer|enter_headquarters|route_secretary|equipment26_route_field|equipment26_report_boya)$/))
    && $eden_phase_started_at > 0
    && time - $eden_phase_started_at >= 300.0) {
    fail_eden_task('route_failed');
    return 1;
  }

  my $map = $field->baseName;
  if ($eden_task_id eq 'equipment12' && $member) {
    my $quest_id = eden_equipment_quest_id();
    if ($quest_id == 7128) {
      $eden_training_stage_hint = 1;
    } elsif ($quest_id >= 7129 && $quest_id <= 7131) {
      $eden_training_stage_hint = $quest_id - 7127;
    } elsif ($quest_id == 7132) {
      $eden_training_stage_hint = $questList->{7132}{active} ? 5 : 11;
    } elsif ($eden_last_quest_id == 7132 && $eden_training_stage_hint == 5) {
      $eden_training_stage_hint = 11;
    }

    if ($map eq 'moc_fild11') {
      if ($quest_id == 7128) {
        if ($eden_phase ne 'equipment_dog') {
          Commands::run('ai manual');
          AI::clear();
          set_eden_phase('equipment_dog');
        }
        eden_talk_at('moc_fild11', 180, 253, 7);
      } elsif ($quest_id == 7129) {
        eden_equipment_hunt(7129, 1009, 'equipment_hunt_condor');
      } elsif ($quest_id == 7130) {
        eden_equipment_hunt(7130, 1107, 'equipment_hunt_wolf');
      } elsif ($quest_id == 7131) {
        eden_equipment_hunt(7131, 1001, 'equipment_hunt_scorpion');
      } else {
        configModify('lockMap', '', 1) if ($config{lockMap} || '') ne '';
        if ($eden_phase ne 'equipment_report_boya') {
          Commands::run('ai manual');
          AI::clear();
          set_eden_phase('equipment_report_boya');
        }
        eden_move('prontera', 124, 76, 3);
      }
      return 1;
    }

    if ($map eq 'moc_para01') {
      configModify('lockMap', '', 1) if ($config{lockMap} || '') ne '';
      if ($eden_training_stage_hint == 11
        || ($quest_id == 7132 && !$questList->{7132}{active})) {
        if ($char->inventory->size() > 96) {
          fail_eden_task('inventory_full');
          return 1;
        }
        set_eden_phase('equipment_reward');
        eden_talk_at('moc_para01', 112, 96, 7);
      } elsif ($quest_id == 7132 || $eden_training_stage_hint == 5) {
        set_eden_phase('equipment_report_boya');
        eden_talk_at('moc_para01', 25, 35, 7);
      } elsif ($quest_id >= 7128 && $quest_id <= 7131) {
        set_eden_phase('equipment_route_field');
        eden_exit_step();
      } else {
        set_eden_phase('equipment_accept');
        eden_talk_at('moc_para01', 25, 35, 7);
      }
      return 1;
    }

    if ($quest_id >= 7128 && $quest_id <= 7131) {
      set_eden_phase('equipment_route_field');
      eden_move('moc_fild11', 180, 253, 7);
      return 1;
    }
  }

  if ($eden_task_id eq 'equipment26' && $member) {
    my $quest_id = eden_equipment_quest_id();
    if ($quest_id == 7138) {
      $eden_training_stage_hint = 13;
    } elsif ($quest_id == 7139) {
      $eden_training_stage_hint = 14;
    } elsif ($quest_id == 7140) {
      $eden_training_stage_hint = 15;
    } elsif ($quest_id == 7141) {
      $eden_training_stage_hint = $questList->{7141}{active} ? 16 : 22;
    } elsif ($eden_last_quest_id == 7141 && $eden_training_stage_hint == 16) {
      $eden_training_stage_hint = 22;
    }

    if ($map eq 'pay_dun00') {
      if ($quest_id == 7139) {
        eden_equipment26_hunt(7139, 1076, 'equipment26_hunt_skeleton');
      } elsif ($quest_id == 7140) {
        eden_equipment26_hunt(7140, 1031, 'equipment26_hunt_poporing');
      } else {
        if ($eden_phase ne 'equipment26_karl') {
          Commands::run('ai manual');
          AI::clear();
          set_eden_phase('equipment26_karl');
        }
        eden_move('pay_arche', 41, 136, 7);
      }
      return 1;
    }

    if ($map eq 'pay_arche') {
      if ($quest_id >= 7138 && $quest_id <= 7140) {
        if ($quest_id >= 7139
          && number_or_zero($char->{hp}) < number_or_zero($char->{hp_max}) * 0.8) {
          if ($eden_phase ne 'equipment26_karl') {
            Commands::run('ai manual');
            AI::clear();
            set_eden_phase('equipment26_karl');
          }
          eden_talk_at('pay_arche', 41, 136, 7);
          return 1;
        }
        if ($quest_id == 7139 || $quest_id == 7140) {
          my $mob_id = $quest_id == 7139 ? 1076 : 1031;
          my $mission = eden_equipment_mission($quest_id, $mob_id);
          if ($mission && number_or_zero($mission->{mob_count})
              < number_or_zero($mission->{mob_goal})) {
            set_eden_phase($quest_id == 7139
              ? 'equipment26_hunt_skeleton' : 'equipment26_hunt_poporing');
            eden_move('pay_dun00', 73, 78, 20);
            return 1;
          }
        }
        if ($eden_phase ne 'equipment26_karl') {
          Commands::run('ai manual') if AI::action() ne 'manual';
          AI::clear();
          set_eden_phase('equipment26_karl');
        }
        eden_talk_at('pay_arche', 41, 136, 7);
      } else {
        set_eden_phase('equipment26_report_boya');
        eden_move('prontera', 124, 76, 3);
      }
      return 1;
    }

    if ($map eq 'moc_para01') {
      configModify('lockMap', '', 1) if ($config{lockMap} || '') ne '';
      if ($eden_training_stage_hint >= 22) {
        if ($char->inventory->size() > 94) {
          fail_eden_task('inventory_full');
          return 1;
        }
        set_eden_phase('equipment26_reward');
        eden_talk_at('moc_para01', 112, 96, 7);
      } elsif ($quest_id == 7141 || $eden_training_stage_hint == 16) {
        set_eden_phase('equipment26_report_boya');
        eden_talk_at('moc_para01', 25, 35, 7);
      } elsif ($quest_id >= 7138 && $quest_id <= 7140) {
        set_eden_phase('equipment26_route_field');
        eden_exit_step();
      } else {
        set_eden_phase('equipment26_accept');
        eden_talk_at('moc_para01', 25, 35, 7);
      }
      return 1;
    }

    if ($quest_id >= 7138 && $quest_id <= 7140) {
      set_eden_phase('equipment26_route_field');
      eden_move('pay_arche', 41, 136, 7);
      return 1;
    }
  }

  if ($map eq 'moc_para01') {
    my $npc = nearby_npc_at('moc_para01', 27, 35, 6);
    if ($npc) {
      set_eden_phase('register_member');
      eden_talk_at('moc_para01', 27, 35, 6);
    } else {
      set_eden_phase('route_secretary');
      eden_move('moc_para01', 27, 35, 2);
    }
    return 1;
  }

  if ($map eq 'prontera') {
    my $npc = nearby_npc_at('prontera', 124, 76, 6);
    if ($npc) {
      set_eden_phase('enter_headquarters');
      eden_talk_at('prontera', 124, 76, 6);
    } else {
      set_eden_phase('route_officer');
      eden_move('prontera', 124, 76, 2);
    }
    return 1;
  }

  set_eden_phase('route_officer');
  eden_move('prontera', 124, 76, 3);
  return 1;
}

sub process_onboarding {
  return 0 if !$char || !$field || !$net || $net->getState() != Network::IN_GAME;
  my $map = $field->baseName;
  if (!$onboarding_active) {
    my $job_id = number_or_zero($char->{jobID});
    my $graduate_resume = $job_id >= 1
      && $job_id <= 6
      && onboarding_map_matches($map, 'iz_ac01');
    return 0 if !$graduate_resume
      && ($job_id != 0 || !is_onboarding_map($map));
    $onboarding_active = 1;
    $onboarding_started_at = time;
    $onboarding_last_action = 0;
    $onboarding_ai_mode = '';
    %onboarding_dialog_completed = ();
    $onboarding_dialog_owned = 0;
    $onboarding_dialog_seen = 0;
    $onboarding_original_auto_talk = $config{autoTalkCont};
    configModify('lockMap', '', 1) if ($config{lockMap} || '') ne '';
    configModify('autoTalkCont', 0, 1) if number_or_zero($config{autoTalkCont}) != 0;
    Commands::run('ai manual');
    $onboarding_ai_mode = 'manual';
    $job_route_key = '';
    $job_resume_pending = 0;
    set_onboarding_phase('starting');
    return 1;
  }

  return 1 if process_onboarding_dialog();
  return 1 if time - $onboarding_started_at < 2.0;

  if (number_or_zero($char->{dead})) {
    set_onboarding_phase('respawning');
    return 1;
  }

  if (number_or_zero($char->{jobID}) != 0) {
    if (onboarding_map_matches($map, 'iz_ac01')) {
      set_onboarding_phase('academy_exit');
      onboarding_talk_at($map, 60, 67, 6, 1);
    } elsif (onboarding_map_matches($map, 'izlude')) {
      finish_onboarding();
    } else {
      finish_onboarding();
    }
    return 1;
  }

  if (onboarding_map_matches($map, 'iz_int')) {
    if (quest_state(21001) == 0) {
      set_onboarding_phase('ship_wounded');
      onboarding_talk_at($map, 56, 32, 6, 1);
    } else {
      set_onboarding_phase('ship_exit');
      onboarding_move($map, 56, 15, 0);
    }
    return 1;
  }

  if (onboarding_map_matches($map, 'int_land')) {
    my $island_quest = quest_state(21008);
    if ($island_quest == 0
      && !$onboarding_dialog_completed{island_captain}
      && inventory_amount(611) == 0) {
      set_onboarding_phase('island_captain');
      onboarding_talk_at($map, 78, 103, 6, 1);
    } elsif (quest_state(7471) == 0
      && !$onboarding_dialog_completed{island_lumin}) {
      set_onboarding_phase('island_lumin');
      onboarding_talk_at($map, 73, 100, 6, 1);
    } elsif ($island_quest == 1 && inventory_amount(6008) < 2) {
      set_onboarding_phase('island_lumber');
      set_onboarding_ai('auto');
    } elsif ($island_quest == 1) {
      set_onboarding_phase('island_sailor');
      onboarding_talk_at($map, 58, 69, 6, 1);
    } else {
      set_onboarding_phase('sail_izlude');
      onboarding_move($map, 49, 57, 0);
    }
    return 1;
  }

  if (onboarding_map_matches($map, 'izlude')) {
    if (quest_state(7472) == 0
      && !$onboarding_dialog_completed{izlude_captain}) {
      set_onboarding_phase('izlude_captain');
      onboarding_talk_at($map, 198, 213, 6, 1);
    } elsif (quest_state(7473) == 0
      && !$onboarding_dialog_completed{izlude_hun_intro}
      && !$onboarding_dialog_completed{izlude_hun_finish}) {
      set_onboarding_phase('izlude_hun_intro');
      onboarding_talk_at($map, 122, 207, 5, 1);
    } elsif (quest_state(7473) == 1 && inventory_amount(531) > 0) {
      set_onboarding_phase('izlude_hun_drink');
      if (onboarding_action_ready(0.7) && $char->inventory->isReady()) {
        my $juice = $char->inventory->getByNameID(531);
        $juice->use if $juice;
        $onboarding_last_action = time;
      }
    } elsif (quest_state(7473) == 1
      && !$onboarding_dialog_completed{izlude_hun_finish}) {
      set_onboarding_phase('izlude_hun_finish');
      onboarding_talk_at($map, 122, 207, 5, 1);
    } else {
      set_onboarding_phase('academy_route');
      my $academy = $map =~ /_([a-d])$/ ? "iz_ac01_$1" : 'iz_ac01';
      onboarding_move($academy, 100, 39, 5);
    }
    return 1;
  }

  if (onboarding_map_matches($map, 'iz_ac01')) {
    if (quest_state(4269) != 2
      && inventory_amount(18730) == 0
      && !$onboarding_dialog_completed{academy_registration}) {
      set_onboarding_phase('academy_registration');
      onboarding_talk_at($map, 100, 39, 6, 1);
    } elsif (number_or_zero($char->{lv_job}) < 10
      && quest_state(2293) == 0
      && !$onboarding_dialog_completed{academy_pet_intro}) {
      set_onboarding_phase('academy_pet_intro');
      onboarding_talk_at($map, 45, 80, 6, 1);
    } elsif (number_or_zero($char->{lv_job}) < 10) {
      set_onboarding_phase('academy_training_route');
      onboarding_move('new_1-3', 95, 171, 5);
    } elsif (number_or_zero($char->{skills}{NV_BASIC}{lv}) < 9) {
      set_onboarding_phase('academy_basic_skill');
      if (number_or_zero($char->{points_skill}) > 0
        && number_or_zero($char->{skills}{NV_BASIC}{up})
        && onboarding_action_ready(0.5)) {
        $messageSender->sendAddSkillPoint(1);
        $onboarding_last_action = time;
      }
    } else {
      set_onboarding_phase('academy_graduation');
      onboarding_talk_at($map, 60, 67, 6, 1);
    }
    return 1;
  }

  if ($map eq 'new_1-3') {
    my $hp = number_or_zero($char->{hp});
    my $hp_max = number_or_zero($char->{hp_max});
    if ($hp_max > 0
      && $hp * 100 < $hp_max * 60
      && inventory_amount(569) > 0
      && onboarding_action_ready(0.7)
      && $char->inventory->isReady()) {
      set_onboarding_phase('academy_training_heal');
      my $potion = $char->inventory->getByNameID(569);
      $potion->use if $potion;
      $onboarding_last_action = time;
    } elsif (number_or_zero($char->{skills}{NV_BASIC}{lv}) < 9
      && number_or_zero($char->{points_skill}) > 0
      && number_or_zero($char->{skills}{NV_BASIC}{up})
      && onboarding_action_ready(0.5)) {
      set_onboarding_phase('academy_basic_skill');
      $messageSender->sendAddSkillPoint(1);
      $onboarding_last_action = time;
    } elsif (number_or_zero($char->{lv_job}) < 10) {
      set_onboarding_phase('academy_training');
      set_onboarding_ai('auto');
    } else {
      if ($onboarding_phase ne 'academy_return') {
        set_onboarding_phase('academy_return');
        set_onboarding_ai('manual');
        AI::clear();
        $onboarding_last_action = 0;
      }
      onboarding_move('iz_ac01', 49, 73, 5);
    }
    return 1;
  }

  if ($map =~ /^(?:prt_fild08|moc_fild11|pay_dun00)$/
    && number_or_zero($char->{jobID}) == 0) {
    my ($training_map, $training_x, $training_y) = @{ job_resume_target() };
    if ($map ne $training_map && number_or_zero($char->{lv}) < 45) {
      set_onboarding_phase('supernovice_relocating');
      set_onboarding_ai('manual');
      onboarding_move($training_map, $training_x, $training_y, 10);
    } else {
      set_onboarding_phase(number_or_zero($char->{lv}) < 45
        ? 'supernovice_training' : 'supernovice_ready');
      configModify('lockMap', $training_map, 1)
        if ($config{lockMap} || '') ne $training_map;
      set_onboarding_ai('auto');
    }
    return 1;
  }

  return 0;
}

sub process_expanded_onboarding_repair {
  return if !$field || !$char || !$char->inventory->isReady();
  my $job_id = number_or_zero($char->{jobID});
  my ($minimum_level, $weapon_id, $ammo_id);
  if ($job_id == 24) {
    ($minimum_level, $weapon_id, $ammo_id) = (10, 13101, 13200);
  } elsif ($job_id == 25) {
    ($minimum_level, $weapon_id, $ammo_id) = (12, 13010, 13250);
  } else {
    return;
  }
  my $weapon = $char->inventory->getByNameID($weapon_id);
  my $ammo = $char->inventory->getByNameID($ammo_id);
  return if !$weapon || !$ammo;
  return if number_or_zero($char->{lv}) >= $minimum_level
    && $weapon->{equipped}
    && $ammo->{equipped};
  return if $expanded_repair_attempts >= 4 || time - $last_expanded_repair < 3;
  $messageSender->sendChat('@terminal_expanded_repair');
  $expanded_repair_attempts++;
  $last_expanded_repair = time;
}

sub process_dialog_cancel {
  return if !$dialog_cancel_until;
  if (!$talk{ID}) {
    $dialog_cancel_until = 0;
    $dialog_cancel_started_at = 0;
    return;
  }
  $dialog_cancel_started_at = time if !$dialog_cancel_started_at;
  if (time - $dialog_cancel_started_at >= 15.0) {
    $dialog_cancel_until = 0;
    $dialog_cancel_started_at = 0;
    fail_job_resume('dialog_timeout') if $job_resume_pending;
    return;
  }
  $dialog_cancel_until = time + 3 if time > $dialog_cancel_until;
  return if time - $last_dialog_cancel < 0.35;
  $messageSender->sendTalkCancel($talk{ID});
  $last_dialog_cancel = time;
}

sub reset_eden_return_kafra {
  $eden_return_kafra_dialog_owned = 0;
  $eden_return_kafra_dialog_seen = 0;
  $eden_return_kafra_dialog_started_at = 0;
  $eden_return_kafra_select_step = 0;
  $eden_return_kafra_choice = 0;
}

sub fail_job_resume {
  my ($reason) = @_;
  AI::clear();
  Commands::run('ai auto');
  $job_resume_pending = 0;
  $job_resume_after = 0;
  $job_resume_started_at = 0;
  $job_resume_dialog_started_at = 0;
  $job_resume_recovery_attempts = 0;
  reset_eden_return_kafra();
  $eden_return_kafra_attempts = 0;
  $eden_error = $reason if $eden_completed;
  append_task_event(
    'error',
    '返回掛機地圖已停止',
    "回程防護已停止重試：$reason。角色已恢復目前地圖的自動操作。",
    $field ? $field->baseName : '',
    join('|', 'job_resume_failed', $reason, int(time))
  );
}

sub eden_exit_step {
  return if !AI::isIdle() || !eden_action_ready(1.5);
  Commands::run('move moc_para01 30 10 0');
  $eden_last_action = time;
}

sub eden_return_kafra_destination {
  my ($map) = @_;
  return 1 if $map eq 'prt_fild05';
  return 2 if $map eq 'prt_fild07';
  return 3 if $map eq 'prt_fild04';
  return 4 if $map =~ /^pay_/;
  return 5 if $map =~ /^(?:moc_|iz_)/;
  return 0;
}

sub process_eden_return_kafra_dialog {
  return 0 if !$eden_return_kafra_dialog_owned;
  if (!$talk{ID}) {
    if ($eden_return_kafra_dialog_seen) {
      reset_eden_return_kafra();
      return 0;
    }
    if (time - $eden_return_kafra_dialog_started_at >= 15.0) {
      reset_eden_return_kafra();
      $eden_return_kafra_attempts++;
      return 0;
    }
    return 1;
  }
  $eden_return_kafra_dialog_seen = 1;
  return 1 if !eden_action_ready(0.35);
  my $stage = $ai_v{'npc_talk'}{'talk'} || '';
  if ($stage eq 'next') {
    $messageSender->sendTalkContinue($talk{ID});
  } elsif ($stage eq 'select' && $talk{responses}) {
    my $choice = $eden_return_kafra_select_step == 0
      ? $eden_return_kafra_choice : 1;
    $messageSender->sendTalkResponse($talk{ID}, $choice);
    $eden_return_kafra_select_step++;
  } elsif ($stage eq 'close') {
    $messageSender->sendTalkCancel($talk{ID});
    reset_eden_return_kafra();
    $eden_return_kafra_attempts++;
  } else {
    return 1;
  }
  $eden_last_action = time;
  return 1;
}

sub eden_return_to_hunt_step {
  return if !AI::isIdle() || !eden_action_ready(1.5);
  my ($target_map) = @{ job_resume_target() };
  my $choice = eden_return_kafra_destination($target_map);
  if (number_or_zero($char->{lv}) <= 40 && $choice) {
    if ($eden_return_kafra_attempts >= 2) {
      fail_job_resume('eden_kafra_failed');
      return;
    }
    my $npc = nearby_npc_at('moc_para01', 35, 23, 5);
    if (!$npc) {
      Commands::run('move moc_para01 35 23 5');
      $eden_last_action = time;
      return;
    }
    $eden_return_kafra_dialog_owned = 1;
    $eden_return_kafra_dialog_seen = 0;
    $eden_return_kafra_dialog_started_at = time;
    $eden_return_kafra_select_step = 0;
    $eden_return_kafra_choice = $choice;
    $messageSender->sendTalk($npc->{ID});
    append_task_event(
      'action',
      '使用伊甸園卡普拉回程',
      '伊甸園總部禁止使用蝴蝶翅膀，正在使用館內免費傳送服務。',
      $target_map,
      join('|', 'eden_return_kafra', $target_map, $eden_return_kafra_attempts + 1)
    );
    $eden_last_action = time;
    return;
  }
  Commands::run('move moc_para01 30 10 0');
  $eden_last_action = time;
}

sub process_job_resume {
  return if !$job_resume_pending || !$field || !$char;
  return if time < $job_resume_after;
  return if !$char->inventory->isReady();
  $job_resume_started_at = time if !$job_resume_started_at;
  if (time - $job_resume_started_at >= 600.0) {
    fail_job_resume('route_timeout');
    return;
  }
  return if process_eden_return_kafra_dialog();
  if ($talk{ID}) {
    $job_resume_dialog_started_at = time if !$job_resume_dialog_started_at;
    if (($ai_v{'npc_talk'}{'talk'} || '') eq 'close'
      || time - $job_resume_dialog_started_at >= 15.0) {
      $dialog_cancel_started_at = time if !$dialog_cancel_started_at;
      $dialog_cancel_until = time + 3 if $dialog_cancel_until < time;
    }
    return;
  }
  $job_resume_dialog_started_at = 0;
  return if process_eden_supply();
  if ($job_resume_pending == 1) {
    Commands::run('ai manual');
    equip_eden_rewards()
      if $eden_completed
        && ($eden_task_id eq 'equipment12' || $eden_task_id eq 'equipment26');
    if ($char->{sitting}) {
      Commands::run('stand');
      $job_resume_pending = 2;
      return;
    }
    $job_resume_pending = 2;
  }
  if ($job_resume_pending == 2) {
    return if $char->{sitting};
    if ($field->baseName eq 'moc_para01') {
      eden_return_to_hunt_step();
    } else {
      my ($map, $x, $y) = @{ job_resume_target() };
      Commands::run("move $map $x $y 10");
    }
    $last_job_resume_retry = time;
    $job_resume_pending = 3;
    return;
  }
  if ($job_resume_pending == 3) {
    my ($map, $x, $y) = @{ job_resume_target() };
    if ($field->baseName eq $map) {
      configModify('lockMap', $map, 1);
      configModify('teleportAuto_idle', 1, 1)
        if number_or_zero($config{teleportAuto_idle}) != 1;
      if ($eden_completed && defined($eden_original_auto_talk)) {
        configModify('autoTalkCont', $eden_original_auto_talk, 1);
      }
      Commands::run('ai auto');
      $job_resume_pending = 0;
      $job_resume_started_at = 0;
      $job_resume_dialog_started_at = 0;
      $job_resume_recovery_attempts = 0;
      reset_eden_return_kafra();
      $eden_return_kafra_attempts = 0;
      set_onboarding_phase('awaiting_map') if $onboarding_completed;
      set_eden_phase('complete') if $eden_completed && $eden_phase eq 'returning_hunt';
      set_eden_phase('equipment_complete')
        if $eden_completed && $eden_phase eq 'equipment_returning_hunt';
      return;
    }
    if (time - $last_position_changed_at >= 10.0
      && time - $last_job_resume_retry >= 8.0) {
      if ($job_resume_recovery_attempts >= 4) {
        fail_job_resume('route_stuck');
        return;
      }
      append_task_event(
        'recovery',
        '重新同步移動狀態',
        '返回掛機地圖時偵測到角色停滯，正在清除舊路線並重新計算。',
        $map,
        join('|', 'job_resume_retry', $field->baseName,
          $job_resume_recovery_attempts + 1, int(time))
      );
      AI::clear();
      if ($field->baseName eq 'moc_para01') {
        eden_return_to_hunt_step();
      } else {
        Commands::run("move $map $x $y 10");
      }
      $job_resume_recovery_attempts++;
      $eden_exit_recovery_attempted++;
      $eden_last_action = time;
      $last_job_resume_retry = time;
      return;
    }
    if (time - $last_job_resume_retry >= 8.0) {
      if ($field->baseName eq 'moc_para01') {
        eden_return_to_hunt_step();
      } else {
        return if !AI::isIdle();
        my ($map, $x, $y) = @{ job_resume_target() };
        Commands::run("move $map $x $y 10");
      }
      $last_job_resume_retry = time;
    }
  }
}

sub process_job_death {
  return if !$char || !$char->{dead};
  return if !$job_route_key && !$job_resume_pending && !$onboarding_active && !$eden_active;
  return if time - $last_job_respawn < 1.5;
  Commands::run('respawn');
  $last_job_respawn = time;
}

sub process_job_route_retry {
  return if !$job_route_key || !$field || !$char || $talk{ID};
  return if $char->{dead};
  return if nearby_job_npc($job_route_key);
  return if !AI::isIdle() || time - $last_job_route_retry < 1.5;
  my ($map, $x, $y) = @{ job_route_target($job_route_key) };
  my $distance = job_route_distance($job_route_key);
  Commands::run("move $map $x $y $distance");
  $last_job_route_retry = time;
}

sub append_social_event {
  my ($type, $sender, $message, $channel, $target) = @_;
  $channel ||= 'public';
  my $path = $ENV{RO_SOCIAL_LOG};
  return if !$path;
  if (open(my $file, '>>:encoding(UTF-8)', $path)) {
    print $file '{"at":' . int(time * 1000)
      . ',"type":' . json_string($type)
      . ',"channel":' . json_string($channel)
      . ',"sender":' . json_string($sender)
      . ',"message":' . json_string($message)
      . ',"target":' . json_string($target || '')
      . ',"map":' . json_string($field ? $field->baseName : '')
      . "}\n";
    close($file);
  }
}

sub record_public_chat {
  my (undef, $args) = @_;
  append_social_event(
    'chat',
    defined($args->{pubMsgUser}) && length($args->{pubMsgUser}) ? $args->{pubMsgUser} : '未知角色',
    defined($args->{pubMsg}) ? $args->{pubMsg} : ''
  );
}

sub record_self_chat {
  my (undef, $args) = @_;
  return if !defined($args->{user}) || !defined($args->{msg});
  append_social_event('chat', $args->{user}, $args->{msg}, 'public');
}

sub record_private_chat {
  my (undef, $args) = @_;
  my $sender = $args->{privMsgUser} || $args->{MsgUser} || '未知角色';
  my $message = defined($args->{privMsg}) ? $args->{privMsg} : ($args->{Msg} || '');
  append_social_event('chat', $sender, $message, 'private', $char ? $char->{name} : '');
}

sub record_sent_private_chat {
  my (undef, $args) = @_;
  return if ($args->{to} || '') =~ /^#/;
  append_social_event('chat', $char->{name}, $args->{msg} || '', 'private', $args->{to} || '');
}

sub record_party_chat {
  my (undef, $args) = @_;
  append_social_event('chat', $args->{MsgUser} || '未知角色', $args->{Msg} || '', 'party');
}

sub record_guild_chat {
  my (undef, $args) = @_;
  append_social_event('chat', $args->{MsgUser} || '未知角色', $args->{Msg} || '', 'guild');
}

sub record_clan_chat {
  my (undef, $args) = @_;
  append_social_event('chat', $args->{MsgUser} || '未知角色', $args->{Msg} || '', 'clan');
}

sub record_battleground_chat {
  my (undef, $args) = @_;
  append_social_event('chat', $args->{name} || '未知角色', $args->{message} || '', 'battleground');
}

sub record_system_chat {
  my (undef, $args) = @_;
  my $message = $args->{Msg} || '';
  my %aliases = (Global => 'global', Map => 'map', Trade => 'trade', Support => 'support', Ally => 'ally');
  if ($message =~ /^\[([^\]]+)\]\s+([^:]+?)\s*:\s*(.*)$/ && $aliases{$1}) {
    append_social_event('chat', $2, $3, $aliases{$1});
  } else {
    append_social_event('system', '系統', $message, 'system');
  }
}

sub record_channel_chat {
  my (undef, $args) = @_;
  my $message = bytesToString($args->{message} || '');
  my %aliases = (Global => 'global', Map => 'map', Trade => 'trade', Support => 'support', Ally => 'ally');
  return if $message !~ /^\[([^\]]+)\]\s+(.+?)\s*:\s*(.*)$/ || !$aliases{$1};
  my ($alias, $sender, $text) = ($1, $2, $3);
  $sender =~ s/\s+\([^)]*\)$//;
  append_social_event('chat', $sender, $text, $aliases{$alias});
}

sub record_emotion {
  my (undef, $args) = @_;
  my $sender;
  if ($char && defined($args->{ID}) && $args->{ID} eq $accountID) {
    $sender = $char->{name};
  } elsif ($playersList && defined($args->{ID})) {
    my $player = $playersList->getByID($args->{ID});
    $sender = $player->name if $player;
  }
  return if !defined($sender);
  append_social_event('emotion', $sender, defined($args->{emotion}) ? $args->{emotion} : '');
}

sub record_social_failure {
  my (undef, $args) = @_;
  return if !$char || number_or_zero($args->{skillID}) != 1 || number_or_zero($args->{btype}) != 1;
  append_social_event('error', $char->{name}, '需要基本技能 Lv.2 才能使用表情');
}

sub process_commands {
  my $command_dir = $ENV{RO_COMMAND_DIR};
  return if !$command_dir || !-d $command_dir || !$char;
  opendir(my $dir, $command_dir) or return;
  my @files = sort grep { /^[a-f0-9-]+\.cmd$/ && -f File::Spec->catfile($command_dir, $_) } readdir($dir);
  closedir($dir);
  foreach my $file (@files) {
    my $path = File::Spec->catfile($command_dir, $file);
    open(my $input, '<:encoding(UTF-8)', $path) or next;
    my $action = <$input> // '';
    my $argument = <$input> // '';
    close($input);
    chomp($action, $argument);
    my $ok = 0;
    my $defer = 0;
    my $message = '無效指令';
    if ($action eq 'social_public') {
      if (!$net || $net->getState() != Network::IN_GAME) {
        $message = '角色目前不在線上';
      } elsif (!length($argument) || length($argument) > 80 || $argument =~ /^[@\/]/ || $argument =~ /[\x{00}-\x{1F}\x{7F}]/) {
        $message = '訊息格式不符';
      } else {
        $messageSender->sendChat($argument);
        $ok = 1;
        $message = '已送出一般頻道訊息';
      }
    } elsif ($action eq 'social_private') {
      my ($target, $text) = split(/\t/, $argument, 2);
      if (!$net || $net->getState() != Network::IN_GAME) {
        $message = '角色目前不在線上';
      } elsif (!$target || !$text) {
        $message = '密語格式不符';
      } else {
        Misc::sendMessage($messageSender, 'pm', $text, $target);
        $ok = 1;
        $message = '已送出密語';
      }
    } elsif ($action eq 'social_party') {
      if (!$char->{party}{joined}) {
        $message = '目前沒有隊伍';
      } else {
        $messageSender->sendPartyChat($argument);
        $ok = 1;
        $message = '已送出隊伍頻道訊息';
      }
    } elsif ($action eq 'social_guild') {
      if (!$char->{guild} || !$char->{guild}{name}) {
        $message = '目前沒有公會';
      } else {
        $messageSender->sendGuildChat($argument);
        $ok = 1;
        $message = '已送出公會頻道訊息';
      }
    } elsif ($action eq 'social_clan') {
      if (!$clan{clan_name}) {
        $message = '目前沒有家族';
      } else {
        $messageSender->sendClanChat($argument);
        $ok = 1;
        $message = '已送出家族頻道訊息';
      }
    } elsif ($action eq 'social_battleground') {
      $messageSender->sendBattlegroundChat($argument);
      $ok = 1;
      $message = '已送出戰場頻道訊息';
    } elsif ($action =~ /^social_(map|global|trade|support|ally)$/) {
      my $channel = '#' . $1;
      if ($1 eq 'ally' && (!$char->{guild} || !$char->{guild}{name})) {
        $message = '目前沒有公會同盟';
      } else {
        $messageSender->sendPrivateMsg($channel, $argument);
        $ok = 1;
        $message = '已送出頻道訊息';
      }
    } elsif ($action eq 'social_emotion') {
      my %allowed = map { $_ => 1 } (0, 1, 2, 3, 4, 5, 7, 9, 10, 12, 14, 15, 16, 17, 20, 21, 23, 26, 28, 29, 30, 33, 36, 45, 46);
      if (!$net || $net->getState() != Network::IN_GAME) {
        $message = '角色目前不在線上';
      } elsif ($argument !~ /^\d+$/ || !$allowed{0 + $argument}) {
        $message = '無效的表情';
      } else {
        $messageSender->sendEmotion(0 + $argument);
        $ok = 1;
        $message = '已送出 RO 表情';
      }
    } elsif ($action eq 'supply_cycle_reload' && $argument eq '1') {
      Commands::run('reload config');
      Commands::run('reload pickupitems');
      Commands::run('reload items_control');
      $ok = 1;
      $message = '回城補給設定已套用';
    } elsif ($action eq 'skill' && $argument =~ /^\d+$/) {
      my ($handle) = grep {
        number_or_zero($char->{skills}{$_}{ID}) == number_or_zero($argument)
      } keys %{ $char->{skills} };
      my $skill = $handle ? $char->{skills}{$handle} : undef;
      if (!$net || $net->getState() != Network::IN_GAME) {
        $defer = 1;
        $message = '等待角色進入遊戲';
      } elsif (!keys %{ $char->{skills} }) {
        $defer = 1;
        $message = '等待技能資料同步';
      } elsif (!$skill || !number_or_zero($skill->{up}) || number_or_zero($char->{points_skill}) < 1) {
        $message = '此技能目前無法提升';
      } else {
        $messageSender->sendAddSkillPoint(number_or_zero($argument));
        $ok = 1;
        $message = '已送出技能配點';
      }
    } elsif ($action eq 'skill_auto_attack') {
      if ($argument eq 'off') {
        clear_skill_automation_slot('attackSkillSlot_0');
        $ok = 1;
        $message = '已關閉自動攻擊技能';
      } elsif ($argument =~ /^([A-Z0-9_]+),(\d+),(\d+),([01]),(\d+),([A-Za-z_+]*),(\d+),(\d+)$/) {
        my ($handle, $requested_level, $minimum_sp, $self_target,
          $zeny_cost, $weapon_types, $ammo_id, $ammo_amount) =
          ($1, $2, $3, $4, $5, $6, $7, $8);
        my $learned = $char->{skills}{$handle};
        my $skill = Skill->new(auto => $handle);
        my $target_type = $skill ? $skill->getTargetType() : undef;
        my $target_valid = $self_target
          ? defined($target_type) && $target_type == Skill::TARGET_SELF()
          : defined($target_type) && $target_type == Skill::TARGET_ENEMY();
        my @required_weapon_types = grep { length($_) } split(/\+/, $weapon_types);
        my $weapon_ok = @required_weapon_types ? 0 : 1;
        if (@required_weapon_types && $char->inventory->isReady()) {
          foreach my $item (@{ $char->inventory }) {
            next if !$item->{equipped};
            my $entry = $itemHandType_lut{$item->{nameID}};
            next if !$entry || !defined($entry->{type});
            if (grep { $_ eq $entry->{type} } @required_weapon_types) {
              $weapon_ok = 1;
              last;
            }
          }
        }
        my $ammo = $ammo_id && $char->inventory->isReady()
          ? $char->inventory->getByNameID($ammo_id) : undef;
        my $ammo_ok = !$ammo_id || ($ammo && $ammo->{equipped}
          && number_or_zero($ammo->{amount}) >= $ammo_amount);
        if (!$learned || number_or_zero($learned->{lv}) < 1 || !$target_valid
          || $minimum_sp > 95 || number_or_zero($char->{zeny}) < $zeny_cost
          || !$weapon_ok || !$ammo_ok) {
          $message = '自動攻擊技能條件不符';
        } else {
          my $level = $requested_level > number_or_zero($learned->{lv})
            ? number_or_zero($learned->{lv}) : $requested_level;
          my $range = number_or_zero($skill->getRange());
          $range = 1 if $range < 1;
          $range = 20 if $range > 20;
          configModify('attackSkillSlot_0', $handle, 1);
          configModify('attackSkillSlot_0_lvl', $level, 1);
          configModify('attackSkillSlot_0_dist', $self_target ? 1 : $range, 1);
          configModify('attackSkillSlot_0_maxDist', $self_target ? 1 : $range, 1);
          configModify('attackSkillSlot_0_isSelfSkill', $self_target, 1);
          configModify('attackSkillSlot_0_sp', $minimum_sp . '..100%', 1);
          configModify('attackSkillSlot_0_zeny',
            $zeny_cost ? '>= ' . $zeny_cost : undef, 1);
          my $weapon_condition = join(', ', @required_weapon_types);
          configModify('attackSkillSlot_0_whenEquip_Right_Hand_Type',
            $weapon_condition || undef, 1);
          configModify('attackSkillSlot_0_inInventoryID',
            $ammo_id ? $ammo_id . ' >= ' . $ammo_amount : undef, 1);
          configModify('attackSkillSlot_0_disabled', 0, 1);
          Commands::run('stand') if $char->{sitting};
          $ok = 1;
          $message = '已啟用自動攻擊技能';
        }
      }
    } elsif ($action eq 'skill_auto_self') {
      if ($argument eq 'off') {
        clear_skill_automation_slot('useSelf_skill_0');
        if ($config{'useSelf_skill_1'}) {
          configModify('useSelf_skill_0', $config{'useSelf_skill_1'}, 1);
          configModify('useSelf_skill_0_disabled', 1, 1);
        }
        $ok = 1;
        $message = '已關閉自動恢復技能';
      } elsif ($argument =~ /^([A-Z0-9_]+),(\d+),(\d+),(\d+)$/) {
        my ($handle, $requested_level, $minimum_sp, $hp_below) = ($1, $2, $3, $4);
        my $learned = $char->{skills}{$handle};
        my $skill = Skill->new(auto => $handle);
        my $target_type = $skill ? $skill->getTargetType() : undef;
        my $target_valid = defined($target_type)
          && ($target_type == Skill::TARGET_SELF() || $target_type == Skill::TARGET_ACTORS());
        if (!$learned || number_or_zero($learned->{lv}) < 1 || !$target_valid
          || $minimum_sp > 95 || $hp_below < 5 || $hp_below > 95) {
          $message = '自動恢復技能條件不符';
        } else {
          my $level = $requested_level > number_or_zero($learned->{lv})
            ? number_or_zero($learned->{lv}) : $requested_level;
          configModify('useSelf_skill_0', $handle, 1);
          configModify('useSelf_skill_0_lvl', $level, 1);
          configModify('useSelf_skill_0_sp', $minimum_sp . '..100%', 1);
          configModify('useSelf_skill_0_hp', '0..' . $hp_below . '%', 1);
          configModify('useSelf_skill_0_timeout', 1, 1);
          configModify('useSelf_skill_0_disabled', 0, 1);
          $ok = 1;
          $message = '已啟用自動恢復技能';
        }
      }
    } elsif ($action eq 'skill_auto_buff') {
      if ($argument eq 'off') {
        clear_skill_automation_slot('useSelf_skill_1');
        clear_skill_automation_slot('useSelf_skill_0')
          if number_or_zero($config{'useSelf_skill_0_disabled'});
        $ok = 1;
        $message = '已關閉自動輔助技能';
      } elsif ($argument =~ /^([A-Z0-9_]+),(\d+),(\d+),(EFST_[A-Z0-9_]+)$/) {
        my ($handle, $requested_level, $minimum_sp, $status) = ($1, $2, $3, $4);
        my %allowed_status = (
          SM_ENDURE => 'EFST_ENDURE',
          AL_ANGELUS => 'EFST_ANGELUS',
          AC_CONCENTRATION => 'EFST_CONCENTRATION',
          MC_LOUD => 'EFST_SHOUT'
        );
        my $learned = $char->{skills}{$handle};
        my $skill = Skill->new(auto => $handle);
        my $target_type = $skill ? $skill->getTargetType() : undef;
        my $target_valid = defined($target_type)
          && $target_type == Skill::TARGET_SELF();
        if (!$learned || number_or_zero($learned->{lv}) < 1) {
          $message = '角色尚未習得自動輔助技能';
        } elsif (!$target_valid) {
          $message = '輔助技能目標類型不符';
        } elsif (!$allowed_status{$handle} || $allowed_status{$handle} ne $status) {
          $message = '輔助技能狀態來源不符';
        } elsif ($minimum_sp > 95) {
          $message = '輔助技能最低 SP 不符';
        } else {
          my $level = $requested_level > number_or_zero($learned->{lv})
            ? number_or_zero($learned->{lv}) : $requested_level;
          if (!$config{'useSelf_skill_0'}) {
            configModify('useSelf_skill_0', $handle, 1);
            configModify('useSelf_skill_0_disabled', 1, 1);
          }
          configModify('useSelf_skill_1', $handle, 1);
          configModify('useSelf_skill_1_lvl', $level, 1);
          configModify('useSelf_skill_1_sp', $minimum_sp . '..100%', 1);
          configModify('useSelf_skill_1_whenStatusInactive', $status, 1);
          configModify('useSelf_skill_1_notWhileSitting', 1, 1);
          configModify('useSelf_skill_1_timeout', 2, 1);
          configModify('useSelf_skill_1_disabled', 0, 1);
          $ok = 1;
          $message = '已啟用自動輔助技能';
        }
      }
    } elsif ($action eq 'eden_join' && $argument eq '1') {
      if (!is_eden_eligible_job($char->{jobID})) {
        $message = '請先完成一轉，再加入伊甸園';
      } elsif (inventory_amount(6219) > 0 || inventory_amount(22508) > 0) {
        $message = '角色已經是伊甸園成員';
      } elsif ($onboarding_active || $eden_active) {
        $message = 'command_rejected';
      } else {
        $messageSender->sendTalkCancel($talk{ID}) if $talk{ID};
        Commands::run('ai manual');
        AI::clear();
        configModify('lockMap', '', 1) if ($config{lockMap} || '') ne '';
        $eden_original_auto_talk = $config{autoTalkCont};
        configModify('autoTalkCont', 0, 1) if number_or_zero($config{autoTalkCont}) != 0;
        $eden_active = 1;
        $eden_completed = 0;
        $eden_task_id = 'member';
        $eden_error = '';
        $eden_phase = '';
        $eden_started_at = time;
        $eden_last_action = 0;
        $eden_dialog_owned = 0;
        $eden_dialog_seen = 0;
        $eden_dialog_phase = '';
        $eden_select_step = 0;
        $eden_text_step = 0;
        $eden_return_started_at = 0;
        $eden_exit_recovery_attempted = 0;
        $eden_training_stage_hint = 0;
        $eden_last_quest_id = 0;
        $eden_target_missing_since = 0;
        $eden_route_stuck_count = 0;
        $eden_npc_failures = 0;
        $eden_supply_active = 0;
        $eden_supply_started_at = 0;
        $job_resume_pending = 0;
        $job_route_key = '';
        set_eden_phase('route_officer');
        $ok = 1;
        $message = '已開始伊甸園入團流程';
      }
    } elsif ($action eq 'eden_equipment12' && $argument =~ /^(0|1|2|3|4|5|11)$/) {
      if ($onboarding_active || $eden_active) {
        $message = 'command_rejected';
      } elsif (number_or_zero($char->{lv}) < 12) {
        $message = 'prerequisite_incomplete';
      } elsif ($argument == 0 && number_or_zero($char->{lv}) >= 20) {
        $message = 'not_available';
      } elsif ($argument >= 12 || eden_equipment_rewards_complete()) {
        $message = 'already_completed';
      } elsif ($char->inventory->size() > 96) {
        $message = 'inventory_full';
      } else {
        $messageSender->sendTalkCancel($talk{ID}) if $talk{ID};
        Commands::run('ai manual');
        AI::clear();
        configModify('lockMap', '', 1) if ($config{lockMap} || '') ne '';
        $eden_original_auto_talk = $config{autoTalkCont};
        $eden_original_items_take_auto = $config{itemsTakeAuto};
        configModify('autoTalkCont', 0, 1)
          if number_or_zero($config{autoTalkCont}) != 0;
        configModify('itemsTakeAuto', 0, 1)
          if number_or_zero($config{itemsTakeAuto}) != 0;
        $eden_active = 1;
        $eden_completed = 0;
        $eden_task_id = 'equipment12';
        $eden_error = '';
        $eden_phase = '';
        $eden_started_at = time;
        $eden_last_action = 0;
        $eden_phase_started_at = 0;
        $eden_dialog_owned = 0;
        $eden_dialog_seen = 0;
        $eden_dialog_phase = '';
        $eden_select_step = 0;
        $eden_text_step = 0;
        $eden_training_stage_hint = number_or_zero($argument);
        $eden_last_quest_id = 0;
        $eden_target_missing_since = 0;
        $eden_route_stuck_count = 0;
        $eden_npc_failures = 0;
        $eden_supply_active = 0;
        $eden_supply_started_at = 0;
        $eden_return_started_at = 0;
        $eden_exit_recovery_attempted = 0;
        $job_resume_pending = 0;
        $job_route_key = '';
        set_eden_phase('route_officer');
        $ok = 1;
        $message = '已開始 Lv.12 伊甸園裝備訓練';
      }
    } elsif ($action eq 'eden_equipment26' && $argument =~ /^(0|13|14|15|16|22)$/) {
      if ($onboarding_active || $eden_active) {
        $message = 'command_rejected';
      } elsif (number_or_zero($char->{lv}) < 26 || number_or_zero($char->{lv}) >= 33) {
        $message = 'not_available';
      } elsif ($argument >= 23) {
        $message = 'already_completed';
      } elsif ($char->inventory->size() > 94) {
        $message = 'inventory_full';
      } else {
        $messageSender->sendTalkCancel($talk{ID}) if $talk{ID};
        Commands::run('ai manual');
        AI::clear();
        configModify('lockMap', '', 1) if ($config{lockMap} || '') ne '';
        $eden_original_auto_talk = $config{autoTalkCont};
        $eden_original_items_take_auto = $config{itemsTakeAuto};
        configModify('autoTalkCont', 0, 1)
          if number_or_zero($config{autoTalkCont}) != 0;
        configModify('itemsTakeAuto', 0, 1)
          if number_or_zero($config{itemsTakeAuto}) != 0;
        $eden_active = 1;
        $eden_completed = 0;
        $eden_task_id = 'equipment26';
        $eden_error = '';
        $eden_started_at = time;
        $eden_last_action = 0;
        $eden_phase_started_at = 0;
        $eden_dialog_owned = 0;
        $eden_dialog_seen = 0;
        $eden_dialog_phase = '';
        $eden_select_step = 0;
        $eden_text_step = 0;
        $eden_training_stage_hint = number_or_zero($argument);
        $eden_last_quest_id = 0;
        $eden_target_missing_since = 0;
        $eden_route_stuck_count = 0;
        $eden_npc_failures = 0;
        $eden_supply_active = 0;
        $eden_supply_started_at = 0;
        $eden_return_started_at = 0;
        $eden_exit_recovery_attempted = 0;
        $job_resume_pending = 0;
        $job_route_key = '';
        set_eden_phase('route_officer');
        $ok = 1;
        $message = '已開始 Lv.26 伊甸園裝備訓練';
      }
    } elsif ($action eq 'onboarding_resume' && $argument eq '1') {
      if (number_or_zero($char->{jobID}) != 0 || $onboarding_completed) {
        $message = '新生訓練已結束';
      } else {
        $messageSender->sendTalkCancel($talk{ID}) if $talk{ID};
        Commands::run('ai manual');
        AI::clear();
        configModify('lockMap', '', 1) if ($config{lockMap} || '') ne '';
        $onboarding_active = 0;
        $onboarding_phase = '';
        $onboarding_started_at = 0;
        $onboarding_last_action = 0;
        $onboarding_ai_mode = '';
        $onboarding_dialog_owned = 0;
        $onboarding_dialog_seen = 0;
        %onboarding_dialog_completed = ();
        $job_resume_pending = 0;
        $job_route_key = '';
        append_task_event(
          'recovery',
          '恢復新生訓練',
          '伺服器正在依官方任務進度返回正確階段。',
          '當前新生任務',
          join('|', 'onboarding_resume', int(time))
        );
        $messageSender->sendChat('@terminal_onboarding_resume');
        $ok = 1;
        $message = '已請求恢復新生訓練';
      }
    } elsif ($action eq 'job_resume' && $argument eq '1') {
      $messageSender->sendTalkCancel($talk{ID}) if $talk{ID};
      if ($talk{ID}) {
        $dialog_cancel_started_at = time;
        $dialog_cancel_until = time + 3;
      }
      Commands::run('ai manual');
      AI::clear();
      configModify('lockMap', '', 1) if ($config{lockMap} || '') ne '';
      configModify('teleportAuto_idle', 0, 1)
        if number_or_zero($config{teleportAuto_idle}) != 0;
      $job_resume_pending = 1;
      $job_resume_after = time + 0.5;
      $last_job_resume_retry = 0;
      $job_resume_started_at = time;
      $job_resume_dialog_started_at = 0;
      $job_resume_recovery_attempts = 0;
      reset_eden_return_kafra();
      $eden_return_kafra_attempts = 0;
      $eden_return_started_at = time;
      $ok = 1;
      $message = '已開始前往等級推薦掛機地圖';
    } elsif ($action eq 'job_route' && $job_routes{$argument}) {
      my ($map, $x, $y) = @{ job_route_target($argument) };
      my $distance = job_route_distance($argument);
      Commands::run('ai manual');
      Commands::run("move $map $x $y $distance");
      $dialog_cancel_until = 0;
      $job_resume_pending = 0;
      $job_resume_after = 0;
      $last_job_route_retry = time;
      $job_route_key = $argument;
      $ok = 1;
      $message = '已開始前往轉職 NPC';
    } elsif ($action eq 'job_talk' && $job_routes{$argument}) {
      my $npc = nearby_job_npc($argument);
      if (!$npc) {
        $message = '尚未抵達轉職 NPC';
      } else {
        Commands::run('talk ' . number_or_zero($npc->{binID}));
        $dialog_cancel_until = 0;
        $job_route_key = $argument;
        $ok = 1;
        $message = '已開啟 NPC 對話';
      }
    } elsif ($action eq 'npc_next' && ($ai_v{'npc_talk'}{'talk'} || '') eq 'next' && $talk{ID}) {
      $messageSender->sendTalkContinue($talk{ID});
      $ok = 1;
      $message = '已繼續 NPC 對話';
    } elsif ($action eq 'npc_select' && $argument =~ /^\d+$/ && $talk{ID} && $talk{responses}
      && number_or_zero($argument) >= 1 && number_or_zero($argument) <= scalar @{ $talk{responses} }) {
      $messageSender->sendTalkResponse($talk{ID}, number_or_zero($argument));
      $ok = 1;
      $message = '已送出 NPC 選項';
    } elsif ($action eq 'npc_close' && $talk{ID}) {
      $messageSender->sendTalkCancel($talk{ID});
      $dialog_cancel_until = time + 3;
      $ok = 1;
      $message = '已關閉 NPC 對話';
    } elsif ($action eq 'test_onboarding_accelerate' && $argument eq '10') {
      my $username = $config{username} || '';
      my $job_level = number_or_zero($char->{lv_job});
      if ($username !~ /^jobtest_ob_/i || number_or_zero($char->{jobID}) != 0
        || $onboarding_phase ne 'academy_training' || $job_level < 5 || $job_level >= 10) {
        $message = '測試加速條件不符';
      } else {
        $messageSender->sendChat('@jlvl +' . (10 - $job_level));
        append_task_event('action', '測試流程加速', '已確認自然狩獵與經驗取得，測試角色使用伺服器管理指令補至 Job Lv.10。', '',
          join('|', 'test_accelerate', $job_level));
        $ok = 1;
        $message = '已送出測試角色 Job 等級加速';
      }
    } elsif ($action eq 'stat' && $argument =~ /^(str|agi|vit|int|dex|luk)$/) {
      Commands::run("st add $argument");
      $ok = 1;
      $message = '已送出能力配點指令';
    } elsif ($action eq 'reset_stats' && $argument eq '1') {
      $messageSender->sendChat('@resetstat');
      $ok = 1;
      $message = '已送出能力重置指令';
    } elsif ($action eq 'card' && $argument =~ /^(id:[a-f0-9]+|\d+),(id:[a-f0-9]+|\d+)$/i) {
      my $card = inventory_item_from_argument($1);
      my $target = inventory_item_from_argument($2);
      if (!$card || !$target || !$card->mergeable || !$target->equippable) {
        $message = '卡片或裝備狀態不符';
      } else {
        $messageSender->sendCardMerge($card->{ID}, $target->{ID});
        $ok = 1;
        $message = '已送出卡片插入指令';
      }
    } else {
      my $item = inventory_item_from_argument($argument);
      if (!$item) {
      $message = '道具已不存在';
      } elsif ($action eq 'use' && $item->usable) {
        $item->use;
        $ok = 1;
        $message = '已送出使用指令';
      } elsif ($action eq 'equip' && $item->equippable && !$item->{equipped}) {
        $item->equip;
        $ok = 1;
        $message = '已送出裝備指令';
      } elsif ($action eq 'unequip' && $item->{equipped}) {
        $item->unequip;
        $ok = 1;
        $message = '已送出卸下指令';
      } else {
        $message = '道具狀態不允許此操作';
      }
    }
    next if $defer;
    if (!$ok && $action =~ /^social_(.+)$/) {
      my $channel = $1 eq 'emotion' ? 'public' : $1;
      append_social_event('error', $char->{name}, $message, $channel);
    }
    my $result_path = $path;
    $result_path =~ s/\.cmd$/.result/;
    if (open(my $result, '>:encoding(UTF-8)', $result_path)) {
      print $result '{"ok":' . ($ok ? 'true' : 'false')
        . ',"action":' . json_string($action)
        . ',"message":' . json_string($message) . '}';
      close($result);
    }
    unlink($path);
  }
}

sub export_status {
  return if !$char;
  recover_interrupted_supply();
  update_task_position();
  process_stuck_recovery();
  process_dialog_cancel();
  process_commands();
  process_archer_onboarding_repair();
  process_expanded_onboarding_repair();
  process_job_death();
  my $onboarding_handled = process_onboarding();
  my $eden_handled = $onboarding_handled ? 0 : process_eden();
  if (!$onboarding_handled && !$eden_handled) {
    process_job_route_retry();
    process_job_resume();
  }
  my $now = time;
  return if $now - $last_write < 0.15;
  $last_write = $now;
  my %snapshot = (
    updatedAt => int($now * 1000),
    jobId => number_or_zero($char->{jobID}),
    baseLevel => number_or_zero($char->{lv}), jobLevel => number_or_zero($char->{lv_job}),
    baseExp => number_or_zero($char->{exp}), jobExp => number_or_zero($char->{exp_job}),
    zeny => number_or_zero($char->{zeny}),
    hairStyle => number_or_zero($char->{hair_style}), hairColor => number_or_zero($char->{hair_color}),
    str => number_or_zero($char->{str}), agi => number_or_zero($char->{agi}), vit => number_or_zero($char->{vit}),
    int => number_or_zero($char->{int}), dex => number_or_zero($char->{dex}), luk => number_or_zero($char->{luk}),
    statusPoint => number_or_zero($char->{points_free}), skillPoint => number_or_zero($char->{points_skill}),
    basicSkillLevel => number_or_zero($char->{skills}{NV_BASIC}{lv}),
    basicSkillUpgradable => number_or_zero($char->{skills}{NV_BASIC}{up}),
    attack => number_or_zero($char->{attack}), attackBonus => number_or_zero($char->{attack_bonus}),
    matkMin => number_or_zero($char->{attack_magic_min}), matkMax => number_or_zero($char->{attack_magic_max}),
    def => number_or_zero($char->{def}), defBonus => number_or_zero($char->{def_bonus}),
    mdef => number_or_zero($char->{def_magic}), mdefBonus => number_or_zero($char->{def_magic_bonus}),
    hit => number_or_zero($char->{hit}), flee => number_or_zero($char->{flee}), fleeBonus => number_or_zero($char->{flee_bonus}),
    critical => number_or_zero($char->{critical}), aspd => number_or_zero($char->{attack_speed}),
    strBonus => number_or_zero($char->{str_bonus}), agiBonus => number_or_zero($char->{agi_bonus}), vitBonus => number_or_zero($char->{vit_bonus}),
    intBonus => number_or_zero($char->{int_bonus}), dexBonus => number_or_zero($char->{dex_bonus}), lukBonus => number_or_zero($char->{luk_bonus}),
    weight => number_or_zero($char->{weight}), maxWeight => number_or_zero($char->{weight_max}),
    baseExpMax => number_or_zero($char->{exp_max}), jobExpMax => number_or_zero($char->{exp_job_max}),
    hp => number_or_zero($char->{hp}), maxHp => number_or_zero($char->{hp_max}),
    sp => number_or_zero($char->{sp}), maxSp => number_or_zero($char->{sp_max})
  );
  my $char_pos = calcPosition($char);
  my @monsters = $monstersList ? map {
    actor_json($_, ($_->{dmgFromYou} || $_->{dmgToYou} || $_->{missedFromYou} || $_->{missedYou}) ? 1 : 0)
  } @{ $monstersList->getItems } : ();
  my @players = $playersList ? map { actor_json($_, 0) } @{ $playersList->getItems } : ();
  my @inventory = $char->inventory->isReady() ? map { inventory_json($_) } @{ $char->inventory } : ();
  my @skills = map {
    my $handle = $_;
    my $skill = $char->{skills}{$handle};
    '{"id":' . number_or_zero($skill->{ID})
      . ',"handle":' . json_string($handle)
      . ',"level":' . number_or_zero($skill->{lv})
      . ',"upgradable":' . number_or_zero($skill->{up})
      . ',"sp":' . number_or_zero($skill->{sp}) . '}'
  } sort keys %{ $char->{skills} };
  my @npc_responses = $talk{responses} ? map { json_string($_) } @{ $talk{responses} } : ();
  my @task_event_json = map { task_event_json($_) } @task_events;
  my @quest_missions;
  if ($questList) {
    foreach my $quest_id (sort { $a <=> $b } keys %{$questList}) {
      my $missions = $questList->{$quest_id}{missions};
      next if !$missions;
      foreach my $mission_id (sort { $a <=> $b } keys %{$missions}) {
        my $mission = $missions->{$mission_id};
        push @quest_missions, '{"questId":' . number_or_zero($quest_id)
          . ',"mobId":' . number_or_zero($mission->{mob_id})
          . ',"mobName":' . json_string($mission->{mob_name} || $mission->{mob_name_original} || '')
          . ',"count":' . number_or_zero($mission->{mob_count})
          . ',"goal":' . number_or_zero($mission->{mob_goal}) . '}';
      }
    }
  }
  my $npc_stage = $ai_v{'npc_talk'}{'talk'} || '';
  my $job_route_json = 'null';
  if ($job_route_key && $job_routes{$job_route_key}) {
    my ($route_map, $route_x, $route_y) = @{ $job_routes{$job_route_key} };
    my $route_pos = calcPosition($char);
    my $arrived = $field && $field->baseName eq $route_map
      && abs($route_pos->{x} - $route_x) <= 6
      && abs($route_pos->{y} - $route_y) <= 6;
    $job_route_json = '{"job":' . json_string($job_route_key)
      . ',"map":' . json_string($route_map)
      . ',"x":' . $route_x . ',"y":' . $route_y
      . ',"arrived":' . ($arrived ? 'true' : 'false') . '}';
  }
  my @control_folders = Settings::getControlFolders();
  return if !@control_folders;
  my $snapshot_path = $ENV{RO_STATUS_SNAPSHOT} || File::Spec->catfile($control_folders[0], '..', 'status.json');
  if (open(my $file, '>:encoding(UTF-8)', $snapshot_path)) {
    my @pairs = map { '"' . $_ . '":' . number_or_zero($snapshot{$_}) } sort keys %snapshot;
    print $file '{' . join(',', @pairs)
      . ',"name":' . json_string($char->{name})
      . ',"map":' . json_string($field ? $field->baseName : '')
      . ',"mapWidth":' . number_or_zero($field ? $field->width : 0)
      . ',"mapHeight":' . number_or_zero($field ? $field->height : 0)
      . ',"playerX":' . number_or_zero($char_pos->{x})
      . ',"playerY":' . number_or_zero($char_pos->{y})
      . ',"monsters":[' . join(',', @monsters) . ']'
      . ',"players":[' . join(',', @players) . ']'
      . ',"inventory":[' . join(',', @inventory) . ']'
      . ',"skills":[' . join(',', @skills) . ']'
      . ',"skillAutomation":{"attack":' . skill_automation_json('attackSkillSlot_0', 'attack')
      . ',"self":' . skill_automation_json('useSelf_skill_0', 'selfRecovery')
      . ',"buff":' . skill_automation_json('useSelf_skill_1', 'selfBuff') . '}'
      . ',"supplyCycle":{"enabled":' . (($config{storageAuto} || $config{sellAuto}) ? 'true' : 'false')
      . ',"returnWeight":' . number_or_zero($config{itemsMaxWeight_sellOrStore})
      . ',"storage":' . ($config{storageAuto} ? 'true' : 'false')
      . ',"sell":' . ($config{sellAuto} ? 'true' : 'false')
      . ',"buy":' . (($config{buyAuto_0} && !$config{buyAuto_0_disabled}) ? 'true' : 'false')
      . ',"stage":' . json_string(AI::action() || '') . '}'
      . ',"taskEvents":[' . join(',', @task_event_json) . ']'
      . ',"questMissions":[' . join(',', @quest_missions) . ']'
      . ',"edenJourney":{"active":' . ($eden_active ? 'true' : 'false')
      . ',"completed":' . ($eden_completed ? 'true' : 'false')
      . ',"taskId":' . json_string($eden_task_id)
      . ',"phase":' . json_string($eden_phase)
      . ',"error":' . json_string($eden_error)
      . ',"resumePending":' . number_or_zero($job_resume_pending)
      . ',"sitting":' . ($char->{sitting} ? 'true' : 'false')
      . ',"member":' . ((inventory_amount(6219) > 0 || inventory_amount(22508) > 0) ? 'true' : 'false') . '}'
      . ',"jobRoute":' . $job_route_json
      . ',"onboarding":{"active":' . ($onboarding_active ? 'true' : 'false')
      . ',"completed":' . ($onboarding_completed ? 'true' : 'false')
      . ',"phase":' . json_string($onboarding_phase)
      . ',"questStates":{"21001":' . quest_state(21001)
      . ',"7471":' . quest_state(7471)
      . ',"21008":' . quest_state(21008)
      . ',"7472":' . quest_state(7472)
      . ',"7473":' . quest_state(7473)
      . ',"4269":' . quest_state(4269)
      . ',"2293":' . quest_state(2293)
      . ',"7128":' . quest_state(7128)
      . ',"7129":' . quest_state(7129)
      . ',"7130":' . quest_state(7130)
      . ',"7131":' . quest_state(7131)
      . ',"7132":' . quest_state(7132) . '}}'
      . ',"npcDialog":{"active":' . ($npc_stage ? 'true' : 'false')
      . ',"stage":' . json_string($npc_stage)
      . ',"name":' . json_string($talk{name} || '')
      . ',"message":' . json_string($talk{msg} || '')
      . ',"responses":[' . join(',', @npc_responses) . ']}'
      . '}';
    close($file);
  }
}

1;
