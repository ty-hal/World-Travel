import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, MapPin, Calendar, StickyNote, Ticket, X } from 'lucide-react'
import { tripsApi } from '../../api/client'
import { useTranslation } from '../../i18n'
import type { TripSearchResult } from '@trek/shared'

interface TripSearchPaletteProps {
  tripId: number
  open: boolean
  onClose: () => void
  onSelect: (hit: TripSearchResult) => void
}

const GROUP_ORDER: TripSearchResult['type'][] = ['place', 'day', 'note', 'reservation']

/**
 * Cmd/Ctrl+K trip search — places, days, notes, bookings. Instant feel via
 * debounced API; selection deep-links into existing planner focus handlers.
 */
export function TripSearchPalette({ tripId, open, onClose, onSelect }: TripSearchPaletteProps): React.ReactElement | null {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TripSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const seqRef = useRef(0)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setResults([])
    setActiveIdx(0)
    const tmr = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => window.clearTimeout(tmr)
  }, [open])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 1) {
      setResults([])
      setLoading(false)
      return
    }
    const seq = ++seqRef.current
    setLoading(true)
    const timer = window.setTimeout(() => {
      tripsApi.search(tripId, q)
        .then(data => {
          if (seq !== seqRef.current) return
          setResults(data.results || [])
          setActiveIdx(0)
        })
        .catch(() => {
          if (seq !== seqRef.current) return
          setResults([])
        })
        .finally(() => {
          if (seq === seqRef.current) setLoading(false)
        })
    }, 160)
    return () => window.clearTimeout(timer)
  }, [query, tripId, open])

  const grouped = useMemo(() => {
    const map = new Map<TripSearchResult['type'], TripSearchResult[]>()
    for (const type of GROUP_ORDER) map.set(type, [])
    for (const hit of results) map.get(hit.type)?.push(hit)
    return GROUP_ORDER.map(type => ({ type, items: map.get(type) || [] })).filter(g => g.items.length > 0)
  }, [results])

  const flat = useMemo(() => grouped.flatMap(g => g.items), [grouped])

  const choose = useCallback((hit: TripSearchResult) => {
    onSelect(hit)
    onClose()
  }, [onSelect, onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(i => Math.min(i + 1, Math.max(flat.length - 1, 0)))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && flat[activeIdx]) {
        e.preventDefault()
        choose(flat[activeIdx])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, flat, activeIdx, choose, onClose])

  if (!open) return null

  const groupLabel = (type: TripSearchResult['type']) => {
    if (type === 'place') return t('planner.search.group.place')
    if (type === 'day') return t('planner.search.group.day')
    if (type === 'note') return t('planner.search.group.note')
    return t('planner.search.group.reservation')
  }

  const groupIcon = (type: TripSearchResult['type']) => {
    if (type === 'place') return <MapPin size={14} />
    if (type === 'day') return <Calendar size={14} />
    if (type === 'note') return <StickyNote size={14} />
    return <Ticket size={14} />
  }

  let runningIdx = -1

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('planner.search.open')}
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        background: 'rgba(0, 0, 0, 0.55)',
        display: 'grid', placeItems: 'start center',
        paddingTop: '12vh',
        backdropFilter: 'blur(2px)',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: 'min(520px, calc(100vw - 24px))',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-primary)',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-elevated)' }}>
          <Search size={17} style={{ color: 'var(--text-muted)', flexShrink: 0 }} aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('planner.search.placeholder')}
            aria-label={t('planner.search.placeholder')}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 16, fontFamily: 'inherit', color: 'var(--text-primary)', fontWeight: 500,
            }}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
              display: 'grid', placeItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ maxHeight: 'min(420px, 55vh)', overflow: 'auto', padding: '8px 0', background: 'var(--bg-card)' }}>
          {query.trim().length === 0 && (
            <p style={{ margin: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{t('planner.search.hint')}</p>
          )}
          {query.trim().length > 0 && !loading && flat.length === 0 && (
            <p style={{ margin: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{t('planner.search.empty')}</p>
          )}
          {grouped.map(group => (
            <div key={group.type} style={{ marginBottom: 6 }}>
              <div style={{
                padding: '8px 16px 4px', fontSize: 11, fontWeight: 650,
                letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {groupIcon(group.type)}
                {groupLabel(group.type)}
              </div>
              {group.items.map(hit => {
                runningIdx += 1
                const idx = runningIdx
                const active = idx === activeIdx
                return (
                  <button
                    key={`${hit.type}-${hit.id}`}
                    type="button"
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => choose(hit)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '10px 16px', border: 'none', cursor: 'pointer',
                      background: active ? 'var(--bg-hover)' : 'transparent',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{hit.title}</div>
                    {(hit.snippet || hit.dayNumber != null) && (
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {hit.dayNumber != null ? `Day ${hit.dayNumber}` : ''}
                        {hit.dayNumber != null && hit.snippet ? ' · ' : ''}
                        {hit.snippet || ''}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Global ⌘/Ctrl+K listener for the planner. */
export function useTripSearchHotkey(onOpen: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      e.preventDefault()
      onOpen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onOpen])
}
