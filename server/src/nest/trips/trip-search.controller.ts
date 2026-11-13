import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import type { User } from '../../types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { canAccessTrip } from '../../db/database';
import { searchTrip } from '../../services/tripSearchService';

@Controller('api/trips/:tripId/search')
@UseGuards(JwtAuthGuard)
export class TripSearchController {
  @Get()
  search(
    @CurrentUser() user: User,
    @Param('tripId') tripId: string,
    @Query('q') q?: string,
  ) {
    if (!canAccessTrip(tripId, user.id)) return { results: [] };
    return { results: searchTrip(tripId, q || '') };
  }
}
