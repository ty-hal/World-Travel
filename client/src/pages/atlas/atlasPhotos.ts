import { mapsApi, tripsApi } from '../../api/client'
import type { BucketItem } from './atlasModel'

export interface AtlasWonder {
  source_id: string
  label: string
  country?: string
  region?: string
  significance?: string
  lat?: number
  lng?: number
  visited?: boolean | number
  source_url?: string | null
  image_urls?: string[]
}

export interface AtlasPhotoTarget {
  key: string
  query: string
  lat?: number | null
  lng?: number | null
  savedPhotos?: string[]
}

type PhotoCacheEntry = { photos: string[]; listeners: Set<(photos: string[]) => void>; loading?: Promise<void> }
const photoCache = new Map<string, PhotoCacheEntry>()

export const wonderPhotoTarget = (wonder: AtlasWonder): AtlasPhotoTarget => ({
  key: `wonder:${wonder.source_id}`, query: [wonder.label, wonder.country].filter(Boolean).join(' '),
  lat: wonder.lat, lng: wonder.lng, savedPhotos: wonder.image_urls,
})
export const bucketPhotoTarget = (item: BucketItem): AtlasPhotoTarget => ({
  key: `bucket:${item.id}:${item.name}:${item.lat}:${item.lng}`, query: item.name, lat: item.lat, lng: item.lng,
})

function publishPhotos(entry: PhotoCacheEntry, photos: string[]): void {
  entry.photos = [...new Set([...entry.photos, ...photos])]
  entry.listeners.forEach(listener => listener(entry.photos))
  if (typeof Image !== 'undefined') entry.photos.slice(0, 2).forEach(url => { const image = new Image(); image.src = url })
}

function warmPhotoTarget(target: AtlasPhotoTarget): Promise<void> {
  let entry = photoCache.get(target.key)
  if (!entry) {
    entry = { photos: [], listeners: new Set() }
    photoCache.set(target.key, entry)
  }
  if (target.savedPhotos?.length) {
    publishPhotos(entry, target.savedPhotos)
    return Promise.resolve()
  }
  if (entry.loading) return entry.loading
  if (entry.photos.length) return Promise.resolve()

  const search = tripsApi.searchCoverImages(target.query)
    .then((data: { photos?: { url?: string; thumb?: string }[] }) => publishPhotos(entry!, (data.photos || []).map(photo => photo.thumb || photo.url).filter((url): url is string => Boolean(url))))
    .catch(() => {})
  const mapPhoto = Number.isFinite(target.lat) && Number.isFinite(target.lng)
    ? mapsApi.placePhoto(`coords:${target.lat},${target.lng}`, Number(target.lat), Number(target.lng), target.query)
        .then(result => { if (result.photoUrl) publishPhotos(entry!, [result.photoUrl]) }).catch(() => {})
    : Promise.resolve()
  entry.loading = Promise.all([search, mapPhoto]).then(() => {
    entry!.loading = undefined
    if (!entry!.photos.length) photoCache.delete(target.key)
  })
  return entry.loading
}

export function subscribeAtlasPhotos(target: AtlasPhotoTarget, listener: (photos: string[]) => void): () => void {
  let entry = photoCache.get(target.key)
  if (!entry) {
    entry = { photos: [], listeners: new Set() }
    photoCache.set(target.key, entry)
  }
  entry.listeners.add(listener)
  listener(entry.photos)
  void warmPhotoTarget(target)
  return () => entry!.listeners.delete(listener)
}

export async function warmAtlasPhotos(targets: AtlasPhotoTarget[]): Promise<void> {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(3, targets.length) }, async () => {
    while (next < targets.length) await warmPhotoTarget(targets[next++])
  }))
}
