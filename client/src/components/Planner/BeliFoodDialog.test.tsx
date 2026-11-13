import userEvent from '@testing-library/user-event';
import { buildPlace, buildUser } from '../../../tests/helpers/factories';
import { render, screen, waitFor } from '../../../tests/helpers/render';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { beliApi } from '../../api/beli';
import { useAuthStore } from '../../store/authStore';
import { useTripStore } from '../../store/tripStore';
import BeliFoodDialog from './BeliFoodDialog';

vi.mock('../../api/beli', () => ({ beliApi: { recommendations: vi.fn() } }));
const row = {
  id: 50,
  name: 'Synthetic bakery',
  lat: 41.9,
  lng: -87.6,
  placeId: 'fake-place',
  cuisines: ['Bakery'],
  price: 2,
  distanceKm: 0.7,
  prediction: null,
  evidence: 'history' as const,
  reasons: ['Private taste evidence'],
  historyMatches: 4,
  statusVerified: true,
};
beforeEach(() => {
  resetAllStores();
  vi.resetAllMocks();
  seedStore(useAuthStore, { user: buildUser(), isAuthenticated: true });
  vi.mocked(beliApi.recommendations).mockResolvedValue({
    origin: { name: 'Origin', lat: 41.89, lng: -87.63 },
    syncedAt: '2026-01-01T00:00:00Z',
    discoveredAt: '2026-01-01T00:00:00Z',
    stale: true,
    total: 1,
    scored: 0,
    suggestions: [row],
  });
});
it('shows unscored history suggestions and saves only public place fields', async () => {
  const user = userEvent.setup();
  const addPlace = vi.fn().mockResolvedValue(buildPlace());
  seedStore(useTripStore, { addPlace });
  render(
    <BeliFoodDialog
      tripId={1}
      places={[buildPlace({ id: 2, lat: 41.89, lng: -87.63 })]}
      selectedPlaceId={2}
      canSave
      onClose={vi.fn()}
    />
  );
  await user.click(screen.getByRole('button', { name: 'Find food' }));
  await screen.findByText('Prediction unknown', { exact: false });
  expect(screen.getByText(/snapshot is over a day old/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Save place to shared trip' }));
  await waitFor(() =>
    expect(addPlace).toHaveBeenCalledWith(1, {
      name: row.name,
      lat: row.lat,
      lng: row.lng,
      google_place_id: row.placeId,
    })
  );
  expect(JSON.stringify(addPlace.mock.calls)).not.toContain('Private taste evidence');
  expect(JSON.stringify(addPlace.mock.calls)).not.toContain('prediction');
  expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled();
});
it('does not search without a geocoded origin or offer writes to read-only members', async () => {
  const user = userEvent.setup();
  const { unmount } = render(
    <BeliFoodDialog tripId={1} places={[]} selectedPlaceId={null} canSave={false} onClose={vi.fn()} />
  );
  expect(screen.getByRole('button', { name: 'Find food' })).toBeDisabled();
  expect(beliApi.recommendations).not.toHaveBeenCalled();
  unmount();
  render(
    <BeliFoodDialog
      tripId={1}
      places={[buildPlace({ id: 2, lat: 41.89, lng: -87.63 })]}
      selectedPlaceId={2}
      canSave={false}
      onClose={vi.fn()}
    />
  );
  await user.click(screen.getByRole('button', { name: 'Find food' }));
  await screen.findByText('Synthetic bakery');
  expect(screen.queryByRole('button', { name: 'Save place to shared trip' })).not.toBeInTheDocument();
});
