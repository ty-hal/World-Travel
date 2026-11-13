import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { GUARDS_METADATA, HEADERS_METADATA } from '@nestjs/common/constants';
import { BeliController } from '../../../src/nest/integrations/beli.controller';
import { JwtAuthGuard } from '../../../src/nest/auth/jwt-auth.guard';
import { RateLimitService } from '../../../src/nest/auth/rate-limit.service';
import { connectBeli, recommendBeli } from '../../../src/services/beli/service';
import type { User } from '../../../src/types';

vi.mock('../../../src/services/beli/service', () => ({ connectBeli: vi.fn(), recommendBeli: vi.fn(), disconnectBeli: vi.fn(), getBeliStatus: vi.fn(), syncBeli: vi.fn() }));
const user = { id: 7 } as User;
describe('Beli controller boundaries', () => {
  it('requires authentication and marks every route private/no-store', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, BeliController)).toContain(JwtAuthGuard);
    for (const method of ['status', 'connect', 'sync', 'disconnect', 'recommendations'] as const) {
      expect(Reflect.getMetadata(HEADERS_METADATA, BeliController.prototype[method])).toContainEqual({ name: 'Cache-Control', value: 'private, no-store' });
    }
  });
  it('uses only the current authenticated user for linking and personalization', async () => {
    const c = new BeliController(new RateLimitService());
    const credentials = { email: 'fake@example.test', password: 'synthetic' };
    await c.connect(user, credentials);
    expect(connectBeli).toHaveBeenCalledWith(7, credentials);
    const body = { tripId: 1, placeId: 2, category: 'RES' as const, radiusKm: 2 };
    await c.recommendations(user, body);
    expect(recommendBeli).toHaveBeenCalledWith(7, body);
  });
  it('sanitizes unexpected errors and rate limits repeated sign-in', async () => {
    const c = new BeliController(new RateLimitService());
    vi.mocked(connectBeli).mockRejectedValue(new Error('synthetic-secret'));
    for (let i = 0; i < 5; i++) {
      try { await c.connect(user, { email: 'fake@example.test', password: 'synthetic' }); } catch (error) { expect(String(error)).not.toContain('synthetic-secret'); }
    }
    await expect(c.connect(user, { email: 'fake@example.test', password: 'synthetic' })).rejects.toMatchObject({ status: 429 });
  });
});
