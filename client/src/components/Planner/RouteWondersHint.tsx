import React, { useEffect, useState } from 'react'
import { Landmark } from 'lucide-react'
import apiClient from '../../api/client'
import { useTranslation } from '../../i18n'

interface PlaceLike { lat?: number | null; lng?: number | null }

interface RouteWondersHintProps {
  places: PlaceLike[]
}

export default function RouteWondersHint({ places }: RouteWondersHintProps): React.ReactElement | null {
  const { t } = useTranslation()
  const [wonders, setWonders] = useState<Array<{ label: string; visited?: boolean }>>([])

  useEffect(() => {
    const coords = places.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    if (coords.length < 2) { setWonders([]); return }
    const lats = coords.map(p => Number(p.lat))
    const lngs = coords.map(p => Number(p.lng))
    const pad = 0.08
    const params = {
      minLat: Math.min(...lats) - pad,
      maxLat: Math.max(...lats) + pad,
      minLng: Math.min(...lngs) - pad,
      maxLng: Math.max(...lngs) + pad,
      limit: 6,
    }
    let cancelled = false
    apiClient.get('/addons/atlas/wonders/near', { params })
      .then(res => { if (!cancelled) setWonders((res.data.wonders || []).map((w: any) => ({ label: w.label, visited: w.visited }))) })
      .catch(() => { if (!cancelled) setWonders([]) })
    return () => { cancelled = true }
  }, [places])

  if (!wonders.length) return null

  return (
    <div className="px-3 py-2 text-xs text-content-muted border-t border-edge">
      <div className="flex items-center gap-1.5 font-semibold text-content mb-1">
        <Landmark size={12} />
        {t('atlas.wondersAlongRoute')}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {wonders.map(w => (
          <span key={w.label} className="px-2 py-0.5 rounded-full border border-edge" style={{ color: w.visited ? '#16a34a' : undefined }}>
            {w.label}
          </span>
        ))}
      </div>
    </div>
  )
}
