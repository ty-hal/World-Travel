import type { Assignment, Day, DayNote, Reservation, Trip } from '../../types';

type DailyBriefProps = {
  trip: Trip;
  day: Day;
  assignments: Assignment[];
  notes: DayNote[];
  reservations: Reservation[];
  includeConfirmations: boolean;
};

const escape = (value: string | null | undefined) =>
  (value || '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!
  );

export function printDailyBrief({
  trip,
  day,
  assignments,
  notes,
  reservations,
  includeConfirmations,
}: DailyBriefProps): void {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Allow pop-ups to print this day brief');
  popup.opener = null;
  const schedule = [...assignments]
    .sort((a, b) => a.order_index - b.order_index)
    .map((assignment) => {
      const place = assignment.place;
      const time = assignment.assignment_time ?? place.place_time ?? '';
      const mapUrl =
        place.lat != null && place.lng != null
          ? `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
          : null;
      return {
        time,
        order: assignment.order_index,
        html: `<li><strong>${escape(time)} ${escape(place.name)}</strong>${place.address ? `<br><span>${escape(place.address)}</span>` : ''}${place.phone ? `<br><span>${escape(place.phone)}</span>` : ''}${mapUrl ? `<br><a href="${mapUrl}">Open map</a>` : ''}</li>`,
      };
    });
  const dayReservations = reservations
    .filter((reservation) => reservation.day_id === day.id || reservation.end_day_id === day.id)
    .map((reservation) => {
      const time = reservation.reservation_time || '';
      return {
        time,
        order: Number.MAX_SAFE_INTEGER,
        html: `<li><strong>${escape(time)} ${escape(reservation.title)}</strong>${reservation.location ? `<br><span>${escape(reservation.location)}</span>` : ''}${includeConfirmations && reservation.confirmation_number ? `<br><span>Confirmation: ${escape(reservation.confirmation_number)}</span>` : ''}</li>`,
      };
    });
  const timeValue = (value: string) => {
    const match = value.match(/(?:T|^)(\d{1,2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : Number.MAX_SAFE_INTEGER;
  };
  const stops = [...schedule, ...dayReservations]
    .sort((a, b) => timeValue(a.time) - timeValue(b.time) || a.order - b.order)
    .map((item) => item.html)
    .join('');
  const dayNotes = notes.map((note) => `<li>${escape(note.time || '')} ${escape(note.text)}</li>`).join('');

  popup.document.write(
    `<!doctype html><html><head><title>${escape(trip.title)} · Day ${day.day_number}</title><style>body{font:14px system-ui,sans-serif;color:#111;margin:28px;line-height:1.45}h1{margin:0}h2{margin:24px 0 8px;font-size:16px}ul{padding-left:20px;margin:0}li{margin:0 0 12px}span{color:#555}a{color:#075985}@media print{body{margin:12mm}}</style></head><body><h1>${escape(trip.title)}</h1><p>Day ${day.day_number}${day.title ? ` · ${escape(day.title)}` : ''} · ${escape(day.date)}</p><h2>Schedule</h2><ul>${stops || '<li>No scheduled stops</li>'}</ul>${dayNotes ? `<h2>Notes</h2><ul>${dayNotes}</ul>` : ''}</body></html>`
  );
  popup.document.close();
  popup.focus();
  popup.print();
}
