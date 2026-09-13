import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { OPS_API_VERSION } from './contracts.mjs';
import { loadOpsAgentConfig } from './config.mjs';
import { createIncidentMonitor, createIncidentStore } from './incidents.mjs';
import {
  collectCharacters,
  collectServices,
  summarizeServices,
} from './provider.mjs';

const startedAt = Date.now();
const webRoot = join(dirname(fileURLToPath(import.meta.url)), 'web');
const staticFiles = Object.freeze({
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
});

function writeJson(response, statusCode, value, headers = {}) {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(body);
}

function methodRejected(response) {
  writeJson(
    response,
    405,
    {
      ok: false,
      error: 'READ_ONLY',
      message: 'Ops Agent Phase 1 accepts GET requests only.',
    },
    { Allow: 'GET' },
  );
}

async function writeStatic(response, pathname) {
  const target = staticFiles[pathname];
  if (!target) return false;
  const body = await readFile(join(webRoot, target[0]));
  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': target[1],
    'Content-Length': body.length,
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
  response.end(body);
  return true;
}

export function createOpsAgentServer(config, options = {}) {
  const collectorOptions = options.collectorOptions ?? {};
  const incidentStore = options.incidentStore ?? null;
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      if (request.method !== 'GET') {
        methodRejected(response);
        return;
      }
      if (await writeStatic(response, url.pathname)) return;
      if (url.pathname === '/health') {
        writeJson(response, 200, {
          ok: true,
          schemaVersion: OPS_API_VERSION,
          service: 'ops-agent',
          mode: 'read-only',
          startedAt: new Date(startedAt).toISOString(),
        });
        return;
      }

      const incidentMatch = url.pathname.match(
        /^\/api\/v1\/incidents\/([A-Za-z0-9_.-]+)$/,
      );
      if (url.pathname === '/api/v1/incidents') {
        const incidents = incidentStore ? await incidentStore.list() : [];
        writeJson(response, 200, {
          schemaVersion: OPS_API_VERSION,
          observedAt: new Date().toISOString(),
          incidents,
        });
        return;
      }
      if (incidentMatch) {
        const incident = incidentStore
          ? await incidentStore.read(incidentMatch[1])
          : null;
        if (!incident) {
          writeJson(response, 404, { ok: false, error: 'INCIDENT_NOT_FOUND' });
          return;
        }
        writeJson(response, 200, incident);
        return;
      }
      if (
        !['/api/v1/services', '/api/v1/characters', '/api/v1/evidence'].includes(
          url.pathname,
        )
      ) {
        writeJson(response, 404, { ok: false, error: 'NOT_FOUND' });
        return;
      }

      const observedAt = new Date().toISOString();
      if (url.pathname === '/api/v1/services') {
        const services = await collectServices(config, {
          ...collectorOptions,
          startedAt,
        });
        writeJson(response, 200, {
          schemaVersion: OPS_API_VERSION,
          observedAt,
          services,
        });
        return;
      }

      const characterResult = await collectCharacters(config, collectorOptions);
      if (url.pathname === '/api/v1/characters') {
        writeJson(response, 200, {
          schemaVersion: OPS_API_VERSION,
          observedAt,
          ...characterResult,
        });
        return;
      }

      const services = await collectServices(config, {
        ...collectorOptions,
        startedAt,
      });
      writeJson(response, 200, {
        schemaVersion: OPS_API_VERSION,
        observedAt,
        summary: summarizeServices(services, characterResult.characters),
        services,
        ...characterResult,
      });
    } catch {
      writeJson(response, 500, {
        ok: false,
        error: 'OPS_AGENT_CHECK_FAILED',
        message: 'A read-only check failed.',
      });
    }
  });
}

export async function startOpsAgent(overrides = {}) {
  const config = await loadOpsAgentConfig(overrides);
  if (!['127.0.0.1', '::1', 'localhost'].includes(config.host)) {
    throw new Error('Ops Agent Phase 1 must bind to loopback');
  }
  const incidentStore = createIncidentStore({
    directory: join(config.runtimeRoot, 'ops-agent', 'incidents'),
  });
  const monitor = createIncidentMonitor({
    store: incidentStore,
    collect: async () => {
      const [services, characterResult] = await Promise.all([
        collectServices(config, { startedAt }),
        collectCharacters(config),
      ]);
      return { services, characters: characterResult.characters };
    },
  });
  const server = createOpsAgentServer(config, { incidentStore });
  server.once('close', () => monitor.stop());
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, resolvePromise);
  });
  const address = server.address();
  console.log(
    `OPS_AGENT_READY http://${config.host}:${typeof address === 'object' ? address.port : config.port}`,
  );
  monitor.start();
  return { server, config };
}

const launchedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (launchedDirectly) {
  startOpsAgent().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
