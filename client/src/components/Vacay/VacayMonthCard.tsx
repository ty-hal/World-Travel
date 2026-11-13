import { useMemo } from 'react'
import { useTranslation } from '../../i18n'
import { isWeekend } from './holidays'
import type { HolidaysMap, VacayEntry } from '../../types'

const WEEKDAY_KEYS = ['vacay.mon', 'vacay.tue', 'vacay.wed', 'vacay.thu', 'vacay.fri', 'vacay.sat', 'vacay.sun'] as const

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

interface VacayMonthCardProps {
  year: number
  month: number
  holidays: HolidaysMap
  companyHolidaySet: Set<string>
  companyHolidayLabels?: Map<string, string>
  companyHolidaysEnabled?: boolean
  entryMap: Record<string, VacayEntry[]>
  onCellClick: (date: string) => void
  blockWeekends: boolean
  weekendDays?: number[]
  tripDates?: Set<string>
  weekStart?: number
}

export default function VacayMonthCard({
  year, month, holidays, companyHolidaySet, companyHolidayLabels, companyHolidaysEnabled = true, entryMap,
  onCellClick, blockWeekends, weekendDays = [0, 6], tripDates, weekStart = 1
}: VacayMonthCardProps) {
  const { t, locale } = useTranslation()

  const WEEKDAY_KEYS_SUNDAY = ['vacay.sun', 'vacay.mon', 'vacay.tue', 'vacay.wed', 'vacay.thu', 'vacay.fri', 'vacay.sat'] as const
  const orderedKeys = weekStart === 0 ? WEEKDAY_KEYS_SUNDAY : WEEKDAY_KEYS
  const weekdays = orderedKeys.map(k => t(k))
  const monthName = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(year, month, 1)), [locale, year, month])

  const weeks = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    let startDow = firstDay.getDay() - weekStart
    if (startDow < 0) startDow += 7
    const cells = []
    for (let i = 0; i < startDow; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    const w = []
    for (let i = 0; i < cells.length; i += 7) w.push(cells.slice(i, i + 7))
    return w
  }, [year, month, weekStart])

  const pad = (n) => String(n).padStart(2, '0')

  const todayStr = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  return (
    <div className="rounded-xl border overflow-hidden bg-surface-card border-edge">
      <div className="px-3 py-2 border-b border-edge-secondary">
        <span className="text-xs font-semibold capitalize text-content">{monthName}</span>
      </div>

      <div className="grid grid-cols-7 border-b border-edge-secondary">
        {weekdays.map((wd, i) => {
          // Map column index back to JS day (0=Sun..6=Sat) to check if it's a weekend column
          const jsDay = (i + weekStart) % 7
          const isWeekendCol = weekendDays.includes(jsDay)
          return (
            <div key={`${wd}-${i}`} className={`text-center text-[10px] font-medium py-1 ${isWeekendCol ? 'text-content-faint' : 'text-content-muted'}`}>
              {wd}
            </div>
          )
        })}
      </div>

      <div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((day, di) => {
              if (day === null) return <div key={di} style={{ height: 28 }} />

              const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`
              const dayOfWeek = new Date(year, month, day).getDay()
              const weekend = weekendDays.includes(dayOfWeek)
              const holiday = holidays[dateStr]
              const isCompany = companyHolidaysEnabled && companyHolidaySet.has(dateStr)
              const dayEntries = entryMap[dateStr] || []
              const isBlocked = dayEntries.length === 0 && ((weekend && blockWeekends) || isCompany)
              const isToday = dateStr === todayStr
              const dateLabel = new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(new Date(year, month, day))
              const statusLabel = dayEntries.length > 0
                ? t('vacay.plannedDays')
                : isCompany
                  ? companyHolidayLabels?.get(dateStr) || t('vacay.companyHoliday')
                  : holiday?.localName

              return (
                <button
                  type="button"
                  key={di}
                  data-date={dateStr}
                  data-planned-vacation={dayEntries.length > 0 ? 'true' : 'false'}
                  aria-label={statusLabel ? `${dateLabel}, ${statusLabel}` : dateLabel}
                  aria-disabled={isBlocked}
                  tabIndex={day === 1 ? 0 : -1}
                  title={isCompany ? companyHolidayLabels?.get(dateStr) || 'Company holiday' : holiday ? (holiday.label ? `${holiday.label}: ${holiday.localName}` : holiday.localName) : undefined}
                  className="relative flex h-11 items-center justify-center border-0 p-0 text-inherit transition-colors focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500 md:h-7"
                  style={{
                    background: weekend ? 'var(--bg-secondary)' : 'transparent',
                    borderTop: '1px solid var(--border-secondary)',
                    borderRight: '1px solid var(--border-secondary)',
                    cursor: isBlocked ? 'default' : 'pointer',
                  }}
                  onClick={() => { if (!isBlocked) onCellClick(dateStr) }}
                  onKeyDown={e => {
                    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
                    const offset = offsets[e.key]
                    if (offset === undefined) return
                    e.preventDefault()
                    const nextDate = new Date(year, month, day + offset)
                    const key = `${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}-${pad(nextDate.getDate())}`
                    document.querySelector<HTMLButtonElement>(`[data-date="${key}"]`)?.focus()
                  }}
                  onMouseEnter={e => { if (!isBlocked) e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = weekend ? 'var(--bg-secondary)' : 'transparent' }}
                >
                  {holiday && <span className="absolute inset-0.5 rounded" style={{ background: hexToRgba(holiday.color, 0.12) }} />}
                  {isCompany && <span className="absolute inset-0.5 rounded" style={{ background: 'rgba(245,158,11,0.28)', boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.85)' }} />}
                  {isCompany && <span className="absolute bottom-[3px] right-[3px] z-[2] h-[5px] w-[5px] rounded-full bg-amber-500" />}

                  {dayEntries.length === 1 && (
                    <span className="absolute inset-0.5 rounded" style={{ backgroundColor: dayEntries[0].person_color, opacity: 0.4 }} />
                  )}
                  {dayEntries.length === 2 && (
                    <span className="absolute inset-0.5 rounded" style={{
                      background: `linear-gradient(135deg, ${dayEntries[0].person_color} 50%, ${dayEntries[1].person_color} 50%)`,
                      opacity: 0.4,
                    }} />
                  )}
                  {dayEntries.length === 3 && (
                    <span className="absolute inset-0.5 rounded overflow-hidden" style={{ opacity: 0.4 }}>
                      <span className="absolute top-0 left-0 w-1/2 h-full" style={{ backgroundColor: dayEntries[0].person_color }} />
                      <span className="absolute top-0 right-0 w-1/2 h-1/2" style={{ backgroundColor: dayEntries[1].person_color }} />
                      <span className="absolute bottom-0 right-0 w-1/2 h-1/2" style={{ backgroundColor: dayEntries[2].person_color }} />
                    </span>
                  )}
                  {dayEntries.length >= 4 && (
                    <span className="absolute inset-0.5 rounded overflow-hidden" style={{ opacity: 0.4 }}>
                      <span className="absolute top-0 left-0 w-1/2 h-1/2" style={{ backgroundColor: dayEntries[0].person_color }} />
                      <span className="absolute top-0 right-0 w-1/2 h-1/2" style={{ backgroundColor: dayEntries[1].person_color }} />
                      <span className="absolute bottom-0 left-0 w-1/2 h-1/2" style={{ backgroundColor: dayEntries[2].person_color }} />
                      <span className="absolute bottom-0 right-0 w-1/2 h-1/2" style={{ backgroundColor: dayEntries[3].person_color }} />
                    </span>
                  )}

                  {tripDates?.has(dateStr) && (
                    <span className="absolute top-[3px] right-[3px] w-[5px] h-[5px] rounded-full z-[2] bg-[#3b82f6]" />
                  )}

                  <span className="relative z-[1] text-[11px]" style={{
                    fontWeight: dayEntries.length > 0 || isCompany ? 700 : 500,
                    color: isToday
                      ? '#fff'
                      : dayEntries.length > 0
                        ? 'var(--text-primary)'
                        : isCompany ? 'var(--text-primary)'
                        : holiday ? holiday.color
                        : weekend ? 'var(--text-faint)'
                        : 'var(--text-primary)',
                    ...(isToday ? {
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#3b82f6',
                    } : {}),
                  }}>
                    {day}
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
