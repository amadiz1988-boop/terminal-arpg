export const RO_CLIENT_ASSETS = Object.freeze({
  bgm: {
    prontera: '/ro/client/bgm/prontera.mp3',
  },
  paperdoll: {
    noviceMale: '/ro/client/paperdoll/novice-male.png',
    noviceFemale: '/ro/client/paperdoll/novice-female.png',
  },
  itemIcon(aegisName: string) {
    return `/ro/client/items/${aegisName}.png`;
  },
});
