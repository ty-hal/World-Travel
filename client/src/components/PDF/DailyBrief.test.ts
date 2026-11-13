import { afterEach, describe, expect, it, vi } from 'vitest';
import { printDailyBrief } from './DailyBrief';

const write = vi.fn();
const popup = { opener: window, document: { write, close: vi.fn() }, focus: vi.fn(), print: vi.fn() };

afterEach(() => vi.restoreAllMocks());

describe('printDailyBrief', () => {
  it('FE-PDF-DAILY-001: prints locally and excludes confirmation numbers unless opted in', () => {
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    printDailyBrief({
      trip: { id: 1, title: 'Paris', currency: 'EUR' } as any,
      day: { id: 2, day_number: 1, date: '2026-01-01', title: 'Arrival' } as any,
      assignments: [
        {
          id: 3,
          order_index: 0,
          assignment_time: '09:00',
          place: { name: 'Museum', lat: 48.85, lng: 2.35, address: '1 Rue', phone: '+33' },
        },
      ] as any,
      notes: [{ text: 'Emergency contact', time: null }] as any,
      reservations: [
        {
          id: 4,
          day_id: 2,
          title: 'Train',
          reservation_time: '08:00',
          location: 'Gare',
          confirmation_number: 'SECRET',
        },
      ] as any,
      includeConfirmations: false,
    });
    const html = write.mock.calls[0][0] as string;
    expect(html).toContain('Museum');
    expect(html).toContain('Open map');
    expect(html).toContain('Emergency contact');
    expect(html).not.toContain('SECRET');
    expect(html.indexOf('Train')).toBeLessThan(html.indexOf('Museum'));
    expect(popup.opener).toBeNull();
    expect(popup.print).toHaveBeenCalled();
  });
});
