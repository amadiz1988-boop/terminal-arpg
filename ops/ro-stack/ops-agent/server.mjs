import http from 'node:http';
import { pathToFileURL } from 'node:url';

import { OPS_API_VERSION } from './contracts.mjs';
import { loadOpsAgentConfig } from './config.mjs';
import {
  collectCharacters,
  collectServices,
  summarizeServices,
} from './provider.mjs';

const startedAt = Date.now();

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

export function createOpsAgentServer(config, options = {}) {
  const collectorOptions = options.collectorOptions ?? {};
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      if (request.method !== 'GET') {
        methodRejected(response);
        return;
      }
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
    } catch (error) {
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
  const server = createOpsAgentServer(config);
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, resolvePromise);
  });
  const address = server.address();
  console.log(
    `OPS_AGENT_READY http://${config.host}:${typeof address === 'object' ? address.port : config.port}`,
  );
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
