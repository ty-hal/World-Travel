import type { ReactElement } from 'react'
import { useTranslation } from '../../i18n'

export type MapScope = 'all' | 'day' | 'unscheduled'

interface MapScopeControlProps {
  value: MapScope
  onChange: (next: MapScope) => void
  daySelected: boolean
}

/**
 * Map chrome: scope which pins are shown (All / This day / Unscheduled).
 * Opaque card shell so it stays readable over blue water / satellite tiles.
 */
export function MapScopeControl({ value, onChange, daySelected }: MapScopeControlProps): ReactElement {
  const { t } = useTranslation()
  const options: { id: MapScope; label: string; disabled?: boolean; title?: string }[] = [
    { id: 'all', label: t('planner.mapScope.all'), title: t('planner.mapScope.allHint') },
    { id: 'day', label: t('planner.mapScope.day'), disabled: !daySelected, title: daySelected ? t('planner.mapScope.dayHint') : t('planner.mapScope.dayDisabled') },
    { id: 'unscheduled', label: t('planner.mapScope.unscheduled'), title: t('planner.mapScope.unscheduledHint') },
  ]

  return (
    <div
      role="group"
      aria-label={t('planner.mapScope.label')}
      className="map-scope-control"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        height: 44,
        boxSizing: 'border-box',
        padding: 4,
        borderRadius: 14,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
        boxShadow: 'var(--sidebar-shadow, 0 4px 16px rgba(0,0,0,0.18))',
        pointerEvents: 'auto',
      }}
    >
      {options.map(opt => (
        <button
          key={opt.id}
          type="button"
          disabled={opt.disabled}
          aria-pressed={value === opt.id}
          title={opt.title}
          onClick={() => onChange(opt.id)}
          style={{
            height: 36,
            padding: '0 12px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: value === opt.id ? 600 : 500,
            lineHeight: 1,
            color: value === opt.id ? 'var(--accent-text)' : 'var(--text-secondary)',
            background: value === opt.id ? 'var(--accent)' : 'transparent',
            opacity: opt.disabled ? 0.45 : 1,
            cursor: opt.disabled ? 'not-allowed' : 'pointer',
            border: 'none',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
