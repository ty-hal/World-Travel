import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { filesApi, tripsApi } from '../../api/client'
import PhotoLightbox from '../Journey/PhotoLightbox'

type R2Object = { key: string; size: number; etag: string; contentType: string; uploaded: string }
const mediaUrl = (tripId: number, key: string, etag?: string) => `/api/trips/${tripId}/files/media/object?key=${encodeURIComponent(key)}${etag ? `&thumbnail=1&version=${encodeURIComponent(etag)}` : ''}`

function AlbumVideo({ src }: { src: string }): React.ReactElement {
  return <video src={src} controls preload="none" className="aspect-[4/3] w-full bg-black object-contain" />
}

export default function TripPhotoAlbums({ tripId, tripTitle, onCoverUpdate }: { tripId: number; tripTitle: string; onCoverUpdate: (cover: string) => void }): React.ReactElement {
  const [prefix, setPrefix] = useState('')
  const [objects, setObjects] = useState<R2Object[]>([])
  const [loadingAlbum, setLoadingAlbum] = useState(true)
  const [failedImages, setFailedImages] = useState<string[]>([])
  const [failedThumbnails, setFailedThumbnails] = useState<string[]>([])
  const [cursor, setCursor] = useState<string>()
  const [loadingMore, setLoadingMore] = useState(false)
  const loadingMoreRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [mediaFilter, setMediaFilter] = useState<'all' | 'image' | 'video'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'size'>('newest')
  const [coverKey, setCoverKey] = useState('')
  const [r2Error, setR2Error] = useState('')
  const [uploading, setUploading] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const matchingObjects = useMemo(() => objects.filter(object => mediaFilter === 'all' || object.contentType.startsWith(`${mediaFilter}/`)), [objects, mediaFilter])
  const emptyPhotos = matchingObjects.filter(object => object.contentType.startsWith('image/') && object.size === 0).length
  const failedPhotoCount = matchingObjects.filter(object => object.contentType.startsWith('image/') && object.size > 0 && failedImages.includes(object.key)).length
  const visibleObjects = useMemo(() => {
    const filtered = matchingObjects.filter(object => object.contentType.startsWith('video/') || (object.size > 0 && !failedImages.includes(object.key)))
    return filtered.sort((a, b) => sortBy === 'name' ? a.key.localeCompare(b.key) : sortBy === 'size' ? b.size - a.size : sortBy === 'oldest' ? a.uploaded.localeCompare(b.uploaded) : b.uploaded.localeCompare(a.uploaded))
  }, [matchingObjects, failedImages, sortBy])
  const photos = visibleObjects.filter(object => object.contentType.startsWith('image/'))

  const loadR2 = useCallback(async () => {
    setR2Error('')
    setLoadingAlbum(true)
    try {
      const album = await filesApi.listMedia(tripId) as { prefix: string; objects: R2Object[]; cursor?: string }
      setPrefix(album.prefix)
      setObjects(album.objects || [])
      setFailedImages([])
      setFailedThumbnails([])
      setCursor(album.cursor)
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
      setR2Error(message === 'Internal server error'
        ? 'TREK returned an unexpected server error. Check the server log for the request failure.'
        : message || 'Could not connect to Cloudflare R2. Check the server configuration.')
    } finally {
      setLoadingAlbum(false)
    }
  }, [tripId])

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMoreRef.current) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const page = await filesApi.listMedia(tripId, cursor) as { objects: R2Object[]; cursor?: string }
      setObjects(current => {
        const known = new Set(current.map(object => object.key))
        return [...current, ...(page.objects || []).filter(object => !known.has(object.key))]
      })
      setCursor(page.cursor)
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
      setR2Error(message || 'Could not load more media from Cloudflare R2.')
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [cursor, tripId])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !cursor) return
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void loadMore() }, { rootMargin: '500px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [cursor, loadMore])

  useEffect(() => {
    void loadR2()
  }, [tripId, loadR2])

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    setR2Error('')
    try {
      for (const file of Array.from(files)) {
        await filesApi.uploadMedia(tripId, file)
      }
      await loadR2()
    } catch (error) {
      setR2Error((error as { response?: { data?: { error?: string } } })?.response?.data?.error || (error instanceof Error ? error.message : 'Upload failed'))
    } finally {
      setUploading(false)
    }
  }

  const chooseCover = async (key: string) => {
    try {
      await tripsApi.update(tripId, { cover_image: mediaUrl(tripId, key) })
      onCoverUpdate(mediaUrl(tripId, key))
      setCoverKey(key)
    } catch {
      setR2Error('Could not save this image as the trip cover.')
    }
  }

  return <div className="h-full overflow-y-auto bg-surface p-6 text-content">
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold">Photos & videos</h1>
      <p className="mb-6 mt-1 text-sm text-content-secondary">Browse and upload media for {tripTitle}. R2 files stay in your Cloudflare bucket.</p>
      <section aria-busy={loadingAlbum} className="mb-8 rounded-2xl border border-edge bg-surface-card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">Cloudflare trip album</h2><p className="mt-1 text-xs text-content-muted">Load the latest files from R2 when you open or refresh this album. Videos can be up to 300 MB.</p></div>
          <label className="cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-surface-card">{uploading ? 'Uploading…' : 'Upload photos or videos'}<input type="file" accept="image/*,video/*" multiple disabled={uploading} className="sr-only" onChange={event => { void upload(event.target.files); event.target.value = '' }} /></label>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-content-secondary">Assigned album: <span className="text-content">{prefix || `${tripTitle} album`}</span></span>
          <button type="button" onClick={() => void loadR2()} disabled={loadingAlbum} className="rounded-lg border border-edge px-3 py-2 text-sm hover:bg-surface-hover disabled:cursor-wait disabled:opacity-60">Load album</button>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-content-secondary">Show <select value={mediaFilter} onChange={event => setMediaFilter(event.target.value as typeof mediaFilter)} className="rounded-md border border-edge bg-surface-input px-2 py-1 text-content"><option value="all">Everything</option><option value="image">Photos</option><option value="video">Videos</option></select></label>
          <label className="flex items-center gap-2 text-sm text-content-secondary">Sort <select value={sortBy} onChange={event => setSortBy(event.target.value as typeof sortBy)} className="rounded-md border border-edge bg-surface-input px-2 py-1 text-content"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option><option value="size">Largest first</option></select></label>
          {cursor && <span className="text-xs text-content-muted">Sort applies to media loaded so far.</span>}
        </div>
        {r2Error && <p role="status" className="mb-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">{r2Error}</p>}
        {loadingAlbum && visibleObjects.length > 0 && <p role="status" className="mb-3 text-sm text-content-muted">Refreshing album…</p>}
        {emptyPhotos > 0 && <p role="status" className="mb-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">{emptyPhotos} photo {emptyPhotos === 1 ? 'file is' : 'files are'} empty (0 B) in R2. Re-upload {emptyPhotos === 1 ? 'it' : 'them'} to display {emptyPhotos === 1 ? 'it' : 'them'}.</p>}
        {failedPhotoCount > 0 && <p role="status" className="mb-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">{failedPhotoCount} {failedPhotoCount === 1 ? 'photo could' : 'photos could'} not be loaded from R2.</p>}
        {visibleObjects.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{visibleObjects.map(object => {
          const src = mediaUrl(tripId, object.key)
          const thumbnail = mediaUrl(tripId, object.key, object.etag || object.uploaded)
          return <figure key={object.key} className="overflow-hidden rounded-xl border border-edge bg-surface-card">
            {object.contentType.startsWith('video/') ? <AlbumVideo src={src} /> : <button type="button" aria-label={`View ${object.key.split('/').pop() || 'trip photo'}`} onClick={() => setLightboxIndex(photos.findIndex(photo => photo.key === object.key))} className="block w-full cursor-zoom-in bg-black"><img src={failedThumbnails.includes(object.key) ? src : thumbnail} alt={object.key.split('/').pop() || 'Trip photo'} loading="lazy" onError={() => failedThumbnails.includes(object.key) ? setFailedImages(keys => keys.includes(object.key) ? keys : [...keys, object.key]) : setFailedThumbnails(keys => keys.includes(object.key) ? keys : [...keys, object.key])} className="aspect-[4/3] w-full object-cover" /></button>}
            <figcaption className="flex items-center justify-between gap-2 p-2"><span className="truncate text-xs text-content-secondary">{object.key.split('/').pop()}</span>{object.contentType.startsWith('image/') && <button type="button" onClick={() => void chooseCover(object.key)} className="shrink-0 rounded-md border border-edge px-2 py-1 text-xs hover:bg-surface-hover">{coverKey === object.key ? 'Cover selected' : 'Set cover'}</button>}</figcaption>
          </figure>
        })}</div> : loadingAlbum ? <p role="status" className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-edge-faint p-8 text-center text-sm text-content-muted">{objects.length ? 'Refreshing album…' : 'Loading album…'}</p> : !r2Error && <p className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-edge-faint p-8 text-center text-sm text-content-muted">{matchingObjects.length ? emptyPhotos ? 'These R2 photo objects are empty and need to be re-uploaded.' : 'Photos could not be loaded from R2.' : objects.length ? 'No media matches this filter.' : 'No media in this folder yet. Upload photos or videos to start the album.'}</p>}
        {cursor && <div ref={sentinelRef} aria-hidden="true" className="h-8" />}
        {loadingMore && <p role="status" className="mt-2 text-center text-xs text-content-muted">Loading more media…</p>}
      </section>
    </div>
    {lightboxIndex !== null && <PhotoLightbox photos={photos.map(photo => ({ id: photo.key, src: mediaUrl(tripId, photo.key), caption: photo.key.split('/').pop() }))} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />}
  </div>
}
