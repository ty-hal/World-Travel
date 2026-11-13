import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { User } from '../../types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { getUserTravelTimeline } from '../../services/travelTimelineService';

@Controller('api/timeline')
@UseGuards(JwtAuthGuard)
export class TimelineController {
  @Get()
  list(@CurrentUser() user: User, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    const cappedLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const cappedOffset = Math.min(Math.max(Number(offset) || 0, 0), 400);
    return getUserTravelTimeline(user.id, cappedLimit, cappedOffset);
  }
}
