import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('acorn');
export function runtimeClosure(manifest, candidateRoot, productionRoot, complete = false) {
const listed = new Set(manifest.files.map((file) => file.path.replaceAll('\\', '/')));
const visited = new Set();
const references = new Map();
const requiredExports = new Map();
const queue = [];
const errors = [];
let scanMode = 'candidate';

function inside(root, path) {
  const full = resolve(root, path);
  const rel = relative(root, full).replaceAll('\\', '/');
  if (!rel || rel.startsWith('../') || isAbsolute(rel)) throw new Error(`CLOSURE_PATH_ESCAPE:${path}`);
  return { full, rel };
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase();
}

function fileExists(path) {
  return existsSync(path) && statSync(path).isFile();
}

function directoryExists(path) {
  return existsSync(path) && statSync(path).isDirectory();
}

function effectivePath(path) {
  return inside(complete || listed.has(path) ? candidateRoot : productionRoot, path).full;
}

function localTarget(from, specifier) {
  if (!specifier || /^(?:https?:|data:|blob:|#|node:)/i.test(specifier)) return null;
  const clean = specifier.split(/[?#]/, 1)[0];
  if (!clean || clean.startsWith('/api/')) return null;
  if (clean.startsWith('/ro/')) return `public${clean}`;
  if (clean.startsWith('/')) return `ops/ro-stack/dashboard${clean}`;
  if (!clean.startsWith('./') && !clean.startsWith('../') && !/\.[a-z0-9]+$/i.test(clean)) return null;
  return join(dirname(from), clean).replaceAll('\\', '/');
}

function add(from, specifier, kind) {
  const target = localTarget(from, specifier);
  if (!target) return;
  if (specifier.endsWith('/')) kind = 'directory';
  let rel;
  try { rel = inside(candidateRoot, target).rel; }
  catch (error) { errors.push(error.message); return; }
  if (!references.has(rel) || kind === 'module') references.set(rel, { source_path: from, target_path: rel, kind });
  queue.push(rel);
  return rel;
}

function staticString(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return null;
}

function scanJavaScript(path, content) {
  const ast = parse(content, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true });
  const startupPaths = new Map();
  const isModuleDirectory = (node) => {
    const filePath = node?.arguments?.[0];
    const metaUrl = filePath?.arguments?.[0];
    return node?.callee?.name === 'dirname' && filePath?.callee?.name === 'fileURLToPath' &&
      metaUrl?.type === 'MemberExpression' && metaUrl.property?.name === 'url' &&
      metaUrl.object?.type === 'MetaProperty' && metaUrl.object.meta?.name === 'import' &&
      metaUrl.object.property?.name === 'meta';
  };
  for (const statement of ast.body) {
    if (statement.type !== 'VariableDeclaration') continue;
    for (const declaration of statement.declarations) {
      const call = declaration.init;
      if (declaration.id.type !== 'Identifier' || call?.callee?.name !== 'join' ||
          !isModuleDirectory(call.arguments[0])) continue;
      const segments = call.arguments.slice(1).map(staticString);
      if (segments.length && segments.every((segment) => segment !== null)) {
        startupPaths.set(declaration.id.name, `./${segments.join('/')}`);
      }
    }
  }
  function scanStartupReads(node) {
    if (!node || typeof node !== 'object' ||
        ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression',
          'ClassDeclaration', 'ClassExpression'].includes(node.type)) return;
    if (node.type === 'CallExpression' && node.callee?.name === 'readFile' &&
        node.arguments[0]?.type === 'Identifier') {
      const specifier = startupPaths.get(node.arguments[0].name);
      if (specifier) add(path, specifier, 'startup-asset');
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) if (child?.type) scanStartupReads(child);
      } else if (value?.type) scanStartupReads(value);
    }
  }
  for (const statement of ast.body) scanStartupReads(statement);
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ImportDeclaration') {
      const target = add(path, staticString(node.source), 'module');
      if (target) {
        const names = requiredExports.get(target) ?? new Set();
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportDefaultSpecifier') names.add('default');
          if (specifier.type === 'ImportSpecifier') names.add(specifier.imported.name ?? specifier.imported.value);
        }
        requiredExports.set(target, names);
      }
    } else if (node.type === 'ExportAllDeclaration' ||
               (node.type === 'ExportNamedDeclaration' && node.source)) {
      add(path, staticString(node.source), 'module');
    } else if (node.type === 'ImportExpression') {
      const source = staticString(node.source);
      if (source === null) errors.push(`UNRESOLVED_DYNAMIC_IMPORT:${path}:${node.start}`);
      else add(path, source, 'module');
    } else if (node.type === 'CallExpression' && node.callee?.name === 'fetch') {
      add(path, staticString(node.arguments[0]), 'asset');
    } else if (node.type === 'NewExpression' && node.callee?.name === 'URL' &&
               node.arguments[1]?.type === 'MemberExpression' &&
               node.arguments[1].object?.type === 'MetaProperty' &&
               node.arguments[1].property?.name === 'url') {
      add(path, staticString(node.arguments[0]), 'asset');
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) if (child?.type) walk(child);
      } else if (value?.type) walk(value);
    }
  }
  walk(ast);
}

