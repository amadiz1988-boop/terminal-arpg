import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

const repo = process.cwd();
const client =
  process.env.RO_CLIENT_DIR ??
  'C:\\Program Files (x86)\\Gravity\\RagnarokOnline';
const grfLibraryDir =
  process.env.GRF_LIBRARY_DIR ??
  join(
    process.env.LOCALAPPDATA ?? 'C:\\Users\\Administrator\\AppData\\Local',
    'Temp',
    'GRFEditor-src',
    'GrfCL',
    'Files',
  );
const extractor = join(repo, 'scripts', 'extract-ro-original-minimaps.ps1');
const converter = join(repo, 'scripts', 'convert-ro-original-minimaps.ps1');
const releaseRegistryPath = join(
  repo,
  'ops',
  'ro-stack',
  'persistent-agent',
  'standard-farm-map-release-registry.json',
);
const outputRoot = join(repo, 'public', 'ro', 'client', 'minimaps');
const manifestPath = join(outputRoot, 'manifest.json');
const mapIndexPath = join(repo, 'docs', 'ro-asset-index', 'maps.json');
const clientExe = join(client, 'Ragnarok.exe');
const archiveNames = ['data.grf', 'data0.grf', 'event.grf'];
const acceptanceMaps = ['prontera', 'prt_fild05', 'prt_fild08', 'pay_dun00'];

const hashBytes = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');
const hashFile = (path) => hashBytes(readFileSync(path));

function requireFile(path, label) {
  if (!existsSync(path)) throw new Error(`${label} not found: ${path}`);
}

requireFile(clientExe, 'RO client executable');
requireFile(join(grfLibraryDir, 'GRF.dll'), 'GRF.dll');
requireFile(extractor, 'minimap extractor');
requireFile(converter, 'minimap converter');
requireFile(releaseRegistryPath, 'standard farm release registry');
for (const name of archiveNames) requireFile(join(client, name), name);

const releaseRegistry = JSON.parse(readFileSync(releaseRegistryPath, 'utf8'));
const standardMaps = releaseRegistry.maps
  .filter(
    (entry) =>
      entry.farmSelectionAvailable === true &&
      entry.availabilityReason === 'STANDARD_ROUTE_READY',
  )
  .map((entry) => entry.map);
const specialTransportMaps = (releaseRegistry.specialTransportBacklog ?? [])
  .map((entry) => entry.MAP)
  .filter(Boolean);
const requestedMaps = [
  ...new Set([...standardMaps, ...specialTransportMaps, ...acceptanceMaps]),
].sort();

if (standardMaps.length !== 136)
  throw new Error(
    `Expected 136 standard release maps, received ${standardMaps.length}`,
  );
if (specialTransportMaps.length !== 24)
  throw new Error(
    `Expected 24 special transport maps, received ${specialTransportMaps.length}`,
  );

mkdirSync(outputRoot, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'ro-original-minimaps-'));
const extractedByMap = new Map();

