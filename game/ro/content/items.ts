import { rAthenaSource } from '../source';

export const APPLE_SOURCE = rAthenaSource(
  'db/re/item_db_usable.yml',
  'Id: 512',
);

export const APPLE_RENEWAL = Object.freeze({
  id: 512,
  aegisName: 'Apple',
  name: 'Apple',
  type: 'Healing',
  weight: 20,
  healMinimum: 16,
  healMaximum: 22,
});

export const FLY_WING_RENEWAL = Object.freeze({
  id: 601,
  aegisName: 'Wing_Of_Fly',
  name: 'Fly Wing',
  type: 'DelayConsume',
  weight: 50,
  skill: 'AL_TELEPORT',
  skillLevel: 1,
  source: rAthenaSource('db/re/item_db_usable.yml', 'Id: 601'),
});

export const NOVICE_MAX_WEIGHT = 20_000;
export const RENEWAL_NATURAL_HEAL_WEIGHT_PERCENT = 70;
export const MAJOR_OVERWEIGHT_PERCENT = 90;
export const OPENKORE_ITEMS_MAX_WEIGHT_PERCENT = 89;

export const RO_ITEM_WEIGHTS: Readonly<Record<string, number>> = Object.freeze({
  Jellopy: 10,
  Knife_: 400,
  Sticky_Mucus: 10,
  Apple: 20,
  Wing_Of_Fly: 50,
  Unripe_Apple: 50,
  Poring_Card: 10,
  Clover: 10,
  Feather: 10,
  Pierrot_Nose: 100,
  Sword_: 500,
  Carrot: 20,
  Rainbow_Carrot: 50,
  Lunatic_Card: 10,
  Fluff: 10,
  Club_: 700,
  Green_Herb: 30,
  Club: 700,
  Fabre_Card: 10,
  Phracon: 200,
  Chrysalis: 10,
  Guard_: 300,
  Shell: 10,
  Iron_Ore: 150,
  Pupa_Card: 10,
  Red_Herb: 30,
  Novice_Poring_Card: 10,
});

export function roItemWeight(aegisName: string) {
  return RO_ITEM_WEIGHTS[aegisName] ?? 0;
}