function exportedNames(path) {
  if (extname(path).toLowerCase() === '.json') {
    JSON.parse(readFileSync(path, 'utf8'));
    return new Set(['default']);
  }
  const ast = parse(readFileSync(path, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true });
  const names = new Set();
  for (const node of ast.body) {
    if (node.type === 'ExportDefaultDeclaration') names.add('default');
    if (node.type === 'ExportNamedDeclaration') {
      for (const specifier of node.specifiers) names.add(specifier.exported.name ?? specifier.exported.value);
      const declaration = node.declaration;
      if (declaration?.id?.name) names.add(declaration.id.name);
      if (declaration?.declarations) {
        for (const item of declaration.declarations) if (item.id.type === 'Identifier') names.add(item.id.name);
      }
    }
  }
  return names;
}

function scanHtml(path, content) {
  for (const tag of content.matchAll(/<(?:script|link|img|audio|source)\b[^>]*>/gi)) {
    for (const attribute of tag[0].matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
      add(path, attribute[1], 'asset');
    }
  }
}

function scanCss(path, content) {
  for (const match of content.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    add(path, match[1].trim(), 'asset');
  }
  for (const match of content.matchAll(/@import\s+["']([^"']+)["']/gi)) add(path, match[1], 'asset');
}

function scanMapInfo(path, content) {
  function walk(value) {
    if (typeof value === 'string' && value.startsWith('/ro/')) add(path, value, 'map-data');
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  }
  walk(JSON.parse(content));
}

function scanGraph(mode) {
  scanMode = mode;
  visited.clear();
  references.clear();
  requiredExports.clear();
  queue.length = 0;
  errors.length = 0;
  for (const file of manifest.files) queue.push(file.path.replaceAll('\\', '/'));
  for (const entry of ['ops/ro-stack/dashboard.mjs', 'ops/ro-stack/dashboard/index.html']) {
    if (fileExists(inside(candidateRoot, entry).full)) queue.push(entry);
  }
  while (queue.length) {
    const path = queue.shift();
    if (visited.has(path)) continue;
    visited.add(path);
    const source = mode === 'candidate' ? inside(candidateRoot, path).full : effectivePath(path);
    const production = inside(productionRoot, path).full;
    const kind = references.get(path)?.kind ?? 'entrypoint';
    if (kind === 'directory') {
      if (!directoryExists(source)) errors.push(`${mode.toUpperCase()}_DIRECTORY_MISSING:${path}`);
      continue;
    }
    if (!fileExists(source)) {
      if (complete || mode === 'post-deploy' || listed.has(path) || kind === 'module' ||
          kind === 'map-data' || !fileExists(production)) {
        errors.push(`${mode.toUpperCase()}_FILE_MISSING:${path}`);
      }
      continue;
    }
    const extension = extname(path).toLowerCase();
    try {
      const content = ['.js', '.mjs', '.css', '.html'].includes(extension) ||
        path === 'public/ro/data/map-info.json' ? readFileSync(source, 'utf8') : null;
      if (extension === '.js' || extension === '.mjs') scanJavaScript(path, content);
      else if (extension === '.html') scanHtml(path, content);
      else if (extension === '.css') scanCss(path, content);
      else if (path === 'public/ro/data/map-info.json') scanMapInfo(path, content);
      else if (extension === '.json' && kind === 'startup-asset') JSON.parse(readFileSync(source, 'utf8'));
    } catch (error) { errors.push(`${mode.toUpperCase()}_PARSE_FAILED:${path}:${error.message}`); }
  }
  if (mode === 'post-deploy') {
    for (const [path, names] of requiredExports) {
      const target = effectivePath(path);
      if (!fileExists(target)) continue;
      try {
        const actual = exportedNames(target);
        for (const name of names) if (!actual.has(name)) errors.push(`POST_DEPLOY_EXPORT_MISSING:${path}:${name}`);
      } catch (error) { errors.push(`POST_DEPLOY_EXPORT_PARSE_FAILED:${path}:${error.message}`); }
    }
  }
  return { errors: [...errors], paths: [...visited] };
}

