import fs from 'node:fs';
import { expect, it, vi } from 'vitest';

it('never persists the unit-test encryption key over the personal install key', async () => {
  const write = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
  try {
    await import('../../src/config');
    expect(write.mock.calls.some(([file]) => String(file).endsWith('.encryption_key'))).toBe(false);
  } finally { write.mockRestore(); }
});
