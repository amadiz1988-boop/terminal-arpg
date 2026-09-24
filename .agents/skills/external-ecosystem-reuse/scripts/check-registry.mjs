#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../../..");
const registryPath = path.join(repoRoot, "ops", "research", "external-reuse-registry.json");
const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const intentIndex = args.indexOf("--intent");
const asOfIndex = args.indexOf("--as-of");
const intent = intentIndex >= 0 ? args[intentIndex + 1] : "evaluate";
const asOf = new Date(asOfIndex >= 0 ? `${args[asOfIndex + 1]}T00:00:00Z` : Date.now());
const optionValueIndexes = new Set([
  ...(intentIndex >= 0 ? [intentIndex + 1] : []),
  ...(asOfIndex >= 0 ? [asOfIndex + 1] : []),
]);
const query = args.filter((arg, index) =>
  !arg.startsWith("--") && !optionValueIndexes.has(index)
).join(" ").trim();

if (!query) {
  console.error("Usage: node check-registry.mjs <requirement> [--intent evaluate|adopt] [--as-of YYYY-MM-DD] [--json]");
  process.exit(2);
}
if (!fs.existsSync(registryPath)) {
  console.error(`Registry not found: ${registryPath}`);
  process.exit(2);
}

const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const normalized = query.toLowerCase();
const aliases = [
  [/party|隊伍|組隊/u, ["party"]],
  [/sse|server.sent.events|事件串流/u, ["sse", "eventsource", "web monitoring"]],
  [/relationship graph|social graph|關係圖|社交圖/u, ["relationship graph", "social graph", "graphology"]],
  [/json schema|schema validation|結構驗證/u, ["json schema", "schema validation", "ajv"]],
  [/storage|倉庫|存倉/u, ["storage"]],
  [/routing|navigation|尋路|導航/u, ["routing", "navigation", "pathfinding"]],
  [/npc|對話/u, ["npc", "dialog"]],
  [/reconnect|重連/u, ["reconnect"]],
  [/guild|公會/u, ["guild"]],
  [/friend|好友/u, ["friend"]],
  [/behavior tree|行為樹/u, ["behavior tree"]],
];
const aliasTerms = aliases.filter(([pattern]) => pattern.test(normalized)).flatMap(([, terms]) => terms);
const tokens = normalized.split(/[^\p{L}\p{N}+#.-]+/u).filter(token => token.length >= 3);
const terms = [...new Set([...aliasTerms, ...tokens])];

function searchText(entry) {
  return [entry.id, entry.name, entry.category, entry.repository, entry.solves, entry.notes, ...(entry.evidenceLinks || [])]
    .join(" ").toLowerCase();
}
function score(entry) {
  const text = searchText(entry);
  return terms.reduce((total, term) => total + (text.includes(term) ? (term.includes(" ") ? 3 : 1) : 0), 0);
}
function ageMonths(checkedAt) {
  return (asOf.getTime() - new Date(checkedAt).getTime()) / (30.4375 * 24 * 60 * 60 * 1000);
}
function freshness(entry) {
  if (entry.status === "REJECT") return { state: "REJECT_HOLD", action: "NO_RECHECK" };
  if (intent === "adopt") return { state: "PRE_ADOPTION_VERIFY", action: "INCREMENTAL_VERIFY" };
  const maxMonths = entry.sourceType === "rAthena" && entry.id.startsWith("ra-") ? 12 : 6;
  return ageMonths(entry.lastCheckedAt) <= maxMonths
    ? { state: "FRESH", action: "REUSE_PRIOR_RESULT" }
    : { state: "STALE", action: "INCREMENTAL_VERIFY" };
}
const sourceOrder = { rAthena: 0, OpenKore: 1, Hercules: 2, HPM: 3, "Generic OSS": 4, Forum: 5 };
const ratingOrder = { A: 0, B: 1, C: 2, D: 3 };
const matches = registry.entries
  .map(entry => ({ entry, score: score(entry) }))
  .filter(result => result.score > 0)
  .sort((a, b) => sourceOrder[a.entry.sourceType] - sourceOrder[b.entry.sourceType] || ratingOrder[a.entry.rating] - ratingOrder[b.entry.rating] || b.score - a.score)
  .slice(0, 12)
  .map(({ entry, score: matchScore }) => ({
    id: entry.id,
    name: entry.name,
    sourceType: entry.sourceType,
    decision: entry.status,
    rating: entry.rating,
    reason: entry.notes,
    license: entry.license,
    integrationCost: entry.integrationCost,
    maintenanceRisk: entry.maintenanceRisk,
    applicableWorklines: entry.applicableWorklines,
    evidence: entry.evidenceLinks,
    matchScore,
    ...freshness(entry),
    specialMode: entry.sourceType === "OpenKore" ? "OPENKORE_BEHAVIOR_REFERENCE" : null,
  }));

const result = {
  query,
  intent,
  registryPath: path.relative(repoRoot, registryPath).replaceAll("\\", "/"),
  registryFirst: true,
  auditMode: "INCREMENTAL_RESEARCH_ONLY",
  fullScanRetrigger: 0,
  nativePrimitiveFirst: matches.some(match => match.sourceType === "rAthena"),
  researchAction: matches.length ? (matches.some(match => match.action === "INCREMENTAL_VERIFY") ? "INCREMENTAL_VERIFY" : "REUSE_PRIOR_RESULT") : "TARGETED_NEW_RESEARCH",
  matches,
};

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`registryFirst: PASS`);
  console.log(`auditMode: ${result.auditMode}`);
  console.log(`fullScanRetrigger: ${result.fullScanRetrigger}`);
  console.log(`researchAction: ${result.researchAction}`);
  for (const match of matches) {
    console.log(`${match.id}: ${match.decision}/${match.rating} ${match.state} ${match.specialMode || ""}`.trim());
  }
}
