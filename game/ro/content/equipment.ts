export type EquipmentDefinition = Readonly<{
  aegisName: 'Knife_' | 'Sword_' | 'Club' | 'Club_' | 'Guard_';
  slot: 'rightHand' | 'leftHand';
  attack: number;
  defense: number;
  slots: number;
  equipLevelMin: number;
  weight: number;
}>;

export const EQUIPMENT: Readonly<Record<string, EquipmentDefinition>> =
  Object.freeze({
    Knife_: {
      aegisName: 'Knife_',
      slot: 'rightHand',
      attack: 17,
      defense: 0,
      slots: 4,
      equipLevelMin: 1,
      weight: 400,
    },
    Sword_: {
      aegisName: 'Sword_',
      slot: 'rightHand',
      attack: 25,
      defense: 0,
      slots: 4,
      equipLevelMin: 2,
      weight: 500,
    },
    Club: {
      aegisName: 'Club',
      slot: 'rightHand',
      attack: 23,
      defense: 0,
      slots: 3,
      equipLevelMin: 2,
      weight: 700,
    },
    Club_: {
      aegisName: 'Club_',
      slot: 'rightHand',
      attack: 23,
      defense: 0,
      slots: 4,
      equipLevelMin: 2,
      weight: 700,
    },
    Guard_: {
      aegisName: 'Guard_',
      slot: 'leftHand',
      attack: 0,
      defense: 20,
      slots: 1,
      equipLevelMin: 1,
      weight: 300,
    },
  });
