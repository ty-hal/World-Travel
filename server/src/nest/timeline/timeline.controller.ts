import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { User } from '../../types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { getUserTravelTimeline } from '../../services/travelTimelineService';

@Controller('api/timeline')
@UseGuards(JwtAuthGuard)
export class TimelineController {
  @Get()
  list(@CurrentUser() user: User, @Query('limit') limit?: string) {
    const capped = Math.min(Math.max(Number(limit) || 200, 1), 500);
    return { items: getUserTravelTimeline(user.id, capped) };
  }
}
