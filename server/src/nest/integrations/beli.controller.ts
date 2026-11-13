import { BeliError } from '../../services/beli/client';
import { connectBeli, disconnectBeli, getBeliStatus, recommendBeli, syncBeli } from '../../services/beli/service';
import type { User } from '../../types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RateLimitService } from '../auth/rate-limit.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { Body, Controller, Delete, Get, Header, HttpCode, HttpException, Post, UseGuards } from '@nestjs/common';
import { beliConnectSchema, beliSearchSchema, type BeliSearch, type BeliCredentials } from '@trek/shared';

@Controller('api/integrations/beli')
@UseGuards(JwtAuthGuard)
export class BeliController {
  constructor(private readonly limits: RateLimitService) {}
  private async call<T>(userId: number, action: string, operation: () => T | Promise<T>): Promise<T> {
    if (!this.limits.check(`beli:${action}`, String(userId), action === 'connect' ? 5 : 30, 15 * 60_000, Date.now()))
      throw new HttpException({ error: 'Too many Beli requests. Try again later.' }, 429);
    try {
      return await operation();
    } catch (error) {
      if (error instanceof BeliError && error.authFailure) {
        // Only fixed classifications and HTTP status; never credentials or raw upstream text.
        console.warn('[Beli] authentication rejected', error.authFailure);
      }
      throw new HttpException(
        { error: error instanceof BeliError ? error.message : 'Beli request failed.' },
        error instanceof BeliError ? error.status : 502,
      );
    }
  }
  @Get()
  @Header('Cache-Control', 'private, no-store')
  status(@CurrentUser() user: User) {
    return getBeliStatus(user.id);
  }

  @Post('connect')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  connect(@CurrentUser() user: User, @Body(new ZodValidationPipe(beliConnectSchema)) body: BeliCredentials) {
    return this.call(user.id, 'connect', () => connectBeli(user.id, body));
  }
  @Post('sync')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  sync(@CurrentUser() user: User) {
    return this.call(user.id, 'sync', () => syncBeli(user.id));
  }

  @Delete()
  @Header('Cache-Control', 'private, no-store')
  disconnect(@CurrentUser() user: User) {
    return disconnectBeli(user.id);
  }

  @Post('recommendations')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  recommendations(@CurrentUser() user: User, @Body(new ZodValidationPipe(beliSearchSchema)) body: BeliSearch) {
    return this.call(user.id, 'recommendations', () => recommendBeli(user.id, body));
  }
}
