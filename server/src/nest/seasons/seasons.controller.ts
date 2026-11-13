import { Body, Controller, HttpException, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { getCrowdSeasonality, resolveCountryGeography } from '../../services/crowdSeasonalityService';
import { getHolidays } from '../../services/vacayService';
import { getCycloneSeasonality } from '../../services/cycloneSeasonalityService';
import { getNaturalHazardSeasonality } from '../../services/naturalHazardsService';

@Controller('api/seasons')
@UseGuards(JwtAuthGuard)
export class SeasonsController {
  @Post('geography/batch')
  async geographyBatch(@Body() body: { locations?: Array<{ key?: string; lat?: number; lng?: number }> }) {
    const locations = body?.locations;
    if (!Array.isArray(locations) || locations.length > 500 || locations.some(location =>
      !location || typeof location.key !== 'string' || !location.key || !Number.isFinite(location.lat) ||
      !Number.isFinite(location.lng) || location.lat! < -90 || location.lat! > 90 || location.lng! < -180 || location.lng! > 180)) {
      throw new HttpException({ error: 'Valid geography locations are required (maximum 500)' }, 400);
    }
    try { return await resolveCountryGeography(locations as Array<{ key: string; lat: number; lng: number }>) }
    catch (err: unknown) {
      console.error('[seasons] Destination geography unavailable:', err);
      throw new HttpException({ error: 'Destination geography is temporarily unavailable' }, 503);
    }
  }

  @Post('holidays/batch')
  async holidayBatch(@Body() body: { year?: number; countryCodes?: string[] }) {
    const { year, countryCodes } = body ?? {};
    if (!Number.isInteger(year) || year! < 1900 || year! > 2100 || !Array.isArray(countryCodes) || countryCodes.length > 100 || countryCodes.some(code => !/^[A-Z]{2}$/.test(code))) {
      throw new HttpException({ error: 'A valid holiday year and up to 100 country codes are required' }, 400);
    }
    const uniqueCodes = [...new Set(countryCodes)];
    return Promise.all(uniqueCodes.map(async countryCode => {
      const result = await getHolidays(String(year), countryCode);
      return { countryCode, year, source: result.source ?? 'Nager.Date', ...(result.data ? { holidays: result.data.filter(item => item.global === true) } : {}), ...(result.error ? { error: result.error } : {}) };
    }));
  }

  @Post('crowd/batch')
  async crowdBatch(@Body() body: { locations?: Array<{ key?: string; lat?: number; lng?: number }> }) {
    const locations = body?.locations;
    if (!Array.isArray(locations) || locations.length > 500 || locations.some(location =>
      !location || typeof location.key !== 'string' || !location.key || !Number.isFinite(location.lat) ||
      !Number.isFinite(location.lng) || location.lat! < -90 || location.lat! > 90 || location.lng! < -180 || location.lng! > 180)) {
      throw new HttpException({ error: 'Valid crowd locations are required (maximum 500)' }, 400);
    }
    try { return await getCrowdSeasonality(locations as Array<{ key: string; lat: number; lng: number }>) }
    catch (err: unknown) {
      console.error('[seasons] Crowd data unavailable:', err);
      throw new HttpException({ error: 'Crowd seasonality data is temporarily unavailable' }, 503);
    }
  }

  @Post('natural-hazards/batch')
  async naturalHazardsBatch(@Body() body: { locations?: Array<{ key?: string; lat?: number; lng?: number }> }) {
    const locations = body?.locations;
    if (!Array.isArray(locations) || locations.length > 500 || locations.some(location =>
      !location || typeof location.key !== 'string' || !location.key || !Number.isFinite(location.lat) ||
      !Number.isFinite(location.lng) || location.lat! < -90 || location.lat! > 90 || location.lng! < -180 || location.lng! > 180)) {
      throw new HttpException({ error: 'Valid natural-hazard locations are required (maximum 500)' }, 400);
    }
    try {
      const points = locations as Array<{ key: string; lat: number; lng: number }>;
      const [cyclones, hazards] = await Promise.all([getCycloneSeasonality(points), getNaturalHazardSeasonality(points)]);
      const cycloneByKey = new Map(cyclones.map(item => [item.key, item] as const));
      return hazards.map(item => {
        const cyclone = cycloneByKey.get(item.key);
        return { ...item, ...(cyclone?.calendar ? { cyclones: cyclone.calendar } : {}), cycloneCoverage: cyclone?.coverage ?? 'unavailable' };
      });
    }
    catch (err: unknown) {
      console.error('[seasons] Natural hazard data unavailable:', err);
      throw new HttpException({ error: 'Historical natural hazard data is temporarily unavailable' }, 503);
    }
  }
}
