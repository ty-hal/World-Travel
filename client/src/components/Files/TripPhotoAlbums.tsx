import React, { useEffect, useState } from 'react'
import { addonsApi } from '../../api/client'

export default function TripPhotoAlbums({ tripId }: { tripId: number }): React.ReactElement {
  const [albums, setAlbums] = useState<any[]>([])

  useEffect(() => {
    addonsApi.atlasImported().then(data => {
      setAlbums((data.media || []).filter((item: any) => Number(item.trip_id) === tripId))
    }).catch(() => setAlbums([]))
  }, [tripId])

  return <div className="h-full overflow-y-auto bg-slate-50 p-6">
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900">Photos</h1>
      <p className="mb-6 text-sm text-gray-500">Albums and photo links associated with this trip.</p>
      {albums.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-500">No photo albums for this trip yet.</div> : <div className="space-y-8">{albums.map(album => {
        const images = album.image_urls?.length ? album.image_urls : (album.cover_url ? [album.cover_url] : [])
        return <section key={album.source_id || album.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div><h2 className="font-semibold text-gray-900">{album.title || 'Photo album'}</h2><p className="mt-1 text-xs text-gray-500">{album.caption || album.provider || 'Imported album'}</p></div>
            {album.external_url && <a href={album.external_url} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-medium text-gray-600 underline">Open source</a>}
          </div>
          {images.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{images.map((image: string, index: number) => <a key={`${image}-${index}`} href={image} target="_blank" rel="noreferrer" className="group aspect-[4/3] overflow-hidden rounded-xl bg-gray-100"><img src={image} alt={`${album.title || 'Photo album'} photo ${index + 1}`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /></a>)}</div> : <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">No images were included in the migrated album record.</div>}
        </section>
      })}</div>}
    </div>
  </div>
}
