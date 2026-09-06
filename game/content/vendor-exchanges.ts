import type { CurrencyId } from '../core/types';

export type VendorExchange={
  id:string;costId:CurrencyId;costAmount:number;rewardId:CurrencyId;rewardAmount:1;
  firstAct:string;vendor:string;sourceGame:'Path of Exile';sourceUrl:string;
  sourceVersion:string;verifiedAt:string;sourceStatus:'verified';implementationNotes:string;
};

const SOURCE={
  sourceGame:'Path of Exile' as const,
  sourceUrl:'https://poedb.tw/tw/Vendor_recipe_system',
  sourceVersion:'PoEDB current vendor table',
  verifiedAt:'2026-09-06',
  sourceStatus:'verified' as const,
  implementationNotes:'比例完全沿用 PoEDB「直接從商店買」表；本作完成序章後集中於通貨商人介面。',
};

export const VENDOR_EXCHANGES:VendorExchange[]=[
  {id:'portal-for-wisdom',costId:'wisdom',costAmount:3,rewardId:'portal',rewardAmount:1,firstAct:'章節 1',vendor:'奈莎',...SOURCE},
  {id:'transmutation-for-portal',costId:'portal',costAmount:7,rewardId:'transmutation',rewardAmount:1,firstAct:'章節 1',vendor:'奈莎',...SOURCE},
  {id:'augmentation-for-transmutation',costId:'transmutation',costAmount:4,rewardId:'augmentation',rewardAmount:1,firstAct:'章節 1',vendor:'奈莎',...SOURCE},
  {id:'alteration-for-augmentation',costId:'augmentation',costAmount:4,rewardId:'alteration',rewardAmount:1,firstAct:'章節 1',vendor:'奈莎',...SOURCE},
  {id:'jeweller-for-alteration',costId:'alteration',costAmount:2,rewardId:'jeweller',rewardAmount:1,firstAct:'章節 2',vendor:'伊娜',...SOURCE},
  {id:'chromatic-for-jeweller',costId:'jeweller',costAmount:3,rewardId:'chromatic',rewardAmount:1,firstAct:'章節 2',vendor:'伊娜',...SOURCE},
  {id:'fusing-for-jeweller',costId:'jeweller',costAmount:4,rewardId:'fusing',rewardAmount:1,firstAct:'章節 2',vendor:'伊娜',...SOURCE},
  {id:'chance-for-fusing',costId:'fusing',costAmount:1,rewardId:'chance',rewardAmount:1,firstAct:'章節 3',vendor:'卡爾麗莎',...SOURCE},
  {id:'scouring-for-chance',costId:'chance',costAmount:4,rewardId:'scouring',rewardAmount:1,firstAct:'章節 2',vendor:'伊娜',...SOURCE},
  {id:'regret-for-scouring',costId:'scouring',costAmount:2,rewardId:'regret',rewardAmount:1,firstAct:'章節 2',vendor:'伊娜',...SOURCE},
  {id:'alchemy-for-regret',costId:'regret',costAmount:1,rewardId:'alchemy',rewardAmount:1,firstAct:'章節 3',vendor:'卡爾麗莎',...SOURCE},
  {id:'whetstone-for-armourer',costId:'armourer',costAmount:3,rewardId:'whetstone',rewardAmount:1,firstAct:'章節 3',vendor:'古斯特',...SOURCE},
  {id:'armourer-for-whetstone',costId:'whetstone',costAmount:1,rewardId:'armourer',rewardAmount:1,firstAct:'章節 1',vendor:'塔格拉',...SOURCE},
  {id:'unmaking-for-regret',costId:'regret',costAmount:2,rewardId:'unmaking',rewardAmount:1,firstAct:'輿圖',vendor:'基拉克',...SOURCE},
];
