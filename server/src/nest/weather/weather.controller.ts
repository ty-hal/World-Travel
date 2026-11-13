import { Body, Controller, Get, HttpException, Post, Query, UseGuards } from '@nestjs/common';
import type { WeatherResult } from '@trek/shared';
import { WeatherService } from './weather.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiError, monthlyClimatePeriod } from '../../services/weatherService';

/**
 * /api/weather — first migrated leaf module (the pilot).
 *
 * Behaviour is byte-identical to the legacy Express route (server/src/routes/
 * weather.ts): same paths, query params, status codes and `{ error }` bodies.
 *
 * Parity note: the "X is required" 400s and the 500 fallback messages are bespoke
 * strings, not the generic Zod-pipe envelope, so they are reproduced here exactly
 * rather than derived from the schema. The Zod contract/types live in
 * @trek/shared/weather and are used for typing; `lang` defaults to 'de' only when
 * the param is absent, matching the Express destructuring default.
 */
@Controller('api/weather')
@UseGuards(JwtAuthGuard)
export class WeatherController {
  constructor(private readonly weather: WeatherService) {}

  @Get()
  async getWeather(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('date') date?: string,
    @Query('lang') lang?: string,
  ): Promise<WeatherResult> {
    if (!lat || !lng) {
      throw new HttpException({ error: 'Latitude and longitude are required' }, 400);
    }
    try {
      return await this.weather.get(lat, lng, date, lang ?? 'de');
    } catch (err: unknown) {
      throw toHttp(err, 'Weather error:', 'Error fetching weather data');
    }
  }

  @Get('detailed')
  async getDetailed(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('date') date?: string,
    @Query('lang') lang?: string,
  ): Promise<WeatherResult> {
    if (!lat || !lng || !date) {
      throw new HttpException({ error: 'Latitude, longitude, and date are required' }, 400);
    }
    try {
      return await this.weather.getDetailed(lat, lng, date, lang ?? 'de');
    } catch (err: unknown) {
      throw toHttp(err, 'Detailed weather error:', 'Error fetching detailed weather data');
    }
  }

  @Get('climate')
  async getClimate(@Query('lat') lat?: string, @Query('lng') lng?: string) {
    if (!lat || !lng || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) throw new HttpException({ error: 'Valid latitude and longitude are required' }, 400)
    try { return { source: 'Open-Meteo ERA5', period: monthlyClimatePeriod(), months: await this.weather.climate(Number(lat), Number(lng)) } }
    catch (err: unknown) { throw toHttp(err, 'Climate error:', 'Error fetching climate data') }
  }

  @Post('climate/batch')
  async getClimateBatch(@Body() body: { locations?: Array<{ key?: string; lat?: number; lng?: number }> }) {
    const locations = body?.locations
    if (!Array.isArray(locations) || locations.length > 500 || locations.some(location => !location || typeof location.key !== 'string' || !Number.isFinite(location.lat) || !Number.isFinite(location.lng) || location.lat! < -90 || location.lat! > 90 || location.lng! < -180 || location.lng! > 180)) {
      throw new HttpException({ error: 'Valid climate locations are required (maximum 500)' }, 400)
    }
    return (await this.weather.climateBatch(locations as Array<{ key: string; lat: number; lng: number }>)).map(result => result.months
      ? { ...result, source: 'Open-Meteo ERA5', period: monthlyClimatePeriod() }
      : result)
  }

}

/** Maps a thrown error to the same status + `{ error }` body the Express route sent. */
function toHttp(err: unknown, logPrefix: string, fallback: string): HttpException {
  if (err instanceof ApiError) {
    return new HttpException({ error: err.message }, err.status);
  }
  console.error(logPrefix, err);
  return new HttpException({ error: fallback }, 500);
}
