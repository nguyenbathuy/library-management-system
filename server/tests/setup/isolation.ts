import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, expect, vi } from 'vitest';

// Installed during collection, before the application controller is imported.
// Any unmocked outgoing HTTP/TLS/socket access makes the suite fail.
const denyNetwork = (): never => {
  throw new Error('Unmocked network access is forbidden in Phase 1 unit tests.');
};
const networkGuards = [
  vi.spyOn(globalThis, 'fetch').mockImplementation(denyNetwork),
  vi.spyOn(http, 'request').mockImplementation(denyNetwork),
  vi.spyOn(http, 'get').mockImplementation(denyNetwork),
  vi.spyOn(https, 'request').mockImplementation(denyNetwork),
  vi.spyOn(https, 'get').mockImplementation(denyNetwork),
  vi.spyOn(net, 'connect').mockImplementation(denyNetwork),
  vi.spyOn(net, 'createConnection').mockImplementation(denyNetwork),
  vi.spyOn(tls, 'connect').mockImplementation(denyNetwork),
];

afterAll(({}, suite) => {
  try {
    for (const guard of networkGuards) expect(guard).not.toHaveBeenCalled();
    const result = {
      testModule: suite.name,
      guardsInstalled: networkGuards.length,
      attemptedCalls: networkGuards.map((guard) => guard.mock.calls.length),
    };
    const moduleName = suite.name.replace(/[^a-zA-Z0-9]+/g, '_');
    writeFileSync(resolve(process.env.LMS_WB_RUN_DIR!, `network-guard-results.${moduleName}.json`), JSON.stringify(result, null, 2));
    writeFileSync(resolve(process.env.LMS_WB_RUN_DIR!, 'network-guard-results.json'), JSON.stringify(result, null, 2));
  } finally {
    for (const guard of networkGuards) guard.mockRestore();
  }
});
