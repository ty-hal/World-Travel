import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { ChevronDown, ChevronRight, FileText, MoreHorizontal, Plus, TramFront } from 'lucide-react'

interface DayPlanDayActionsMenuProps {
  dayId: number
  isExpanded: boolean
  canEdit: boolean
  t: (key: string, params?: Record<string, unknown>) => string
  onPlanTransit?: (dayId: number) => void
  onAddTransport?: (dayId: number) => void
  onAddNote: (dayId: number, e: React.MouseEvent) => void
  onToggleExpand: (dayId: number, e: React.MouseEvent) => void
}

/**
 * Compact ⋯ control for day-header actions (transit / transport / note / expand).
 * Replaces the crowded 4-icon grid so the day title can use the full width.
 */
export function DayPlanDayActionsMenu({
  dayId, isExpanded, canEdit, t,
  onPlanTransit, onAddTransport, onAddNote, onToggleExpand,
}: DayPlanDayActionsMenuProps) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const place = () => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
  }

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    place()
    setOpen(true)
  }
  const hide = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])

  if (!canEdit) {
    return (
      <button
        type="button"
        onClick={e => onToggleExpand(dayId, e)}
        className="text-content-muted"
        aria-label={isExpanded ? t('common.collapse') : t('common.expand')}
        style={{ flexShrink: 0, background: 'none', border: 'none', padding: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      >
        {isExpanded ? <ChevronDown size={16} strokeWidth={1.8} /> : <ChevronRight size={16} strokeWidth={1.8} />}
      </button>
    )
  }

  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '8px 12px', border: 'none',
    background: 'transparent', cursor: 'pointer',
    fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit',
    color: 'var(--text-primary)', textAlign: 'left',
  }

  const menu = open && pos && ReactDOM.createPortal(
    <div
      role="menu"
      className="dp-day-actions-menu"
      onMouseEnter={show}
      onMouseLeave={hide}
      style={{
        position: 'fixed', top: pos.top, right: pos.right,
        zIndex: 100000, minWidth: 176,
        background: 'var(--bg-card)',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
        border: '1px solid var(--border-primary)',
        overflow: 'hidden',
      }}
    >
      {onPlanTransit && (
        <button
          type="button"
          role="menuitem"
          style={itemStyle}
          onClick={e => { e.stopPropagation(); setOpen(false); onPlanTransit(dayId) }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <TramFront size={14} strokeWidth={1.8} />
          {t('transit.title')}
        </button>
      )}
      {onAddTransport && (
        <button
          type="button"
          role="menuitem"
          style={itemStyle}
          onClick={e => { e.stopPropagation(); setOpen(false); onAddTransport(dayId) }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <Plus size={14} strokeWidth={1.8} />
          {t('transport.addTransport')}
        </button>
      )}
      <button
        type="button"
        role="menuitem"
        style={itemStyle}
        onClick={e => { e.stopPropagation(); setOpen(false); onAddNote(dayId, e) }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      >
        <FileText size={14} strokeWidth={1.8} />
        {t('dayplan.addNote')}
      </button>
      <button
        type="button"
        role="menuitem"
        style={itemStyle}
        onClick={e => { e.stopPropagation(); setOpen(false); onToggleExpand(dayId, e) }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      >
        {isExpanded ? <ChevronDown size={14} strokeWidth={1.8} /> : <ChevronRight size={14} strokeWidth={1.8} />}
        {isExpanded ? t('common.collapse') : t('common.expand')}
      </button>
    </div>,
    document.body,
  )

  return (
    <div
      className="dp-day-actions"
      style={{ position: 'relative', flexShrink: 0, alignSelf: 'flex-start' }}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <button
        ref={btnRef}
        type="button"
        aria-label={t('dayplan.dayActions')}
        aria-expanded={open}
        onClick={e => { e.stopPropagation(); open ? setOpen(false) : show() }}
        style={{
          display: 'grid', placeItems: 'center',
          width: 28, height: 28, borderRadius: 8,
          border: '1px solid var(--border-primary)',
          background: open ? 'var(--bg-hover)' : 'transparent',
          color: 'var(--text-secondary)', cursor: 'pointer', padding: 0,
        }}
      >
        <MoreHorizontal size={15} strokeWidth={2} />
      </button>
      {menu}
    </div>
  )
}
