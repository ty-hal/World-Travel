import type { BeliCategory, BeliRecommendations, BeliSuggestion } from '@trek/shared';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { beliApi } from '../../api/beli';
import { useTranslation } from '../../i18n';
import { useAuthStore } from '../../store/authStore';
import { useTripStore } from '../../store/tripStore';
import type { Place } from '../../types';
import Modal from '../shared/Modal';

interface Props {
  tripId: number;
  places: Place[];
  selectedPlaceId: number | null;
  canSave: boolean;
  onClose: () => void;
}
export default function BeliFoodDialog(props: Props) {
  const userId = useAuthStore((s) => s.user?.id);
  return <FoodDialog key={`${userId}:${props.tripId}`} {...props} />;
}
function FoodDialog({ tripId, places, selectedPlaceId, canSave, onClose }: Props) {
  const { t } = useTranslation();
  const origins = places.filter(
    (p) => typeof p.lat === 'number' && Number.isFinite(p.lat) && typeof p.lng === 'number' && Number.isFinite(p.lng)
  );
  const [placeId, setPlaceId] = useState(
    origins.some((p) => p.id === selectedPlaceId) ? selectedPlaceId! : (origins[0]?.id ?? 0)
  );
  const [category, setCategory] = useState<BeliCategory>('RES');
  const [radiusKm, setRadiusKm] = useState(2);
  const [data, setData] = useState<BeliRecommendations | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(new Set<number>());
  const [saving, setSaving] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function search() {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setError('');
    setData(null);
    try {
      setData(await beliApi.recommendations({ tripId, placeId, category, radiusKm }, c.signal));
    } catch (err) {
      if (!c.signal.aborted) setError(err instanceof Error ? err.message : t('beli.failed'));
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  async function save(row: BeliSuggestion) {
    setSaving(row.id);
    setError('');
    try {
      // Only explicit public place fields enter the shared trip/offline place repository.
      await useTripStore
        .getState()
        .addPlace(tripId, { name: row.name.slice(0, 200), lat: row.lat, lng: row.lng, google_place_id: row.placeId });
      setSaved((previous) => new Set(previous).add(row.id));
    } catch {
      setError(t('beli.saveFailed'));
    } finally {
      setSaving(null);
    }
  }
  const input = 'rounded-lg border border-edge bg-surface-primary px-2 py-2 text-sm text-content';
  const button = 'rounded-lg border border-edge px-3 py-2 text-sm text-content disabled:opacity-50';
  return (
    <Modal isOpen onClose={onClose} title={t('beli.food')} size="xl">
      <p className="mb-3 text-xs text-content-secondary">{t('beli.distanceHint')}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
        className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
      >
        <label className="col-span-2 flex min-w-0 flex-col text-sm text-content sm:col-span-1">
          {t('beli.origin')}
          <select
            className={`${input} w-full min-w-0`}
            value={placeId}
            onChange={(e) => {
              setPlaceId(Number(e.target.value));
              setData(null);
            }}
            disabled={busy}
          >
            {origins.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm text-content">
          {t('beli.category')}
          <select
            className={input}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as BeliCategory);
              setData(null);
            }}
            disabled={busy}
          >
            {(['RES', 'BAK', 'DES'] as const).map((c) => (
              <option key={c} value={c}>
                {t(`beli.category.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm text-content">
          {t('beli.radius')}
          <select
            className={input}
            value={radiusKm}
            onChange={(e) => {
              setRadiusKm(Number(e.target.value));
              setData(null);
            }}
            disabled={busy}
          >
            {[0.5, 1, 2, 5].map((n) => (
              <option key={n} value={n}>
                {n} km
              </option>
            ))}
          </select>
        </label>
        <button className={`${button} col-span-2 sm:col-span-1`} disabled={busy || !placeId}>
          {busy ? t('beli.working') : t('beli.search')}
        </button>
      </form>
      {!origins.length && (
        <p role="status" className="mt-3 text-sm text-content-secondary">
          {t('beli.noOrigin')}
        </p>
      )}
      {error && (
        <div className="mt-3">
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
          <Link to="/settings?tab=integrations" className="text-sm underline">
            {t('beli.manage')}
          </Link>
        </div>
      )}
      {data && (
        <div className="mt-4">
          <p role="status" className="text-xs text-content-secondary">
            {t('beli.results', {
              total: data.total,
              scored: data.scored,
              date: new Date(data.syncedAt).toLocaleString(),
            })}
          </p>
          {data.stale && <p className="mt-2 text-sm text-amber-700">{t('beli.stale')}</p>}
          {!data.suggestions.length && <p className="mt-3 text-sm text-content-secondary">{t('beli.empty')}</p>}
          <ul className="mt-2 divide-y divide-edge">
            {data.suggestions.map((row) => (
              <li key={row.id} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <a
                    className="font-medium text-content underline"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${row.name} ${row.lat},${row.lng}`)}${row.placeId ? `&query_place_id=${encodeURIComponent(row.placeId)}` : ''}`}
                  >
                    {row.name}
                  </a>
                  <span className="shrink-0 text-xs text-content-secondary">{row.distanceKm.toFixed(2)} km</span>
                </div>
                <p className="text-xs text-content-secondary">
                  {row.cuisines.join(', ')}
                  {row.price ? ` · ${'$'.repeat(row.price)}` : ''}
                </p>
                <p className="mt-1 text-xs text-content-secondary">
                  {t(`beli.evidence.${row.evidence}`)} ·{' '}
                  {row.prediction === null
                    ? t('beli.noPrediction')
                    : t('beli.rawPrediction', { value: row.prediction.toFixed(2) })}
                </p>
                <p className="mt-1 text-xs text-content-secondary">{row.reasons.join(' · ')}</p>
                {!row.statusVerified && <p className="text-xs text-amber-700">{t('beli.unverified')}</p>}
                {canSave && (
                  <button
                    className={`${button} mt-2`}
                    onClick={() => void save(row)}
                    disabled={
                      saving !== null ||
                      saved.has(row.id) ||
                      places.some((p) =>
                        row.placeId
                          ? p.google_place_id === row.placeId
                          : p.name === row.name && p.lat === row.lat && p.lng === row.lng
                      )
                    }
                  >
                    {saved.has(row.id) ? t('beli.saved') : t('beli.save')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
