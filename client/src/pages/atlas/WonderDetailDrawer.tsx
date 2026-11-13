import React, { useEffect, useState } from 'react'
import { Landmark, MapPin, X, ExternalLink } from 'lucide-react'
import { bucketPhotoTarget, subscribeAtlasPhotos, wonderPhotoTarget, type AtlasWonder } from './atlasPhotos'
import type { TranslationFn } from '../../types'
import type { BucketItem } from './atlasModel'

interface WonderDetailDrawerProps {
  place: { type: 'wonder'; item: AtlasWonder } | { type: 'bucket'; item: BucketItem } | null
  onClose: () => void
  onFocusMap: (place: NonNullable<WonderDetailDrawerProps['place']>) => void
  t: TranslationFn
  dark: boolean
}

export default function WonderDetailDrawer({ place, onClose, onFocusMap, t, dark }: WonderDetailDrawerProps): React.ReactElement | null {
  const [photos, setPhotos] = useState<string[]>([])
  const [photoIndex, setPhotoIndex] = useState(0)
  useEffect(() => {
    setPhotoIndex(0)
    if (!place) { setPhotos([]); return }
    const target = place.type === 'wonder' ? wonderPhotoTarget(place.item) : bucketPhotoTarget(place.item)
    return subscribeAtlasPhotos(target, setPhotos)
  }, [place])
  if (!place) return null

  const tp = dark ? '#f8fafc' : '#0f172a'
  const tf = dark ? '#94a3b8' : '#64748b'
  const isWonder = place.type === 'wonder'
  const item = place.item
  const title = place.type === 'wonder' ? place.item.label : place.item.name
  const country = place.type === 'wonder' ? place.item.country : place.item.country_code
  const region = place.type === 'wonder' ? place.item.region : null
  const lat = item.lat
  const lng = item.lng
  const visited = place.type === 'wonder' && !!place.item.visited
  const significance = place.type === 'wonder' ? place.item.significance : null
  const targetDate = place.type === 'bucket' ? place.item.target_date : null
  const notes = place.type === 'bucket' ? place.item.notes : null
  const sourceUrl = place.type === 'wonder' ? place.item.source_url : null
  const hero = photos[photoIndex]

  return (
    <div
      className="bg-[rgba(0,0,0,0.35)]"
      style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', justifyContent: 'flex-end' }}
      onClick={onClose}
    >
      <aside
        className="atlas-chrome"
        style={{
          width: 'min(380px, 100vw)',
          height: '100%',
          padding: '16px 18px 24px',
          overflowY: 'auto',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.18)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
            <Landmark size={20} style={{ color: visited ? '#22c55e' : '#818cf8', flexShrink: 0, marginTop: 2 }} />
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 18, letterSpacing: '-0.03em', color: tp }}>{title}</h2>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: tf }}>
                {[region, country].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')} style={{ border: 'none', background: 'transparent', color: tf, cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {hero ? (
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <img src={hero} alt={`${title}${photos.length > 1 ? `, image ${photoIndex + 1}` : ''}`} style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 12 }} />
            {photos.length > 1 && <>
              <button type="button" aria-label="Previous image" onClick={() => setPhotoIndex((photoIndex + photos.length - 1) % photos.length)} style={{ position: 'absolute', left: 8, top: '50%', border: 0, borderRadius: 99, padding: '5px 9px', cursor: 'pointer' }}>‹</button>
              <button type="button" aria-label="Next image" onClick={() => setPhotoIndex((photoIndex + 1) % photos.length)} style={{ position: 'absolute', right: 8, top: '50%', border: 0, borderRadius: 99, padding: '5px 9px', cursor: 'pointer' }}>›</button>
              <span style={{ position: 'absolute', right: 8, bottom: 8, color: '#fff', background: 'rgba(0,0,0,.55)', borderRadius: 99, padding: '2px 7px', fontSize: 11 }}>{photoIndex + 1} / {photos.length}</span>
            </>}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '3px 8px', borderRadius: 99, background: visited ? 'rgba(34,197,94,0.14)' : 'rgba(129,140,248,0.14)', color: visited ? '#16a34a' : '#6366f1' }}>
            {isWonder ? (visited ? t('atlas.wondersVisited') : t('atlas.wondersFilterUnvisited')) : t('atlas.bucketTab')}
          </span>
          {significance ? (
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'capitalize', padding: '3px 8px', borderRadius: 99, background: dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', color: tf }}>
              {significance}
            </span>
          ) : null}
        </div>

        {targetDate ? <p style={{ margin: '0 0 10px', fontSize: 12, color: tf }}>{targetDate}</p> : null}
        {notes ? <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.5, color: tp }}>{notes}</p> : null}
        {Number.isFinite(lat) && Number.isFinite(lng) ? (
          <p style={{ margin: '0 0 16px', fontSize: 12, color: tf, display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={14} />
            {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}
          </p>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            onClick={() => onFocusMap(place)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            {t('atlas.showOnMap')}
          </button>
          {sourceUrl ? (
            <a href={sourceUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 12px', borderRadius: 10, border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`, color: tp, fontSize: 13, textDecoration: 'none' }}>
              <ExternalLink size={14} />
              {t('atlas.wonderSource')}
            </a>
          ) : null}
        </div>
      </aside>
    </div>
  )
}