try {
  const mapListPath = join(work, 'maps.json');
  const extractionMetadataPath = join(work, 'extracted.json');
  const extractedRoot = join(work, 'bmp');
  writeFileSync(mapListPath, `${JSON.stringify(requestedMaps)}\n`);
  execFileSync(
    'pwsh',
    [
      '-NoProfile',
      '-File',
      extractor,
      '-MapListPath',
      mapListPath,
      '-OutDir',
      extractedRoot,
      '-MetadataPath',
      extractionMetadataPath,
      '-ClientDir',
      client,
      '-GrfLibraryDir',
      grfLibraryDir,
    ],
    { windowsHide: true, stdio: 'pipe', maxBuffer: 8 * 1024 * 1024 },
  );
  const extractionMetadata = JSON.parse(
    readFileSync(extractionMetadataPath, 'utf8'),
  );
  for (const extracted of extractionMetadata)
    extractedByMap.set(extracted.map, {
      archiveName: extracted.archiveName,
      path: extracted.extractedPath,
      relativePath: extracted.relativePath,
    });
  const conversionMetadataPath = join(work, 'converted.json');
  const convertedRoot = join(work, 'png');
  execFileSync(
    'pwsh',
    [
      '-NoProfile',
      '-File',
      converter,
      '-ExtractionMetadataPath',
      extractionMetadataPath,
      '-OutDir',
      convertedRoot,
      '-ConversionMetadataPath',
      conversionMetadataPath,
    ],
    { windowsHide: true, stdio: 'pipe', maxBuffer: 8 * 1024 * 1024 },
  );
  const convertedByMap = new Map(
    JSON.parse(readFileSync(conversionMetadataPath, 'utf8')).map((entry) => [
      entry.map,
      entry,
    ]),
  );

  const archiveHashes = Object.fromEntries(
    archiveNames.map((name) => [name, hashFile(join(client, name))]),
  );
  const clientExecutableSha256 = hashFile(clientExe);
  const standardSet = new Set(standardMaps);
  const specialSet = new Set(specialTransportMaps);
  const entries = [];

  for (const map of requestedMaps) {
    const extracted = extractedByMap.get(map);
    const releaseClass = standardSet.has(map)
      ? 'STANDARD_FARM_MAP_RELEASE'
      : specialSet.has(map)
        ? 'SPECIAL_TRANSPORT_HOLD'
        : 'VISUAL_ACCEPTANCE_SAMPLE';
    if (!extracted) {
      entries.push({
        map,
        releaseClass,
        sourceAsset: null,
        sourceArchive: null,
        sourceFormat: 'BMP',
        sourceVersion: 'Ragnarok.exe 2.0.0.1',
        sourceHash: null,
        webAsset: null,
        width: null,
        height: null,
        outputHash: null,
        availability: 'ORIGINAL_ASSET_MISSING',
      });
      continue;
    }

    const converted = convertedByMap.get(map);
    if (!converted)
      throw new Error(`${map} BMP conversion metadata is missing`);
    const sourceBytes = readFileSync(extracted.path);
    const sourceHash = hashBytes(sourceBytes);
    const outputPath = join(outputRoot, `${map}.png`);
    copyFileSync(converted.outputPath, outputPath);
    const outputHash = hashFile(outputPath);
    entries.push({
      map,
      releaseClass,
      sourceAsset:
        extracted.relativePath ??
        `data/texture/유저인터페이스/map/${map}.bmp`,
      sourceArchive: extracted.archiveName,
      sourceFormat: 'BMP',
      sourceVersion: 'Ragnarok.exe 2.0.0.1',
      sourceHash,
      archiveHash: archiveHashes[extracted.archiveName],
      webAsset: `/ro/client/minimaps/${map}.png?v=${outputHash.slice(0, 16)}`,
      width: converted.width,
      height: converted.height,
      outputHash,
      availability: 'AVAILABLE',
      conversion: 'BMP to PNG; exact RGB preserved; magenta key made transparent',
    });
  }

  const summarize = (maps) => {
    const wanted = new Set(maps);
    const selected = entries.filter((entry) => wanted.has(entry.map));
    const available = selected.filter(
      (entry) => entry.availability === 'AVAILABLE',
    ).length;
    return { count: selected.length, available, missing: selected.length - available };
  };
  const manifest = {
    schemaVersion: 1,
    taskId: 'RO_ORIGINAL_COLOR_MINIMAP_V1',
    generatedAt: new Date().toISOString(),
    sourceClient: {
      path: relative(client, clientExe).replaceAll('\\', '/'),
      version: '2.0.0.1',
      sha256: clientExecutableSha256,
    },
    sourceArchives: archiveNames.map((name) => ({
      name,
      bytes: statSync(join(client, name)).size,
      sha256: archiveHashes[name],
    })),
    coverage: {
      standardFarmRelease: summarize(standardMaps),
      specialTransportHold: summarize(specialTransportMaps),
      acceptanceSamples: summarize(acceptanceMaps),
    },
    entries,
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const existingIndex = existsSync(mapIndexPath)
    ? JSON.parse(readFileSync(mapIndexPath, 'utf8'))
    : { schemaVersion: 1, kind: 'maps', entries: [] };
  const byMap = new Map(
    (existingIndex.entries ?? []).map((entry) => [entry.mapId, entry]),
  );
  for (const entry of entries) {
    const current = byMap.get(entry.map) ?? {
      mapId: entry.map,
      internalName: entry.map,
      aliases: [entry.map],
      translationStatus: 'english-fallback',
      verificationGrade: 'D',
      provenance: [],
    };
    if (entry.availability === 'AVAILABLE') current.assetStatus = 'ready';
    else current.assetStatus ??= 'missing';
    current.miniMap =
      entry.availability === 'AVAILABLE'
        ? {
            sourceType: 'client',
            container: entry.sourceArchive,
            sourcePath: entry.sourceAsset,
            sourceSha256: entry.sourceHash,
            archiveSha256: entry.archiveHash,
            sourceWidth: entry.width,
            sourceHeight: entry.height,
            assetRole: 'map-minimap',
            conversion: entry.conversion,
            webPath: entry.webAsset.replace(/\?.*$/, ''),
            webSha256: entry.outputHash,
            modified: true,
            verified: true,
            availability: entry.availability,
          }
        : {
            sourceType: 'client',
            container: null,
            sourcePath: null,
            assetRole: 'map-minimap',
            verified: false,
            availability: entry.availability,
          };
    current.provenance = [
      ...(current.provenance ?? []).filter(
        (item) => item.sourceType !== 'client-map-minimap-v1',
      ),
      {
        tier: 1,
        sourceType: 'client-map-minimap-v1',
        sourcePath:
          entry.sourceArchive && entry.sourceAsset
            ? `${entry.sourceArchive}:${entry.sourceAsset}`
            : null,
        verifiedAt: '2026-09-23',
      },
    ];
    byMap.set(entry.map, current);
  }
  writeFileSync(
    mapIndexPath,
    `${JSON.stringify(
      {
        ...existingIndex,
        schemaVersion: existingIndex.schemaVersion ?? 1,
        kind: 'maps',
        updatedAt: '2026-09-23',
        entries: [...byMap.values()].sort((left, right) =>
          left.mapId.localeCompare(right.mapId),
        ),
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    JSON.stringify(
      {
        result: 'RO_ORIGINAL_MINIMAP_PIPELINE_PASS',
        manifest: relative(repo, manifestPath).replaceAll('\\', '/'),
        requested: requestedMaps.length,
        coverage: manifest.coverage,
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
