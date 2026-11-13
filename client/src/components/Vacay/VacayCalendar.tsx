import { useCallback, useEffect, useMemo, useState } from 'react';
import { tripsApi } from '../../api/client';
import { useTranslation } from '../../i18n';
import { useVacayStore } from '../../store/vacayStore';
import type { VacayEntry } from '../../types';
import Modal from '../shared/Modal';
import { isWeekend } from './holidays';
import VacayMonthCard from './VacayMonthCard';

export default function VacayCalendar() {
  const { t, locale } = useTranslation();
  const {
    selectedYear,
    selectedUserId,
    entries,
    companyHolidays,
    toggleEntry,
    plan,
    users,
    holidays,
  } = useVacayStore();
  const [tripDates, setTripDates] = useState<Set<string>>(new Set());
  const [selectedVacationDate, setSelectedVacationDate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await tripsApi.list();
        const dates = new Set<string>();
        for (const trip of data.trips || []) {
          if (!trip.start_date || !trip.end_date) continue;
          const start = new Date(trip.start_date + 'T00:00:00');
          const end = new Date(trip.end_date + 'T00:00:00');
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const y = d.getFullYear();
            if (y === selectedYear) {
              dates.add(`${y}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
            }
          }
        }
        if (!cancelled) setTripDates(dates);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedYear]);

  const companyHolidaySet = useMemo(() => {
    const dates = new Set<string>();
    companyHolidays.forEach((h) => dates.add(h.date));
    return dates;
  }, [companyHolidays]);
  const companyHolidayLabels = useMemo(
    () => new Map(companyHolidays.map((h) => [h.date, h.note || 'Company holiday'])),
    [companyHolidays]
  );

  const entryMap = useMemo<Record<string, VacayEntry[]>>(() => {
    const map: Record<string, VacayEntry[]> = {};
    entries.forEach((e) => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [entries]);

  const blockWeekends = plan?.block_weekends !== false;
  const weekendDays: number[] = plan?.weekend_days ? String(plan.weekend_days).split(',').map(Number) : [0, 6];
  const companyHolidaysEnabled = plan?.company_holidays_enabled !== false;

  const handleCellClick = useCallback(
    async (dateStr: string) => {
      if (entryMap[dateStr]?.length) {
        setSelectedVacationDate(dateStr);
        return;
      }
      if (blockWeekends && isWeekend(dateStr, weekendDays)) return;
      if (companyHolidaysEnabled && companyHolidaySet.has(dateStr)) return;
      await toggleEntry(dateStr, selectedUserId || undefined);
    },
    [
      toggleEntry,
      companyHolidaySet,
      entryMap,
      blockWeekends,
      companyHolidaysEnabled,
      selectedUserId,
    ]
  );

  const selectedVacationEntries = selectedVacationDate ? entryMap[selectedVacationDate] || [] : [];
  const selectedUserHasVacation = selectedVacationEntries.some((entry) => entry.user_id === selectedUserId);
  const selectedVacationDateLabel = selectedVacationDate
    ? new Date(`${selectedVacationDate}T12:00:00`).toLocaleDateString(locale, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <div>
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        style={{ paddingBottom: 'calc(var(--bottom-nav-h, 0px) + 80px)' }}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <VacayMonthCard
            key={i}
            year={selectedYear}
            month={i}
            holidays={holidays}
            companyHolidaySet={companyHolidaySet}
            companyHolidayLabels={companyHolidayLabels}
            companyHolidaysEnabled={companyHolidaysEnabled}
            entryMap={entryMap}
            onCellClick={handleCellClick}
            blockWeekends={blockWeekends}
            weekendDays={weekendDays}
            tripDates={tripDates}
            weekStart={plan?.week_start ?? 1}
          />
        ))}
      </div>

      <Modal
        isOpen={selectedVacationDate !== null}
        onClose={() => setSelectedVacationDate(null)}
        title={selectedVacationDateLabel}
        size="sm"
        footer={
          <button
            type="button"
            onClick={async () => {
              if (!selectedVacationDate) return;
              await toggleEntry(selectedVacationDate, selectedUserId || undefined);
              setSelectedVacationDate(null);
            }}
            className="w-full rounded-lg bg-content px-4 py-2.5 text-sm font-semibold text-surface-card"
          >
            {t(selectedUserHasVacation ? 'vacay.remove' : 'vacay.add')} {t('vacay.modeVacation')}
          </button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-content-secondary">{t('vacay.plannedDays')}</p>
          <div className="space-y-2">
            {selectedVacationEntries.map((entry) => (
              <div
                key={entry.user_id}
                className="flex items-center gap-2 rounded-lg border border-edge-secondary px-3 py-2.5"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: entry.person_color || '#6366f1' }}
                />
                <span className="text-sm font-medium text-content">
                  {entry.person_name || users.find((user) => user.id === entry.user_id)?.username || t('vacay.persons')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Modal>

    </div>
  );
}
