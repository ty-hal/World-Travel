import React, { useEffect, useState } from 'react'
import Navbar from '../components/Layout/Navbar'
import apiClient from '../api/client'
import { useTranslation } from '../i18n'
import { useNavigate } from 'react-router-dom'
import { Calendar, MapPin, History } from 'lucide-react'

interface TimelineItem {
  id: string
  kind: 'trip' | 'change' | 'country'
  date: string
  title: string
  subtitle?: string
  trip_id?: number
}

export default function TravelTimelinePage(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiClient.get('/timeline', { params: { limit: 200 } })
      .then(res => { if (!cancelled) setItems(res.data.items || []) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const iconFor = (kind: TimelineItem['kind']) => {
    if (kind === 'country') return MapPin
    if (kind === 'change') return History
    return Calendar
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-6" style={{ paddingTop: 'calc(var(--nav-h) + 16px)' }}>
        <h1 className="text-2xl font-black tracking-tight text-content mb-1">{t('timeline.title')}</h1>
        <p className="text-sm text-content-muted mb-6">{t('timeline.subtitle')}</p>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 rounded-full animate-spin border-edge border-t-content" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-content-muted text-sm">{t('timeline.empty')}</p>
        ) : (
          <ol className="space-y-3">
            {items.map(item => {
              const Icon = iconFor(item.kind)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="w-full text-left rounded-xl border border-edge bg-surface-card px-4 py-3 hover:bg-surface-hover transition-colors"
                    onClick={() => item.trip_id && navigate(`/trips/${item.trip_id}`)}
                    disabled={!item.trip_id}
                  >
                    <div className="flex items-start gap-3">
                      <Icon size={16} className="text-content-muted mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-semibold text-content truncate">{item.title}</span>
                          <span className="text-[11px] text-content-faint shrink-0 tabular-nums">{item.date}</span>
                        </div>
                        {item.subtitle ? <p className="text-xs text-content-muted mt-0.5">{item.subtitle}</p> : null}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </main>
    </div>
  )
}
