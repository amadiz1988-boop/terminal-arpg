import { env } from 'cloudflare:workers';

export function getDatabase() {
  if (!env.DB) throw new Error('Cloudflare D1 binding DB is unavailable');
  return env.DB;
}
