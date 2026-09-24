import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webPath} from '../web-complete-manifest.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('../../../docs/project-control/web-runtime-assets-manifest-v1.json',import.meta.url)));
assert.ok(manifest.assets.length>0);
for(const asset of manifest.assets)assert.equal(webPath(asset.relative_path),asset.relative_path);
console.log(`PASS all ${manifest.assets.length} pinned private asset paths fit the independent Web policy`);
console.log('WEB_PRIVATE_PATH_POLICY_TEST_COUNT=1');
