import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [index, app, styles] = await Promise.all([
  readFile('ops/ro-stack/dashboard/index.html', 'utf8'),
  readFile('ops/ro-stack/dashboard/app.js', 'utf8'),
  readFile('ops/ro-stack/dashboard/styles.css', 'utf8'),
]);

assert.doesNotMatch(index, /你不在的這段時間/);
assert.doesNotMatch(index, /id="persistentLifeWindow"/);
assert.doesNotMatch(styles, /\.persistent-life-window|\.persistent-life-(body|highlights|timeline|actions)/);
assert.match(app, /persistent-life\/latest/);
assert.match(app, /persistentLifeWindow/);
assert.match(app, /persistentLifeTimelineToggle'\)\?\.addEventListener/);
assert.match(app, /persistentLifeDismiss'\)\?\.addEventListener/);

console.log('PERSISTENT_LIFE_DIARY_SURFACE_REMOVED_PASS');
