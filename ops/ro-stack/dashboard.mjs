import {
  createHmac,
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { execFile } from 'node:child_process';
import { createOpsControlPlane } from './ops-control-plane.mjs';
import { createDashboardDatabase } from './dashboard-db.mjs';
import { createTestFixtureCommandTransport, createM1AcceptanceFixtureTransport, fixtureTransportEnabled } from './test-fixture-command.mjs';
import { createAdminQuarantineRecoveryTransport, AdminRecoveryError } from './dashboard/admin-quarantine-recovery.mjs';
import { createExternalIdentityStore } from './account-external-identity.mjs';
import {
  createDiscordAccountAuth,
  createDiscordRouteHandler,
} from './discord-account-auth.mjs';
import { createServer } from 'node:http';
import { closeSync, openSync, readFileSync } from 'node:fs';
import {
  appendFile,
  mkdir,
  open as openFile,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  extname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
} from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  PerformanceObserver,
  monitorEventLoopDelay,
  performance,
} from 'node:perf_hooks';
import { gzipSync, gunzipSync, inflateSync } from 'node:zlib';
import {
  automationRecoveryCandidates,
  isApprovedIsolatedDatabaseName,
  isIsolatedTestMode,
  isolatedWorkerStartRejection,
  normalizeRuntimeMode,
  parseIdentityAllowlist,
} from './isolated-runtime.mjs';
import { QuestRuntimeService } from './quest-runtime/service.mjs';
import { MariaDbQuestRuntimeStore } from './quest-runtime/store.mjs';
import { ServerAgentQuestBridge } from './quest-runtime/server-agent-bridge.mjs';
import {
  firstJobNavigationRoute,
  firstJobResumeTarget,
  firstJobRoute,
  parseFirstJobContent,
  resolveDefaultFarmTarget,
} from './quest-runtime/first-job-content.mjs';
import { AssassinQuestService } from './quest-runtime/assassin-service.mjs';
import { ASSASSIN_JOB_ADAPTER } from './quest-runtime/assassin-adapter.mjs';
import { RogueQuestService } from './quest-runtime/rogue-service.mjs';
import { ROGUE_JOB_ADAPTER } from './quest-runtime/rogue-adapter.mjs';
import { KnightQuestService } from './quest-runtime/knight-service.mjs';
import { KNIGHT_JOB_ADAPTER } from './quest-runtime/knight-adapter.mjs';
import { CrusaderQuestService } from './quest-runtime/crusader-service.mjs';
import { CRUSADER_JOB_ADAPTER } from './quest-runtime/crusader-adapter.mjs';
import {
  createAuthoritativeJobChangeCommitter,
  createJobQuestAdapterRegistry,
} from './quest-runtime/job-adapter-contract.mjs';
import { CommitType } from './quest-runtime/contracts.mjs';
import { JOB_MAPPING_SOURCE, resolveJobName } from './job-name-resolver.mjs';
import { buildEdenCourseAQuestJournal } from './persistent-agent/quest-journal-contract.mjs';
import {
  readEdenCourseARollout,
  readPersistentAgentRollout,
  readRolloutTelemetry,
  recordRolloutEvent,
} from './persistent-agent/rollout-gate.mjs';
import {
  LIVE_STATUS_MAX_AGE_MS,
  LIVE_STATUS_SOURCE,
  FARM_MAP_SOURCE,
  OPENKORE_OWNER,
  SERVER_AGENT_OWNER,
  W1_ACTION,
  buildW1CommandPayload,
  createControllerStatus,
  createLiveStatusView,
  createUnavailableControllerStatus,
  resolveFarmTarget,
} from './persistent-agent/web-canary.mjs';
import {
  AGENT_PHASE,
  FARM_DECISION,
  decideActivation,
  decideFarmStart,
} from './admin-agent-control.mjs';
import {
  assertSpecialTransportHoldSet,
  evaluateFarmMapSelection,
  indexFarmMapAvailability,
} from './persistent-agent/standard-farm-map-availability.mjs';
import {
  SUPPORT_SESSION_CREATED_FROM,
  SUPPORT_SESSION_MODE,
  classifySupportMutation,
  normalizeSupportActor,
  normalizeSupportSessionInput,
  redactSupportActionAudit,
  redactSupportAuditEvent,
  supportContextView,
} from './support-session.mjs';
import {
  buildPhysicalMapGraph,
  nearestSupplyHubForMap,
  supplyHubs,
} from './grind-hub-routing.mjs';
import {
  buildTerminalRoute,
  loadWarpGraph,
  planFarmMapChange,
  planWebRelocation,
} from './persistent-agent/map-route.mjs';
import {
  loadCanonicalStandardFarmGraph,
  planCanonicalStandardFarmMapChange,
} from './persistent-agent/canonical-standard-farm-route.mjs';
import { kafraContextForPlan } from './persistent-agent/kafra-content.mjs';
import { worldMapTeleportDecision } from './persistent-agent/world-map-teleport-policy.mjs';
import { farmMapSupplyPreflight, farmSwitchReachedTarget,
  mayRetryFarmSwitch, paidFarmSwitchResumeDecision } from './persistent-agent/farm-map-supply-preflight.mjs';
import { nativeSupplyPolicy } from './persistent-agent/native-supply-policy.mjs';
import { SUPPLY_TOWN_SERVICES, SUPPLY_TOWN_STORAGE } from './persistent-agent/supply-town-services.mjs';
import {
  buildWorldMapTeleportCatalog,
  parseBlockedWorldMapFlags,
  parseTownMapFlags,
} from './persistent-agent/world-map-teleport-catalog.mjs';
import {
  decideNormalizationAction,
  resolveSpawnEntry as resolveNoviceSpawnEntry,
} from './persistent-agent/novice-onboarding-spawn.mjs';
import {
  coordinatorDeadlineMsForRouteSteps,
  RELOCATION_REASON,
} from './persistent-agent/relocation-policy.mjs';
import {
  createRelocationProgress,
  relocationStageNeedsCommand,
  nextRelocationAction,
} from './persistent-agent/relocation-executor.mjs';
import {
  existingCommandsForStep,
} from './persistent-agent/relocation-command-surface.mjs';
import {
  applySupplyCycleSettings,
  canonicalToOpenKorePreview,
  validateCanonicalConfig,
} from './dashboard/config-schema.mjs';
import {
  loadCanonicalConfig,
  saveCanonicalConfig,
} from './dashboard/config-storage.mjs';
import { resolveFarmExecutionProfile } from './dashboard/farm-execution-profile.mjs';
import { configWriteAdmission, m1ConfigExecutionCapabilities } from './dashboard/config-capabilities.mjs';
import {
  CharacterProjectionCache,
  CharacterViewerRegistry,
  DomainRevisionTracker,
  NATIVE_COMBAT_EVENT_TYPES,
  OBSERVATION_POLICY,
  ObservationInterest,
  coalesceCombatEventLines,
  coalesceCombatEvents,
  legacyObservationMode,
  nativeFarmEndedAt,
  nativeFarmRunning,
  nativeFarmStartedAt,
  nativeLifeEventLine,
  parseLifeEventFacts,
  projectLivePosition,
  projectGameEntryLeanSnapshot,
  projectLiveSnapshot,
  projectNativeFarmStats,
  publicObservationPolicy,
  revisionKeyForInterest,
  withLiveFreshness,
} from './web-observation.mjs';
import {
  CombatSseBroker,
  CombatSseRollout,
  gateCombatSseForServerAgent,
} from './combat-sse.mjs';
import {
  CANARY_ACTIONS as WEB_EXPERIENCE_CANARY_ACTIONS,
  createProductionTelemetry,
  deploymentIdentity,
} from './web-experience/production-telemetry.mjs';
import { createExperienceHealth } from './web-experience/experience-health.mjs';
import {
  buildObservatoryReport,
  createPlayerWebObservatory,
} from './web-experience/player-web-observatory.mjs';
import {
  addWebLatencyDuration,
  currentWebLatencyTrace,
  recordWebDiagnosticQuery,
  runWithWebLatencyTrace,
  withWebLatencyStage,
  webHotPathDiagnosticEnabled,
  webLatencyTraceEnabled,
} from './web-latency-trace.mjs';
import {
  getRoAssetPublicSnapshot,
  resolveItemAsset,
  resolveMonsterDisplayName,
  resolveNpcAsset,
} from './ro-asset-resolver.mjs';

const edenSecretaryName = () =>
  resolveNpcAsset('eden-secretary-lime-evenor').name ?? '秘書萊茵 伊貝努勒';
const edenInstructorName = () =>
  resolveNpcAsset('eden-instructor-boya').name ?? '伊甸園教官 保亞';

const execFileAsync = promisify(execFile);
import {
  buildAdminFixtureNavigationRoute,
  navigationCommandIsPending,
  parseAdminFixtureNavigationInput,
} from './persistent-agent/admin-fixture-navigation.mjs';
const scryptAsync = promisify(scrypt);
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const runtime = join(root, '.local', 'ro-stack');
// Production instance root. Isolated tests must point RO_INSTANCE_ROOT at a
// dedicated directory so production control/state/status files are never used.
const defaultInstancesRoot = join(runtime, 'instances');
const instancesRoot = process.env.RO_INSTANCE_ROOT
  ? resolve(process.env.RO_INSTANCE_ROOT)
  : defaultInstancesRoot;
const combatSseRolloutPath = join(
  runtime,
  'dashboard',
  'combat-sse-rollout.json',
);
const voiceRoot = join(runtime, 'social-voice');
const webRoot = join(dirname(fileURLToPath(import.meta.url)), 'dashboard');
const publicRoot = join(root, 'public');
const skillTreePath = join(publicRoot, 'ro', 'data', 'skill-trees.json');
const mapInfoIndexPath = join(publicRoot, 'ro', 'data', 'map-info.json');
const standardFarmMapRegistryPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'persistent-agent',
  'standard-farm-map-release-registry.json',
);
const webExperienceRegistryPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'web-experience',
  'action-registry.json',
);
const webExperienceTelemetryPath = join(
  runtime,
  'dashboard',
  'web-experience-telemetry.ndjson',
);
const openKorePortalsPath = join(runtime, 'openkore', 'tables', 'portals.txt');
const twroItemTablePath = join(
  runtime,
  'openkore',
  'tables',
  'twRO',
  'items.txt',
);
const edenCourseASequencePath = join(
  dirname(fileURLToPath(import.meta.url)),
  'persistent-agent',
  'quest-sequences',
  'eden-course-a.json',
);
const noviceOnboardingSequencePath = join(
  dirname(fileURLToPath(import.meta.url)),
  'persistent-agent',
  'quest-sequences',
  'novice-onboarding.json',
);
const noviceOnboardingAllowlistPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'persistent-agent',
  'quest-content',
  'novice-onboarding.allowlists.json',
);
const firstJobContentPath = join(
  dirname(fileURLToPath(import.meta.url)),
  'persistent-agent',
  'quest-content',
  'first-job.json',
);
const port = Number(process.env.RO_DASHBOARD_PORT ?? 8788);
const host = process.env.RO_DASHBOARD_HOST ?? '127.0.0.1';
const isolatedLatencyTrace =
  webLatencyTraceEnabled &&
  /^(?:1|true|on)$/i.test(
    String(process.env.WEB_LATENCY_TRACE_ISOLATED ?? '').trim(),
  );
// Isolated test runtime mode. Unset means production: every existing behaviour
// is preserved. RO_RUNTIME_MODE=isolated-test separates cloned fixture DATA
// from execution INTENT so copied desired_running / state.json never launches
// OpenKore on its own.
// Enable only after the matching native command is deployed and accepted.
const nativeSupplyPolicyCommandEnabled = process.env.PA_NATIVE_SUPPLY_POLICY_ENABLED === '1';
const runtimeMode = normalizeRuntimeMode(process.env.RO_RUNTIME_MODE);
const isolatedTestMode = isIsolatedTestMode(runtimeMode);
const isolatedAutomationAccountAllowlist = parseIdentityAllowlist(
  process.env.RO_ISOLATED_AUTOMATION_ALLOWLIST,
);
const isolatedAutomationCharacterAllowlist = parseIdentityAllowlist(
  process.env.RO_ISOLATED_AUTOMATION_CID_ALLOWLIST,
);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.json': 'application/json; charset=utf-8',
};
const accountPattern = /^[a-zA-Z0-9_]{4,23}$/;
const passwordPattern = /^[a-zA-Z0-9!@#$%^&*_.-]{8,32}$/;
const characterPattern = /^[\p{L}\p{N}_]{2,24}$/u;
const automatedTestAccountPattern = /^(?:jobtest_|gate2_)/i;
const jobQuestAdapters = createJobQuestAdapterRegistry([
  ASSASSIN_JOB_ADAPTER,
  ROGUE_JOB_ADAPTER,
  KNIGHT_JOB_ADAPTER,
  CRUSADER_JOB_ADAPTER,
]);
// rAthena exports every Type: Ammo item as IT_AMMO (10) in the live inventory.
const openKoreAmmoItemTypes = Object.freeze({
  Arrow: 10,
  Dagger: 10,
  Bullet: 10,
  Shell: 10,
  Grenade: 10,
  Shuriken: 10,
  Kunai: 10,
  Cannonball: 10,
  Throwweapon: 10,
});
let databaseQueue = Promise.resolve();
let accountQueue = Promise.resolve();
let pendingAccountRequests = 0;
const loginClientAttempts = new Map();
const loginIdentityAttempts = new Map();
const sessionCache = new Map();
const socialRateLimits = new Map();
const preferenceCache = new Map();
const statusSnapshotCache = new Map();
const statusSnapshotReadState = new Map();
const observationConfigCache = new Map();
const mapPlayerCountCache = new Map();
const taskCommandLocks = new Map();
const statCommandLocks = new Map();
const statCommandResultCache = new Map();
const statDomainRevisionState = new Map();
const mapFieldResponseCache = new Map();
const rankingCache = new Map();
const webPresenceMarkerState = new Map();
const webPresenceUpdateLocks = new Map();
const webViewerRegistry = new CharacterViewerRegistry();
const domainRevisionTracker = new DomainRevisionTracker();
const characterProjectionCache = new CharacterProjectionCache();
const tracedCharacterProjection = (options, builder) =>
  withWebLatencyStage('projection', () =>
    characterProjectionCache.getOrBuild(options, builder),
  );
const combatSseRollout = new CombatSseRollout({
  configPath: combatSseRolloutPath,
});
const combatSseBroker = new CombatSseBroker({
  loadFrame: loadCombatSseFrame,
});
let rathenaMapCachePromise = null;
let publicHealthCache = { at: 0, value: null, pending: null };
const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const rankingClassIds = new Set([0, 1, 2, 3, 4, 5, 6, 21, 23, 24, 25, 4046]);
const rankingCacheDurationMs = 60000;
const webViewerLeaseMs = OBSERVATION_POLICY.leaseMs;
const webPresenceMarkerRefreshMs = OBSERVATION_POLICY.markerRefreshMs;
const logProjectionLineLimit = 100;
const logProjectionInitialLines = 100;
const logProjectionMaximumDelta = 100;
const webPresenceMetrics = {
  markerWrites: 0,
  markerRemovals: 0,
  markerErrors: 0,
};
const securityHeaders = Object.freeze({
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(self), geolocation=()',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
});

async function loadTwroItemNames() {
  try {
    const source = await readFile(twroItemTablePath, 'utf8');
    return new Map(
      source
        .split(/\r?\n/)
        .map((line) => line.match(/^(\d+)#(.+)#$/))
        .filter(Boolean)
        .map((match) => [Number(match[1]), match[2].trim()]),
    );
  } catch {
    return new Map();
  }
}

const twroItemNames = await loadTwroItemNames();
const edenCourseASequence = JSON.parse(
  await readFile(edenCourseASequencePath, 'utf8'),
);
const noviceOnboardingSequence = JSON.parse(
  await readFile(noviceOnboardingSequencePath, 'utf8'),
);
const noviceOnboardingAllowlist = JSON.parse(
  await readFile(noviceOnboardingAllowlistPath, 'utf8'),
);
const firstJobContent = parseFirstJobContent(
  JSON.parse(await readFile(firstJobContentPath, 'utf8')),
);
const physicalMapGraph = buildPhysicalMapGraph(
  await readFile(openKorePortalsPath, 'utf8'),
);
const mapRoutingIndex = JSON.parse(await readFile(mapInfoIndexPath, 'utf8'));
const standardFarmMapRegistry = JSON.parse(
  await readFile(standardFarmMapRegistryPath, 'utf8'),
);
const standardFarmMapAvailability = indexFarmMapAvailability(
  standardFarmMapRegistry,
);
assertSpecialTransportHoldSet(standardFarmMapRegistry);
let worldMapTeleportCatalog = null;
let worldMapTownFlagMaps = null;

// W4: physical warp topology of the LIVE rAthena map server, used only to
// resolve a Web-selected SERVER_AGENT destination into an explicit route. The
// map server remains the only movement / transition authority.
const rAthenaRuntimeRoot = process.env.RO_RATHENA_ROOT
  ? resolve(process.env.RO_RATHENA_ROOT)
  : join(runtime, 'rathena');
let serverAgentWarpGraphPromise = null;
function serverAgentWarpGraph() {
  if (!serverAgentWarpGraphPromise)
    serverAgentWarpGraphPromise = loadWarpGraph(rAthenaRuntimeRoot).catch(
      () => new Map(),
    );
  return serverAgentWarpGraphPromise;
}
let standardFarmGraphPromise = null;
function canonicalStandardFarmGraph() {
  if (!standardFarmGraphPromise)
    standardFarmGraphPromise = loadCanonicalStandardFarmGraph(rAthenaRuntimeRoot)
      .catch((error) => { standardFarmGraphPromise = null; throw error; });
  return standardFarmGraphPromise;
}

worldMapTownFlagMaps = new Set([
  ...parseTownMapFlags(await readFile(join(rAthenaRuntimeRoot,
    'npc/mapflag/town.txt'), 'utf8').catch(() => '')),
  ...parseTownMapFlags(await readFile(join(rAthenaRuntimeRoot,
    'npc/re/mapflag/town.txt'), 'utf8').catch(() => '')),
]);
worldMapTeleportCatalog = await buildWorldMapTeleportCatalog({
  mapInfo: mapRoutingIndex,
  sourceIndex: JSON.parse(await readFile(join(root,
    'ops/ro-stack/persistent-agent/world-map-teleport-source.json'), 'utf8')),
  mapCache: await loadRathenaMapCache(),
  graph: await serverAgentWarpGraph(),
  publicRoot,
  townFlagMaps: worldMapTownFlagMaps,
  blockedFlagMaps: new Set((await Promise.all([
    'npc/mapflag/nowarpto.txt', 'npc/re/mapflag/nowarpto.txt',
    'npc/mapflag/restricted.txt', 'npc/re/mapflag/restricted.txt',
    'npc/mapflag/gvg.txt', 'npc/re/mapflag/gvg.txt',
    'npc/mapflag/battleground.txt',
  ].map(async (path) => [...parseBlockedWorldMapFlags(
    await readFile(join(rAthenaRuntimeRoot, path), 'utf8').catch(() => ''),
  )]))).flat()),
  mapNames: JSON.parse(await readFile(join(publicRoot,
    'ro/data/map-names.json'), 'utf8')).entries,
});

// Supply uses the rAthena save point for world movement and keeps the existing
// route planner only for the saved town's local shop service leg.

// Farm map eligibility requires authoritative spawn detail plus the canonical
// standard-route release decision. Player Web only projects this registry.
function farmMapEligibility(mapId) {
  const map = mapRoutingIndex.maps?.[String(mapId ?? '')];
  if (!map) return { map: null, farmable: false, reason: 'farm_target_unresolved' };
  const teleport = worldMapTeleportCatalog?.get(String(mapId ?? ''));
  if (teleport) return { map, ...teleport,
    reason: teleport.farmSelectionAvailable ? null : teleport.availabilityReason };
  return {
    map,
    ...evaluateFarmMapSelection({
      mapSummary: map,
      availability: standardFarmMapAvailability.get(String(mapId ?? '')),
    }),
  };
}

async function playerWorldMapAvailability(account) {
  const charId = Number(account.characterId);
  if (!Number.isSafeInteger(charId) || charId <= 0)
    return { maps: [], towns: [], player: null, cooldownSeconds: 60 };
  const [character, live] = await Promise.all([
    sql(`SELECT c.base_level,c.zeny,COALESCE(r.value,0),c.save_map,c.save_x,c.save_y FROM \`char\` c LEFT JOIN char_reg_num r ON r.char_id=c.char_id AND r.\`key\`='world_teleport_available_at' AND r.\`index\`=0 WHERE c.char_id=${charId} AND c.account_id=${Number(account.accountId)} LIMIT 1;`),
    readPersistentAgentLiveStatusView(charId),
  ]);
  const [levelText, zenyText, availableText, savedMap, savedX, savedY] = String(character ?? '').split('\t');
  const baseLevel = Number(levelText);
  const zeny = live?.fresh ? Number(live.zeny) : Number(zenyText);
  const currentMap = live?.fresh ? String(live.map ?? '') : null;
  const availableAt = Number(availableText) || 0;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const currentIsTown = worldMapTownFlagMaps.has(currentMap);
  const savedTown = worldMapTeleportCatalog.get(savedMap)?.kind === 'town'
    ? { map: savedMap, name: worldMapTeleportCatalog.get(savedMap).name,
      x: Number(savedX), y: Number(savedY) } : null;
  const rows = [...worldMapTeleportCatalog.values()].map((row) => {
    if (row.kind === 'farm' && !row.farmSelectionAvailable)
      return { ...row, buttonState: 'UNAVAILABLE_MAP', cost: null };
    if (!currentMap || !Number.isSafeInteger(baseLevel) || !Number.isSafeInteger(zeny))
      return { ...row, buttonState: 'PLAYER_STATE_UNAVAILABLE', cost: null };
    const decision = worldMapTeleportDecision({ kind: row.kind,
      currentMap, targetMap: row.map, baseLevel, minLevel: row.minLevel,
      zeny, currentIsTown, availableAt, nowSeconds });
    const sameMapIdleFarmStart = row.kind === 'farm' &&
      decision.reason === 'ALREADY_ON_TARGET_MAP' &&
      live?.agentMode === 'PERSISTENT_IDLE';
    return { ...row, buttonState: sameMapIdleFarmStart ? 'AVAILABLE' : decision.reason,
      cost: decision.cost ?? (row.kind === 'town' ? 0 : baseLevel <= 66 ? 0 : row.minLevel * 10),
      cooldownRemaining: decision.cooldownRemaining ?? 0,
      cooldownSeconds: decision.cooldownSeconds ?? 0,
      currentZeny: zeny };
  });
  return { maps: rows.filter((row) => row.kind === 'farm'),
    towns: rows.filter((row) => row.kind === 'town'),
    player: { baseLevel, zeny, currentMap, phase: live?.fresh ? live.phase : null,
      availableAt, savedTown, savedTownSetupRequired: !savedTown }, cooldownSeconds: 60 };
}
const webExperienceRegistry = JSON.parse(
  await readFile(webExperienceRegistryPath, 'utf8'),
);
const webExperienceFileHashes = Object.fromEntries(
  [
    ['dashboard.mjs', fileURLToPath(import.meta.url)],
    ['dashboard/app.js', join(webRoot, 'app.js')],
    ['production-telemetry.mjs', join(dirname(webExperienceRegistryPath), 'production-telemetry.mjs')],
  ].map(([name, path]) => [
    name,
    createHash('sha256').update(readFileSync(path)).digest('hex'),
  ]),
);
const webExperienceTelemetry = createProductionTelemetry({
  registry: webExperienceRegistry,
  enabled: /^(?:1|true|on)$/i.test(
    String(process.env.WEB_EXPERIENCE_CANARY_ENABLED ?? '').trim(),
  ),
  canaryAccountIds: String(process.env.WEB_EXPERIENCE_CANARY_ACCOUNTS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  canaryCharacterIds: String(process.env.WEB_EXPERIENCE_CANARY_CHARACTERS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  canaryUsernames: String(process.env.WEB_EXPERIENCE_CANARY_USERS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  percentage: Number(process.env.WEB_EXPERIENCE_CANARY_PERCENTAGE ?? 0),
  rollingFilePath: webExperienceTelemetryPath,
  deployment: deploymentIdentity({
    gitSha: process.env.WEB_DEPLOYMENT_GIT_SHA ?? process.env.GIT_SHA,
    fileHashes: webExperienceFileHashes,
  }),
});
// WEB_REAL_USER_EXPERIENCE_V1 rolling read model. Fed by the SAME ingest
// endpoint and canary eligibility as production telemetry; no second transport.
const webExperienceHealth = createExperienceHealth();
const playerWebObservatory = createPlayerWebObservatory();

async function loadSkillAutomationDefinitions() {
  const data = JSON.parse(await readFile(skillTreePath, 'utf8'));
  return new Map(
    Object.entries(data.jobs ?? {}).flatMap(([jobId, job]) =>
      (job.skills ?? [])
        .filter((skill) => skill.automationMode)
        .map((skill) => [`${jobId}:${skill.id}`, skill]),
    ),
  );
}

const skillAutomationDefinitions = await loadSkillAutomationDefinitions();

function localizedItemName(itemId, fallback) {
  const officialName = twroItemNames.get(Number(itemId));
  if (/\p{Script=Han}/u.test(officialName ?? '')) return officialName;
  if (/\p{Script=Han}/u.test(fallback ?? '')) return fallback;
  return `道具 #${itemId}`;
}

// PL1-A factual diary projection. This is a read model over the authoritative
// Persistent Life tables; it does not create lifecycle facts or narrative text.
const persistentLifeEventTypes = new Set([
  'SESSION_STARTED',
  'SESSION_ENDED',
  'FARM_SESSION_STARTED',
  'FARM_SESSION_STOPPED',
  'MONSTER_KILL',
  'LOOT_ACQUIRED',
  'MAP_CHANGED',
  'NPC_INTERACTION',
  'PLAYER_DEATH',
]);
const persistentLifeEmptyCounts = () => ({
  total: 0,
  kills: 0,
  loot: 0,
  npcInteractions: 0,
  mapChanges: 0,
  deaths: 0,
});
const persistentLifeProjectionLimit = 120;
const persistentLifeHighlightLimit = 5;

function persistentLifeSchemaUnavailable(error) {
  return /persistent_life_(?:session|event).*(?:doesn't exist|does not exist)|Unknown table/i.test(
    String(error?.message ?? error),
  );
}

function persistentLifeMapLabel(mapId) {
  const id = String(mapId ?? '').trim();
  if (!id) return '';
  return String(mapRoutingIndex.maps?.[id]?.name ?? id);
}

function persistentLifeEventLabel(event) {
  const facts = event.facts ?? {};
  const map = persistentLifeMapLabel(event.map || facts.map);
  switch (event.eventType) {
    case 'SESSION_STARTED':
      return '角色開始活動';
    case 'SESSION_ENDED':
      return '角色結束活動';
    case 'FARM_SESSION_STARTED':
      return '開始自動狩獵';
    case 'FARM_SESSION_STOPPED':
      return '結束自動狩獵';
    case 'MONSTER_KILL': {
      const mobId = Number(facts.mobId);
      const name = Number.isSafeInteger(mobId) && mobId > 0
        ? resolveMonsterDisplayName({ mobId })
        : '';
      return name ? `擊敗${name}` : '擊敗怪物';
    }
    case 'LOOT_ACQUIRED': {
      const itemId = Number(facts.itemId);
      const name = Number.isSafeInteger(itemId) && itemId > 0
        ? localizedItemName(itemId, facts.itemName)
        : '取得物品';
      return `取得${name}`;
    }
    case 'MAP_CHANGED':
      return map ? `移動至${map}` : '地圖變更';
    case 'NPC_INTERACTION': {
      const npc = String(facts.npc ?? facts.npcName ?? '').trim();
      return npc ? `與${npc}互動` : 'NPC 互動';
    }
    case 'PLAYER_DEATH':
      return '角色死亡';
    default:
      return '';
  }
}

function persistentLifeFactsFromHex(hex) {
  const value = String(hex ?? '').trim();
  if (!value) return {};
  if (value.length > 8192) return {};
  return parseLifeEventFacts(Buffer.from(value, 'hex').toString('utf8'));
}

function persistentLifeEventOrder(left, right) {
  return left.sequence - right.sequence || left.eventId - right.eventId;
}

function projectPersistentLifeEvent(row, sessionId) {
  const event = {
    eventId: Number(row[0]),
    sequence: Number(row[1]),
    occurredAt: row[2] || null,
    eventType: row[3] || '',
    map: row[4] || null,
    facts: persistentLifeFactsFromHex(row[5]),
    importance: Number(row[6] ?? 0),
    source: row[7] || '',
    sessionId,
  };
  if (!persistentLifeEventTypes.has(event.eventType)) return null;
  const label = persistentLifeEventLabel(event);
  if (!label) return null;
  return {
    eventId: event.eventId,
    sequence: event.sequence,
    occurredAt: event.occurredAt,
    eventType: event.eventType,
    map: event.map,
    facts: event.facts,
    source: event.source,
    label,
    importance: event.importance,
  };
}

function persistentLifeEmptyProjection() {
  return {
    available: true,
    session: null,
    counts: persistentLifeEmptyCounts(),
    highlights: [],
    events: [],
  };
}

async function readPersistentLifeDiary(account, charId) {
  const accountId = Number(account.accountId);
  const id = Number(charId);
  try {
    const sessionOutput = await sql(
      `SELECT session_id,status,DATE_FORMAT(started_at,'%Y-%m-%d %H:%i:%s.%f'),` +
        `COALESCE(DATE_FORMAT(ended_at,'%Y-%m-%d %H:%i:%s.%f'),'') AS ended_at,` +
        `COALESCE(start_map,''),COALESCE(end_map,''),event_count,` +
        `IF(seen_at IS NULL,0,1),` +
        `DATE_FORMAT(seen_at,'%Y-%m-%d %H:%i:%s.%f') AS seen_at ` +
        `FROM persistent_life_session ` +
        `WHERE char_id=${id} AND account_id=${accountId} ` +
        `AND status IN ('ACTIVE','COMPLETED','INTERRUPTED') ` +
        `ORDER BY IF(status='ACTIVE',0,1),started_at DESC,session_id DESC LIMIT 1;`,
    );
    if (!sessionOutput) return persistentLifeEmptyProjection();
    const sessionRow = sessionOutput.split('\t');
    const sessionId = sessionRow[0];
    const eventOutput = await sql(
      `SELECT event_id,sequence,DATE_FORMAT(occurred_at,'%Y-%m-%d %H:%i:%s.%f'),` +
        `event_type,COALESCE(map,''),HEX(COALESCE(facts,'')),importance,source ` +
        `FROM persistent_life_event e JOIN persistent_life_session s ` +
        `ON s.session_id=e.session_id AND s.char_id=e.char_id ` +
        `WHERE e.session_id='${escapeSql(sessionId)}' AND e.char_id=${id} ` +
        `AND ((s.seen_at IS NULL AND e.occurred_at>=s.started_at) ` +
        `OR (s.seen_at IS NOT NULL AND e.occurred_at>s.seen_at)) ` +
        `ORDER BY sequence ASC,event_id ASC LIMIT ${persistentLifeProjectionLimit};`,
    );
    const seenSequences = new Set();
    const events = (eventOutput ? eventOutput.split(/\r?\n/) : [])
      .filter(Boolean)
      .map((line) => projectPersistentLifeEvent(line.split('\t'), sessionId))
      .filter((event) => {
        if (!event || seenSequences.has(event.sequence)) return false;
        seenSequences.add(event.sequence);
        return true;
      })
      .sort(persistentLifeEventOrder);
    const counts = events.reduce((result, event) => {
      result.total += 1;
      if (event.eventType === 'MONSTER_KILL') result.kills += 1;
      if (event.eventType === 'LOOT_ACQUIRED') result.loot += 1;
      if (event.eventType === 'NPC_INTERACTION') result.npcInteractions += 1;
      if (event.eventType === 'MAP_CHANGED') result.mapChanges += 1;
      if (event.eventType === 'PLAYER_DEATH') result.deaths += 1;
      return result;
    }, persistentLifeEmptyCounts());
    const highlights = events
      .slice()
      .sort((left, right) => right.importance - left.importance || persistentLifeEventOrder(left, right))
      .slice(0, persistentLifeHighlightLimit)
      .sort(persistentLifeEventOrder)
      .map(({ importance, ...event }) => event);
    // An ACTIVE session remains the current lifecycle owner, but an empty
    // acknowledgement window must not reopen an already-read Diary.
    if (events.length === 0 && sessionRow[1] === 'ACTIVE')
      return persistentLifeEmptyProjection();
    return {
      available: true,
      session: {
        sessionId,
        status: sessionRow[1],
        startedAt: sessionRow[2] || null,
        endedAt: sessionRow[3] || null,
        startMap: sessionRow[4] || null,
        endMap: sessionRow[5] || null,
        eventCount: Number(sessionRow[6] ?? 0),
        seen: events.length === 0 ? sessionRow[7] === '1' : false,
      },
      counts,
      highlights,
      events: events.map(({ importance, ...event }) => event),
    };
  } catch (error) {
    if (persistentLifeSchemaUnavailable(error))
      return { ...persistentLifeEmptyProjection(), available: false };
    throw error;
  }
}

class HttpError extends Error {
  constructor(statusCode, message, retryAfter = 0) {
    super(message);
    this.statusCode = statusCode;
    this.retryAfter = retryAfter;
  }
}

const secrets = JSON.parse(
  await readFile(join(runtime, 'secrets.json'), 'utf8'),
);
const databaseHost = process.env.RO_DB_HOST ?? '127.0.0.1';
const databasePort = Number(process.env.RO_DB_PORT ?? 3307);
const databaseUser = process.env.RO_DB_USER ?? 'rathena_local';
const databaseName = process.env.RO_DB_NAME ?? 'ragnarok';
const databasePassword =
  process.env.RO_DB_PASSWORD ?? secrets.databasePassword;
const databasePool = createDashboardDatabase({
  host: databaseHost,
  port: databasePort,
  user: databaseUser,
  password: databasePassword,
  database: databaseName,
  poolSize: process.env.RO_DB_POOL_SIZE,
  queueLimit: process.env.RO_DB_QUEUE_LIMIT,
  connectTimeoutMs: process.env.RO_DB_CONNECT_TIMEOUT_MS,
  idleTimeoutMs: process.env.RO_DB_IDLE_TIMEOUT_MS,
});

const discordIdentityStore = createExternalIdentityStore(databasePool.pool);
const discordAccountAuth = createDiscordAccountAuth({
  store: discordIdentityStore,
  env: process.env,
  invalidateSession: (hash) => sessionCache.delete(hash),
});
const discordRouteHandler = createDiscordRouteHandler({
  auth: discordAccountAuth,
  getAccount: (request) => sessionAccount(request),
  originAllowed: (request) => mutationOriginAllowed(request),
  allowStart: (request) => {
    const key = clientAddress(request);
    return consumeRateLimit(loginClientAttempts, 'discord:' + key, 300_000, 20);
  },
});

const productionMetricsStartedAt = Date.now();
const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
eventLoopDelay.enable();
const gcMetrics = { count: 0, durationMs: 0 };
const gcObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    gcMetrics.count += 1;
    gcMetrics.durationMs += entry.duration;
  }
});
gcObserver.observe({ entryTypes: ['gc'] });

function newRateBuckets() {
  return Array.from({ length: 60 }, () => ({ second: -1, count: 0, bytes: 0 }));
}

function recordRate(buckets, count = 1, bytes = 0, now = Date.now()) {
  const second = Math.floor(now / 1_000),
    bucket = buckets[second % buckets.length];
  if (bucket.second !== second) {
    bucket.second = second;
    bucket.count = 0;
    bucket.bytes = 0;
  }
  bucket.count += count;
  bucket.bytes += bytes;
}

function summarizeRate(buckets, seconds = 10, now = Date.now()) {
  const currentSecond = Math.floor(now / 1_000),
    active = buckets.filter(
      (bucket) =>
        bucket.second >= currentSecond - seconds + 1 &&
        bucket.second <= currentSecond,
    ),
    count = active.reduce((sum, bucket) => sum + bucket.count, 0),
    bytes = active.reduce((sum, bucket) => sum + bucket.bytes, 0);
  return {
    requestsPerSecond: count / seconds,
    bytesPerSecond: bytes / seconds,
  };
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
}

function metricDomain(url) {
  const pathname = url?.pathname ?? '';
  if (pathname === '/api/combat-stream') return 'combat-stream';
  if (pathname === '/api/events') return 'combat';
  if (/inventory|equipment|item/.test(pathname)) return 'inventory';
  if (pathname === '/api/status-point') return 'stat';
  if (/ownership|persistent-agent/.test(pathname)) return 'ownership';
  if (/social|voice/.test(pathname)) return 'social';
  if (/journal/.test(pathname)) return 'journal';
  if (/quest|eden|onboarding/.test(pathname)) return 'quest';
  if (pathname === '/api/state') {
    const interest = String(url.searchParams.get('interest') ?? '');
    if (interest === ObservationInterest.COMBAT_PAGE) return 'combat';
    if (interest === ObservationInterest.QUEST_PAGE) return 'quest';
    if (interest === ObservationInterest.INVENTORY_PAGE) return 'inventory';
    if (interest === ObservationInterest.SOCIAL_PAGE) return 'social';
  }
  return pathname.startsWith('/api/') ? 'other' : 'static';
}

function newRequestMetric() {
  return { total: 0, errors: 0, bytes: 0, rates: newRateBuckets(), latencies: [] };
}

const requestMetrics = new Map();
function recordRequestMetric(domain, statusCode, durationMs, bytes) {
  const metric = requestMetrics.get(domain) ?? newRequestMetric();
  requestMetrics.set(domain, metric);
  metric.total += 1;
  metric.errors += statusCode >= 400 ? 1 : 0;
  metric.bytes += bytes;
  metric.latencies.push(durationMs);
  if (metric.latencies.length > 2_048)
    metric.latencies.splice(0, metric.latencies.length - 2_048);
  recordRate(metric.rates, 1, bytes);
}

function requestMetricsSummary() {
  return Object.fromEntries(
    [...requestMetrics.entries()].map(([domain, metric]) => [
      domain,
      {
        total: metric.total,
        errors: metric.errors,
        ...summarizeRate(metric.rates),
        p50Ms: percentile(metric.latencies, 0.5),
        p95Ms: percentile(metric.latencies, 0.95),
        p99Ms: percentile(metric.latencies, 0.99),
      },
    ]),
  );
}

function eventLoopLagSummary({ reset = false } = {}) {
  const summary = {
    meanMs: Number(eventLoopDelay.mean) / 1e6 || 0,
    maxMs: Number(eventLoopDelay.max) / 1e6 || 0,
    p95Ms: Number(eventLoopDelay.percentile(95)) / 1e6 || 0,
    p99Ms: Number(eventLoopDelay.percentile(99)) / 1e6 || 0,
  };
  if (reset) eventLoopDelay.reset();
  return summary;
}

const databaseMetrics = {
  total: 0,
  errors: 0,
  rates: newRateBuckets(),
  latencies: [],
};

function escapeSql(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll("'", "''");
}
async function executeSql(statement) {
  return await withWebLatencyStage('db', async () => {
  const started = performance.now();
  databaseMetrics.total += 1;
  recordRate(databaseMetrics.rates);
  try {
    return (await databasePool.queryText(statement)).trim();
  } catch (error) {
    databaseMetrics.errors += 1;
    throw error;
  } finally {
    databaseMetrics.latencies.push(performance.now() - started);
    if (databaseMetrics.latencies.length > 2_048)
      databaseMetrics.latencies.splice(
        0,
        databaseMetrics.latencies.length - 2_048,
      );
  }
  });
}
async function sql(statement, category = 'player_required') {
  if (webHotPathDiagnosticEnabled)
    recordWebDiagnosticQuery(category === 'player_required' &&
      currentWebLatencyTrace()?.endpoint.startsWith('/api/admin/')
      ? 'admin_data' : category);
  if (/^\s*SELECT\b/i.test(statement)) return await executeSql(statement);
  const task = databaseQueue.then(() => executeSql(statement));
  databaseQueue = task.catch(() => {});
  return await task;
}

// C3 SERVER OPS: one cached runtime sampler for this Dashboard process. Browser
// requests read the cache; they never spawn PowerShell/CIM themselves.
const opsControlPlane = createOpsControlPlane({
  root,
  canonicalRathenaRoot: join(root, '.local', 'ro-stack', 'rathena'),
  canonicalPorts: { login: 6901, character: 6122, map: 5122 },
  databasePort: Number(databasePort),
  statePath: join(runtime, 'state.json'),
  dashboardPort: Number(port),
  sql,
});
opsControlPlane.start();

async function readQuestAuthority({ charId, accountId, questId, adapterId }) {
  const requestedQuestId = Number.isSafeInteger(Number(questId)) && Number(questId) > 0
    ? Number(questId)
    : 0;
  const adapter = adapterId
    ? jobQuestAdapters.get(String(adapterId).toUpperCase())
    : [...jobQuestAdapters.values()].find((candidate) =>
        candidate.questStateMapping.questIds?.includes(requestedQuestId),
      );
  const questIds = [...new Set([
    ...(adapter?.questStateMapping?.questIds ?? []),
    ...(requestedQuestId ? [requestedQuestId] : []),
  ])].filter((value) => Number.isSafeInteger(Number(value)) && Number(value) > 0);
  const variableKeys = [...new Set(adapter?.questStateMapping?.variables ?? [])]
    .filter((value) => /^[A-Za-z0-9_]{1,64}$/.test(value));
  const itemIds = [...new Set([
    ...(adapter?.requiredItems ?? []).map((item) => Number(item.itemId)),
    ...(adapter?.equipmentRequirements ?? []).map((item) => Number(item.itemId)),
  ])]
    .filter((value) => Number.isSafeInteger(value) && value > 0);
  const [output, questOutput, variableOutput, itemOutput, equippedItemOutput] = await Promise.all([
    sql(
      `SELECT c.class,c.base_level,c.job_level,c.hp,c.max_hp,c.sp,c.max_sp,c.skill_point,c.last_map,c.last_x,c.last_y,c.online,c.zeny,COALESCE(q.quest_id,''),COALESCE(q.state,'') FROM \`char\` c LEFT JOIN quest q ON q.char_id=c.char_id AND q.quest_id=${requestedQuestId} WHERE c.char_id=${Number(charId)} AND c.account_id=${Number(accountId)} LIMIT 1;`,
    ),
    questIds.length
      ? sql(`SELECT quest_id,state FROM quest WHERE char_id=${Number(charId)} AND quest_id IN (${questIds.join(',')});`)
      : '',
    variableKeys.length
      ? sql(`SELECT \`key\`,value FROM char_reg_num WHERE char_id=${Number(charId)} AND \`key\` IN (${variableKeys.map((key) => `'${key}'`).join(',')});`)
      : '',
    itemIds.length
      ? sql(`SELECT nameid,SUM(amount) FROM inventory WHERE char_id=${Number(charId)} AND nameid IN (${itemIds.join(',')}) GROUP BY nameid;`)
      : '',
    itemIds.length
      ? sql(`SELECT nameid,SUM(amount) FROM inventory WHERE char_id=${Number(charId)} AND equip<>0 AND nameid IN (${itemIds.join(',')}) GROUP BY nameid;`)
      : '',
  ]);
  if (!output) throw new HttpError(404, '角色不存在');
  const row = output.split('\t');
  const liveStatus = row[11] === '1'
    ? await currentStatusSnapshot(instanceId(accountId))
    : null;
  return {
    currentJob: Number(row[0]),
    baseLevel: Number(row[1]),
    jobLevel: Number(row[2]),
    hp: Number(liveStatus?.hp ?? row[3]),
    maxHp: Number(liveStatus?.maxHp ?? row[4]),
    sp: Number(liveStatus?.sp ?? row[5]),
    maxSp: Number(liveStatus?.maxSp ?? row[6]),
    skillPoint: Number(row[7]),
    map: liveStatus?.map ?? row[8],
    x: Number(liveStatus?.playerX ?? row[9]),
    y: Number(liveStatus?.playerY ?? row[10]),
    online: row[11] === '1',
    zeny: Number(liveStatus?.zeny ?? row[12]),
    questId: row[13] ? Number(row[13]) : null,
    questState: row[14] ? Number(row[14]) : null,
    questStates: Object.fromEntries(
      questOutput ? questOutput.split(/\r?\n/).map((line) => line.split('\t').map(Number)) : [],
    ),
    variables: Object.fromEntries(
      variableOutput ? variableOutput.split(/\r?\n/).map((line) => {
        const [key, value] = line.split('\t');
        return [key, Number(value)];
      }) : [],
    ),
    items: Object.fromEntries(
      itemOutput ? itemOutput.split(/\r?\n/).map((line) => line.split('\t').map(Number)) : [],
    ),
    equippedItems: Object.fromEntries(
      equippedItemOutput ? equippedItemOutput.split(/\r?\n/).map((line) => line.split('\t').map(Number)) : [],
    ),
    dead: Number(liveStatus?.hp ?? row[3]) <= 0,
    observedAt: new Date().toISOString(),
  };
}

const jobChangeCommitters = new Map(
  [...jobQuestAdapters].map(([adapterId, adapter]) => [
    adapterId,
    createAuthoritativeJobChangeCommitter({
      adapter,
      queueCharacterCommand,
      sendCommitCommand: sendQuestCommitCommand,
      authorityReader: readQuestAuthority,
    }),
  ]),
);
async function commitRegisteredJobChange(context) {
  const adapterId = String(context.payload?.adapterId ?? '').toUpperCase();
  const committer = jobChangeCommitters.get(adapterId);
  if (!committer) throw new Error('JOB_QUEST_ADAPTER_NOT_REGISTERED');
  return committer(context);
}

const questRuntimeStore = new MariaDbQuestRuntimeStore({ sql });
const questRuntimeService = new QuestRuntimeService({
  store: questRuntimeStore,
  authorityReader: readQuestAuthority,
  authoritativeCommitters: { [CommitType.JOB_CHANGE]: commitRegisteredJobChange },
});
// P2I: native SERVER_AGENT Quest Runtime transport. It enqueues the generic
// `run_server_command` / `start_navigation` primitives on the canonical
// `persistent_agent_command` queue. This is the only Quest Runtime transport.
const serverAgentQuestBridge = new ServerAgentQuestBridge({
  readAgentStateRevision: async (charId) => {
    const row = await readAgentStateRow(charId);
    return row ? Number(row.revision) : Number.NaN;
  },
  enqueueCommand: async ({ charId, accountId, action, payload, expectedRevision, commandId }) => {
    await queueOwnershipCommand(
      { accountId: Number(accountId), characterId: Number(charId) },
      Number(charId),
      { action, ...payload, expectedRevision, commandId },
    );
  },
});
// C4 / OPENKORE_BRIDGE_PRODUCTION_REACHABLE = NO: the legacy
// `OpenKoreQuestBridge` is no longer imported or instantiated. Quest Runtime
// dispatch is native-only. A non-SERVER_AGENT controller has no native Quest
// Runtime primitive, so it fails closed (NATIVE_CAPABILITY_GAP) rather than
// falling back to a filesystem `.cmd` transport.
const questRuntimeWatch = new Map(); // accountId -> lease expiry (in-memory only)
const questRuntimeDispatchBridge = {
  async dispatch(state) {
    const charId = Number(state.charId);
    const account = { accountId: Number(state.accountId), characterId: charId };
    const controller = await readCharacterControllerStatus(account, charId, {
      includeFarmTarget: false,
    });
    if (controller.available && controller.controller === SERVER_AGENT_OWNER)
      return await serverAgentQuestBridge.dispatch(state);
    if (!controller.available && controller.unavailableReason === 'agent_status_unavailable')
      throw new HttpError(503, '系統狀態暫時無法讀取，已停止操作以保護角色');
    throw new HttpError(501, 'NATIVE_CAPABILITY_GAP');
  },
  consumeAccount: async () => [],
  refreshWatchedAccounts: async () => questRuntimeWatch.size,
  consumeWatchedAccounts: async () => [],
  watchedAccountCount: () => questRuntimeWatch.size,
  watchAccount: (accountId) => {
    questRuntimeWatch.set(Number(accountId), Date.now() + 600_000);
  },
};
const assassinQuestService = new AssassinQuestService({
  runtimeService: questRuntimeService,
  bridge: questRuntimeDispatchBridge,
});
const rogueQuestService = new RogueQuestService({
  runtimeService: questRuntimeService,
  bridge: questRuntimeDispatchBridge,
});
const knightQuestService = new KnightQuestService({
  runtimeService: questRuntimeService,
  bridge: questRuntimeDispatchBridge,
});
const crusaderQuestService = new CrusaderQuestService({
  runtimeService: questRuntimeService,
  bridge: questRuntimeDispatchBridge,
});
const jobQuestServices = new Map([
  [ASSASSIN_JOB_ADAPTER.id, assassinQuestService],
  [ROGUE_JOB_ADAPTER.id, rogueQuestService],
  [KNIGHT_JOB_ADAPTER.id, knightQuestService],
  [CRUSADER_JOB_ADAPTER.id, crusaderQuestService],
]);

function registeredJobQuestService(adapterId) {
  const service = adapterId
    ? jobQuestServices.get(String(adapterId).toUpperCase())
    : null;
  if (!service) throw new HttpError(422, '二轉職業 Adapter 尚未註冊');
  return service;
}

// P2-OPENKORE-EXIT-MAINLINE: second-job automation is CLOSED_TEST only.
// All registered Quest Runtime job adapters (ASSASSIN/ROGUE/KNIGHT/CRUSADER)
// are second-job automation. The first-job / public native flow does NOT use
// these adapters and is intentionally NOT covered by this gate.
// Reuses existing authorization only: isolated automation allowlists and the
// existing web_account_flags.is_test privileged-test flag.
async function isSecondJobClosedTestAuthorized(account) {
  const accountId = Number(account?.accountId);
  const characterId = Number(account?.characterId);
  if (Number.isSafeInteger(accountId) && accountId > 0 && isolatedAutomationAccountAllowlist.has(accountId))
    return true;
  if (Number.isSafeInteger(characterId) && characterId > 0 && isolatedAutomationCharacterAllowlist.has(characterId))
    return true;
  if (!Number.isSafeInteger(accountId) || accountId <= 0) return false;
  const row = await sql(
    `SELECT is_test FROM web_account_flags WHERE account_id=${accountId} LIMIT 1;`,
  );
  return String(row ?? '').split('\t')[0].trim() === '1';
}
// Second-job routes fail closed with HTTP 403 { code: 'CLOSED_TEST_ONLY' }
// BEFORE any queueCharacterCommand / OpenKoreQuestBridge.dispatch / startWorker
// / .cmd creation / OpenKore controller activation.
let questCallbackPumpActive = false;
let questCallbackRecoveryDiscoveryComplete = false;
async function consumeQuestRuntimeCallbacks() {
  if (questCallbackPumpActive) return;
  questCallbackPumpActive = true;
  try {
    if (!questCallbackRecoveryDiscoveryComplete) {
      await questRuntimeDispatchBridge.refreshWatchedAccounts();
      questCallbackRecoveryDiscoveryComplete = true;
    }
    await questRuntimeDispatchBridge.consumeWatchedAccounts();
  } catch (error) {
    if (error?.code !== 'ENOENT')
      console.error('Quest callback pump failed:', error);
  } finally {
    questCallbackPumpActive = false;
  }
}
const questCallbackTimer = setInterval(consumeQuestRuntimeCallbacks, 1_000);
questCallbackTimer.unref();

async function readQuestRuntimeForAccount(account) {
  try {
    const identity = {
      charId: Number(account.characterId),
      accountId: Number(account.accountId),
    };
    const current = await questRuntimeService.readPublicState(identity);
    const initialProjection = await withAvailableCareerTargets(identity, current);
    const detailAdapterId = initialProjection.careerDetail?.adapterId;
    if (!detailAdapterId) return initialProjection;
    const service = registeredJobQuestService(detailAdapterId);
    const questRuntime = await service.reconcile(identity);
    return await withAvailableCareerTargets(
      identity,
      questRuntime,
      service.adapter.id,
    );
  } catch (error) {
    if (/web_quest_runtime|doesn't exist|does not exist/i.test(String(error?.message ?? error))) {
      return { available: false, reason: 'QUEST_RUNTIME_SCHEMA_NOT_INSTALLED' };
    }
    throw error;
  }
}

async function withAvailableCareerTargets(identity, questRuntime, adapterId) {
    const authority = await readQuestAuthority({
      ...identity,
      questId: questRuntime.questId,
      adapterId,
    });
    const projection = jobQuestAdapters.careerProjection(authority, questRuntime);
    return {
      ...questRuntime,
      ...projection,
    };
}

const ownershipActions = new Set([
  'claim_agent',
  'release_agent',
  'start_farm',
  'start_navigation',
  'prepare_farm_switch',
  'configure_supply_policy',
  'resume_paid_farm_switch',
  'world_map_teleport',
  'set_saved_town',
  'equip_item',
  'unequip_item',
  'allocate_stat_point',
  'allocate_skill_point',
  'reset_character_stat',
  'reset_character_skill',
  'use_item',
  'card_insert',
  'talk_to_npc',
    'dialog_next',
    'dialog_select',
    'dialog_input',
  'dialog_close',
  'service_shop_buy',
  'service_shop_sell',
  'service_storage_deposit',
  'service_storage_withdraw',
  'service_save_point',
  'service_transport',
  'start_quest',
  'start_quest_sequence',
  'run_server_command',
  'cancel_task',
  'stop',
  'stop_farm',
]);
const rolloutGatedActions = new Set([
  'claim_agent',
  'start_farm',
  'start_navigation',
  'prepare_farm_switch',
  'configure_supply_policy',
  'resume_paid_farm_switch',
  'world_map_teleport',
  'set_saved_town',
  'talk_to_npc',
  'service_shop_buy',
  'service_shop_sell',
  'service_storage_deposit',
  'service_storage_withdraw',
  'service_save_point',
  'service_transport',
  'start_quest',
  'start_quest_sequence',
  'run_server_command',
]);
const commandIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const questSequenceStepTypes = new Set([
  'GO_NPC', 'TALK_NPC', 'DIALOG_NEXT', 'DIALOG_MENU_SELECT',
  'ACCEPT_QUEST', 'WAIT_QUEST_STATE', 'GO_MAP', 'USE_ITEM', 'KILL_MONSTER',
  'COLLECT_ITEM', 'RETURN_NPC', 'COMPLETE_QUEST', 'CONFIRM_REWARD', 'FARM_UNTIL',
  // Native Quest Engine CP1-1/CP1-2 control flow + generic skill allocation.
  // Web is validator/dispatcher only; the native PA is the sole executor.
  // Restores the lost last-good `sendAddSkillPoint` semantics on top of the
  // existing native allocate_skill_point capability (skill-agnostic; NV_BASIC
  // is content, not code).
  'CONDITION', 'BRANCH', 'REPEAT_UNTIL', 'ALLOCATE_SKILL',
]);
const questSequenceStates = new Set(['ABSENT', 'ACTIVE', 'COMPLETE', 'HUNTING_COMPLETE']);
// Mirrors native persistent_agent_quest_condition.inc readers/operators.
const questConditionReaders = new Set([
  'job_level', 'base_level', 'skill_level', 'skill_point',
  'hp_percent', 'item_amount', 'quest_state',
]);
const questConditionOperators = new Set(['eq', 'ne', 'lt', 'lte', 'gt', 'gte']);
// Mirrors native CP1-0/CP1-2 bounds
// (persistent_agent_quest_sequence_step_parser.inc).
const MAX_QUEST_SEQUENCE_NESTING_DEPTH = 4;
const MAX_QUEST_NESTED_STEPS = 128;
const MAX_QUEST_REPEAT_ITERATIONS = 1000;
const MAX_QUEST_REPEAT_DEADLINE_MS = 3600000;
const MAX_QUEST_ALLOCATE_SKILL_LEVEL = 10;
const rAthenaNpcNamePattern = /^[\p{L}\p{N}_# ]{1,31}$/u;
// rAthena map names may contain '-' (new_1-3) and '@' (instance maps); the
// native executor resolves maps via map_mapname2mapid, so the Web validator
// must not reject a legitimate map before dispatch.
const sequenceMapPattern = /^[a-z0-9_@-]{1,31}$/;

// Native CP1-1 CONDITION schema: { read, op, value, skillId?/itemId?/questId? }.
function normalizeQuestCondition(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new HttpError(422, 'invalid_transition');
  const read = String(input.read ?? '');
  const op = String(input.op ?? '');
  const value = Number(input.value);
  if (!questConditionReaders.has(read) || !questConditionOperators.has(op) ||
      !Number.isSafeInteger(value))
    throw new HttpError(422, 'invalid_transition');
  const condition = { type: 'CONDITION', read, op, value };
  if (read === 'skill_level') {
    const skillId = Number(input.skillId);
    if (!Number.isSafeInteger(skillId) || skillId <= 0 || skillId > 65535)
      throw new HttpError(422, 'invalid_transition');
    condition.skillId = skillId;
  } else if (read === 'item_amount') {
    const itemId = Number(input.itemId);
    if (!Number.isSafeInteger(itemId) || itemId <= 0 || itemId > 4294967295)
      throw new HttpError(422, 'invalid_transition');
    condition.itemId = itemId;
  } else if (read === 'quest_state') {
    const questId = Number(input.questId);
    if (!Number.isSafeInteger(questId) || questId <= 0)
      throw new HttpError(422, 'invalid_transition');
    condition.questId = questId;
  }
  return condition;
}

function normalizeQuestSequenceStep(input, depth = 0) {
  if (!Number.isSafeInteger(depth) || depth < 0 || depth > MAX_QUEST_SEQUENCE_NESTING_DEPTH)
    throw new HttpError(422, 'invalid_transition');
  const type = String(input?.type ?? '');
  if (!questSequenceStepTypes.has(type))
    throw new HttpError(422, 'invalid_transition');
  const step = { type };
  const npcTypes = new Set(['GO_NPC', 'TALK_NPC', 'RETURN_NPC']);
  if (npcTypes.has(type)) {
    const npcName = String(input.npcName ?? '');
    const map = String(input.map ?? '');
    if (!rAthenaNpcNamePattern.test(npcName) || !/^[a-z0-9_@-]{1,31}$/.test(map))
      throw new HttpError(422, 'invalid_transition');
    step.npcName = npcName;
    step.map = map;
  }
  if (type === 'DIALOG_NEXT' || type === 'DIALOG_MENU_SELECT') {
    const expectedDialogState = String(input.expectedDialogState ?? '');
    if (!/^[A-Z_]{1,32}$/.test(expectedDialogState))
      throw new HttpError(422, 'invalid_transition');
    step.expectedDialogState = expectedDialogState;
  }
  if (type === 'DIALOG_MENU_SELECT') {
    const index = Number(input.index);
    if (!Number.isSafeInteger(index) || index < 1 || index > 254)
      throw new HttpError(422, 'invalid_transition');
    step.index = index;
  }
  if (['ACCEPT_QUEST', 'WAIT_QUEST_STATE', 'COMPLETE_QUEST'].includes(type)) {
    const questId = Number(input.questId);
    const expectedState = String(input.expectedState ?? '');
    if (!Number.isSafeInteger(questId) || questId <= 0 || !questSequenceStates.has(expectedState))
      throw new HttpError(422, 'invalid_transition');
    step.questId = questId;
    step.expectedState = expectedState;
  }
  if (type === 'GO_MAP') {
    const map = String(input.map ?? '');
    const x = Number(input.x ?? 0);
    const y = Number(input.y ?? 0);
    if (!/^[a-z0-9_@-]{1,31}$/.test(map) || !Number.isSafeInteger(x) || x < 0 || x > 32767 ||
        !Number.isSafeInteger(y) || y < 0 || y > 32767)
      throw new HttpError(422, 'invalid_transition');
    Object.assign(step, { map, x, y });
  }
  if (['GO_NPC', 'GO_MAP', 'RETURN_NPC'].includes(type)) {
    const destinationType = String(input.destinationType ?? '');
    const expectedArrivalCondition = String(input.expectedArrivalCondition ?? '');
    const npcDestination = type !== 'GO_MAP';
    if ((npcDestination && (destinationType !== 'NPC' || expectedArrivalCondition !== 'NPC_INTERACTION_RANGE')) ||
        (!npcDestination && (destinationType !== 'MAP_POSITION' || expectedArrivalCondition !== 'MAP_POSITION')) ||
        !Array.isArray(input.route) || input.route.length < 1 || input.route.length > 16)
      throw new HttpError(422, 'invalid_transition');
    const route = input.route.map((entry) => {
      const map = String(entry?.map ?? '');
      const x = Number(entry?.x);
      const y = Number(entry?.y);
      const portalTo = String(entry?.portalTo ?? '');
      if (!/^[a-z0-9_@-]{1,31}$/.test(map) || !Number.isSafeInteger(x) || x < 0 || x > 32767 ||
          !Number.isSafeInteger(y) || y < 0 || y > 32767 ||
          (portalTo && !/^[a-z0-9_@-]{1,31}$/.test(portalTo)))
        throw new HttpError(422, 'invalid_transition');
      return portalTo ? { map, x, y, portalTo } : { map, x, y };
    });
    const maxRetries = Number(input.retryPolicy?.maxRetries);
    const timeoutMs = Number(input.retryPolicy?.timeoutMs);
    if (!Number.isSafeInteger(maxRetries) || maxRetries < 0 || maxRetries > 10 ||
        !Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000)
      throw new HttpError(422, 'invalid_transition');
    Object.assign(step, {
      destinationType,
      route,
      retryPolicy: { maxRetries, timeoutMs },
      expectedArrivalCondition,
    });
  }
  if (type === 'FARM_UNTIL') {
    const map = String(input.map ?? '');
    if (!sequenceMapPattern.test(map)) throw new HttpError(422, 'invalid_transition');
    step.map = map;
    step.condition = normalizeQuestCondition(input.condition);
  }
  if (type === 'KILL_MONSTER') {
    const map = String(input.map ?? '');
    const questId = Number(input.questId);
    const mobId = Number(input.mobId);
    const count = Number(input.count);
    if (!/^[a-z0-9_@-]{1,31}$/.test(map) || !Number.isSafeInteger(questId) || questId <= 0 ||
        !Number.isSafeInteger(mobId) || mobId <= 0 || !Number.isSafeInteger(count) || count < 1 || count > 1000)
      throw new HttpError(422, 'invalid_transition');
    Object.assign(step, { map, questId, mobId, count });
    const hasLeash =
      input.leashX !== undefined ||
      input.leashY !== undefined ||
      input.leashRange !== undefined;
    if (hasLeash) {
      const leashX = Number(input.leashX);
      const leashY = Number(input.leashY);
      const leashRange = Number(input.leashRange);
      if (
        !Number.isSafeInteger(leashX) || leashX < 0 || leashX > 32767 ||
        !Number.isSafeInteger(leashY) || leashY < 0 || leashY > 32767 ||
        !Number.isSafeInteger(leashRange) || leashRange < 1 || leashRange > 200
      )
        throw new HttpError(422, 'invalid_transition');
      Object.assign(step, { leashX, leashY, leashRange });
    }
  }
  if (type === 'USE_ITEM') {
    const itemId = Number(input.itemId);
    if (!Number.isSafeInteger(itemId) || itemId <= 0 || itemId > 4294967295)
      throw new HttpError(422, 'invalid_transition');
    step.itemId = itemId;
  }
  if (type === 'COLLECT_ITEM') {
    const itemId = Number(input.itemId);
    const count = Number(input.count);
    if (!Number.isSafeInteger(itemId) || itemId <= 0 || itemId > 4294967295 ||
        !Number.isSafeInteger(count) || count < 1 || count > 30000)
      throw new HttpError(422, 'invalid_transition');
    Object.assign(step, { itemId, count });
  }
  if (type === 'ALLOCATE_SKILL') {
    // Generic: the executor reads the authoritative current level, confirms a
    // real skill point, dispatches native allocate_skill_point, waits for the
    // server-confirmed read-model change, and repeats until targetLevel or a
    // blocked condition. No DB skill mutation is permitted.
    const skillId = Number(input.skillId);
    const targetLevel = Number(input.targetLevel);
    if (!Number.isSafeInteger(skillId) || skillId <= 0 || skillId > 65535 ||
        !Number.isSafeInteger(targetLevel) || targetLevel < 1 ||
        targetLevel > MAX_QUEST_ALLOCATE_SKILL_LEVEL)
      throw new HttpError(422, 'invalid_transition');
    Object.assign(step, { skillId, targetLevel });
  }
  if (type === 'CONFIRM_REWARD') {
    if (!Array.isArray(input.expectedRewards) || input.expectedRewards.length < 1 || input.expectedRewards.length > 16)
      throw new HttpError(422, 'invalid_transition');
    step.expectedRewards = input.expectedRewards.map((reward) => {
      const itemId = Number(reward?.itemId);
      const count = Number(reward?.count);
      if (!Number.isSafeInteger(itemId) || itemId <= 0 || itemId > 4294967295 ||
          !Number.isSafeInteger(count) || count < 1 || count > 30000)
        throw new HttpError(422, 'invalid_transition');
      return { itemId, count };
    });
    for (const field of ['minimumBaseExpDelta', 'minimumJobExpDelta', 'minimumZenyDelta']) {
      const value = Number(input[field] ?? 0);
      if (!Number.isSafeInteger(value) || value < 0)
        throw new HttpError(422, 'invalid_transition');
      step[field] = value;
    }
  }
  if (input.expectedDestinationMap !== undefined) {
    const expectedDestinationMap = String(input.expectedDestinationMap);
    if (!sequenceMapPattern.test(expectedDestinationMap))
      throw new HttpError(422, 'invalid_transition');
    step.expectedDestinationMap = expectedDestinationMap;
  }
  // Native CP1-1 CONDITION: read authoritative PA/native state only.
  if (type === 'CONDITION') return normalizeQuestCondition(input);
  // Native CP1-2 BRANCH: nested children recurse through the SAME vocabulary.
  if (type === 'BRANCH') {
    if (!Array.isArray(input.thenSteps) || !Array.isArray(input.elseSteps) ||
        input.thenSteps.length > MAX_QUEST_NESTED_STEPS ||
        input.elseSteps.length > MAX_QUEST_NESTED_STEPS)
      throw new HttpError(422, 'invalid_transition');
    step.condition = normalizeQuestCondition(input.condition);
    step.thenSteps = input.thenSteps.map((child) =>
      normalizeQuestSequenceStep(child, depth + 1));
    step.elseSteps = input.elseSteps.map((child) =>
      normalizeQuestSequenceStep(child, depth + 1));
    return step;
  }
  // Native CP1-2 REPEAT_UNTIL: bounded iterations + optional deadline; the
  // native executor waits for authoritative state change between passes.
  if (type === 'REPEAT_UNTIL') {
    const maxIterations = Number(input.maxIterations);
    if (!Number.isSafeInteger(maxIterations) || maxIterations < 1 ||
        maxIterations > MAX_QUEST_REPEAT_ITERATIONS)
      throw new HttpError(422, 'invalid_transition');
    if (!Array.isArray(input.bodySteps) || input.bodySteps.length < 1 ||
        input.bodySteps.length > MAX_QUEST_NESTED_STEPS)
      throw new HttpError(422, 'invalid_transition');
    step.condition = normalizeQuestCondition(input.condition);
    step.bodySteps = input.bodySteps.map((child) =>
      normalizeQuestSequenceStep(child, depth + 1));
    step.maxIterations = maxIterations;
    if (input.deadlineMs !== undefined) {
      const deadlineMs = Number(input.deadlineMs);
      if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 0 ||
          deadlineMs > MAX_QUEST_REPEAT_DEADLINE_MS)
        throw new HttpError(422, 'invalid_transition');
      step.deadlineMs = deadlineMs;
    }
    return step;
  }
  return step;
}

function noviceOnboardingPayload() {
  const env = noviceOnboardingAllowlist?.env;
  if (
    noviceOnboardingSequence?.schema !== 'ro-quest-sequence/v1' ||
    noviceOnboardingSequence.sequenceId !== 'novice_onboarding' ||
    Number(noviceOnboardingSequence.taskId) !== 7100001 ||
    noviceOnboardingSequence.enabled !== true ||
    noviceOnboardingSequence.engineStatus !== 'READY' ||
    !env ||
    !Array.isArray(env.PERSISTENT_AGENT_QUEST_TASKS) ||
    !env.PERSISTENT_AGENT_QUEST_TASKS.includes(7100001) ||
    !Array.isArray(env.PERSISTENT_AGENT_QUEST_SEQUENCES) ||
    !env.PERSISTENT_AGENT_QUEST_SEQUENCES.includes('novice_onboarding')
  )
    throw new HttpError(409, 'novice_sequence_unavailable');

  const steps = noviceOnboardingSequence.steps.map((input) =>
    normalizeQuestSequenceStep(input, 0),
  );
  const npcAllowlist = new Set(env.PERSISTENT_AGENT_NPCS ?? []);
  const npcMapAllowlist = new Set(env.PERSISTENT_AGENT_NPC_MAPS ?? []);
  const navigationMapAllowlist = new Set(env.PERSISTENT_AGENT_NAVIGATION_MAPS ?? []);
  const farmMapAllowlist = new Set(env.PERSISTENT_AGENT_FARM_MAPS ?? []);
  const questAllowlist = new Set(env.PERSISTENT_AGENT_QUEST_IDS ?? []);
  for (const step of steps) {
    if (step.npcName && !npcAllowlist.has(step.npcName))
      throw new HttpError(409, 'novice_sequence_not_allowlisted');
    if (step.type === 'FARM_UNTIL') {
      if (!farmMapAllowlist.has(step.map))
        throw new HttpError(409, 'novice_sequence_not_allowlisted');
    } else if (step.map && !npcMapAllowlist.has(step.map) &&
      !navigationMapAllowlist.has(step.map)) {
      throw new HttpError(409, 'novice_sequence_not_allowlisted');
    }
    if (step.questId && !questAllowlist.has(step.questId))
      throw new HttpError(409, 'novice_sequence_not_allowlisted');
    if (step.expectedDestinationMap &&
      !npcMapAllowlist.has(step.expectedDestinationMap) &&
      !navigationMapAllowlist.has(step.expectedDestinationMap))
      throw new HttpError(409, 'novice_sequence_not_allowlisted');
  }
  return {
    taskId: 7100001,
    sequenceId: 'novice_onboarding',
    steps,
  };
}

function parseOwnershipCommandRow(output) {
  if (!output) return null;
  const row = output.split('\t');
  return {
    commandId: row[0],
    charId: Number(row[1]),
    action: row[2],
    expectedRevision: Number(row[3]),
    status: row[4],
    reasonCode: row[5] || null,
    resultingRevision: row[6] ? Number(row[6]) : null,
    acceptedAt: row[7] || null,
    confirmedAt: row[8] || null,
  };
}

async function getOwnershipStatus(account, charId) {
  if (Number(account.characterId) !== charId)
    throw new HttpError(403, 'ownership_conflict');
  const output = await sql(
    `SELECT char_id,account_id,control_owner,ownership_state,agent_enabled,agent_mode,revision,COALESCE(last_command_id,''),COALESCE(last_error_code,''),updated_at,COALESCE(task_type,''),COALESCE(task_phase,''),COALESCE(target_map,''),COALESCE(target_rules,'') FROM persistent_agent_state WHERE char_id=${charId} AND account_id=${Number(account.accountId)} LIMIT 1;`,
  );
  if (!output) throw new HttpError(404, 'ownership_not_found');
  const row = output.split('\t');
  return {
    charId: Number(row[0]),
    accountId: Number(row[1]),
    owner: row[2],
    ownershipState: row[3],
    agentEnabled: row[4] === '1',
    agentMode: row[5],
    revision: Number(row[6]),
    lastCommandId: row[7] || null,
    lastErrorCode: row[8] || null,
    updatedAt: row[9],
    taskType: row[10] || null,
    taskPhase: row[11] || null,
    targetMap: row[12] || null,
    targetRules: row[13] ? JSON.parse(row[13]) : null,
  };
}

async function getOwnershipStatusOrNull(account, charId) {
  try {
    return await getOwnershipStatus(account, charId);
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 404) return null;
    // Fail-safe: a missing/unavailable SERVER_AGENT state source must never
    // take down the rest of the character page (OpenKore path stays usable).
    if (agentStateSchemaUnavailable(error)) return null;
    throw error;
  }
}

// --- Web <-> SERVER_AGENT canary adapter (read-only) -----------------------
// The browser must render the authoritative controller of a character instead
// of inferring it from page mode. These helpers only read the existing agent
// ownership row and the existing rollout allowlist gate; they never mutate
// ownership. A failure of the agent state source is surfaced as an explicit
// unavailable status so one canary can never break the rest of the dashboard.

function parseAgentStateRow(output) {
  if (!output) return null;
  const row = output.split('\t');
  return {
    charId: Number(row[0]),
    accountId: Number(row[1]),
    agentEnabled: row[2] === '1',
    controlOwner: row[3],
    ownershipState: row[4],
    agentMode: row[5],
    revision: Number(row[6]),
    runtimeState: row[7] || 'INACTIVE',
    taskType: row[8] || null,
    taskPhase: row[9] || null,
    targetMap: row[10] || null,
    targetRules: row[11] || null,
    lastCommandId: row[12] || null,
    lastErrorCode: row[13] || null,
  };
}

async function readAgentStateRow(charId) {
  const output = await sql(
    `SELECT char_id,account_id,agent_enabled,control_owner,ownership_state,agent_mode,revision,COALESCE(runtime_state,'INACTIVE'),COALESCE(task_type,''),COALESCE(task_phase,''),COALESCE(target_map,''),COALESCE(target_rules,''),COALESCE(last_command_id,''),COALESCE(last_error_code,'') FROM persistent_agent_state WHERE char_id=${Number(charId)} LIMIT 1;`,
  );
  return parseAgentStateRow(output);
}

function agentStateSchemaUnavailable(error) {
  return /persistent_agent_state.*(?:doesn't exist|does not exist)|Unknown table/i.test(
    String(error?.message ?? error),
  );
}

// --- SERVER_AGENT live-status READ MODEL (observation only) ----------------
// The map-server Persistent Agent exports authoritative live rAthena state into
// `persistent_agent_live_status`. The Dashboard only reads it. A missing row,
// a non-resident character or an old `updated_at` is surfaced as an explicit
// unavailable/stale status and the page keeps the save-driven values instead of
// pretending they are live.
function persistentAgentLiveStatusSchemaUnavailable(error) {
  return /persistent_agent_live_status.*(?:doesn't exist|does not exist)|Unknown table/i.test(
    String(error?.message ?? error),
  );
}

function parsePersistentAgentLiveStatusRow(output) {
  if (!output) return null;
  const row = output.split('\t');
  return {
    charId: Number(row[0]),
    accountId: Number(row[1]),
    revision: Number(row[2]),
    resident: row[3] === '1',
    hp: Number(row[4]),
    maxHp: Number(row[5]),
    sp: Number(row[6]),
    maxSp: Number(row[7]),
    zeny: Number(row[8]),
    map: row[9] || null,
    x: Number(row[10]),
    y: Number(row[11]),
    runtimePhase: row[12] || 'IDLE',
    supplyItemId: Number(row[13]),
    supplyItemAmount: Number(row[14]),
    controlOwner: row[15] || null,
    ownershipState: row[16] || null,
    runtimeState: row[17] || null,
    agentMode: row[18] || null,
    updatedAt: row[19] || null,
    ageMs: Number(row[20]),
  };
}

async function readPersistentAgentLiveStatusRow(charId) {
  try {
    const output = await sql(
      `SELECT char_id,account_id,revision,resident,hp,max_hp,sp,max_sp,zeny,COALESCE(map,''),x,y,COALESCE(runtime_phase,'IDLE'),supply_item_id,supply_item_amount,COALESCE(control_owner,''),COALESCE(ownership_state,''),COALESCE(runtime_state,''),COALESCE(agent_mode,''),updated_at,ROUND(TIMESTAMPDIFF(MICROSECOND,updated_at,CURRENT_TIMESTAMP(3))/1000) FROM persistent_agent_live_status WHERE char_id=${Number(charId)} LIMIT 1;`,
    );
    return parsePersistentAgentLiveStatusRow(output);
  } catch (error) {
    // Fail-soft: a missing read model must never break the character page.
    if (persistentAgentLiveStatusSchemaUnavailable(error)) return null;
    throw error;
  }
}

async function readPersistentAgentLiveStatusView(charId) {
  return createLiveStatusView(await readPersistentAgentLiveStatusRow(charId), {
    maxAgeMs: LIVE_STATUS_MAX_AGE_MS,
  });
}
// M1 map-switch admission reads a native decision from the same authoritative
// live-status exporter. The native stop_farm and teleport commands recheck it;
// this read only prevents an avoidable stop when service is already required.
const supplyPreflightWarningChars = new Set();
async function readFarmMapSupplyPreflight(account, controller) {
  const charId = Number(account.characterId);
  let snapshot = null;
  try {
    const output = await sql(
      `SELECT char_id,account_id,revision,resident,COALESCE(map,''),ROUND(TIMESTAMPDIFF(MICROSECOND,updated_at,CURRENT_TIMESTAMP(3))/1000),inventory_slots,inventory_max_slots,weight,max_weight,supply_required,COALESCE(supply_reason,'') FROM persistent_agent_live_status WHERE char_id=${charId} AND account_id=${Number(account.accountId)} LIMIT 1;`,
    );
    if (output) {
      const row = output.split('\t');
      const integer = (value) => /^\d+$/.test(String(value ?? '')) ? Number(value) : null;
      snapshot = {
        charId: integer(row[0]), accountId: integer(row[1]), revision: integer(row[2]),
        resident: row[3] === '1', map: row[4], ageMs: integer(row[5]),
        inventorySlots: integer(row[6]), inventoryMaxSlots: integer(row[7]),
        weight: integer(row[8]), maxWeight: integer(row[9]),
        supplyRequired: row[10] === '1' ? true : row[10] === '0' ? false : null,
        supplyReason: row[11] || null,
      };
    }
  } catch (error) {
    // Older schema and read failures are both an unavailable preflight. They
    // cannot authorize a destructive map switch.
    if (!supplyPreflightWarningChars.has(charId)) {
      supplyPreflightWarningChars.add(charId);
      console.warn(`FARM_MAP_SUPPLY_PREFLIGHT_UNAVAILABLE char=${charId}: ${error?.message ?? error}`);
    }
  }
  return farmMapSupplyPreflight(snapshot, { accountId: Number(account.accountId),
    charId, revision: Number(controller.revision),
    currentMap: controller.liveStatus?.map ?? null,
    maxAgeMs: LIVE_STATUS_MAX_AGE_MS });
}

async function loadNativeSupplyPolicy(account) {
  try {
    const { config } = await loadCanonicalConfig({ instancesRoot,
      accountId: Number(account.accountId), characterId: Number(account.characterId),
      persistMigration: true });
    return nativeSupplyPolicy(config);
  } catch (error) {
    console.warn(`SUPPLY_POLICY_UNAVAILABLE char=${Number(account.characterId)}: ${error?.message ?? error}`);
    throw new HttpError(503, 'SUPPLY_POLICY_UNAVAILABLE');
  }
}

async function buildCanonicalFarmRules(account, base) {
  const charId = Number(account.characterId);
  const { config } = await loadCanonicalConfig({ instancesRoot,
    accountId: Number(account.accountId), characterId: charId,
    persistMigration: false });
  const requested = { ...base };
  if (requested.skillEnabled === undefined)
    requested.skillEnabled = ['SKILL_CAST', 'HYBRID_DAMAGE'].includes(config.combat.profile);
  const executionProfile = resolveFarmExecutionProfile(config, requested);
  if (!executionProfile.ok)
    throw new HttpError(409, executionProfile.reason);
  const farmRules = { ...requested, ...executionProfile.payload };
  if (farmRules.skillEnabled &&
      (!Number.isSafeInteger(farmRules.skillId) || farmRules.skillId <= 0))
    throw new HttpError(422, 'invalid_transition');
  if (nativeSupplyPolicyCommandEnabled) {
    try { farmRules.supplyPolicy = nativeSupplyPolicy(config); }
    catch { throw new HttpError(503, 'SUPPLY_POLICY_UNAVAILABLE'); }
    if (farmRules.supplyPolicy.enabled) {
      const services = await nativeSupplyServicePlan(account);
      Object.assign(farmRules, services);
      // Keep the previous single-shop keys for the existing low-consumable path.
      farmRules.supplyServiceRoute = services.shopServiceRoute;
      farmRules.supplyNpcName = services.shopNpcName;
    }
  }
  if (!nativeSupplyPolicyCommandEnabled || !farmRules.supplyPolicy.enabled) {
    const savePoint = await readCharacterSavePoint(account.accountId, charId);
    const shop = SUPPLY_TOWN_SERVICES[savePoint?.map];
    if (shop) {
      const graph = await serverAgentWarpGraph();
      const route = buildTerminalRoute(graph, savePoint.map,
        shop.map, shop.x, shop.y);
      if (!route) throw new HttpError(409, 'SAVED_TOWN_SERVICE_UNAVAILABLE');
      farmRules.supplyServiceRoute = route;
      farmRules.supplyNpcName = shop.npc;
    }
  }
  return farmRules;
}

async function nativeSupplyServicePlan(account) {
  const savePoint = await readCharacterSavePoint(account.accountId,
    account.characterId);
  const storage = SUPPLY_TOWN_STORAGE[savePoint?.map];
  const shop = SUPPLY_TOWN_SERVICES[savePoint?.map];
  if (!storage || !shop || storage.map !== savePoint.map)
    throw new HttpError(409, 'SUPPLY_HOME_REQUIRED');
  const graph = await serverAgentWarpGraph();
  const storageServiceRoute = buildTerminalRoute(graph, savePoint.map,
    storage.map, storage.x, storage.y);
  const shopServiceRoute = buildTerminalRoute(graph, savePoint.map,
    shop.map, shop.x, shop.y);
  if (!storageServiceRoute || !shopServiceRoute)
    throw new HttpError(409, 'SUPPLY_SERVICE_UNAVAILABLE');
  return { storageNpcName: storage.npc, shopNpcName: shop.npc,
    storageMenuIndex: storage.storageMenuIndex,
    storageServiceRoute, shopServiceRoute };
}


// True when the character is owned by the native SERVER_AGENT controller. Used
// by the combat terminal to pick the native Event Ledger source instead of the
// OpenKore worker text log. Tolerates a missing read model and never throws.
async function characterIsServerAgentControlled(characterId) {
  const charId = Number(characterId);
  if (!Number.isSafeInteger(charId) || charId <= 0) return false;
  try {
    const live = await readPersistentAgentLiveStatusRow(charId);
    return (
      live?.controlOwner === SERVER_AGENT_OWNER &&
      live?.ownershipState === SERVER_AGENT_OWNER
    );
  } catch {
    return false;
  }
}

// Native SERVER_AGENT combat terminal source. A SERVER_AGENT-owned character
// has no OpenKore worker text log, so the last-good text-log projection is
// always empty for it. The combat terminal is fed from the authoritative
// rAthena Persistent Life event ledger instead. Read-only, bounded, and only
// used when the character is owned by SERVER_AGENT.
function persistentLifeEventSchemaUnavailable(error) {
  return /persistent_life_event.*(?:doesn't exist|does not exist)|Unknown table/i.test(
    String(error?.message ?? error),
  );
}

function nativeCombatEventLineForRow(event) {
  let mobName = '';
  let itemName = '';
  if (event.eventType.startsWith('MONSTER_')) {
    const mobId = Number(event.facts.mobId);
    if (Number.isSafeInteger(mobId) && mobId > 0)
      mobName = resolveMonsterDisplayName({ mobId }) ?? '';
  } else if (event.eventType === 'LOOT_ACQUIRED') {
    const itemId = Number(event.facts.itemId);
    if (Number.isSafeInteger(itemId) && itemId > 0)
      itemName = localizedItemName(itemId) ?? '';
  }
  return nativeLifeEventLine({ ...event, mobName, itemName });
}

async function readNativeCombatLog(
  characterId,
  requestedEventId,
  limit = logProjectionInitialLines,
) {
  const charId = Number(characterId);
  if (!Number.isSafeInteger(charId) || charId <= 0)
    return { available: false, lines: [], cursor: 0, reset: true };
  const hasCursor =
    Number.isSafeInteger(requestedEventId) && requestedEventId > 0;
  const types = NATIVE_COMBAT_EVENT_TYPES.map((type) => `'${type}'`).join(',');
  let output;
  try {
    output = await sql(
      `SELECT event_id,event_type,map,facts FROM persistent_life_event ` +
        `WHERE char_id=${charId} AND event_type IN (${types}) ` +
        `ORDER BY occurred_at DESC, event_id DESC LIMIT ${Number(limit)};`,
    );
  } catch (error) {
    if (persistentLifeEventSchemaUnavailable(error))
      return { available: false, lines: [], cursor: 0, reset: true };
    throw error;
  }
  const events = (output ? output.split(/\r?\n/) : [])
    .filter(Boolean)
    .map((line) => {
      const row = line.split('\t');
      return {
        eventId: Number(row[0]),
        eventType: row[1] || '',
        map: row[2] && row[2] !== 'NULL' ? row[2] : '',
        facts: parseLifeEventFacts(row[3]),
      };
    })
    .filter((event) => Number.isSafeInteger(event.eventId))
    .sort((left, right) => left.eventId - right.eventId);
  const newest = events.reduce(
    (maximum, event) => Math.max(maximum, event.eventId),
    0,
  );
  if (!hasCursor)
    return {
      available: true,
      lines: events.map(nativeCombatEventLineForRow).filter(Boolean),
      cursor: newest,
      reset: true,
    };
  return {
    available: true,
    lines: events
      .filter((event) => event.eventId > requestedEventId)
      .map(nativeCombatEventLineForRow)
      .filter(Boolean),
    cursor: Math.max(requestedEventId, newest),
    reset: false,
  };
}

// Farm Statistics PA projection source (Farm Stats PA Migration). A
// SERVER_AGENT-owned character has no OpenKore worker text log, so the legacy
// logProjectionSummary() is always empty for it. This reads the authoritative
// farm session (FARM_SESSION_STARTED / FARM_SESSION_STOPPED, boundary =
// start_farm -> stop_farm), the authoritative Event Ledger aggregates and the
// persisted EXP baseline. It never parses a text log, never starts OpenKore and
// creates no second statistics engine.
const farmStatsLootItemName = (itemId) => {
  const name = localizedItemName(Number(itemId));
  return name || `Item #${Number(itemId) || 0}`;
};

async function readNativeFarmStats(characterId) {
  const charId = Number(characterId);
  if (!Number.isSafeInteger(charId) || charId <= 0) return { available: false };
  let startRow;
  let stopRow;
  let killsRaw;
  let deathsRaw;
  let lootRaw;
  try {
    startRow = await sql(
      `SELECT e.event_id,ROUND(UNIX_TIMESTAMP(e.occurred_at)*1000),e.facts,s.status,` +
        `ROUND(UNIX_TIMESTAMP(s.ended_at)*1000) FROM persistent_life_event e ` +
        `JOIN persistent_life_session s ON s.session_id=e.session_id ` +
        `WHERE e.char_id=${charId} AND e.event_type='FARM_SESSION_STARTED' ` +
        `ORDER BY e.event_id DESC LIMIT 1;`,
    );
    const start = (startRow ? startRow.split(/\r?\n/) : []).filter(Boolean)[0];
    if (!start) return { available: false };
    const startColumns = start.split('\t');
    const startId = Number(startColumns[0]);
    if (!Number.isSafeInteger(startId) || startId <= 0) return { available: false };
    const startedAt = Number(startColumns[1]);
    const startFacts = parseLifeEventFacts(startColumns[2]);
    const sessionStatus = startColumns[3] || '';
    const sessionEndedAt =
      startColumns[4] && startColumns[4] !== 'NULL' ? Number(startColumns[4]) : null;
    stopRow = await sql(
      `SELECT event_id,ROUND(UNIX_TIMESTAMP(occurred_at)*1000),facts FROM persistent_life_event ` +
        `WHERE char_id=${charId} AND event_type='FARM_SESSION_STOPPED' AND event_id > ${startId} ` +
        `ORDER BY event_id ASC LIMIT 1;`,
    );
    const stop = (stopRow ? stopRow.split(/\r?\n/) : []).filter(Boolean)[0];
    let stopId = 0;
    let stopMs = null;
    let stopFacts = {};
    if (stop) {
      const stopColumns = stop.split('\t');
      stopId = Number(stopColumns[0]) || 0;
      stopMs = stopColumns[1] && stopColumns[1] !== 'NULL' ? Number(stopColumns[1]) : null;
      stopFacts = parseLifeEventFacts(stopColumns[2]);
    }
    const upperBound = stopId ? ` AND event_id <= ${stopId}` : '';
    killsRaw = await sql(
      `SELECT COUNT(*) FROM persistent_life_event WHERE char_id=${charId} ` +
        `AND event_type='MONSTER_KILL' AND event_id >= ${startId}${upperBound};`,
    );
    deathsRaw = await sql(
      `SELECT COUNT(*) FROM persistent_life_event WHERE char_id=${charId} ` +
        `AND event_type='PLAYER_DEATH' AND event_id >= ${startId}${upperBound};`,
    );
    lootRaw = await sql(
      `SELECT CAST(JSON_EXTRACT(facts,'$.itemId') AS UNSIGNED),` +
        `SUM(CAST(JSON_EXTRACT(facts,'$.amount') AS UNSIGNED)) FROM persistent_life_event ` +
        `WHERE char_id=${charId} AND event_type='LOOT_ACQUIRED' ` +
        `AND event_id >= ${startId}${upperBound} GROUP BY 1;`,
    );
    const active = sessionStatus === 'ACTIVE' && !stopId;
    const endedAt = stopMs ?? (sessionStatus === 'ACTIVE' ? null : sessionEndedAt);
    const items = (lootRaw ? lootRaw.split(/\r?\n/) : [])
      .filter(Boolean)
      .map((line) => {
        const columns = line.split('\t');
        return {
          name: farmStatsLootItemName(columns[0]),
          amount: Number(columns[1]) || 0,
        };
      })
      .filter((item) => item.amount > 0)
      .sort((left, right) => right.amount - left.amount);
    return {
      available: true,
      active,
      startedAt: Number.isFinite(startedAt) ? startedAt : null,
      endedAt: Number.isFinite(endedAt) ? endedAt : null,
      baseExp: Number(startFacts.baseExp ?? 0),
      jobExp: Number(startFacts.jobExp ?? 0),
      endBaseExp: Number.isFinite(Number(stopFacts.baseExp)) ? Number(stopFacts.baseExp) : null,
      endJobExp: Number.isFinite(Number(stopFacts.jobExp)) ? Number(stopFacts.jobExp) : null,
      kills: Math.max(0, Number(String(killsRaw).trim()) || 0),
      deaths: Math.max(0, Number(String(deathsRaw).trim()) || 0),
      items,
    };
  } catch (error) {
    if (persistentLifeEventSchemaUnavailable(error)) return { available: false };
    throw error;
  }
}

// --- SERVER_AGENT authoritative read model (P2F) ---------------------------
// Written by the map-server Persistent Agent from authoritative rAthena state.
// Read-only here. These are the authoritative projections for SERVER_AGENT
// characters: the Web must NOT fall back to OpenKore status.json for them.
function persistentAgentReadModelSchemaUnavailable(error) {
  return /persistent_agent_live_(?:character|inventory|skill|entity|quest).*(?:doesn't exist|does not exist)|Unknown table/i.test(
    String(error?.message ?? error),
  );
}

function parseLiveCharacterRow(output) {
  if (!output) return null;
  const row = output.split('\t');
  return {
    revision: Number(row[0]),
    inventoryGeneration: Number(row[1]),
    baseLevel: Number(row[2]),
    jobLevel: Number(row[3]),
    classId: Number(row[4]),
    baseExp: Number(row[5]),
    jobExp: Number(row[6]),
    str: Number(row[7]),
    agi: Number(row[8]),
    vit: Number(row[9]),
    int: Number(row[10]),
    dex: Number(row[11]),
    luk: Number(row[12]),
    statusPoint: Number(row[13]),
    skillPoint: Number(row[14]),
  };
}

function parseLiveInventoryRows(output) {
  if (!output) return [];
  return output.split(/\r?\n/).map((line) => {
    const row = line.split('\t');
    return {
      inventoryIndex: Number(row[0]),
      inventoryGeneration: Number(row[1]),
      itemId: Number(row[2]),
      amount: Number(row[3]),
      equipMask: Number(row[4]),
      identified: row[5] === '1',
      refine: Number(row[6]),
      cardIds: row.slice(7, 11).map(Number),
    };
  });
}

function parseLiveSkillRows(output) {
  if (!output) return [];
  return output.split(/\r?\n/).map((line) => {
    const row = line.split('\t');
    return {
      skillId: Number(row[0]),
      level: Number(row[1]),
      upgradable: row[2] === '1',
      handle: row[3] || '',
    };
  });
}

function parseLiveEntityRows(output) {
  if (!output) return [];
  return output.split(/\r?\n/).map((line) => {
    const row = line.split('\t');
    return {
      kind: row[0] || '',
      entityId: Number(row[1]),
      classId: Number(row[2]),
      x: Number(row[3]),
      y: Number(row[4]),
      hp: Number(row[5]),
      maxHp: Number(row[6]),
      name: row[7] || '',
    };
  });
}

function parseLiveQuestRows(output) {
  if (!output) return [];
  return output.split(/\r?\n/).map((line) => {
    const row = line.split('\t');
    return {
      questId: Number(row[0]),
      state: Number(row[1]),
      mobId: Number(row[2]),
      goal: Number(row[3]),
      count: Number(row[4]),
    };
  });
}

// --- SERVER_AGENT native NPC dialog projection (P2H) ------------------------
// Captured by the map-server from the exact strings the native script VM emits.
// The Web only presents it and returns the chosen index over the generic dialog
// command; it never reconstructs NPC rules, cost or text.
function persistentAgentDialogSchemaUnavailable(error) {
  return /persistent_agent_live_dialog.*(?:doesn't exist|does not exist)|Unknown table/i.test(
    String(error?.message ?? error),
  );
}

function decodeHexText(value) {
  const hex = String(value ?? '').trim();
  if (!hex) return '';
  return Buffer.from(hex, 'hex').toString('utf8');
}

function parseLiveDialogRow(output) {
  const line = String(output ?? '').split(/\r?\n/)[0];
  if (!line) return null;
  const row = line.split('\t');
  if (row.length < 11) return null;
  return {
    active: row[0] === '1',
    npcId: Number(row[1]),
    npcName: decodeHexText(row[2]),
    npcMap: decodeHexText(row[3]),
    phase: decodeHexText(row[4]),
    message: decodeHexText(row[5]),
    menuOptions: decodeHexText(row[6]),
    menuCount: Number(row[7]),
    canNext: row[8] === '1',
    canClose: row[9] === '1',
    waitingForInput: row[10] === '1',
  };
}

async function readServerAgentDialog(charId) {
  const numericCharId = Number(charId);
  if (!Number.isSafeInteger(numericCharId) || numericCharId <= 0) return null;
  try {
    // HEX() keeps tabs/newlines inside the script text from corrupting the
    // line-based CLI read; the Web decodes them back to the exact emitted text.
    const output = await sql(
      `SELECT active,npc_id,HEX(COALESCE(npc_name,'')),HEX(COALESCE(npc_map,'')),HEX(COALESCE(phase,'NONE')),HEX(COALESCE(message,'')),HEX(COALESCE(menu_options,'')),menu_count,can_next,can_close,waiting_for_input FROM persistent_agent_live_dialog WHERE char_id=${numericCharId} LIMIT 1;`,
    );
    return parseLiveDialogRow(output);
  } catch (error) {
    if (persistentAgentDialogSchemaUnavailable(error)) return null;
    throw error;
  }
}

function splitNativeDialogMenu(options) {
  const text = String(options ?? '');
  if (!text) return [];
  return text
    .split(':')
    .map((part) => part.replace(/\^[0-9A-Fa-f]{6}/g, '').trim())
    .filter((part) => part.length > 0);
}

// Map the authoritative dialog row to the same browser-facing shape the page
// already renders for OpenKore (`npcDialog.active/stage/message/responses`).
// `source` lets the UI route the buttons through the SERVER_AGENT dialog
// command instead of the legacy OpenKore `.cmd` path.
function serverAgentNpcDialog(dialog) {
  if (!dialog) return { active: false, source: 'persistent_agent' };
  const responses = splitNativeDialogMenu(dialog.menuOptions);
  if (!dialog.active)
    return {
      active: false,
      source: 'persistent_agent',
      npcName: dialog.npcName,
      npcMap: dialog.npcMap,
      phase: dialog.phase,
    };
  const stage =
    dialog.waitingForInput && responses.length > 0
      ? 'select'
      : dialog.canNext
        ? 'next'
        : 'close';
  return {
    active: true,
    source: 'persistent_agent',
    npcId: dialog.npcId,
    npcName: dialog.npcName,
    npcMap: dialog.npcMap,
    phase: dialog.phase,
    message: dialog.message,
    responses,
    menuCount: dialog.menuCount,
    canNext: dialog.canNext,
    canClose: dialog.canClose,
    waitingForInput: dialog.waitingForInput,
    stage,
  };
}

async function readServerAgentReadModel(charId) {
  try {
    const [characterOut, inventoryOut, skillOut, entityOut, questOut] =
      await Promise.all([
        sql(
          `SELECT revision,inventory_generation,base_level,job_level,class_id,base_exp,job_exp,str,agi,vit,\`int\`,dex,luk,status_point,skill_point FROM persistent_agent_live_character WHERE char_id=${Number(charId)} LIMIT 1;`,
        ),
        sql(
          `SELECT inventory_index,inventory_generation,item_id,amount,equip_mask,identified,refine,card0,card1,card2,card3 FROM persistent_agent_live_inventory WHERE char_id=${Number(charId)} ORDER BY inventory_index;`,
        ),
        sql(
          `SELECT skill_id,level,upgradable,handle FROM persistent_agent_live_skill WHERE char_id=${Number(charId)} ORDER BY skill_id;`,
        ),
        sql(
          `SELECT entity_kind,entity_id,class_id,x,y,hp,max_hp,name FROM persistent_agent_live_entity WHERE char_id=${Number(charId)} ORDER BY entity_kind,entity_id;`,
        ),
        sql(
          `SELECT quest_id,state,mob_id,goal,count1 FROM persistent_agent_live_quest WHERE char_id=${Number(charId)} ORDER BY quest_id;`,
        ),
      ]);
    return {
      character: parseLiveCharacterRow(characterOut),
      inventory: parseLiveInventoryRows(inventoryOut),
      skills: parseLiveSkillRows(skillOut),
      entities: parseLiveEntityRows(entityOut),
      quests: parseLiveQuestRows(questOut),
    };
  } catch (error) {
    if (persistentAgentReadModelSchemaUnavailable(error)) return null;
    throw error;
  }
}

// Map the authoritative inventory rows to the browser-facing item shape the
// existing inventory renderer already consumes. Identity is the rAthena
// inventory index + generation (NOT OpenKore binId/itemKey).
function serverAgentInventoryItems(readModel, jobId = 0) {
  return readModel.inventory.map((row) => {
    const known = catalogEntry(row.itemId);
    const resolved = resolveItemAsset(row.itemId);
    const category = known?.category ?? 'etc';
    const equipRestriction = equipmentRestriction(
      row.itemId,
      jobId,
      row.identified,
    );
    return {
      itemId: row.itemId,
      itemKey: '',
      binId: null,
      inventoryIndex: row.inventoryIndex,
      inventoryGeneration: row.inventoryGeneration,
      amount: row.amount,
      equipped: row.equipMask !== 0,
      equipMask: row.equipMask,
      equipTarget: row.equipMask,
      itemType: -1,
      weaponType: '',
      identified: row.identified,
      refine: row.refine,
      slotCount: Number(resolved?.slots ?? known?.slots ?? 0),
      equipLocations: resolved?.equipLocations ?? known?.equipLocations ?? [],
      cardIds: row.cardIds,
      aegisName: known?.aegisName ?? null,
      name: localizedItemName(row.itemId, known?.name),
      category,
      usable: category === 'consumable',
      equippable: category === 'equipment',
      canEquip: category === 'equipment' && !equipRestriction,
      equipRestriction,
      mergeable: category === 'card',
    };
  });
}
// ---------------------------------------------------------------------------

// Presentation-only merge of a fresh live observation onto the character object
// the page already renders. Stale/unavailable snapshots keep the save-driven
// values and only add explicit freshness metadata.
async function applyLiveStatusToCharacter(account, character) {
  if (!character) return { character, liveStatus: null };
  const charId = Number(account.characterId);
  if (!Number.isSafeInteger(charId) || charId <= 0)
    return { character, liveStatus: null };
  let controller;
  try {
    controller = await readCharacterControllerStatus(account, charId);
  } catch {
    return { character, liveStatus: null };
  }
  if (!controller.available || controller.controller !== SERVER_AGENT_OWNER)
    return { character, liveStatus: null };
  const live = controller.liveStatus;
  if (!live?.available)
    return { character, liveStatus: live ?? null };
  if (!live.fresh) {
    return {
      character: {
        ...character,
        liveSource: LIVE_STATUS_SOURCE,
        liveFresh: false,
        liveStaleReason: live.reason,
        runtimePhase: live.phase ?? null,
      },
      liveStatus: live,
    };
  }
  return {
    character: {
      ...character,
      hp: live.hp,
      maxHp: live.maxHp,
      sp: live.sp,
      maxSp: live.maxSp,
      zeny: live.zeny,
      map: live.map ?? character.map,
      x: live.x,
      y: live.y,
      online: live.resident,
      liveSource: LIVE_STATUS_SOURCE,
      liveFresh: true,
      liveObservedAt: live.updatedAt,
      liveAgeMs: live.ageMs,
      runtimePhase: live.phase,
      supplyItemId: live.supplyItemId,
      supplyItemAmount: live.supplyItemAmount,
    },
    liveStatus: live,
  };
}

// Live snapshot resolution order:
//   1. existing OpenKore worker status.json (non-canary path, unchanged)
//   2. SERVER_AGENT live-status read model (fresh only)
//   3. null (caller keeps save-driven values)
async function currentCharacterLiveSnapshot(account, id, maximumAgeMs) {
  const charId = Number(account?.characterId);
  if (!Number.isSafeInteger(charId) || charId <= 0) return null;
  let controller;
  try {
    controller = await readCharacterControllerStatus(account, charId);
  } catch {
    return null;
  }
  const isServerAgent =
    controller.available && controller.controller === SERVER_AGENT_OWNER;
  // P2-OPENKORE-EXIT-MAINLINE (rows 11/38): OpenKore status.json is never an
  // authority in production. A SERVER_AGENT character resolves through the
  // Persistent Agent read model below; a legacy OPENKORE controller or any
  // unreadable agent state fails closed instead of falling back to status.json.
  if (!isServerAgent) {
    if (runtimeMode !== 'isolated-test') return null;
    const openkoreSnapshot = await currentStatusSnapshot(id, maximumAgeMs);
    return openkoreSnapshot ?? null;
  }
  const live = controller.liveStatus;
  if (!live?.available || !live.fresh) return null;
  // Concurrent read wave: the stored character row, the authoritative read
  // model and the live dialog are independent reads. Serializing them would
  // make the rapid minimap poll path pay one Database CLI round trip per step.
  const [stored, readModel, dialog] = await Promise.all([
    queryCharacter(account.accountId),
    readServerAgentReadModel(charId),
    readServerAgentDialog(charId),
  ]);
  if (!stored) return null;
  const revision = Number(live.revision ?? 0);
  const characterModel = readModel?.character ?? null;
  const inventoryGeneration = Number(
    characterModel?.inventoryGeneration ?? revision,
  );
  const jobId = Number(characterModel?.classId ?? stored.classId);
  const inventory = readModel ? serverAgentInventoryItems(readModel, jobId) : [];
  const skills = (readModel?.skills ?? []).map((skill) => ({
    // Authoritative rAthena skill id, needed so an explicit skill-point command
    // can target the same skill the Web is showing. The prerequisite/tree
    // authority stays server-side; this is projection identity only.
    id: skill.skillId,
    handle: skill.handle,
    level: skill.level,
    upgradable: skill.upgradable,
  }));
  const basicSkill = skills.find((skill) => skill.handle === 'NV_BASIC');
  const monsters = (readModel?.entities ?? [])
    .filter((entity) => entity.kind === 'MONSTER')
    .map((entity) => ({
      id: entity.entityId,
      mobId: entity.classId,
      x: entity.x,
      y: entity.y,
      hp: entity.hp,
    }));
  const players = (readModel?.entities ?? [])
    .filter((entity) => entity.kind === 'PLAYER')
    .map((entity) => ({
      id: entity.entityId,
      x: entity.x,
      y: entity.y,
      name: entity.name,
    }));
  const questMissions = (readModel?.quests ?? [])
    .filter((quest) => Number(quest.state) === 1 && Number(quest.goal) > 0)
    .map((quest) => ({
      mobId: quest.mobId,
      mobName: null,
      count: quest.count,
      goal: quest.goal,
    }));
  return {
    // Authoritative state timestamp: the live-status age is computed from the
    // mapper's updated_at, so the minimap freshness shows real state age instead
    // of a fabricated "just now".
    updatedAt: Number.isFinite(Number(live.ageMs))
      ? Date.now() - Math.max(0, Number(live.ageMs))
      : Date.now(),
    name: stored.name,
    jobId,
    baseLevel: Number(characterModel?.baseLevel ?? stored.baseLevel),
    jobLevel: Number(characterModel?.jobLevel ?? stored.jobLevel),
    baseExp: Number(characterModel?.baseExp ?? stored.baseExp),
    jobExp: Number(characterModel?.jobExp ?? stored.jobExp),
    zeny: live.zeny,
    hp: live.hp,
    maxHp: live.maxHp,
    sp: live.sp,
    maxSp: live.maxSp,
    statusPoint: Number(characterModel?.statusPoint ?? stored.statusPoint),
    skillPoint: Number(characterModel?.skillPoint ?? stored.skillPoint),
    str: Number(characterModel?.str ?? stored.str),
    agi: Number(characterModel?.agi ?? stored.agi),
    vit: Number(characterModel?.vit ?? stored.vit),
    int: Number(characterModel?.int ?? stored.int),
    dex: Number(characterModel?.dex ?? stored.dex),
    luk: Number(characterModel?.luk ?? stored.luk),
    basicSkillLevel: Number(basicSkill?.level ?? 0),
    basicSkillUpgradable: Number(basicSkill?.upgradable ?? 0),
    map: live.map ?? stored.map,
    playerX: live.x,
    playerY: live.y,
    inventory,
    skills,
    monsters,
    players,
    questMissions,
    webViewMode: 'live',
    webInterest: 'SERVER_AGENT_LIVE',
    serverAgentReadModel: true,
    npcDialog: serverAgentNpcDialog(dialog),
    domainRevisions: {
      live: revision,
      stat: revision,
      combat: revision,
      inventory: inventoryGeneration,
      quest: revision,
    },
    includedDomains: ['stat', 'combat', 'inventory', 'quest'],
    source: LIVE_STATUS_SOURCE,
    liveSource: LIVE_STATUS_SOURCE,
    runtimePhase: live.phase,
    supplyItemId: live.supplyItemId,
    supplyItemAmount: live.supplyItemAmount,
  };
}
// ---------------------------------------------------------------------------

async function readCharacterControllerStatus(
  account,
  charId,
  { includeFarmTarget = false, allowFarmTargetFallback = true } = {},
) {
  try {
    // One concurrent read wave: state, rollout and the live-status view are
    // independent and each costs one Database CLI round trip. Keeping them in
    // the same Promise.all keeps the rapid minimap poll path bounded by the
    // slowest single query instead of the sum of the waves.
    const [stateRow, rollout, liveStatus, nativeFarm] = await Promise.all([
      readAgentStateRow(charId),
      readPersistentAgentRollout(sql, account.accountId, charId),
      readPersistentAgentLiveStatusView(charId),
      readNativeFarmStats(charId),
    ]);
    let farmTarget = null;
    if (includeFarmTarget && rollout.allowed) {
      const persistedTarget = await readGrindTarget(account);
      const policyTarget = await ensureDefaultGrindTarget(account, persistedTarget);
      farmTarget = resolveFarmTarget({
        stateRow,
        grindTarget: policyTarget,
        allowFarmTargetFallback,
      });
    }
    return createControllerStatus({
      charId,
      stateRow,
      rollout,
      farmTarget,
      liveStatus,
      farmRunning: nativeFarm.available ? nativeFarm.active === true : null,
    });
  } catch (error) {
    return createUnavailableControllerStatus(
      charId,
      agentStateSchemaUnavailable(error)
        ? 'agent_schema_unavailable'
        : 'agent_status_unavailable',
    );
  }
}

// SERVER_AGENT characters take the fixed W1 intent path. The browser sends
// only "start"/"stop"; the server resolves the farm target and the command
// payload, and rAthena remains the only owner of the transition.
async function queueCanaryAutomation(account, controller, body) {
  const charId = Number(account.characterId);
  const action =
    body.action === 'start'
      ? W1_ACTION.START_FARM
      : body.action === 'stop'
        ? W1_ACTION.STOP_FARM
        : null;
  if (!action) throw new HttpError(400, '無效操作');
  const allowed =
    action === W1_ACTION.START_FARM
      ? controller.actions.startFarm
      : controller.actions.stopFarm;
  if (!allowed)
    throw new HttpError(
      409,
      (action === W1_ACTION.START_FARM
        ? controller.actionBlockers.startFarm
        : controller.actionBlockers.stopFarm) ?? 'invalid_transition',
    );
  // A farm target that is not the character's authoritative current map is a
  // relocation, not a direct start: rAthena only accepts start_farm on the
  // target map, so reuse the W4 coordinator (STOP_FARM -> START_NAVIGATION ->
  // arrival -> START_FARM). An unavailable live position fails closed.
  if (action === W1_ACTION.START_FARM) {
    // FARMABLE_MAP_REQUIRED: a persisted map with no monster spawn is an explicit
    // blocker, never silently rewritten to another map.
    const targetMap = String(controller.farmTarget?.targetMap ?? '');
    const eligibility = farmMapEligibility(targetMap);
    if (!eligibility.map) throw new HttpError(409, 'farm_target_unresolved');
    if (!eligibility.farmable) throw new HttpError(409, 'farm_map_not_farmable');
    if (!eligibility.farmSelectionAvailable)
      throw new HttpError(409, 'farm_map_not_released');
    const live = controller.liveStatus ?? null;
    const currentMap = live?.fresh && live.map ? String(live.map) : null;
    if (!currentMap) throw new HttpError(409, 'agent_position_unavailable');
    if (currentMap !== targetMap)
      return await queuePlayerWorldMapTeleport(account, controller, targetMap, 'farm');
  }
  const command = await queueOwnershipCommand(account, charId, {
    action,
    expectedRevision: controller.revision,
    ...buildW1CommandPayload(action, { farmTarget: controller.farmTarget }),
  });
  if (action === W1_ACTION.START_FARM || action === W1_ACTION.STOP_FARM)
    await clearPersistedRelocation(account);
  return {
    executor: SERVER_AGENT_OWNER,
    command,
  };
}

function parseNoviceCommandRow(output) {
  if (!output) return null;
  const row = output.split('\t');
  let payload = null;
  try {
    payload = JSON.parse(row[2] || '{}');
  } catch {
    payload = null;
  }
  return {
    commandId: row[0],
    action: row[1],
    payload,
    status: row[3],
    reasonCode: row[4] || null,
  };
}

async function readLatestNoviceCommand(charId, action) {
  const output = await sql(
    `SELECT command_id,action,payload,command_status,COALESCE(reason_code,'') FROM persistent_agent_command WHERE char_id=${Number(charId)} AND action='${escapeSql(action)}' ORDER BY requested_at DESC LIMIT 1;`,
  );
  return parseNoviceCommandRow(output);
}

function commandStatusIsLive(command) {
  return ['QUEUED', 'ACCEPTED', 'CONFIRMED'].includes(command?.status);
}

// W4 server-side relocation coordinator.
//
// The rAthena Persistent Agent deliberately forces CONTRACT navigation to resume
// PERSISTENT_IDLE: a navigation started while farming is a pause/resume of the
// SAME farm map (its resume fields are overwritten server-side), and one started
// while idle ends idle. A Web farm-map CHANGE therefore cannot be a single
// `start_navigation`. The server orchestrates only existing lifecycle commands:
//
//   STOP_FARM -> START_NAVIGATION(server-resolved route) -> (arrival) -> START_FARM(new target)
//
// The browser still sends only `mapId`. The Dashboard never walks the character,
// never invents waypoints and never overrides ownership/revision CAS.
const pendingRelocations = new Map();
const persistedRelocationFileName = 'relocation-pending.json';

function persistedRelocationPath(accountId) {
  return join(
    instancesRoot,
    instanceId(accountId),
    persistedRelocationFileName,
  );
}

async function writePersistedRelocation(account, targetMap, kind = 'route-farm',
  { parentFarmMap = null, blockedReason = null, retryAfter = 0,
    attemptRevision = null, attempts = 0,
    paidResumeAttempted = false } = {}) {
  await writeJsonAtomic(persistedRelocationPath(account.accountId), {
    targetMap,
    kind,
    parentFarmMap,
    blockedReason,
    retryAfter,
    attemptRevision,
    attempts,
    paidResumeAttempted,
    createdAt: Date.now(),
  });
}

async function readPersistedRelocation(accountId) {
  try {
    const value = JSON.parse(
      await readFile(persistedRelocationPath(accountId), 'utf8'),
    );
    return /^[a-z0-9_]{1,31}$/.test(String(value?.targetMap ?? ''))
      ? { targetMap: String(value.targetMap), kind: String(value.kind ?? 'route-farm'),
        parentFarmMap: String(value.parentFarmMap ?? '') || null,
        blockedReason: String(value.blockedReason ?? '') || null,
        retryAfter: Number(value.retryAfter) || 0,
        attemptRevision: Number.isSafeInteger(value.attemptRevision)
          ? value.attemptRevision : null,
        attempts: Number.isSafeInteger(value.attempts) ? value.attempts : 0,
        paidResumeAttempted: value.paidResumeAttempted === true }
      : null;
  } catch {
    return null;
  }
}

async function clearPersistedRelocation(account) {
  await unlink(persistedRelocationPath(account.accountId)).catch(() => {});
}

const persistedRelocationRecoveryRunning = new Set();
async function tryResumePaidFarmSwitch(account, intent, ownership, live) {
  if (!nativeSupplyPolicyCommandEnabled) return null;
  if (ownership?.owner !== SERVER_AGENT_OWNER ||
      ownership.ownershipState !== SERVER_AGENT_OWNER ||
      ownership.agentEnabled !== true)
    return null;
  const receipt = ownership?.targetRules?._pendingFarmSwitch;
  const original = receipt?.commandId
    ? await getOwnershipCommand(account, Number(account.characterId),
      receipt.commandId).catch(() => null) : null;
  const decision = paidFarmSwitchResumeDecision({ intent, pending: receipt,
    command: original, live, revision: Number(ownership?.revision) });
  if (!decision.allowed) return null;
  // Persist the one-shot attempt before dispatch. A Web restart cannot replay
  // a paid arrival and Native independently checks the durable receipt.
  await writePersistedRelocation(account, intent.targetMap, 'world-map-farm', {
    parentFarmMap: intent.parentFarmMap,
    blockedReason: 'SUPPLY_PAID_ARRIVAL_RESUME_PENDING',
    retryAfter: Date.now() + 300_000,
    attemptRevision: Number(ownership.revision),
    attempts: intent.attempts,
    paidResumeAttempted: true,
  });
  const command = await queueOwnershipCommand(account, Number(account.characterId),
    { action: 'resume_paid_farm_switch', expectedRevision: Number(ownership.revision) },
    { targetMap: intent.targetMap });
  pendingRelocations.set(Number(account.characterId), {
    accountId: Number(account.accountId), charId: Number(account.characterId),
    targetMap: intent.targetMap, parentFarmMap: intent.parentFarmMap,
    stage: 'WAIT_PAID_FARM_RESUME', commandId: command.commandId,
    commandRevision: Number(ownership.revision), attempts: 0, busy: false,
    deadline: Date.now() + 60_000,
  });
  return command;
}


// A Dashboard restart must not erase a player-confirmed map change between
// START_NAVIGATION and the arrival-triggered START_FARM. The intent file is
// only a durable handoff marker; route resolution and commands remain on the
// existing coordinator and native command contract.
async function reconcilePersistedRelocations() {
  if (isolatedTestMode) return;
  let rows;
  try {
    rows = await sql(
        "SELECT char_id,account_id,agent_mode FROM persistent_agent_state WHERE control_owner='SERVER_AGENT' AND ownership_state='SERVER_AGENT' AND agent_enabled=1 AND agent_mode IN ('PERSISTENT_IDLE','AUTO_FARM');",
    );
  } catch (error) {
    if (agentStateSchemaUnavailable(error)) return;
    throw error;
  }
  for (const line of String(rows ?? '').split(/\r?\n/)) {
    if (!line) continue;
    const [charIdText, accountIdText] = line.split('\t');
    const charId = Number(charIdText);
    const accountId = Number(accountIdText);
    if (!Number.isSafeInteger(charId) || charId <= 0 ||
        !Number.isSafeInteger(accountId) || accountId <= 0 ||
        pendingRelocations.has(charId) ||
        persistedRelocationRecoveryRunning.has(charId))
      continue;
    const intent = await readPersistedRelocation(accountId);
    if (!intent) continue;
    persistedRelocationRecoveryRunning.add(charId);
    try {
      const account = { accountId, characterId: charId };
      const controller = await readCharacterControllerStatus(account, charId, {
        includeFarmTarget: false,
      });
      if (!controller.available || controller.controller !== SERVER_AGENT_OWNER)
        continue;
      const live = controller.liveStatus ?? null;
      const currentMap = live?.fresh && live.map ? String(live.map) : null;
      if (!currentMap) continue;
      if (nativeSupplyPolicyCommandEnabled && intent.kind === 'world-map-farm') {
        const ownership = await getOwnershipStatus(account, charId).catch(() => null);
        if (!ownership) continue;
        const receipt = ownership.targetRules?._pendingFarmSwitch;
        if (currentMap === intent.targetMap && controller.agentMode === 'AUTO_FARM' &&
            !receipt) {
          await clearPersistedRelocation(account);
          continue;
        }
        if (receipt?.targetMap === intent.targetMap &&
            (receipt.stage === 'ARRIVED_PAID' ||
              receipt.stageBeforeBlock === 'ARRIVED_PAID')) {
          if (!intent.paidResumeAttempted)
            await tryResumePaidFarmSwitch(account, intent, ownership, live);
          continue; // Native owns this paid arrival; never repeat transactions.
        }
        if (intent.paidResumeAttempted ||
            !mayRetryFarmSwitch(intent, Number(controller.revision)))
          continue;
      }
      if (controller.agentMode === 'AUTO_FARM' &&
          intent.kind !== 'world-map-farm' && intent.kind !== 'world-map-town')
        continue;
      if (currentMap === intent.targetMap) {
        if (intent.kind === 'world-map-town') {
          await clearPersistedRelocation(account);
          continue;
        }
        if (intent.kind === 'world-map-farm') {
          if (farmSwitchReachedTarget({ currentMap, targetMap: intent.targetMap,
            mode: controller.agentMode })) {
            await clearPersistedRelocation(account);
            continue;
          }
          if (nativeSupplyPolicyCommandEnabled) {
            const preflight = await readFarmMapSupplyPreflight(account, controller);
            if (!preflight.allowed) {
              if (preflight.reason === 'SUPPLY_REQUIRED')
                await queuePlayerWorldMapTeleport(account, controller,
                  intent.targetMap, 'farm', { recovering: true });
              continue;
            }
          }
          const row = worldMapTeleportCatalog.get(intent.targetMap);
          if (!row?.farmSelectionAvailable) {
            await clearPersistedRelocation(account);
            continue;
          }
          await writeJsonAtomic(join(instancesRoot, instanceId(accountId), 'grind-target.json'), {
            mapId: intent.targetMap, name: row.name ?? intent.targetMap,
            levelRange: mapRoutingIndex.maps?.[intent.targetMap]?.levelRange ?? null,
            source: FARM_MAP_SOURCE.PLAYER_OVERRIDE, updatedAt: Date.now(),
          });
          observationConfigCache.delete(`grind:${accountId}`);
        }
        const farmPayload = { targetMap: intent.targetMap, lootEnabled: true,
          survivalEnabled: true, deathRecoveryEnabled: true };
        const command = await queueOwnershipCommand(account, charId,
          { action: 'start_farm', expectedRevision: Number(controller.revision) }, farmPayload);
        pendingRelocations.set(charId, {
          accountId, charId, targetMap: intent.targetMap,
          stage: 'WAIT_FARM', commandId: command.commandId,
          attempts: 0, busy: false,
          deadline: Date.now() + coordinatorDeadlineMsForRouteSteps(1),
        });
      } else if (intent.kind === 'world-map-farm' || intent.kind === 'world-map-town') {
        if (nativeSupplyPolicyCommandEnabled && intent.kind === 'world-map-farm' &&
            (await readFarmMapSupplyPreflight(account, controller)).reason ===
              'SUPPLY_PREFLIGHT_UNAVAILABLE')
          continue;
        await queuePlayerWorldMapTeleport(account, controller, intent.targetMap,
          intent.kind === 'world-map-town' ? 'town' : 'farm', { recovering: true });
      } else {
        await queuePlayerWorldMapTeleport(account, controller, intent.targetMap,
          'farm', { recovering: true });
      }
    } catch (error) {
      console.warn(`WEB_RELOCATION_RECOVERY_BLOCKED char=${charId} reason=${error?.message ?? error}`);
      if (intent.kind === 'world-map-farm') {
        const state = await readAgentStateRow(charId).catch(() => null);
        await writePersistedRelocation({ accountId }, intent.targetMap,
          'world-map-farm', { parentFarmMap: intent.parentFarmMap,
            blockedReason: String(error?.message ?? 'SUPPLY_SERVICE_UNAVAILABLE'),
            retryAfter: Date.now() + 300_000,
            attemptRevision: Number(state?.revision ?? -1),
            attempts: intent.attempts + 1 });
      }
    } finally {
      persistedRelocationRecoveryRunning.delete(charId);
    }
  }
}
// The coordinator deadline is route-aware (relocation-policy.mjs). A flat budget
// would abandon a multi-map Web relocation before the native navigation runtime
// (120000 ms per route step) can legitimately arrive, so arrival would never
// dispatch start_farm.

function relocationAccount(pending) {
  return { accountId: pending.accountId, characterId: pending.charId };
}

// R2 AUTO_FARM deferred-restore resume. Native (AUTO_FARM_RESTORE_DEFERRED)
// keeps the authoritative target_map / target_rules and loads PERSISTENT_IDLE
// when a restart happens off the farm map. This server-side loop returns the
// character with the SAME canonical relocation coordinator
// (queueServerAgentRelocation) and resumes the ORIGINAL farm intent. It never
// rewrites the target, never farms the current map, and never plans its own
// route. Only authoritative deferred intent (owner SERVER_AGENT + mode
// PERSISTENT_IDLE + a persisted target_map/target_rules pair) is eligible, so
// ordinary idle characters (target_map cleared by stop_farm) are untouched.
const deferredFarmResume = new Map(); // charId -> { revision, targetMap, retryAt, attempts }
const deferredFarmResumeRunning = new Set();

async function reconcileDeferredFarmRestores() {
  if (isolatedTestMode) return;
  let rows;
  try {
    rows = await sql(
      "SELECT char_id,account_id,revision,target_map,target_rules FROM persistent_agent_state WHERE control_owner='SERVER_AGENT' AND ownership_state='SERVER_AGENT' AND agent_enabled=1 AND agent_mode='PERSISTENT_IDLE' AND target_map IS NOT NULL AND target_map<>'' AND target_rules IS NOT NULL AND target_rules<>'';",
    );
  } catch (error) {
    if (agentStateSchemaUnavailable(error)) return;
    throw error;
  }
  const seen = new Set();
  for (const line of String(rows ?? '').split(/\r?\n/)) {
    if (!line) continue;
    const parts = line.split('\t');
    const charId = Number(parts[0]);
    const accountId = Number(parts[1]);
    const revision = Number(parts[2]);
    const targetMap = String(parts[3] ?? '');
    const targetRules = parts.slice(4).join('\t');
    if (!Number.isSafeInteger(charId) || charId <= 0 || !targetMap) continue;
    seen.add(charId);
    // Stale-intent protection: a changed revision or target means the deferred
    // intent is no longer the one we observed.
    const snapshot = deferredFarmResume.get(charId);
    if (snapshot && (snapshot.revision !== revision || snapshot.targetMap !== targetMap))
      deferredFarmResume.delete(charId);
    const state = deferredFarmResume.get(charId);
    if (state && Date.now() < state.retryAt) continue;
    // One relocation in flight per character (canonical coordinator + this loop).
    if (pendingRelocations.has(charId) || deferredFarmResumeRunning.has(charId)) continue;
    let intent = null;
    try {
      intent = JSON.parse(targetRules);
    } catch {
      intent = null;
    }
    // The persisted rules must still describe this exact target map.
    if (!intent || String(intent.targetMap ?? '') !== targetMap) continue;
    deferredFarmResumeRunning.add(charId);
    try {
      const account = { accountId, characterId: charId };
      const controller = await readCharacterControllerStatus(account, charId, {
        includeFarmTarget: false,
      });
      // Player takeover / authority loss -> abort and yield.
      if (!controller.available || controller.controller !== SERVER_AGENT_OWNER) {
        deferredFarmResume.delete(charId);
        continue;
      }
      if (Number(controller.revision) !== revision) continue; // wait for a stable snapshot
      const live = await readPersistentAgentLiveStatusView(charId);
      const currentMap = live?.fresh && live.map ? String(live.map) : null;
      if (!currentMap) continue;
      if (currentMap === targetMap) {
        // Already home: resume the ORIGINAL intent, no relocation.
        await queueOwnershipCommand(
          account,
          charId,
          { action: 'start_farm', expectedRevision: revision },
          {
            targetMap,
            lootEnabled: intent.lootEnabled === true,
            survivalEnabled: intent.survivalEnabled === true,
            deathRecoveryEnabled: intent.deathRecoveryEnabled === true,
          },
        );
      } else {
        await queuePlayerWorldMapTeleport(account, controller, targetMap, 'farm');
      }
      deferredFarmResume.set(charId, {
        revision,
        targetMap,
        retryAt: Date.now() + 15000,
        attempts: 0,
      });
    } catch (error) {
      const attempts = Number(deferredFarmResume.get(charId)?.attempts ?? 0) + 1;
      const backoff = Math.min(120000, 5000 * 2 ** Math.min(attempts, 5));
      deferredFarmResume.set(charId, {
        revision,
        targetMap,
        retryAt: Date.now() + backoff,
        attempts,
      });
      console.warn(
        `WEB_DEFERRED_RESUME_BLOCKED char=${charId} target=${targetMap} attempt=${attempts}: ${error?.message ?? error}`,
      );
      if (attempts > 6) deferredFarmResume.delete(charId); // bounded retry, never infinite
    } finally {
      deferredFarmResumeRunning.delete(charId);
    }
  }
  for (const charId of [...deferredFarmResume.keys()])
    if (!seen.has(charId)) deferredFarmResume.delete(charId);
}

async function reconcileRelocations() {
  for (const [charId, pending] of [...pendingRelocations]) {
    if (pending.busy) continue;
      if (Date.now() > pending.deadline) {
        pendingRelocations.delete(charId);
        if (pending.stage === 'WAIT_PREPARED_FARM' ||
            pending.stage === 'WAIT_PAID_FARM_RESUME') {
          const account = relocationAccount(pending);
          const [state, prior] = await Promise.all([
            readAgentStateRow(charId).catch(() => null),
            readPersistedRelocation(account.accountId).catch(() => null),
          ]);
          await writePersistedRelocation(account, pending.targetMap,
            'world-map-farm', { parentFarmMap: pending.parentFarmMap,
              blockedReason: pending.stage === 'WAIT_PAID_FARM_RESUME'
                ? 'SUPPLY_PAID_ARRIVAL_RECONCILIATION_REQUIRED'
                : 'SUPPLY_SERVICE_TIMEOUT',
              retryAfter: Date.now() + 300_000,
              attemptRevision: Number(state?.revision ?? pending.commandRevision),
              attempts: Math.min(3, (prior?.attempts ?? 0) + 1),
              paidResumeAttempted: pending.stage === 'WAIT_PAID_FARM_RESUME' ||
                prior?.paidResumeAttempted === true })
            .catch((writeError) => console.warn(
              `WEB_RELOCATION_INTENT_PERSIST_FAILED char=${charId}: ${writeError?.message ?? writeError}`));
        } else {
          await clearPersistedRelocation(relocationAccount(pending));
        }
      console.warn(`WEB_RELOCATION_TIMEOUT char=${charId} stage=${pending.stage}`);
      continue;
    }
    pending.busy = true;
    try {
      const account = relocationAccount(pending);
      const [stateRow, live, savePoint, dialog] = await Promise.all([
        readAgentStateRow(charId),
        readPersistentAgentLiveStatusView(charId),
        readCharacterSavePoint(account.accountId, charId),
        readServerAgentDialog(charId),
      ]);
      if (
        !stateRow ||
        String(stateRow.controlOwner ?? '') !== SERVER_AGENT_OWNER
      ) {
        pendingRelocations.delete(charId);
        await clearPersistedRelocation(account);
        continue;
      }
      const mode = String(stateRow.agentMode ?? '');
      const currentMap = live?.fresh && live.map ? String(live.map) : null;
      const revision = Number(stateRow.revision);

      if (pending.stage === 'WAIT_PREPARED_FARM') {
        const prepared = await getOwnershipCommand(account, charId, pending.commandId);
        if (['REJECTED', 'FAILED'].includes(prepared.status)) {
          console.warn(`WORLD_MAP_SUPPLY_BLOCKED char=${charId} reason=${prepared.reasonCode}`);
          if (prepared.reasonCode === 'SUPPLY_RESTART_RETRY_REQUIRED' &&
              currentMap === pending.targetMap) {
            const [intent, ownership] = await Promise.all([
              readPersistedRelocation(account.accountId),
              getOwnershipStatus(account, charId),
            ]);
            if (intent && await tryResumePaidFarmSwitch(account, intent,
              ownership, live)) continue;
          }
          pendingRelocations.delete(charId);
          const previous = await readPersistedRelocation(account.accountId);
          await writePersistedRelocation(account, pending.targetMap, 'world-map-farm', {
            parentFarmMap: pending.parentFarmMap,
            blockedReason: prepared.reasonCode || 'SUPPLY_SERVICE_UNAVAILABLE',
            retryAfter: Date.now() + 300_000,
            attemptRevision: revision,
            attempts: (previous?.attempts ?? 0) + 1,
            paidResumeAttempted: previous?.paidResumeAttempted === true,
          });
          continue;
        }
        if (prepared.status === 'CONFIRMED' && farmSwitchReachedTarget({
          currentMap, targetMap: pending.targetMap, mode })) {
          pendingRelocations.delete(charId);
          await clearPersistedRelocation(account);
        }
      } else if (pending.stage === 'WAIT_PAID_FARM_RESUME') {
        const resumed = await getOwnershipCommand(account, charId, pending.commandId);
        if (['REJECTED', 'FAILED'].includes(resumed.status)) {
          pendingRelocations.delete(charId);
          await writePersistedRelocation(account, pending.targetMap,
            'world-map-farm', { parentFarmMap: pending.parentFarmMap,
              blockedReason: resumed.reasonCode ||
                'SUPPLY_PAID_ARRIVAL_RECONCILIATION_REQUIRED',
              retryAfter: Date.now() + 300_000,
              attemptRevision: revision, attempts: 3,
              paidResumeAttempted: true });
          continue;
        }
        if (resumed.status === 'CONFIRMED' && farmSwitchReachedTarget({
          currentMap, targetMap: pending.targetMap, mode })) {
          pendingRelocations.delete(charId);
          await clearPersistedRelocation(account);
        }
      } else if (pending.stage === 'WAIT_WORLD_MAP_IDLE') {
        const stopped = await getOwnershipCommand(account, charId, pending.commandId);
        if (['REJECTED', 'FAILED'].includes(stopped.status)) {
          console.warn(`WORLD_MAP_TELEPORT_BLOCKED char=${charId} reason=${stopped.reasonCode}`);
          pendingRelocations.delete(charId);
          if (stopped.reasonCode !== 'SUPPLY_REQUIRED')
            await clearPersistedRelocation(account);
          continue;
        }
        if (stopped.status !== 'CONFIRMED' || mode !== 'PERSISTENT_IDLE') continue;
        const queued = await queueOwnershipCommand(account, charId,
          { action: 'world_map_teleport', expectedRevision: revision },
          { targetMap: pending.targetMap, kind: pending.kind,
            anchorX: pending.landing.x, anchorY: pending.landing.y });
        pending.commandId = queued.commandId;
        pending.stage = 'WAIT_WORLD_MAP_ARRIVAL';
        pending.attempts = 0;
      } else if (pending.stage === 'WAIT_WORLD_MAP_ARRIVAL') {
        const teleport = await getOwnershipCommand(account, charId, pending.commandId);
        if (['REJECTED', 'FAILED'].includes(teleport.status)) {
          console.warn(`WORLD_MAP_TELEPORT_BLOCKED char=${charId} reason=${teleport.reasonCode}`);
          pendingRelocations.delete(charId);
          if (teleport.reasonCode !== 'SUPPLY_REQUIRED')
            await clearPersistedRelocation(account);
          continue;
        }
        if (teleport.status !== 'CONFIRMED' || currentMap !== pending.targetMap ||
            mode !== 'PERSISTENT_IDLE') continue;
        if (pending.kind === 'town') {
          pendingRelocations.delete(charId);
          await clearPersistedRelocation(account);
          continue;
        }
        const grindTargetPath = join(instancesRoot, instanceId(account.accountId), 'grind-target.json');
        await writeJsonAtomic(grindTargetPath, pending.grindTarget);
        observationConfigCache.delete(`grind:${Number(account.accountId)}`);
        let farmCommand;
        try {
          farmCommand = await queueOwnershipCommand(account, charId,
            { action: 'start_farm', expectedRevision: revision },
            { targetMap: pending.targetMap, lootEnabled: true,
              survivalEnabled: true, deathRecoveryEnabled: true });
        } catch (error) {
          if (error?.message !== 'supply_route_unavailable') throw error;
          farmCommand = await queueOwnershipCommand(account, charId,
            { action: 'start_farm', expectedRevision: revision },
            { targetMap: pending.targetMap, lootEnabled: true,
              survivalEnabled: true, deathRecoveryEnabled: true });
        }
        pending.commandId = farmCommand.commandId;
        pending.stage = 'WAIT_FARM';
        pending.attempts = 0;
      } else if (pending.stage === 'WAIT_START_FARM') {
        if (mode !== 'PERSISTENT_IDLE' || currentMap !== pending.targetMap)
          continue;
        const command = await queueOwnershipCommand(
          account,
          charId,
          { action: 'start_farm', expectedRevision: revision },
          {
            targetMap: pending.targetMap,
            lootEnabled: true,
            survivalEnabled: true,
            deathRecoveryEnabled: true,
          },
        );
        pending.commandId = command.commandId;
        pending.stage = 'WAIT_FARM';
        pending.attempts = 0;
      } else if (pending.stage === 'WAIT_IDLE') {
        if (mode !== 'PERSISTENT_IDLE') continue;
        const navigationCommand = await queueOwnershipCommand(
          account,
          charId,
          { action: 'start_navigation', expectedRevision: revision },
          { route: pending.route },
        );
        if (pending.routeEngine)
          console.info('WEB_WEIGHTED_NAVIGATION_QUEUED ' + JSON.stringify({
            charId, commandId: navigationCommand.commandId,
            targetMap: pending.targetMap, engine: pending.routeEngine,
            sourceDigest: pending.sourceDigest, routeDigest: pending.routeDigest,
          }));
        pending.stage = 'WAIT_ARRIVAL';
        pending.attempts = 0;
      } else if (pending.stage === 'WAIT_ARRIVAL') {
        if (currentMap !== pending.targetMap || mode !== 'PERSISTENT_IDLE')
          continue;
        const command = await queueOwnershipCommand(
          account,
          charId,
          { action: 'start_farm', expectedRevision: revision },
          {
            targetMap: pending.targetMap,
            lootEnabled: true,
            survivalEnabled: true,
            deathRecoveryEnabled: true,
          },
        );
        pending.commandId = command.commandId;
        if (pending.routeEngine)
          console.info('WEB_WEIGHTED_FARM_QUEUED ' + JSON.stringify({
            charId, commandId: command.commandId,
            targetMap: pending.targetMap, engine: pending.routeEngine,
            routeDigest: pending.routeDigest,
          }));
        pending.stage = 'WAIT_FARM';
        pending.attempts = 0;
      } else if (pending.stage === 'WAIT_FARM') {
        if (mode === 'AUTO_FARM' && currentMap === pending.targetMap) {
          await clearPersistedRelocation(account);
          pendingRelocations.delete(charId);
        } else if (pending.commandId) {
          const acknowledged = await getOwnershipCommand(account, charId, pending.commandId);
          if (['REJECTED', 'FAILED'].includes(acknowledged?.status)) {
            console.warn(`WEB_RELOCATION_BLOCKED char=${charId} reason=${acknowledged.reasonCode ?? acknowledged.status}`);
            await clearPersistedRelocation(account);
            pendingRelocations.delete(charId);
          }
        }
      } else if (pending.stage === 'RELOCATION' && pending.relocationPlan) {
        // Cross-region relocation: wait for authoritative progress (revision
        // bump) between commands; one existing contract action at a time.
        if (pending.commandPending) {
          const acknowledged = await getOwnershipCommand(account, charId, pending.commandId);
          if (['REJECTED', 'FAILED'].includes(acknowledged?.status)) {
            console.warn(`WEB_RELOCATION_BLOCKED char=${charId} reason=${acknowledged.reasonCode ?? acknowledged.status}`);
            pendingRelocations.delete(charId);
            await clearPersistedRelocation(account);
            continue;
          }
          if (acknowledged?.status !== 'CONFIRMED') continue;
        }
        const currentStep = pending.relocationPlan.steps[pending.relocationProgress.index];
        if (mode !== 'PERSISTENT_IDLE' && currentStep?.kind !== 'START_FARM')
          continue;
        pending.commandPending = false;
        const stageIndex = pending.relocationProgress.index;
        const step = pending.relocationPlan.steps[stageIndex];
        const expanded = existingCommandsForStep(step, { kafra: pending.kafraContext });
        if (expanded.missing) {
          console.warn(`WEB_RELOCATION_BLOCKED char=${charId} reason=kafra_dialog_failed missing=${expanded.missing ?? 'none'}`);
          pendingRelocations.delete(charId);
          continue;
        }
        const sent = pending.commandIndexByStage[stageIndex] ?? 0;
        const observation = {
          currentMap,
          agentMode: mode,
          savePoint: savePoint?.map ?? null,
          dialogClosed: dialog != null && dialog.active !== true,
          commandSequenceComplete: sent >= expanded.commands.length,
        };
        const next = nextRelocationAction(pending.relocationPlan,
          pending.relocationProgress, observation);
        if (next.reason) {
          console.warn(`WEB_RELOCATION_BLOCKED char=${charId} reason=${next.reason}`);
          pendingRelocations.delete(charId);
          continue;
        }
        if (next.done) {
          pendingRelocations.delete(charId);
          await clearPersistedRelocation(account);
          continue;
        }
        const needsNextCommand = relocationStageNeedsCommand(
          step, pending.relocationProgress, sent, expanded.commands.length,
        );
        if (!next.action && !needsNextCommand)
          continue; // waiting for an authoritative observation
        if (sent >= expanded.commands.length)
          continue; // stage commands sent; wait for authoritative confirmation
        const command = expanded.commands[sent];
        let payload = command.payload;
        // The unified planner already emits canonical {map,x,y,portalTo}
        // routes. Dispatch that exact route; no second route serializer or
        // OpenKore-derived re-planning is allowed at execution time.
        const queued = await queueOwnershipCommand(
          account,
          charId,
          { action: command.action, expectedRevision: revision },
          payload,
        );
        pending.commandIndexByStage[stageIndex] = sent + 1;
        pending.commandPending = true;
        pending.commandId = queued.commandId;
        pending.commandRevision = revision;
      }
    } catch (error) {
      pending.attempts = Number(pending.attempts ?? 0) + 1;
      console.warn(
        `WEB_RELOCATION_STEP_FAILED char=${charId} stage=${pending.stage} attempt=${pending.attempts}: ${error?.message ?? error}`,
      );
      if (pending.attempts > 6) {
        pendingRelocations.delete(charId);
        if (pending.stage === 'WAIT_PREPARED_FARM' ||
            pending.stage === 'WAIT_PAID_FARM_RESUME') {
          const account = relocationAccount(pending);
          const [state, prior] = await Promise.all([
            readAgentStateRow(charId).catch(() => null),
            readPersistedRelocation(account.accountId).catch(() => null),
          ]);
          await writePersistedRelocation(account, pending.targetMap,
            'world-map-farm', { parentFarmMap: pending.parentFarmMap,
              blockedReason: pending.stage === 'WAIT_PAID_FARM_RESUME'
                ? 'SUPPLY_PAID_ARRIVAL_RECONCILIATION_REQUIRED'
                : 'SUPPLY_SERVICE_UNAVAILABLE',
              retryAfter: Date.now() + 300_000,
              attemptRevision: Number(state?.revision ?? pending.commandRevision),
              attempts: Math.min(3, (prior?.attempts ?? 0) + 1),
              paidResumeAttempted: pending.stage === 'WAIT_PAID_FARM_RESUME' ||
                prior?.paidResumeAttempted === true })
            .catch((writeError) => console.warn(
              `WEB_RELOCATION_INTENT_PERSIST_FAILED char=${charId}: ${writeError?.message ?? writeError}`));
        } else {
          await clearPersistedRelocation(relocationAccount(pending));
        }
      }
    } finally {
      pending.busy = false;
    }
  }
}

// W4 server-side adapter: turn a Web world-map selection into a SERVER_AGENT
// relocation. The browser sends only `mapId`; the server validates that the map
// is a real farmable map and resolves STANDARD_FARM through the canonical
// weighted route model over current rAthena portal evidence,
// then hands the orchestration to reconcileRelocations() above. The player never
// selects a monster; no mobId is resolved, generated or persisted. No route
// waypoint, portal sequence or raw command ever comes from the browser.
const relocationRequests = new Set();

async function queuePlayerWorldMapTeleport(account, controller, requestedMapId,
  kind = 'farm', { recovering = false } = {}) {
  const charId = Number(account.characterId);
  const mapId = String(requestedMapId ?? '').trim();
  if (!/^[a-z0-9_]{1,31}$/.test(mapId) || !['farm', 'town'].includes(kind))
    throw new HttpError(400, 'WORLD_MAP_DESTINATION_UNAVAILABLE');
  if (pendingRelocations.has(charId) || relocationRequests.has(charId))
    throw new HttpError(409, 'farm_relocation_in_progress');
  relocationRequests.add(charId);
  try {
    const row = worldMapTeleportCatalog.get(mapId);
    if (!row || row.kind !== kind ||
        (kind === 'farm' && !row.farmSelectionAvailable) ||
        (kind === 'town' && !row.townTeleportAvailable))
      throw new HttpError(409, row?.availabilityReason ?? 'WORLD_MAP_DESTINATION_UNAVAILABLE');
    const currentMap = controller.liveStatus?.fresh ? controller.liveStatus.map : null;
    if (!currentMap) throw new HttpError(503, 'agent_position_unavailable');
    const mode = String(controller.agentMode ?? '');
    if (mode !== 'PERSISTENT_IDLE' && mode !== 'AUTO_FARM')
      throw new HttpError(409, 'WORLD_MAP_BUSY');
    if (currentMap === mapId && (kind === 'town' || mode === 'AUTO_FARM'))
      return { reason: 'ALREADY_ON_TARGET_MAP', message: '已經在該地圖',
        targetMap: mapId, grindTarget: await readGrindTarget(account) };
    if (kind === 'farm' && currentMap === mapId) {
      const grindTarget = {
        mapId, name: row.name ?? mapId,
        levelRange: mapRoutingIndex.maps?.[mapId]?.levelRange ?? null,
        source: FARM_MAP_SOURCE.PLAYER_OVERRIDE, updatedAt: Date.now(),
      };
      if (!recovering) await writePersistedRelocation(account, mapId, 'world-map-farm');
      let command;
      try {
        await writeJsonAtomic(join(instancesRoot, instanceId(account.accountId),
          'grind-target.json'), grindTarget);
        observationConfigCache.delete(`grind:${Number(account.accountId)}`);
        command = await queueOwnershipCommand(account, charId,
          { action: 'start_farm', expectedRevision: Number(controller.revision) },
          { targetMap: mapId, lootEnabled: true, survivalEnabled: true,
            deathRecoveryEnabled: true });
      } catch (error) {
        if (!recovering) await clearPersistedRelocation(account);
        throw error;
      }
      pendingRelocations.set(charId, {
        accountId: Number(account.accountId), charId, targetMap: mapId,
        stage: 'WAIT_FARM', commandId: command.commandId,
        attempts: 0, busy: false,
        deadline: Date.now() + coordinatorDeadlineMsForRouteSteps(1),
      });
      return { reason: 'WORLD_MAP_FARM_START_QUEUED', targetMap: mapId,
        cost: 0, cooldownSeconds: 0, command };
    }
    if (nativeSupplyPolicyCommandEnabled && kind === 'farm') {
      const preflight = await readFarmMapSupplyPreflight(account, controller);
      if (!preflight.allowed) {
        if (!recovering)
          await writePersistedRelocation(account, mapId, 'world-map-farm',
            { parentFarmMap: controller.targetMap ?? null });
        if (preflight.reason !== 'SUPPLY_REQUIRED')
          throw new HttpError(503, preflight.reason);
        const [services, supplyPolicy] = await Promise.all([
          nativeSupplyServicePlan(account), loadNativeSupplyPolicy(account),
        ]);
        const farmRules = mode === 'PERSISTENT_IDLE'
          ? await buildCanonicalFarmRules(account, { targetMap: mapId,
              lootEnabled: true, survivalEnabled: true,
              deathRecoveryEnabled: true }) : null;
        const command = await queueOwnershipCommand(account, charId,
          { action: 'prepare_farm_switch', expectedRevision: Number(controller.revision) },
          { targetMap: mapId, anchorX: row.landing.x, anchorY: row.landing.y,
            kind: 'farm', supplyPolicy, ...services,
            ...(farmRules ? { farmRules } : {}) });
        pendingRelocations.set(charId, {
          accountId: Number(account.accountId), charId, targetMap: mapId,
          parentFarmMap: controller.targetMap ?? null,
          stage: 'WAIT_PREPARED_FARM', commandId: command.commandId,
          commandRevision: Number(controller.revision),
          attempts: 0, busy: false, deadline: Date.now() + 300_000,
        });
        return { reason: 'WORLD_MAP_SUPPLY_QUEUED', targetMap: mapId,
          command, supplyReason: preflight.supplyReason };
      }
    }
    const availability = await playerWorldMapAvailability(account);
    const selection = (kind === 'town' ? availability.towns : availability.maps)
      .find((candidate) => candidate.map === mapId);
    if (!selection || selection.buttonState !== 'AVAILABLE') {
      const reason = selection?.buttonState ?? 'PLAYER_STATE_UNAVAILABLE';
      throw new HttpError(409, reason === 'INSUFFICIENT_ZENY'
        ? `INSUFFICIENT_ZENY required=${selection.cost} current=${selection.currentZeny}` : reason);
    }
    const grindTarget = kind === 'farm' ? {
      mapId, name: row.name ?? mapId,
      levelRange: mapRoutingIndex.maps?.[mapId]?.levelRange ?? null,
      source: FARM_MAP_SOURCE.PLAYER_OVERRIDE,
      updatedAt: Date.now(),
    } : null;
    const intentKind = `world-map-${kind}`;
    if (!recovering) await writePersistedRelocation(account, mapId, intentKind);
    let command;
    try {
      command = mode === 'AUTO_FARM'
        ? await queueOwnershipCommand(account, charId,
          { action: 'stop_farm', expectedRevision: Number(controller.revision) },
          nativeSupplyPolicyCommandEnabled && kind === 'farm'
            ? { nextFarmMap: mapId } : null)
        : await queueOwnershipCommand(account, charId,
          { action: 'world_map_teleport', expectedRevision: Number(controller.revision) },
          { targetMap: mapId, kind, anchorX: row.landing.x, anchorY: row.landing.y });
    } catch (error) {
      if (!recovering) await clearPersistedRelocation(account);
      throw error;
    }
    pendingRelocations.set(charId, {
      accountId: Number(account.accountId), charId, targetMap: mapId,
      kind, landing: row.landing, grindTarget, commandId: command.commandId,
      stage: mode === 'AUTO_FARM' ? 'WAIT_WORLD_MAP_IDLE' : 'WAIT_WORLD_MAP_ARRIVAL',
      attempts: 0, busy: false, deadline: Date.now() + 60_000,
    });
    return { reason: 'WORLD_MAP_TELEPORT_QUEUED', targetMap: mapId,
      cost: selection.cost, cooldownSeconds: selection.cooldownSeconds, command };
  } finally {
    relocationRequests.delete(charId);
  }
}

async function queueServerAgentRelocation(account, controller, requestedMapId) {
  const charId = Number(account.characterId);
  // Serialize admission before the first async read or intent write.
  if (pendingRelocations.has(charId) || relocationRequests.has(charId))
    throw new HttpError(409, 'farm_relocation_in_progress');
  relocationRequests.add(charId);
  try {
    return await queueServerAgentRelocationPrepared(account, controller, requestedMapId);
  } finally {
    relocationRequests.delete(charId);
  }
}

async function queueServerAgentRelocationPrepared(account, controller, requestedMapId) {
  const charId = Number(account.characterId);
  const mapId = String(requestedMapId ?? '').trim();
  if (!/^[a-z0-9_]{1,31}$/.test(mapId))
    throw new HttpError(400, 'farm_target_unresolved');
  const eligibility = farmMapEligibility(mapId);
  if (!eligibility.map) throw new HttpError(409, 'farm_target_unresolved');
  // All maps stay visible; the release registry independently gates commands.
  if (!eligibility.farmable)
    throw new HttpError(409, 'farm_map_not_farmable');
  if (!eligibility.farmSelectionAvailable)
    throw new HttpError(409, 'farm_map_not_released');
  const map = eligibility.map;

  // The authoritative current position comes from the PA live-status read model.
  const live = controller.liveStatus ?? null;
  const currentMap = live?.fresh && live.map ? String(live.map) : null;
  if (!currentMap) throw new HttpError(409, 'agent_position_unavailable');

  const readModel = await readServerAgentReadModel(charId);
  const inventory = {};
  for (const row of readModel?.inventory ?? []) {
    const itemId = String(row.itemId);
    inventory[itemId] = Number(inventory[itemId] ?? 0) + Number(row.amount ?? 0);
  }
  const savePoint = await readCharacterSavePoint(account.accountId);
  // STANDARD_FARM has one route authority: the accepted weighted model and
  // PA step adapter. Other service-routing domains keep their existing seam.
  let plan;
  if (eligibility.availability?.routeClass === 'STANDARD') {
    let bundle;
    try { bundle = await canonicalStandardFarmGraph(); }
    catch (error) {
      console.warn(`WEB_STANDARD_FARM_GRAPH_UNAVAILABLE char=${charId}: ${error?.message ?? error}`);
      throw new HttpError(409, RELOCATION_REASON.FARM_ROUTE_UNAVAILABLE);
    }
    plan = planCanonicalStandardFarmMapChange(bundle, currentMap, mapId);
    const route = plan.steps.find((step) => step.kind === 'DIRECT_TO_TARGET')?.route ?? null;
    const routeDigest = route
      ? createHash('sha256').update(JSON.stringify(route)).digest('hex').toUpperCase()
      : null;
    plan.routeDigest = routeDigest;
    console.info('WEB_STANDARD_FARM_WEIGHTED_ROUTE ' + JSON.stringify({
      charId, fromMap: currentMap, targetMap: mapId,
      engine: plan.routeEngine, sourceDigest: plan.sourceDigest ?? null,
      cost: plan.routeCost ?? null, edgeSources: plan.edgeSources,
      route, routeDigest,
      reason: plan.reason,
    }));
  } else {
    plan = planFarmMapChange(
      await serverAgentWarpGraph(), currentMap, mapId,
      { inventory, savePoint, mapSummary: map },
    );
  }
  const grindTarget = {
    mapId,
    name: map.name ?? mapId,
    levelRange: map.levelRange ?? null,
    source: FARM_MAP_SOURCE.PLAYER_OVERRIDE,
    updatedAt: Date.now(),
  };
  // P5 write safety: starting AUTO_FARM must not rewrite grind-target.json.
  // The file is written only when the resolved target actually differs from the
  // persisted one (a genuine user change or first selection), never merely
  // because start/target resolution ran. A blocked selection never persists:
  // an unreachable map must not overwrite the last good farm target.
  const persistedGrindTarget = await readGrindTarget(account);
  const targetChanged =
    !persistedGrindTarget
    || String(persistedGrindTarget.mapId ?? '') !== mapId
    || persistedGrindTarget.source !== FARM_MAP_SOURCE.PLAYER_OVERRIDE;
  const grindTargetPath = join(instancesRoot, instanceId(account.accountId), 'grind-target.json');
  const priorTargetBytes = targetChanged
    ? await readFile(grindTargetPath, 'utf8').catch((error) => {
        if (error?.code === 'ENOENT') return null;
        throw error;
      })
    : null;
  const persistGrindTarget = async () => {
    if (!targetChanged) return;
    await writeJsonAtomic(grindTargetPath, grindTarget);
    observationConfigCache.delete(`grind:${Number(account.accountId)}`);
  };
  const dispatchWithIntent = async (action, persistRelocation) => {
    try {
      await persistGrindTarget();
      if (persistRelocation) await writePersistedRelocation(account, mapId);
      return action ? await action() : null;
    } catch (error) {
      if (persistRelocation) await clearPersistedRelocation(account);
      if (targetChanged) {
        if (priorTargetBytes === null) {
          await unlink(grindTargetPath).catch((unlinkError) => {
            if (unlinkError?.code !== 'ENOENT') throw unlinkError;
          });
        } else {
          const rollbackPath = `${grindTargetPath}.rollback-${randomUUID()}`;
          try {
            await writeFile(rollbackPath, priorTargetBytes, 'utf8');
            await rename(rollbackPath, grindTargetPath);
          } catch (rollbackError) {
            await unlink(rollbackPath).catch(() => {});
            throw rollbackError;
          }
        }
        observationConfigCache.delete(`grind:${Number(account.accountId)}`);
      }
      throw error;
    }
  };

  if (plan.mode === 'UNREACHABLE') {
    console.warn(`WEB_RELOCATION_UNREACHABLE char=${charId} map=${mapId} reason=${plan.reason}`);
    throw new HttpError(409, RELOCATION_REASON.FARM_ROUTE_UNAVAILABLE);
  }
  if (plan.mode === 'ALREADY_AT_DESTINATION') {
    pendingRelocations.delete(charId);
    await clearPersistedRelocation(account);
    // The current map can equal the newly selected target while an old farm
    // session is still active. Native start_farm accepts only PERSISTENT_IDLE;
    // reuse the existing stop/idle/start coordinator without a navigation leg.
    if (controller.agentMode !== 'PERSISTENT_IDLE') {
      const command = await dispatchWithIntent(
        () => queueOwnershipCommand(account, charId, {
          action: 'stop_farm', expectedRevision: Number(controller.revision),
        }),
        true,
      );
      pendingRelocations.set(charId, {
        accountId: Number(account.accountId), charId, targetMap: mapId,
        stage: 'WAIT_START_FARM', attempts: 0, busy: false,
        deadline: Date.now() + coordinatorDeadlineMsForRouteSteps(1),
      });
      return {
        policy: plan.policy,
        route: null,
        reason: plan.reason,
        targetMap: mapId,
        command,
        grindTarget,
      };
    }
    const command = await dispatchWithIntent(
      () => queueOwnershipCommand(
        account,
        charId,
        { action: 'start_farm', expectedRevision: Number(controller.revision) },
        {
          targetMap: mapId,
          lootEnabled: true,
          survivalEnabled: true,
          deathRecoveryEnabled: true,
        },
      ),
      true,
    );
    // A queued command is not an authoritative farm transition. Keep the
    // durable intent and let the same coordinator confirm AUTO_FARM.
    pendingRelocations.set(charId, {
      accountId: Number(account.accountId), charId, targetMap: mapId,
      stage: 'WAIT_FARM', commandId: command.commandId,
      attempts: 0, busy: false,
      deadline: Date.now() + coordinatorDeadlineMsForRouteSteps(1),
    });
    return {
      policy: plan.policy,
      route: null,
      reason: plan.reason,
      targetMap: mapId,
      command,
      grindTarget,
    };
  }

  const directStep = plan.steps.find((step) => step.kind === 'DIRECT_TO_TARGET');
  const isSimpleDirect = plan.mode === 'DIRECT' && directStep &&
    plan.steps.length === 2;
  if (isSimpleDirect) {
    const farmActive = Boolean(controller.agentMode) && controller.agentMode !== 'PERSISTENT_IDLE';
    const command = await dispatchWithIntent(farmActive
      ? () => queueOwnershipCommand(account, charId, {
          action: 'stop_farm', expectedRevision: Number(controller.revision),
        })
      : null, true);
    pendingRelocations.set(charId, {
      accountId: Number(account.accountId), charId, targetMap: mapId,
      route: directStep.route, stage: 'WAIT_IDLE', attempts: 0,
      busy: false,
      routeEngine: plan.routeEngine ?? null,
      sourceDigest: plan.sourceDigest ?? null,
      routeDigest: plan.routeDigest ?? null,
      deadline: Date.now() + coordinatorDeadlineMsForRouteSteps(directStep.route.length),
    });
    return { policy: plan.policy, route: directStep.route, targetMap: mapId, command,
      grindTarget, routeEngine: plan.routeEngine ?? null, routeCost: plan.routeCost ?? null,
      sourceDigest: plan.sourceDigest ?? null };
  }

  const farmActive =
    Boolean(controller.agentMode) && controller.agentMode !== 'PERSISTENT_IDLE';
  const command = await dispatchWithIntent(farmActive
    ? () => queueOwnershipCommand(account, charId, {
        action: 'stop_farm', expectedRevision: Number(controller.revision),
      })
    : null, true);
  pendingRelocations.set(charId, {
    accountId: Number(account.accountId),
    charId,
    targetMap: mapId,
    route: null,
    stage: 'RELOCATION',
    relocationPlan: plan,
    kafraContext: kafraContextForPlan(plan),
    relocationProgress: createRelocationProgress(),
    commandIndexByStage: {},
    commandPending: false,
    commandRevision: null,
    attempts: 0,
    busy: false,
    // Use the ALREADY RESOLVED route length; never re-plan a second route.
    deadline:
      Date.now() +
      coordinatorDeadlineMsForRouteSteps(
        Math.max(1, plan.steps.reduce((count, step) =>
          count + (Array.isArray(step.route) ? step.route.length : 1), 0)),
      ),
  });
  return {
    policy: plan.policy,
    route: directStep?.route ?? null,
    mode: plan.mode,
    routeCost: plan.routeCost,
    routeEngine: plan.routeEngine ?? null,
    sourceDigest: plan.sourceDigest ?? null,
    edgeTypes: plan.edgeTypes,
    targetMap: mapId,
    command,
    grindTarget,
  };
}
// ---------------------------------------------------------------------------


async function getOwnershipCommand(account, charId, commandId) {
  if (
    Number(account.characterId) !== charId ||
    !commandIdPattern.test(commandId)
  )
    throw new HttpError(403, 'ownership_conflict');
  const output = await sql(
    `SELECT c.command_id,c.char_id,c.action,c.expected_revision,c.command_status,COALESCE(c.reason_code,''),COALESCE(c.resulting_revision,''),COALESCE(c.accepted_at,''),COALESCE(c.confirmed_at,'') FROM persistent_agent_command c JOIN persistent_agent_state s ON s.char_id=c.char_id WHERE c.command_id='${escapeSql(commandId)}' AND c.char_id=${charId} AND s.account_id=${Number(account.accountId)} LIMIT 1;`,
  );
  const command = parseOwnershipCommandRow(output);
  if (!command) throw new HttpError(404, 'command_not_found');
  return command;
}

async function queueOwnershipCommand(
  account,
  charId,
  body,
  serverResolvedPayload = null,
) {
  if (Number(account.characterId) !== charId)
    throw new HttpError(403, 'ownership_conflict');
  const action = String(body.action ?? '');
  if (!ownershipActions.has(action))
    throw new HttpError(422, 'invalid_transition');
  // OPENKORE_REMOVED invariant: returning a character to the legacy OpenKore
  // controller is retired from every production Web path. Only the authorized
  // isolated acceptance harness may still exercise the historical handback.
  if (action === 'release_agent' && runtimeMode !== 'isolated-test')
    throw new HttpError(409, 'OPENKORE_HANDOFF_RETIRED');
  if (rolloutGatedActions.has(action)) {
    const gate = await readPersistentAgentRollout(sql, account.accountId, charId, {
      requireEdenCourseA:
        action === 'start_quest_sequence' &&
        String(body.sequenceId ?? '') === edenCourseASequence.sequenceId,
    });
    if (!gate.allowed) {
      await recordRolloutEvent(sql, {
        accountId: account.accountId,
        charId,
        eventType: 'ROLLOUT_REJECTED',
        errorCode: gate.reason,
      }).catch(() => {});
      throw new HttpError(403, gate.reason);
    }
  }
  const expectedRevision = Number(body.expectedRevision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    throw new HttpError(422, 'stale_revision');
  const commandId = String(body.commandId ?? randomUUID()).toLowerCase();
  if (!commandIdPattern.test(commandId))
    throw new HttpError(422, 'invalid_command_id');
  let payloadObject = {};
  if (serverResolvedPayload) {
    // Server-resolved SERVER_AGENT relocation payload. Only trusted server code
    // reaches this branch; the browser still never supplies route waypoints.
    payloadObject = serverResolvedPayload;
  } else if (action === 'start_farm') {
    // MOB_SELECTION_REMOVED: the player selects a farm MAP only. No mobId is
    // required, generated or forwarded; AUTO_FARM chooses the monster.
    const targetMap = String(body.targetMap ?? '');
    if (!/^[a-z0-9_]{1,31}$/.test(targetMap))
      throw new HttpError(422, 'invalid_transition');
    const skillEnabled = body.skillEnabled === undefined ? undefined : body.skillEnabled === true;
    const skillId = Number(body.skillId ?? 0);
    // A character's ordered attackSkillSlots may provide the skill ID after
    // authenticated config resolution below. Legacy one-skill requests still
    // require a valid ID before dispatch.
    if (skillEnabled && (!Number.isSafeInteger(skillId) || skillId < 0 || skillId > 65535))
      throw new HttpError(422, 'invalid_transition');
    payloadObject = {
      targetMap,
      lootEnabled: body.lootEnabled === true,
      skillEnabled,
      skillId: skillEnabled ? skillId : 0,
      survivalEnabled: body.survivalEnabled === true,
      deathRecoveryEnabled: body.deathRecoveryEnabled === true,
    };
  } else if (action === 'configure_supply_policy') {
    if (!nativeSupplyPolicyCommandEnabled)
      throw new HttpError(501, 'CAPABILITY_NOT_NATIVE');
    payloadObject = { supplyPolicy: await loadNativeSupplyPolicy(account) };
  } else if (action === 'resume_paid_farm_switch') {
    // Only the server-side paid-arrival recovery path may construct this.
    throw new HttpError(422, 'invalid_transition');
  } else if (action === 'start_navigation') {
    if (!Array.isArray(body.route) || body.route.length < 1 || body.route.length > 16)
      throw new HttpError(422, 'invalid_transition');
    payloadObject = {
      route: body.route.map((step) => {
        const map = String(step?.map ?? '');
        const x = Number(step?.x);
        const y = Number(step?.y);
        const portalTo = String(step?.portalTo ?? '');
        if (!/^[a-z0-9_]{1,31}$/.test(map) ||
            !Number.isSafeInteger(x) || x < 0 || x > 32767 ||
            !Number.isSafeInteger(y) || y < 0 || y > 32767 ||
            (portalTo && !/^[a-z0-9_]{1,31}$/.test(portalTo)))
          throw new HttpError(422, 'invalid_transition');
        return portalTo ? { map, x, y, portalTo } : { map, x, y };
      }),
    };
  } else if (action === 'allocate_stat_point') {
    // The browser names only the stat. It never sends the current value, the
    // cost or the resulting value; rAthena derives all of those.
    const stat = String(body.stat ?? '').toLowerCase();
    if (!['str', 'agi', 'vit', 'int', 'dex', 'luk'].includes(stat))
      throw new HttpError(422, 'invalid_stat');
    payloadObject = { stat };
  } else if (action === 'allocate_skill_point') {
    // The browser asks for one more level only; it never dictates the result.
    const skillId = Number(body.skillId);
    if (!Number.isSafeInteger(skillId) || skillId <= 0 || skillId > 65535)
      throw new HttpError(422, 'invalid_skill');
    payloadObject = { skillId };
  } else if (action === 'use_item') {
    const itemId = Number(body.itemId);
    const inventoryIndex = Number(body.inventoryIndex);
    const inventoryGeneration = Number(body.inventoryGeneration);
    if (!Number.isSafeInteger(itemId) || itemId <= 0 || itemId > 4294967295 ||
        !Number.isSafeInteger(inventoryIndex) || inventoryIndex < 0 || inventoryIndex >= 100 ||
        !Number.isSafeInteger(inventoryGeneration) || inventoryGeneration < 0)
      throw new HttpError(422, 'invalid_item_identity');
    payloadObject = { itemId, inventoryIndex, inventoryGeneration };
  } else if (action === 'card_insert') {
    // Both rows are authoritative rAthena inventory identities. The Web never
    // sends a slot number, resulting item or card order.
    const cardItemId = Number(body.cardItemId);
    const cardInventoryIndex = Number(body.cardInventoryIndex);
    const targetItemId = Number(body.targetItemId);
    const targetInventoryIndex = Number(body.targetInventoryIndex);
    const inventoryGeneration = Number(body.inventoryGeneration);
    if (!Number.isSafeInteger(cardItemId) || cardItemId <= 0 || cardItemId > 4294967295 ||
        !Number.isSafeInteger(targetItemId) || targetItemId <= 0 || targetItemId > 4294967295 ||
        !Number.isSafeInteger(cardInventoryIndex) || cardInventoryIndex < 0 || cardInventoryIndex >= 100 ||
        !Number.isSafeInteger(targetInventoryIndex) || targetInventoryIndex < 0 || targetInventoryIndex >= 100 ||
        cardInventoryIndex === targetInventoryIndex ||
        !Number.isSafeInteger(inventoryGeneration) || inventoryGeneration < 0)
      throw new HttpError(422, 'invalid_item_identity');
    payloadObject = {
      cardItemId,
      cardInventoryIndex,
      targetItemId,
      targetInventoryIndex,
      inventoryGeneration,
    };
  } else if (action === 'talk_to_npc') {
    const npcName = String(body.npcName ?? '');
    const targetMap = String(body.targetMap ?? '');
    const goal = String(body.goal ?? 'dialog');
    if (!/^[A-Za-z0-9_]{1,31}$/.test(npcName) ||
        !/^[a-z0-9_]{1,31}$/.test(targetMap) || goal !== 'dialog')
      throw new HttpError(422, 'invalid_transition');
    payloadObject = { npcName, targetMap, goal };
  } else if (action === 'dialog_select') {
    const index = Number(body.index);
    if (!Number.isSafeInteger(index) || index < 1 || index > 254)
      throw new HttpError(422, 'invalid_transition');
    payloadObject = { index };
  } else if (action === 'dialog_input') {
    const text = String(body.text ?? '');
    if (!text || text.length > 40 || /[\r\n\0]/.test(text))
      throw new HttpError(422, 'invalid_transition');
    payloadObject = { text };
  } else if (action === 'start_quest') {
    const taskId = Number(body.taskId);
    const questId = Number(body.questId);
    const requiredQuestId = Number(body.requiredQuestId ?? 0);
    const npcName = String(body.npcName ?? '');
    const npcMap = String(body.npcMap ?? '');
    const objectiveMap = String(body.objectiveMap ?? '');
    const mobId = Number(body.mobId);
    const targetCount = Number(body.targetCount);
    const objectiveX = Number(body.objectiveX);
    const objectiveY = Number(body.objectiveY);
    const collectItemId = Number(body.collectItemId ?? 0);
    const collectCount = Number(body.collectCount ?? 0);
    const rewardItemId = Number(body.rewardItemId);
    const rewardItemCount = Number(body.rewardItemCount);
    if (!Number.isSafeInteger(taskId) || taskId <= 0 ||
        !Number.isSafeInteger(questId) || questId <= 0 ||
        !Number.isSafeInteger(requiredQuestId) || requiredQuestId < 0 ||
        !/^[A-Za-z0-9_]{1,31}$/.test(npcName) ||
        !/^[a-z0-9_]{1,31}$/.test(npcMap) ||
        !/^[a-z0-9_]{1,31}$/.test(objectiveMap) ||
        !Number.isSafeInteger(mobId) || mobId <= 0 ||
        !Number.isSafeInteger(targetCount) || targetCount < 1 || targetCount > 1000 ||
        !Number.isSafeInteger(objectiveX) || objectiveX < 0 || objectiveX > 32767 ||
        !Number.isSafeInteger(objectiveY) || objectiveY < 0 || objectiveY > 32767 ||
        !Number.isSafeInteger(collectItemId) || collectItemId < 0 || collectItemId > 4294967295 ||
        !Number.isSafeInteger(collectCount) || collectCount < 0 ||
        (collectCount > 0 && collectItemId === 0) ||
        !Number.isSafeInteger(rewardItemId) || rewardItemId <= 0 || rewardItemId > 4294967295 ||
        !Number.isSafeInteger(rewardItemCount) || rewardItemCount < 1)
      throw new HttpError(422, 'invalid_transition');
    payloadObject = {
      taskId,
      questId,
      requiredQuestId,
      npcName,
      npcMap,
      objectiveMap,
      mobId,
      targetCount,
      objectiveX,
      objectiveY,
      collectItemId,
      collectCount,
      rewardItemId,
      rewardItemCount,
    };
  } else if (action === 'start_quest_sequence') {
    const taskId = Number(body.taskId);
    const sequenceId = String(body.sequenceId ?? '');
    if (!Number.isSafeInteger(taskId) || taskId <= 0 ||
        !/^[A-Za-z0-9_.:-]{1,64}$/.test(sequenceId) ||
        !Array.isArray(body.steps) || body.steps.length < 1 || body.steps.length > 128)
      throw new HttpError(422, 'invalid_transition');
    payloadObject = {
      taskId,
      sequenceId,
      steps: body.steps.map((step) => normalizeQuestSequenceStep(step, 0)),
    };
  } else if (action === 'run_server_command') {
    // P2I generic native quest/job execution. The Web supplies only the bound
    // rAthena command name and validated tokens; the map-server revalidates the
    // server-side allowlist and the bound NPC script owns every mutation.
    const command = String(body.command ?? '');
    const argumentText = String(body.arguments ?? '');
    if (!/^[a-z][a-z0-9_]{0,30}$/.test(command) ||
        (argumentText &&
          !/^[A-Za-z0-9_.:-]{1,64}(?: [A-Za-z0-9_.:-]{1,64}){0,15}$/.test(argumentText)))
      throw new HttpError(422, 'invalid_transition');
    payloadObject = argumentText ? { command, arguments: argumentText } : { command };
  } else if (action === 'cancel_task') {
    const taskId = Number(body.taskId ?? 0);
    if (!Number.isSafeInteger(taskId) || taskId < 0)
      throw new HttpError(422, 'invalid_transition');
    payloadObject = taskId > 0 ? { taskId } : {};
  } else if (action.startsWith('service_') && action !== 'service_status_reset') {
    // Generic service actions carry an explicit NPC identity from the browser.
    // service_status_reset is the exception: the Web must NOT name the Reset
    // Girl, so its identity is resolved server-side and its payload stays empty.
    const npcName = String(body.npcName ?? '');
    const targetMap = String(body.targetMap ?? '');
    if (!/^[A-Za-z0-9_]{1,31}$/.test(npcName) ||
        !/^[a-z0-9_]{1,31}$/.test(targetMap))
      throw new HttpError(422, 'invalid_transition');
    payloadObject = { npcName, targetMap };
    if (action === 'service_shop_buy' || action === 'service_shop_sell' ||
        action === 'service_storage_deposit' || action === 'service_storage_withdraw') {
      const itemId = Number(body.itemId);
      const quantity = Number(body.quantity);
      if (!Number.isSafeInteger(itemId) || itemId <= 0 || itemId > 4294967295 ||
          !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 30000)
        throw new HttpError(422, 'invalid_transition');
      payloadObject.itemId = itemId;
      payloadObject.quantity = quantity;
    }
    if (action === 'service_save_point' || action === 'service_transport') {
      const destinationMap = String(body.destinationMap ?? '');
      const destinationX = Number(body.destinationX);
      const destinationY = Number(body.destinationY);
      if (!/^[a-z0-9_]{1,31}$/.test(destinationMap) ||
          !Number.isSafeInteger(destinationX) || destinationX < 0 || destinationX > 32767 ||
          !Number.isSafeInteger(destinationY) || destinationY < 0 || destinationY > 32767)
        throw new HttpError(422, 'invalid_transition');
      payloadObject.destinationMap = destinationMap;
      payloadObject.destinationX = destinationX;
      payloadObject.destinationY = destinationY;
    }
  }
  if (action === 'start_farm') {
    // IDLE prepare and ordinary farm start share this exact character policy.
    payloadObject = await buildCanonicalFarmRules(account, payloadObject);
  if (nativeSupplyPolicyCommandEnabled &&
      (action === 'stop_farm' && payloadObject.nextFarmMap ||
      action === 'world_map_teleport' && payloadObject.kind === 'farm')
      )
    payloadObject.supplyPolicy = await loadNativeSupplyPolicy(account);
  }
  const payload = JSON.stringify(payloadObject);
  const payloadHash = createHash('sha256')
    .update(`${action}\0${charId}\0${expectedRevision}\0${payload}`)
    .digest('hex');
  await sql(
    `INSERT IGNORE INTO persistent_agent_command (command_id,char_id,action,payload,payload_hash,expected_revision,command_status,requested_at) VALUES ('${escapeSql(commandId)}',${charId},'${action}','${payload}','${payloadHash}',${expectedRevision},'QUEUED',CURRENT_TIMESTAMP(3));`,
  );
  const command = await getOwnershipCommand(account, charId, commandId);
  const expectedMatch =
    command.action === action &&
    command.expectedRevision === expectedRevision;
  const storedHash = await sql(
    `SELECT payload_hash FROM persistent_agent_command WHERE command_id='${escapeSql(commandId)}' LIMIT 1;`,
  );
  if (!expectedMatch || storedHash !== payloadHash) {
    await recordRolloutEvent(sql, {
      accountId: account.accountId,
      charId,
      eventType: 'DUPLICATE_COMMAND_REJECTED',
      errorCode: 'idempotency_conflict',
      commandId,
    }).catch(() => {});
    throw new HttpError(409, 'idempotency_conflict');
  }
  return command;
}

// P2I canonical job-commit transport. For a SERVER_AGENT character the adapter's
// resolved server command is executed natively through `run_server_command`; for
// an OPENKORE character the incumbent `quest_server_command` transport is
// preserved unchanged. A SERVER_AGENT character never falls back to OpenKore.
async function sendQuestCommitCommand({ identity, command }) {
  const charId = Number(identity.charId);
  const account = { accountId: Number(identity.accountId), characterId: charId };
  const controller = await readCharacterControllerStatus(account, charId, {
    includeFarmTarget: false,
  });
  if (controller.available && controller.controller === SERVER_AGENT_OWNER) {
    const stateRow = await readAgentStateRow(charId);
    if (!stateRow) throw new HttpError(409, 'agent_state_unavailable');
    const name = String(command?.name ?? '').replace(/^@/, '');
    const args = Array.isArray(command?.arguments)
      ? command.arguments.map((value) => String(value))
      : [];
    await queueOwnershipCommand(account, charId, {
      action: 'run_server_command',
      command: name,
      ...(args.length ? { arguments: args.join(' ') } : {}),
      expectedRevision: Number(stateRow.revision),
    });
    return { accepted: true, transport: 'persistent_agent_command' };
  }
  if (
    !controller.available &&
    controller.unavailableReason === 'agent_status_unavailable'
  )
    throw new HttpError(503, '系統狀態暫時無法讀取，已停止操作以保護角色');
  await queueCharacterCommand(
    { accountId: Number(identity.accountId) },
    'quest_server_command',
    JSON.stringify(command),
  );
  return { accepted: true, transport: 'openkore' };
}

await sql(`CREATE TABLE IF NOT EXISTS web_sessions (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  account_id INT UNSIGNED NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL,
  INDEX account_idx (account_id), INDEX expiry_idx (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await sql(`ALTER TABLE web_sessions
  ADD COLUMN IF NOT EXISTS support_session_id CHAR(36) NULL,
  ADD COLUMN IF NOT EXISTS actor_admin_id VARCHAR(128) NULL,
  ADD COLUMN IF NOT EXISTS effective_char_id INT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS support_reason VARCHAR(256) NULL,
  ADD COLUMN IF NOT EXISTS support_mode ENUM('OBSERVE_ONLY','PLAYER_ACTIONS') NULL,
  ADD COLUMN IF NOT EXISTS created_from VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS support_revoked_at BIGINT UNSIGNED NULL,
  ADD UNIQUE KEY IF NOT EXISTS support_session_idx (support_session_id);`);
await sql(`CREATE TABLE IF NOT EXISTS web_support_session_events (
  event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_type ENUM('SUPPORT_SESSION_CREATED','SUPPORT_SESSION_USED','SUPPORT_SESSION_REVOKED','SUPPORT_SESSION_EXPIRED') NOT NULL,
  support_session_id CHAR(36) NOT NULL,
  actor_admin_id VARCHAR(128) NOT NULL,
  effective_account_id INT UNSIGNED NOT NULL,
  effective_char_id INT UNSIGNED NOT NULL,
  reason VARCHAR(256) NOT NULL,
  support_mode ENUM('OBSERVE_ONLY','PLAYER_ACTIONS') NOT NULL,
  created_from VARCHAR(64) NOT NULL,
  trace_id VARCHAR(96) NULL,
  occurred_at BIGINT UNSIGNED NOT NULL,
  KEY support_session_event_idx (support_session_id,occurred_at),
  KEY event_type_idx (event_type,occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await sql(`CREATE TABLE IF NOT EXISTS web_support_session_action_events (
  event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  support_session_id CHAR(36) NOT NULL,
  actor_admin_id VARCHAR(128) NOT NULL,
  effective_account_id INT UNSIGNED NOT NULL,
  effective_char_id INT UNSIGNED NOT NULL,
  action_key VARCHAR(96) NOT NULL,
  resource VARCHAR(192) NOT NULL,
  command_id VARCHAR(96) NULL,
  result VARCHAR(32) NOT NULL,
  error_code VARCHAR(96) NULL,
  trace_id VARCHAR(96) NULL,
  occurred_at BIGINT UNSIGNED NOT NULL,
  KEY support_action_event_idx (support_session_id,occurred_at),
  KEY action_result_idx (action_key,result,occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await sql(`CREATE TABLE IF NOT EXISTS web_account_activity (
  account_id INT UNSIGNED NOT NULL PRIMARY KEY,
  last_web_login_at BIGINT UNSIGNED NOT NULL,
  updated_at BIGINT UNSIGNED NOT NULL,
  INDEX last_login_idx (last_web_login_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await sql(`INSERT INTO web_account_activity (account_id,last_web_login_at,updated_at)
SELECT account_id,MAX(created_at),${Date.now()} FROM web_sessions GROUP BY account_id
ON DUPLICATE KEY UPDATE
last_web_login_at=GREATEST(last_web_login_at,VALUES(last_web_login_at)),
updated_at=VALUES(updated_at);`);
await sql(`CREATE TABLE IF NOT EXISTS web_automation (
  account_id INT UNSIGNED NOT NULL PRIMARY KEY,
  desired_running TINYINT(1) UNSIGNED NOT NULL DEFAULT 0,
  updated_at BIGINT UNSIGNED NOT NULL,
  INDEX desired_idx (desired_running)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await sql(`CREATE TABLE IF NOT EXISTS web_accounts (
  account_id INT UNSIGNED NOT NULL PRIMARY KEY,
  password_salt CHAR(32) NOT NULL,
  password_hash CHAR(128) NOT NULL,
  migrated_at BIGINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await sql(`CREATE TABLE IF NOT EXISTS account_external_identity (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_id INT UNSIGNED NOT NULL,
  provider VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  provider_user_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  avatar_url VARCHAR(512) NULL,
  linked_at BIGINT UNSIGNED NOT NULL,
  last_login_at BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_external_provider_user (provider,provider_user_id),
  UNIQUE KEY uq_external_account_provider (account_id,provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await sql(`CREATE TABLE IF NOT EXISTS web_oauth_state (
  state_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  browser_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  session_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  provider VARCHAR(32) NOT NULL,
  intent ENUM('LOGIN','LINK') NOT NULL,
  account_id INT UNSIGNED NULL,
  redirect_uri VARCHAR(512) NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL,
  consumed_at BIGINT UNSIGNED NULL,
  KEY ix_oauth_state_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await sql(`CREATE TABLE IF NOT EXISTS web_account_flags (
  account_id INT UNSIGNED NOT NULL PRIMARY KEY,
  is_test TINYINT(1) UNSIGNED NOT NULL DEFAULT 0,
  updated_at BIGINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await sql(`CREATE TABLE IF NOT EXISTS web_rate_limit_locks (
  limit_name VARCHAR(32) NOT NULL PRIMARY KEY,
  touched_at BIGINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await sql(`CREATE TABLE IF NOT EXISTS web_registration_events (
  event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_hash CHAR(64) NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  INDEX client_time_idx (client_hash,created_at),
  INDEX created_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await sql(`INSERT IGNORE INTO web_rate_limit_locks (limit_name,touched_at)
VALUES ('registration',${Date.now()});`);
await sql(`INSERT IGNORE INTO web_account_flags (account_id,is_test,updated_at)
SELECT account_id,1,${Date.now()} FROM login
WHERE userid REGEXP '^(jobtest_|gate2_)';`);
await sql(`ALTER TABLE \`char\`
  ADD INDEX IF NOT EXISTS ranking_class_level_idx
  (\`class\`,base_level,job_level,base_exp,job_exp,char_id);`);
await sql(`CREATE TABLE IF NOT EXISTS web_preferences (
  account_id INT UNSIGNED NOT NULL PRIMARY KEY,
  music_enabled TINYINT(1) UNSIGNED NOT NULL DEFAULT 1,
  sound_enabled TINYINT(1) UNSIGNED NOT NULL DEFAULT 1,
  music_volume TINYINT UNSIGNED NOT NULL DEFAULT 20,
  sound_volume TINYINT UNSIGNED NOT NULL DEFAULT 35,
  damage_floats_enabled TINYINT(1) UNSIGNED NOT NULL DEFAULT 1,
  damage_float_size TINYINT UNSIGNED NOT NULL DEFAULT 14,
  damage_float_scale SMALLINT UNSIGNED NOT NULL DEFAULT 500,
  damage_float_opacity TINYINT UNSIGNED NOT NULL DEFAULT 100,
  damage_float_weight SMALLINT UNSIGNED NOT NULL DEFAULT 800,
  damage_float_font VARCHAR(16) NOT NULL DEFAULT 'classic',
  damage_float_position_x TINYINT UNSIGNED NOT NULL DEFAULT 72,
  damage_float_position_y TINYINT UNSIGNED NOT NULL DEFAULT 72,
  damage_float_arc SMALLINT UNSIGNED NOT NULL DEFAULT 100,
  pet_companion_enabled TINYINT(1) UNSIGNED NOT NULL DEFAULT 1,
  pet_companion_species VARCHAR(32) NOT NULL DEFAULT 'bulbasaur',
  pet_companion_size SMALLINT UNSIGNED NOT NULL DEFAULT 72,
  pet_activity_level VARCHAR(8) NOT NULL DEFAULT 'normal',
  pet_idle_sleep_enabled TINYINT(1) UNSIGNED NOT NULL DEFAULT 1,
  pet_reduce_activity_in_log TINYINT(1) UNSIGNED NOT NULL DEFAULT 1,
  show_pet_in_profile TINYINT(1) UNSIGNED NOT NULL DEFAULT 0,
  show_pet_in_ranking TINYINT(1) UNSIGNED NOT NULL DEFAULT 0,
  updated_at BIGINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await sql(`ALTER TABLE web_preferences
  ADD COLUMN IF NOT EXISTS damage_floats_enabled TINYINT(1) UNSIGNED NOT NULL DEFAULT 1 AFTER sound_volume,
  ADD COLUMN IF NOT EXISTS damage_float_size TINYINT UNSIGNED NOT NULL DEFAULT 14 AFTER damage_floats_enabled,
  ADD COLUMN IF NOT EXISTS damage_float_scale SMALLINT UNSIGNED NOT NULL DEFAULT 500 AFTER damage_float_size,
  ADD COLUMN IF NOT EXISTS damage_float_opacity TINYINT UNSIGNED NOT NULL DEFAULT 100 AFTER damage_float_scale,
  ADD COLUMN IF NOT EXISTS damage_float_weight SMALLINT UNSIGNED NOT NULL DEFAULT 800 AFTER damage_float_opacity,
  ADD COLUMN IF NOT EXISTS damage_float_font VARCHAR(16) NOT NULL DEFAULT 'classic' AFTER damage_float_weight,
  ADD COLUMN IF NOT EXISTS damage_float_position_x TINYINT UNSIGNED NOT NULL DEFAULT 72 AFTER damage_float_font,
  ADD COLUMN IF NOT EXISTS damage_float_position_y TINYINT UNSIGNED NOT NULL DEFAULT 72 AFTER damage_float_position_x,
  ADD COLUMN IF NOT EXISTS damage_float_arc SMALLINT UNSIGNED NOT NULL DEFAULT 100 AFTER damage_float_position_y;`);
await sql(`ALTER TABLE web_preferences
  MODIFY COLUMN damage_float_scale SMALLINT UNSIGNED NOT NULL DEFAULT 500;`);
await sql(`ALTER TABLE web_preferences
  ADD COLUMN IF NOT EXISTS pet_companion_enabled TINYINT(1) UNSIGNED NOT NULL DEFAULT 1 AFTER damage_float_arc,
  ADD COLUMN IF NOT EXISTS pet_companion_species VARCHAR(32) NOT NULL DEFAULT 'bulbasaur' AFTER pet_companion_enabled,
  ADD COLUMN IF NOT EXISTS pet_companion_size SMALLINT UNSIGNED NOT NULL DEFAULT 72 AFTER pet_companion_enabled,
  ADD COLUMN IF NOT EXISTS pet_activity_level VARCHAR(8) NOT NULL DEFAULT 'normal' AFTER pet_companion_size,
  ADD COLUMN IF NOT EXISTS pet_idle_sleep_enabled TINYINT(1) UNSIGNED NOT NULL DEFAULT 1 AFTER pet_activity_level,
  ADD COLUMN IF NOT EXISTS pet_reduce_activity_in_log TINYINT(1) UNSIGNED NOT NULL DEFAULT 1 AFTER pet_idle_sleep_enabled,
  ADD COLUMN IF NOT EXISTS show_pet_in_profile TINYINT(1) UNSIGNED NOT NULL DEFAULT 0 AFTER pet_reduce_activity_in_log,
  ADD COLUMN IF NOT EXISTS show_pet_in_ranking TINYINT(1) UNSIGNED NOT NULL DEFAULT 0 AFTER show_pet_in_profile;`);
await sql(`ALTER TABLE web_preferences
  MODIFY COLUMN pet_companion_size SMALLINT UNSIGNED NOT NULL DEFAULT 72;`);
await sql(`CREATE TABLE IF NOT EXISTS web_character_grants (
  char_id INT UNSIGNED NOT NULL,
  grant_key VARCHAR(64) NOT NULL,
  granted_at BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (char_id,grant_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await sql(`CREATE TABLE IF NOT EXISTS web_voice_messages (
  voice_id CHAR(36) NOT NULL PRIMARY KEY,
  account_id INT UNSIGNED NOT NULL,
  char_id INT UNSIGNED NOT NULL,
  map_name VARCHAR(32) NOT NULL,
  mime_type VARCHAR(32) NOT NULL,
  file_ext VARCHAR(8) NOT NULL,
  byte_size INT UNSIGNED NOT NULL,
  duration_ms INT UNSIGNED NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  INDEX created_idx (created_at), INDEX account_idx (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
await mkdir(voiceRoot, { recursive: true });
await sql(`START TRANSACTION;
INSERT INTO inventory (char_id,nameid,amount,equip,identify)
SELECT c.char_id,7060,30,0,1
FROM \`char\` c
JOIN web_accounts w ON w.account_id=c.account_id
LEFT JOIN web_character_grants g ON g.char_id=c.char_id AND g.grant_key='renewal_novice_kafra_tickets'
WHERE c.char_num=0 AND g.char_id IS NULL;
INSERT IGNORE INTO web_character_grants (char_id,grant_key,granted_at)
SELECT c.char_id,'renewal_novice_kafra_tickets',${Date.now()}
FROM \`char\` c JOIN web_accounts w ON w.account_id=c.account_id
WHERE c.char_num=0;
COMMIT;`);
await sql(
  `UPDATE web_preferences SET music_volume=20,sound_volume=35 WHERE music_volume=40 AND sound_volume=70;`,
);

function cookie(request, name) {
  return (
    request.headers.cookie?.match(
      new RegExp(`(?:^|;\\s*)${name}=([^;]+)`),
    )?.[1] ?? ''
  );
}
function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}
async function webPasswordDigest(password, salt) {
  return Buffer.from(await scryptAsync(password, Buffer.from(salt, 'hex'), 64));
}
async function createWebPassword(accountId, password) {
  const salt = randomBytes(16).toString('hex'),
    digest = await webPasswordDigest(password, salt);
  await sql(
    `INSERT INTO web_accounts (account_id,password_salt,password_hash,migrated_at) VALUES (${Number(accountId)},'${salt}','${digest.toString('hex')}',${Date.now()}) ON DUPLICATE KEY UPDATE password_salt=VALUES(password_salt),password_hash=VALUES(password_hash),migrated_at=VALUES(migrated_at);`,
  );
}
function internalGamePassword() {
  return `Ro_${randomBytes(8).toString('hex')}`;
}
function clientAddress(request) {
  const peer = String(request.socket.remoteAddress ?? 'unknown');
  const forwarded = String(request.headers['cf-connecting-ip'] ?? '').trim();
  const fromLocalProxy =
    peer === '127.0.0.1' || peer === '::1' || peer === '::ffff:127.0.0.1';
  return fromLocalProxy && forwarded && request.headers['cf-ray']
    ? forwarded
    : peer;
}
function consumeRateLimit(store, key, windowMs, maximum, now = Date.now()) {
  const recent = (store.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= maximum) {
    store.set(key, recent);
    return false;
  }
  recent.push(now);
  store.set(key, recent);
  if (store.size > 10000) {
    for (const [storedKey, attempts] of store) {
      if (!attempts.some((time) => now - time < windowMs))
        store.delete(storedKey);
    }
  }
  return true;
}
function allowLogin(request, username) {
  const client = clientAddress(request);
  const now = Date.now();
  return (
    consumeRateLimit(loginClientAttempts, client, 300000, 40, now) &&
    consumeRateLimit(
      loginIdentityAttempts,
      String(username).toLowerCase(),
      300000,
      10,
      now,
    )
  );
}
function registrationClientHash(client) {
  return createHmac('sha256', secrets.databasePassword)
    .update(String(client))
    .digest('hex');
}
async function assertRegistrationAllowed(client) {
  const now = Date.now();
  const clientHash = registrationClientHash(client);
  const output = await sql(`START TRANSACTION;
SELECT touched_at INTO @registration_gate_lock
FROM web_rate_limit_locks
WHERE limit_name='registration'
FOR UPDATE;
DELETE FROM web_registration_events WHERE created_at<${now - 86400000};
INSERT INTO web_registration_events (client_hash,created_at)
SELECT '${clientHash}',${now}
WHERE
  (SELECT COUNT(*) FROM web_registration_events WHERE client_hash='${clientHash}' AND created_at>=${now - 3600000})<8
  AND
  (SELECT COUNT(*) FROM web_registration_events WHERE created_at>=${now - 600000})<30;
SET @registration_accepted=ROW_COUNT();
UPDATE web_rate_limit_locks SET touched_at=${now} WHERE limit_name='registration';
SELECT @registration_accepted,
  (SELECT COUNT(*) FROM web_registration_events WHERE client_hash='${clientHash}' AND created_at>=${now - 3600000}),
  (SELECT COUNT(*) FROM web_registration_events WHERE created_at>=${now - 600000});
COMMIT;`);
  const [accepted, clientCount] = output.split('\t').map(Number);
  if (accepted === 1) return;
  throw new HttpError(
    429,
    '新帳號建立過於頻繁，請稍後再試',
    clientCount >= 8 ? 3600 : 600,
  );
}
function instanceId(accountId) {
  return `player_${accountId}`;
}

function validWebViewerId(value) {
  return /^[a-zA-Z0-9_-]{8,64}$/.test(String(value ?? ''));
}

function webPresenceMarkerPath(accountId, mode) {
  const file =
    mode === 'high'
      ? 'web-presence-high.json'
      : mode === 'hidden'
        ? 'web-presence-hidden.json'
        : 'web-presence-low.json';
  return join(
    instancesRoot,
    instanceId(accountId),
    'commands',
    file,
  );
}

function observationInterestFromInput(interest, mode) {
  if (Object.values(ObservationInterest).includes(interest)) return interest;
  if (mode === 'high') return ObservationInterest.COMBAT_PAGE;
  if (mode === 'hidden') return ObservationInterest.HIDDEN;
  if (mode === 'low') return ObservationInterest.OTHER_GAME_PAGE;
  return null;
}

async function applyWebPresenceUpdate(account, viewerId, interest) {
  const now = Date.now();
  const accountId = Number(account.accountId),
    characterId = Number(account.characterId || account.accountId),
    demand = webViewerRegistry.update(characterId, viewerId, interest),
    mode = legacyObservationMode(demand.highestInterest),
    hasLease = demand.viewerCount > 0,
    marker = webPresenceMarkerState.get(characterId) ?? {
    active: false,
    mode: 'none',
    interest: ObservationInterest.NO_WEB,
    lastAttemptAt: 0,
    lastWriteAt: 0,
  };
  if (interest !== ObservationInterest.COMBAT_PAGE)
    combatSseBroker.disconnect(characterId, viewerId);
  if (hasLease) {
    if (
      !marker.active ||
      marker.interest !== demand.highestInterest ||
      now - marker.lastWriteAt >= webPresenceMarkerRefreshMs
    ) {
      if (now - marker.lastAttemptAt >= 1_000) {
        marker.lastAttemptAt = now;
        try {
          const path = webPresenceMarkerPath(accountId, mode);
          const observationPolicy =
            OBSERVATION_POLICY.interests[demand.highestInterest];
          await mkdir(dirname(path), { recursive: true });
          await writeJsonAtomic(path, {
            version: 2,
            mode,
            interest: demand.highestInterest,
            domains: demand.domains,
            statusExportMs: observationPolicy.statusExportMs,
            commandPollMs: observationPolicy.commandPollMs,
            expiresAt: now + webViewerLeaseMs,
          });
          await Promise.all(
            ['high', 'low', 'hidden']
              .filter((candidate) => candidate !== mode)
              .map((candidate) =>
                unlink(webPresenceMarkerPath(accountId, candidate)).catch(
                  () => {},
                ),
              ),
          );
          marker.active = true;
          marker.mode = mode;
          marker.interest = demand.highestInterest;
          marker.lastWriteAt = now;
          webPresenceMetrics.markerWrites += 1;
        } catch (error) {
          webPresenceMetrics.markerErrors += 1;
          console.error(
            `Unable to update Web presence for ${instanceId(accountId)}:`,
            error instanceof Error ? error.message : error,
          );
        }
      }
    }
  } else if (marker.active) {
    await Promise.all(
      ['high', 'low', 'hidden'].map((candidate) =>
        unlink(webPresenceMarkerPath(accountId, candidate)).catch(() => {}),
      ),
    );
    marker.active = false;
    marker.mode = 'none';
    marker.interest = ObservationInterest.NO_WEB;
    marker.lastWriteAt = 0;
    webPresenceMetrics.markerRemovals += 1;
  }
  if (hasLease) webPresenceMarkerState.set(characterId, marker);
  else webPresenceMarkerState.delete(characterId);
  return {
    active: demand.visibleViewerCount > 0,
    interest: demand.highestInterest,
    domains: demand.domains,
    viewerCount: demand.viewerCount,
    visibleViewerCount: demand.visibleViewerCount,
    mode,
    expiresInMs: hasLease ? webViewerLeaseMs : 0,
  };
}

async function updateWebPresence(account, viewerId, interest) {
  if (!validWebViewerId(viewerId))
    throw new HttpError(400, 'Web viewer 識別格式錯誤');
  if (!Object.values(ObservationInterest).includes(interest))
    throw new HttpError(400, 'Web viewer interest 格式錯誤');
  const key = Number(account.accountId);
  const previous = webPresenceUpdateLocks.get(key) ?? Promise.resolve();
  const task = previous
    .catch(() => {})
    .then(() => applyWebPresenceUpdate(account, viewerId, interest));
  webPresenceUpdateLocks.set(key, task);
  try {
    return await task;
  } finally {
    if (webPresenceUpdateLocks.get(key) === task)
      webPresenceUpdateLocks.delete(key);
  }
}

function webPresenceSummary() {
  const demands = webViewerRegistry.summary();
  return {
    leaseMs: webViewerLeaseMs,
    trackedCharacters: demands.length,
    visibleViewers: demands.reduce(
      (sum, demand) => sum + demand.visibleViewerCount,
      0,
    ),
    viewers: demands.reduce((sum, demand) => sum + demand.viewerCount, 0),
    interests: Object.fromEntries(
      Object.values(ObservationInterest).map((interest) => [
        interest,
        demands.filter((demand) => demand.highestInterest === interest).length,
      ]),
    ),
    ...webPresenceMetrics,
  };
}

const webPresenceCleanupTimer = setInterval(() => {
  for (const characterId of webViewerRegistry.cleanup())
    webPresenceMarkerState.delete(Number(characterId));
  characterProjectionCache.prune();
  const expiredStatResultBefore = Date.now() - statCommandResultCacheMs;
  for (const [key, cached] of statCommandResultCache)
    if (cached.at < expiredStatResultBefore) statCommandResultCache.delete(key);
}, webViewerLeaseMs);
webPresenceCleanupTimer.unref();
function json(response, status, body, headers = {}) {
  if (response.supportActionAudit) {
    response.supportActionErrorCode = body?.error ?? body?.code ?? null;
    response.supportActionAudit.commandId =
      body?.commandId ?? body?.command?.commandId ?? body?.result?.commandId ?? null;
  }
  const serializeStartedAt = performance.now();
  const payload = JSON.stringify(body);
  addWebLatencyDuration('serialize', performance.now() - serializeStartedAt);
  response.observationPayloadBytes = Buffer.byteLength(payload);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...securityHeaders,
    ...headers,
  });
  response.end(payload);
}

function requestOrigin(request) {
  const configured = String(process.env.RO_PUBLIC_ORIGIN ?? '').trim();
  if (configured) return configured.replace(/\/$/, '');
  const forwarded = String(request.headers['x-forwarded-proto'] ?? '')
    .split(',')[0]
    .trim();
  const protocol = forwarded === 'https' ? 'https' : 'http';
  return `${protocol}://${request.headers.host ?? 'localhost'}`;
}
function mutationOriginAllowed(request) {
  if (!mutationMethods.has(request.method ?? 'GET')) return true;
  const fetchSite = String(request.headers['sec-fetch-site'] ?? '');
  if (fetchSite && !['same-origin', 'none'].includes(fetchSite)) return false;
  const origin = String(request.headers.origin ?? '').replace(/\/$/, '');
  return !origin || origin === requestOrigin(request);
}
function loopbackRequest(request) {
  const address = String(request.socket.remoteAddress ?? '');
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1'
  );
}
function publicErrorMessage(error) {
  const message = error instanceof Error ? error.message : '';
  const allowed = [
    '帳號需為',
    '密碼需為',
    '帳號目前',
    '帳號或密碼錯誤',
    '此測試帳號',
    '角色名稱需為',
    '角色名稱已被使用',
    '無效的道具操作',
    '遊戲伺服器尚未同步此道具',
    '此道具無法使用',
    '此裝備目前',
    '此裝備尚未鑑定',
    '限定初心者／超級初心者使用',
    '無效的能力值',
    '找不到角色',
    '能力值已達',
    '能力點數不足',
    '角色資料仍在同步',
    '角色目前不在線上',
    '訊息內容不得為空白',
    '訊息最多 80 個字',
    '訊息包含不允許的控制字元',
    '一般頻道不接受指令字首',
    '訊息發送過快',
    '密語對象',
    '此頻道',
    '語音',
    '無效的表情',
    '無效的社交操作',
    '技能點數不足',
    '角色尚未習得此技能',
    '技能自動化類型不符',
    '技能需要',
    'Zeny 不足',
    '超級初心者需要 Base Lv.45',
    '基本技能目前無法提升',
    '角色已經是伊甸園成員',
    '請先完成一轉',
    '請先完成新生訓練',
    '角色連線逾時',
    '無效的掛機地圖',
    '此地圖沒有已查核的一般怪物資料',
    '角色狀態尚未同步',
    '角色狀態已更新',
    '角色識別已更新',
    'commandId 格式不符',
    'expectedRevision 格式不符',
    '任務執行中，暫時不能更換掛機地圖',
    'HP 低於 60%',
    '紅色藥水不足',
    '角色背包狀態無法確認',
    '新生訓練已結束',
    'not_available',
    'prerequisite_incomplete',
    'already_completed',
    'route_failed',
    'farm_route_unavailable',
    'npc_failed',
    'npc_no_progress',
    'target_unresolved',
    'inventory_full',
    'command_rejected',
    'nothing_to_stop',
    'ownership_conflict',
    'stale_revision',
    'already_owned',
    'invalid_transition',
    'active_client',
    'active_openkore',
    'agent_not_owner',
    'idempotency_conflict',
    'invalid_command_id',
    'ownership_not_found',
    'command_not_found',
    'rollout_disabled',
    'rollout_not_allowlisted',
    'rollout_schema_unavailable',
    'rollout_identity_invalid',
    'eden_course_a_disabled',
    'emergency_disabled',
    '登入嘗試過多',
    '新帳號建立過於頻繁',
    '帳號服務忙碌',
    '請求內容過大',
    'JSON 格式錯誤',
  ];
  return allowed.some((prefix) => message.startsWith(prefix))
    ? message
    : '伺服器操作失敗';
}
function requestBody(request, maximum = 8192) {
  return new Promise((resolve, reject) => {
    const declared = Number(request.headers['content-length'] ?? 0);
    if (declared > maximum) {
      reject(new HttpError(413, '請求內容過大'));
      request.resume();
      return;
    }
    const chunks = [];
    let total = 0;
    let settled = false;
    request.on('data', (chunk) => {
      if (settled) return;
      total += chunk.length;
      if (total > maximum) {
        settled = true;
        reject(new HttpError(413, '請求內容過大'));
        request.pause();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (settled) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new HttpError(400, 'JSON 格式錯誤'));
      }
    });
    request.on('error', reject);
  });
}

function requestBinary(request, maxBytes) {
  return new Promise((resolve, reject) => {
    const declared = Number(request.headers['content-length'] ?? 0);
    if (declared > maxBytes) {
      reject(new Error('語音檔案超過 1 MB'));
      request.resume();
      return;
    }
    const chunks = [];
    let total = 0;
    request.on('data', (chunk) => {
      total += chunk.length;
      if (total <= maxBytes) chunks.push(chunk);
    });
    request.on('end', () => {
      if (total > maxBytes) reject(new Error('語音檔案超過 1 MB'));
      else resolve(Buffer.concat(chunks));
    });
    request.on('error', reject);
  });
}

// Minimal low-frequency Web-presence heartbeat (throttled to 30s/account).
// Reuses the existing web_account_activity table so Ops can show a real
// "Web 在線 / Web 離線 · N 前" instead of treating an unexpired session as online.
const webActivityWriteAt = new Map();
function noteWebActivity(accountId) {
  const key = Number(accountId);
  if (!Number.isFinite(key) || key <= 0) return;
  const now = Date.now();
  if ((webActivityWriteAt.get(key) ?? 0) > now - 30_000) return;
  webActivityWriteAt.set(key, now);
  sql(
    `UPDATE web_account_activity SET last_web_activity_at=${now},updated_at=${now},last_presence_state='ONLINE',presence_updated_at=${now} WHERE account_id=${key};`,
  ).catch(() => {});
}

const supportUsedAt = new Map();

async function recordSupportSessionEvent(event) {
  const safe = redactSupportAuditEvent(event);
  if (!safe.supportSessionId || !safe.actorAdminId || !safe.effectiveAccountId || !safe.effectiveCharId) return;
  await sql(`INSERT INTO web_support_session_events
    (event_type,support_session_id,actor_admin_id,effective_account_id,effective_char_id,reason,support_mode,created_from,trace_id,occurred_at)
    VALUES ('${escapeSql(safe.eventType)}','${escapeSql(safe.supportSessionId)}','${escapeSql(safe.actorAdminId)}',${safe.effectiveAccountId},${safe.effectiveCharId},'${escapeSql(safe.reason)}','${escapeSql(safe.mode)}','${escapeSql(safe.createdFrom)}',${safe.traceId ? `'${escapeSql(safe.traceId)}'` : 'NULL'},${safe.occurredAt});`, 'sync_monitoring_write');
}

async function recordSupportActionEvent(event) {
  const safe = redactSupportActionAudit(event);
  if (!safe.supportSessionId || !safe.actorAdminId || !safe.effectiveAccountId || !safe.effectiveCharId) return;
  await sql(`INSERT INTO web_support_session_action_events
    (support_session_id,actor_admin_id,effective_account_id,effective_char_id,action_key,resource,command_id,result,error_code,trace_id,occurred_at)
    VALUES ('${escapeSql(safe.supportSessionId)}','${escapeSql(safe.actorAdminId)}',${safe.effectiveAccountId},${safe.effectiveCharId},'${escapeSql(safe.actionKey)}','${escapeSql(safe.resource)}',${safe.commandId ? `'${escapeSql(safe.commandId)}'` : 'NULL'},'${escapeSql(safe.result)}',${safe.errorCode ? `'${escapeSql(safe.errorCode)}'` : 'NULL'},${safe.traceId ? `'${escapeSql(safe.traceId)}'` : 'NULL'},${safe.occurredAt});`);
}

function supportActionAuditForResponse(response, request, context, decision) {
  if (!context?.supportSessionId || !decision || decision.actionKey === 'read') return;
  response.supportActionAudit = {
    supportSessionId: context.supportSessionId,
    actorAdminId: context.actorAdminId,
    effectiveAccountId: context.accountId,
    effectiveCharId: context.characterId,
    actionKey: decision.actionKey,
    resource: decision.resource,
    traceId: request.headers['x-scenario-trace-id'] ?? null,
    commandId: null,
  };
  response.once('finish', () => {
    const audit = response.supportActionAudit;
    recordSupportActionEvent({
      ...audit,
      result: response.statusCode >= 200 && response.statusCode < 300 ? 'PASS' : 'FAIL',
      errorCode: response.supportActionErrorCode ?? (response.statusCode >= 400 ? `HTTP_${response.statusCode}` : null),
      occurredAt: Date.now(),
    }).catch(() => {});
  });
}

async function recordSupportUsed(context, request) {
  const now = Date.now();
  const key = String(context?.supportSessionId ?? '');
  if (!key || (supportUsedAt.get(key) ?? 0) > now - 30_000) return;
  supportUsedAt.set(key, now);
  await recordSupportSessionEvent({
    eventType: 'SUPPORT_SESSION_USED',
    supportSessionId: key,
    actorAdminId: context.actorAdminId,
    effectiveAccountId: context.accountId,
    effectiveCharId: context.characterId,
    reason: context.reason,
    mode: context.mode,
    createdFrom: context.createdFrom,
    traceId: request.headers['x-scenario-trace-id'] ?? null,
    occurredAt: now,
  }).catch(() => {});
}

function adminActorFromRequest(request) {
  if (isAdminSurfaceHost(request)) return 'CLOUDFLARE_ACCESS_EDGE';
  if (!loopbackRequest(request)) return null;
  const localActor = normalizeSupportActor(process.env.RO_LOCAL_ADMIN_ACTOR_ID);
  const localToken = String(process.env.RO_LOCAL_ADMIN_TOKEN ?? '');
  const supplied = String(request.headers['x-ro-local-admin-token'] ?? '');
  if (loopbackRequest(request) && localActor && localToken && supplied && supplied === localToken)
    return localActor;
  return null;
}

async function supportSessionFromRequest(request) {
  const token = cookie(request, 'ro_session');
  if (!token) return null;
  const hash = tokenHash(token);
  const now = Date.now();
  const output = await sql(`SELECT s.support_session_id,s.actor_admin_id,s.account_id,s.effective_char_id,
    s.support_reason,s.support_mode,s.created_from,s.created_at,s.expires_at,s.support_revoked_at
    FROM web_sessions s WHERE s.token_hash='${hash}' AND s.support_session_id IS NOT NULL LIMIT 1;`, 'support_session_lookup');
  if (!output) return null;
  const row = output.split('\t');
  const context = {
    supportSessionId: row[0], actorAdminId: row[1], accountId: Number(row[2]),
    characterId: Number(row[3]), reason: row[4] ?? '', mode: row[5] ?? SUPPORT_SESSION_MODE.OBSERVE_ONLY,
    createdFrom: row[6] ?? SUPPORT_SESSION_CREATED_FROM, createdAt: Number(row[7]),
    expiresAt: Number(row[8]), revokedAt: row[9] && row[9] !== 'NULL' ? Number(row[9]) : null,
  };
  if (context.revokedAt) return null;
  if (context.expiresAt <= now) {
    await sql(`UPDATE web_sessions SET support_revoked_at=${now} WHERE token_hash='${hash}' AND support_revoked_at IS NULL;`).catch(() => {});
    await recordSupportSessionEvent({
      ...context,
      effectiveAccountId: context.accountId,
      effectiveCharId: context.characterId,
      eventType: 'SUPPORT_SESSION_EXPIRED',
      occurredAt: now,
    }).catch(() => {});
    return null;
  }
  return context;
}

async function assertSupportSessionDispatchActive(request, context) {
  if (!context?.supportSessionId) return;
  const current = await supportSessionFromRequest(request);
  if (!current || current.supportSessionId !== context.supportSessionId)
    throw new HttpError(403, 'support_session_revoked');
}

function supportContextFromAccount(account) {
  if (!account?.supportSessionId) return null;
  return {
    supportSessionId: account.supportSessionId,
    actorAdminId: account.actorAdminId,
    accountId: account.accountId,
    characterId: account.characterId,
    reason: account.supportReason,
    mode: account.supportMode,
    createdFrom: account.supportCreatedFrom,
    createdAt: account.supportCreatedAt,
    expiresAt: account.supportExpiresAt,
  };
}

async function sessionAccount(request) {
  const token = cookie(request, 'ro_session');
  if (!token) return null;
  const now = Date.now(),
    hash = tokenHash(token),
    cached = sessionCache.get(hash);
  if (cached && cached.expiresAt > now) {
    if (cached.account?.supportSessionId)
      await recordSupportUsed(supportContextFromAccount(cached.account), request);
    return cached.account;
  }
  const output =
    await sql(`SELECT l.account_id,l.userid,l.sex,c.char_id,c.name,c.char_num,c.hair,c.hair_color,s.expires_at,j.value,c.class,c.base_level,c.job_level,
    s.support_session_id,s.actor_admin_id,s.effective_char_id,s.support_reason,s.support_mode,s.created_from,s.created_at,s.support_revoked_at
    FROM web_sessions s JOIN login l ON l.account_id=s.account_id
    LEFT JOIN \`char\` c ON c.account_id=l.account_id AND ((s.support_session_id IS NOT NULL AND c.char_id=s.effective_char_id) OR (s.support_session_id IS NULL AND c.char_num=0))
    LEFT JOIN char_reg_str j ON j.char_id=c.char_id AND j.\`key\`='terminal_target_job$' AND j.\`index\`=0
    WHERE s.token_hash='${hash}' LIMIT 1;`);
  if (!output) return null;
  const row = output.split('\t');
  const expiresAt = Number(row[8]);
  const supportSessionId = row[13] && row[13] !== 'NULL' ? row[13] : null;
  const supportRevokedAt = row[20] && row[20] !== 'NULL' ? Number(row[20]) : null;
  if (supportRevokedAt || expiresAt <= now) {
    if (supportSessionId && !supportRevokedAt && expiresAt <= now) {
      const expired = {
        supportSessionId,
        actorAdminId: row[14],
        accountId: Number(row[0]),
        characterId: Number(row[15]),
        reason: row[16] ?? '',
        mode: row[17] ?? SUPPORT_SESSION_MODE.OBSERVE_ONLY,
        createdFrom: row[18] ?? SUPPORT_SESSION_CREATED_FROM,
        createdAt: Number(row[19]),
        expiresAt,
      };
      await sql(`UPDATE web_sessions SET support_revoked_at=${now} WHERE token_hash='${hash}' AND support_revoked_at IS NULL;`).catch(() => {});
      await recordSupportSessionEvent({ ...expired, effectiveAccountId: expired.accountId, effectiveCharId: expired.characterId, eventType: 'SUPPORT_SESSION_EXPIRED', occurredAt: now }).catch(() => {});
    }
    sessionCache.delete(hash);
    return null;
  }
  const account = {
    accountId: Number(row[0]),
    username: row[1],
    sex: row[2],
    characterId: row[3] && row[3] !== 'NULL' ? Number(row[3]) : null,
    characterName: row[4] && row[4] !== 'NULL' ? row[4] : null,
    characterSlot: Number(row[5] ?? 0),
    hair: Number(row[6] ?? 0),
    hairColor: Number(row[7] ?? 0),
    targetJob: row[9] && row[9] !== 'NULL' ? row[9] : null,
    classId: Number(row[10] ?? 0),
    baseLevel: Number(row[11] ?? 1),
    jobLevel: Number(row[12] ?? 1),
  };
  if (supportSessionId) {
    account.supportSessionId = supportSessionId;
    account.actorAdminId = row[14];
    account.characterId = Number(row[15]);
    account.supportReason = row[16] ?? '';
    account.supportMode = row[17] ?? SUPPORT_SESSION_MODE.OBSERVE_ONLY;
    account.supportCreatedFrom = row[18] ?? SUPPORT_SESSION_CREATED_FROM;
    account.supportCreatedAt = Number(row[19]);
    account.supportExpiresAt = expiresAt;
  }
  sessionCache.set(hash, { account, expiresAt });
  if (account.supportSessionId) await recordSupportUsed(supportContextFromAccount(account), request);
  else noteWebActivity(account.accountId);
  return account;
}

// C6: Server Ops / Observatory authorization is owned by the OUTER security
// boundary (reverse proxy / admin-only routing / local control boundary). This
// backend deliberately performs NO second account-level authorization layer.
// `web_account_roles` (migration 010) is UNUSED / NON-AUTHORITATIVE at runtime;
// schema cleanup, if any, is a separate migration.

async function loginOrRegister(username, password, sex, registrationClient) {
  if (!accountPattern.test(username))
    throw new Error('帳號需為 4 至 23 個英文字母、數字或底線');
  if (!passwordPattern.test(password))
    throw new Error('密碼需為 8 至 32 個英數字或常用符號');
  const safeUser = escapeSql(username),
    safeSex = sex === 'F' ? 'F' : 'M';
  let output = await sql(
    `SELECT l.account_id,l.user_pass,l.sex,l.state,w.password_salt,w.password_hash FROM login l LEFT JOIN web_accounts w ON w.account_id=l.account_id WHERE l.userid='${safeUser}' LIMIT 2;`,
  );
  let registered = false;
  if (!output) {
    await assertRegistrationAllowed(registrationClient);
    const gamePassword = internalGamePassword();
    await sql(
      `INSERT INTO login (userid,user_pass,sex,email,character_slots) VALUES ('${safeUser}','${gamePassword}','${safeSex}','${safeUser}@local.invalid',1);`,
    );
    output = await sql(
      `SELECT l.account_id,l.user_pass,l.sex,l.state,w.password_salt,w.password_hash FROM login l LEFT JOIN web_accounts w ON w.account_id=l.account_id WHERE l.userid='${safeUser}' ORDER BY l.account_id DESC LIMIT 1;`,
    );
    await createWebPassword(Number(output.split('\t')[0]), password);
    registered = true;
  }
  const row = output.split('\t');
  await sql(
    `INSERT IGNORE INTO web_account_flags (account_id,is_test,updated_at) VALUES (${Number(row[0])},${automatedTestAccountPattern.test(username) ? 1 : 0},${Date.now()});`,
  );
  if (Number(row[3] ?? 0) !== 0) throw new Error('帳號目前無法登入');
  if (registered) {
    // The password was accepted while the account was created above.
  } else if (row[4] && row[4] !== 'NULL' && row[5] && row[5] !== 'NULL') {
    const stored = Buffer.from(row[5], 'hex'),
      supplied = await webPasswordDigest(password, row[4]);
    if (stored.length !== supplied.length || !timingSafeEqual(stored, supplied))
      throw new Error('帳號或密碼錯誤');
  } else {
    const stored = Buffer.from(row[1] ?? ''),
      supplied = Buffer.from(password);
    if (stored.length !== supplied.length || !timingSafeEqual(stored, supplied))
      throw new Error('帳號或密碼錯誤');
    const gamePassword = internalGamePassword();
    await createWebPassword(Number(row[0]), password);
    await sql(
      `UPDATE login SET user_pass='${gamePassword}' WHERE account_id=${Number(row[0])};`,
    );
  }
  const token = randomBytes(32).toString('hex'),
    now = Date.now(),
    expires = now + 7 * 86400000;
  await sql(
    `DELETE FROM web_sessions WHERE expires_at<=${now}; INSERT INTO web_sessions (token_hash,account_id,created_at,expires_at) VALUES ('${tokenHash(token)}',${Number(row[0])},${now},${expires}); INSERT INTO web_account_activity (account_id,last_web_login_at,updated_at) VALUES (${Number(row[0])},${now},${now}) ON DUPLICATE KEY UPDATE last_web_login_at=VALUES(last_web_login_at),updated_at=VALUES(updated_at);`,
  );
  return {
    account: { accountId: Number(row[0]), username, sex: row[2] },
    token,
    registered,
  };
}
async function serializedLoginOrRegister(
  username,
  password,
  sex,
  registrationClient,
) {
  if (pendingAccountRequests >= 12)
    throw new HttpError(429, '帳號服務忙碌，請稍後再試', 10);
  pendingAccountRequests += 1;
  const task = accountQueue.then(() =>
    loginOrRegister(username, password, sex, registrationClient),
  );
  accountQueue = task.catch(() => {});
  try {
    return await task;
  } finally {
    pendingAccountRequests -= 1;
  }
}

async function createCharacter(account, name, hair, hairColor, sex, targetJob) {
  if (account.characterId) throw new Error('此帳號已有角色');
  if (!characterPattern.test(name))
    throw new Error('角色名稱需為 2 至 24 個中英文、數字或底線');
  if (!allowedFirstJobs.has(targetJob)) throw new Error('請選擇一轉志願職業');
  const exists = await sql(
    `SELECT char_id FROM \`char\` WHERE name='${escapeSql(name)}' LIMIT 1;`,
  );
  if (exists) throw new Error('角色名稱已被使用');
  const safeSex = sex === 'F' ? 'F' : 'M';
  const start = renewalStartPoints[randomInt(renewalStartPoints.length)];
  await sql(`UPDATE login SET sex='${safeSex}' WHERE account_id=${account.accountId};
    INSERT INTO \`char\` (account_id,char_num,name,class,base_level,job_level,str,agi,vit,\`int\`,dex,luk,max_hp,hp,max_sp,sp,status_point,skill_point,hair,hair_color,last_map,last_x,last_y,save_map,save_x,save_y,sex)
    VALUES (${account.accountId},0,'${escapeSql(name)}',0,1,1,1,1,1,1,1,1,40,40,11,11,0,0,${Math.max(1, Math.min(42, Number(hair) || 1))},${Math.max(0, Math.min(8, Number(hairColor) || 0))},'${start.map}',${start.x},${start.y},'${start.map}',${start.x},${start.y},'${safeSex}');`);
  await sql(`INSERT INTO inventory (char_id,nameid,amount,equip,identify)
    SELECT char_id,1201,1,2,1 FROM \`char\` WHERE account_id=${account.accountId} AND char_num=0;
    INSERT INTO inventory (char_id,nameid,amount,equip,identify)
    SELECT char_id,2301,1,16,1 FROM \`char\` WHERE account_id=${account.accountId} AND char_num=0;
    INSERT INTO inventory (char_id,nameid,amount,equip,identify)
    SELECT char_id,23484,1,0,1 FROM \`char\` WHERE account_id=${account.accountId} AND char_num=0;
    INSERT INTO inventory (char_id,nameid,amount,equip,identify)
    SELECT char_id,7060,30,0,1 FROM \`char\` WHERE account_id=${account.accountId} AND char_num=0;
    INSERT IGNORE INTO web_character_grants (char_id,grant_key,granted_at)
    SELECT char_id,'renewal_novice_kafra_tickets',${Date.now()} FROM \`char\` WHERE account_id=${account.accountId} AND char_num=0;
    INSERT INTO char_reg_str (char_id,\`key\`,\`index\`,value)
    SELECT char_id,'terminal_target_job$',0,'${escapeSql(targetJob)}' FROM \`char\` WHERE account_id=${account.accountId} AND char_num=0
    ON DUPLICATE KEY UPDATE value=VALUES(value);`);
  return true;
}

// Fresh-Web-character SERVER_AGENT bootstrap. The canonical `claim_agent`
// command owns the ownership transition; this only initializes the canonical
// persistent_agent_state record (default OPENKORE/INACTIVE) when it is absent
// and enrolls the identity in the canonical rollout allowlist. No OpenKore
// worker is required and no ownership field is written directly.
async function bootstrapServerAgentOwnership(account, charId) {
  const id = Number(charId);
  const aid = Number(account.accountId);
  const existing = await readAgentStateRow(id);
  if (!existing) {
    await sql(
      `INSERT IGNORE INTO persistent_agent_state (char_id,account_id,agent_enabled,control_owner,ownership_state,agent_mode,revision,state_version,runtime_state) VALUES (${id},${aid},0,'OPENKORE','OPENKORE','PERSISTENT_IDLE',0,2,'INACTIVE');`,
    );
  }
  await sql(
    `INSERT INTO persistent_agent_rollout_allowlist (account_id,char_id,course_key,enabled) VALUES (${aid},${id},'eden_course_a_v1',1) ON DUPLICATE KEY UPDATE enabled=1;`,
  );
  const row = await readAgentStateRow(id);
  const command = await queueOwnershipCommand(account, id, {
    action: 'claim_agent',
    expectedRevision: Number(row?.revision ?? 0),
  });
  return { commandId: command.commandId };
}

async function accountCredentials(accountId) {
  const output = await sql(
    `SELECT userid,user_pass FROM login WHERE account_id=${Number(accountId)} LIMIT 1;`,
  );
  const row = output.split('\t');
  return { username: row[0], password: row[1] };
}

const relevantLogPattern =
  /Map Change|You attack|You use|attacks you|attacking Monster|gained|You are now (?:job )?level|Item Appeared|added to inventory|died|respawn|random route|Moving to|Auto-(?:storaging|selling|buying|storage|sell|buy)|Storage opened|Storage closed|Sold:|Bought:|storage/;
const logProjectionCache = new Map();
const logProjectionPromises = new Map();
const logProjectionSessionCache = new Map();
const logProjectionMetrics = {
  bytesRead: 0,
  fullScans: 0,
  incrementalReads: 0,
};

async function currentWorkerState(id) {
  const folder = join(instancesRoot, id);
  let state;
  try {
    state = JSON.parse(await readFile(join(folder, 'state.json'), 'utf8'));
  } catch {
    return { running: false, startedAt: null, pid: null, stdout: null };
  }
  const pid = Number(state.pid);
  let running = false;
  if (Number.isSafeInteger(pid) && pid > 0) {
    try {
      process.kill(pid, 0);
      running = true;
    } catch {}
  }
  const stdout = String(state.stdout ?? '');
  const normalizedStdout = normalize(stdout);
  const stdoutRelative = relative(folder, normalizedStdout);
  const safeStdout = stdout && !stdoutRelative.startsWith('..') && !isAbsolute(stdoutRelative)
    ? normalizedStdout
    : null;
  return {
    running,
    startedAt: Number(state.startedAt) || null,
    pid: Number.isSafeInteger(pid) && pid > 0 ? pid : null,
    stdout: safeStdout,
  };
}

async function latestWorkerLog(id, worker) {
  if (worker.stdout) {
    const info = await stat(worker.stdout).catch(() => null);
    if (info?.isFile()) return { path: worker.stdout, info };
  }
  const cached = logProjectionCache.get(id);
  if (cached?.path) {
    const info = await stat(cached.path).catch(() => null);
    if (info?.isFile()) return { path: cached.path, info };
  }
  const logs = join(instancesRoot, id, 'logs');
  const files = (await readdir(logs).catch(() => [])).filter((name) =>
    name.endsWith('.out.log'),
  );
  const ranked = await Promise.all(
    files.map(async (name) => ({
      path: join(logs, name),
      info: await stat(join(logs, name)),
    })),
  );
  ranked.sort((a, b) => b.info.mtimeMs - a.info.mtimeMs);
  return ranked[0] ?? null;
}

function newLogProjection(path) {
  return {
    path,
    offset: 0,
    cursor: 0,
    lines: [],
    loot: new Map(),
    visitedTargetMap: false,
    kills: 0,
    deaths: 0,
    baseExpGained: 0,
    jobExpGained: 0,
    liveBase: 0,
    liveJob: 0,
  };
}

function ingestRelevantLogLine(projection, rawLine) {
  const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
  if (!relevantLogPattern.test(line)) return;
  projection.cursor += 1;
  projection.lines.push(line);
  if (projection.lines.length > logProjectionLineLimit)
    projection.lines.splice(
      0,
      projection.lines.length - logProjectionLineLimit,
    );
  const item = line.match(/Item added to inventory: (.+?) \(\d+\) x (\d+)/);
  if (item)
    projection.loot.set(
      item[1],
      (projection.loot.get(item[1]) ?? 0) + Number(item[2]),
    );
  const exp = line.match(/You have gained (\d+)\/(\d+)/);
  if (exp) {
    projection.baseExpGained += Number(exp[1]);
    projection.jobExpGained += Number(exp[2]);
    if (exp[1] !== '0' || exp[2] !== '0') projection.kills += 1;
  }
  if (line.includes('Map Change: prt_fild08'))
    projection.visitedTargetMap = true;
  if (line.includes('You have died')) projection.deaths += 1;
  const baseLevel = line.match(/You are now level (\d+)/);
  if (baseLevel) projection.liveBase = Number(baseLevel[1]);
  const jobLevel = line.match(/You are now job level (\d+)/);
  if (jobLevel) projection.liveJob = Number(jobLevel[1]);
}

async function refreshLogProjectionOnce(id) {
  const worker = await currentWorkerState(id);
  const selected = await latestWorkerLog(id, worker);
  if (!selected)
    return { ...worker, projection: newLogProjection(null) };
  let projection = logProjectionCache.get(id);
  const reset = !projection || projection.path !== selected.path || selected.info.size < projection.offset;
  if (reset) {
    projection = newLogProjection(selected.path);
    logProjectionCache.set(id, projection);
    if (selected.info.size > 0) logProjectionMetrics.fullScans += 1;
  } else if (selected.info.size > projection.offset) {
    logProjectionMetrics.incrementalReads += 1;
  }
  if (selected.info.size > projection.offset) {
    const handle = await openFile(selected.path, 'r');
    try {
      const chunk = Buffer.allocUnsafe(1024 * 1024);
      while (projection.offset < selected.info.size) {
        const length = Math.min(chunk.length, selected.info.size - projection.offset);
        const { bytesRead } = await handle.read(
          chunk,
          0,
          length,
          projection.offset,
        );
        if (!bytesRead) break;
        const lastNewline = chunk.lastIndexOf(10, bytesRead - 1);
        if (lastNewline < 0) break;
        const consumed = lastNewline + 1;
        logProjectionMetrics.bytesRead += consumed;
        const text = chunk.subarray(0, consumed).toString('utf8');
        for (const line of text.split('\n'))
          if (line) ingestRelevantLogLine(projection, line);
        projection.offset += consumed;
      }
    } finally {
      await handle.close();
    }
  }
  return { ...worker, projection };
}

async function refreshLogProjection(id) {
  return await withWebLatencyStage('bridge', async () => {
  const cachedSession = logProjectionSessionCache.get(id);
  if (
    cachedSession &&
    Date.now() - cachedSession.at < OBSERVATION_POLICY.requestCoalescingMs
  )
    return cachedSession.value;
  const pending = logProjectionPromises.get(id);
  if (pending) return await pending;
  const task = refreshLogProjectionOnce(id);
  logProjectionPromises.set(id, task);
  try {
    const value = await task;
    logProjectionSessionCache.set(id, { at: Date.now(), value });
    return value;
  } finally {
    if (logProjectionPromises.get(id) === task)
      logProjectionPromises.delete(id);
  }
  });
}

function logProjectionSummary(projection) {
  return {
    lines: projection.lines.slice(-logProjectionInitialLines),
    visitedTargetMap: projection.visitedTargetMap,
    kills: projection.kills,
    items: [...projection.loot.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount),
    deaths: projection.deaths,
    baseExpGained: projection.baseExpGained,
    jobExpGained: projection.jobExpGained,
  };
}
async function currentStatusSnapshot(id, maximumAgeMs = 5_000) {
  // P2-OPENKORE-EXIT-MAINLINE (row 38): OpenKore status.json is not an authority
  // in production. Only authorized isolated/closed-test diagnostics may read it;
  // production resolves SERVER_AGENT state through the Persistent Agent read model.
  if (runtimeMode !== 'isolated-test') return null;
  return await withWebLatencyStage('bridge', async () => {
  const now = Date.now(),
    priorRead = statusSnapshotReadState.get(id),
    cached = statusSnapshotCache.get(id);
  if (
    cached &&
    priorRead &&
    now - priorRead.at < OBSERVATION_POLICY.requestCoalescingMs
  )
    return now - Number(cached.updatedAt) < maximumAgeMs ? cached : null;
  if (priorRead?.pending) {
    const snapshot = await priorRead.pending;
    return snapshot && Date.now() - Number(snapshot.updatedAt) < maximumAgeMs
      ? snapshot
      : null;
  }
  const path = join(instancesRoot, id, 'status.json');
  const pending = (async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const snapshot = JSON.parse(await readFile(path, 'utf8'));
        statusSnapshotCache.set(id, snapshot);
        return snapshot;
      } catch {
        if (attempt < 2)
          await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }
    const fallback = statusSnapshotCache.get(id);
    return fallback ?? null;
  })();
  statusSnapshotReadState.set(id, { at: priorRead?.at ?? 0, pending });
  try {
    const snapshot = await pending;
    return snapshot && Date.now() - Number(snapshot.updatedAt) < maximumAgeMs
      ? snapshot
      : null;
  } finally {
    if (statusSnapshotReadState.get(id)?.pending === pending)
      statusSnapshotReadState.set(id, { at: Date.now(), pending: null });
  }
  });
}

async function queryMapPlayerCount(mapName) {
  const map = String(mapName ?? '').trim();
  if (!map) return 0;
  const now = Date.now();
  const cached = mapPlayerCountCache.get(map);
  if (cached && now - cached.at < 1000) return cached.value;
  if (cached?.pending) return await cached.pending;
  const pending = sql(
    `SELECT COUNT(*) FROM \`char\` WHERE online=1 AND last_map='${escapeSql(map)}';`,
  )
    .then((output) => Number(output || 0))
    .then((value) => {
      mapPlayerCountCache.set(map, { at: Date.now(), value, pending: null });
      return value;
    })
    .catch(() => {
      const value = mapPlayerCountCache.get(map)?.value ?? 0;
      mapPlayerCountCache.set(map, { at: Date.now(), value, pending: null });
      return value;
    });
  mapPlayerCountCache.set(map, {
    at: cached?.at ?? 0,
    value: cached?.value ?? 0,
    pending,
  });
  return await pending;
}

async function withMapPlayerCount(live) {
  if (!live || !Object.hasOwn(live, 'map')) return live;
  return { ...live, mapPlayerCount: await queryMapPlayerCount(live.map) };
}

// A SERVER_AGENT-owned character has no OpenKore worker text log, and the
// combat SSE frame loader (loadCombatSseFrame) reads only that text-log
// projection. The native Event Ledger is delivered through /api/events
// polling, so reporting SSE as ineligible for SERVER_AGENT characters keeps
// the browser on the last-good native combat-log path instead of an empty
// SSE stream. Non-SERVER_AGENT characters keep the rollout decision.
async function combatSseStateForAccount(account, snapshot) {
  const base = await combatSseRollout.state(account?.characterId);
  const characterId = Number(account?.characterId);
  const serverAgentControlled =
    snapshot?.serverAgentReadModel === true ||
    (Number.isSafeInteger(characterId) &&
      characterId > 0 &&
      (await characterIsServerAgentControlled(characterId)));
  return gateCombatSseForServerAgent(base, serverAgentControlled);
}

async function combatStreamState(account, session, snapshot) {
  const rollout = await combatSseStateForAccount(account, snapshot);
  return {
    ...rollout,
    endpoint: '/api/combat-stream',
    cursor: Number(session?.projection?.cursor ?? 0),
    combatRevision: Number(snapshot?.domainRevisions?.combat ?? 0),
    heartbeatMs: combatSseBroker.heartbeatMs,
    resumeWindowMs: combatSseBroker.resumeWindowMs,
  };
}

async function loadCombatSseFrame({
  characterId,
  instanceId: id,
  cursor,
  combatRevision,
}) {
  const [session, rawLive] = await Promise.all([
      refreshLogProjection(id),
      currentStatusSnapshot(
        id,
        OBSERVATION_POLICY.interests.NO_WEB.statusExportMs + 5_000,
      ),
    ]),
    lines = session.projection.lines,
    oldestCursor = session.projection.cursor - lines.length,
    valid =
      Number.isInteger(cursor) &&
      cursor >= oldestCursor &&
      cursor <= session.projection.cursor &&
      session.projection.cursor - cursor <= logProjectionMaximumDelta;
  if (!valid)
    return {
      reset: true,
      reason: 'event_gap',
      cursor: session.projection.cursor,
    };
  const start = cursor - oldestCursor,
    deltaLines = lines.slice(start),
    nextCombatRevision = Number(rawLive?.domainRevisions?.combat ?? 0),
    liveRevision = revisionKeyForInterest(
      rawLive,
      ObservationInterest.COMBAT_PAGE,
    ),
    live = withLiveFreshness(
      await tracedCharacterProjection(
        {
          characterId,
          domain: 'live',
          revision: liveRevision,
          variant: ObservationInterest.COMBAT_PAGE,
          ttlMs: OBSERVATION_POLICY.projectionCacheMs,
        },
        async () =>
          await withMapPlayerCount(
            projectLiveSnapshot(rawLive, ObservationInterest.COMBAT_PAGE),
          ),
      ),
      rawLive,
    );
  return {
    reset: false,
    cursor: session.projection.cursor,
    combatRevision: nextCombatRevision,
    fromCombatRevision: Number(combatRevision ?? 0),
    timestamp: Date.now(),
    lines: coalesceCombatEventLines(deltaLines),
    combatDelta: coalesceCombatEvents(deltaLines),
    live,
  };
}

// C3-OPS-CONTROL-PLANE: character metadata (origin/role) read path. A missing
// row is UNKNOWN/UNKNOWN. This never inserts and never infers from AID, CID,
// name, SERVER_AGENT allowlist or residency. Metadata freshness is NOT live
// status freshness; liveStateAgeMs comes from persistent_agent_live_status.
const characterMetaFallback = Object.freeze({
  characterOrigin: 'UNKNOWN',
  characterRole: 'UNKNOWN',
});
async function readCharacterMeta(charId) {
  const id = Number(charId);
  if (!Number.isFinite(id) || id <= 0) return { ...characterMetaFallback };
  try {
    const out = await sql(
      `SELECT character_origin,character_role FROM character_meta WHERE char_id=${id} LIMIT 1;`,
    );
    if (!out) return { ...characterMetaFallback };
    const row = String(out).split('\t');
    return {
      characterOrigin: row[0] && row[0] !== 'NULL' ? row[0] : 'UNKNOWN',
      characterRole: row[1] && row[1] !== 'NULL' ? row[1] : 'UNKNOWN',
    };
  } catch {
    return { ...characterMetaFallback };
  }
}

const CHARACTER_ORIGINS = new Set(['PLAYER', 'ADMIN', 'SYSTEM', 'UNKNOWN']);
const CHARACTER_ROLES = new Set(['PRODUCTION', 'CANARY', 'TEST', 'UNKNOWN']);

// ADMIN-only mutation of character_meta. Validated enums only (no free-text
// interpolation). Writes character_meta + character_meta_audit in one MariaDB
// session (START TRANSACTION … COMMIT). Never touches the rAthena char table.
// Operator identity is owned by the outer security boundary, which does not
// pass an app-level operator id. A fixed sentinel is recorded until the columns
// are widened (separate migration) to hold a human-readable operator source.
const SERVER_OPS_OPERATOR_ID = 0;
async function setCharacterMeta(charId, input) {
  const id = Number(charId);
  if (!Number.isFinite(id) || id <= 0) throw new HttpError(400, 'char_id 不合法');
  const origin = input?.characterOrigin;
  const role = input?.characterRole;
  if (origin !== undefined && !CHARACTER_ORIGINS.has(origin))
    throw new HttpError(400, 'character_origin 不合法');
  if (role !== undefined && !CHARACTER_ROLES.has(role))
    throw new HttpError(400, 'character_role 不合法');
  if (origin === undefined && role === undefined)
    throw new HttpError(400, '沒有要修改的欄位');
  const current = await readCharacterMeta(id);
  const nextOrigin = origin ?? current.characterOrigin;
  const nextRole = role ?? current.characterRole;
  const now = Date.now();
  const by = SERVER_OPS_OPERATOR_ID;
  const statements = [
    `INSERT INTO character_meta (char_id,character_origin,character_role,updated_at,updated_by) VALUES (${id},'${nextOrigin}','${nextRole}',${now},${by}) ON DUPLICATE KEY UPDATE character_origin=VALUES(character_origin),character_role=VALUES(character_role),updated_at=VALUES(updated_at),updated_by=VALUES(updated_by);`,
  ];
  if (origin !== undefined && origin !== current.characterOrigin) {
    statements.push(
      `INSERT INTO character_meta_audit (char_id,field,old_value,new_value,changed_at,changed_by) VALUES (${id},'character_origin','${current.characterOrigin}','${origin}',${now},${by});`,
    );
  }
  if (role !== undefined && role !== current.characterRole) {
    statements.push(
      `INSERT INTO character_meta_audit (char_id,field,old_value,new_value,changed_at,changed_by) VALUES (${id},'character_role','${current.characterRole}','${role}',${now},${by});`,
    );
  }
  await sql(`START TRANSACTION;\n${statements.join('\n')}\nCOMMIT;`);
  return {
    charId: id,
    characterOrigin: nextOrigin,
    characterRole: nextRole,
    updatedAt: now,
    updatedBy: by,
  };
}

function parseAdminFarmTargetSource(targetRules) {
  try {
    const parsed = JSON.parse(String(targetRules ?? ''));
    const source = String(parsed?.source ?? parsed?.targetSource ?? '').toUpperCase();
    return ['DEFAULT_POLICY', 'PLAYER_OVERRIDE'].includes(source) ? source : 'UNCLASSIFIED';
  } catch {
    return 'UNCLASSIFIED';
  }
}

function adminFreshness({ resident, online, liveAgeMs }) {
  if (!online && !resident) return 'OFFLINE';
  if (Number.isFinite(liveAgeMs)) {
    if (liveAgeMs <= LIVE_STATUS_MAX_AGE_MS && resident) return 'LIVE';
    if (liveAgeMs > LIVE_STATUS_MAX_AGE_MS) return 'STALE';
  }
  return 'UNKNOWN';
}

const adminActivityEventTypes = Object.freeze([
  'MAP_CHANGED', 'MONSTER_TARGET', 'MONSTER_ATTACK', 'MONSTER_HIT',
  'MONSTER_KILL', 'LOOT_ACQUIRED', 'PLAYER_DEATH',
]);

function adminActivityEvent(row) {
  const columns = String(row).split('\t');
  return {
    charId: Number(columns[0]),
    eventId: Number(columns[1]),
    occurredAt: Number(columns[2]) || null,
    eventType: columns[3] || '',
    map: columns[4] && columns[4] !== 'NULL' ? columns[4] : null,
    facts: persistentLifeFactsFromHex(columns[5]),
    source: columns[6] || null,
  };
}

function buildAdminActivity(events) {
  const byChar = new Map();
  for (const event of events) {
    if (!Number.isSafeInteger(event.charId)) continue;
    const current = byChar.get(event.charId) ?? { events: [] };
    current.events.push(event);
    byChar.set(event.charId, current);
  }
  for (const entry of byChar.values()) {
    entry.events.sort((left, right) => right.occurredAt - left.occurredAt || right.eventId - left.eventId);
    const latest = (type) => entry.events.find((event) => event.eventType === type) ?? null;
    const movement = latest('MAP_CHANGED');
    const combat = entry.events.find((event) => ['MONSTER_TARGET', 'MONSTER_ATTACK', 'MONSTER_HIT', 'MONSTER_KILL', 'LOOT_ACQUIRED'].includes(event.eventType)) ?? null;
    const toMap = movement?.map ?? movement?.facts?.to ?? null;
    entry.lastMovement = movement ? {
      at: movement.occurredAt,
      type: movement.eventType,
      fromMap: movement.facts?.from ?? null,
      fromX: movement.facts?.fromX ?? null,
      fromY: movement.facts?.fromY ?? null,
      toMap,
      toX: movement.facts?.toX ?? null,
      toY: movement.facts?.toY ?? null,
      source: movement.source,
      gap: movement.facts?.fromX === undefined,
    } : null;
    entry.lastCombat = combat ? {
      at: combat.occurredAt,
      eventType: combat.eventType,
      targetId: combat.facts?.entityId ?? combat.facts?.targetId ?? null,
      targetMobId: combat.facts?.mobId ?? null,
      targetName: Number.isSafeInteger(Number(combat.facts?.mobId)) && Number(combat.facts?.mobId) > 0
        ? resolveMonsterDisplayName({ mobId: Number(combat.facts.mobId) }) ?? null
        : null,
      damage: combat.facts?.damage ?? null,
      map: combat.map ?? combat.facts?.map ?? null,
      x: combat.facts?.x ?? null,
      y: combat.facts?.y ?? null,
      source: combat.source,
    } : null;
    entry.lastAttack = latest('MONSTER_ATTACK');
    entry.lastHit = latest('MONSTER_HIT');
    entry.lastKill = latest('MONSTER_KILL');
    entry.lastLoot = latest('LOOT_ACQUIRED');
    entry.lastDeath = latest('PLAYER_DEATH');
    entry.lastRecovery = null;
  }
  return byChar;
}

async function readAdminCharacterActivity(charIds) {
  const ids = [...new Set(charIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (!ids.length) return { available: true, byChar: new Map() };
  try {
    const types = adminActivityEventTypes.map((type) => `'${type}'`).join(',');
    const output = await sql(
      `SELECT char_id,event_id,ROUND(UNIX_TIMESTAMP(occurred_at)*1000),event_type,COALESCE(map,''),HEX(COALESCE(facts,'')),source FROM persistent_life_event WHERE char_id IN (${ids.join(',')}) AND event_type IN (${types}) ORDER BY occurred_at DESC,event_id DESC LIMIT ${Math.max(100, ids.length * 16)};`,
    );
    const events = (output ? output.split(/\r?\n/) : []).filter(Boolean).map(adminActivityEvent);
    return { available: true, byChar: buildAdminActivity(events) };
  } catch (error) {
    if (persistentLifeEventSchemaUnavailable(error)) return { available: false, byChar: new Map() };
    throw error;
  }
}

// ADMIN character roster for the Server Ops surface. Read-only; joins the
// existing char table with PA state/live projections and the factual Event Ledger.
async function listAdminCharacters(limit = 200) {
  const out = await sql(
    `SELECT c.char_id,c.account_id,COALESCE(l.userid,''),c.name,c.class,c.base_level,c.job_level,COALESCE(s.map,c.last_map),c.online,COALESCE(m.character_origin,'UNKNOWN'),COALESCE(m.character_role,'UNKNOWN'),COALESCE(s.resident,0),COALESCE(s.hp,0),COALESCE(s.max_hp,0),COALESCE(s.sp,0),COALESCE(s.max_sp,0),COALESCE(s.zeny,c.zeny,0),COALESCE(s.x,c.last_x,0),COALESCE(s.y,c.last_y,0),COALESCE(c.save_map,''),COALESCE(c.save_x,0),COALESCE(c.save_y,0),COALESCE(s.runtime_phase,''),COALESCE(s.control_owner,''),COALESCE(s.ownership_state,''),COALESCE(s.runtime_state,''),COALESCE(s.agent_mode,''),COALESCE(st.task_type,''),COALESCE(st.task_phase,''),COALESCE(st.last_error_code,''),ROUND(TIMESTAMPDIFF(MICROSECOND,s.updated_at,CURRENT_TIMESTAMP(3))/1000),ROUND(UNIX_TIMESTAMP(s.updated_at)*1000),COALESCE(st.target_map,''),COALESCE(st.target_rules,''),COALESCE(a.last_web_activity_at,0),COALESCE(a.last_web_login_at,0) FROM \`char\` c LEFT JOIN login l ON l.account_id=c.account_id LEFT JOIN character_meta m ON m.char_id=c.char_id LEFT JOIN persistent_agent_live_status s ON s.char_id=c.char_id LEFT JOIN persistent_agent_state st ON st.char_id=c.char_id LEFT JOIN web_account_activity a ON a.account_id=c.account_id ORDER BY c.char_id ASC LIMIT ${Number(limit)};`,
  );
  if (!out) return [];
  const rows = String(out)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const r = line.split('\t');
      const liveAge = r[30] && r[30] !== 'NULL' ? Number(r[30]) : null;
      const resident = r[11] === '1';
      const online = r[8] === '1';
      const classId = Number(r[4]);
      return {
        charId: Number(r[0]),
        accountId: Number(r[1]),
        accountName: r[2] || '',
        name: r[3],
        classId,
        jobName: resolveJobName(classId),
        jobMappingSource: JOB_MAPPING_SOURCE,
        baseLevel: Number(r[5]),
        jobLevel: Number(r[6]),
        map: r[7],
        online,
        characterOrigin: r[9] || 'UNKNOWN',
        characterRole: r[10] || 'UNKNOWN',
        resident,
        hp: Number(r[12]),
        maxHp: Number(r[13]),
        sp: Number(r[14]),
        maxSp: Number(r[15]),
        zeny: Number(r[16]),
        x: Number(r[17]),
        y: Number(r[18]),
        saveMap: r[19] || '',
        saveX: Number(r[20]),
        saveY: Number(r[21]),
        runtimePhase: r[22] || '',
        controlOwner: r[23] || '',
        ownershipState: r[24] || '',
        runtimeState: r[25] || '',
        agentMode: r[26] || '',
        taskType: r[27] || '',
        taskPhase: r[28] || '',
        lastErrorCode: r[29] || '',
        liveAgeMs: Number.isFinite(liveAge) ? liveAge : null,
        updatedAt: Number(r[31]) || null,
        farmTarget: r[32] || '',
        farmTargetSource: parseAdminFarmTargetSource(r[33]),
        lastWebActivityAt: Number(r[34]) || 0,
        lastWebLoginAt: Number(r[35]) || 0,
        freshness: adminFreshness({ resident, online, liveAgeMs: liveAge }),
      };
    });
  const activity = await readAdminCharacterActivity(rows.map((row) => row.charId));
  return rows.map((row) => ({
    ...row,
    activitySourceStatus: activity.available ? 'AVAILABLE' : 'UNAVAILABLE',
    lastRecovery: null,
    ...((activity.byChar.get(row.charId) ?? {})),
  }));
}

// --- ADMIN character agent controls (啟動角色自主 / 啟動掛機) ---------------
// Reuses the existing SERVER_AGENT claim_agent activation and start_farm
// command surface. The admin path NEVER creates a Web session, never spawns
// OpenKore and never writes ownership/agent fields directly — rAthena remains
// the only executor. The pure transition rules live in admin-agent-control.mjs
// so the transport, UI and tests share one decision.
const ADMIN_ACTIVATION_DEADLINE_MS = 90_000;
const ADMIN_ACTIVATION_POLL_MS = 1_500;
const adminAgentOperationLocks = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readAdminCharacterIdentity(charId) {
  const id = Number(charId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError(400, 'char_id 不合法');
  const out = await sql(
    `SELECT account_id,online,COALESCE(name,'') FROM \`char\` WHERE char_id=${id} LIMIT 1;`,
  );
  if (!out) throw new HttpError(404, 'character_not_found');
  const row = out.split('\t');
  const accountId = Number(row[0]);
  if (!Number.isSafeInteger(accountId) || accountId <= 0)
    throw new HttpError(404, 'character_not_found');
  return { charId: id, accountId, online: row[1] === '1', name: row[2] || '' };
}

async function readAdminAgentSnapshot(charId) {
  const [stateRow, live] = await Promise.all([
    readAgentStateRow(charId),
    readPersistentAgentLiveStatusView(charId),
  ]);
  return { stateRow, live };
}

function adminAgentStatusPayload(charId, snapshot) {
  const stateRow = snapshot?.stateRow ?? null;
  const live = snapshot?.live ?? null;
  return {
    charId: Number(charId),
    controlOwner: stateRow?.controlOwner ?? null,
    ownershipState: stateRow?.ownershipState ?? null,
    agentEnabled: Boolean(stateRow?.agentEnabled),
    agentMode: stateRow?.agentMode ?? null,
    runtimeState: stateRow?.runtimeState ?? null,
    lastCommandId: stateRow?.lastCommandId ?? null,
    lastErrorCode: stateRow?.lastErrorCode ?? null,
    resident: Boolean(live?.resident),
    liveFresh: Boolean(live?.fresh),
    liveAgeMs: Number.isFinite(live?.ageMs) ? live.ageMs : null,
  };
}

// Ensure the character is a live SERVER_AGENT resident. Direct when already
// resident; otherwise queue the existing claim_agent activation and wait for the
// authoritative resident flag. Never proceeds past an explicit blocker.
async function ensureAdminServerAgentAutonomy(charId) {
  const identity = await readAdminCharacterIdentity(charId);
  const account = { accountId: identity.accountId, characterId: identity.charId };
  let snapshot = await readAdminAgentSnapshot(identity.charId);
  let decision = decideActivation({
    stateRow: snapshot.stateRow,
    live: snapshot.live,
    characterOnline: identity.online,
  });
  if (decision.phase === AGENT_PHASE.BLOCKED)
    return { ok: false, blocker: decision.blocker, account, snapshot, activated: false, alreadyResident: false, claimCommand: null };
  if (decision.phase === AGENT_PHASE.RESIDENT)
    return { ok: true, blocker: null, account, snapshot, activated: false, alreadyResident: true, claimCommand: null };

  let claimCommand = null;
  if (decision.phase === AGENT_PHASE.CLAIM) {
    // Existing activation/claim/resident mechanism (idempotent): initializes
    // the canonical persistent_agent_state row + rollout allowlist, then queues
    // claim_agent. No ownership field is written directly here.
    const queued = await bootstrapServerAgentOwnership(account, identity.charId);
    claimCommand = queued?.commandId ?? null;
  }

  const deadline = Date.now() + ADMIN_ACTIVATION_DEADLINE_MS;
  while (Date.now() < deadline) {
    await sleep(ADMIN_ACTIVATION_POLL_MS);
    snapshot = await readAdminAgentSnapshot(identity.charId);
    decision = decideActivation({ stateRow: snapshot.stateRow, live: snapshot.live });
    if (decision.phase === AGENT_PHASE.RESIDENT)
      return { ok: true, blocker: null, account, snapshot, activated: Boolean(claimCommand), alreadyResident: false, claimCommand };
    if (decision.phase === AGENT_PHASE.BLOCKED)
      return { ok: false, blocker: decision.blocker, account, snapshot, activated: Boolean(claimCommand), alreadyResident: false, claimCommand };
  }
  return { ok: false, blocker: 'resident_not_confirmed', account, snapshot, activated: Boolean(claimCommand), alreadyResident: false, claimCommand };
}

async function runAdminAgentAutonomy(charId) {
  const result = await ensureAdminServerAgentAutonomy(charId);
  return {
    ok: result.ok,
    charId: Number(charId),
    action: 'autonomy',
    phase: result.ok ? 'confirmed' : 'failed',
    activated: Boolean(result.activated),
    alreadyResident: Boolean(result.alreadyResident),
    command: result.claimCommand ? { commandId: result.claimCommand, action: 'claim_agent' } : null,
    blocker: result.blocker ?? null,
    agent: adminAgentStatusPayload(charId, result.snapshot),
  };
}

// Start farm for an admin-selected character. Activation first (reusing the
// autonomy path); if activation fails, the farm command is never sent. A
// missing farm target is an explicit blocker — the admin path does NOT use the
// web canonical fallback, so the player's persisted target stays authoritative.
async function runAdminAgentFarm(charId) {
  const id = Number(charId);
  const activation = await ensureAdminServerAgentAutonomy(id);
  const base = {
    charId: id,
    action: 'farm',
    activated: Boolean(activation.activated),
    alreadyResident: Boolean(activation.alreadyResident),
  };
  if (!activation.ok)
    return {
      ...base,
      ok: false,
      phase: 'activating',
      alreadyFarming: false,
      relocation: false,
      target: null,
      command: null,
      blocker: activation.blocker ?? 'activation_failed',
      agent: adminAgentStatusPayload(id, activation.snapshot),
    };
  const controller = await readCharacterControllerStatus(activation.account, id, {
    includeFarmTarget: true,
    allowFarmTargetFallback: false,
  });
  if (!controller.available)
    return {
      ...base,
      ok: false,
      phase: 'starting',
      alreadyFarming: false,
      relocation: false,
      target: null,
      command: null,
      blocker: controller.unavailableReason ?? 'agent_status_unavailable',
      agent: adminAgentStatusPayload(id, await readAdminAgentSnapshot(id)),
    };
  const decision = decideFarmStart({
    resident: true,
    startFarmAllowed: controller.actions.startFarm,
    startFarmBlocker: controller.actionBlockers.startFarm ?? null,
    farmTarget: controller.farmTarget ?? null,
  });
  if (decision.decision === FARM_DECISION.ALREADY_FARMING)
    return {
      ...base,
      ok: true,
      phase: 'confirmed',
      alreadyFarming: true,
      relocation: false,
      target: controller.farmTarget ?? null,
      command: null,
      blocker: null,
      agent: adminAgentStatusPayload(id, await readAdminAgentSnapshot(id)),
    };
  if (decision.decision === FARM_DECISION.BLOCKED)
    return {
      ...base,
      ok: false,
      phase: 'starting',
      alreadyFarming: false,
      relocation: false,
      target: controller.farmTarget ?? null,
      command: null,
      blocker: decision.blocker,
      agent: adminAgentStatusPayload(id, await readAdminAgentSnapshot(id)),
    };
  const dispatched = await queueCanaryAutomation(activation.account, controller, {
    action: 'start',
  });
  return {
    ...base,
    ok: true,
    phase: 'confirmed',
    alreadyFarming: false,
    relocation: Boolean(dispatched?.policy),
    target: controller.farmTarget ?? null,
    command: dispatched?.command ?? null,
    blocker: null,
    agent: adminAgentStatusPayload(id, await readAdminAgentSnapshot(id)),
  };
}

function runAdminAgentAction(charId, action) {
  return action === 'autonomy'
    ? runAdminAgentAutonomy(charId)
    : runAdminAgentFarm(charId);
}

// C3-OPS-CONTROL-PLANE: the ONLY lifecycle control path. It shells the
// canonical ro-stack.ps1; it never spawns login/char/map directly. MariaDB and
// the Dashboard control plane are never targeted by stop/restart.
const roStackScriptPath = join(root, 'ops', 'ro-stack', 'ro-stack.ps1');
async function runStackLifecycle(action) {
  try {
    const { stdout, stderr } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', roStackScriptPath, action],
      { cwd: root, windowsHide: true, timeout: 180_000 },
    );
    return { ok: true, output: String(stdout ?? '').trim(), stderr: String(stderr ?? '').trim() };
  } catch (error) {
    return {
      ok: false,
      output: String(error?.stdout ?? '').trim(),
      stderr: String(error?.stderr ?? error?.message ?? '').trim(),
      exitCode: Number.isFinite(Number(error?.code)) ? Number(error.code) : null,
    };
  }
}

const STACK_LIFECYCLE_STATES = new Set([
  'ALREADY_RUNNING',
  'ALREADY_STOPPED',
  'STARTING',
  'STOPPING',
  'RESTARTING',
  'STOPPED',
  'STOP_FAILED',
  'RESTART_SUCCESS',
  'RESTART_FAILED',
  'LIFECYCLE_BUSY',
]);
function parseStackLifecycleState(output) {
  const lines = String(output ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    const token = line.split(/\s+/)[0];
    if (STACK_LIFECYCLE_STATES.has(token)) return token;
  }
  return null;
}

async function queryCharacter(accountId) {
  const output = await sql(
    `SELECT c.char_id,c.name,c.class,c.sex,c.hair,c.hair_color,c.base_level,c.job_level,c.base_exp,c.job_exp,c.zeny,c.str,c.agi,c.vit,c.\`int\`,c.dex,c.luk,c.hp,c.max_hp,c.sp,c.max_sp,c.status_point,c.skill_point,c.last_map,c.last_x,c.last_y,c.online,j.value FROM \`char\` c LEFT JOIN char_reg_str j ON j.char_id=c.char_id AND j.\`key\`='terminal_target_job$' AND j.\`index\`=0 WHERE c.account_id=${Number(accountId)} AND c.char_num=0 LIMIT 1;`,
  );
  if (!output) return null;
  const row = output.split('\t'),
    n = (i) => Number(row[i] ?? 0);
  const meta = await readCharacterMeta(row[0]);
  return {
    charId: n(0),
    name: row[1],
    classId: n(2),
    sex: row[3],
    hair: n(4),
    hairColor: n(5),
    baseLevel: n(6),
    jobLevel: n(7),
    baseExp: n(8),
    jobExp: n(9),
    zeny: n(10),
    str: n(11),
    agi: n(12),
    vit: n(13),
    int: n(14),
    dex: n(15),
    luk: n(16),
    hp: n(17),
    maxHp: n(18),
    sp: n(19),
    maxSp: n(20),
    statusPoint: n(21),
    skillPoint: n(22),
    map: row[23],
    x: n(24),
    y: n(25),
    online: row[26] === '1',
    targetJob: row[27] && row[27] !== 'NULL' ? row[27] : null,
    characterOrigin: meta.characterOrigin,
    characterRole: meta.characterRole,
  };
}

async function queryClassRanking(classId) {
  const normalizedClassId = Number(classId);
  if (!rankingClassIds.has(normalizedClassId))
    throw new HttpError(400, '尚未開放此職業排行榜');
  const now = Date.now();
  const cached = rankingCache.get(normalizedClassId);
  if (cached && now - cached.generatedAt < rankingCacheDurationMs)
    return cached;
  const output = await sql(
    `SELECT c.char_id,c.name,c.class,c.base_level,c.job_level,c.sex,c.hair,c.hair_color,c.clothes_color,c.body
    FROM \`char\` c
    JOIN login l ON l.account_id=c.account_id
    JOIN web_accounts w ON w.account_id=c.account_id
    LEFT JOIN web_account_flags f ON f.account_id=c.account_id
    WHERE c.class=${normalizedClassId}
      AND c.delete_date=0
      AND l.state=0
      AND l.group_id=0
      AND COALESCE(f.is_test,0)=0
    ORDER BY c.base_level DESC,c.job_level DESC,c.base_exp DESC,c.job_exp DESC,c.char_id ASC
    LIMIT 100;`,
  );
  const rows = output ? output.split(/\r?\n/) : [];
  const equipmentByCharacter = await queryEquipmentForCharacters(
    rows.map((line) => Number(line.split('\t')[0])),
  );
  const entries = rows.length
    ? rows.map((line, index) => {
        const row = line.split('\t');
        const charId = Number(row[0]);
        return {
          rank: index + 1,
          name: row[1],
          classId: Number(row[2]),
          baseLevel: Number(row[3]),
          jobLevel: Number(row[4]),
          appearance: {
            sex: row[5] === 'F' ? 'F' : 'M',
            hair: Number(row[6] ?? 1),
            hairColor: Number(row[7] ?? 0),
            clothesColor: Number(row[8] ?? 0),
            body: Number(row[9] ?? 0),
          },
          equipment: equipmentByCharacter.get(charId) ?? [],
        };
      })
    : [];
  const result = { classId: normalizedClassId, generatedAt: now, entries };
  rankingCache.set(normalizedClassId, result);
  return result;
}

const renewalNoviceQuests = Object.freeze([
  { id: 21001, title: '逃離沉船', place: '沉船船艙' },
  { id: 7471, title: '初次相遇', place: '漂流島' },
  { id: 21008, title: '第一次戰鬥', place: '漂流島' },
  { id: 7472, title: '新世界的第一步', place: '伊斯魯得島' },
  { id: 7473, title: '清涼飲料', place: '伊斯魯得島' },
  { id: 4269, title: '新生學院報到', place: '克里圖拉學院' },
]);

async function queryOnboardingProgress(charId) {
  const [questOutput, graduationOutput, classOutput, stageOutput] =
    await Promise.all([
      sql(
        `SELECT quest_id,state,count1,count2,count3 FROM quest WHERE char_id=${Number(charId)} AND quest_id IN (${renewalNoviceQuests.map((quest) => quest.id).join(',')});`,
      ),
      sql(
        `SELECT value FROM char_reg_num WHERE char_id=${Number(charId)} AND \`key\`='terminal_academy_graduated' AND \`index\`=0 LIMIT 1;`,
      ),
      sql(
        `SELECT \`class\` FROM \`char\` WHERE char_id=${Number(charId)} LIMIT 1;`,
      ),
      sql(
        `SELECT value FROM char_reg_num WHERE char_id=${Number(charId)} AND \`key\`='terminal_onboarding_stage' AND \`index\`=0 LIMIT 1;`,
      ),
    ]);
  const alreadyFirstJob = Number(classOutput || 0) > 0;
  const rows = new Map(
    questOutput
      ? questOutput.split(/\r?\n/).map((line) => {
          const [id, state, count1, count2, count3] = line
            .split('\t')
            .map(Number);
          return [id, { state, counts: [count1, count2, count3] }];
        })
      : [],
  );
  const quests = renewalNoviceQuests.map((quest) => {
    const row = rows.get(quest.id);
    return {
      ...quest,
      status:
        alreadyFirstJob || row?.state === 2
          ? 'complete'
          : row
            ? 'active'
            : 'locked',
      counts: row?.counts ?? [0, 0, 0],
    };
  });
  quests.push({
    id: 'graduation',
    title: '一轉結業',
    place: '克里圖拉學院',
    status:
      alreadyFirstJob || Number(graduationOutput || 0) > 0
        ? 'complete'
        : 'locked',
    counts: [0, 0, 0],
  });
  const activeIndex = quests.findIndex((quest) => quest.status === 'active');
  const nextIndex = quests.findIndex((quest) => quest.status === 'locked');
  const onboardingStage = Number(stageOutput || 0);
  const graduated = alreadyFirstJob || Number(graduationOutput || 0) > 0;
  const checkpoint =
    alreadyFirstJob || graduated || onboardingStage >= 3
      ? 'FIRST_JOB_READY'
      : onboardingStage >= 2
        ? 'ACADEMY_TRANSPORTED'
        : onboardingStage >= 1
          ? 'ONBOARDING_STARTED'
          : 'WEB_CHARACTER_CREATED';
  return {
    source: '遊戲伺服器任務資料',
    quests,
    currentIndex: activeIndex >= 0 ? activeIndex : nextIndex,
    complete: quests.every((quest) => quest.status === 'complete'),
    graduated,
    stage: onboardingStage,
    checkpoint,
  };
}

// Native CP2/CP3 Quest Sequence projection (read-only). Web consumes it; it
// never executes. The tables arrive with migration 011, so until then this
// honestly reports unavailable instead of fabricating progress.
async function readQuestSequenceProjection(charId) {
  const id = Number(charId);
  const tableCount = Number(
    (await sql(
      `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('persistent_agent_live_quest_sequence','persistent_agent_quest_checkpoint');`,
    )) || 0,
  );
  if (tableCount < 2)
    return { available: false, reason: 'migration_011_pending', projection: null, checkpoint: null };
  let projection = null;
  const rows = await sql(
    `SELECT sequence_id,root_step_index,step_index,frame_depth,status,COALESCE(blocked_reason,''),checkpoint_at,last_transition_at,ROUND(TIMESTAMPDIFF(MICROSECOND,updated_at,CURRENT_TIMESTAMP(3))/1000) FROM persistent_agent_live_quest_sequence WHERE char_id=${id} LIMIT 1;`,
  );
  if (rows) {
    const [
      sequenceId, rootStepIndex, stepIndex, frameDepth, status, blockedReason,
      checkpointAt, lastTransitionAt, ageMs,
    ] = rows.split('\t');
    projection = {
      sequenceId,
      rootStepIndex: Number(rootStepIndex),
      stepIndex: Number(stepIndex),
      frameDepth: Number(frameDepth),
      status,
      blockedReason: blockedReason || null,
      checkpointAt: Number(checkpointAt) || null,
      lastTransitionAt: Number(lastTransitionAt) || null,
      ageMs: Number(ageMs) || 0,
    };
  }
  let checkpoint = null;
  const checkpointRows = await sql(
    `SELECT sequence_id,status,COALESCE(blocked_reason,''),updated_at FROM persistent_agent_quest_checkpoint WHERE char_id=${id} LIMIT 1;`,
  );
  if (checkpointRows) {
    const [sequenceId, status, blockedReason, updatedAt] = checkpointRows.split('\t');
    checkpoint = {
      sequenceId,
      status,
      blockedReason: blockedReason || null,
      updatedAt,
    };
  }
  return { available: true, projection, checkpoint };
}

const edenEquipment12Quests = Object.freeze({
  7128: {
    objective: '前往夢羅克南東方綠洲',
    nextAction: '與 Talking Dog 對話',
  },
  7129: { mobId: 1009, mobName: 'Condor', goal: 10 },
  7130: { mobId: 1107, mobName: 'Baby Desert Wolf', goal: 10 },
  7131: { mobId: 1001, mobName: 'Scorpion', goal: 5 },
  7132: { objective: '沙漠訓練完成', nextAction: `返回 ${edenInstructorName()} 回報` },
});
const edenEquipment12Rewards = Object.freeze([
  { itemId: 5583, name: 'Eden Team Hat I' },
  { itemId: 2560, name: 'Eden Team Manteau I' },
  { itemId: 2456, name: 'Eden Team Boots I' },
  { itemId: 15009, name: 'Eden Team Uniform I' },
]);
const edenEquipment26Quests = Object.freeze({
  7138: {
    objective: '前往斐揚洞穴入口',
    nextAction: '與 Eden Member Karl 對話',
  },
  7139: { mobId: 1076, mobName: 'Skeleton', goal: 15 },
  7140: { mobId: 1031, mobName: 'Poporing', goal: 10 },
  7141: {
    objective: '幽靈洞穴訓練完成',
    nextAction: `返回 ${edenInstructorName()} 回報`,
  },
});
const edenEquipment26Rewards = Object.freeze([
  { itemId: 1747, name: 'Eden Bow I' },
  { itemId: 2457, name: 'Eden Team Boots II' },
  { itemId: 15010, name: 'Eden Team Uniform II' },
]);
const edenEquipment40Quests = Object.freeze({
  7147: { objective: '前往獸人村據點', nextAction: '與 Eden Member Hooksha 對話' },
  7148: { mobId: 1686, mobName: 'Orc Baby', goal: 10 },
  7149: { mobId: 1023, mobName: 'Orc Warrior', goal: 10 },
  7150: { mobId: 1273, mobName: 'Orc Lady', goal: 10 },
  7151: { objective: '獸人村訓練完成', nextAction: `返回 ${edenInstructorName()} 回報` },
});
const edenEquipment40Rewards = Object.freeze([
  { itemId: 2458, name: 'Eden Team Boots III' },
  { itemId: 15011, name: 'Eden Team Uniform III' },
]);
const edenMilestones = Object.freeze([
  { id: 'member', title: '加入伊甸園', minimumLevel: 1, implemented: true },
  {
    id: 'equipment12',
    title: 'Lv.12 裝備訓練',
    minimumLevel: 12,
    implemented: true,
  },
  {
    id: 'equipment26',
    title: 'Lv.26 裝備訓練',
    minimumLevel: 26,
    implemented: true,
  },
  {
    id: 'equipment40',
    title: 'Lv.40 裝備訓練',
    minimumLevel: 40,
    implemented: true,
  },
]);

async function queryEdenProgress(charId, baseLevel = 0) {
  const [
    markOutput,
    progressOutput,
    equipmentRecordOutput,
    questOutput,
    rewardOutput,
  ] = await Promise.all([
    sql(
      `SELECT COALESCE(SUM(amount),0) FROM inventory WHERE char_id=${Number(charId)} AND nameid IN (6219,22508);`,
    ),
    sql(
      `SELECT value FROM char_reg_num WHERE char_id=${Number(charId)} AND \`key\`='para_suv01' AND \`index\`=0 LIMIT 1;`,
    ),
    sql(
      `SELECT value FROM char_reg_num WHERE char_id=${Number(charId)} AND \`key\`='para_suv02' AND \`index\`=0 LIMIT 1;`,
    ),
    sql(
      `SELECT quest_id,state,count1,count2,count3 FROM quest WHERE char_id=${Number(charId)} AND quest_id IN (7128,7129,7130,7131,7132,7138,7139,7140,7141,7147,7148,7149,7150,7151);`,
    ),
    sql(
      `SELECT nameid,SUM(amount) FROM inventory WHERE char_id=${Number(charId)} AND nameid IN (${[...edenEquipment12Rewards, ...edenEquipment26Rewards, ...edenEquipment40Rewards].map((item) => item.itemId).join(',')}) GROUP BY nameid;`,
    ),
  ]);
  const member = Number(markOutput || 0) > 0;
  const trainingStage = Number(progressOutput || 0);
  const equipmentRecord = Number(equipmentRecordOutput || 0);
  const questStates = new Map(
    questOutput
      ? questOutput.split(/\r?\n/).map((line) => {
          const [questId, state, count1, count2, count3] = line
            .split('\t')
            .map(Number);
          return [questId, { state, counts: [count1, count2, count3] }];
        })
      : [],
  );
  const rewardAmounts = new Map(
    rewardOutput
      ? rewardOutput.split(/\r?\n/).map((line) => line.split('\t').map(Number))
      : [],
  );
  const reward = edenEquipment12Rewards.map((item) => ({
    ...item,
    name: localizedItemName(item.itemId, item.name),
    amount: Number(rewardAmounts.get(item.itemId) || 0),
  }));
  const reward26 = edenEquipment26Rewards.map((item) => ({
    ...item,
    name: localizedItemName(item.itemId, item.name),
    amount: Number(rewardAmounts.get(item.itemId) || 0),
  }));
  const reward40 = edenEquipment40Rewards.map((item) => ({
    ...item,
    name: localizedItemName(item.itemId, item.name),
    amount: Number(rewardAmounts.get(item.itemId) || 0),
  }));
  const currentQuestId = [7128, 7129, 7130, 7131, 7132].find((questId) =>
    questStates.has(questId),
  );
  const questDefinition = edenEquipment12Quests[currentQuestId];
  const dbProgress = questDefinition?.mobId
    ? {
        mobId: questDefinition.mobId,
        mobName: questDefinition.mobName,
        count: Number(questStates.get(currentQuestId)?.counts?.[0] || 0),
        goal: questDefinition.goal,
        source: 'MariaDB quest',
      }
    : null;
  const rewardComplete = reward.every((item) => item.amount > 0);
  const rewardComplete26 = reward26.slice(1).every((item) => item.amount > 0);
  const rewardComplete40 = reward40.every((item) => item.amount > 0);
  const completionStages = Object.freeze({
    member: member,
    equipment12:
      trainingStage === 12 || equipmentRecord === 1 || rewardComplete,
    equipment26: trainingStage >= 23,
    equipment40: trainingStage >= 38,
  });
  const milestones = edenMilestones.map((milestone) => {
    if (milestone.id === 'member')
      return {
        ...milestone,
        status: member ? 'complete' : 'available',
        currentObjective: member
          ? '已取得伊甸園徽章'
          : `向 ${edenSecretaryName()} 辦理入團`,
        nextAction: member ? '可進行裝備訓練' : '雙擊後自動前往伊甸園總部',
        canReport: false,
        reward: [
          { itemId: 22508, name: localizedItemName(22508, 'Eden Group Mark') },
        ],
      };
    if (milestone.id === 'equipment40') {
      const questIds = [7147, 7148, 7149, 7150, 7151];
      const milestoneQuestId = questIds.find((questId) => questStates.has(questId));
      const milestoneQuest = edenEquipment40Quests[milestoneQuestId];
      const progress = milestoneQuest?.mobId
        ? {
            mobId: milestoneQuest.mobId,
            mobName: milestoneQuest.mobName,
            count: Number(questStates.get(milestoneQuestId)?.counts?.[0] || 0),
            goal: milestoneQuest.goal,
            source: 'MariaDB quest',
          }
        : null;
      const complete = completionStages.equipment40 || rewardComplete40;
      const active = trainingStage >= 24 && trainingStage < 38;
      const available = Number(baseLevel) >= 40 && trainingStage === 23;
      return {
        ...milestone,
        status: complete
          ? 'complete'
          : active
            ? 'active'
            : available
              ? 'available'
              : 'locked',
        questId: milestoneQuestId || 7147,
        questState: milestoneQuestId
          ? (questStates.get(milestoneQuestId)?.state ?? null)
          : null,
        currentObjective: complete
          ? '第三套伊甸園裝備已領取'
          : milestoneQuest?.mobId
            ? `擊殺 ${milestoneQuest.mobName}`
            : milestoneQuest?.objective || 'Base Lv.40 以上可補做獸人村訓練',
        progress,
        nextAction: complete
          ? '無'
          : progress
            ? progress.count >= progress.goal
              ? '返回 Eden Member Hooksha 回報'
              : '前往 gef_fild10 完成擊殺'
            : milestoneQuest?.nextAction || `向 ${edenInstructorName()} 接取任務`,
        canReport:
          milestoneQuestId === 7151 ||
          Boolean(progress && progress.count >= progress.goal),
        reward: reward40,
      };
    }

    const isEquipment26 = milestone.id === 'equipment26';
    const definitions = isEquipment26
      ? edenEquipment26Quests
      : edenEquipment12Quests;
    const questIds = isEquipment26
      ? [7138, 7139, 7140, 7141]
      : [7128, 7129, 7130, 7131, 7132];
    const milestoneQuestId = questIds.find((questId) =>
      questStates.has(questId),
    );
    const milestoneQuest = definitions[milestoneQuestId];
    const milestoneProgress = milestoneQuest?.mobId
      ? {
          mobId: milestoneQuest.mobId,
          mobName: milestoneQuest.mobName,
          count: Number(questStates.get(milestoneQuestId)?.counts?.[0] || 0),
          goal: milestoneQuest.goal,
          source: 'MariaDB quest',
        }
      : null;
    const milestoneComplete = isEquipment26
      ? completionStages.equipment26 || rewardComplete26
      : completionStages.equipment12 || rewardComplete;
    let status = 'locked';
    if (milestoneComplete) status = 'complete';
    else if (isEquipment26 && trainingStage >= 13 && trainingStage < 23)
      status = 'active';
    else if (!isEquipment26 && trainingStage > 0 && trainingStage < 12)
      status = 'active';
    else if (
      isEquipment26 &&
      Number(baseLevel) >= 26 &&
      [0, 12].includes(trainingStage)
    )
      status = 'available';
    else if (
      !isEquipment26 &&
      Number(baseLevel) >= 12 &&
      trainingStage === 0
    )
      status = 'available';
    let currentObjective = isEquipment26
      ? 'Base Lv.26 後可進行幽靈洞穴訓練'
      : 'Base Lv.12 後可進行沙漠訓練';
    let nextAction = member
      ? `向 ${edenInstructorName()} 接取任務`
      : `先加入伊甸園，再向 ${edenInstructorName()} 接取任務`;
    let canReport = false;
    if (milestoneComplete) {
      currentObjective = isEquipment26
        ? '第二套伊甸園裝備已領取'
        : '第一套伊甸園裝備已領取';
      nextAction = '無';
    } else if (!isEquipment26 && trainingStage >= 13) {
      currentObjective = '已進入 Lv.26 訓練，第一套裝備未曾領取';
      nextAction = '完成 Lv.26 訓練並領取第二套裝備';
    } else if (
      (!isEquipment26 && trainingStage === 11) ||
      (isEquipment26 && trainingStage === 22)
    ) {
      currentObjective = '訓練回報完成，裝備待領取';
      nextAction = '向 Administrator Michael 領取裝備';
      canReport = true;
    } else if (milestoneQuestId && milestoneQuest) {
      currentObjective = milestoneQuest.mobId
        ? `擊殺 ${milestoneQuest.mobName}`
        : milestoneQuest.objective;
      nextAction = milestoneQuest.mobId
        ? milestoneProgress.count >= milestoneProgress.goal
          ? isEquipment26
            ? '返回 Eden Member Karl 回報'
            : '返回 Talking Dog 回報'
          : isEquipment26
            ? '前往 pay_dun00 完成擊殺'
            : '前往 moc_fild11 完成擊殺'
        : milestoneQuest.nextAction;
      canReport =
        milestoneQuestId === (isEquipment26 ? 7141 : 7132) ||
        Boolean(
          milestoneProgress &&
          milestoneProgress.count >= milestoneProgress.goal,
        );
    }
    return {
      ...milestone,
      status,
      questId: milestoneQuestId || (isEquipment26 ? 7138 : 7128),
      questState: milestoneQuestId
        ? (questStates.get(milestoneQuestId)?.state ?? null)
        : null,
      currentObjective,
      progress: milestoneProgress,
      nextAction,
      canReport,
      reward: isEquipment26 ? reward26 : reward,
    };
  });
  return {
    source: '遊戲伺服器伊甸園資料',
    member,
    trainingStage,
    equipmentRecord,
    rewardComplete,
    rewardComplete26,
    rewardComplete40,
    questStates: Object.fromEntries(questStates),
    milestones,
  };
}

const equipmentCatalog = {
  1201: { aegisName: 'Knife_', name: '短劍 [3]' },
  1202: { aegisName: 'Knife_', name: '短劍 [4]' },
  1243: { aegisName: 'Knife_', name: '初學者笨拙短劍' },
  1381: { aegisName: 'N_Battle_Axe', name: '新手專用戰斧' },
  1545: { aegisName: 'N_Mace', name: '新手專用鐵錘' },
  1639: { aegisName: 'N_Rod', name: '新手專用手杖 [3]' },
  1702: { aegisName: 'Bow_', name: '弓 [3]' },
  1742: { aegisName: 'N_Composite_Bow', name: '新手專用坎普茲弓 [3]' },
  2101: { aegisName: 'Guard_', name: '鐵盾' },
  2102: { aegisName: 'Guard_', name: '鐵盾 [1]' },
  2112: { aegisName: 'Novice_Guard', name: '新手鐵盾' },
  2301: { aegisName: 'Cotton_Shirt', name: '棉襯衫' },
  2302: { aegisName: 'Cotton_Shirt', name: '棉襯衫 [1]' },
  2352: { aegisName: 'Novice_Plate', name: '新手忍服' },
  2414: { aegisName: 'Novice_Boots', name: '新手便鞋' },
  2510: { aegisName: 'Novice_Hood', name: '新手斗篷' },
  2456: { aegisName: 'Para_Team_Boots1', name: '伊甸園短靴 I' },
  2560: { aegisName: 'Para_Team_Manteau', name: '伊甸園斗篷' },
  5055: { aegisName: 'Novice_Egg_Cap', name: '新手蛋殼帽' },
  5583: { aegisName: 'Para_Team_Hat', name: '伊甸園圓帽' },
  13100: { aegisName: 'Six_Shooter', name: '六輪發手槍' },
  13101: { aegisName: 'Six_Shooter', name: '六輪發手槍 [1]' },
  15009: { aegisName: 'Para_Team_Uniform1', name: '伊甸園制服 I' },
  18730: { aegisName: 'Cryptura_Academy_Hat', name: '克里圖拉學院帽' },
  13041: { aegisName: 'Knife_', name: '新手專用笨拙短劍' },
  13415: { aegisName: 'N_Falchion', name: '新手專用圓月刀' },
};
const inventoryCatalog = {
  501: { aegisName: 'Red_Potion', name: '紅色藥水', category: 'consumable' },
  507: { aegisName: 'Red_Herb', name: '紅色藥草', category: 'consumable' },
  511: { aegisName: 'Green_Herb', name: '綠色藥草', category: 'consumable' },
  512: { aegisName: 'Apple', name: '蘋果', category: 'consumable' },
  569: { aegisName: 'Novice_Potion', name: '新手藥水', category: 'consumable' },
  515: { aegisName: 'Carrot', name: '紅蘿蔔', category: 'consumable' },
  517: { aegisName: 'Meat', name: '肉', category: 'consumable' },
  582: { aegisName: 'Orange', name: '柳橙', category: 'consumable' },
  601: { aegisName: 'Wing_Of_Fly', name: '蒼蠅翅膀', category: 'consumable' },
  602: { aegisName: 'Wing_Of_Butterfly', name: '蝴蝶翅膀', category: 'consumable' },
  705: { aegisName: 'Clover', name: '三葉幸運草', category: 'etc' },
  909: { aegisName: 'Jellopy', name: '傑勒比結晶', category: 'etc' },
  904: { aegisName: 'Scorpion_Tail', name: '蠍子尾巴', category: 'etc' },
  914: { aegisName: 'Fluff', name: '柔毛', category: 'etc' },
  915: { aegisName: 'Chrysalis', name: '蛹殼', category: 'etc' },
  916: { aegisName: 'Feather_Of_Birds', name: '羽毛', category: 'etc' },
  917: { aegisName: 'Talon', name: '鳥指甲', category: 'etc' },
  919: { aegisName: 'Animal_Skin', name: '動物外皮', category: 'etc' },
  924: { aegisName: 'Powder_Of_Butterfly', name: '蝴蝶粉末', category: 'etc' },
  935: { aegisName: 'Shell', name: '硬殼', category: 'etc' },
  938: { aegisName: 'Sticky_Mucus', name: '黏稠液體', category: 'etc' },
  943: { aegisName: 'Solid_Shell', name: '堅硬外皮', category: 'etc' },
  949: { aegisName: 'Feather', name: '羽毛', category: 'etc' },
  1002: { aegisName: 'Iron_Ore', name: '鐵礦石', category: 'etc' },
  1010: { aegisName: 'Phracon', name: '強化武器金屬-級數一', category: 'etc' },
  1201: { aegisName: 'Knife_', name: '短劍 [3]', category: 'equipment' },
  1202: { aegisName: 'Knife_', name: '短劍 [4]', category: 'equipment' },
  1243: {
    aegisName: 'Knife_',
    name: '初學者笨拙短劍',
    category: 'equipment',
  },
  1381: {
    aegisName: 'N_Battle_Axe',
    name: '新手專用戰斧',
    category: 'equipment',
  },
  1545: { aegisName: 'N_Mace', name: '新手專用鐵錘', category: 'equipment' },
  1639: { aegisName: 'N_Rod', name: '新手專用手杖 [3]', category: 'equipment' },
  1702: { aegisName: 'Bow_', name: '弓 [3]', category: 'equipment' },
  1742: {
    aegisName: 'N_Composite_Bow',
    name: '新手專用坎普茲弓 [3]',
    category: 'equipment',
  },
  2101: { aegisName: 'Guard_', name: '鐵盾', category: 'equipment' },
  2102: { aegisName: 'Guard_', name: '鐵盾 [1]', category: 'equipment' },
  2112: { aegisName: 'Novice_Guard', name: '新手鐵盾', category: 'equipment' },
  2301: { aegisName: 'Cotton_Shirt', name: '棉襯衫', category: 'equipment' },
  2302: { aegisName: 'Cotton_Shirt', name: '棉襯衫 [1]', category: 'equipment' },
  2352: { aegisName: 'Novice_Plate', name: '新手忍服', category: 'equipment' },
  2414: { aegisName: 'Novice_Boots', name: '新手便鞋', category: 'equipment' },
  2510: { aegisName: 'Novice_Hood', name: '新手斗篷', category: 'equipment' },
  2456: { aegisName: 'Para_Team_Boots1', name: '伊甸園短靴 I', category: 'equipment' },
  2560: { aegisName: 'Para_Team_Manteau', name: '伊甸園斗篷', category: 'equipment' },
  5055: {
    aegisName: 'Novice_Egg_Cap',
    name: '新手蛋殼帽',
    category: 'equipment',
  },
  6593: {
    aegisName: 'Cryptura_Hair_Coupon',
    name: '克里圖拉髮型券',
    category: 'etc',
  },
  5583: { aegisName: 'Para_Team_Hat', name: '伊甸園圓帽', category: 'equipment' },
  18730: {
    aegisName: 'Cryptura_Academy_Hat',
    name: '克里圖拉學院帽',
    category: 'equipment',
  },
  7060: {
    aegisName: 'Warp_Free_Ticket',
    name: '卡普拉傳送點 免費利用券',
    category: 'etc',
  },
  12004: {
    aegisName: 'Arrow_Container',
    name: '箭矢筒',
    category: 'consumable',
  },
  12008: {
    aegisName: 'Fire_Arrow_Container',
    name: '火箭矢筒',
    category: 'consumable',
  },
  12009: {
    aegisName: 'Silver_Arrow_Container',
    name: '銀箭矢筒',
    category: 'consumable',
  },
  13100: { aegisName: 'Six_Shooter', name: '六輪發手槍', category: 'equipment' },
  13101: { aegisName: 'Six_Shooter', name: '六輪發手槍 [1]', category: 'equipment' },
  13200: { aegisName: 'Bullet', name: '子彈', category: 'etc' },
  15009: { aegisName: 'Para_Team_Uniform1', name: '伊甸園制服 I', category: 'equipment' },
  22508: { aegisName: 'Para_Team_Mark_', name: '伊甸園徽章', category: 'consumable' },
  23484: { aegisName: 'Firstaid_Box_5', name: '急救箱', category: 'consumable' },
  13041: {
    aegisName: 'Knife_',
    name: '新手專用笨拙短劍',
    category: 'equipment',
  },
  13415: {
    aegisName: 'N_Falchion',
    name: '新手專用圓月刀',
    category: 'equipment',
  },
  4006: { aegisName: 'Lunatic_Card', name: '瘋兔卡片', category: 'card' },
};
function indexedCatalogEntry(itemId) {
  const resolved = resolveItemAsset(itemId);
  // Classification comes from the authoritative rAthena equipment index, which
  // also covers items that have no asset-verified icon yet. Only fully unknown
  // items (no classification and no asset) are treated as absent.
  const classified =
    resolved.category === 'equipment' || resolved.equipment === true;
  if (resolved.assetStatus === 'missing' && !classified) return null;
  return {
    aegisName: resolved.aegisName ?? null,
    name: resolved.name,
    category: resolved.category ?? (classified ? 'equipment' : 'etc'),
    slots: Number(resolved.slots ?? 0),
    equipLocations: resolved.equipLocations ?? [],
  };
}
function catalogEntry(itemId) {
  return inventoryCatalog[itemId] ?? equipmentCatalog[itemId] ?? indexedCatalogEntry(itemId);
}
const noviceOnlyEquipmentIds = new Set([1243, 2112, 2352, 2414, 2510, 5055]);
const noviceEquipmentJobIds = new Set([0, 23, 4190]);
function equipmentRestriction(itemId, jobId, identified = true) {
  if (!identified) return '此裝備尚未鑑定';
  if (
    noviceOnlyEquipmentIds.has(Number(itemId)) &&
    !noviceEquipmentJobIds.has(Number(jobId))
  )
    return '限定初心者／超級初心者使用';
  return '';
}
const equipSlots = [
  [256, 'headTop'],
  [512, 'headMid'],
  [1, 'headLow'],
  [2, 'rightHand'],
  [4, 'garment'],
  [8, 'accessoryRight'],
  [16, 'armor'],
  [32, 'leftHand'],
  [64, 'shoes'],
  [128, 'accessoryLeft'],
];
function equipmentSlot(mask) {
  return (
    equipSlots.find(([bit]) => (Number(mask) & bit) !== 0)?.[1] ?? 'unknown'
  );
}
async function queryEquipment(charId) {
  const output = await sql(
    `SELECT nameid,equip,amount,refine FROM inventory WHERE char_id=${Number(charId)} AND equip<>0 ORDER BY equip,nameid;`,
  );
  if (!output) return [];
  return output.split(/\r?\n/).map((line) => {
    const row = line.split('\t'),
      itemId = Number(row[0]),
      known = equipmentCatalog[itemId] ?? indexedCatalogEntry(itemId);
    return {
      itemId,
      equipMask: Number(row[1]),
      slot: equipmentSlot(row[1]),
      amount: Number(row[2]),
      refine: Number(row[3]),
      aegisName: known?.aegisName ?? null,
      name: localizedItemName(itemId, known?.name),
    };
  });
}

async function queryEquipmentForCharacters(charIds) {
  const ids = [...new Set(charIds.map(Number).filter(Number.isSafeInteger))];
  const byCharacter = new Map(ids.map((charId) => [charId, []]));
  if (!ids.length) return byCharacter;
  const output = await sql(
    `SELECT char_id,nameid,equip,amount,refine FROM inventory WHERE char_id IN (${ids.join(',')}) AND equip<>0 ORDER BY char_id,equip,nameid;`,
  );
  if (!output) return byCharacter;
  for (const line of output.split(/\r?\n/)) {
    const row = line.split('\t');
    const charId = Number(row[0]);
    const itemId = Number(row[1]);
    const known = equipmentCatalog[itemId] ?? indexedCatalogEntry(itemId);
    byCharacter.get(charId)?.push({
      itemId,
      equipMask: Number(row[2]),
      slot: equipmentSlot(row[2]),
      amount: Number(row[3]),
      refine: Number(row[4]),
      aegisName: known?.aegisName ?? null,
      name: localizedItemName(itemId, known?.name),
    });
  }
  return byCharacter;
}
async function queryInventory(charId) {
  const output = await sql(
    `SELECT nameid,amount,equip,identify,refine,card0,card1,card2,card3 FROM inventory WHERE char_id=${Number(charId)} ORDER BY nameid;`,
  );
  if (!output) return [];
  return output.split(/\r?\n/).map((line) => {
    const row = line.split('\t'),
      itemId = Number(row[0]),
      known = catalogEntry(itemId),
      resolved = resolveItemAsset(itemId);
    return {
      itemId,
      amount: Number(row[1]),
      equipped: Number(row[2]) !== 0,
      identified: row[3] === '1',
      refine: Number(row[4]),
      slots: Number(resolved?.slots ?? 0),
      cardIds: row.slice(5, 9).map(Number).filter(Number.isFinite),
      aegisName: known?.aegisName ?? null,
      name: localizedItemName(itemId, known?.name),
      category: known?.category ?? 'etc',
    };
  });
}

function mergeLiveInventory(items, derived, jobId = 0) {
  const liveItems = derived?.inventory ?? [];
  if (!liveItems.length)
    return items.map((item) => {
      const equipRestriction = equipmentRestriction(
        item.itemId,
        jobId,
        item.identified,
      );
      return {
        ...item,
        binId: null,
        inventoryIndex: null,
        inventoryGeneration: null,
        usable: false,
        equippable: item.category === 'equipment',
        canEquip: item.category === 'equipment' && !equipRestriction,
        equipRestriction,
        mergeable: item.category === 'card',
      };
    });
  const stored = [...items];
  return liveItems.map((live) => {
    const index = stored.findIndex((item) => item.itemId === live.itemId),
      fallback = index >= 0 ? stored.splice(index, 1)[0] : null,
      known = catalogEntry(live.itemId),
      category =
        known?.category ??
        (live.mergeable
          ? 'card'
          : live.equippable
            ? 'equipment'
            : live.usable
              ? 'consumable'
              : 'etc');
    const identified = live.identified ?? fallback?.identified ?? true,
      equipRestriction = equipmentRestriction(live.itemId, jobId, identified);
    return {
      itemId: Number(live.itemId),
      itemKey: String(live.itemKey ?? ''),
      amount: Number(live.amount),
      equipped: Boolean(live.equipped),
      equipMask: Number(live.equipMask ?? 0),
      equipTarget: Number(live.equipTarget ?? 0),
      itemType: Number(live.itemType ?? -1),
      weaponType: String(live.weaponType ?? ''),
      identified,
      refine: Number(live.refine ?? fallback?.refine ?? 0),
      slots: Number(live.slotCount ?? fallback?.slots ?? 0),
      cardIds: Array.isArray(live.cardIds)
        ? live.cardIds.map((cardId) => Number(cardId)).filter(Number.isFinite)
        : fallback?.cardIds ?? [],
      aegisName: known?.aegisName ?? fallback?.aegisName ?? null,
      name: localizedItemName(
        live.itemId,
        known?.name ?? live.name ?? fallback?.name,
      ),
      category,
      binId: live.binId == null ? null : Number(live.binId),
      inventoryIndex: Number.isInteger(live.inventoryIndex)
        ? live.inventoryIndex
        : null,
      inventoryGeneration:
        live.inventoryGeneration != null
          ? Number(live.inventoryGeneration)
          : null,
      usable: Boolean(live.usable),
      equippable: Boolean(live.equippable),
      canEquip: Boolean(live.equippable) && !equipRestriction,
      equipRestriction,
      mergeable: Boolean(live.mergeable),
    };
  });
}

function liveEquipment(items) {
  return items
    .filter((item) => item.equipped && item.category === 'equipment')
    .map((item) => ({
      binId: item.binId,
      itemKey: item.itemKey,
      inventoryIndex: item.inventoryIndex ?? null,
      inventoryGeneration: item.inventoryGeneration ?? null,
      itemId: item.itemId,
      equipMask: item.equipMask,
      equipTarget: item.equipTarget,
      slot: equipmentSlot(item.equipMask || item.equipTarget),
      amount: item.amount,
      refine: item.refine,
      aegisName: item.aegisName,
      name: item.name,
    }));
}

function findInventoryEntry(entries, key, bin, index) {
  if (!Array.isArray(entries)) return null;
  if (/^[a-f0-9]+$/i.test(key))
    return entries.find((entry) => entry.itemKey === key) ?? null;
  if (Number.isInteger(index) && index >= 0)
    return entries.find((entry) => entry.inventoryIndex === index) ?? null;
  return entries.find((entry) => entry.binId === bin) ?? null;
}

async function queueItemAction(account, input) {
  const action = String(input.action ?? ''),
    binId = Number(input.binId),
    requestedItemKey = String(input.itemKey ?? ''),
    requestedIndex = Number(input.inventoryIndex),
    hasIndexIdentity = Number.isInteger(requestedIndex) && requestedIndex >= 0,
    allowed = new Set(['use', 'equip', 'unequip', 'card']);
  if (
    !allowed.has(action) ||
    (!/^[a-f0-9]+$/i.test(requestedItemKey) &&
      (!Number.isInteger(binId) || binId < 0) &&
      !hasIndexIdentity)
  )
    throw new Error('無效的道具操作');
  const id = instanceId(account.accountId),
    // For SERVER_AGENT characters the authoritative snapshot (and therefore the
    // authoritative inventory identity) comes from the read model, not from
    // OpenKore status.json.
    snapshot = await currentCharacterLiveSnapshot(account, id),
    item = findInventoryEntry(
      snapshot?.inventory,
      requestedItemKey,
      binId,
      requestedIndex,
    );
  if (!item) throw new Error('遊戲伺服器尚未同步此道具');
  const serverAgent = snapshot?.serverAgentReadModel === true;
  // P2-OPENKORE-EXIT-MAINLINE: normal production no longer writes OpenKore .cmd
  // for item actions (use/equip/unequip/card). A SERVER_AGENT snapshot uses the
  // native primitives below; a legacy OPENKORE controller is refused.
  if (!serverAgent && runtimeMode !== 'isolated-test')
    throw new HttpError(409, 'LEGACY_OPENKORE_MIGRATION_REQUIRED');
  if (action === 'card') {
    const targetBinId = Number(input.targetBinId),
      requestedTargetKey = String(input.targetItemKey ?? ''),
      requestedTargetIndex = Number(input.targetInventoryIndex),
      hasTargetIndex =
        Number.isInteger(requestedTargetIndex) && requestedTargetIndex >= 0,
      target = findInventoryEntry(
        snapshot?.inventory,
        requestedTargetKey,
        targetBinId,
        hasTargetIndex ? requestedTargetIndex : Number.NaN,
      );
    if (serverAgent) {
      // Authoritative SERVER_AGENT card insert: the card row and the target
      // equipment row are both rAthena inventory identities and the native
      // pc_insert_card path decides compatibility, slot and result.
      if (
        !Number.isInteger(item.inventoryIndex) ||
        !target ||
        !Number.isInteger(target.inventoryIndex) ||
        item.inventoryIndex === target.inventoryIndex
      )
        throw new Error('SERVER_AGENT 卡片或裝備索引不可用');
      const charId = Number(account.characterId),
        stateRow = await readAgentStateRow(charId);
      if (!stateRow) throw new Error('SERVER_AGENT 狀態不可用');
      const inventoryGeneration = Number.isSafeInteger(
        Number(input.inventoryGeneration),
      )
        ? Number(input.inventoryGeneration)
        : Number(item.inventoryGeneration ?? 0);
      return await queueOwnershipCommand(account, charId, {
        action: 'card_insert',
        expectedRevision: Number(stateRow.revision),
        commandId: input.commandId,
        cardItemId: Number(item.itemId),
        cardInventoryIndex: Number(item.inventoryIndex),
        targetItemId: Number(target.itemId),
        targetInventoryIndex: Number(target.inventoryIndex),
        inventoryGeneration,
      });
    }
    const cardDefinition = resolveItemAsset(item.itemId);
    const targetDefinition = target ? resolveItemAsset(target.itemId) : null;
    const allowedLocations = new Set(cardDefinition?.equipLocations ?? []);
    const targetLocations = targetDefinition?.equipLocations ?? [];
    const targetSlots = Number(targetDefinition?.slots ?? target?.slotCount ?? 0);
    const occupiedSlots = (target?.cardIds ?? [])
      .filter((cardId) => Number(cardId) > 0 && ![254, 255].includes(Number(cardId))).length;
    const compatibleLocation = targetLocations.some((location) => allowedLocations.has(location));
    if (
      !item.mergeable ||
      cardDefinition?.category !== 'card' ||
      !target?.equippable ||
      !compatibleLocation ||
      targetSlots <= occupiedSlots
    )
      throw new Error('卡片或裝備狀態不符');
    const itemArgument = /^[a-f0-9]+$/i.test(String(item.itemKey ?? ''))
      ? `id:${item.itemKey}`
      : String(item.binId);
    const targetArgument = /^[a-f0-9]+$/i.test(String(target.itemKey ?? ''))
      ? `id:${target.itemKey}`
      : String(target.binId);
    return await queueCharacterCommand(
      account,
      'card',
      `${itemArgument},${targetArgument}`,
      validateCharacterCommandRevision(
        input,
        snapshot,
        'inventory',
        account.characterId,
      ),
    );
  }
  if (!serverAgent && action === 'use' && !item.usable)
    throw new Error('此道具無法使用');
  const equipRestriction = equipmentRestriction(
    item.itemId,
    snapshot.jobId,
    item.identified,
  );
  if (action === 'equip' && equipRestriction) throw new Error(equipRestriction);
  if (action === 'equip' && (!item.equippable || item.equipped))
    throw new Error('此裝備目前無法穿上');
  if (action === 'unequip' && !item.equipped)
    throw new Error('此裝備目前未穿戴');
  if (serverAgent && action === 'use') {
    // Authoritative SERVER_AGENT item use: rAthena inventory index + generation,
    // executed by native pc_useitem over persistent_agent_command. Native
    // restrictions remain authoritative; the Web only names the row.
    if (!Number.isInteger(item.inventoryIndex))
      throw new Error('SERVER_AGENT 背包索引不可用');
    const charId = Number(account.characterId),
      stateRow = await readAgentStateRow(charId);
    if (!stateRow) throw new Error('SERVER_AGENT 狀態不可用');
    const inventoryGeneration = Number.isSafeInteger(
      Number(input.inventoryGeneration),
    )
      ? Number(input.inventoryGeneration)
      : Number(item.inventoryGeneration ?? 0);
    return await queueOwnershipCommand(account, charId, {
      action: 'use_item',
      expectedRevision: Number(stateRow.revision),
      commandId: input.commandId,
      itemId: Number(item.itemId),
      inventoryIndex: Number(item.inventoryIndex),
      inventoryGeneration,
    });
  }
  if (serverAgent && (action === 'equip' || action === 'unequip')) {
    // Authoritative SERVER_AGENT equipment path: rAthena inventory index +
    // generation, executed by the Persistent Agent over persistent_agent_command.
    // No OpenKore status export supplies the identity here.
    if (!Number.isInteger(item.inventoryIndex))
      throw new Error('SERVER_AGENT 背包索引不可用');
    const charId = Number(account.characterId),
      stateRow = await readAgentStateRow(charId);
    if (!stateRow) throw new Error('SERVER_AGENT 狀態不可用');
    return await queueOwnershipCommand(
      account,
      charId,
      {
        action: action === 'equip' ? 'equip_item' : 'unequip_item',
        expectedRevision: Number(stateRow.revision),
        commandId: input.commandId,
      },
      {
        itemId: Number(item.itemId),
        inventoryIndex: Number(item.inventoryIndex),
        // Preserve the caller-observed generation when supplied so the
        // map-server can reject a stale Web action; fall back to the snapshot's
        // generation (server-resolved) otherwise.
        inventoryGeneration: Number.isSafeInteger(
          Number(input.inventoryGeneration),
        )
          ? Number(input.inventoryGeneration)
          : Number(item.inventoryGeneration ?? 0),
      },
    );
  }
  const itemArgument = /^[a-f0-9]+$/i.test(String(item.itemKey ?? ''))
    ? `id:${item.itemKey}`
    : String(item.binId);
  return await queueCharacterCommand(
    account,
    action,
    itemArgument,
    validateCharacterCommandRevision(
      input,
      snapshot,
      'inventory',
      account.characterId,
    ),
  );
}

const allowedEmotionIds = new Set([
  0, 1, 2, 3, 4, 5, 7, 9, 10, 12, 14, 15, 16, 17, 20, 21, 23, 26, 28, 29, 30,
  33, 36, 45, 46,
]);
const allowedSocialChannels = new Set([
  'public',
  'private',
  'party',
  'guild',
  'clan',
  'battleground',
  'map',
  'global',
  'trade',
  'support',
  'ally',
]);
const socialTargetPattern = /^[\p{L}\p{N}_ ]{2,24}$/u;
const allowedFirstJobs = new Set([
  'swordman',
  'mage',
  'archer',
  'acolyte',
  'merchant',
  'thief',
  'supernovice',
  'taekwon',
  'gunslinger',
  'ninja',
]);
const allowedFirstJobIds = new Set([1, 2, 3, 4, 5, 6, 21, 23, 24, 25, 4046]);
const renewalStartPoints = Object.freeze([
  { map: 'iz_int', x: 18, y: 26 },
  { map: 'iz_int01', x: 18, y: 26 },
  { map: 'iz_int02', x: 18, y: 26 },
  { map: 'iz_int03', x: 18, y: 26 },
  { map: 'iz_int04', x: 18, y: 26 },
]);
async function saveFirstJobTarget(account, job) {
  if (!account.characterId) throw new Error('請先建立角色');
  if (!allowedFirstJobs.has(job)) throw new Error('無效的一轉職業');
  const output = await sql(
    `SELECT c.class,COALESCE(j.value,'') FROM \`char\` c LEFT JOIN char_reg_str j ON j.char_id=c.char_id AND j.\`key\`='terminal_target_job$' AND j.\`index\`=0 WHERE c.char_id=${Number(account.characterId)} LIMIT 1;`,
  );
  if (!output) throw new Error('角色資料不存在');
  const [classId, selected = ''] = output.split('\t');
  if (Number(classId) !== 0) throw new Error('角色已完成一轉');
  if (selected && selected !== job) throw new Error('一轉志願已鎖定');
  await sql(
    `INSERT INTO char_reg_str (char_id,\`key\`,\`index\`,value) VALUES (${Number(account.characterId)},'terminal_target_job$',0,'${escapeSql(job)}') ON DUPLICATE KEY UPDATE value=VALUES(value);`,
  );
  return job;
}
function enforceSocialRateLimit(accountId, action) {
  const key = `${accountId}:${action}`,
    now = Date.now(),
    previous = socialRateLimits.get(key) ?? 0,
    wait = action === 'voice' ? 3000 : action.startsWith('chat') ? 800 : 1100;
  if (now - previous < wait) throw new Error('訊息發送過快');
  socialRateLimits.set(key, now);
}
// P2-OPENKORE-EXIT-MAINLINE (row 35): the Persistent Agent contract has no chat
// or emotion command, so social has no native parity. Production fails closed:
// SERVER_AGENT => capability gap; legacy OPENKORE => migration required.
async function productionLegacyOrCapabilityRefusal(account, capabilityCode) {
  const charId = Number(account?.characterId);
  const controller =
    Number.isSafeInteger(charId) && charId > 0
      ? await readCharacterControllerStatus(account, charId, {
          includeFarmTarget: false,
        })
      : null;
  if (controller?.available && controller.controller === SERVER_AGENT_OWNER)
    return { status: 501, body: { error: capabilityCode, code: capabilityCode } };
  return {
    status: 409,
    body: {
      error: 'LEGACY_OPENKORE_MIGRATION_REQUIRED',
      code: 'LEGACY_OPENKORE_MIGRATION_REQUIRED',
    },
  };
}
async function queueSocialAction(account, input) {
  const id = instanceId(account.accountId),
    snapshot = await currentStatusSnapshot(id),
    session = await currentWorkerState(id);
  if (!session.running || !snapshot) throw new Error('角色目前不在線上');
  const action = String(input.action ?? '');
  let argument = '';
  if (action === 'chat') {
    const channel = String(input.channel ?? 'public'),
      message = String(input.message ?? '').trim();
    if (!allowedSocialChannels.has(channel)) throw new Error('此頻道無法使用');
    if (!message) throw new Error('訊息內容不得為空白');
    if (Array.from(message).length > 80) throw new Error('訊息最多 80 個字');
    if (/[\u0000-\u001f\u007f]/u.test(message))
      throw new Error('訊息包含不允許的控制字元');
    if (/^[@/]/u.test(message)) throw new Error('一般頻道不接受指令字首');
    if (channel === 'private') {
      const target = String(input.target ?? '').trim();
      if (!socialTargetPattern.test(target))
        throw new Error('密語對象格式不符');
      argument = `${target}\t${message}`;
    } else argument = message;
    enforceSocialRateLimit(account.accountId, `chat_${channel}`);
    return await queueCharacterCommand(account, `social_${channel}`, argument);
  } else if (action === 'emotion') {
    const emotionId = Number(input.emotionId);
    if (!Number.isInteger(emotionId) || !allowedEmotionIds.has(emotionId))
      throw new Error('無效的表情');
    argument = String(emotionId);
  } else {
    throw new Error('無效的社交操作');
  }
  enforceSocialRateLimit(account.accountId, action);
  return await queueCharacterCommand(account, `social_${action}`, argument);
}

const voiceTypes = new Map([
  ['audio/webm', 'webm'],
  ['audio/ogg', 'ogg'],
  ['audio/mp4', 'm4a'],
  ['audio/aac', 'aac'],
]);
async function appendSocialEvent(id, entry) {
  await appendFile(
    join(instancesRoot, id, 'social.jsonl'),
    `${JSON.stringify(entry)}\n`,
    'utf8',
  );
}
async function queueVoiceMessage(account, request) {
  const id = instanceId(account.accountId),
    [snapshot, session] = await Promise.all([
      currentStatusSnapshot(id),
      currentWorkerState(id),
    ]);
  if (!session.running || !snapshot) throw new Error('角色目前不在線上');
  const contentType = String(request.headers['content-type'] ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase(),
    extension = voiceTypes.get(contentType),
    durationMs = Number(request.headers['x-ro-voice-duration'] ?? 0);
  if (!extension) throw new Error('語音格式不支援');
  if (!Number.isFinite(durationMs) || durationMs < 250 || durationMs > 30000)
    throw new Error('語音長度需介於 0.25 至 30 秒');
  enforceSocialRateLimit(account.accountId, 'voice');
  const data = await requestBinary(request, 1024 * 1024);
  if (data.length < 128) throw new Error('語音內容為空白');
  const voiceId = randomUUID(),
    createdAt = Date.now(),
    target = join(voiceRoot, `${voiceId}.${extension}`);
  await writeFile(target, data, { flag: 'wx' });
  try {
    await sql(`INSERT INTO web_voice_messages (voice_id,account_id,char_id,map_name,mime_type,file_ext,byte_size,duration_ms,created_at)
      VALUES ('${voiceId}',${account.accountId},${account.characterId},'${escapeSql(snapshot.map)}','${escapeSql(contentType)}','${extension}',${data.length},${Math.round(durationMs)},${createdAt});`);
  } catch (error) {
    await unlink(target).catch(() => {});
    throw error;
  }
  const event = {
    at: createdAt,
    type: 'voice',
    channel: 'public',
    sender: snapshot.name || account.characterName,
    message: '語音訊息',
    map: snapshot.map,
    voiceId,
    mime: contentType,
    durationMs: Math.round(durationMs),
  };
  const folders = (
    await readdir(instancesRoot, { withFileTypes: true })
  ).filter((entry) => entry.isDirectory() && entry.name.startsWith('player_'));
  const recipients = new Set([id]);
  await Promise.all(
    folders.map(async (folder) => {
      const recipient = await currentStatusSnapshot(folder.name);
      if (recipient?.map === snapshot.map) recipients.add(folder.name);
    }),
  );
  await Promise.all(
    [...recipients].map((recipient) => appendSocialEvent(recipient, event)),
  );
  return { accepted: true, voiceId, recipients: recipients.size };
}

// P2I: never turn a SERVER_AGENT character into a legacy OpenKore worker. When a
// Web quest action has no native SERVER_AGENT path yet, fail explicitly with a
// bounded code so the gap stays visible instead of silently regressing.
async function assertNotServerAgentOpenKoreFallback(account, charId, code) {
  const controller = await readCharacterControllerStatus(account, charId, {
    includeFarmTarget: false,
  });
  if (controller.available && controller.controller === SERVER_AGENT_OWNER)
    throw new HttpError(501, code);
  if (
    !controller.available &&
    controller.unavailableReason === 'agent_status_unavailable'
  )
    throw new HttpError(503, '系統狀態暫時無法讀取，已停止操作以保護角色');
}

async function queueJobChangeAction(account, input) {
  const action = String(input.action ?? ''),
    job = String(input.job ?? ''),
    id = instanceId(account.accountId),
    // SERVER_AGENT characters have no OpenKore status.json; their authoritative
    // snapshot comes from the Persistent Agent read model. OpenKore characters
    // still resolve through status.json first (unchanged legacy path).
    snapshot = await currentCharacterLiveSnapshot(account, id);
  if (!snapshot) throw new Error('角色目前不在線上');
  const charId = Number(account.characterId);
  if (
    !['route', 'talk', 'next', 'select', 'close', 'resume'].includes(action)
  )
    throw new Error('無效的轉職操作');
  // Content and eligibility rules are shared by both transports. They are
  // checked before controller routing so a SERVER_AGENT character can never
  // bypass the first-job policy or the creation-time job lock.
  if (action === 'route' || action === 'talk') {
    if (!allowedFirstJobs.has(job)) throw new Error('無效的一轉職業');
    if (!account.targetJob || account.targetJob !== job)
      throw new Error('只能進行創角時選定的職業訓練');
    if (
      Number(snapshot.jobId) !== 0 ||
      Number(snapshot.jobLevel) < 10 ||
      Number(snapshot.basicSkillLevel) < 9
    )
      throw new Error('角色尚未符合一轉資格');
    if (job === 'supernovice' && Number(snapshot.baseLevel) < 45)
      throw new Error('超級初心者需要 Base Lv.45');
  }
  let choice = 0;
  if (action === 'select') {
    choice = Number(input.choice);
    if (!Number.isInteger(choice) || choice < 1 || choice > 20)
      throw new Error('無效的 NPC 選項');
  }

  // P2I controller routing. Both first-job route/talk content and resume
  // targets are canonical Quest Runtime content; a SERVER_AGENT character runs
  // them through native navigation/dialog primitives. A SERVER_AGENT character
  // is never silently turned into an OpenKore worker, and an unreadable agent
  // status fails closed. OPENKORE-controlled characters keep the legacy path.
  const controller = await readCharacterControllerStatus(account, charId, {
    includeFarmTarget: false,
  });
  if (controller.available && controller.controller === SERVER_AGENT_OWNER)
    return await queueServerAgentJobChange(account, {
      action,
      job,
      choice,
      snapshot,
    });
  if (
    !controller.available &&
    controller.unavailableReason === 'agent_status_unavailable'
  )
    throw new HttpError(503, '系統狀態暫時無法讀取，已停止操作以保護角色');

  // P2-OPENKORE-EXIT-MAINLINE: normal production no longer writes OpenKore .cmd
  // for first-job NPC route/talk/dialog. Legacy OPENKORE controllers get a
  // migration-required refusal; only isolated/closed-test diagnostics may use it.
  if (runtimeMode !== 'isolated-test')
    throw new HttpError(409, 'LEGACY_OPENKORE_MIGRATION_REQUIRED');
  if (action === 'route' || action === 'talk')
    return await queueCharacterCommand(
      account,
      action === 'route' ? 'job_route' : 'job_talk',
      job,
    );
  if (action === 'next')
    return await queueCharacterCommand(account, 'npc_next', '1');
  if (action === 'select')
    return await queueCharacterCommand(account, 'npc_select', String(choice));
  if (action === 'close')
    return await queueCharacterCommand(account, 'npc_close', '1');
  return await queueCharacterCommand(account, 'job_resume', '1');
}

// Native first-job route/talk/resume. Only canonical content is used: the Web
// never supplies coordinates or a job-specific Persistent Agent action. The
// academy dialog is driven by the same generic dialog primitives the P2H bridge
// already uses, so the graduation select (and therefore `jobchange`) remains a
// manual player decision inside the native NPC script.
async function queueServerAgentJobChange(account, { action, job, choice, snapshot }) {
  const charId = Number(account.characterId);
  const academy = firstJobContent.academy;
  const stateRow = await readAgentStateRow(charId);
  if (!stateRow) throw new HttpError(409, 'agent_state_unavailable');
  const expectedRevision = Number(stateRow.revision);
  if (action === 'route') {
    const route = firstJobRoute(firstJobContent, job);
    // The real Web-create start maps are iz_int/iz_int01..04, but the academy is
    // iz_ac01. Resolve the legitimate cross-map walk from the character's
    // authoritative current position through the canonical rAthena warp graph;
    // only a character already on the academy map uses the single arrival step.
    const currentMap = String(snapshot?.map ?? '').trim();
    if (!currentMap) throw new HttpError(409, 'agent_position_unavailable');
    let routeSteps;
    let policy = 'DIRECT';
    if (currentMap === route.map) {
      routeSteps = firstJobNavigationRoute(route);
    } else {
      const plan = planWebRelocation(
        await serverAgentWarpGraph(),
        currentMap,
        route.map,
      );
      if (!plan.route) throw new HttpError(409, plan.reason ?? 'route_unavailable');
      routeSteps = plan.route;
      policy = plan.policy;
    }
    const command = await queueOwnershipCommand(account, charId, {
      action: 'start_navigation',
      route: routeSteps,
      expectedRevision,
    });
    return {
      executor: 'SERVER_AGENT',
      source: 'persistent_agent',
      action,
      job,
      policy,
      fromMap: currentMap,
      destination: { map: route.map, x: route.x, y: route.y },
      command: command.commandId,
    };
  }
  if (action === 'resume') {
    const target = firstJobResumeTarget(
      firstJobContent,
      Number(snapshot.baseLevel),
    );
    const command = await queueOwnershipCommand(account, charId, {
      action: 'start_navigation',
      route: firstJobNavigationRoute(target),
      expectedRevision,
    });
    return {
      executor: 'SERVER_AGENT',
      source: 'persistent_agent',
      action,
      destination: { map: target.map, x: target.x, y: target.y },
      command: command.commandId,
    };
  }
  if (action === 'talk') {
    const command = await queueOwnershipCommand(account, charId, {
      action: 'talk_to_npc',
      npcName: academy.identity,
      targetMap: academy.map,
      goal: 'dialog',
      expectedRevision,
    });
    return {
      executor: 'SERVER_AGENT',
      source: 'persistent_agent',
      action,
      npcName: academy.identity,
      command: command.commandId,
    };
  }
  if (action === 'select') {
    const command = await queueOwnershipCommand(account, charId, {
      action: 'dialog_select',
      index: choice,
      expectedRevision,
    });
    return {
      executor: 'SERVER_AGENT',
      source: 'persistent_agent',
      action,
      index: choice,
      command: command.commandId,
    };
  }
  const command = await queueOwnershipCommand(account, charId, {
    action: action === 'next' ? 'dialog_next' : 'dialog_close',
    expectedRevision,
  });
  return {
    executor: 'SERVER_AGENT',
    source: 'persistent_agent',
    action,
    command: command.commandId,
  };
}
// Project onboarding forward transition. The Web expresses onboarding intent
// only; the native bound command `terminal_onboarding_advance` owns the
// authoritative relocation and the onboarding checkpoint. SERVER_AGENT only.
async function queueOnboardingAdvance(account) {
  if (!account.characterId) throw new Error('請先建立角色');
  const charId = Number(account.characterId);
  const [character, progress, payload, sequenceProjection] = await Promise.all([
    queryCharacter(account.accountId),
    queryOnboardingProgress(charId),
    Promise.resolve().then(() => noviceOnboardingPayload()),
    readQuestSequenceProjection(charId),
  ]);
  if (!character) throw new Error('找不到角色');
  if (Number(character.classId) !== 0 || progress.graduated)
    throw new HttpError(409, 'already_completed');
  const controller = await readCharacterControllerStatus(account, charId, {
    includeFarmTarget: false,
  });
  if (!controller.available || controller.controller !== SERVER_AGENT_OWNER)
    throw new HttpError(409, 'server_agent_required');
  const stateRow = await readAgentStateRow(charId);
  if (!stateRow) throw new HttpError(409, 'agent_state_unavailable');
  const checkpoint = sequenceProjection.available
    ? sequenceProjection.checkpoint
    : null;
  if (checkpoint?.sequenceId === payload.sequenceId)
    return {
      executor: 'SERVER_AGENT',
      source: 'persistent_agent',
      resumed: true,
      checkpoint: checkpoint.status,
      sequenceId: payload.sequenceId,
      revision: stateRow.revision,
    };
  const liveStatus = controller.liveStatus;
  const authoritativeMap = liveStatus?.fresh && liveStatus.map
    ? String(controller.liveStatus.map)
    : '';
  const authoritativeX = liveStatus?.fresh ? Number(liveStatus.x) : null;
  const authoritativeY = liveStatus?.fresh ? Number(liveStatus.y) : null;
  const spawnEntry = resolveNoviceSpawnEntry({
    spawnMap: authoritativeMap,
    sequenceId: payload.sequenceId,
    s00StepIndex: 0,
    s00Map: payload.steps[0]?.map,
  });
  if (spawnEntry.status !== 'PASS')
    throw new HttpError(409, 'novice_spawn_unsupported');
  const normalization = decideNormalizationAction({
    authoritativeMap,
    spawnX: authoritativeX,
    spawnY: authoritativeY,
    sequenceId: payload.sequenceId,
    s00StepIndex: 0,
    s00Map: payload.steps[0]?.map,
  });
  if (normalization.action === 'FAIL_CLOSED')
    throw new HttpError(409, 'novice_spawn_unsupported');
  if (normalization.action === 'WAIT_FOR_MAP')
    return {
      executor: 'SERVER_AGENT',
      source: 'persistent_agent',
      normalization: 'WAIT_FOR_MAP',
      normalizationMap: 'iz_int',
      authoritativeMap,
      sequenceId: payload.sequenceId,
      revision: stateRow.revision,
    };
  if (
    controller.agentMode === 'AUTO_QUEST' &&
    controller.targetRules?.sequenceId === payload.sequenceId
  )
    return {
      executor: 'SERVER_AGENT',
      source: 'persistent_agent',
      resumed: true,
      sequenceId: payload.sequenceId,
      revision: stateRow.revision,
    };
  if (normalization.action === 'S00') {
    const existingSequence = await readLatestNoviceCommand(
      charId,
      'start_quest_sequence',
    );
    if (
      existingSequence?.payload?.sequenceId === payload.sequenceId &&
      commandStatusIsLive(existingSequence)
    )
      return {
        executor: 'SERVER_AGENT',
        source: 'persistent_agent',
        resumed: true,
        sequenceId: payload.sequenceId,
        command: existingSequence.commandId,
        revision: stateRow.revision,
      };
    if (
      existingSequence?.payload?.sequenceId === payload.sequenceId &&
      existingSequence.status !== 'REJECTED'
    )
      throw new HttpError(409, 'command_rejected');
    if (controller.agentMode !== 'PERSISTENT_IDLE')
      throw new HttpError(409, 'command_rejected');
    const command = await queueOwnershipCommand(account, charId, {
      action: 'start_quest_sequence',
      taskId: payload.taskId,
      sequenceId: payload.sequenceId,
      steps: payload.steps,
      expectedRevision: Number(stateRow.revision),
    });
    return {
      executor: 'SERVER_AGENT',
      source: 'persistent_agent',
      sequenceId: payload.sequenceId,
      command: command.commandId,
    };
  }
  if (controller.agentMode !== 'PERSISTENT_IDLE')
    throw new HttpError(409, 'command_rejected');
  const route = normalization.route;
  const existingNavigation = await readLatestNoviceCommand(
    charId,
    'start_navigation',
  );
  const existingRoute = existingNavigation?.payload?.route;
  const sameRoute = JSON.stringify(existingRoute) === JSON.stringify(route);
  if (sameRoute && commandStatusIsLive(existingNavigation))
    return {
      executor: 'SERVER_AGENT',
      source: 'persistent_agent',
      normalization:
        normalization.action === 'SECOND_LEG'
          ? 'SECOND_LEG_ALREADY_QUEUED'
          : 'FIRST_LEG_ALREADY_QUEUED',
      normalizationMap: 'iz_int',
      authoritativeMap,
      sequenceId: payload.sequenceId,
      command: existingNavigation.commandId,
      revision: stateRow.revision,
    };
  if (sameRoute && existingNavigation.status !== 'REJECTED')
    throw new HttpError(409, 'command_rejected');
  if (sameRoute && existingNavigation.status === 'REJECTED')
    throw new HttpError(409, 'command_rejected');
  if (normalization.action === 'FIRST_LEG' || normalization.action === 'SECOND_LEG') {
    const navigation = await queueOwnershipCommand(account, charId, {
      action: 'start_navigation',
      route,
      expectedRevision: Number(stateRow.revision),
    });
    return {
      executor: 'SERVER_AGENT',
      source: 'persistent_agent',
      normalization:
        normalization.action === 'SECOND_LEG'
          ? 'SECOND_LEG_QUEUED'
          : 'FIRST_LEG_QUEUED',
      normalizationMap: 'iz_int',
      authoritativeMap,
      sequenceId: payload.sequenceId,
      command: navigation.commandId,
    };
  }
  throw new HttpError(409, 'novice_spawn_unsupported');
}

// Fresh SERVER_AGENT Novices must continue onboarding after a navigation
// command arrives. The native runtime owns movement and map authority; this
// reconciliation only re-evaluates the existing idempotent Web transition.
const noviceOnboardingReconcileRunning = new Set();

async function reconcileNoviceOnboarding() {
  if (isolatedTestMode) return;
  let rows;
  try {
    rows = await sql(
      "SELECT s.char_id,s.account_id FROM persistent_agent_state s JOIN `char` c ON c.char_id=s.char_id LEFT JOIN char_reg_str j ON j.char_id=c.char_id AND j.`key`='terminal_target_job$' AND j.`index`=0 WHERE s.control_owner='SERVER_AGENT' AND s.ownership_state='SERVER_AGENT' AND s.agent_enabled=1 AND s.agent_mode='PERSISTENT_IDLE' AND c.class=0 AND COALESCE(j.value,'')<>'';",
    );
  } catch (error) {
    if (agentStateSchemaUnavailable(error)) return;
    throw error;
  }
  for (const line of String(rows ?? '').split(/\r?\n/)) {
    if (!line) continue;
    const [charIdText, accountIdText] = line.split('\t');
    const charId = Number(charIdText);
    const accountId = Number(accountIdText);
    if (!Number.isSafeInteger(charId) || charId <= 0 ||
        !Number.isSafeInteger(accountId) || accountId <= 0 ||
        noviceOnboardingReconcileRunning.has(charId))
      continue;
    noviceOnboardingReconcileRunning.add(charId);
    try {
      await queueOnboardingAdvance({ accountId, characterId: charId });
    } catch (error) {
      // Eligibility and in-flight command states are expected while the
      // authoritative runtime is moving. The next bounded tick retries.
      if (!(error instanceof HttpError) ||
          !['already_completed', 'server_agent_required', 'agent_state_unavailable',
            'command_rejected', 'novice_spawn_unsupported'].includes(error.message))
        console.warn(`NOVICE_ONBOARDING_RECONCILE_FAILED: ${error?.message ?? error}`);
    } finally {
      noviceOnboardingReconcileRunning.delete(charId);
    }
  }
}

// Authoritative auto first-job graduation. Same protected native command path as
// advance: the Web only expresses intent; the bound rAthena NPC command owns the
// `jobchange` and the terminal_target_job$ mapping. Idempotent by native state.
async function queueOnboardingGraduate(account) {
  if (!account.characterId) throw new Error('請先建立角色');
  const charId = Number(account.characterId);
  const [character, progress] = await Promise.all([
    queryCharacter(account.accountId),
    queryOnboardingProgress(charId),
  ]);
  if (!character) throw new Error('找不到角色');
  if (Number(character.classId) !== 0 || progress.graduated)
    throw new HttpError(409, 'already_completed');
  const controller = await readCharacterControllerStatus(account, charId, {
    includeFarmTarget: false,
  });
  if (!controller.available || controller.controller !== SERVER_AGENT_OWNER)
    throw new HttpError(409, 'server_agent_required');
  const stateRow = await readAgentStateRow(charId);
  if (!stateRow) throw new HttpError(409, 'agent_state_unavailable');
  const command = await queueOwnershipCommand(account, charId, {
    action: 'run_server_command',
    command: 'terminal_academy_graduate',
    expectedRevision: Number(stateRow.revision),
  });
  return {
    executor: 'SERVER_AGENT',
    source: 'persistent_agent',
    command: command.commandId,
  };
}

async function queueOnboardingResume(account, questId) {
  if (!account.characterId) throw new Error('請先建立角色');
  const [character, progress] = await Promise.all([
    queryCharacter(account.accountId),
    queryOnboardingProgress(account.characterId),
  ]);
  if (!character) throw new Error('找不到角色');
  const questIndex = progress.quests.findIndex(
    (entry) => String(entry.id) === String(questId),
  );
  if (questIndex < 0) throw new HttpError(409, 'not_available');
  if (progress.quests[questIndex].status === 'complete')
    throw new HttpError(409, 'already_completed');
  const currentQuestIndex = progress.quests.findIndex(
    (entry) => entry.status !== 'complete',
  );
  if (questIndex !== currentQuestIndex)
    throw new HttpError(409, 'prerequisite_incomplete');
  if (Number(character.classId) !== 0 || progress.graduated)
    throw new Error('新生訓練已結束，無法再次傳送或領取獎勵');

  // P2I native onboarding resume. The official resume relocation is already a
  // bound rAthena NPC command (`terminal_onboarding_resume`); the SERVER_AGENT
  // runs it directly through the generic server-command primitive. The bound
  // script alone decides the real checkpoint from authoritative quest state.
  const onboardingCharId = Number(account.characterId);
  const controller = await readCharacterControllerStatus(account, onboardingCharId, {
    includeFarmTarget: false,
  });
  if (controller.available && controller.controller === SERVER_AGENT_OWNER) {
    const stateRow = await readAgentStateRow(onboardingCharId);
    if (!stateRow) throw new HttpError(409, 'agent_state_unavailable');
    return {
      executor: 'SERVER_AGENT',
      source: 'persistent_agent',
      command: await queueOwnershipCommand(account, onboardingCharId, {
        action: 'run_server_command',
        command: 'terminal_onboarding_resume',
        expectedRevision: Number(stateRow.revision),
      }),
    };
  }
  if (
    !controller.available &&
    controller.unavailableReason === 'agent_status_unavailable'
  )
    throw new HttpError(503, '系統狀態暫時無法讀取，已停止操作以保護角色');

  await setAutomationIntent(account.accountId, true);
  const id = instanceId(account.accountId);
  const session = await currentWorkerState(id);
  if (!session.running) await startWorker(account);

  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const [live, worker] = await Promise.all([
      currentStatusSnapshot(id),
      currentWorkerState(id),
    ]);
    if (worker.running && live) {
      if (Number(live.jobId) !== 0) throw new Error('新生訓練已結束');
      return await queueCharacterCommand(account, 'onboarding_resume', '1');
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('角色連線逾時，請再試一次');
}
// Stable ASCII identity for the native Eden membership NPC. The upstream
// rAthena script name `Secretary Lime Evenor` contains spaces/sprites that the
// Persistent Agent dialog payload does not accept, so the content layer binds a
// duplicate() alias at the same cell instead of relaxing the payload contract.
const EDEN_SECRETARY_NPC = 'terminal_eden_secretary';
const EDEN_SECRETARY_MAP = 'moc_para01';

async function queueEdenEnrollment(account) {
  if (!account.characterId) throw new Error('請先建立角色');
  const character = await queryCharacter(account.accountId);
  if (!character) throw new Error('找不到角色');
  if (Number(character.classId) === 0)
    throw new Error('請先完成一轉，再加入伊甸園');
  const progress = await queryEdenProgress(
    account.characterId,
    character.baseLevel,
  );
  if (progress.member) throw new Error('角色已經是伊甸園成員');
  const charId = Number(account.characterId);
  // P2I controller routing. SERVER_AGENT characters open the real Lime Evenor
  // membership script through the native dialog bridge; the script alone grants
  // the Eden Group Mark. A SERVER_AGENT character is never silently turned into
  // an OpenKore worker, and an unreadable agent status fails closed.
  const controller = await readCharacterControllerStatus(account, charId, {
    includeFarmTarget: false,
  });
  if (controller.available && controller.controller === SERVER_AGENT_OWNER) {
    const stateRow = await readAgentStateRow(charId);
    if (!stateRow) throw new HttpError(409, 'agent_state_unavailable');
    const command = await queueOwnershipCommand(account, charId, {
      action: 'talk_to_npc',
      npcName: EDEN_SECRETARY_NPC,
      targetMap: EDEN_SECRETARY_MAP,
      goal: 'dialog',
      expectedRevision: Number(stateRow.revision),
    });
    return {
      executor: 'SERVER_AGENT',
      source: 'persistent_agent',
      action: 'eden_enroll',
      npcName: EDEN_SECRETARY_NPC,
      command: command.commandId,
    };
  }
  if (
    !controller.available &&
    controller.unavailableReason === 'agent_status_unavailable'
  )
    throw new HttpError(503, '系統狀態暫時無法讀取，已停止操作以保護角色');

  await setAutomationIntent(account.accountId, true);
  const id = instanceId(account.accountId);
  const session = await currentWorkerState(id);
  if (!session.running) await startWorker(account);

  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const [live, worker] = await Promise.all([
      currentStatusSnapshot(id),
      currentWorkerState(id),
    ]);
    if (worker.running && live) {
      if (Number(live.jobId) === 0)
        throw new Error('請先完成一轉，再加入伊甸園');
      return await queueCharacterCommand(account, 'eden_join', '1');
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('角色連線逾時，請再試一次');
}

function claimTaskCommandLock(accountId, charId = 0) {
  const key = Number(accountId),
    now = Date.now(),
    activeUntil = Number(taskCommandLocks.get(key) || 0);
  if (activeUntil > now) {
    void recordRolloutEvent(sql, {
      accountId: key,
      charId: Number(charId),
      eventType: 'DUPLICATE_COMMAND_REJECTED',
      errorCode: 'command_rejected',
    }).catch(() => {});
    throw new HttpError(409, 'command_rejected');
  }
  taskCommandLocks.set(key, now + 5000);
  return () => taskCommandLocks.delete(key);
}

async function queueEdenTask(account, taskId) {
  if (!account.characterId) throw new Error('請先建立角色');
  const releaseLock = claimTaskCommandLock(account.accountId, account.characterId);
  let queued = false;
  try {
    if (!edenMilestones.some((milestone) => milestone.id === taskId))
      throw new HttpError(409, 'not_available');
    if (!['member', 'equipment12', 'equipment26', 'equipment40'].includes(taskId))
      throw new HttpError(409, 'not_available');

    if (taskId === 'equipment12') {
      const gate = await readEdenCourseARollout(
        sql,
        account.accountId,
        Number(account.characterId),
      );
      if (!gate.allowed) {
        await recordRolloutEvent(sql, {
          accountId: account.accountId,
          charId: Number(account.characterId),
          eventType: 'ROLLOUT_REJECTED',
          errorCode: gate.reason,
        });
        throw new HttpError(403, gate.reason);
      }
    }

    const character = await queryCharacter(account.accountId);
    if (!character) throw new Error('找不到角色');
    const progress = await queryEdenProgress(
      account.characterId,
      character.baseLevel,
    );
    if (taskId === 'member') {
      if (progress.member) throw new HttpError(409, 'already_completed');
      queued = true;
      return await queueEdenEnrollment(account);
    }

    const isEquipment26 = taskId === 'equipment26';
    const isEquipment40 = taskId === 'equipment40';
    if (
      (isEquipment40 &&
        (progress.rewardComplete40 || progress.trainingStage >= 38)) ||
      (isEquipment26 &&
        (progress.rewardComplete26 || progress.trainingStage >= 23)) ||
      (!isEquipment26 && !isEquipment40 &&
        (progress.rewardComplete || progress.trainingStage >= 12))
    )
      throw new HttpError(409, 'already_completed');
    if (!progress.member)
      throw new HttpError(409, 'prerequisite_incomplete');
    if (Number(character.baseLevel) < (isEquipment40 ? 40 : isEquipment26 ? 26 : 12))
      throw new HttpError(409, 'prerequisite_incomplete');
    if (
      (isEquipment40 &&
        ![23, 24, 25, 26, 27, 28, 37].includes(progress.trainingStage)) ||
      (isEquipment26 &&
        ![0, 12, 13, 14, 15, 16, 22].includes(progress.trainingStage)) ||
      (!isEquipment26 && !isEquipment40 &&
        ![0, 1, 2, 3, 4, 5, 11].includes(progress.trainingStage))
    )
      throw new HttpError(409, 'not_available');

    const inventoryOutput = await sql(
      `SELECT c.inventory_slots,COUNT(i.id) FROM \`char\` c LEFT JOIN inventory i ON i.char_id=c.char_id WHERE c.char_id=${Number(account.characterId)} GROUP BY c.char_id,c.inventory_slots;`,
    );
    const [inventorySlots, inventoryCount] = inventoryOutput
      .split('\t')
      .map(Number);
    const requiredSlots = isEquipment40
      ? edenEquipment40Rewards.length + 1
      : isEquipment26
        ? edenEquipment26Rewards.length
        : edenEquipment12Rewards.length;
    if (inventorySlots - inventoryCount < requiredSlots)
      throw new HttpError(409, 'inventory_full');

    const ownership = await getOwnershipStatusOrNull(
      account,
      Number(account.characterId),
    );
    if (taskId === 'equipment12' && ownership) {
      if (
        ownership.owner === 'OPENKORE' &&
        ownership.ownershipState === 'OPENKORE'
      ) {
        queued = true;
        return {
          executor: 'SERVER_AGENT',
          ownershipTransition: 'CLAIMING_AGENT',
          command: await queueOwnershipCommand(
            account,
            Number(account.characterId),
            {
              action: 'claim_agent',
              expectedRevision: ownership.revision,
            },
          ),
        };
      }
      if (
        ownership.owner !== 'SERVER_AGENT' ||
        ownership.ownershipState !== 'SERVER_AGENT'
      )
        throw new HttpError(409, 'ownership_conflict');
      if (
        ownership.agentMode === 'AUTO_QUEST' &&
        ownership.targetRules?.sequenceId === edenCourseASequence.sequenceId
      ) {
        queued = true;
        return {
          executor: 'SERVER_AGENT',
          resumed: true,
          revision: ownership.revision,
        };
      }
      if (ownership.agentMode !== 'PERSISTENT_IDLE')
        throw new HttpError(409, 'command_rejected');
      queued = true;
      return {
        executor: 'SERVER_AGENT',
        command: await queueOwnershipCommand(
          account,
          Number(account.characterId),
          {
            action: 'start_quest_sequence',
            taskId: edenCourseASequence.taskId,
            sequenceId: edenCourseASequence.sequenceId,
            steps: edenCourseASequence.steps,
            expectedRevision: ownership.revision,
          },
        ),
      };
    }

    await assertNotServerAgentOpenKoreFallback(
      account,
      Number(account.characterId),
      'eden_native_transport_unavailable',
    );
    await setAutomationIntent(account.accountId, true);
    const id = instanceId(account.accountId);
    const session = await currentWorkerState(id);
    if (!session.running) await startWorker(account);

    const deadline = Date.now() + 25_000;
    while (Date.now() < deadline) {
      const [live, worker] = await Promise.all([
        currentStatusSnapshot(id),
        currentWorkerState(id),
      ]);
      if (worker.running && live) {
        if (live.onboarding?.active || live.edenJourney?.active)
          throw new HttpError(409, 'command_rejected');
        queued = true;
        return await queueCharacterCommand(
          account,
          isEquipment40
            ? 'eden_equipment40'
            : isEquipment26
              ? 'eden_equipment26'
              : 'eden_equipment12',
          String(
            (isEquipment26 && progress.trainingStage === 12) ||
              (isEquipment40 && progress.trainingStage === 23)
              ? 0
              : progress.trainingStage,
          ),
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('角色連線逾時，請再試一次');
  } finally {
    if (!queued) releaseLock();
  }
}
async function readSocialEvents(id, fallbackSender = '') {
  let text = '';
  try {
    text = await readFile(join(instancesRoot, id, 'social.jsonl'), 'utf8');
  } catch {
    return [];
  }
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        const entry = JSON.parse(line);
        if (/^\?+$/u.test(entry?.sender ?? '') && fallbackSender)
          entry.sender = fallbackSender;
        return entry;
      } catch {
        return null;
      }
    })
    .filter(
      (entry) =>
        entry &&
        Number.isFinite(entry.at) &&
        ['chat', 'emotion', 'voice', 'system', 'error'].includes(entry.type) &&
        typeof entry.sender === 'string' &&
        (entry.type !== 'emotion' || entry.sender !== '未知角色') &&
        typeof entry.message === 'string' &&
        !(
          entry.type === 'chat' &&
          /^@web_[a-z0-9_]+(?:\s.*)?$/iu.test(entry.message.trim())
        ),
    );
}

async function socialEventRevision(id) {
  try {
    const metadata = await stat(join(instancesRoot, id, 'social.jsonl'));
    return `${metadata.size}:${Math.trunc(metadata.mtimeMs)}`;
  } catch {
    return 'missing';
  }
}

const baseStats = new Set(['str', 'agi', 'vit', 'int', 'dex', 'luk']);
const statCommandConfirmationTimeoutMs = 5_000;
const statCommandResultCacheMs = 60_000;
function statusPointCost(value) {
  return value < 100
    ? 2 + Math.floor((value - 1) / 10)
    : 16 + 4 * Math.floor((value - 100) / 5);
}
function spentStatusPoints(character) {
  let total = 0;
  for (const statName of baseStats)
    for (let value = 1; value < Number(character[statName]); value++)
      total += statusPointCost(value);
  return total;
}
function validateCharacterCommandRevision(
  input,
  snapshot,
  domain,
  characterId,
) {
  const commandId = String(input?.commandId ?? '').toLowerCase();
  if (commandId && !commandIdPattern.test(commandId))
    throw new HttpError(400, 'commandId 格式不符');
  if (
    input?.characterId !== undefined &&
    Number(input.characterId) !== Number(characterId)
  )
    throw new HttpError(409, '角色識別已更新，請重試操作');
  if (input?.expectedRevision !== undefined) {
    const expectedRevision = Number(input.expectedRevision),
      currentRevision = Number(snapshot?.domainRevisions?.[domain]);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
      throw new HttpError(400, 'expectedRevision 格式不符');
    if (!Number.isSafeInteger(currentRevision))
      throw new HttpError(409, '角色 revision 尚未同步');
    if (expectedRevision !== currentRevision)
      throw new HttpError(409, '角色狀態已更新，請重試操作');
  }
  return {
    commandId: commandId || randomUUID(),
    expectedRevision:
      input?.expectedRevision === undefined
        ? null
        : Number(input.expectedRevision),
    domain,
  };
}
function statDomainFingerprint(snapshot) {
  if (!snapshot) return undefined;
  return [...baseStats, 'statusPoint']
    .map((field) => Number(snapshot[field] ?? 0))
    .join('|');
}
function statDomainState(characterId, snapshot) {
  if (!snapshot) return null;
  const key = Number(characterId),
    fingerprint = statDomainFingerprint(snapshot),
    observedAt = Number(snapshot.updatedAt ?? 0),
    previous = statDomainRevisionState.get(key);
  if (previous && observedAt < previous.observedAt) return previous.state;
  const revision = previous
      ? previous.fingerprint === fingerprint
        ? previous.revision
        : previous.revision + 1
      : 1,
    state = Object.freeze({
      str: Number(snapshot.str ?? 0),
      agi: Number(snapshot.agi ?? 0),
      vit: Number(snapshot.vit ?? 0),
      int: Number(snapshot.int ?? 0),
      dex: Number(snapshot.dex ?? 0),
      luk: Number(snapshot.luk ?? 0),
      remainingStatPoints: Number(snapshot.statusPoint ?? 0),
      statRevision: revision,
    });
  statDomainRevisionState.set(key, {
    fingerprint,
    observedAt: Math.max(observedAt, Number(previous?.observedAt ?? 0)),
    revision,
    state,
  });
  return state;
}
function withStatDomainSnapshot(characterId, snapshot) {
  if (!snapshot) return null;
  const state = statDomainState(characterId, snapshot);
  return {
    ...snapshot,
    str: state.str,
    agi: state.agi,
    vit: state.vit,
    int: state.int,
    dex: state.dex,
    luk: state.luk,
    statusPoint: state.remainingStatPoints,
    includedDomains: [
      ...new Set([...(snapshot.includedDomains ?? []), 'stat']),
    ],
    domainRevisions: {
      ...(snapshot.domainRevisions ?? {}),
      stat: state.statRevision,
    },
  };
}
function statResultCacheKey(characterId, commandId) {
  return `${Number(characterId)}:${commandId}`;
}
function cachedStatCommandResult(characterId, commandId) {
  const key = statResultCacheKey(characterId, commandId),
    cached = statCommandResultCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.at > statCommandResultCacheMs) {
    statCommandResultCache.delete(key);
    return null;
  }
  return cached.result;
}
function rememberStatCommandResult(characterId, commandId, result) {
  statCommandResultCache.set(statResultCacheKey(characterId, commandId), {
    at: Date.now(),
    result,
  });
  return result;
}
async function withStatCommandLock(characterId, operation) {
  const key = Number(characterId),
    prior = statCommandLocks.get(key) ?? Promise.resolve(),
    current = prior.catch(() => {}).then(operation);
  statCommandLocks.set(key, current);
  try {
    return await current;
  } finally {
    if (statCommandLocks.get(key) === current) statCommandLocks.delete(key);
  }
}
async function waitForCharacterCommandResult() {
  // C4: the `.result` filesystem transport has been removed. Command outcomes
  // are confirmed through the canonical persistent_agent_command queue
  // (getOwnershipCommand), never through a file.
  return null;
}
async function waitForStatDomainChange(
  account,
  statName,
  beforeValue,
  maximumRemainingPoints,
  beforeRevision,
) {
  const id = instanceId(account.accountId),
    deadline = Date.now() + statCommandConfirmationTimeoutMs;
  while (Date.now() < deadline) {
    const snapshot = await currentStatusSnapshot(id, 10_000),
      state = statDomainState(account.characterId, snapshot);
    if (
      state &&
      state.statRevision > beforeRevision &&
      state[statName] > beforeValue &&
      state.remainingStatPoints <= maximumRemainingPoints
    )
      return state;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  return null;
}
function rejectedStatResult(commandId, statName, reason, state) {
  return {
    commandId,
    stat: statName,
    newValue: Number(state?.[statName] ?? 0),
    remainingStatPoints: Number(state?.remainingStatPoints ?? 0),
    statRevision: Number(state?.statRevision ?? 0),
    accepted: false,
    rejected: true,
    reason,
    statState: state,
  };
}
async function queueCharacterCommand() {
  // C4 / CMD_RESULT_TRANSPORT_PRODUCTION_REACHABLE = NO: the OpenKore
  // `.cmd`/`.result` filesystem transport has been physically removed from the
  // production Web backend. SERVER_AGENT uses `persistent_agent_command`.
  throw new HttpError(409, 'LEGACY_OPENKORE_MIGRATION_REQUIRED');
}

async function readGrindTarget(account) {
  const key = `grind:${Number(account.accountId)}`,
    now = Date.now(),
    cached = observationConfigCache.get(key);
  if (cached?.value !== undefined && now - cached.at < 1_000)
    return cached.value;
  if (cached?.pending) return await cached.pending;
  const pending = (async () => {
    try {
      const value = JSON.parse(
        await readFile(
          join(instancesRoot, instanceId(account.accountId), 'grind-target.json'),
          'utf8',
        ),
      );
      // MOB_SELECTION_REMOVED / LEGACY_MOBID_IGNORED: only targetMap is read.
      // A legacy mobId in an old grind-target.json is ignored, never exposed,
      // never a filter and never used to reject or rewrite the map.
      return /^[a-z0-9_]{1,31}$/.test(value?.mapId ?? '')
        ? {
            mapId: value.mapId,
            name: String(value.name ?? value.mapId),
            levelRange: value.levelRange ?? null,
            updatedAt: Number(value.updatedAt ?? 0),
            source: Object.values(FARM_MAP_SOURCE).includes(String(value.source ?? ''))
              ? String(value.source)
              : null,
            legacyUnclassified: !Object.values(FARM_MAP_SOURCE).includes(
              String(value.source ?? ''),
            ),
          }
        : null;
    } catch {
      return null;
    }
  })();
  observationConfigCache.set(key, {
    at: cached?.at ?? 0,
    value: cached?.value,
    pending,
  });
  try {
    const value = await pending;
    observationConfigCache.set(key, { at: Date.now(), value, pending: null });
    return value;
  } catch (error) {
    observationConfigCache.delete(key);
    throw error;
  }
}

async function readCharacterSavePoint(accountId, charId = null) {
  const output = await sql(
    `SELECT save_map,save_x,save_y FROM \`char\` WHERE account_id=${Number(accountId)} AND ${Number.isSafeInteger(Number(charId)) && Number(charId) > 0 ? `char_id=${Number(charId)}` : 'char_num=0'} LIMIT 1;`,
  );
  if (!output) return null;
  const [map, xText, yText] = output.split('\t'),
    x = Number(xText),
    y = Number(yText);
  return /^[a-z0-9_]{1,31}$/.test(map) &&
    Number.isSafeInteger(x) &&
    Number.isSafeInteger(y)
    ? { map, x, y }
    : null;
}

function supplyHubForMap(mapId) {
  const normalizedMapId = String(mapId ?? '');
  return normalizedMapId
    ? nearestSupplyHubForMap(
        normalizedMapId,
        physicalMapGraph,
        mapRoutingIndex.maps?.[normalizedMapId],
      )
    : supplyHubs.prontera;
}

function configLineValue(config, name) {
  return config.match(new RegExp(`^${name}(?:[\\t ]+(.*))?$`, 'm'))?.[1]?.trim() ?? '';
}

async function writeJsonAtomic(path, value) {
  const pendingPath = `${path}.pending-${randomUUID()}`;
  await writeFile(pendingPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(pendingPath, path);
}

function applySupplyHub(config, mapId) {
  const hub = supplyHubForMap(mapId);
  config = replaceConfigLine(config, 'storageAuto_npc', hub.storageNpc);
  config = replaceConfigLine(config, 'sellAuto_npc', hub.shopNpc);
  return config.replace(
    /^buyAuto 501\s*\{[\s\S]*?^\}/m,
    (block) => block.replace(/^\s*npc\s+.*$/m, `\tnpc ${hub.shopNpc}`),
  );
}

async function ensureGrindHubTransitionWorker(account, id) {
  let [session, snapshot] = await Promise.all([
    currentWorkerState(id),
    currentStatusSnapshot(id),
  ]);
  if (session.running && Number(snapshot?.grindHubTransitionVersion) === 1)
    return snapshot;
  if (session.running) {
    await stopWorker(account);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  await unlink(join(instancesRoot, id, 'status.json')).catch(() => {});
  await startWorker(account);
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    [session, snapshot] = await Promise.all([
      currentWorkerState(id),
      currentStatusSnapshot(id),
    ]);
    if (session.running && Number(snapshot?.grindHubTransitionVersion) === 1)
      return snapshot;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new HttpError(409, '角色導航更新逾時，請再試一次');
}

function countAuthoritativeRedPotions(inventory) {
  if (!Array.isArray(inventory))
    throw new HttpError(503, '角色背包狀態無法確認');
  let count = 0;
  for (const item of inventory) {
    if (Number(item?.itemId ?? item?.id) !== 501) continue;
    const amount = Number(item?.amount ?? 0);
    if (!Number.isFinite(amount) || amount < 0)
      throw new HttpError(503, '角色背包狀態無法確認');
    count += amount;
  }
  return count;
}

function grindTargetRedPotionShortage(count, redPotionMin) {
  const threshold = Math.max(1, Number(redPotionMin ?? 20));
  if (!Number.isFinite(count) || !Number.isFinite(threshold))
    throw new HttpError(503, '角色背包狀態無法確認');
  return count < threshold;
}

async function authoritativeGrindRedPotions(charId) {
  const id = Number(charId);
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new HttpError(503, '角色背包狀態無法確認');
  let inventory;
  try {
    inventory = await queryInventory(id);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, '角色背包狀態無法確認');
  }
  if (!Array.isArray(inventory))
    throw new HttpError(503, '角色背包狀態無法確認');
  return countAuthoritativeRedPotions(inventory);
}

async function saveGrindTarget(account, requestedMapId) {
  const mapId = String(requestedMapId ?? '').trim();
  if (!/^[a-z0-9_]{1,31}$/.test(mapId))
    throw new HttpError(400, 'farm_target_unresolved');
  // MOB_SELECTION_REMOVED: the player selects the MAP only. All canonical maps
  // stay visible, but only a map with at least one monster spawn is farm
  // selectable. No town-name rule, no region unlock, no rollout/static
  // allowlist, and no default-map fallback.
  const eligibility = farmMapEligibility(mapId);
  if (!eligibility.map) throw new HttpError(400, 'farm_target_unresolved');
  if (!eligibility.farmable) throw new HttpError(409, 'farm_map_not_farmable');
  if (!eligibility.farmSelectionAvailable)
    throw new HttpError(409, 'farm_map_not_released');
  const map = eligibility.map;

  const id = await ensureWorker(account);
  const [snapshot, supplyCycle, savePoint] = await Promise.all([
    ensureGrindHubTransitionWorker(account, id),
    readSupplyCycle(account),
    readCharacterSavePoint(account.accountId),
  ]);
  if (!snapshot) throw new HttpError(409, '角色狀態尚未同步');
  if (
    snapshot.onboarding?.active ||
    snapshot.edenJourney?.active ||
    snapshot.questRuntimeAgent?.active ||
    snapshot.grindHubTransition?.active
  )
    throw new HttpError(409, '任務執行中，暫時不能更換掛機地圖');
  const hp = Number(snapshot.hp ?? 0),
    maxHp = Number(snapshot.maxHp ?? 0);
  if (maxHp > 0 && hp * 100 < maxHp * 60)
    throw new HttpError(409, 'HP 低於 60%，請先恢復後再出發');
  const redPotions = await authoritativeGrindRedPotions(account.characterId);
  if (grindTargetRedPotionShortage(redPotions, supplyCycle.redPotionMin))
    throw new HttpError(409, '紅色藥水不足，請先完成補給後再出發');

  const target = {
    mapId,
    name: map.name,
    levelRange: map.levelRange,
    source: FARM_MAP_SOURCE.PLAYER_OVERRIDE,
    updatedAt: Date.now(),
  };
  const previousTarget = await readGrindTarget(account),
    targetPath = join(instancesRoot, id, 'grind-target.json');
  await writeJsonAtomic(targetPath, target);
  observationConfigCache.set(`grind:${Number(account.accountId)}`, {
    at: Date.now(),
    value: target,
    pending: null,
  });
  const configPath = join(instancesRoot, id, 'control', 'config.txt');
  let config = await readFile(configPath, 'utf8');
  const originalConfig = config;
  const hub = supplyHubForMap(mapId),
    savePointMatchesHub = savePoint?.map === hub.saveMap;
  const routeSettings = [
    ['lockMap', savePointMatchesHub ? mapId : ''],
    ['lockMap_x', ''],
    ['lockMap_y', ''],
    ['lockMap_randX', ''],
    ['lockMap_randY', ''],
    ['route_warpByItem', '1'],
    ['route_warpByItem_chaining', '0'],
    ['route_warpByItem_minDistance', '150'],
    ['route_warpItem_minGain', '40'],
    ['saveMap_warp', '1'],
    ['saveMap_warp_minDistance', '80'],
  ];
  if (savePoint)
    routeSettings.push(
      ['saveMap', savePoint.map],
      ['saveMap_x', String(savePoint.x)],
      ['saveMap_y', String(savePoint.y)],
    );
  for (const [name, value] of routeSettings)
    config = replaceConfigLine(config, name, value);
  await writeFile(configPath, config, 'utf8');
  if (!savePointMatchesHub) {
    const transition = {
      version: 1,
      stage: 'requested',
      active: true,
      createdAt: Date.now(),
      target,
      previousTarget,
      previousSavePoint: savePoint,
      hub,
      priorConfig: {
        lockMap: configLineValue(originalConfig, 'lockMap'),
        saveMap: configLineValue(originalConfig, 'saveMap'),
        saveMapX: configLineValue(originalConfig, 'saveMap_x'),
        saveMapY: configLineValue(originalConfig, 'saveMap_y'),
        storageNpc: configLineValue(originalConfig, 'storageAuto_npc'),
        sellNpc: configLineValue(originalConfig, 'sellAuto_npc'),
      },
    };
    await writeJsonAtomic(
      join(instancesRoot, id, 'grind-hub-transition.json'),
      transition,
    );
    await queueCharacterCommand(
      account,
      'grind_hub_transition',
      JSON.stringify({ mapId, hubId: hub.id }),
    );
    return {
      ...target,
      hubTransition: {
        active: true,
        hubId: hub.id,
        hubName: hub.name,
        stage: 'requested',
      },
    };
  }
  config = applySupplyHub(config, mapId);
  await writeFile(configPath, config, 'utf8');
  await queueCharacterCommand(account, 'supply_cycle_reload', '1');
  return target;
}

const supplyCycleDefaults = Object.freeze({
  enabled: false,
  returnWeight: 75,
  store: true,
  sell: true,
  buy: true,
  redPotionMin: 20,
  redPotionMax: 100,
  rules: [],
});
const redPotionNpcPrice = 10;
const supplyRuleActions = new Set([
  'default',
  'ignore',
  'discard',
  'sell',
  'store',
  'keep',
]);
const permanentInventoryItemIds = new Set([601, 602]);
function normalizeSupplyCycle(input = {}) {
  const returnWeight = Math.trunc(Number(input.returnWeight)),
    redPotionMin = Math.trunc(Number(input.redPotionMin)),
    redPotionMax = Math.trunc(Number(input.redPotionMax)),
    rules = Array.isArray(input.rules)
      ? input.rules
          .slice(0, 100)
          .map((rule) => ({
            itemId: Math.trunc(Number(rule?.itemId)),
            action: String(rule?.action ?? 'default'),
          }))
          .filter(
            (rule) =>
              rule.itemId > 0 &&
              rule.itemId !== 501 &&
              !permanentInventoryItemIds.has(rule.itemId) &&
              rule.itemId <= 1_000_000 &&
              supplyRuleActions.has(rule.action),
          )
      : [];
  const normalized = {
    enabled: Boolean(input.enabled),
    returnWeight: Number.isInteger(returnWeight)
      ? Math.min(88, Math.max(40, returnWeight))
      : supplyCycleDefaults.returnWeight,
    store: input.store !== false,
    sell: input.sell !== false,
    buy: input.buy !== false,
    redPotionMin: Number.isInteger(redPotionMin)
      ? Math.min(500, Math.max(0, redPotionMin))
      : supplyCycleDefaults.redPotionMin,
    redPotionMax: Number.isInteger(redPotionMax)
      ? Math.min(1_000, Math.max(0, redPotionMax))
      : supplyCycleDefaults.redPotionMax,
    rules: [...new Map(rules.map((rule) => [rule.itemId, rule])).values()],
  };
  normalized.redPotionMax = Math.max(
    normalized.redPotionMin,
    normalized.redPotionMax,
  );
  if (
    normalized.enabled &&
    !normalized.store &&
    !normalized.sell &&
    !normalized.buy
  )
    throw new Error('請至少啟用存倉、販售或補給其中一項');
  return normalized;
}
function replaceConfigLine(text, name, value) {
  const pattern = new RegExp(`^${name}(?:[\\t ]+.*)?$`, 'm'),
    line = value === '' ? name : `${name} ${value}`;
  return pattern.test(text)
    ? text.replace(pattern, line)
    : `${text.trimEnd()}\n${line}\n`;
}
async function readSupplyCycle(account) {
  const target = join(
    instancesRoot,
    instanceId(account.accountId),
    'supply-cycle.json',
  ),
    key = `supply:${Number(account.accountId)}`,
    now = Date.now(),
    cached = observationConfigCache.get(key);
  if (cached?.value !== undefined && now - cached.at < 1_000)
    return cached.value;
  if (cached?.pending) return await cached.pending;
  const pending = readFile(target, 'utf8')
    .then((content) => normalizeSupplyCycle(JSON.parse(content)))
    .catch(() => ({ ...supplyCycleDefaults, rules: [] }));
  observationConfigCache.set(key, {
    at: cached?.at ?? 0,
    value: cached?.value,
    pending,
  });
  const value = await pending;
  observationConfigCache.set(key, { at: Date.now(), value, pending: null });
  return value;
}
async function saveSupplyCycle(account, input) {
  const settings = normalizeSupplyCycle(input),
    id = await ensureWorker(account),
    folder = join(instancesRoot, id),
    control = join(folder, 'control'),
    configPath = join(control, 'config.txt'),
    pickupPath = join(control, 'pickupitems.txt'),
    itemControlPath = join(control, 'items_control.txt');
  const grindTarget = await readGrindTarget(account),
    supplyHub = supplyHubForMap(grindTarget?.mapId);
  let config = await readFile(configPath, 'utf8');
  for (const [name, value] of [
    ['itemsTakeAuto', 2],
    ['itemsMaxWeight', 89],
    ['itemsMaxWeight_sellOrStore', settings.returnWeight],
    ['storageAuto', settings.enabled && settings.store ? 1 : 0],
    ['storageAuto_npc', supplyHub.storageNpc],
    ['storageAuto_npc_type', 1],
    ['storageAuto_keepOpen', 0],
    ['relogAfterStorage', 0],
    ['minStorageZeny', 40],
    ['sellAuto', settings.enabled && settings.sell ? 1 : 0],
    ['sellAuto_npc', supplyHub.shopNpc],
    ['sellAuto_npc_steps', 's'],
  ])
    config = replaceConfigLine(config, name, value);
  const buyBlock = `buyAuto 501 {
\tnpc ${supplyHub.shopNpc}
\tnpc_steps b
\tisMarket 0
\tstandpoint
\tdistance 3
\tprice ${redPotionNpcPrice}
\tminAmount ${settings.redPotionMin}
\tmaxAmount ${settings.redPotionMax}
\tbatchSize ${settings.redPotionMax}
\tonlyIdentified 0
\tzeny >= ${redPotionNpcPrice}
\tminDistance
\tmaxDistance
\tdisabled ${settings.enabled && settings.buy ? 0 : 1}
\tdcOnEmpty 0
}`;
  config = config.replace(
    /^buyAuto(?:\s+[^\r\n{]+)?\s*\{[\s\S]*?^\}/m,
    buyBlock,
  );
  await writeFile(configPath, config, 'utf8');

  const pickupLines = [
    '# Managed by the player supply-cycle settings.',
    'all 1',
    '601 1 # Permanent Fly Wing',
    '602 1 # Permanent Butterfly Wing',
  ];
  for (const rule of settings.rules) {
    if (rule.action === 'ignore') pickupLines.push(`${rule.itemId} 0`);
    if (rule.action === 'discard') pickupLines.push(`${rule.itemId} -1`);
  }
  await writeFile(pickupPath, `${pickupLines.join('\n')}\n`, 'utf8');

  const managedStart = '# BEGIN PLAYER SUPPLY RULES',
    managedEnd = '# END PLAYER SUPPLY RULES';
  let itemControl = await readFile(itemControlPath, 'utf8');
  itemControl = replaceConfigLine(
    itemControl,
    '501',
    `${settings.redPotionMax} 0 0 # Red Potion`,
  );
  itemControl = replaceConfigLine(
    itemControl,
    '601',
    '30000 0 0 # Permanent Fly Wing',
  );
  itemControl = replaceConfigLine(
    itemControl,
    '602',
    '30000 0 0 # Permanent Butterfly Wing',
  );
  itemControl = itemControl.replace(
    new RegExp(`${managedStart}[\\s\\S]*?${managedEnd}\\s*`, 'g'),
    '',
  );
  const itemLines = [managedStart];
  for (const rule of settings.rules) {
    if (rule.action === 'sell') itemLines.push(`${rule.itemId} 0 0 1`);
    if (rule.action === 'store') itemLines.push(`${rule.itemId} 0 1 0`);
    if (rule.action === 'keep') itemLines.push(`${rule.itemId} 30000 0 0`);
  }
  itemLines.push(managedEnd);
  await writeFile(
    itemControlPath,
    `${itemControl.trimEnd()}\n\n${itemLines.join('\n')}\n`,
    'utf8',
  );
  await writeFile(
    join(folder, 'supply-cycle.json'),
    `${JSON.stringify(settings, null, 2)}\n`,
    'utf8',
  );
  observationConfigCache.set(`supply:${Number(account.accountId)}`, {
    at: Date.now(),
    value: settings,
    pending: null,
  });
  await queueCharacterCommand(account, 'supply_cycle_reload', '1');
  return settings;
}

const configOnlyExecution = () => ({ applied: false, controller: 'CONFIG_ONLY',
  reason: 'CONFIG_ONLY_NO_EXECUTOR_COMMAND' });

async function nativeSupplyConfigExecution(account, config) {
  if (!nativeSupplyPolicyCommandEnabled) return configOnlyExecution();
  const charId = Number(account.characterId);
  const controller = await readCharacterControllerStatus(account, charId,
    { includeFarmTarget: false });
  if (!controller.available || controller.controller !== SERVER_AGENT_OWNER)
    return { ...configOnlyExecution(), reason: 'NATIVE_SUPPLY_POLICY_UNAVAILABLE' };
  const ownership = await getOwnershipStatus(account, charId).catch(() => null);
  if (!ownership)
    return { ...configOnlyExecution(), reason: 'SUPPLY_STATE_UNAVAILABLE' };
  const activePolicy = ownership.agentMode === 'AUTO_FARM'
    ? ownership.targetRules?.supplyPolicy : null;
  const applied = activePolicy != null &&
    JSON.stringify(activePolicy) === JSON.stringify(nativeSupplyPolicy(config));
  return { applied, editable: true, controller: SERVER_AGENT_OWNER,
    reason: applied ? null : ownership.agentMode === 'PERSISTENT_IDLE'
      ? 'SAVED_FOR_NEXT_FARM' : 'POLICY_NOT_YET_CONFIRMED',
    capabilities: m1ConfigExecutionCapabilities(nativeSupplyPolicyCommandEnabled, true) };
}

async function configureSavedNativeSupplyPolicy(account, execution) {
  if (!execution.editable) return execution;
  try {
    const charId = Number(account.characterId);
    const state = await readAgentStateRow(charId);
    if (!state || state.accountId !== Number(account.accountId))
      return { ...execution, reason: 'SUPPLY_STATE_UNAVAILABLE' };
    const command = await queueOwnershipCommand(account, charId,
      { action: 'configure_supply_policy', expectedRevision: state.revision });
    const settled = await waitForResetCommand(account, charId, command.commandId);
    return { ...execution, applied: settled.status === 'CONFIRMED',
      reason: settled.status === 'CONFIRMED' ? null :
        settled.reasonCode || `SUPPLY_POLICY_${settled.status}`,
      command: settled };
  } catch (error) {
    return { ...execution, reason: error?.message || 'SUPPLY_POLICY_UNAVAILABLE' };
  }
}

// Character-scoped config is the durable source. The native command applies
// supply policy to a resident agent only after the deployment gate is enabled.
async function readPlayerConfig(account) {
  if (!account?.characterId) throw new HttpError(409, '請先建立角色');
  const result = await loadCanonicalConfig({
    instancesRoot,
    accountId: account.accountId,
    characterId: account.characterId,
    persistMigration: true,
  });
  return {
    config: result.config,
    migration: result.migration,
    source: result.source,
    schemaVersion: result.config.version,
    adapter: canonicalToOpenKorePreview(result.config),
    execution: await nativeSupplyConfigExecution(account, result.config),
  };
}

async function savePlayerConfig(account, body) {
  if (!account?.characterId) throw new HttpError(409, '請先建立角色');
  const config = body?.config;
  const errors = validateCanonicalConfig(config);
  if (errors.length) {
    const exception = new HttpError(422, '設定驗證失敗');
    exception.details = errors;
    throw exception;
  }
  const current = await loadCanonicalConfig({
    instancesRoot, accountId: account.accountId,
    characterId: account.characterId, persistMigration: false,
  });
  const admission = configWriteAdmission(current.config, config,
    await nativeSupplyConfigExecution(account, current.config));
  if (!admission.ok) {
    const exception = new HttpError(422, 'CONFIG_EXECUTOR_UNAVAILABLE');
    exception.details = admission.unsupportedPaths.map((path) => ({ path,
      message: 'CONFIG_EXECUTOR_UNAVAILABLE' }));
    throw exception;
  }
  if (nativeSupplyPolicyCommandEnabled) {
    try { nativeSupplyPolicy(config); }
    catch { throw new HttpError(422, 'SUPPLY_POLICY_UNAVAILABLE'); }
  }
  const result = await saveCanonicalConfig({
    instancesRoot,
    accountId: account.accountId,
    characterId: account.characterId,
    config,
    expectedRevision: body?.expectedRevision,
  });
  const execution = await configureSavedNativeSupplyPolicy(account,
    await nativeSupplyConfigExecution(account, result.config));
  return {
    config: result.config,
    migration: result.migration,
    source: result.source,
    schemaVersion: result.config.version,
    adapter: canonicalToOpenKorePreview(result.config),
    execution,
  };
}

// SERVER_AGENT stat allocation: explicit player intent executed by rAthena's
// native status-up path over persistent_agent_command. The browser supplies only
// the stat name; the command revision is read from persistent_agent_state.
async function queueServerAgentStatPoint(account, statName, input = {}) {
  const charId = Number(account.characterId);
  if (!Number.isSafeInteger(charId) || charId <= 0)
    throw new HttpError(409, 'character_required');
  const stat = String(statName ?? '').toLowerCase();
  if (!baseStats.has(stat)) throw new HttpError(400, '無效的能力值');
  const stateRow = await readAgentStateRow(charId);
  if (!stateRow) throw new HttpError(409, 'agent_state_unavailable');
  const command = await queueOwnershipCommand(account, charId, {
    action: 'allocate_stat_point',
    stat,
    expectedRevision: Number(stateRow.revision),
    commandId: input.commandId,
  });
  return {
    commandId: command.commandId,
    stat,
    accepted: true,
    rejected: false,
    reason: null,
    command,
  };
}

// SERVER_AGENT skill allocation: explicit "raise by one" intent. rAthena
// revalidates the job skill tree, prerequisites, available points and maximum
// level; the Web never dictates the resulting level.
async function queueServerAgentSkillPoint(account, skillId, input = {}) {
  const charId = Number(account.characterId);
  if (!Number.isSafeInteger(charId) || charId <= 0)
    throw new HttpError(409, 'character_required');
  const numericSkillId = Number(skillId);
  if (!Number.isSafeInteger(numericSkillId) || numericSkillId <= 0 || numericSkillId > 65535)
    throw new HttpError(400, '無效的技能');
  const stateRow = await readAgentStateRow(charId);
  if (!stateRow) throw new HttpError(409, 'agent_state_unavailable');
  const command = await queueOwnershipCommand(account, charId, {
    action: 'allocate_skill_point',
    skillId: numericSkillId,
    expectedRevision: Number(stateRow.revision),
    commandId: input.commandId,
  });
  return {
    commandId: command.commandId,
    skillId: numericSkillId,
    accepted: true,
    rejected: false,
    reason: null,
    command,
  };
}

// SERVER_AGENT generic native NPC dialog. talk/next/select/close are the exact
// PA dialog actions; the Web supplies only identities/indices and never dialog
// text or NPC rules. Controller routing happens in the request handler so an
// OPENKORE character keeps the legacy .cmd path during the transition.
async function queueServerAgentNpcDialog(account, input = {}) {
  const charId = Number(account.characterId);
  if (!Number.isSafeInteger(charId) || charId <= 0)
    throw new HttpError(409, 'character_required');
  const action = String(input.action ?? '');
  const stateRow = await readAgentStateRow(charId);
  if (!stateRow) throw new HttpError(409, 'agent_state_unavailable');
  const base = {
    expectedRevision: Number(stateRow.revision),
    commandId: input.commandId,
  };
  if (action === 'talk') {
    const npcName = String(input.npcName ?? '');
    const targetMap = String(input.targetMap ?? '');
    if (!rAthenaNpcNamePattern.test(npcName) || !/^[a-z0-9_]{1,31}$/.test(targetMap))
      throw new HttpError(422, 'invalid_transition');
    const command = await queueOwnershipCommand(account, charId, {
      action: 'talk_to_npc',
      npcName,
      targetMap,
      goal: 'dialog',
      ...base,
    });
    return { commandId: command.commandId, action: 'talk', accepted: true, rejected: false, reason: null, command };
  }
  if (action === 'next' || action === 'close') {
    const command = await queueOwnershipCommand(account, charId, {
      action: action === 'next' ? 'dialog_next' : 'dialog_close',
      ...base,
    });
    return { commandId: command.commandId, action, accepted: true, rejected: false, reason: null, command };
  }
  if (action === 'select') {
    const index = Number(input.index);
    if (!Number.isSafeInteger(index) || index < 1 || index > 254)
      throw new HttpError(422, 'invalid_transition');
    const command = await queueOwnershipCommand(account, charId, {
      action: 'dialog_select',
      index,
      ...base,
    });
    return {
      commandId: command.commandId,
      action: 'select',
      index,
      accepted: true,
      rejected: false,
      reason: null,
      command,
    };
  }
  if (action === 'input') {
    const text = String(input.text ?? '');
    if (!text || text.length > 40 || /[\r\n\0]/.test(text))
      throw new HttpError(422, 'invalid_transition');
    const command = await queueOwnershipCommand(account, charId, {
      action: 'dialog_input',
      text,
      ...base,
    });
    return {
      commandId: command.commandId,
      action: 'input',
      accepted: true,
      rejected: false,
      reason: null,
      command,
    };
  }
  throw new HttpError(422, 'invalid_transition');
}

const characterResetCooldownSeconds = 8 * 60 * 60;
async function readCharacterResetCooldowns(charId) {
  const id = Number(charId);
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new HttpError(409, 'character_required');
  const output = await sql(
    `SELECT FLOOR(UNIX_TIMESTAMP()),` +
    `COALESCE(MAX(CASE WHEN \`key\`='last_stat_reset_at' THEN value END),0),` +
    `COALESCE(MAX(CASE WHEN \`key\`='last_skill_reset_at' THEN value END),0) ` +
    `FROM char_reg_num WHERE char_id=${id} AND \`index\`=0 ` +
    `AND \`key\` IN ('last_stat_reset_at','last_skill_reset_at');`,
  );
  const [nowText, statText, skillText] = String(output ?? '').split('\t');
  const serverNow = Number(nowText);
  if (!Number.isSafeInteger(serverNow) || serverNow <= 0)
    throw new HttpError(503, 'reset_cooldown_unavailable');
  const state = (valueText) => {
    const lastResetAt = Number(valueText ?? 0);
    const availableAt = lastResetAt > 0
      ? lastResetAt + characterResetCooldownSeconds : 0;
    return {
      lastResetAt,
      availableAt,
      remainingSeconds: Math.max(0, availableAt - serverNow),
      available: availableAt <= serverNow,
    };
  };
  return {
    cost: 0,
    cooldownSeconds: characterResetCooldownSeconds,
    scope: 'CHARACTER',
    serverNow,
    stat: state(statText),
    skill: state(skillText),
  };
}

async function waitForResetCommand(account, charId, commandId) {
  const deadline = Date.now() + 12000;
  let command;
  do {
    command = await getOwnershipCommand(account, charId, commandId);
    if (command.status === 'CONFIRMED' || command.status === 'REJECTED' ||
        command.status === 'CANCELLED') return command;
    await sleep(200);
  } while (Date.now() < deadline);
  return command;
}

async function queueCharacterReset(account, type, commandId) {
  const charId = Number(account.characterId);
  if (!Number.isSafeInteger(charId) || charId <= 0)
    throw new HttpError(409, 'character_required');
  if (type !== 'stat' && type !== 'skill')
    throw new HttpError(422, 'invalid_reset_type');
  if (!commandIdPattern.test(commandId))
    throw new HttpError(422, 'invalid_command_id');
  return withStatCommandLock(charId, async () => {
    let prior = null;
    try {
      prior = await getOwnershipCommand(account, charId, commandId);
    } catch (error) {
      if (!(error instanceof HttpError) || error.statusCode !== 404) throw error;
    }
    const action = type === 'stat' ? 'reset_character_stat' : 'reset_character_skill';
    if (prior) {
      if (prior.action !== action) throw new HttpError(409, 'idempotency_conflict');
      return { command: await waitForResetCommand(account, charId, commandId),
        cooldowns: await readCharacterResetCooldowns(charId) };
    }
    const controller = await readCharacterControllerStatus(account, charId, {
      includeFarmTarget: false,
    });
    if (!controller.available || controller.controller !== SERVER_AGENT_OWNER)
      throw new HttpError(409, 'server_agent_required');
    const cooldowns = await readCharacterResetCooldowns(charId);
    if (!cooldowns[type].available)
      throw new HttpError(409, 'reset_cooldown_active');
    let state = await readAgentStateRow(charId);
    if (!state) throw new HttpError(503, 'agent_state_unavailable');
    if (state.agentMode !== 'PERSISTENT_IDLE') {
      const stop = await queueOwnershipCommand(account, charId, {
        action: 'stop_farm', expectedRevision: Number(state.revision),
      });
      const stopped = await waitForResetCommand(account, charId, stop.commandId);
      if (stopped.status !== 'CONFIRMED')
        throw new HttpError(409, 'reset_safe_stop_failed');
      state = await readAgentStateRow(charId);
      if (!state || state.agentMode !== 'PERSISTENT_IDLE')
        throw new HttpError(409, 'reset_safe_stop_failed');
    }
    const command = await queueOwnershipCommand(account, charId, {
      action, expectedRevision: Number(state.revision), commandId,
    });
    return { command: await waitForResetCommand(account, charId, command.commandId),
      cooldowns: await readCharacterResetCooldowns(charId) };
  });
}

async function allocateStatusPoint(account, statName, input = {}) {
  if (!baseStats.has(statName)) throw new Error('無效的能力值');
  const requestedCommandId = String(input?.commandId ?? '').toLowerCase(),
    commandId = requestedCommandId || randomUUID();
  if (!commandIdPattern.test(commandId))
    throw new HttpError(400, 'commandId 格式不符');
  return await withStatCommandLock(account.characterId, async () => {
    const priorResult = cachedStatCommandResult(account.characterId, commandId);
    if (priorResult) return priorResult;
    const snapshot = await currentStatusSnapshot(instanceId(account.accountId));
    if (!snapshot) throw new Error('角色目前不在線上');
    const state = statDomainState(account.characterId, snapshot),
      commandInput = { ...input, commandId },
      expectedRevision = Number(commandInput.expectedRevision);
    if (
      commandInput.expectedRevision !== undefined &&
      (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    )
      throw new HttpError(400, 'expectedRevision 格式不符');
    if (
      commandInput.characterId !== undefined &&
      Number(commandInput.characterId) !== Number(account.characterId)
    )
      return rememberStatCommandResult(
        account.characterId,
        commandId,
        rejectedStatResult(commandId, statName, 'character_mismatch', state),
      );
    if (
      commandInput.expectedRevision !== undefined &&
      expectedRevision !== state.statRevision
    )
      return rememberStatCommandResult(
        account.characterId,
        commandId,
        rejectedStatResult(commandId, statName, 'revision_mismatch', state),
      );
    const current = Number(state[statName]),
      available = Number(state.remainingStatPoints),
      cost = statusPointCost(current);
    if (current >= 130)
      return rememberStatCommandResult(
        account.characterId,
        commandId,
        rejectedStatResult(commandId, statName, 'stat_cap_reached', state),
      );
    if (available < cost)
      return rememberStatCommandResult(
        account.characterId,
        commandId,
        rejectedStatResult(commandId, statName, 'insufficient_points', state),
      );
    await queueCharacterCommand(account, 'stat', statName, {
      commandId,
      expectedRevision: state.statRevision,
    });
    const bridgeResult = await waitForCharacterCommandResult(account, commandId);
    if (!bridgeResult?.ok)
      return rememberStatCommandResult(
        account.characterId,
        commandId,
        rejectedStatResult(
          commandId,
          statName,
          bridgeResult ? 'command_rejected' : 'bridge_timeout',
          state,
        ),
      );
    const confirmed = await waitForStatDomainChange(
      account,
      statName,
      current,
      available - cost,
      state.statRevision,
    );
    if (!confirmed)
      return rememberStatCommandResult(
        account.characterId,
        commandId,
        rejectedStatResult(commandId, statName, 'confirmation_timeout', state),
      );
    return rememberStatCommandResult(account.characterId, commandId, {
      commandId,
      stat: statName,
      newValue: confirmed[statName],
      remainingStatPoints: confirmed.remainingStatPoints,
      statRevision: confirmed.statRevision,
      accepted: true,
      rejected: false,
      reason: null,
      statState: confirmed,
    });
  });
}
async function queueSkillAutomation(account, input) {
  const mode = String(input.mode ?? ''),
    enabled = input.enabled === true;
  if (!['attack', 'selfRecovery', 'selfBuff'].includes(mode))
    throw new Error('無效的技能自動化類型');
  if (!enabled) {
    const action =
      mode === 'attack'
        ? 'skill_auto_attack'
        : mode === 'selfRecovery'
          ? 'skill_auto_self'
          : 'skill_auto_buff';
    return await queueCharacterCommand(account, action, 'off');
  }
  const snapshot = await currentStatusSnapshot(instanceId(account.accountId));
  if (!snapshot) throw new Error('角色目前不在線上');
  const skillId = Number(input.skillId),
    definition = skillAutomationDefinitions.get(
      `${Number(snapshot.jobId)}:${skillId}`,
    ),
    live = snapshot.skills?.find((skill) => Number(skill.id) === skillId);
  if (!definition || !live || Number(live.level) < 1)
    throw new Error('角色尚未習得此技能');
  const resolvedMode =
    definition.automationMode === 'selfRecovery'
      ? 'selfRecovery'
      : definition.automationMode === 'selfBuff'
        ? 'selfBuff'
        : definition.automationMode
          ? 'attack'
          : '';
  if (resolvedMode !== mode) throw new Error('技能自動化類型不符');
  const level = Math.min(
      Number(live.level),
      Math.max(1, Math.trunc(Number(input.level) || Number(live.level))),
    ),
    minimumSp = Number.isFinite(Number(input.minimumSp))
      ? Math.trunc(Number(input.minimumSp))
      : 20;
  if (minimumSp < 0 || minimumSp > 95)
    throw new Error('最低 SP 必須介於 0% 至 95%');
  if (mode === 'attack') {
    const resources = definition.resources ?? {},
      zenyCost = Number(resources.zenyCostByLevel?.[level - 1] ?? 0),
      requiredWeapons = Array.isArray(resources.weapons)
        ? resources.weapons
        : [],
      requiredAmmo = Array.isArray(resources.ammo) ? resources.ammo : [],
      ammoAmount = Math.max(0, Number(resources.ammoAmount) || 0),
      inventory = Array.isArray(snapshot.inventory) ? snapshot.inventory : [];
    if (zenyCost > Number(snapshot.zeny ?? 0))
      throw new Error(`Zeny 不足，此技能每次需要 ${zenyCost}`);
    const equippedWeapon = requiredWeapons.length
      ? inventory.find(
          (item) =>
            item.equipped && requiredWeapons.includes(String(item.weaponType)),
        )
      : null;
    if (requiredWeapons.length && !equippedWeapon)
      throw new Error(`技能需要裝備 ${requiredWeapons.join('／')}`);
    const ammoTypes = requiredAmmo
        .map((name) => openKoreAmmoItemTypes[name])
        .filter(Number.isInteger),
      equippedAmmo = ammoTypes.length
        ? inventory.find(
            (item) =>
              item.equipped &&
              ammoTypes.includes(Number(item.itemType)) &&
              Number(item.amount) >= ammoAmount,
          )
        : null;
    if (requiredAmmo.length && !equippedAmmo)
      throw new Error(
        `技能需要已裝備 ${requiredAmmo.join('／')} × ${ammoAmount}`,
      );
    return await queueCharacterCommand(
      account,
      'skill_auto_attack',
      `${definition.handle},${level},${minimumSp},${definition.automationMode === 'attackSelf' ? 1 : 0},${zenyCost},${requiredWeapons.join('+')},${Number(equippedAmmo?.itemId ?? 0)},${ammoAmount}`,
    );
  }
  if (mode === 'selfBuff') {
    if (!/^EFST_[A-Z0-9_]+$/.test(definition.automationStatus ?? ''))
      throw new Error('技能狀態來源不完整');
    return await queueCharacterCommand(
      account,
      'skill_auto_buff',
      `${definition.handle},${level},${minimumSp},${definition.automationStatus}`,
    );
  }
  const hpBelow = Number.isFinite(Number(input.hpBelow))
    ? Math.trunc(Number(input.hpBelow))
    : 70;
  if (hpBelow < 5 || hpBelow > 95)
    throw new Error('恢復門檻必須介於 5% 至 95%');
  return await queueCharacterCommand(
    account,
    'skill_auto_self',
    `${definition.handle},${level},${minimumSp},${hpBelow}`,
  );
}

async function testPort(portNumber) {
  return await new Promise((resolve) =>
    import('node:net').then(({ createConnection }) => {
      const socket = createConnection({ host: '127.0.0.1', port: portNumber });
      const done = (v) => {
        socket.destroy();
        resolve(v);
      };
      socket.setTimeout(500, () => done(false));
      socket.once('connect', () => done(true));
      socket.once('error', () => done(false));
    }),
  );
}
async function serviceHealth() {
  const [database, login, character, map] = await Promise.all(
    [3307, 6901, 6122, 5122].map(testPort),
  );
  const online = Number(
    await sql('SELECT COUNT(*) FROM `char` WHERE online=1;').catch(() => 0),
  );
  return { database, login, character, map, onlinePlayers: online };
}
async function publicWorldHealth() {
  const now = Date.now();
  if (publicHealthCache.value && now - publicHealthCache.at < 1000)
    return publicHealthCache.value;
  if (publicHealthCache.pending) return await publicHealthCache.pending;
  publicHealthCache.pending = serviceHealth().then((services) => ({
    online:
      services.database && services.login && services.character && services.map,
    onlinePlayers: services.onlinePlayers,
  }));
  try {
    const value = await publicHealthCache.pending;
    publicHealthCache = { at: Date.now(), value, pending: null };
    return value;
  } catch (error) {
    publicHealthCache.pending = null;
    throw error;
  }
}

// OPENKORE_WEB_REACHABLE = NO.
// The production Web backend no longer has ANY capability to create, spawn,
// hand off to, or return an OpenKore worker. The `openkore-instance.ps1`
// invocation and the `start.exe` spawn were physically deleted from this file.
// Historical scripts/plugins/patches remain on disk as archive only and are
// unreachable from a request. Legacy callers fail closed (no silent migration).
function openKoreWebControlRetired() {
  throw new HttpError(409, 'LEGACY_OPENKORE_MIGRATION_REQUIRED');
}
async function ensureWorker() {
  openKoreWebControlRetired();
}
function isolatedWorkerLaunchRejection(account) {
  return isolatedWorkerStartRejection({
    runtimeMode,
    databaseName,
    instanceRoot: instancesRoot,
    defaultInstanceRoot: defaultInstancesRoot,
    accountId: account?.accountId,
    characterId: account?.characterId,
    accountAllowlist: isolatedAutomationAccountAllowlist,
    characterAllowlist: isolatedAutomationCharacterAllowlist,
  });
}
// Fail fast, never silently fall back. Production mode returns null here, so
// the default path is byte-for-byte unchanged.
function authorizeWorkerLaunch(account) {
  const rejection = isolatedWorkerLaunchRejection(account);
  if (!rejection) return;
  const error = new Error(`${rejection.code}: ${rejection.reason}`);
  error.code = rejection.code;
  console.error(error.message);
  throw error;
}
async function startWorker() {
  openKoreWebControlRetired();
}
async function startWorkerOnce() {
  openKoreWebControlRetired();
}
async function stopWorker() {
  openKoreWebControlRetired();
}
async function setAutomationIntent(accountId, desired) {
  await sql(
    `INSERT INTO web_automation (account_id,desired_running,updated_at) VALUES (${Number(accountId)},${desired ? 1 : 0},${Date.now()}) ON DUPLICATE KEY UPDATE desired_running=VALUES(desired_running),updated_at=VALUES(updated_at);`,
  );
}
const defaultPreferences = Object.freeze({
  musicEnabled: true,
  soundEnabled: true,
  musicVolume: 20,
  soundVolume: 35,
  damageFloatsEnabled: true,
  damageFloatSize: 14,
  damageFloatScale: 500,
  damageFloatOpacity: 100,
  damageFloatWeight: 800,
  damageFloatFont: 'classic',
  damageFloatPositionX: 72,
  damageFloatPositionY: 72,
  damageFloatArc: 100,
  petCompanionEnabled: true,
  petCompanionSpecies: 'bulbasaur',
  petCompanionSize: 72,
  petActivityLevel: 'normal',
  petIdleSleepEnabled: true,
  petReduceActivityInLog: true,
  showPetInProfile: false,
  showPetInRanking: false,
});
const preferenceVolume = (value, fallback) =>
  Number.isFinite(Number(value))
    ? Math.max(0, Math.min(100, Math.round(Number(value))))
    : fallback;
const preferenceDamageSize = (value, fallback) =>
  Number.isFinite(Number(value))
    ? Math.max(10, Math.min(28, Math.round(Number(value))))
    : fallback;
const preferenceRange = (value, fallback, minimum, maximum) =>
  Number.isFinite(Number(value))
    ? Math.max(minimum, Math.min(maximum, Math.round(Number(value))))
    : fallback;
const damageFloatFonts = new Set([
  'classic',
  'traditional',
  'arial',
  'consolas',
  'system',
]);
const petActivityLevels = new Set(['quiet', 'normal', 'lively']);
const petCompanionSpecies = new Set(['bulbasaur', 'terasoid', 'baphomet', 'angeling', 'moonlight', 'tamadora']);
async function queryPreferences(accountId) {
  const cached = preferenceCache.get(Number(accountId));
  if (cached && Date.now() - cached.at < 60000) return { ...cached.value };
  const output = await sql(
    `SELECT music_enabled,sound_enabled,music_volume,sound_volume,damage_floats_enabled,damage_float_size,damage_float_scale,damage_float_opacity,damage_float_weight,damage_float_font,damage_float_position_x,damage_float_position_y,damage_float_arc,pet_companion_enabled,pet_companion_species,pet_companion_size,pet_activity_level,pet_idle_sleep_enabled,pet_reduce_activity_in_log,show_pet_in_profile,show_pet_in_ranking FROM web_preferences WHERE account_id=${Number(accountId)} LIMIT 1;`,
  );
  if (!output) {
    const value = { ...defaultPreferences };
    preferenceCache.set(Number(accountId), { at: Date.now(), value });
    return value;
  }
  const row = output.split('\t');
  const value = {
    musicEnabled: row[0] === '1',
    soundEnabled: row[1] === '1',
    musicVolume: Number(row[2]),
    soundVolume: Number(row[3]),
    damageFloatsEnabled: row[4] === '1',
    damageFloatSize: Number(row[5]),
    damageFloatScale: Number(row[6]),
    damageFloatOpacity: Number(row[7]),
    damageFloatWeight: Number(row[8]),
    damageFloatFont: damageFloatFonts.has(row[9]) ? row[9] : 'classic',
    damageFloatPositionX: Number(row[10]),
    damageFloatPositionY: Number(row[11]),
    damageFloatArc: Number(row[12]),
    petCompanionEnabled: row[13] === '1',
    petCompanionSpecies: petCompanionSpecies.has(row[14]) ? row[14] : 'bulbasaur',
    petCompanionSize: preferenceRange(row[15], 72, 48, 1200),
    petActivityLevel: petActivityLevels.has(row[16]) ? row[16] : 'normal',
    petIdleSleepEnabled: row[17] === '1',
    petReduceActivityInLog: row[18] === '1',
    showPetInProfile: row[19] === '1',
    showPetInRanking: row[20] === '1',
  };
  preferenceCache.set(Number(accountId), { at: Date.now(), value });
  return { ...value };
}
async function savePreferences(accountId, input) {
  const current = await queryPreferences(accountId),
    next = {
      musicEnabled:
        typeof input.musicEnabled === 'boolean'
          ? input.musicEnabled
          : current.musicEnabled,
      soundEnabled:
        typeof input.soundEnabled === 'boolean'
          ? input.soundEnabled
          : current.soundEnabled,
      musicVolume: preferenceVolume(input.musicVolume, current.musicVolume),
      soundVolume: preferenceVolume(input.soundVolume, current.soundVolume),
      damageFloatsEnabled:
        typeof input.damageFloatsEnabled === 'boolean'
          ? input.damageFloatsEnabled
          : current.damageFloatsEnabled,
      damageFloatSize: preferenceDamageSize(
        input.damageFloatSize,
        current.damageFloatSize,
      ),
      damageFloatScale: preferenceRange(
        input.damageFloatScale,
        current.damageFloatScale,
        10,
        1000,
      ),
      damageFloatOpacity: preferenceRange(
        input.damageFloatOpacity,
        current.damageFloatOpacity,
        10,
        100,
      ),
      damageFloatWeight: [400, 500, 600, 700, 800, 900].includes(
        Number(input.damageFloatWeight),
      )
        ? Number(input.damageFloatWeight)
        : current.damageFloatWeight,
      damageFloatFont: damageFloatFonts.has(String(input.damageFloatFont))
        ? String(input.damageFloatFont)
        : current.damageFloatFont,
      damageFloatPositionX: preferenceRange(
        input.damageFloatPositionX,
        current.damageFloatPositionX,
        0,
        100,
      ),
      damageFloatPositionY: preferenceRange(
        input.damageFloatPositionY,
        current.damageFloatPositionY,
        0,
        100,
      ),
      damageFloatArc: preferenceRange(
        input.damageFloatArc,
        current.damageFloatArc,
        0,
        200,
      ),
      petCompanionEnabled:
        typeof input.petCompanionEnabled === 'boolean'
          ? input.petCompanionEnabled
          : current.petCompanionEnabled,
      petCompanionSpecies: petCompanionSpecies.has(String(input.petCompanionSpecies))
        ? String(input.petCompanionSpecies)
        : current.petCompanionSpecies,
      petCompanionSize: preferenceRange(
        input.petCompanionSize,
        current.petCompanionSize,
        48,
        1200,
      ),
      petActivityLevel: petActivityLevels.has(String(input.petActivityLevel))
        ? String(input.petActivityLevel)
        : current.petActivityLevel,
      petIdleSleepEnabled:
        typeof input.petIdleSleepEnabled === 'boolean'
          ? input.petIdleSleepEnabled
          : current.petIdleSleepEnabled,
      petReduceActivityInLog:
        typeof input.petReduceActivityInLog === 'boolean'
          ? input.petReduceActivityInLog
          : current.petReduceActivityInLog,
      showPetInProfile:
        typeof input.showPetInProfile === 'boolean'
          ? input.showPetInProfile
          : current.showPetInProfile,
      showPetInRanking:
        typeof input.showPetInRanking === 'boolean'
          ? input.showPetInRanking
          : current.showPetInRanking,
    };
  await sql(
    `INSERT INTO web_preferences (account_id,music_enabled,sound_enabled,music_volume,sound_volume,damage_floats_enabled,damage_float_size,damage_float_scale,damage_float_opacity,damage_float_weight,damage_float_font,damage_float_position_x,damage_float_position_y,damage_float_arc,pet_companion_enabled,pet_companion_species,pet_companion_size,pet_activity_level,pet_idle_sleep_enabled,pet_reduce_activity_in_log,show_pet_in_profile,show_pet_in_ranking,updated_at) VALUES (${Number(accountId)},${next.musicEnabled ? 1 : 0},${next.soundEnabled ? 1 : 0},${next.musicVolume},${next.soundVolume},${next.damageFloatsEnabled ? 1 : 0},${next.damageFloatSize},${next.damageFloatScale},${next.damageFloatOpacity},${next.damageFloatWeight},'${next.damageFloatFont}',${next.damageFloatPositionX},${next.damageFloatPositionY},${next.damageFloatArc},${next.petCompanionEnabled ? 1 : 0},'${next.petCompanionSpecies}',${next.petCompanionSize},'${next.petActivityLevel}',${next.petIdleSleepEnabled ? 1 : 0},${next.petReduceActivityInLog ? 1 : 0},${next.showPetInProfile ? 1 : 0},${next.showPetInRanking ? 1 : 0},${Date.now()}) ON DUPLICATE KEY UPDATE music_enabled=VALUES(music_enabled),sound_enabled=VALUES(sound_enabled),music_volume=VALUES(music_volume),sound_volume=VALUES(sound_volume),damage_floats_enabled=VALUES(damage_floats_enabled),damage_float_size=VALUES(damage_float_size),damage_float_scale=VALUES(damage_float_scale),damage_float_opacity=VALUES(damage_float_opacity),damage_float_weight=VALUES(damage_float_weight),damage_float_font=VALUES(damage_float_font),damage_float_position_x=VALUES(damage_float_position_x),damage_float_position_y=VALUES(damage_float_position_y),damage_float_arc=VALUES(damage_float_arc),pet_companion_enabled=VALUES(pet_companion_enabled),pet_companion_species=VALUES(pet_companion_species),pet_companion_size=VALUES(pet_companion_size),pet_activity_level=VALUES(pet_activity_level),pet_idle_sleep_enabled=VALUES(pet_idle_sleep_enabled),pet_reduce_activity_in_log=VALUES(pet_reduce_activity_in_log),show_pet_in_profile=VALUES(show_pet_in_profile),show_pet_in_ranking=VALUES(show_pet_in_ranking),updated_at=VALUES(updated_at);`,
  );
  preferenceCache.set(Number(accountId), { at: Date.now(), value: next });
  return next;
}
const automationRecoveryFailures = new Map();
let automationRecoveryRunning = false;
async function desiredAutomationAccounts() {
  const output = await sql(
    `SELECT a.account_id,c.char_id FROM web_automation a JOIN login l ON l.account_id=a.account_id JOIN \`char\` c ON c.account_id=a.account_id AND c.char_num=0 WHERE a.desired_running=1 AND l.state=0;`,
  );
  return output
    ? output.split(/\r?\n/).map((line) => {
        const [accountId, characterId] = line.split('\t').map(Number);
        return { accountId, characterId };
      }).filter((account) => Number.isSafeInteger(account.accountId) && Number.isSafeInteger(account.characterId))
    : [];
}
async function restoreAutomationWorkers() {
  // Isolated-test mode never restores production-derived intent.
  const accounts = automationRecoveryCandidates(
    await desiredAutomationAccounts(),
    { runtimeMode },
  );
  let restored = 0;
  for (const account of accounts) {
    try {
      const recoveryController = await readCharacterControllerStatus(account, Number(account.characterId), {
        includeFarmTarget: false,
      });
      if (recoveryController.available && recoveryController.controller === SERVER_AGENT_OWNER)
        continue;
      const wasRunning = (await currentWorkerState(instanceId(account.accountId))).running;
      await startWorker(account);
      if (!wasRunning) restored += 1;
    } catch (error) {
      console.error(
        `Unable to restore player_${account.accountId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
  if (restored) console.log(`Restored ${restored} automation worker(s).`);
}
async function reconcileAutomationWorkers() {
  if (automationRecoveryRunning) return;
  automationRecoveryRunning = true;
  try {
    const accounts = automationRecoveryCandidates(
      await desiredAutomationAccounts(),
      { runtimeMode },
    );
    const desiredIds = new Set(accounts.map((account) => account.accountId));
    for (const accountId of automationRecoveryFailures.keys())
      if (!desiredIds.has(accountId)) automationRecoveryFailures.delete(accountId);
    for (const account of accounts) {
      const reconcileController = await readCharacterControllerStatus(account, Number(account.characterId), {
        includeFarmTarget: false,
      });
      if (reconcileController.available && reconcileController.controller === SERVER_AGENT_OWNER)
        continue;
      const id = instanceId(account.accountId);
      if ((await currentWorkerState(id)).running) {
        automationRecoveryFailures.delete(account.accountId);
        continue;
      }
      const previous = automationRecoveryFailures.get(account.accountId) ?? {
        attempts: 0,
        retryAt: 0,
      };
      if (Date.now() < previous.retryAt) continue;
      try {
        await startWorker(account);
        if (!(await currentWorkerState(id)).running)
          throw new Error('worker process did not remain active');
        automationRecoveryFailures.delete(account.accountId);
        console.log(`Recovered idle automation worker ${id}.`);
      } catch (error) {
        const attempts = previous.attempts + 1;
        const delayMs = Math.min(300_000, 30_000 * 2 ** Math.min(attempts - 1, 4));
        automationRecoveryFailures.set(account.accountId, {
          attempts,
          retryAt: Date.now() + delayMs,
        });
        console.error(
          `Unable to recover idle automation worker ${id}; retrying in ${Math.round(delayMs / 1000)}s:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  } finally {
    automationRecoveryRunning = false;
  }
}

function safeTarget(base, pathname) {
  const target = normalize(join(base, pathname));
  const rel = relative(base, target);
  return !rel.startsWith('..') && !isAbsolute(rel) ? target : null;
}

function validFld2(bytes) {
  if (bytes.length < 4) return false;
  const width = bytes.readUInt16LE(0);
  const height = bytes.readUInt16LE(2);
  return width > 0 && height > 0 && bytes.length === width * height + 4;
}

function parseRathenaMapCache(bytes) {
  const maps = new Map();
  if (bytes.length < 8) return maps;
  const mapCount = bytes.readUInt16LE(4);
  let offset = 8;
  for (let index = 0; index < mapCount; index += 1) {
    if (offset + 20 > bytes.length) break;
    const name = bytes
      .subarray(offset, offset + 12)
      .toString('ascii')
      .replace(/\0.*$/, '');
    const width = bytes.readInt16LE(offset + 12);
    const height = bytes.readInt16LE(offset + 14);
    const compressedLength = bytes.readInt32LE(offset + 16);
    const compressedStart = offset + 20;
    const compressedEnd = compressedStart + compressedLength;
    if (
      !name ||
      width <= 0 ||
      height <= 0 ||
      compressedLength <= 0 ||
      compressedEnd > bytes.length
    )
      break;
    maps.set(name, {
      width,
      height,
      compressed: bytes.subarray(compressedStart, compressedEnd),
    });
    offset = compressedEnd;
  }
  return maps;
}

async function loadRathenaMapCache() {
  if (!rathenaMapCachePromise) {
    rathenaMapCachePromise = (async () => {
      const maps = new Map();
      for (const path of [
        join(runtime, 'rathena', 'db', 'import', 'map_cache.dat'),
        join(runtime, 'rathena', 'db', 're', 'map_cache.dat'),
        join(runtime, 'rathena', 'db', 'map_cache.dat'),
      ]) {
        try {
          for (const [name, map] of parseRathenaMapCache(
            await readFile(path),
          )) {
            if (!maps.has(name)) maps.set(name, map);
          }
        } catch {
          // An optional cache may be absent; continue to the next source.
        }
      }
      return maps;
    })();
  }
  return await rathenaMapCachePromise;
}

async function runtimeMapField(mapName) {
  if (mapFieldResponseCache.has(mapName))
    return mapFieldResponseCache.get(mapName);

  const fieldsRoot = join(runtime, 'openkore', 'fields');
  const target = safeTarget(fieldsRoot, `${mapName}.fld2.gz`);
  if (target) {
    try {
      const content = await readFile(target);
      if (validFld2(gunzipSync(content))) {
        const result = { content, source: 'openkore-runtime' };
        mapFieldResponseCache.set(mapName, result);
        return result;
      }
    } catch {
      // Missing or invalid OpenKore fields fall through to the server cache.
    }
  }

  const map = (await loadRathenaMapCache()).get(mapName);
  if (!map) return null;
  try {
    const rawCells = inflateSync(map.compressed);
    if (rawCells.length !== map.width * map.height) return null;
    const fld2 = Buffer.alloc(rawCells.length + 4);
    fld2.writeUInt16LE(map.width, 0);
    fld2.writeUInt16LE(map.height, 2);
    const fld2CellByGatType = Uint8Array.from([1, 0, 4, 5, 6, 10, 8]);
    for (let index = 0; index < rawCells.length; index += 1)
      fld2[index + 4] = fld2CellByGatType[rawCells[index]] ?? 0;
    const result = {
      content: gzipSync(fld2, { level: 9 }),
      source: 'rathena-cache',
    };
    mapFieldResponseCache.set(mapName, result);
    return result;
  } catch {
    return null;
  }
}

async function serveRuntimeMapField(pathname, response) {
  const match = pathname.match(/^\/ro\/maps\/([^/]+)\.fld2\.bin$/i);
  if (!match) return false;
  let mapName;
  try {
    mapName = decodeURIComponent(match[1]);
  } catch {
    return false;
  }
  if (!/^[a-z0-9_@-]{1,24}$/i.test(mapName)) return false;
  const field = await runtimeMapField(mapName);
  if (!field) return false;
  response.writeHead(200, {
    'content-type': 'application/octet-stream',
    'content-encoding': 'gzip',
    'content-length': field.content.length,
    'cache-control': 'public, max-age=3600',
    'x-ro-map-source': field.source,
    ...securityHeaders,
  });
  response.end(field.content);
  return true;
}
// Host-based surface split: the Admin hostname must land on the Server Ops
// surface at `/`, never on the Player Web login. Only the root path differs;
// /admin/* and /api/* are unchanged, and play/localhost are untouched.
const adminSurfaceHosts = new Set(
  String(process.env.RO_ADMIN_HOSTS ?? 'admin.g8land.com')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);
function isAdminSurfaceHost(request) {
  const host = String(request?.headers?.host ?? '')
    .split(':')[0]
    .toLowerCase();
  return adminSurfaceHosts.has(host);
}
async function serveFile(pathname, response, request) {
  const isPublic = pathname.startsWith('/ro/');
  if (pathname.startsWith('/admin/') &&
      !isAdminSurfaceHost(request) && !adminActorFromRequest(request))
    return false;
  // Admin host root must redirect to the Server Ops document at its REAL url so
  // that the document's relative assets (./server-ops.js, styles) resolve under
  // /admin/ instead of / (which 404s and leaves the page stuck at 載入中).
  if (!isPublic && pathname === '/' && isAdminSurfaceHost(request)) {
    response.writeHead(302, { location: '/admin/server-ops.html', ...securityHeaders });
    response.end();
    return true;
  }
  const base = isPublic ? publicRoot : webRoot,
    requested = isPublic
      ? pathname.slice(1)
      : pathname === '/'
        ? 'index.html'
        : pathname.slice(1),
    target = safeTarget(base, requested);
  if (!target) return false;
  try {
    const content = await readFile(target);
    response.writeHead(200, {
      'content-type':
        mime[extname(target).toLowerCase()] ?? 'application/octet-stream',
      'cache-control':
        isPublic && !pathname.includes('/maps/')
          ? 'public, max-age=3600'
          : 'no-store',
      ...securityHeaders,
    });
    response.end(content);
    return true;
  } catch {
    return await serveRuntimeMapField(pathname, response);
  }
}
async function serveVoice(voiceId, response) {
  if (!/^[a-f0-9-]{36}$/i.test(voiceId)) return false;
  const output = await sql(
    `SELECT mime_type,file_ext FROM web_voice_messages WHERE voice_id='${escapeSql(voiceId)}' LIMIT 1;`,
  );
  if (!output) return false;
  const [mimeType, extension] = output.split('\t');
  if (!voiceTypes.has(mimeType) || voiceTypes.get(mimeType) !== extension)
    return false;
  try {
    const content = await readFile(join(voiceRoot, `${voiceId}.${extension}`));
    response.writeHead(200, {
      'content-type': mimeType,
      'content-length': content.length,
      'cache-control': 'private, max-age=3600',
      'content-disposition': 'inline',
      ...securityHeaders,
    });
    response.end(content);
    return true;
  } catch {
    return false;
  }
}
function sessionCookie(token, request, maxAgeSeconds = 604800) {
  const secure =
    request.headers['cf-connecting-ip'] ||
    String(request.headers['x-forwarded-proto'] ?? '')
      .split(',')[0]
      .trim() === 'https';
  const boundedMaxAge = Math.max(1, Math.min(604800, Number(maxAgeSeconds) || 604800));
  return `ro_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${boundedMaxAge}${secure ? '; Secure' : ''}`;
}

// PHASE_4B_ADMIN_FIXTURE_NAVIGATION_PRODUCER: the Admin surface may submit a
// bounded fixture movement intent for an already-authorized test character.
// The route is resolved here and delivered through the existing ownership
// command contract. No player session, projection write, Social dispatch or
// second navigation executor is introduced.
async function runAdminFixtureNavigation(charId, input) {
  const id = Number(charId);
  const identity = await readAdminCharacterIdentity(id);
  const parsed = parseAdminFixtureNavigationInput(input);
  if (!parsed.ok) throw new HttpError(422, parsed.reason);
  if (!mapRoutingIndex.maps?.[parsed.targetMap])
    throw new HttpError(409, 'target_map_unresolved');

  const rollout = await readPersistentAgentRollout(
    sql,
    identity.accountId,
    id,
  );
  if (!rollout.allowed) throw new HttpError(403, rollout.reason);

  const snapshot = await readAdminAgentSnapshot(id);
  const stateRow = snapshot.stateRow;
  const live = snapshot.live;
  if (
    !stateRow ||
    stateRow.controlOwner !== SERVER_AGENT_OWNER ||
    stateRow.ownershipState !== SERVER_AGENT_OWNER ||
    !stateRow.agentEnabled
  )
    throw new HttpError(409, 'agent_not_owner');
  if (!live?.resident || !live.fresh || !live.map)
    throw new HttpError(409, 'agent_position_unavailable');

  const latestNavigation = await readLatestNoviceCommand(id, 'start_navigation');
  if (
    pendingRelocations.has(id) ||
    navigationCommandIsPending(latestNavigation?.status)
  )
    throw new HttpError(409, 'navigation_already_pending');

  const plan = live.map === parsed.targetMap
    ? { route: null, reason: 'already_at_destination' }
    : planWebRelocation(
      await serverAgentWarpGraph(),
      live.map,
      parsed.targetMap,
    );
  const route = buildAdminFixtureNavigationRoute({
    currentMap: live.map,
    targetMap: parsed.targetMap,
    targetX: parsed.targetX,
    targetY: parsed.targetY,
    resolvedRoute: plan.route,
  });
  if (!route) throw new HttpError(409, 'route_failed');

  const account = { accountId: identity.accountId, characterId: id };
  const command = await queueOwnershipCommand(
    account,
    id,
    { action: 'start_navigation', expectedRevision: Number(stateRow.revision) },
    { route },
  );
  await recordRolloutEvent(sql, {
    accountId: identity.accountId,
    charId: id,
    eventType: 'ADMIN_FIXTURE_NAVIGATION_QUEUED',
    commandId: command.commandId,
  }).catch(() => {});
  return {
    ok: true,
    charId: id,
    executor: SERVER_AGENT_OWNER,
    target: {
      map: parsed.targetMap,
      x: parsed.targetX,
      y: parsed.targetY,
    },
    command,
  };
}

async function readCharacterBaseLevel(account) {
  const output = await sql(
    `SELECT base_level FROM \`char\` WHERE char_id=${Number(account.characterId)} AND account_id=${Number(account.accountId)} LIMIT 1;`,
  );
  if (!output) return null;
  const level = Number(output.trim());
  return Number.isSafeInteger(level) && level >= 1 ? level : null;
}

async function ensureDefaultGrindTarget(account, existingTarget) {
  if (existingTarget?.source === FARM_MAP_SOURCE.PLAYER_OVERRIDE)
    return existingTarget;
  // A legacy record without source is preserved and excluded from automatic
  // policy writes until a player explicitly chooses a map again.
  if (existingTarget?.legacyUnclassified) return existingTarget;
  let baseLevel;
  try {
    baseLevel = await readCharacterBaseLevel(account);
  } catch {
    return existingTarget;
  }
  if (baseLevel === null) return existingTarget;
  const resolved = resolveDefaultFarmTarget(firstJobContent, baseLevel);
  const eligibility = farmMapEligibility(resolved.mapId);
  if (!eligibility.map || !eligibility.farmable) return existingTarget;
  if (
    existingTarget?.source === FARM_MAP_SOURCE.DEFAULT_POLICY &&
    existingTarget.mapId === resolved.mapId
  )
    return existingTarget;
  const target = {
    mapId: resolved.mapId,
    name: eligibility.map.name ?? resolved.mapId,
    levelRange: eligibility.map.levelRange ?? null,
    source: FARM_MAP_SOURCE.DEFAULT_POLICY,
    updatedAt: Date.now(),
  };
  const targetPath = join(
    instancesRoot,
    instanceId(account.accountId),
    'grind-target.json',
  );
  try {
    await writeJsonAtomic(targetPath, target);
  } catch {
    return existingTarget;
  }
  observationConfigCache.set(`grind:${Number(account.accountId)}`, {
    at: Date.now(),
    value: target,
    pending: null,
  });
  return target;
}

async function handleAdminFixtureNavigationRequest(url, request, response) {
  const match = url.pathname.match(
    /^\/api\/admin\/characters\/(\d{1,10})\/agent\/fixture-navigation$/,
  );
  if (!match) return false;
  const requestedCharId = Number(match[1]);
  if (!isAdminSurfaceHost(request)) {
    await recordRolloutEvent(sql, {
      accountId: 0,
      charId: requestedCharId,
      eventType: 'ADMIN_FIXTURE_NAVIGATION_REJECTED',
      errorCode: 'admin_auth_required',
    }).catch(() => {});
    json(response, 403, { error: 'admin_auth_required' });
    return true;
  }
  if (request.method !== 'POST') {
    json(response, 405, { error: 'method_not_allowed' });
    return true;
  }
  if (adminAgentOperationLocks.has(requestedCharId)) {
    json(response, 409, {
      ok: false,
      charId: requestedCharId,
      action: 'fixture_navigation',
      phase: 'failed',
      error: 'operation_in_progress',
      blocker: 'operation_in_progress',
    });
    return true;
  }
  adminAgentOperationLocks.set(requestedCharId, 'fixture_navigation');
  try {
    const result = await runAdminFixtureNavigation(
      requestedCharId,
      await requestBody(request),
    );
    json(response, 202, result);
  } catch (error) {
    const blocker =
      error instanceof HttpError ? error.message : 'fixture_navigation_failed';
    await recordRolloutEvent(sql, {
      accountId: 0,
      charId: requestedCharId,
      eventType: 'ADMIN_FIXTURE_NAVIGATION_REJECTED',
      errorCode: blocker,
    }).catch(() => {});
    console.error(
      `Admin fixture navigation failed char=${requestedCharId}:`,
      error,
    );
    json(response, error instanceof HttpError ? error.statusCode : 500, {
      ok: false,
      charId: requestedCharId,
      action: 'fixture_navigation',
      phase: 'failed',
      error: blocker,
      blocker,
    });
  } finally {
    adminAgentOperationLocks.delete(requestedCharId);
  }
  return true;
}

function adminTestFixtureTransportContext(request) {
  const localActor = adminActorFromRequest(request);
  const localHost = /^(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(String(request.headers.host ?? ''));
  if (localActor && localHost && loopbackRequest(request))
    return { context: 'ADMIN_TRANSPORT', actorAdminId: localActor,
      authMethod: 'LOCAL_ADMIN_TOKEN' };
  if (isAdminSurfaceHost(request))
    return { context: 'ADMIN_TRANSPORT', actorAdminId: 'CLOUDFLARE_ACCESS_EDGE',
      authMethod: 'CLOUDFLARE_ACCESS_EDGE' };
  return null;
}

async function grantNativeTestFixtureCommand(normalized) {
  // One short-lived command grant satisfies Native's existing session check.
  // It is never a Browser credential or a Player Web session.
  await sql(`CREATE TABLE IF NOT EXISTS web_admin_sessions (
    session_hash CHAR(64) NOT NULL PRIMARY KEY,
    session_id CHAR(36) NOT NULL UNIQUE,
    actor_admin_id VARCHAR(128) NOT NULL,
    auth_method VARCHAR(48) NOT NULL,
    created_from VARCHAR(64) NOT NULL,
    created_at BIGINT UNSIGNED NOT NULL,
    expires_at BIGINT UNSIGNED NOT NULL,
    revoked_at BIGINT UNSIGNED NULL,
    INDEX admin_session_actor_idx (actor_admin_id),
    INDEX admin_session_expiry_idx (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  const createdAt = Date.now();
  const sessionHash = createHash('sha256').update(normalized.adminSessionId).digest('hex');
  const createdFrom = normalized.createdFrom === 'M1_FLY_SUPPLY_V1'
    ? 'M1_FLY_SUPPLY_V1' : 'TEST_FIXTURE_COMMAND';
  await sql(`INSERT INTO web_admin_sessions
    (session_hash,session_id,actor_admin_id,auth_method,created_from,created_at,expires_at,revoked_at)
    VALUES ('${sessionHash}','${escapeSql(normalized.adminSessionId)}',
    '${escapeSql(normalized.adminActorId)}','${escapeSql(normalized.adminAuthMethod)}',
    '${createdFrom}',${createdAt},${createdAt + 300000},NULL);`);
}

async function handleAdminTestFixtureCommand(url, request, response) {
  const isSubmit = url.pathname === '/api/admin/test-fixture/command';
  const resultMatch = url.pathname.match(/^\/api\/admin\/test-fixture\/command\/([0-9a-f-]{36})$/i);
  const isM1Submit = url.pathname === '/api/admin/test-fixture/m1-acceptance';
  const m1ResultMatch = url.pathname.match(/^\/api\/admin\/test-fixture\/m1-acceptance\/([0-9a-f-]{36})$/i);
  if (!isSubmit && !resultMatch && !isM1Submit && !m1ResultMatch) return false;
  const adminContext = adminTestFixtureTransportContext(request);
  if (!adminContext || ((isM1Submit || m1ResultMatch) && adminContext.authMethod !== 'LOCAL_ADMIN_TOKEN')) {
    json(response, 403, { error: 'admin_auth_required' });
    return true;
  }
  if (((isSubmit || isM1Submit) && request.method !== 'POST') ||
      ((resultMatch || m1ResultMatch) && request.method !== 'GET')) {
    json(response, 405, { error: 'method_not_allowed' });
    return true;
  }
  if (!fixtureTransportEnabled((isM1Submit || m1ResultMatch) ? 'M1_ACCEPTANCE' : 'GENERIC')) {
    json(response, 503, { error: 'fixture_transport_disabled' });
    return true;
  }
  try {
    const registry = JSON.parse(await readFile(
      new URL('../../docs/project-control/canonical-test-fixtures.json', import.meta.url), 'utf8'));
    const transport = (isM1Submit || m1ResultMatch
      ? createM1AcceptanceFixtureTransport : createTestFixtureCommandTransport)({
      sql, escapeSql, registry,
      audit: (event) => recordRolloutEvent(sql, event),
      nativeGrant: grantNativeTestFixtureCommand,
    });
    const result = (isSubmit || isM1Submit)
      ? await transport.submit(await requestBody(request),
        { ...adminContext, sessionId: randomUUID() })
      : m1ResultMatch
        ? await transport.result(m1ResultMatch[1], adminContext)
        : await transport.result(resultMatch[1], url.searchParams.get('fixtureRole'), adminContext);
    json(response, result.status, result.body);
  } catch {
    console.error('Admin test fixture command unavailable.');
    json(response, 503, { error: 'fixture_command_unavailable' });
  }
  return true;
}

async function createSupportSession(request, body) {
  const actorAdminId = adminActorFromRequest(request);
  if (!actorAdminId) throw new HttpError(403, 'admin_auth_required');
  const normalized = normalizeSupportSessionInput(body);
  if (!normalized.ok) throw new HttpError(422, normalized.error);
  const charOutput = await sql(`SELECT c.char_id,c.account_id,l.userid,c.name
    FROM \`char\` c JOIN login l ON l.account_id=c.account_id
    WHERE c.char_id=${normalized.effectiveCharId} LIMIT 1;`);
  if (!charOutput) throw new HttpError(404, 'character_not_found');
  const [charId, accountId, username, characterName] = charOutput.split('\t');
  if (body.effectiveAccountId != null && Number(body.effectiveAccountId) !== Number(accountId))
    throw new HttpError(403, 'support_effective_account_mismatch');
  const supportSessionId = randomUUID();
  const token = randomBytes(32).toString('hex');
  const now = normalized.createdAt;
  await sql(`DELETE FROM web_sessions WHERE expires_at<=${now};
    INSERT INTO web_sessions (token_hash,account_id,created_at,expires_at,support_session_id,actor_admin_id,effective_char_id,support_reason,support_mode,created_from,support_revoked_at)
    VALUES ('${tokenHash(token)}',${Number(accountId)},${now},${normalized.expiresAt},'${supportSessionId}','${escapeSql(actorAdminId)}',${Number(charId)},'${escapeSql(normalized.reason)}','${normalized.mode}','${SUPPORT_SESSION_CREATED_FROM}',NULL);`);
  const context = {
    supportSessionId, actorAdminId, accountId: Number(accountId), characterId: Number(charId),
    reason: normalized.reason, mode: normalized.mode, createdFrom: SUPPORT_SESSION_CREATED_FROM,
    createdAt: now, expiresAt: normalized.expiresAt,
  };
  await recordSupportSessionEvent({
    ...context,
    effectiveAccountId: Number(accountId),
    effectiveCharId: Number(charId),
    eventType: 'SUPPORT_SESSION_CREATED',
    traceId: request.headers['x-scenario-trace-id'] ?? null,
    occurredAt: now,
  });
  return {
    supportSession: {
      ...supportContextView(context),
      effectiveAccountId: Number(accountId),
      effectiveCharId: Number(charId),
      effectiveUsername: username,
      effectiveCharacterName: characterName,
    },
    token,
  };
}

async function listSupportSessions(request) {
  if (!adminActorFromRequest(request)) throw new HttpError(403, 'admin_auth_required');
  const now = Date.now();
  await sql(`UPDATE web_sessions SET support_revoked_at=${now}
    WHERE support_session_id IS NOT NULL AND support_revoked_at IS NULL AND expires_at<=${now};`).catch(() => {});
  const output = await sql(`SELECT support_session_id,actor_admin_id,account_id,effective_char_id,support_reason,support_mode,created_from,created_at,expires_at
    FROM web_sessions WHERE support_session_id IS NOT NULL AND support_revoked_at IS NULL AND expires_at>${now}
    ORDER BY created_at DESC LIMIT 100;`);
  return {
    sessions: (output ? output.split(/\r?\n/).filter(Boolean) : []).map((line) => {
      const row = line.split('\t');
      return supportContextView({
        supportSessionId: row[0], actorAdminId: row[1], accountId: Number(row[2]), characterId: Number(row[3]),
        reason: row[4], mode: row[5], createdFrom: row[6], createdAt: Number(row[7]), expiresAt: Number(row[8]),
      });
    }),
  };
}

async function revokeSupportSession(request, supportSessionId) {
  if (!adminActorFromRequest(request)) throw new HttpError(403, 'admin_auth_required');
  if (!/^[0-9a-f-]{36}$/i.test(supportSessionId)) throw new HttpError(422, 'support_session_invalid');
  const now = Date.now();
  const output = await sql(`SELECT support_session_id,actor_admin_id,account_id,effective_char_id,support_reason,support_mode,created_from,created_at,expires_at,support_revoked_at
    FROM web_sessions WHERE support_session_id='${escapeSql(supportSessionId)}' LIMIT 1;`);
  if (!output) throw new HttpError(404, 'support_session_not_found');
  const row = output.split('\t');
  const context = {
    supportSessionId: row[0], actorAdminId: row[1], accountId: Number(row[2]), characterId: Number(row[3]),
    reason: row[4], mode: row[5], createdFrom: row[6], createdAt: Number(row[7]), expiresAt: Number(row[8]),
  };
  if (!row[9] || row[9] === 'NULL') {
    await sql(`UPDATE web_sessions SET support_revoked_at=${now} WHERE support_session_id='${escapeSql(supportSessionId)}' AND support_revoked_at IS NULL;`);
    await recordSupportSessionEvent({
      ...context,
      effectiveAccountId: context.accountId,
      effectiveCharId: context.characterId,
      eventType: 'SUPPORT_SESSION_REVOKED',
      traceId: request.headers['x-scenario-trace-id'] ?? null,
      occurredAt: now,
    });
  }
  for (const [hash, cached] of sessionCache)
    if (cached.account?.supportSessionId === supportSessionId) sessionCache.delete(hash);
  return { revoked: true, supportSessionId, revokedAt: now };
}

async function revokeSupportSessionByHolder(request, context) {
  if (!context?.supportSessionId) throw new HttpError(401, 'support_session_required');
  const now = Date.now();
  await sql(`UPDATE web_sessions SET support_revoked_at=${now}
    WHERE support_session_id='${escapeSql(context.supportSessionId)}' AND support_revoked_at IS NULL;`);
  await recordSupportSessionEvent({
    ...context,
    effectiveAccountId: context.accountId,
    effectiveCharId: context.characterId,
    eventType: 'SUPPORT_SESSION_REVOKED',
    traceId: request.headers['x-scenario-trace-id'] ?? null,
    occurredAt: now,
  }).catch(() => {});
  for (const [hash, cached] of sessionCache)
    if (cached.account?.supportSessionId === context.supportSessionId) sessionCache.delete(hash);
  return { revoked: true, supportSessionId: context.supportSessionId, revokedAt: now };
}

function adminRecoveryTransportContext(request) {
  return adminTestFixtureTransportContext(request);
}

async function grantNativeQuarantineRecovery({ sessionId, actorAdminId, authMethod }) {
  // This short-lived Native command grant is neither a Browser nor a Player session.
  await sql(`CREATE TABLE IF NOT EXISTS web_admin_sessions (
    session_hash CHAR(64) NOT NULL PRIMARY KEY,
    session_id CHAR(36) NOT NULL UNIQUE,
    actor_admin_id VARCHAR(128) NOT NULL,
    auth_method VARCHAR(48) NOT NULL,
    created_from VARCHAR(64) NOT NULL,
    created_at BIGINT UNSIGNED NOT NULL,
    expires_at BIGINT UNSIGNED NOT NULL,
    revoked_at BIGINT UNSIGNED NULL,
    INDEX admin_session_actor_idx (actor_admin_id),
    INDEX admin_session_expiry_idx (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  const createdAt = Date.now();
  const sessionHash = createHash('sha256').update(sessionId).digest('hex');
  await sql(`INSERT INTO web_admin_sessions
    (session_hash,session_id,actor_admin_id,auth_method,created_from,created_at,expires_at,revoked_at)
    VALUES ('${sessionHash}','${escapeSql(sessionId)}','${escapeSql(actorAdminId)}',
      '${escapeSql(authMethod)}','QUARANTINE_RECOVERY',${createdAt},${createdAt + 300000},NULL);`);
}

let adminRecoveryAuditSchemaPromise;
function ensureAdminRecoveryAuditSchema() {
  adminRecoveryAuditSchemaPromise ??= (async () => {
    await sql(`CREATE TABLE IF NOT EXISTS web_admin_quarantine_recovery_events (
    event_id CHAR(36) NOT NULL PRIMARY KEY,
    actor_admin_id VARCHAR(128) NULL,
    source VARCHAR(32) NOT NULL DEFAULT 'ADMIN_BROWSER',
    request_id CHAR(36) NULL,
    char_id INT UNSIGNED NOT NULL,
    command_id CHAR(36) NULL,
    action VARCHAR(48) NOT NULL,
    result VARCHAR(64) NOT NULL,
    before_state_json LONGTEXT NULL,
    after_state_json LONGTEXT NULL,
    occurred_at BIGINT UNSIGNED NOT NULL,
    INDEX recovery_char_time_idx (char_id,occurred_at),
    INDEX recovery_command_idx (command_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    await sql(`ALTER TABLE web_admin_quarantine_recovery_events
      ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'ADMIN_BROWSER',
      ADD COLUMN IF NOT EXISTS request_id CHAR(36) NULL;`);
  })().catch((error) => {
    adminRecoveryAuditSchemaPromise = null;
    throw error;
  });
  return adminRecoveryAuditSchemaPromise;
}

async function auditAdminQuarantineRecovery(event) {
  await ensureAdminRecoveryAuditSchema();
  const nullable = (value) => value == null ? 'NULL' : `'${escapeSql(value)}'`;
  await sql(`INSERT INTO web_admin_quarantine_recovery_events
    (event_id,actor_admin_id,source,request_id,char_id,command_id,action,result,before_state_json,after_state_json,occurred_at)
    VALUES ('${randomUUID()}',${nullable(event.adminIdentity)},'${escapeSql(event.source)}',
      ${nullable(event.requestId)},${Number(event.charId) || 0},
      ${nullable(event.commandId)},'${escapeSql(event.action)}','${escapeSql(event.result)}',
      ${nullable(event.beforeState && JSON.stringify(event.beforeState))},
      ${nullable(event.afterState && JSON.stringify(event.afterState))},${Number(event.timestamp)});`);
}

const adminQuarantineRecoveryTransport = createAdminQuarantineRecoveryTransport({
  sql,
  audit: auditAdminQuarantineRecovery,
  issueGrant: grantNativeQuarantineRecovery,
});

async function handleDashboardRequest(request, response) {
  const requestStarted = performance.now();
  let requestMetricUrl = null;
  response.once('finish', () => {
    recordRequestMetric(
      metricDomain(requestMetricUrl),
      response.statusCode,
      performance.now() - requestStarted,
      Number(response.observationPayloadBytes ?? 0),
    );
  });
  try {
    const url = new URL(
      request.url ?? '/',
      `http://${request.headers.host ?? 'localhost'}`,
    );
    requestMetricUrl = url;
    if (await discordRouteHandler(url, request, response)) return;
    if (url.pathname.startsWith('/api/admin/') &&
        !isAdminSurfaceHost(request) && !adminActorFromRequest(request)) {
      return json(response, 403, { error: 'admin_auth_required' });
    }
    if (!url.pathname.startsWith('/api/')) {
      if (await serveFile(url.pathname, response, request)) return;
      return json(response, 404, { error: 'not_found' });
    }
    if (!mutationOriginAllowed(request))
      return json(response, 403, { error: '拒絕跨站操作' });
    if (url.pathname.startsWith('/api/admin/') && !adminRecoveryTransportContext(request)) {
      if (!adminActorFromRequest(request))
        return json(response, 403, { error: 'admin_auth_required' });
    }
    let accountResolved = false;
    let resolvedAccount = null;
    const resolveRequestAccount = async () => {
      if (!accountResolved) {
        resolvedAccount = await sessionAccount(request);
        accountResolved = true;
      }
      return resolvedAccount;
    };
    let supportRequestContext = null;
    if (mutationMethods.has(request.method ?? 'GET') || url.pathname.startsWith('/api/admin/'))
      supportRequestContext = supportContextFromAccount(await resolveRequestAccount());
    if (supportRequestContext && url.pathname.startsWith('/api/admin/'))
      return json(response, 403, { error: 'support_admin_boundary' });
    let supportMutationDecision = null;
    if (supportRequestContext && mutationMethods.has(request.method ?? 'GET')) {
      const needsBody = url.pathname === '/api/automation' || url.pathname === '/api/item-action';
      const body = needsBody ? await requestBody(request) : {};
      supportMutationDecision = classifySupportMutation(supportRequestContext, {
        method: request.method,
        path: url.pathname,
        body,
      });
      if (!supportMutationDecision.allowed) {
        await recordSupportActionEvent({
          ...supportRequestContext,
          effectiveAccountId: supportRequestContext.accountId,
          effectiveCharId: supportRequestContext.characterId,
          actionKey: supportMutationDecision.actionKey,
          resource: supportMutationDecision.resource,
          result: 'DENIED',
          errorCode: supportMutationDecision.errorCode,
          traceId: request.headers['x-scenario-trace-id'] ?? null,
          occurredAt: Date.now(),
        }).catch(() => {});
        return json(response, 403, { error: supportMutationDecision.errorCode });
      }
    }
    if (url.pathname === '/api/admin/support-sessions' && request.method === 'POST') {
      const result = await createSupportSession(request, await requestBody(request));
      return json(response, 201, { supportSession: result.supportSession }, {
        'set-cookie': sessionCookie(
          result.token,
          request,
          Math.ceil((result.supportSession.expiresAt - Date.now()) / 1000),
        ),
      });
    }
    if (url.pathname === '/api/admin/support-sessions' && request.method === 'GET')
      return json(response, 200, await listSupportSessions(request));
    const supportRevokeMatch = url.pathname.match(/^\/api\/admin\/support-sessions\/([0-9a-f-]{36})\/revoke$/i);
    if (supportRevokeMatch && request.method === 'POST')
      return json(response, 200, await revokeSupportSession(request, supportRevokeMatch[1]));
    if (url.pathname === '/api/support-session/revoke' && request.method === 'POST') {
      const result = await revokeSupportSessionByHolder(request, supportRequestContext);
      return json(response, 200, result, {
        'set-cookie': 'ro_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0',
      });
    }
    if (url.pathname === '/api/account' && request.method === 'POST') {
      const body = await requestBody(request),
        username = String(body.username ?? '').trim();
      if (!allowLogin(request, username))
        return json(
          response,
          429,
          { error: '登入嘗試過多，請五分鐘後再試' },
          { 'retry-after': '300' },
        );
      const result = await serializedLoginOrRegister(
        username,
        String(body.password ?? ''),
        body.sex,
        clientAddress(request),
      );
      return json(
        response,
        200,
        { account: result.account, registered: result.registered },
        { 'set-cookie': sessionCookie(result.token, request) },
      );
    }
    if (await handleAdminFixtureNavigationRequest(url, request, response)) return;
    if (await handleAdminTestFixtureCommand(url, request, response)) return;
    if (url.pathname === '/api/account' && request.method === 'DELETE') {
      const token = cookie(request, 'ro_session');
      if (token) {
        const hash = tokenHash(token);
        sessionCache.delete(hash);
        await sql(`DELETE FROM web_sessions WHERE token_hash='${hash}';`);
      }
      return json(
        response,
        200,
        { ok: true },
        {
          'set-cookie':
            'ro_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0',
        },
      );
    }
    if (url.pathname === '/api/probe')
      return json(response, 200, { ok: true });
    if (url.pathname === '/api/health')
      return json(response, 200, { ok: (await publicWorldHealth()).online });
    if (url.pathname === '/api/ro-assets' && request.method === 'GET') {
      const assets = getRoAssetPublicSnapshot();
      if (request.headers['if-none-match'] === `"${assets.version}"`) {
        response.writeHead(304, {
          etag: `"${assets.version}"`,
          'cache-control': 'private, max-age=60, must-revalidate',
          ...securityHeaders,
        });
        return response.end();
      }
      return json(response, 200, assets, {
        etag: `"${assets.version}"`,
        'cache-control': 'private, max-age=60, must-revalidate',
      });
    }
    if (url.pathname === '/api/farm-map-availability' && request.method === 'GET') {
      return json(response, 200, await playerWorldMapAvailability(account), {
        'cache-control': 'private, no-store',
      });
    }
    if (url.pathname === '/api/internal/probe') {
      if (!loopbackRequest(request))
        return json(response, 404, { error: 'not_found' });
      return json(response, 200, { ok: true });
    }
    if (url.pathname === '/api/internal/health') {
      if (!loopbackRequest(request))
        return json(response, 404, { error: 'not_found' });
      return json(response, 200, {
        services: await serviceHealth(),
        runtime: {
          pid: process.pid,
          uptimeSeconds: process.uptime(),
          memory: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          eventLoopLag: eventLoopLagSummary({ reset: true }),
          gc: {
            count: gcMetrics.count,
            durationMs: gcMetrics.durationMs,
          },
          requests: requestMetricsSummary(),
          database: {
            total: databaseMetrics.total,
            errors: databaseMetrics.errors,
            ...summarizeRate(databaseMetrics.rates),
            p50Ms: percentile(databaseMetrics.latencies, 0.5),
            p95Ms: percentile(databaseMetrics.latencies, 0.95),
            p99Ms: percentile(databaseMetrics.latencies, 0.99),
            pool: databasePool.config,
          },
          metricsStartedAt: productionMetricsStartedAt,
        },
        monitoring: {
          workerRecovery: {
            intervalMs: 30_000,
            signal: 'state.json + pid',
          },
          questCallbacks: {
            intervalMs: 1_000,
            watchedAccounts: questRuntimeDispatchBridge.watchedAccountCount(),
          },
          logProjection: {
            ...logProjectionMetrics,
            cachedWorkers: logProjectionCache.size,
            lineLimit: logProjectionLineLimit,
          },
          webPresence: webPresenceSummary(),
          projectionCache: characterProjectionCache.summary(),
          combatSse: combatSseBroker.summary(),
          observationPolicy: publicObservationPolicy(),

          webExperienceTelemetry: {
            ...webExperienceTelemetry.status(),
            actions: WEB_EXPERIENCE_CANARY_ACTIONS,
          },
          webExperienceRum: webExperienceHealth.status(),
        },
      });
    }

    if (url.pathname === '/api/admin/web-experience/summary') {
      const window = ['1h', '24h'].includes(url.searchParams.get('window'))
        ? url.searchParams.get('window')
        : '1h';
      return json(response, 200, {
        ...(await webExperienceTelemetry.snapshot({ window })),
        telemetryStatus: webExperienceTelemetry.status(),
      });
    }
    if (url.pathname === '/api/admin/web-experience/observatory') {
      if (!isAdminSurfaceHost(request) && !loopbackRequest(request))
        return json(response, 404, { error: 'not_found' });
      const snapshot = playerWebObservatory.snapshot({ windowMs: 15 * 60_000 });
      const activeSessions = webPresenceSummary().viewers;
      const production = process.env.WEB_DEPLOYMENT_GIT_SHA ?? process.env.GIT_SHA ?? 'CURRENT';
      return json(response, 200, {
        ...snapshot,
        activeSessions,
        production,
        report: buildObservatoryReport(snapshot, {
          production,
          activeSessions,
        }),
      }, { 'cache-control': 'private, no-store' });
    }
    const webExperienceActionMatch = url.pathname.match(
      /^\/api\/admin\/web-experience\/action\/([A-Za-z0-9._:-]{1,96})$/,
    );
    if (webExperienceActionMatch) {
      const window = ['1h', '24h'].includes(url.searchParams.get('window'))
        ? url.searchParams.get('window')
        : '1h';
      return json(response, 200, {
        ...(await webExperienceTelemetry.actionDetail(
          webExperienceActionMatch[1],
          { window },
        )),
        telemetryStatus: webExperienceTelemetry.status(),
      });
    }
    // WEB_REAL_USER_EXPERIENCE_V1: player-perceived latency health read model.
    // Same admin boundary as the observatory endpoints above (outer Cloudflare
    // Access owns authorization).
    if (url.pathname === '/api/admin/web-experience/health') {
      const window = ['1m', '5m', '15m'].includes(url.searchParams.get('window'))
        ? url.searchParams.get('window')
        : '5m';
      return json(response, 200, {
        ...webExperienceHealth.snapshot({ window }),
        status: webExperienceHealth.status(),
      });
    }
    const webExperienceHealthMatch = url.pathname.match(
      /^\/api\/admin\/web-experience\/health\/([A-Za-z0-9._:-]{1,96})$/,
    );
    if (webExperienceHealthMatch) {
      const window = ['1m', '5m', '15m'].includes(url.searchParams.get('window'))
        ? url.searchParams.get('window')
        : '5m';
      return json(response, 200, {
        ...webExperienceHealth.actionDetail(webExperienceHealthMatch[1], { window }),
        status: webExperienceHealth.status(),
      });
    }
    // --- Server Ops (C3): ADMIN-only, authorization enforced before mutation ---
    if (url.pathname === '/api/admin/characters' && request.method === 'GET') {
      return json(response, 200, { characters: await listAdminCharacters() });
    }
    const adminRecoveryMatch = url.pathname.match(
      /^\/api\/admin\/characters\/(\d{1,10})\/quarantine-recovery(?:\/([0-9a-f-]{36}))?$/i,
    );
    if (adminRecoveryMatch) {
      const isResult = Boolean(adminRecoveryMatch[2]);
      if (request.method !== (isResult ? 'GET' : 'POST'))
        return json(response, 405, { error: 'method_not_allowed' });
      try {
        const context = {
          charId: adminRecoveryMatch[1],
          adminContext: adminRecoveryTransportContext(request),
          originAllowed: mutationOriginAllowed(request),
          supportSession: false,
          requestId: request.headers['x-ro-developer-request-id'] ?? null,
        };
        const result = isResult
          ? await adminQuarantineRecoveryTransport.result({
            ...context, commandId: adminRecoveryMatch[2],
          })
          : await adminQuarantineRecoveryTransport.submit(context);
        return json(response, result.status, result.body);
      } catch (error) {
        if (error instanceof AdminRecoveryError)
          return json(response, error.status, { ok: false, error: error.code });
        console.error('Admin quarantine recovery unavailable:', error);
        return json(response, 503, { ok: false, error: 'recovery_unavailable' });
      }
    }
    const adminCharacterMetaMatch = url.pathname.match(
      /^\/api\/admin\/characters\/(\d{1,10})\/meta$/,
    );
    if (adminCharacterMetaMatch) {
      const metaCharId = Number(adminCharacterMetaMatch[1]);
      if (request.method === 'GET') {
        return json(response, 200, { charId: metaCharId, ...(await readCharacterMeta(metaCharId)) });
      }
      if (request.method === 'POST') {
        const body = await requestBody(request);
        const updated = await setCharacterMeta(metaCharId, body);
        return json(response, 200, updated);
      }
      return json(response, 405, { error: 'method_not_allowed' });
    }
    const adminCharacterAgentMatch = url.pathname.match(
      /^\/api\/admin\/characters\/(\d{1,10})\/agent\/(autonomy|farm)$/,
    );
    if (adminCharacterAgentMatch) {
      if (request.method !== 'POST')
        return json(response, 405, { error: 'method_not_allowed' });
      const agentCharId = Number(adminCharacterAgentMatch[1]);
      const agentAction = adminCharacterAgentMatch[2];
      // In-process guard: a double click or a racing request must never dispatch
      // a second claim/farm command for the same character.
      if (adminAgentOperationLocks.has(agentCharId))
        return json(response, 409, {
          ok: false,
          charId: agentCharId,
          action: agentAction,
          phase: 'failed',
          error: 'operation_in_progress',
          blocker: 'operation_in_progress',
        });
      adminAgentOperationLocks.set(agentCharId, agentAction);
      try {
        const result = await runAdminAgentAction(agentCharId, agentAction);
        return json(response, result.ok ? 200 : 409, result);
      } catch (error) {
        const blocker =
          error instanceof HttpError ? error.message : 'admin_agent_action_failed';
        console.error(
          `Admin agent action failed char=${agentCharId} action=${agentAction}:`,
          error,
        );
        return json(response, error instanceof HttpError ? error.statusCode : 500, {
          ok: false,
          charId: agentCharId,
          action: agentAction,
          phase: 'failed',
          error: blocker,
          blocker,
        });
      } finally {
        adminAgentOperationLocks.delete(agentCharId);
      }
    }
    const adminServerMatch = url.pathname.match(
      /^\/api\/admin\/server\/(status|start|stop|restart)$/,
    );
    if (adminServerMatch) {
      const stackAction = adminServerMatch[1];
      const isStatus = stackAction === 'status';
      const methodOk = isStatus ? request.method === 'GET' : request.method === 'POST';
      if (!methodOk) return json(response, 405, { error: 'method_not_allowed' });
      if (isStatus) {
        const snapshot = await opsControlPlane.buildStatus();
        const lifecycleState = snapshot.connectivity.every((c) => c.processHealth === 'HEALTHY')
          ? 'RUNNING'
          : snapshot.connectivity.some((c) => c.processHealth === 'HEALTHY')
            ? 'PARTIAL'
            : 'STOPPED';
        return json(response, 200, { ...snapshot, lifecycleState, services: snapshot.connectivity });
      }
      const run = await runStackLifecycle(stackAction);
      const state = parseStackLifecycleState(run.output) ?? (run.ok ? 'SUCCESS' : 'FAILED');
      return json(response, run.ok ? 200 : 409, {
        action: stackAction,
        state,
        healthy: run.ok,
        output: run.output,
        stderr: run.stderr,
      });
    }
    const account = await resolveRequestAccount();
    supportRequestContext ??= supportContextFromAccount(account);
    if (url.pathname === '/api/session') {
      const discord = await discordAccountAuth.view(account);
      const sessionView = String(url.searchParams.get('view') ?? 'full');
      const entryView = sessionView === 'entry';
      const character = entryView && account?.characterId
        ? await queryCharacter(account.accountId)
        : null;
      const equipment = !entryView && account?.characterId
        ? await queryEquipment(account.characterId)
        : [];
      return json(response, 200, {
        account: account
          ? {
              accountId: account.accountId,
              username: account.username,
              sex: account.sex,
              characterId: account.characterId,
              characterName: account.characterName,
              classId: account.classId,
              hair: account.hair,
              hairColor: account.hairColor,
              baseLevel: account.baseLevel,
              jobLevel: account.jobLevel,
              adminSurface: isAdminSurfaceHost(request),
            }
          : null,
        supportSession: supportRequestContext
          ? supportContextView(supportRequestContext)
          : null,
        ...(entryView ? { character } : {}),
        ...(entryView ? {} : { equipment }),
        observationPolicy: publicObservationPolicy(),
        combatSse: entryView ? null : await combatSseStateForAccount(account, null),

        webExperienceTelemetry: webExperienceTelemetry.publicConfig(account ?? {}),
        discord,
      });
    }
    if (!account) return json(response, 401, { error: '請先登入' });
    const discord = discordAccountAuth.requiresAccessCheck
      ? await discordAccountAuth.view(account)
      : { accessGate: null };
    if (
      discord.accessGate &&
      !['/api/session', '/api/account/discord', '/api/account/discord/link'].includes(url.pathname)
    )
      return json(response, 403, {
        error: discord.accessGate,
        code: discord.accessGate,
      });
    if (supportMutationDecision && supportMutationDecision.actionKey !== 'support_session_revoke') {
      await assertSupportSessionDispatchActive(request, supportRequestContext);
      supportActionAuditForResponse(response, request, supportRequestContext, supportMutationDecision);
    }
    if (url.pathname === '/api/config' && request.method === 'GET')
      return json(response, 200, await readPlayerConfig(account));
    if (url.pathname === '/api/config' && request.method === 'PUT') {
      try {
        return json(response, 200, await savePlayerConfig(account, await requestBody(request, 262144)));
      } catch (error) {
        if (error?.code === 'CONFIG_REVISION_CONFLICT')
          return json(response, 409, { error: error.code, config: error.current });
        if (error?.details)
          return json(response, 422, { error: error.message, details: error.details });
        throw error;
      }
    }
    const persistentLifeLatestMatch = url.pathname.match(
      /^\/api\/ro\/agents\/(\d+)\/persistent-life\/latest$/,
    );
    if (persistentLifeLatestMatch && request.method === 'GET') {
      const charId = Number(persistentLifeLatestMatch[1]);
      if (Number(account.characterId) !== charId)
        throw new HttpError(403, 'ownership_conflict');
      return json(response, 200, await readPersistentLifeDiary(account, charId));
    }
    const persistentLifeSeenMatch = url.pathname.match(
      /^\/api\/ro\/agents\/(\d+)\/persistent-life\/latest\/seen$/,
    );
    if (persistentLifeSeenMatch && request.method === 'POST') {
      const charId = Number(persistentLifeSeenMatch[1]);
      if (Number(account.characterId) !== charId)
        throw new HttpError(403, 'ownership_conflict');
      const diary = await readPersistentLifeDiary(account, charId);
      if (diary.session) {
        await sql(
          `UPDATE persistent_life_session SET seen_at=CURRENT_TIMESTAMP(3) ` +
            `WHERE session_id='${escapeSql(diary.session.sessionId)}' ` +
            `AND char_id=${charId} AND account_id=${Number(account.accountId)};`,
        );
      }
      return json(response, 200, await readPersistentLifeDiary(account, charId));
    }
    if (
      url.pathname === '/api/combat-snapshot' &&
      request.method === 'GET'
    ) {
      const id = instanceId(account.accountId),
        [logSession, rawLive] = await Promise.all([
          refreshLogProjection(id),
          currentCharacterLiveSnapshot(
            account,
            id,
            OBSERVATION_POLICY.interests.NO_WEB.statusExportMs + 5_000,
          ),
        ]),
        combatStream = await combatStreamState(account, logSession, rawLive);
      return json(response, 200, {
        characterId: Number(account.characterId),
        cursor: combatStream.cursor,
        combatRevision: combatStream.combatRevision,
        combatStream,
        live: withLiveFreshness(
          projectLiveSnapshot(rawLive, ObservationInterest.COMBAT_PAGE),
          rawLive,
        ),
      });
    }
    if (
      url.pathname === '/api/combat-stream' &&
      request.method === 'GET'
    ) {
      const viewerId = String(url.searchParams.get('viewer') ?? ''),
        interest = String(url.searchParams.get('interest') ?? '');
      if (!validWebViewerId(viewerId))
        throw new HttpError(400, 'Web viewer 識別格式錯誤');
      if (interest !== ObservationInterest.COMBAT_PAGE)
        throw new HttpError(409, 'combat_sse_interest_inactive');
      const rollout = await combatSseStateForAccount(account, null);
      if (!rollout.eligible)
        throw new HttpError(409, 'combat_sse_unavailable');
      await updateWebPresence(
        account,
        viewerId,
        ObservationInterest.COMBAT_PAGE,
      );
      await combatSseBroker.subscribe({
        request,
        response,
        accountId: account.accountId,
        characterId: account.characterId,
        instanceId: instanceId(account.accountId),
        viewerId,
        cursor: Number(url.searchParams.get('cursor')),
        combatRevision: Number(url.searchParams.get('revision')),
        lastEventId:
          url.searchParams.get('lastEventId') ??
          request.headers['last-event-id'] ??
          '',
        headers: securityHeaders,
      });
      return;
    }

    if (
      url.pathname === '/api/web-experience/telemetry' &&
      request.method === 'POST'
    ) {
      const body = await requestBody(request);
      const identity = {
        accountId: account.accountId,
        characterId: account.characterId,
        username: account.username,
      };
      // Batch ingest: the browser buffers and posts { events: [...] }. A single
      // legacy event object is still accepted. The batch is bounded so a hostile
      // or buggy client cannot amplify one request into unbounded work.
      const events = Array.isArray(body?.events) ? body.events.slice(0, 64) : [body];
      const observatoryEvents = events.filter((event) => event?.kind === 'WEB_OBSERVABILITY');
      const legacyEvents = events.filter((event) => event?.kind !== 'WEB_OBSERVABILITY');
      const observatoryAccepted = webExperienceTelemetry.isEligible(identity)
        ? playerWebObservatory.ingestBatch(observatoryEvents).filter((result) => result.ok).length
        : 0;
      let accepted = 0;
      let rejected = 0;
      let lastResult = { accepted: false, reason: 'NO_EVENTS' };
      const eligible = webExperienceTelemetry.isEligible(identity);
      for (const event of legacyEvents) {
        try {
          lastResult = webExperienceTelemetry.record(event, identity);
        } catch {
          lastResult = { accepted: false, reason: 'TELEMETRY_FAILED' };
        }
        if (lastResult.accepted) accepted += 1;
        else rejected += 1;
        // Fail-soft: the RUM read model must never affect gameplay. Ingestion is
        // skipped for non-canary identities, matching production telemetry.
        if (eligible && webExperienceHealth.actions.includes(event?.actionId)) {
          try {
            webExperienceHealth.ingest(event);
          } catch {}
        }
      }
      return json(response, 202, {
        ok: accepted > 0,
        accepted,
        rejected,
        observatoryAccepted,
        telemetry: lastResult,
      });
    }
    if (
      url.pathname === '/api/web-presence' &&
      request.method === 'POST'
    ) {
      const body = await requestBody(request);
      const interest = observationInterestFromInput(
        String(body.interest ?? ''),
        String(body.mode ?? ''),
      );
      if (!interest) throw new HttpError(400, 'Web viewer interest 格式錯誤');
      return json(
        response,
        200,
        await updateWebPresence(
          account,
          String(body.viewerId ?? ''),
          interest,
        ),
      );
    }
    if (
      url.pathname === '/api/ro/agents/rollout/telemetry' &&
      request.method === 'GET'
    ) {
      if (!loopbackRequest(request))
        throw new HttpError(403, 'ownership_conflict');
      return json(response, 200, {
        telemetry: await readRolloutTelemetry(sql),
      });
    }
    const controllerStatusMatch = url.pathname.match(
      /^\/api\/ro\/agents\/(\d+)\/controller$/,
    );
    if (controllerStatusMatch && request.method === 'GET') {
      const charId = Number(controllerStatusMatch[1]);
      if (Number(account.characterId) !== charId)
        throw new HttpError(403, 'ownership_conflict');
      return json(
        response,
        200,
        await readCharacterControllerStatus(account, charId, {
          includeFarmTarget: true,
        }),
      );
    }
    const ownershipStatusMatch = url.pathname.match(
      /^\/api\/ro\/agents\/(\d+)\/ownership$/,
    );
    if (ownershipStatusMatch && request.method === 'GET') {
      const charId = Number(ownershipStatusMatch[1]);
      return json(response, 200, {
        ownership: await getOwnershipStatus(account, charId),
      });
    }
    const ownershipCommandsMatch = url.pathname.match(
      /^\/api\/ro\/agents\/(\d+)\/ownership\/commands$/,
    );
    if (ownershipCommandsMatch && request.method === 'POST') {
      const charId = Number(ownershipCommandsMatch[1]);
      const body = await requestBody(request);
      return json(response, 202, {
        command: await queueOwnershipCommand(account, charId, body),
      });
    }
    const ownershipCommandMatch = url.pathname.match(
      /^\/api\/ro\/agents\/(\d+)\/ownership\/commands\/([0-9a-f-]+)$/i,
    );
    if (ownershipCommandMatch && request.method === 'GET') {
      const charId = Number(ownershipCommandMatch[1]);
      return json(response, 200, {
        command: await getOwnershipCommand(
          account,
          charId,
          ownershipCommandMatch[2].toLowerCase(),
        ),
      });
    }
    if (url.pathname === '/api/preferences' && request.method === 'GET')
      return json(response, 200, {
        preferences: await queryPreferences(account.accountId),
      });
    if (url.pathname === '/api/preferences' && request.method === 'POST') {
      const body = await requestBody(request);
      return json(response, 200, {
        preferences: await savePreferences(account.accountId, body),
      });
    }
    if (url.pathname === '/api/characters' && request.method === 'POST') {
      const body = await requestBody(request);
      await createCharacter(
        account,
        String(body.name ?? '').trim(),
        body.hair,
        body.hairColor,
        body.sex,
        String(body.targetJob ?? ''),
      );
      const token = cookie(request, 'ro_session');
      if (token) sessionCache.delete(tokenHash(token));
      const refreshed = await sessionAccount(request);
      // SERVER_AGENT product path: creation must not depend on an OpenKore
      // worker. Bootstrap the canonical SERVER_AGENT ownership (claim_agent
      // command) instead; a character is created authoritatively either way.
      let serverAgentBootstrap = 'SKIPPED';
      let serverAgentOnboarding = 'SKIPPED';
      if (refreshed?.characterId) {
        try {
          await bootstrapServerAgentOwnership(refreshed, refreshed.characterId);
          serverAgentBootstrap = 'QUEUED';
          // Kick the authoritative onboarding forward transition. If the agent
          // is not resident yet this stays PENDING and the Web retries the
          // advance/graduate once the controller reports SERVER_AGENT.
          try {
            await queueOnboardingAdvance(refreshed);
            serverAgentOnboarding = 'ADVANCE_QUEUED';
          } catch {
            serverAgentOnboarding = 'PENDING_SERVER_AGENT';
          }
        } catch (error) {
          serverAgentBootstrap = 'UNAVAILABLE';
          console.error(
            `Server Agent bootstrap failed for character ${refreshed.characterId}: ${error?.message ?? error}`,
          );
        }
      }
      return json(response, 200, {
        characterName: refreshed?.characterName,
        serverAgentBootstrap,
        serverAgentOnboarding,
      });
    }
    if (url.pathname === '/api/job-target' && request.method === 'POST') {
      const body = await requestBody(request);
      const targetJob = await saveFirstJobTarget(
        account,
        String(body.job ?? ''),
      );
      const token = cookie(request, 'ro_session');
      if (token) sessionCache.delete(tokenHash(token));
      return json(response, 200, { targetJob });
    }
    if (
      url.pathname === '/api/quest-runtime/career-target' &&
      request.method === 'POST'
    ) {
      if (!account.characterId) throw new HttpError(409, '尚未建立角色');
      const body = await requestBody(request);
      if (!(await isSecondJobClosedTestAuthorized(account)))
        return json(response, 403, {
          error: 'CLOSED_TEST_ONLY',
          code: 'CLOSED_TEST_ONLY',
        });
      const jobQuestService = registeredJobQuestService(body.adapterId);
      try {
        const questRuntime = await jobQuestService.setCareerTarget(
          {
            charId: Number(account.characterId),
            accountId: Number(account.accountId),
          },
          {
            careerTarget: body.careerTarget,
            expectedRevision: body.expectedRevision,
          },
        );
        return json(response, 200, {
          questRuntime: await withAvailableCareerTargets(
            {
              charId: Number(account.characterId),
              accountId: Number(account.accountId),
            },
            questRuntime,
            jobQuestService.adapter.id,
          ),
        });
      } catch (error) {
        if (error?.message === 'STALE_REVISION')
          throw new HttpError(409, '任務狀態已更新，請重新整理');
        if (/careerTarget/.test(error?.message ?? ''))
          throw new HttpError(422, '職業志願格式錯誤');
        throw error;
      }
    }
    if (
      ['/api/quest-runtime/job-action', '/api/assassin-quest/action'].includes(url.pathname) &&
      request.method === 'POST'
    ) {
      if (!account.characterId) throw new HttpError(409, '尚未建立角色');
      const body = await requestBody(request);
      if (!(await isSecondJobClosedTestAuthorized(account)))
        return json(response, 403, {
          error: 'CLOSED_TEST_ONLY',
          code: 'CLOSED_TEST_ONLY',
        });
      const requestedAdapterId =
        body.adapterId ??
        (url.pathname === '/api/assassin-quest/action' ? 'ASSASSIN' : null);
      const jobQuestService = registeredJobQuestService(requestedAdapterId);
      try {
        const result = await jobQuestService.act(
            { charId: Number(account.characterId), accountId: Number(account.accountId) },
            {
              action: String(body.action ?? ''),
              payload: body.payload ?? {},
              expectedRevision: body.expectedRevision,
            },
          );
        result.questRuntime = await withAvailableCareerTargets(
          { charId: Number(account.characterId), accountId: Number(account.accountId) },
          result.questRuntime,
          jobQuestService.adapter.id,
        );
        return json(response, 202, result);
      } catch (error) {
        if (error?.message === 'STALE_REVISION') throw new HttpError(409, '任務狀態已更新，請重新整理');
        throw new HttpError(409, error?.message ?? '二轉任務操作失敗');
      }
    }
    if (
      ['/api/quest-runtime/job-commit', '/api/assassin-quest/commit'].includes(url.pathname) &&
      request.method === 'POST'
    ) {
      if (!account.characterId) throw new HttpError(409, '尚未建立角色');
      const body = await requestBody(request);
      if (!(await isSecondJobClosedTestAuthorized(account)))
        return json(response, 403, {
          error: 'CLOSED_TEST_ONLY',
          code: 'CLOSED_TEST_ONLY',
        });
      const jobQuestService = registeredJobQuestService(body.adapterId);
      try {
        const result = await jobQuestService.commit(
            { charId: Number(account.characterId), accountId: Number(account.accountId) },
            {
              expectedRevision: body.expectedRevision,
              idempotencyKey: String(body.idempotencyKey ?? ''),
            },
          );
        result.questRuntime = await withAvailableCareerTargets(
          { charId: Number(account.characterId), accountId: Number(account.accountId) },
          result.questRuntime,
          jobQuestService.adapter.id,
        );
        return json(response, 200, result);
      } catch (error) {
        if (error?.message === 'STALE_REVISION') throw new HttpError(409, '任務狀態已更新，請重新整理');
        throw new HttpError(409, error?.message ?? '二轉職業變更未完成');
      }
    }
    if (
      url.pathname === '/api/quest-runtime/dispatch' &&
      request.method === 'POST'
    ) {
      if (!account.characterId) throw new HttpError(409, '尚未建立角色');
      const body = await requestBody(request);
      if (!(await isSecondJobClosedTestAuthorized(account)))
        return json(response, 403, {
          error: 'CLOSED_TEST_ONLY',
          code: 'CLOSED_TEST_ONLY',
        });
      const current = await questRuntimeService.readPublicState({
        charId: Number(account.characterId),
        accountId: Number(account.accountId),
      });
      if (Number(body.expectedRevision) !== Number(current.revision))
        throw new HttpError(409, '任務狀態已更新，請重新整理');
      const dispatched = await questRuntimeService.dispatchCurrentObjective(
        {
          charId: Number(account.characterId),
          accountId: Number(account.accountId),
        },
        questRuntimeDispatchBridge,
      );
      return json(response, 202, dispatched);
    }
    if (url.pathname === '/api/state') {
      if (!account.characterId)
        return json(response, 200, {
          account: { username: account.username },
          needsCharacter: true,
          world: await publicWorldHealth(),
        });
      const id = instanceId(account.accountId),
        viewMode = String(url.searchParams.get('view') ?? 'full'),
        hasExplicitInterest = url.searchParams.has('interest'),
        interest =
          observationInterestFromInput(
            String(url.searchParams.get('interest') ?? ''),
            viewMode,
          ) ?? ObservationInterest.OTHER_GAME_PAGE,
        fullStateRequested = viewMode === 'full',
        projectionOnly =
          !fullStateRequested ||
          (hasExplicitInterest && interest !== ObservationInterest.QUEST_PAGE);
      if (viewMode === 'entry') {
        const [controller, combatSse] = await Promise.all([
            readCharacterControllerStatus(account, Number(account.characterId), {
              includeFarmTarget: false,
            }),
            combatSseRollout.state(account.characterId),
          ]),
          live = controller.liveStatus?.available
            ? controller.liveStatus
            : null,
          rawEntry = {
            updatedAt:
              live?.freshness?.authoritativeAt ?? Date.now(),
            name: account.characterName,
            jobId: account.classId,
            baseLevel: account.baseLevel,
            jobLevel: account.jobLevel,
            hp: live?.hp ?? 0,
            maxHp: live?.maxHp ?? 0,
            sp: live?.sp ?? 0,
            maxSp: live?.maxSp ?? 0,
            map: live?.map ?? null,
            playerX: live?.x ?? 0,
            playerY: live?.y ?? 0,
            webViewMode: controller.agentMode,
            webInterest: ObservationInterest.COMBAT_PAGE,
            statusIntervalMs: live?.statusIntervalMs ?? null,
            domainRevisions: { live: Number(controller.revision ?? 0) },
          },
          derived = projectGameEntryLeanSnapshot(rawEntry),
          character = {
            charId: account.characterId,
            name: derived.name || account.characterName,
            classId: Number(derived.jobId ?? account.classId ?? 0),
            sex: account.sex,
            hair: account.hair,
            hairColor: account.hairColor,
            targetJob: account.targetJob,
            baseLevel: Number(derived.baseLevel ?? account.baseLevel ?? 1),
            jobLevel: Number(derived.jobLevel ?? account.jobLevel ?? 1),
            hp: Number(derived.hp ?? 0),
            maxHp: Number(derived.maxHp ?? 0),
            sp: Number(derived.sp ?? 0),
            maxSp: Number(derived.maxSp ?? 0),
            map: derived.map ?? null,
            x: Number(derived.playerX ?? 0),
            y: Number(derived.playerY ?? 0),
            online: live?.fresh === true,
          },
          running =
            controller.controller === SERVER_AGENT_OWNER &&
            controller.agentMode !== 'PERSISTENT_IDLE';
        return json(response, 200, {
          contract: 'GAME_ENTRY_LEAN_STATE',
          partial: true,
          firstPlayable: true,
          uiReady: true,
          hydratedDomains: ['identity', 'vitals', 'map', 'automation', 'ownership'],
          deferredDomains: [
            'quest',
            'inventory',
            'equipment',
            'worldMap',
            'history',
            'social',
            'journal',
          ],
          account: { username: account.username },
          character,
          derived,
          running,
          startedAt: null,
          automation: {
            running,
            mode: controller.agentMode ?? null,
          },
          ownership: controller,
          interest: ObservationInterest.COMBAT_PAGE,
          domainRevisions: derived.domainRevisions ?? {},
          combatStream: {
            ...combatSse,
            endpoint: '/api/combat-stream',
          },
        });
      }
      if (projectionOnly) {
        const [session, rawSnapshot, world, supplyCycle, grindTarget] =
          await Promise.all([
            refreshLogProjection(id),
            currentCharacterLiveSnapshot(
              account,
              id,
              OBSERVATION_POLICY.interests.NO_WEB.statusExportMs + 5_000,
            ),
            publicWorldHealth(),
            readSupplyCycle(account),
            readGrindTarget(account),
          ]);
        const rawDerived = withStatDomainSnapshot(
          account.characterId,
          rawSnapshot,
        );
        if (rawDerived) {
          const liveRevision = revisionKeyForInterest(rawDerived, interest),
            derived = withLiveFreshness(
              await tracedCharacterProjection(
                {
                  characterId: account.characterId,
                  domain: 'live',
                  revision: liveRevision,
                  variant: interest,
                  ttlMs: OBSERVATION_POLICY.projectionCacheMs,
                },
                async () =>
                  await withMapPlayerCount(
                    projectLiveSnapshot(rawDerived, interest),
                  ),
              ),
              rawDerived,
            );
          const needsInventoryFallback =
              interest === ObservationInterest.INVENTORY_PAGE &&
              !Array.isArray(rawDerived.inventory),
            inventoryBundle = needsInventoryFallback
              ? await tracedCharacterProjection(
                  {
                    characterId: account.characterId,
                    domain: 'inventory-db',
                    revision: rawDerived.domainRevisions?.inventory ?? 0,
                    variant: 'fallback',
                    ttlMs: OBSERVATION_POLICY.authoritativeFallbackCacheMs,
                  },
                  async () => {
                    const stored = await queryCharacter(account.accountId);
                    if (!stored) return { equipment: [], inventory: [] };
                    const [equipment, inventory] = await Promise.all([
                      queryEquipment(stored.charId),
                      queryInventory(stored.charId),
                    ]);
                    return { equipment, inventory };
                  },
                )
              : { equipment: [], inventory: [] },
            fallbackEquipment = inventoryBundle.equipment,
            fallbackInventory = inventoryBundle.inventory;
          const parsed = logProjectionSummary(session.projection),
            mergedInventory = mergeLiveInventory(
              fallbackInventory,
              derived,
              Number(derived.jobId ?? 0),
            ),
            character = {
              charId: account.characterId,
              name: derived.name || account.characterName,
              classId: Number(derived.jobId ?? 0),
              sex: account.sex,
              hair: account.hair,
              hairColor: account.hairColor,
              targetJob: account.targetJob,
              baseLevel: Number(derived.baseLevel ?? session.projection.liveBase),
              jobLevel: Number(derived.jobLevel ?? session.projection.liveJob),
              baseExp: Number(derived.baseExp ?? 0),
              jobExp: Number(derived.jobExp ?? 0),
              zeny: Number(derived.zeny ?? 0),
              str: Number(derived.str ?? 0),
              agi: Number(derived.agi ?? 0),
              vit: Number(derived.vit ?? 0),
              int: Number(derived.int ?? 0),
              dex: Number(derived.dex ?? 0),
              luk: Number(derived.luk ?? 0),
              hp: Number(derived.hp ?? 0),
              maxHp: Number(derived.maxHp ?? 0),
              sp: Number(derived.sp ?? 0),
              maxSp: Number(derived.maxSp ?? 0),
              statusPoint: Number(derived.statusPoint ?? 0),
              skillPoint: Number(derived.skillPoint ?? 0),
              map: derived.map,
              x: Number(derived.playerX ?? 0),
              y: Number(derived.playerY ?? 0),
              online: true,
            };
          const nativeFarm =
              rawDerived?.serverAgentReadModel === true
                ? await readNativeFarmStats(account.characterId)
                : { available: false };
          return json(response, 200, {
            partial: true,
            account: { username: account.username },
            running: nativeFarmRunning(nativeFarm, session.running),
            startedAt: nativeFarmStartedAt(nativeFarm, session.startedAt),
            endedAt: nativeFarmEndedAt(nativeFarm),
            character,
            equipment: Array.isArray(rawDerived.inventory)
              ? liveEquipment(mergedInventory)
              : fallbackEquipment,
            inventory: mergedInventory,
            derived,
            supplyCycle,
            grindTarget,
            world,
            interest,
            domainRevisions: rawDerived.domainRevisions ?? {},
            combatStream: await combatStreamState(
              account,
              session,
              rawDerived,
            ),
            ...projectNativeFarmStats(parsed, nativeFarm, derived),
          });
        }
      }
      const [session, derived, world, supplyCycle, grindTarget] =
          await Promise.all([
            refreshLogProjection(id),
            currentCharacterLiveSnapshot(
              account,
              id,
              OBSERVATION_POLICY.interests.NO_WEB.statusExportMs + 5_000,
            ),
            publicWorldHealth(),
            readSupplyCycle(account),
            readGrindTarget(account),
          ]),
        questRevision = String(
          derived?.domainRevisions?.quest ?? derived?.updatedAt ?? 0,
        ),
        questBundle = await tracedCharacterProjection(
          {
            characterId: account.characterId,
            domain: 'quest-full',
            revision: questRevision,
            variant: ObservationInterest.QUEST_PAGE,
            ttlMs: OBSERVATION_POLICY.authoritativeFallbackCacheMs,
          },
          async () => {
            const [
              onboarding,
              edenProgress,
              questRuntime,
              authoritativeSavePoint,
              ownershipStatus,
            ] = await Promise.all([
              queryOnboardingProgress(account.characterId),
              queryEdenProgress(account.characterId),
              readQuestRuntimeForAccount(account),
              readCharacterSavePoint(account.accountId),
              getOwnershipStatusOrNull(account, Number(account.characterId)),
            ]);
            return {
              onboarding,
              edenProgress,
              questRuntime,
              authoritativeSavePoint,
              ownershipStatus,
            };
          },
        ),
        {
          onboarding,
          edenProgress,
          questRuntime,
          authoritativeSavePoint,
          ownershipStatus,
        } = questBundle,
        domainRevisions = domainRevisionTracker.observe(account.characterId, {
          quest: questRevision,
          ownership: String(ownershipStatus?.revision ?? 'none'),
          journal: `${questRevision}:${questRuntime?.revision ?? 0}`,
        }),
        statState = statDomainState(account.characterId, derived),
        storedCharacter = derived
          ? null
          : await queryCharacter(account.accountId),
        [equipment, inventory] = derived
          ? [[], []]
          : await Promise.all([
              storedCharacter ? queryEquipment(storedCharacter.charId) : [],
              storedCharacter ? queryInventory(storedCharacter.charId) : [],
            ]),
        parsed = logProjectionSummary(session.projection),
        liveBase = session.projection.liveBase,
        liveJob = session.projection.liveJob,
        mergedInventory = mergeLiveInventory(
          inventory,
          derived,
          Number(derived?.jobId ?? storedCharacter?.classId ?? 0),
        ),
        currentEquipment = derived ? liveEquipment(mergedInventory) : equipment,
        baseCharacter = derived
          ? {
              charId: account.characterId,
              name: derived.name || account.characterName,
              classId: Number(derived.jobId ?? 0),
              sex: account.sex,
              hair: account.hair,
              hairColor: account.hairColor,
              targetJob: account.targetJob,
              baseLevel: Number(derived.baseLevel ?? liveBase),
              jobLevel: Number(derived.jobLevel ?? liveJob),
              baseExp: Number(derived.baseExp ?? 0),
              jobExp: Number(derived.jobExp ?? 0),
              zeny: Number(derived.zeny ?? 0),
              str: Number(derived.str ?? 0),
              agi: Number(derived.agi ?? 0),
              vit: Number(derived.vit ?? 0),
              int: Number(derived.int ?? 0),
              dex: Number(derived.dex ?? 0),
              luk: Number(derived.luk ?? 0),
              hp: Number(derived.hp ?? 0),
              maxHp: Number(derived.maxHp ?? 0),
              sp: Number(derived.sp ?? 0),
              maxSp: Number(derived.maxSp ?? 0),
              statusPoint: Number(derived.statusPoint ?? 0),
              skillPoint: Number(derived.skillPoint ?? 0),
              map: derived.map,
              x: Number(derived.playerX ?? 0),
              y: Number(derived.playerY ?? 0),
              online: true,
            }
            : storedCharacter
            ? {
                ...storedCharacter,
                baseLevel: Math.max(storedCharacter.baseLevel, liveBase),
                jobLevel: Math.max(storedCharacter.jobLevel, liveJob),
              }
            : null,
        liveApplied = await applyLiveStatusToCharacter(account, baseCharacter),
        character = liveApplied.character;
      const nativeFarm =
        derived?.serverAgentReadModel === true
          ? await readNativeFarmStats(account.characterId)
          : { available: false };
      const eden = {
        ...edenProgress,
        journey: derived?.edenJourney ?? null,
        milestones: edenProgress.milestones.map((milestone) => ({
          ...milestone,
          status:
            milestone.status === 'complete'
              ? 'complete'
              : derived?.edenJourney?.active &&
                  derived.edenJourney.taskId === milestone.id
                ? 'active'
                : (milestone.id === 'equipment12' &&
                      Number(edenProgress.trainingStage) === 0 &&
                      Number(character?.baseLevel ?? 0) >= 12) ||
                    (milestone.id === 'equipment26' &&
                      [0, 12].includes(Number(edenProgress.trainingStage)) &&
                      Number(character?.baseLevel ?? 0) >= 26) ||
                    (milestone.id === 'equipment40' &&
                      Number(edenProgress.trainingStage) === 23 &&
                      Number(character?.baseLevel ?? 0) >= 40)
                  ? 'available'
                  : milestone.status,
          progress: ['equipment12', 'equipment26', 'equipment40'].includes(milestone.id)
            ? ((derived?.questMissions ?? []).find((mission) =>
                (milestone.id === 'equipment40'
                  ? [7148, 7149, 7150]
                  : milestone.id === 'equipment26'
                    ? [7139, 7140]
                    : [7129, 7130, 7131]
                ).includes(Number(mission.questId)),
              ) ?? milestone.progress)
            : milestone.progress,
        })),
      };
      const equipment12 = eden.milestones.find(
        (milestone) => milestone.id === 'equipment12',
      );
      if (
        equipment12?.progress &&
        Number(equipment12.progress.count) >= Number(equipment12.progress.goal)
      ) {
        equipment12.canReport = true;
        equipment12.nextAction = '返回 Talking Dog 回報';
      }
      const equipment26 = eden.milestones.find(
        (milestone) => milestone.id === 'equipment26',
      );
      if (
        equipment26?.progress &&
        Number(equipment26.progress.count) >= Number(equipment26.progress.goal)
      ) {
        equipment26.canReport = true;
        equipment26.nextAction = '返回 Eden Member Karl 回報';
      }
      const equipment40 = eden.milestones.find(
        (milestone) => milestone.id === 'equipment40',
      );
      if (
        equipment40?.progress &&
        Number(equipment40.progress.count) >= Number(equipment40.progress.goal)
      ) {
        equipment40.canReport = true;
        equipment40.nextAction = '返回 Eden Member Hooksha 回報';
      }
      const equipment12Reward = eden.milestones.find(
        (milestone) => milestone.id === 'equipment12',
      )?.reward ?? [];
      const questJournal = buildEdenCourseAQuestJournal({
        ownership: ownershipStatus,
        questStates: edenProgress.questStates,
        rewards: equipment12Reward,
        member: edenProgress.member,
        firstJobEligible: allowedFirstJobIds.has(Number(character?.classId)),
        baseLevel: Number(character?.baseLevel ?? 0),
        openKoreJourney: derived?.edenJourney ?? null,
        localizedItemName,
      });
      const persistentAgentRollout = await tracedCharacterProjection(
        {
          characterId: account.characterId,
          domain: 'journal',
          revision: domainRevisions.journal,
          variant: 'eden-course-a-rollout',
          ttlMs: OBSERVATION_POLICY.authoritativeFallbackCacheMs,
        },
        async () =>
          await readEdenCourseARollout(
            sql,
            account.accountId,
            account.characterId,
          ),
      );
      eden.questJournal = questJournal;
      return json(response, 200, {
        account: { username: account.username },
        running: nativeFarmRunning(nativeFarm, session.running),
        startedAt: nativeFarmStartedAt(nativeFarm, session.startedAt),
        endedAt: nativeFarmEndedAt(nativeFarm),
        character,
        liveStatus: liveApplied.liveStatus,
        equipment: currentEquipment,
        inventory: mergedInventory,
        derived: withLiveFreshness(derived, derived),
        onboarding,
        eden,
        questJournal,
        persistentAgentRollout,
        supplyCycle,
        grindTarget,
        grindHubTransition: derived?.grindHubTransition
          ? {
              ...derived.grindHubTransition,
              authoritativeSaveConfirmed:
                !derived.grindHubTransition.active &&
                authoritativeSavePoint?.map ===
                  derived.grindHubTransition.hubId,
              authoritativeSavePoint,
            }
          : null,
        questRuntime,
        world,
        domainRevisions: {
          ...(derived?.domainRevisions ?? {}),
          ...domainRevisions,
          ...(statState ? { stat: statState.statRevision } : {}),
        },
        combatStream: await combatStreamState(account, session, derived),
        ...projectNativeFarmStats(parsed, nativeFarm, derived),
      });
    }
    if (url.pathname === '/api/rankings' && request.method === 'GET') {
      const classId = Number(url.searchParams.get('classId'));
      return json(response, 200, {
        ranking: await queryClassRanking(classId),
      });
    }
    // MINIMAL POSITION PROJECTION. The minimap hot path must not depend on the
    // heavy gameplay-event fan-out: this route performs exactly ONE read of the
    // authoritative `persistent_agent_live_status` row and returns only the
    // position facts. Reuse gate: no existing read is single-query (the
    // controller read fans out to state+rollout+live, /api/events fans out to
    // ~20), so a bounded projection is built here on the existing authority
    // instead of adding a second one.
    if (url.pathname === '/api/live-position' && request.method === 'GET') {
      const characterId = Number(account.characterId);
      let live = null;
      try {
        live = await readPersistentAgentLiveStatusView(characterId);
      } catch {
        live = null;
      }
      return json(response, 200, projectLivePosition(live, { characterId }));
    }
    if (url.pathname === '/api/events') {
      const id = instanceId(account.accountId),
        viewerId = String(url.searchParams.get('viewer') ?? ''),
        viewMode = String(url.searchParams.get('view') ?? ''),
        interest =
          observationInterestFromInput(
            String(url.searchParams.get('interest') ?? ''),
            viewMode,
          ) ?? ObservationInterest.IDLE_PAGE,
        presence = validWebViewerId(viewerId)
          ? await updateWebPresence(account, viewerId, interest)
          : null,
        [session, rawSnapshot] = await Promise.all([
          refreshLogProjection(id),
          currentCharacterLiveSnapshot(
            account,
            id,
            OBSERVATION_POLICY.interests.NO_WEB.statusExportMs + 5_000,
          ),
        ]),
        rawLive = withStatDomainSnapshot(account.characterId, rawSnapshot),
        liveRevision = revisionKeyForInterest(rawLive, interest),
        live = withLiveFreshness(
          await tracedCharacterProjection(
            {
              characterId: account.characterId,
              domain: 'live',
              revision: liveRevision,
              variant: interest,
              ttlMs: OBSERVATION_POLICY.projectionCacheMs,
            },
            async () =>
              await withMapPlayerCount(projectLiveSnapshot(rawLive, interest)),
          ),
          rawLive,
        ),
        lines = session.projection.lines,
        requested = url.searchParams.has('cursor')
          ? Number(url.searchParams.get('cursor'))
          : null,
        valid =
          Number.isInteger(requested) &&
          requested >= 0 &&
          requested >= session.projection.cursor - lines.length &&
          requested <= session.projection.cursor &&
          session.projection.cursor - requested <= logProjectionMaximumDelta,
        start = valid
          ? requested - (session.projection.cursor - lines.length)
          : Math.max(0, lines.length - logProjectionInitialLines),
        deltaLines = lines.slice(start),
        rawLines =
          interest === ObservationInterest.COMBAT_PAGE
            ? coalesceCombatEventLines(deltaLines)
            : [],
        combatDelta = coalesceCombatEvents(deltaLines);
      let nativeLog = null;
      if (interest === ObservationInterest.COMBAT_PAGE) {
        const serverAgentControlled =
          rawLive?.serverAgentReadModel === true ||
          (!rawLines.length &&
            (await characterIsServerAgentControlled(account.characterId)));
        if (serverAgentControlled)
          nativeLog = await readNativeCombatLog(
            account.characterId,
            Number.isInteger(requested) && requested >= 0 ? requested : null,
          );
      }
      return json(response, 200, {
        cursor: nativeLog?.available
          ? nativeLog.cursor
          : session.projection.cursor,
        reset: nativeLog?.available ? nativeLog.reset : !valid,
        lines: nativeLog?.available ? nativeLog.lines : rawLines,
        combatDelta:
          interest === ObservationInterest.COMBAT_PAGE
            ? undefined
            : combatDelta,
        interest,
        revision: liveRevision,
        live,
        presence,
      });
    }
    if (url.pathname === '/api/social' && request.method === 'GET') {
      const id = instanceId(account.accountId),
        fileRevision = await socialEventRevision(id),
        events = await tracedCharacterProjection(
          {
            characterId: account.characterId,
            domain: 'social',
            revision: fileRevision,
            variant: 'events',
            ttlMs: OBSERVATION_POLICY.projectionCacheMs,
          },
          async () => await readSocialEvents(id, account.characterName),
        ),
        socialRevision = domainRevisionTracker.observe(account.characterId, {
          social: fileRevision,
        }).social,
        requested = url.searchParams.has('cursor')
          ? Number(url.searchParams.get('cursor'))
          : null,
        valid =
          Number.isInteger(requested) &&
          requested >= 0 &&
          requested <= events.length &&
          events.length - requested <= 300,
        start = valid ? requested : Math.max(0, events.length - 120);
      return json(response, 200, {
        cursor: events.length,
        reset: !valid,
        events: events.slice(start),
        socialRevision,
      });
    }
    if (url.pathname === '/api/social' && request.method === 'POST') {
      if (!account.characterId)
        return json(response, 409, { error: '請先建立角色' });
      const body = await requestBody(request);
      if (runtimeMode !== 'isolated-test') {
        const socialRefusal = await productionLegacyOrCapabilityRefusal(
          account,
          'CAPABILITY_NOT_NATIVE',
        );
        return json(response, socialRefusal.status, socialRefusal.body);
      }
      return json(response, 202, await queueSocialAction(account, body));
    }
    if (url.pathname === '/api/social/voice' && request.method === 'POST') {
      if (!account.characterId)
        return json(response, 409, { error: '請先建立角色' });
      if (runtimeMode !== 'isolated-test') {
        const voiceRefusal = await productionLegacyOrCapabilityRefusal(
          account,
          'CAPABILITY_NOT_NATIVE',
        );
        return json(response, voiceRefusal.status, voiceRefusal.body);
      }
      return json(response, 201, await queueVoiceMessage(account, request));
    }
    if (
      url.pathname.startsWith('/api/social/voice/') &&
      request.method === 'GET'
    ) {
      const voiceId = url.pathname.slice('/api/social/voice/'.length);
      if (await serveVoice(voiceId, response)) return;
      return json(response, 404, { error: '語音訊息不存在' });
    }
    if (url.pathname === '/api/status-point' && request.method === 'POST') {
      const body = await requestBody(request);
      const statPointCharId = Number(account.characterId);
      if (Number.isSafeInteger(statPointCharId) && statPointCharId > 0) {
        // Controller-specific routing: a SERVER_AGENT character MUST use the
        // rAthena-native Persistent Agent path. Never silently fall back to
        // OpenKore when the agent state cannot be read.
        const controllerStatus = await readCharacterControllerStatus(
          account,
          statPointCharId,
          { includeFarmTarget: false },
        );
        if (
          controllerStatus.available &&
          controllerStatus.controller === SERVER_AGENT_OWNER
        )
          return json(
            response,
            202,
            await queueServerAgentStatPoint(account, body.stat, body),
          );
        if (
          !controllerStatus.available &&
          controllerStatus.unavailableReason === 'agent_status_unavailable'
        )
          return json(response, 503, {
            error: '系統狀態暫時無法讀取，已停止操作以保護角色',
          });
      }
      // P2-OPENKORE-EXIT-MAINLINE: normal production no longer writes OpenKore
      // .cmd for stat allocation. Legacy OPENKORE gets a migration-required refusal.
      if (runtimeMode !== 'isolated-test')
        return json(response, 409, {
          error: 'LEGACY_OPENKORE_MIGRATION_REQUIRED',
          code: 'LEGACY_OPENKORE_MIGRATION_REQUIRED',
        });
      const result = await allocateStatusPoint(
          account,
          String(body.stat ?? ''),
          body,
        ),
        errorMessages = {
          character_mismatch: '角色識別已更新，請重試操作',
          revision_mismatch: '能力值狀態已更新',
          stat_cap_reached: '能力值已達目前上限',
          insufficient_points: '能力點數不足',
          command_rejected: '能力配點指令遭拒絕',
          bridge_timeout: '能力配點指令傳送逾時',
          confirmation_timeout: '伺服器尚未確認能力配點',
        };
      return json(response, result.accepted ? 200 : 409, {
        ...result,
        ...(result.accepted
          ? {}
          : { error: errorMessages[result.reason] ?? '能力配點失敗' }),
      });
    }
    if (url.pathname === '/api/skill-point' && request.method === 'POST') {
      const body = await requestBody(request);
      const skillPointCharId = Number(account.characterId);
      if (Number.isSafeInteger(skillPointCharId) && skillPointCharId > 0) {
        const controllerStatus = await readCharacterControllerStatus(
          account,
          skillPointCharId,
          { includeFarmTarget: false },
        );
        if (
          controllerStatus.available &&
          controllerStatus.controller === SERVER_AGENT_OWNER
        )
          // The P2F `upgradable` flag is a presentation hint only: it carries no
          // prerequisite metadata. The command is sent and rAthena's native
          // skill-tree validation is the sole authority.
          return json(
            response,
            202,
            await queueServerAgentSkillPoint(account, body.skillId, body),
          );
        if (
          !controllerStatus.available &&
          controllerStatus.unavailableReason === 'agent_status_unavailable'
        )
          return json(response, 503, {
            error: '系統狀態暫時無法讀取，已停止操作以保護角色',
          });
      }
      // P2-OPENKORE-EXIT-MAINLINE: normal production no longer writes OpenKore
      // .cmd for skill allocation. Legacy OPENKORE gets a migration-required refusal.
      if (runtimeMode !== 'isolated-test')
        return json(response, 409, {
          error: 'LEGACY_OPENKORE_MIGRATION_REQUIRED',
          code: 'LEGACY_OPENKORE_MIGRATION_REQUIRED',
        });
      const skillId = Number(body.skillId),
        snapshot = await currentStatusSnapshot(instanceId(account.accountId)),
        commandOptions = validateCharacterCommandRevision(
          body,
          snapshot,
          'inventory',
          account.characterId,
        );
      if (!snapshot || Number(snapshot.skillPoint) < 1)
        throw new Error('技能點數不足');
      const skill = snapshot.skills?.find(
        (entry) => Number(entry.id) === skillId,
      );
      if (!skill || Number(skill.upgradable) !== 1)
        throw new Error('此技能目前無法提升');
      return json(
        response,
        202,
        await queueCharacterCommand(
          account,
          'skill',
          String(skillId),
          commandOptions,
        ),
      );
    }
    if (url.pathname === '/api/skill-automation' && request.method === 'POST') {
      const body = await requestBody(request);
      // P2-OPENKORE-EXIT-MAINLINE row 8: the Persistent Agent command contract has
      // no skill-automation configuration command (start_farm carries only
      // skillEnabled/skillId for one attack skill). There is therefore no native
      // parity for attack/selfRecovery/selfBuff config, so production fails closed
      // instead of writing OpenKore .cmd. SERVER_AGENT => capability gap;
      // legacy OPENKORE => migration required.
      if (runtimeMode !== 'isolated-test') {
        const skCharId = Number(account.characterId);
        const skController =
          Number.isSafeInteger(skCharId) && skCharId > 0
            ? await readCharacterControllerStatus(account, skCharId, {
                includeFarmTarget: false,
              })
            : null;
        if (
          skController?.available &&
          skController.controller === SERVER_AGENT_OWNER
        )
          return json(response, 501, {
            error: 'CAPABILITY_NOT_NATIVE',
            code: 'CAPABILITY_NOT_NATIVE',
          });
        return json(response, 409, {
          error: 'LEGACY_OPENKORE_MIGRATION_REQUIRED',
          code: 'LEGACY_OPENKORE_MIGRATION_REQUIRED',
        });
      }
      return json(response, 202, await queueSkillAutomation(account, body));
    }
    if (url.pathname === '/api/supply-cycle' && request.method === 'POST') {
      if (!account.characterId)
        return json(response, 409, { error: '請先建立角色' });
      const body = await requestBody(request);
      // The old supply form now updates the same character-scoped policy as
      // /api/config. The native command remains gated until its deployment is
      // accepted; the legacy OpenKore control files are never written here.
      if (runtimeMode !== 'isolated-test') {
        const scCharId = Number(account.characterId);
        const scController = await readCharacterControllerStatus(account, scCharId, {
          includeFarmTarget: false,
        });
        if (scController?.available && scController.controller === SERVER_AGENT_OWNER) {
          if (!nativeSupplyPolicyCommandEnabled)
            return json(response, 501, {
              error: 'CAPABILITY_NOT_NATIVE', code: 'CAPABILITY_NOT_NATIVE',
            });
          const settings = normalizeSupplyCycle(body);
          const current = await loadCanonicalConfig({ instancesRoot,
            accountId: account.accountId, characterId: scCharId,
            persistMigration: true });
          const config = applySupplyCycleSettings(current.config, settings);
          try {
            const saved = await savePlayerConfig(account, { config,
              expectedRevision: current.config.revision });
            return json(response, saved.execution.applied ? 200 : 202, {
              supplyCycle: settings, config: saved.config,
              execution: saved.execution });
          } catch (error) {
            if (error?.code === 'CONFIG_REVISION_CONFLICT')
              return json(response, 409, { error: error.code, config: error.current });
            throw error;
          }
        }
        return json(response, 409, {
          error: 'LEGACY_OPENKORE_MIGRATION_REQUIRED',
          code: 'LEGACY_OPENKORE_MIGRATION_REQUIRED',
        });
      }
      return json(response, 200, {
        supplyCycle: await saveSupplyCycle(account, body),
      });
    }
    if (url.pathname === '/api/grind-target' && request.method === 'POST') {
      if (!account.characterId)
        return json(response, 409, { error: '請先建立角色' });
      const body = await requestBody(request);
      const charId = Number(account.characterId);
      const controllerStatus = await readCharacterControllerStatus(
        account,
        charId,
        { includeFarmTarget: false },
      );
      if (
        controllerStatus.available &&
        controllerStatus.controller === SERVER_AGENT_OWNER
      )
        return json(
          response,
          202,
          await queuePlayerWorldMapTeleport(account, controllerStatus, body.mapId, 'farm'),
        );
      if (
        !controllerStatus.available &&
        controllerStatus.unavailableReason === 'agent_status_unavailable'
      )
        return json(response, 503, {
          error: '系統狀態暫時無法讀取，已停止操作以保護角色',
        });
      // P2-OPENKORE-EXIT-MAINLINE row 37: SERVER_AGENT grind-target uses the
      // native W4 relocation coordinator above. The legacy OPENKORE branch writes
      // grind-hub/supply `.cmd` via saveGrindTarget; production fails closed
      // instead (no `.cmd`, no `.result`, no worker, no status.json).
      if (runtimeMode !== 'isolated-test')
        return json(response, 409, {
          error: 'LEGACY_OPENKORE_MIGRATION_REQUIRED',
          code: 'LEGACY_OPENKORE_MIGRATION_REQUIRED',
        });
      return json(response, 202, {
        grindTarget: await saveGrindTarget(account, body.mapId),
      });
    }
    if (url.pathname === '/api/world-map-teleport' && request.method === 'POST') {
      if (!account.characterId)
        return json(response, 409, { error: '請先建立角色' });
      const body = await requestBody(request);
      const controller = await readCharacterControllerStatus(account,
        Number(account.characterId), { includeFarmTarget: false });
      if (!controller.available || controller.controller !== SERVER_AGENT_OWNER)
        return json(response, 409, { error: 'SERVER_AGENT_REQUIRED' });
      return json(response, 202,
        await queuePlayerWorldMapTeleport(account, controller, body.mapId, 'town'));
    }
    if (url.pathname === '/api/saved-town' && request.method === 'POST') {
      if (!account.characterId)
        return json(response, 409, { error: '請先建立角色' });
      const body = await requestBody(request);
      const mapId = String(body.mapId ?? '');
      const town = worldMapTeleportCatalog.get(mapId);
      if (!town || town.kind !== 'town' || !town.townTeleportAvailable)
        throw new HttpError(409, 'TOWN_DESTINATION_REQUIRED');
      const controller = await readCharacterControllerStatus(account,
        Number(account.characterId), { includeFarmTarget: false });
      if (!controller.available || controller.controller !== SERVER_AGENT_OWNER ||
          controller.agentMode !== 'PERSISTENT_IDLE' || !controller.liveStatus?.fresh)
        throw new HttpError(409, 'SERVER_AGENT_IDLE_REQUIRED');
      if (controller.liveStatus.map !== mapId)
        throw new HttpError(409, 'SAVED_TOWN_REQUIRES_PRESENCE');
      const command = await queueOwnershipCommand(account, Number(account.characterId),
        { action: 'set_saved_town', expectedRevision: Number(controller.revision) },
        { targetMap: mapId });
      return json(response, 202, { command, targetMap: mapId });
    }
    if (url.pathname === '/api/job-change' && request.method === 'POST') {
      if (!account.characterId)
        return json(response, 409, { error: '請先建立角色' });
      const body = await requestBody(request);
      return json(response, 202, await queueJobChangeAction(account, body));
    }
    if (url.pathname === '/api/npc-dialog' && request.method === 'GET') {
      const charId = Number(account.characterId);
      if (!Number.isSafeInteger(charId) || charId <= 0)
        return json(response, 409, { error: 'character_required' });
      const controllerStatus = await readCharacterControllerStatus(
        account,
        charId,
        { includeFarmTarget: false },
      );
      if (
        !controllerStatus.available &&
        controllerStatus.unavailableReason === 'agent_status_unavailable'
      )
        return json(response, 503, {
          error: '系統狀態暫時無法讀取，已停止操作以保護角色',
        });
      if (
        controllerStatus.available &&
        controllerStatus.controller === SERVER_AGENT_OWNER
      )
        return json(response, 200, serverAgentNpcDialog(await readServerAgentDialog(charId)));
      return json(response, 200, { active: false, source: 'openkore' });
    }
    if (url.pathname === '/api/npc-dialog' && request.method === 'POST') {
      if (!account.characterId)
        return json(response, 409, { error: '請先建立角色' });
      const body = await requestBody(request);
      const npcCharId = Number(account.characterId);
      const controllerStatus = await readCharacterControllerStatus(
        account,
        npcCharId,
        { includeFarmTarget: false },
      );
      if (
        controllerStatus.available &&
        controllerStatus.controller === SERVER_AGENT_OWNER
      )
        return json(
          response,
          202,
          await queueServerAgentNpcDialog(account, body),
        );
      if (
        !controllerStatus.available &&
        controllerStatus.unavailableReason === 'agent_status_unavailable'
      )
        return json(response, 503, {
          error: '系統狀態暫時無法讀取，已停止操作以保護角色',
        });
      // P2-OPENKORE-EXIT-MAINLINE: normal production no longer writes OpenKore
      // .cmd for NPC dialog. Legacy OPENKORE controllers get a migration-required
      // refusal; only authorized isolated/closed-test diagnostics may use .cmd.
      if (runtimeMode !== 'isolated-test')
        return json(response, 409, {
          error: 'LEGACY_OPENKORE_MIGRATION_REQUIRED',
          code: 'LEGACY_OPENKORE_MIGRATION_REQUIRED',
        });
      // Remaining legacy OPENKORE-controlled characters keep the existing .cmd
      // dialog path during the transition. Generic "talk" has no legacy
      // equivalent, so it fails explicitly instead of being silently dropped.
      const legacyAction = String(body.action ?? '');
      if (legacyAction === 'next')
        return json(
          response,
          202,
          await queueCharacterCommand(account, 'npc_next', '1'),
        );
      if (legacyAction === 'select') {
        const choice = Number(body.index);
        if (!Number.isInteger(choice) || choice < 1 || choice > 20)
          return json(response, 422, { error: 'invalid_transition' });
        return json(
          response,
          202,
          await queueCharacterCommand(account, 'npc_select', String(choice)),
        );
      }
      if (legacyAction === 'close')
        return json(
          response,
          202,
          await queueCharacterCommand(account, 'npc_close', '1'),
        );
      return json(response, 409, {
        error: 'npc_talk_requires_server_agent',
        code: 'npc_talk_requires_server_agent',
      });
    }
    if (
      url.pathname === '/api/onboarding/resume' &&
      request.method === 'POST'
    ) {
      const body = await requestBody(request);
      return json(
        response,
        202,
        await queueOnboardingResume(account, body.questId),
      );
    }
    if (url.pathname === '/api/quest-sequence' && request.method === 'GET') {
      const sequenceCharId = Number(account.characterId);
      if (!Number.isSafeInteger(sequenceCharId) || sequenceCharId <= 0)
        return json(response, 409, { error: 'character_required' });
      return json(response, 200, await readQuestSequenceProjection(sequenceCharId));
    }
    if (url.pathname === '/api/onboarding/advance' && request.method === 'POST')
      return json(response, 202, await queueOnboardingAdvance(account));
    if (url.pathname === '/api/onboarding/graduate' && request.method === 'POST')
      return json(response, 202, await queueOnboardingGraduate(account));
    if (url.pathname === '/api/eden/enroll' && request.method === 'POST')
      return json(response, 202, await queueEdenEnrollment(account));
    if (url.pathname === '/api/eden/task' && request.method === 'POST') {
      const body = await requestBody(request);
      return json(
        response,
        202,
        await queueEdenTask(account, String(body.taskId ?? '')),
      );
    }
    if (url.pathname === '/api/status-reset-info' && request.method === 'GET') {
      const infoCharId = Number(account.characterId);
      if (!Number.isSafeInteger(infoCharId) || infoCharId <= 0)
        return json(response, 409, { error: 'character_required' });
      return json(response, 200, await readCharacterResetCooldowns(infoCharId));
    }
    if (url.pathname === '/api/character-reset' && request.method === 'POST') {
      const body = await requestBody(request);
      const type = String(body.type ?? '');
      const commandId = String(body.commandId ?? '').toLowerCase();
      const result = await queueCharacterReset(account, type, commandId);
      return json(response, result.command.status === 'CONFIRMED' ? 200 : 202, result);
    }
    if (url.pathname === '/api/character-reset-command' && request.method === 'GET') {
      const charId = Number(account.characterId);
      if (!Number.isSafeInteger(charId) || charId <= 0)
        return json(response, 409, { error: 'character_required' });
      const commandId = String(url.searchParams.get('commandId') ?? '').toLowerCase();
      if (!commandIdPattern.test(commandId))
        return json(response, 422, { error: 'invalid_command_id' });
      const command = await getOwnershipCommand(account, charId, commandId);
      if (command.action !== 'reset_character_stat' && command.action !== 'reset_character_skill')
        return json(response, 403, { error: 'ownership_conflict' });
      return json(response, 200, { command,
        cooldowns: await readCharacterResetCooldowns(charId) });
    }
    if (url.pathname === '/api/item-action' && request.method === 'POST') {
      if (!account.characterId)
        return json(response, 409, { error: '請先建立角色' });
      const body = await requestBody(request);
      return json(response, 202, await queueItemAction(account, body));
    }
    if (url.pathname === '/api/automation' && request.method === 'POST') {
      if (!account.characterId)
        return json(response, 409, { error: '請先建立角色' });
      const body = await requestBody(request);
      if (body.action !== 'start' && body.action !== 'stop')
        return json(response, 400, { error: '無效操作' });
      const charId = Number(account.characterId);
      const controllerStatus = await readCharacterControllerStatus(
        account,
        charId,
        { includeFarmTarget: true },
      );
      if (
        controllerStatus.available &&
        controllerStatus.controller === SERVER_AGENT_OWNER
      )
        return json(
          response,
          202,
          await queueCanaryAutomation(account, controllerStatus, body),
        );
      if (
        !controllerStatus.available &&
        controllerStatus.unavailableReason === 'agent_status_unavailable'
      )
        return json(response, 503, {
          error: '系統狀態暫時無法讀取，已停止操作以保護角色',
        });
      // Authoritative controller is OPENKORE, or the Persistent Agent schema is
      // not deployed: existing behaviour is preserved unchanged.
      // P2-OPENKORE-EXIT-MAINLINE: only an explicitly legacy OPENKORE-controlled
      // character may use the worker path. A SERVER_AGENT character, or any
      // unreadable controller state, fails closed above and never spawns OpenKore.
      if (controllerStatus.controller !== OPENKORE_OWNER)
        return json(response, 409, {
          error: 'CAPABILITY_NOT_NATIVE',
          code: 'CONTROLLER_UNSUPPORTED',
        });
      // P2-OPENKORE-EXIT-MAINLINE: normal production no longer launches an
      // OpenKore worker from automation. Explicit legacy OPENKORE controllers get
      // a migration-required refusal; only authorized isolated diagnostics may
      // still start a worker (stop is always allowed).
      if (body.action === 'start' && runtimeMode !== 'isolated-test')
        return json(response, 409, {
          error: 'LEGACY_OPENKORE_MIGRATION_REQUIRED',
          code: 'LEGACY_OPENKORE_MIGRATION_REQUIRED',
        });
      if (body.action === 'start') {
        // Isolated-test mode: reject before writing intent so a copied
        // desired_running row is never treated as permission. Production is a
        // no-op here.
        const isolatedRejection = isolatedWorkerLaunchRejection(account);
        if (isolatedRejection)
          return json(response, 403, {
            error: isolatedRejection.code,
            reason: isolatedRejection.reason,
          });
        await setAutomationIntent(account.accountId, true);
        await startWorker(account);
      } else {
        await setAutomationIntent(account.accountId, false);
        await stopWorker(account);
      }
      return json(response, 200, { ok: true, action: body.action });
    }
    return json(response, 404, { error: 'not_found' });
  } catch (error) {
    console.error('Dashboard request failed:', error);
    const status = Number(error?.statusCode) || 400;
    const headers = Number(error?.retryAfter)
      ? { 'retry-after': String(error.retryAfter) }
      : {};
    return json(
      response,
      status,
      { error: publicErrorMessage(error) },
      headers,
    );
  }
}

const dashboardServer = createServer((request, response) =>
  runWithWebLatencyTrace(request, response, () =>
    handleDashboardRequest(request, response),
  ),
);
let dashboardShuttingDown = false;
async function shutdownDashboard() {
  if (dashboardShuttingDown) return;
  dashboardShuttingDown = true;
  dashboardServer.closeAllConnections?.();
  await new Promise((resolve) => dashboardServer.close(() => resolve()));
  await databasePool.close();
  process.exit(0);
}
process.once('SIGTERM', () => void shutdownDashboard());
process.once('SIGINT', () => void shutdownDashboard());
dashboardServer.listen(port, host, async () => {
  console.log(`RO multiplayer dashboard listening on http://${host}:${port}`);
  // W4 relocation coordinator runs in every mode: it only ever advances a Web
  // map selection that a SERVER_AGENT canary character actually made.
  const relocationTimer = setInterval(() => {
    void reconcilePersistedRelocations()
      .then(() => reconcileRelocations())
      .catch((error) => console.warn(`WEB_RELOCATION_RECOVERY_FAILED: ${error?.message ?? error}`));
  }, 1000);
  relocationTimer.unref();
  const noviceOnboardingTimer = setInterval(() => {
    void reconcileNoviceOnboarding().catch((error) =>
      console.warn(`NOVICE_ONBOARDING_RECONCILE_FAILED: ${error?.message ?? error}`),
    );
  }, 1000);
  noviceOnboardingTimer.unref();
  // R2: return + resume deferred AUTO_FARM restarts. Reuses the canonical
  // relocation coordinator; runs in every non-isolated mode.
  const deferredFarmTimer = setInterval(() => {
    void reconcileDeferredFarmRestores();
  }, 5000);
  deferredFarmTimer.unref();
  if (isolatedTestMode) {
    if (!isApprovedIsolatedDatabaseName(databaseName))
      console.warn(
        `ISOLATED_WORKER_START_REJECTED: database "${databaseName}" is not an approved isolated test database (expected test_*); every worker launch will be rejected`,
      );
    console.log(
      `RO_RUNTIME_MODE=isolated-test: automation recovery disabled (db=${databaseName}, instanceRoot=${instancesRoot}); workers start only from the explicit fixture allowlist`,
    );
    return;
  }
  if (isolatedLatencyTrace) {
    console.log('WEB_LATENCY_TRACE_ISOLATED: automation recovery disabled');
    return;
  }
  await restoreAutomationWorkers();
  const automationRecoveryTimer = setInterval(() => {
    void reconcileAutomationWorkers();
  }, 30_000);
  automationRecoveryTimer.unref();
});
