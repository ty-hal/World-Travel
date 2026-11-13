import { Module } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { TripSearchController } from './trip-search.controller';
import { TripsService } from './trips.service';

/** Trips aggregate root (C1 — Phase 3). Uses exact strangler prefixes so it does
 *  not capture the nested sub-domain mounts (collab, files, ...). */
@Module({
  controllers: [TripsController, TripSearchController],
  providers: [TripsService],
})
export class TripsModule {}
