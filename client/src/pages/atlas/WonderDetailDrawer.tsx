import React from 'react'
import { Landmark, MapPin, X, ExternalLink } from 'lucide-react'
import type { TranslationFn } from '../../types'

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

interface WonderDetailDrawerProps {
  wonder: AtlasWonder | null
  onClose: () => void
  onFocusMap: (wonder: AtlasWonder) => void
  t: TranslationFn
  dark: boolean
}

export default function WonderDetailDrawer({ wonder, onClose, onFocusMap, t, dark }: WonderDetailDrawerProps): React.ReactElement | null {
  if (!wonder) return null

  const tp = dark ? '#f8fafc' : '#0f172a'
  const tf = dark ? '#94a3b8' : '#64748b'
  const hero = wonder.image_urls?.[0]

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
            <Landmark size={20} style={{ color: wonder.visited ? '#22c55e' : '#818cf8', flexShrink: 0, marginTop: 2 }} />
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 18, letterSpacing: '-0.03em', color: tp }}>{wonder.label}</h2>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: tf }}>
                {[wonder.region, wonder.country].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')} style={{ border: 'none', background: 'transparent', color: tf, cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {hero ? (
          <img src={hero} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 12, marginBottom: 14 }} />
        ) : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '3px 8px', borderRadius: 99, background: wonder.visited ? 'rgba(34,197,94,0.14)' : 'rgba(129,140,248,0.14)', color: wonder.visited ? '#16a34a' : '#6366f1' }}>
            {wonder.visited ? t('atlas.wondersVisited') : t('atlas.wondersFilterUnvisited')}
          </span>
          {wonder.significance ? (
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'capitalize', padding: '3px 8px', borderRadius: 99, background: dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', color: tf }}>
              {wonder.significance}
            </span>
          ) : null}
        </div>

        {Number.isFinite(wonder.lat) && Number.isFinite(wonder.lng) ? (
          <p style={{ margin: '0 0 16px', fontSize: 12, color: tf, display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={14} />
            {Number(wonder.lat).toFixed(4)}, {Number(wonder.lng).toFixed(4)}
          </p>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            onClick={() => onFocusMap(wonder)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            {t('atlas.showOnMap')}
          </button>
          {wonder.source_url ? (
            <a href={wonder.source_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 12px', borderRadius: 10, border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`, color: tp, fontSize: 13, textDecoration: 'none' }}>
              <ExternalLink size={14} />
              {t('atlas.wonderSource')}
            </a>
          ) : null}
        </div>
      </aside>
    </div>
  )
}
