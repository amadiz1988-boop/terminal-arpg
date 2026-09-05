export type CampaignOperation = {
  id: string;
  title: string;
  briefing: string;
  lesson: string;
  reward: string;
};

export const CAMPAIGN: CampaignOperation[] = [
  { id: 'boot', title: '00／啟動程序', briefing: '廢棄終端偵測到生命訊號。使用初心武器與技能清除入口。', lesson: '觀察逐擊傷害、HP、MP 與經驗', reward: '第一件護甲與氣勢輔助' },
  { id: 'relay', title: '01／失聯中繼站', briefing: '中繼站仍在廣播錯誤座標。取得二連武器後重新校準火力。', lesson: '從背包比較詞綴與實際提升', reward: '二連稀有武器與迴響輔助' },
  { id: 'signal', title: '02／分裂訊號', briefing: '技能核心開始回應輔助寶石。洞色與連線決定效果是否生效。', lesson: '辨認紅、綠、藍洞與技能連線', reward: '集中效應輔助' },
  { id: 'supply', title: '03／補給路線', briefing: '重複清理補給線，建立第一條自動作戰規則。', lesson: '用護體補足高風險內容的生存需求', reward: '護體輔助、材料與自動化權限' },
  { id: 'trace', title: '04／獵人追跡', briefing: '維拉隊長持有藍圖需要的核心增幅器。鎖定她的巡邏區。', lesson: '依 Build 藍圖追蹤指定來源', reward: '流派核心詞綴裝備' },
  { id: 'breach', title: '05／首次裂口', briefing: '檢查裝備與技能，擊破守門者並建立第一個地圖座標。', lesson: '完成可刷圖的入門 Build', reward: '無限 T1、T2 地圖 ×2、Atlas 權限' },
];
