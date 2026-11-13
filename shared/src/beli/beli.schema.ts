import { z } from 'zod';

export const beliCategorySchema = z.enum(['RES', 'BAK', 'DES', 'COF', 'BAR']);
export type BeliCategory = z.infer<typeof beliCategorySchema>;
export const beliConnectSchema = z.union([
  z.object({ email: z.string().email().max(320), password: z.string().min(1).max(1024) }).strict(),
  z.object({ phone_no: z.string().min(7).max(32).regex(/^\+?[0-9 ()-]+$/), password: z.string().min(1).max(1024) }).strict(),
]);
export type BeliCredentials = z.infer<typeof beliConnectSchema>;
export const beliSearchSchema = z.object({
  tripId: z.number().int().positive(),
  placeId: z.number().int().positive(),
  category: beliCategorySchema.default('RES'),
  radiusKm: z.number().min(0.1).max(5).default(2),
}).strict();
export type BeliSearch = z.infer<typeof beliSearchSchema>;
export interface BeliStatus {
  connected: boolean;
  state: 'disconnected' | 'connected' | 'syncing' | 'reconnect' | 'error';
  syncedAt: string | null;
  ratedCount: number;
  predictionCount: number;
}
export interface BeliSuggestion {
  id: number;
  name: string;
  lat: number;
  lng: number;
  placeId: string | null;
  cuisines: string[];
  price: number | null;
  distanceKm: number;
  prediction: number | null;
  evidence: 'both' | 'history' | 'beli' | 'nearby';
  reasons: string[];
  historyMatches: number;
  statusVerified: boolean;
}
export interface BeliRecommendations {
  origin: { name: string; lat: number; lng: number };
  syncedAt: string;
  discoveredAt: string;
  stale: boolean;
  total: number;
  scored: number;
  suggestions: BeliSuggestion[];
}
