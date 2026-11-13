import { describe, it, expect, vi, beforeEach } from 'vitest';

const { canAccessJourney, entryJourney, pluginsEnabled } = vi.hoisted(() => ({
  canAccessJourney: vi.fn((journeyId: number, userId: number) => (journeyId === 1 && userId === 5 ? { id: 1 } : null)),
  entryJourney: vi.fn((entryId: string) => (entryId === '42' ? { journey_id: 1 } : undefined)),
  pluginsEnabled: vi.fn(() => true),
}));
vi.mock('../../../src/db/database', () => ({
  db: { prepare: () => ({ get: (entryId: string) => entryJourney(entryId) }) },
}));
vi.mock('../../../src/nest/plugins/kill-switch', () => ({ pluginsEnabled }));
vi.mock('../../../src/services/journeyService', () => ({ canAccessJourney }));

import { JournalEntryRowsController } from '../../../src/nest/plugins/journal-entry-rows.controller';
import type { PluginRuntimeService } from '../../../src/nest/plugins/plugin-runtime.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const req = (id?: number) => ({ user: id === undefined ? undefined : { id } }) as any;
function controller(over: Partial<PluginRuntimeService> = {}) {
  const runtime = {
    providersOf: vi.fn(() => ['p1', 'p2']),
    invokeHook: vi.fn(async (id: string) => (id === 'p2' ? [{ label: 'Rating', value: '4.5' }] : [{ label: 'Weather', value: 'Sunny' }])),
    ...over,
  } as unknown as PluginRuntimeService;
  return { c: new JournalEntryRowsController(runtime), runtime };
}

describe('JournalEntryRowsController', () => {
  beforeEach(() => {
    pluginsEnabled.mockReturnValue(true);
    entryJourney.mockImplementation((entryId: string) => (entryId === '42' ? { journey_id: 1 } : undefined));
    canAccessJourney.mockReturnValue({ id: 1 } as never);
  });

  it('returns empty providers when plugins are disabled', async () => {
    pluginsEnabled.mockReturnValue(false);
    const { c, runtime } = controller();
    expect(await c.get('42', req(5))).toEqual({ providers: [] });
    expect(runtime.providersOf).not.toHaveBeenCalled();
  });

  it('returns empty providers for invalid or inaccessible entries', async () => {
    const { c, runtime } = controller();
    expect(await c.get('bad-id', req(5))).toEqual({ providers: [] });
    expect(await c.get('99', req(5))).toEqual({ providers: [] });
    canAccessJourney.mockReturnValue(null as never);
    expect(await c.get('42', req(5))).toEqual({ providers: [] });
    expect(runtime.providersOf).not.toHaveBeenCalled();
  });

  it('returns normalized provider rows and skips a provider that fails', async () => {
    const { c, runtime } = controller({
      invokeHook: vi.fn(async (pluginId: string) => {
        if (pluginId === 'p2') throw new Error('provider unavailable');
        return [
          { label: 'Weather', value: 'x'.repeat(250), url: 'javascript:alert(1)' },
          { label: 'Source', url: 'https://example.com' },
          { value: 'missing label' },
        ];
      }) as unknown as PluginRuntimeService['invokeHook'],
    });
    expect(await c.get('42', req(5))).toEqual({
      providers: [{
        pluginId: 'p1',
        items: [
          { label: 'Weather', value: 'x'.repeat(200), url: undefined },
          { label: 'Source', value: undefined, url: 'https://example.com' },
        ],
      }],
    });
    expect(runtime.invokeHook).toHaveBeenCalledWith('p1', 'journalEntryProvider', 'getRows', [42], 5, 5000);
  });
});
