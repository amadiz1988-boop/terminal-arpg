import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { gzipSync } from 'node:zlib';

const repo = process.cwd();
const client =
  process.env.RO_CLIENT_DIR ??
  'C:\\Program Files (x86)\\Gravity\\RagnarokOnline';
const grfcl =
  process.env.GRFCL_EXE ??
  'C:\\Users\\Administrator\\AppData\\Local\\Temp\\GrfCL-v1.9.1.2\\GrfCL\\GrfCL.exe';
const maps = process.argv.slice(2);
const fieldRoot = join(repo, '.local', 'ro-stack', 'openkore', 'fields');
const tileTypes = [1, 0, 4, 5, 6, 10, 8];
const clientMapAliases = new Map([
  // Locked OpenKore tRO resnametable maps the server name to this GRF name.
  ['new_1-3', 'new_zone03'],
]);

if (!maps.length) throw new Error('請指定要同步的地圖名稱');
if (!existsSync(join(client, 'data0.grf')))
  throw new Error(`找不到官方客戶端 data0.grf：${client}`);
if (!existsSync(grfcl)) throw new Error(`找不到 GrfCL：${grfcl}`);

const walk = (root) =>
  readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });

function convert(gatPath, rswPath) {
  const gat = readFileSync(gatPath);
  const rsw = readFileSync(rswPath);
  const width = gat.readUInt32LE(6);
  const height = gat.readUInt32LE(10);
  const expected = 14 + width * height * 20;
  if (gat.length < expected)
    throw new Error(`${basename(gatPath)} 資料長度不足`);
  if (width > 65535 || height > 65535)
    throw new Error(`${basename(gatPath)} 尺寸超出 FLD2 上限`);

  const waterLevel = rsw.readFloatLE(166);
  const output = Buffer.allocUnsafe(4 + width * height);
  output.writeUInt16LE(width, 0);
  output.writeUInt16LE(height, 2);
  for (let index = 0; index < width * height; index += 1) {
    const offset = 14 + index * 20;
    const type = gat[offset + 16];
    const averageDepth =
      (gat.readFloatLE(offset) +
        gat.readFloatLE(offset + 4) +
        gat.readFloatLE(offset + 8) +
        gat.readFloatLE(offset + 12)) /
      4;
    let flags = tileTypes[type] ?? 0;
    if (averageDepth > waterLevel && (flags & 4) !== 4) flags |= 4;
    output[4 + index] = flags;
  }
  return { output, width, height };
}

const work = mkdtempSync(join(tmpdir(), 'ro-openkore-fields-'));
try {
  for (const map of maps) {
    const clientMap = clientMapAliases.get(map) ?? map;
    const extractRoot = join(work, clientMap);
    mkdirSync(extractRoot, { recursive: true });
    execFileSync(
      grfcl,
      [
        '-breakOnExceptions',
        'true',
        '-open',
        join(client, 'data0.grf'),
        '-extractFiles',
        `*${clientMap}*`,
        extractRoot,
      ],
      { stdio: 'inherit' },
    );
    const files = walk(extractRoot);
    const gat = files.find(
      (path) =>
        basename(path).toLowerCase() === `${clientMap}.gat`.toLowerCase(),
    );
    const rsw = files.find(
      (path) =>
        basename(path).toLowerCase() === `${clientMap}.rsw`.toLowerCase(),
    );
    if (!gat || !rsw) throw new Error(`官方客戶端缺少 ${map}.gat/.rsw`);

    const { output, width, height } = convert(gat, rsw);
    writeFileSync(join(fieldRoot, `${map}.fld2.gz`), gzipSync(output));
    for (const suffix of ['dist', 'weight']) {
      const derived = join(fieldRoot, `${map}.${suffix}`);
      if (existsSync(derived)) unlinkSync(derived);
    }
    console.log(`已同步 ${map}：${width} × ${height}`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
