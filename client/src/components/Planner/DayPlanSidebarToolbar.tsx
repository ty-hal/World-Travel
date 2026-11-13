import React, { useState, useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { ChevronsDownUp, ChevronsUpDown, FileDown, FileText, Undo2, ArrowUpDown, CalendarPlus, Route as RouteIcon, Search } from 'lucide-react'
import { downloadTripPDF } from '../PDF/TripPDF'
import { printDailyBrief } from '../PDF/DailyBrief'
import { DayReorderPopup } from './DayReorderPopup'
import Tooltip from '../shared/Tooltip'
import { useToast } from '../shared/Toast'
import { IcsSubscribeModal } from './IcsSubscribeModal'
import { isRoutableReservation } from '../../utils/reservationRoutes'
import type { Trip, Day, Place, Category, AssignmentsMap, Reservation, DayNote } from '../../types'

interface DayPlanSidebarToolbarProps {
  tripId: number
  trip: Trip
  days: Day[]
  selectedDayId: number | null
  places: Place[]
  categories: Category[]
  assignments: AssignmentsMap
  reservations: Reservation[]
  allConnectionsShown?: boolean
  onToggleAllConnections?: () => void
  dayNotes: Record<string, DayNote[]>
  t: (key: string, params?: Record<string, any>) => string
  locale: string
  toast: ReturnType<typeof useToast>
  pdfHover: boolean
  setPdfHover: (v: boolean) => void
  icsHover: boolean
  setIcsHover: (v: boolean) => void
  expandedDays: Set<number>
  setExpandedDays: (next: Set<number>) => void
  onUndo?: () => void
  canUndo: boolean
  undoHover: boolean
  setUndoHover: (v: boolean) => void
  lastActionLabel: string | null
  canEditDays?: boolean
  onReorderDays?: (orderedIds: number[]) => void
  onAddDay?: (position?: number) => void
  onOpenSearch?: () => void
}

export function DayPlanSidebarToolbar({
  tripId, trip, days, selectedDayId, places, categories, assignments, reservations, dayNotes,
  allConnectionsShown = false, onToggleAllConnections,
  t, locale, toast, setIcsHover,
  expandedDays, setExpandedDays, onUndo, canUndo, undoHover, setUndoHover, lastActionLabel,
  canEditDays, onReorderDays, onAddDay, onOpenSearch,
}: DayPlanSidebarToolbarProps) {
  const [reorderOpen, setReorderOpen] = useState(false)
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const exportBtnRef = useRef<HTMLButtonElement>(null)
  const exportMenuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [exportMenuVisible, setExportMenuVisible] = useState(false)
  const [exportMenuPos, setExportMenuPos] = useState<{ top: number; right: number } | null>(null)

  const placeExportMenu = () => {
    const el = exportBtnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setExportMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
  }

  const showExportMenu = () => {
    if (exportMenuTimeoutRef.current) clearTimeout(exportMenuTimeoutRef.current)
    placeExportMenu()
    setExportMenuVisible(true)
    setIcsHover(true)
  }
  const hideExportMenu = () => {
    exportMenuTimeoutRef.current = setTimeout(() => {
      setExportMenuVisible(false)
      setIcsHover(false)
    }, 120)
  }

  useEffect(() => () => {
    if (exportMenuTimeoutRef.current) clearTimeout(exportMenuTimeoutRef.current)
  }, [])

  const iconBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 36, height: 36, borderRadius: 9,
    border: '1px solid var(--border-primary)', background: 'none',
    color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit', padding: 0,
    transition: 'color 0.15s, border-color 0.15s, background 0.15s',
  }

  const menuItemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 7,
    width: '100%', padding: '8px 12px', border: 'none',
    background: 'transparent', cursor: 'pointer',
    fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
    color: 'var(--text-primary)', textAlign: 'left',
    transition: 'background 0.1s',
  }

  const exportMenu = exportMenuVisible && exportMenuPos && ReactDOM.createPortal(
    <div
      role="menu"
      onMouseEnter={showExportMenu}
      onMouseLeave={hideExportMenu}
      style={{
        position: 'fixed', top: exportMenuPos.top, right: exportMenuPos.right,
        zIndex: 100000, minWidth: 180,
        background: 'var(--bg-card)',
        borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
        border: '1px solid var(--border-primary)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setExportMenuVisible(false)
          const day = days.find(candidate => candidate.id === selectedDayId) || days[0]
          if (!day) return
          try {
            printDailyBrief({
              trip, day,
              assignments: assignments[String(day.id)] || [],
              notes: dayNotes[String(day.id)] || [],
              reservations,
              includeConfirmations: window.confirm('Include reservation confirmation numbers?'),
            })
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e))
          }
        }}
        style={menuItemStyle}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
      >
        <FileText size={13} strokeWidth={2} />
        {t('dayplan.brief')}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={async () => {
          setExportMenuVisible(false)
          const flatNotes = Object.entries(dayNotes).flatMap(([dayId, notes]) =>
            notes.map(n => ({ ...n, day_id: Number(dayId) }))
          )
          try {
            await downloadTripPDF({ trip, days, places, assignments, categories, dayNotes: flatNotes, reservations, t, locale })
          } catch (e) {
            console.error('PDF error:', e)
            toast.error(t('dayplan.pdfError') + ': ' + ((e as Error)?.message || String(e)))
          }
        }}
        style={menuItemStyle}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
      >
        <FileDown size={13} strokeWidth={2} />
        {t('dayplan.pdf')}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={async () => {
          setExportMenuVisible(false)
          setIcsHover(false)
          try {
            const res = await fetch(`/api/trips/${tripId}/export.ics`, { credentials: 'include' })
            if (!res.ok) throw new Error()
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${trip?.title || 'trip'}.ics`
            a.click()
            URL.revokeObjectURL(url)
          } catch { toast.error(t('planner.icsExportFailed')) }
        }}
        style={menuItemStyle}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
      >
        <FileDown size={13} strokeWidth={2} />
        Download ICS
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setExportMenuVisible(false)
          setIcsHover(false)
          setSubscribeOpen(true)
        }}
        style={menuItemStyle}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
      >
        <CalendarPlus size={13} strokeWidth={2} />
        Subscribe to calendar
      </button>
    </div>,
    document.body,
  )

  return (
    <div className="border-b border-edge-faint" style={{ padding: '12px 16px 12px 18px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'nowrap' }}>
        {onOpenSearch && (
          <Tooltip label={`${t('planner.search.open')} (⌘K)`} placement="bottom">
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label={t('planner.search.open')}
              style={{ ...iconBtn, color: 'var(--text-secondary)' }}
            >
              <Search size={16} strokeWidth={2} />
            </button>
          </Tooltip>
        )}

        {(() => {
          const allExpanded = days.length > 0 && days.every(d => expandedDays.has(d.id))
          const label = allExpanded ? t('dayplan.collapseAll') : t('dayplan.expandAll')
          return (
            <Tooltip label={label} placement="bottom">
              <button
                onClick={() => {
                  const next = allExpanded ? new Set<number>() : new Set(days.map(d => d.id))
                  setExpandedDays(next)
                  try { localStorage.setItem(`day-expanded-${tripId}`, JSON.stringify([...next])) } catch {}
                }}
                aria-label={label}
                aria-pressed={allExpanded}
                style={{ ...iconBtn, position: 'relative', flexShrink: 0, overflow: 'hidden' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'opacity 0.2s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  opacity: allExpanded ? 0 : 1,
                  transform: allExpanded ? 'translateY(-8px) scale(0.6)' : 'translateY(0) scale(1)',
                }}>
                  <ChevronsUpDown size={16} strokeWidth={2} />
                </span>
                <span style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'opacity 0.2s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  opacity: allExpanded ? 1 : 0,
                  transform: allExpanded ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.6)',
                }}>
                  <ChevronsDownUp size={16} strokeWidth={2} />
                </span>
              </button>
            </Tooltip>
          )
        })()}
        {/* Only show Undo when there is something to undo — a disabled ghost
            between expand/collapse and reorder reads as a broken control. */}
        {onUndo && canUndo && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={onUndo}
              aria-label={t('undo.button')}
              onMouseEnter={() => setUndoHover(true)}
              onMouseLeave={() => setUndoHover(false)}
              style={{ ...iconBtn, color: 'var(--text-primary)' }}
            >
              <Undo2 size={16} strokeWidth={2} />
            </button>
            {undoHover && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 200,
                background: 'var(--bg-card, white)', color: 'var(--text-primary, #111827)',
                fontSize: 'calc(11px * var(--fs-scale-caption, 1))', fontWeight: 500, padding: '5px 10px',
                borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                border: '1px solid var(--border-faint, #e5e7eb)',
              }}>
                {lastActionLabel ? t('undo.tooltip', { action: lastActionLabel }) : t('undo.button')}
              </div>
            )}
          </div>
        )}
        {canEditDays && onReorderDays && onAddDay && days.length > 0 && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Tooltip label={t('dayplan.reorderDays')} placement="bottom">
              <button
                onClick={() => setReorderOpen(v => !v)}
                aria-label={t('dayplan.reorderDays')}
                aria-pressed={reorderOpen}
                style={{
                  ...iconBtn,
                  background: reorderOpen ? 'var(--bg-hover)' : 'none',
                }}
                onMouseEnter={e => { if (!reorderOpen) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (!reorderOpen) e.currentTarget.style.background = 'transparent' }}
              >
                <ArrowUpDown size={16} strokeWidth={2} />
              </button>
            </Tooltip>
            <DayReorderPopup
              isOpen={reorderOpen}
              days={days}
              t={t}
              locale={locale}
              onReorder={onReorderDays}
              onAddDay={() => onAddDay()}
              onClose={() => setReorderOpen(false)}
            />
          </div>
        )}
        {onToggleAllConnections && reservations.some(isRoutableReservation) && (() => {
          const label = t(allConnectionsShown ? 'map.hideAllConnections' : 'map.showAllConnections')
          return (
            <Tooltip label={label} placement="bottom">
              <button
                type="button"
                onClick={onToggleAllConnections}
                aria-label={label}
                aria-pressed={allConnectionsShown}
                style={{
                  ...iconBtn,
                  border: allConnectionsShown ? 'none' : '1px solid var(--border-primary)',
                  background: allConnectionsShown ? '#3b82f6' : 'none',
                  color: allConnectionsShown ? '#fff' : 'var(--text-primary)',
                }}
                onMouseEnter={e => { if (!allConnectionsShown) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (!allConnectionsShown) e.currentTarget.style.background = 'transparent' }}
              >
                <RouteIcon size={16} strokeWidth={2} />
              </button>
            </Tooltip>
          )
        })()}

        {/* Export is rightmost so its dropdown opens flush to the sidebar edge without clipping. */}
        <div
          style={{ position: 'relative', flexShrink: 0, marginLeft: 2 }}
          onMouseEnter={showExportMenu}
          onMouseLeave={hideExportMenu}
        >
          <button
            ref={exportBtnRef}
            type="button"
            aria-label={t('dayplan.export')}
            aria-expanded={exportMenuVisible}
            className="bg-accent text-accent-text"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 9, border: 'none',
              fontSize: 'calc(12px * var(--fs-scale-caption, 1))', fontWeight: 550,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <FileDown size={15} strokeWidth={2} />
            {t('dayplan.export')}
          </button>
        </div>
        {exportMenu}
        {subscribeOpen && (
          <IcsSubscribeModal
            endpoint={`/api/trips/${tripId}/feed`}
            title="Subscribe to calendar"
            description="This link stays in sync with your trip automatically. Calendar apps re-fetch it every hour."
            onClose={() => setSubscribeOpen(false)}
          />
        )}
      </div>
    </div>
  )
}
