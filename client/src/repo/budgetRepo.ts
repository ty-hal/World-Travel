import { budgetApi } from '../api/client'
import { offlineDb, upsertBudgetItems } from '../db/offlineDb'
import { mutationQueue, generateUUID, nextTempId } from '../sync/mutationQueue'
import { isEffectivelyOffline } from '../sync/networkMode'
import { onlineThenCache } from './withOfflineFallback'
import type { BudgetItem } from '../types'

export const budgetRepo = {
  async list(tripId: number | string): Promise<{ items: BudgetItem[] }> {
    return onlineThenCache(
      async () => {
        const result = await budgetApi.list(tripId)
        upsertBudgetItems(result.items)
        return result
      },
      async () => ({
        items: await offlineDb.budgetItems
          .where('trip_id').equals(Number(tripId)).toArray(),
      }),
    )
  },

  async create(tripId: number | string, data: Record<string, unknown>): Promise<{ item: BudgetItem }> {
    if (isEffectivelyOffline()) {
      const tempId = nextTempId()
      const tempItem = {
        ...(data as Partial<BudgetItem>),
        id: tempId,
        trip_id: Number(tripId),
      } as BudgetItem
      await offlineDb.budgetItems.put(tempItem)
      await mutationQueue.enqueue({
        id: generateUUID(),
        tripId: Number(tripId),
        method: 'POST',
        url: `/trips/${tripId}/budget`,
        body: data,
        resource: 'budget',
        tempId,
      })
      return { item: tempItem }
    }
    const result = await budgetApi.create(tripId, data)
    upsertBudgetItems([result.item])
    return result
  },
}