const candidateGraph = scanGraph('candidate');
const postDeployGraph = scanGraph('post-deploy');

const dependencies = postDeployGraph.paths.sort().map((path) => {
  const source = inside(candidateRoot, path).full;
  const target = inside(productionRoot, path).full;
  const kind = references.get(path)?.kind ?? 'entrypoint';
  if (kind === 'directory') return {
    source_path: references.get(path)?.source_path ?? 'ENTRYPOINT', target_path: path,
    kind, exists_in_candidate: directoryExists(source),
    exists_in_current_production: directoryExists(target),
    manifest_action: directoryExists(target) ? 'EXISTING_PRODUCTION_DIRECTORY' : 'SOURCE_MISSING',
    candidate_sha256: null, production_preimage_sha256: null,
  };
  const candidateExists = fileExists(source);
  const productionExists = fileExists(target);
  const same = candidateExists && productionExists && sha256(source) === sha256(target);
  const manifestAction = listed.has(path) ? (productionExists ? 'DELIVER_CHANGED' : 'DELIVER_NEW') :
    !candidateExists ? (productionExists && kind !== 'module' ? 'EXISTING_PRODUCTION_ASSET' : 'SOURCE_MISSING') :
    !productionExists ? 'ADD_NEW' : same ? 'EXISTING_IDENTICAL' :
    kind === 'map-data' || kind === 'entrypoint' || kind === 'startup-asset' ? 'ADD_CHANGED' :
    kind === 'asset' ? 'EXISTING_PRODUCTION_ASSET' : 'EXISTING_EXPORT_COMPATIBLE';
  return {
    source_path: references.get(path)?.source_path ?? 'ENTRYPOINT',
    target_path: path,
    kind,
    exists_in_candidate: candidateExists,
    exists_in_current_production: productionExists,
    manifest_action: manifestAction,
    candidate_sha256: candidateExists ? sha256(source) : null,
    production_preimage_sha256: productionExists ? sha256(target) : null,
  };
});
const missing = dependencies.filter((item) => complete ? item.kind !== 'directory' && (!listed.has(item.target_path) || !item.exists_in_candidate) : ['SOURCE_MISSING', 'ADD_NEW', 'ADD_CHANGED'].includes(item.manifest_action));
const result = {
  candidate_source_closure: candidateGraph.errors.length === 0,
  post_deploy_import_closure: postDeployGraph.errors.length === 0 && missing.length === 0,
  runtime_delivery_closure: postDeployGraph.errors.length === 0 && missing.length === 0,
  dependencies,
  missing,
  errors: [...candidateGraph.errors, ...postDeployGraph.errors],
};
return result;
}
if(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [manifestPath,candidateRoot,productionRoot]=process.argv.slice(2);
  if(!manifestPath || !candidateRoot || !productionRoot) throw Error('MANIFEST_CLOSURE_ARGUMENTS_REQUIRED');
  const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
  const result=runtimeClosure(manifest,candidateRoot,productionRoot,manifest.schema_version==='web-complete-v1');
  process.stdout.write(JSON.stringify(result)+'\n');
  if(!result.post_deploy_import_closure)process.exitCode=1;
}
