export type CampaignOperation = {
  id: string;
  title: string;
  briefing: string;
  lesson: string;
  reward: string;
};

export const CAMPAIGN: CampaignOperation[] = [
  { id: 'boot', title: '00／啟動程序', briefing: '廢棄終端偵測到生命訊號。以手上的磨損短弓清除入口。', lesson: '完成第一次手動戰鬥', reward: '鑑定第一件護甲' },
  { id: 'relay', title: '01／失聯中繼站', briefing: '中繼站仍在廣播錯誤座標。替換裝備後重新校準火力。', lesson: '比較裝備提升並親手換裝', reward: '稀有武器選擇' },
  { id: 'signal', title: '02／分裂訊號', briefing: '技能核心出現兩條演化路徑。選擇連鎖清圖或重擊生存。', lesson: '選擇第一個技能分支', reward: '解鎖選定技能' },
  { id: 'supply', title: '03／補給路線', briefing: '重複清理補給線，建立第一條自動作戰規則。', lesson: '理解連續執行與自動分解', reward: '分解材料與自動化權限' },
  { id: 'trace', title: '04／獵人追跡', briefing: '維拉隊長持有藍圖需要的核心增幅器。鎖定她的巡邏區。', lesson: '依 Build 藍圖追蹤指定來源', reward: '流派核心詞綴裝備' },
  { id: 'breach', title: '05／首次裂口', briefing: '檢查裝備與技能，擊破守門者並建立第一個地圖座標。', lesson: '完成可刷圖的入門 Build', reward: 'T1 地圖 ×6、Atlas 權限' },
];
