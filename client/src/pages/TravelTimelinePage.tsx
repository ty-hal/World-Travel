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
  const [loadError, setLoadError] = useState(false)
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiClient.get('/timeline', { params: { limit: 50, offset: 0 } })
      .then(res => {
        if (cancelled) return
        setLoadError(false)
        setItems(res.data.items || [])
        setNextOffset(res.data.nextOffset ?? null)
      })
      .catch(() => { if (!cancelled) setLoadError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [loadAttempt])

  const loadMore = async () => {
    if (nextOffset == null || loadingMore) return
    setLoadingMore(true)
    setLoadMoreError(false)
    try {
      const res = await apiClient.get('/timeline', { params: { limit: 50, offset: nextOffset } })
      setItems(current => [...current, ...(res.data.items || [])])
      setNextOffset(res.data.nextOffset ?? null)
    } catch {
      setLoadMoreError(true)
    } finally {
      setLoadingMore(false)
    }
  }

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
          <div role="status" className="flex justify-center py-16">
            <span className="sr-only">{t('common.loading')}</span>
            <div aria-hidden="true" className="w-8 h-8 border-2 rounded-full animate-spin border-edge border-t-content" />
          </div>
        ) : loadError ? (
          <div role="alert" className="rounded-xl border border-edge bg-surface-card p-4 text-sm text-content-muted">
            <p>{t('timeline.loadError')}</p>
            <button type="button" onClick={() => setLoadAttempt(attempt => attempt + 1)} className="mt-3 rounded-lg border border-edge px-3 py-2 font-semibold text-content hover:bg-surface-hover">
              {t('timeline.retry')}
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className="text-content-muted text-sm">{t('timeline.empty')}</p>
        ) : (
          <>
          <ol className="space-y-3">
            {items.map(item => {
              const Icon = iconFor(item.kind)
              const content = (
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
              )
              return (
                <li key={item.id}>
                  {item.trip_id ? (
                    <button
                      type="button"
                      className="w-full text-left rounded-xl border border-edge bg-surface-card px-4 py-3 hover:bg-surface-hover transition-colors"
                      onClick={() => navigate(`/trips/${item.trip_id}`)}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="w-full rounded-xl border border-edge bg-surface-card px-4 py-3">
                      {content}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
          {nextOffset != null && (
            <div className="mt-5">
              {loadMoreError && <p role="alert" className="mb-2 text-center text-sm text-content-muted">{t('timeline.loadMoreError')}</p>}
              <button type="button" onClick={loadMore} disabled={loadingMore} className="w-full rounded-xl border border-edge bg-surface-card px-4 py-3 text-sm font-semibold text-content hover:bg-surface-hover disabled:opacity-60">
                {loadingMore ? t('common.loading') : loadMoreError ? t('timeline.retry') : 'Load more'}
              </button>
            </div>
          )}
          </>
        )}
      </main>
    </div>
  )
}
