import { z } from 'zod'

export const tripSearchResultTypeSchema = z.enum(['place', 'day', 'note', 'reservation'])
export type TripSearchResultType = z.infer<typeof tripSearchResultTypeSchema>

export const tripSearchResultSchema = z.object({
  type: tripSearchResultTypeSchema,
  id: z.number(),
  title: z.string(),
  snippet: z.string().nullable().optional(),
  dayId: z.number().nullable().optional(),
  dayNumber: z.number().nullable().optional(),
  date: z.string().nullable().optional(),
  placeId: z.number().nullable().optional(),
})
export type TripSearchResult = z.infer<typeof tripSearchResultSchema>

export const tripSearchResponseSchema = z.object({
  results: z.array(tripSearchResultSchema),
})
export type TripSearchResponse = z.infer<typeof tripSearchResponseSchema>
