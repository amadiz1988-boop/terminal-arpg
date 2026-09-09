import { rAthenaSource } from '../source';

export const APPLE_SOURCE = rAthenaSource('db/re/item_db_usable.yml', 'Id: 512');

export const APPLE_RENEWAL = Object.freeze({
  id: 512,
  aegisName: 'Apple',
  name: 'Apple',
  type: 'Healing',
  weight: 20,
  healMinimum: 16,
  healMaximum: 22,
});
