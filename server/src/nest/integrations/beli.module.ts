import { RateLimitService } from '../auth/rate-limit.service';
import { BeliController } from './beli.controller';
import { Module } from '@nestjs/common';

@Module({ controllers: [BeliController], providers: [RateLimitService] })
export class BeliModule {}
