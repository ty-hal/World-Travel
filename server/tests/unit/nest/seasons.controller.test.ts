import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCrowdSeasonality, resolveCountryGeography, getHolidays, getCycloneSeasonality, getNaturalHazardSeasonality } = vi.hoisted(() => ({ getCrowdSeasonality: vi.fn(), resolveCountryGeography: vi.fn(), getHolidays: vi.fn(), getCycloneSeasonality: vi.fn(), getNaturalHazardSeasonality: vi.fn() }));
vi.mock('../../../src/services/crowdSeasonalityService', () => ({ getCrowdSeasonality, resolveCountryGeography }));
vi.mock('../../../src/services/cycloneSeasonalityService', () => ({ getCycloneSeasonality }));
vi.mock('../../../src/services/naturalHazardsService', () => ({ getNaturalHazardSeasonality }));
vi.mock('../../../src/services/vacayService', () => ({ getHolidays }));

import { SeasonsController } from '../../../src/nest/seasons/seasons.controller';

describe('SeasonsController holiday batch', () => {
  beforeEach(() => { getHolidays.mockReset(); resolveCountryGeography.mockReset(); });

  it('resolves country codes for worldwide holiday locations', async () => {
    resolveCountryGeography.mockResolvedValue([{ key: 'mexico', countryCode: 'MX' }]);
    const result = await new SeasonsController().geographyBatch({ locations: [{ key: 'mexico', lat: 19, lng: -99 }] });
    expect(result).toEqual([{ key: 'mexico', countryCode: 'MX' }]);
  });

  it('returns national dates from the shared Vacay holiday contract', async () => {
    getHolidays.mockResolvedValue({ data: [
      { date: '2027-01-01', name: 'New Year', global: true },
      { date: '2027-03-01', name: 'Local observance', global: false },
    ] });
    const result = await new SeasonsController().holidayBatch({ year: 2027, countryCodes: ['GR', 'GR'] });
    expect(result).toEqual([{ countryCode: 'GR', year: 2027, source: 'Nager.Date', holidays: [{ date: '2027-01-01', name: 'New Year', global: true }] }]);
    expect(getHolidays).toHaveBeenCalledTimes(1);
    expect(getHolidays).toHaveBeenCalledWith('2027', 'GR');
  });

  it('preserves alternate holiday-provider attribution', async () => {
    getHolidays.mockResolvedValue({ data: [{ date: '2026-01-01', name: 'New Year', global: true }], source: 'OpenHolidays' });
    await expect(new SeasonsController().holidayBatch({ year: 2026, countryCodes: ['IT'] })).resolves.toEqual([
      { countryCode: 'IT', year: 2026, source: 'OpenHolidays', holidays: [{ date: '2026-01-01', name: 'New Year', global: true }] },
    ]);
  });

  it('rejects malformed year and country input before accessing the provider', async () => {
    await expect(new SeasonsController().holidayBatch({ year: 22, countryCodes: ['GR'] })).rejects.toMatchObject({ status: 400 });
    await expect(new SeasonsController().holidayBatch({ year: 2027, countryCodes: ['GRC'] })).rejects.toMatchObject({ status: 400 });
    expect(getHolidays).not.toHaveBeenCalled();
  });
});

describe('SeasonsController natural hazard batch', () => {
  beforeEach(() => { getCycloneSeasonality.mockReset(); getNaturalHazardSeasonality.mockReset(); });

  it('rejects malformed coordinates before loading any provider', async () => {
    await expect(new SeasonsController().naturalHazardsBatch({ locations: [{ key: 'bad', lat: 0, lng: 181 }] })).rejects.toMatchObject({ status: 400 });
    expect(getCycloneSeasonality).not.toHaveBeenCalled();
    expect(getNaturalHazardSeasonality).not.toHaveBeenCalled();
  });

  it('combines globally covered hazards with regional cyclone coverage', async () => {
    getCycloneSeasonality.mockResolvedValue([{ key: 'mexico', coverage: 'unsupported' }]);
    getNaturalHazardSeasonality.mockResolvedValue([{ key: 'mexico', hazards: { earthquakes: { events: 4 } } }]);
    const locations = [{ key: 'mexico', lat: 19, lng: -99 }];
    expect(await new SeasonsController().naturalHazardsBatch({ locations })).toEqual([{ key: 'mexico', hazards: { earthquakes: { events: 4 } }, cycloneCoverage: 'unsupported' }]);
    expect(getCycloneSeasonality).toHaveBeenCalledWith(locations);
    expect(getNaturalHazardSeasonality).toHaveBeenCalledWith(locations);
  });
});
