import { beforeEach, expect, it, vi } from 'vitest';
import type express from 'express';
import { applyGlobalMiddleware } from '../../../src/middleware/globalMiddleware';
import { logDebug } from '../../../src/services/auditLog';

vi.mock('../../../src/services/auditLog', () => ({ logDebug: vi.fn(), logWarn: vi.fn(), logError: vi.fn() }));
vi.mock('../../../src/middleware/mfaPolicy', () => ({ enforceGlobalMfaPolicy: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

function finish(path: string) {
  const use = vi.fn();
  applyGlobalMiddleware({ use, set: vi.fn() } as unknown as express.Application, { bodyParser: false });
  const middleware = use.mock.calls.at(-1)![0];
  const on = vi.fn((_event, callback) => callback());
  middleware({ path, method: 'POST', ip: '127.0.0.1', query: { email: 'synthetic-query-email' }, body: { email: 'synthetic-email', phone_no: 'synthetic-phone', password: 'synthetic-password' } }, { statusCode: 400, on }, vi.fn());
  return JSON.stringify(vi.mocked(logDebug).mock.calls);
}

it('logs only request metadata for Beli, including at debug level', () => {
  const logs = finish('/api/integrations/beli/connect');
  expect(logs).toContain('/api/integrations/beli/connect');
  for (const secret of ['synthetic-email', 'synthetic-phone', 'synthetic-password', 'synthetic-query-email']) expect(logs).not.toContain(secret);
});
it('preserves redacted debug behavior for other APIs', () => {
  const logs = finish('/api/example');
  expect(logs).toContain('synthetic-email');
  expect(logs).toContain('[REDACTED]');
  expect(logs).not.toContain('synthetic-password');
});
