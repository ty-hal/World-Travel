import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { User } from '../../types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { canAccessTrip } from '../../db/database';
import { listTripChanges, recordTripChange } from '../../services/tripHistoryService';

@Controller('api/trips/:tripId/history')
@UseGuards(JwtAuthGuard)
export class HistoryController {
  @Get()
  list(@CurrentUser() user: User, @Param('tripId') tripId: string, @Query('limit') limit?: string) {
    if (!canAccessTrip(tripId, user.id)) return { events: [] };
    return { events: listTripChanges(tripId, user.id, Number(limit) || 100) };
  }

  @Post()
  record(@CurrentUser() user: User, @Param('tripId') tripId: string, @Body() body: {
    action?: string; entityType?: string; entityId?: number | string; before?: unknown; after?: unknown;
  }) {
    if (!body.action || !body.entityType) return { event: null };
    return { event: recordTripChange({
      tripId, userId: user.id, action: body.action, entityType: body.entityType,
      entityId: body.entityId, before: body.before, after: body.after,
    }) };
  }
}
