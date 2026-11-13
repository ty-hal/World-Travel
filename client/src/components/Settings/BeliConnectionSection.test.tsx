import userEvent from '@testing-library/user-event';
import { buildUser } from '../../../tests/helpers/factories';
import { render, screen, waitFor } from '../../../tests/helpers/render';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { beliApi } from '../../api/beli';
import { useAuthStore } from '../../store/authStore';
import BeliConnectionSection from './BeliConnectionSection';

vi.mock('../../api/beli', () => ({
  beliApi: { status: vi.fn(), connect: vi.fn(), sync: vi.fn(), disconnect: vi.fn() },
}));
const disconnected = {
  connected: false,
  state: 'disconnected' as const,
  syncedAt: null,
  ratedCount: 0,
  predictionCount: 0,
};
beforeEach(() => {
  resetAllStores();
  vi.resetAllMocks();
  seedStore(useAuthStore, { user: buildUser(), isAuthenticated: true });
  vi.mocked(beliApi.status).mockResolvedValue(disconnected);
});
it('sends phone identifiers using the same field as the original helper', async () => {
  const user = userEvent.setup();
  vi.mocked(beliApi.connect).mockResolvedValue(disconnected);
  render(<BeliConnectionSection />);
  await screen.findByText('Not connected');
  await user.type(screen.getByLabelText('Beli email or phone'), '+15555550100');
  await user.type(screen.getByLabelText('Beli password'), 'synthetic');
  await user.click(screen.getByRole('button', { name: 'Connect Beli' }));
  await waitFor(() => expect(beliApi.connect).toHaveBeenCalledWith({ phone_no: '+15555550100', password: 'synthetic' }, expect.any(AbortSignal)));
});
it('clears the password before the request completes and retains email for a retry', async () => {
  const user = userEvent.setup();
  let complete!: (status: typeof disconnected) => void;
  vi.mocked(beliApi.connect).mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      })
  );
  render(<BeliConnectionSection />);
  await screen.findByText('Not connected');
  await user.type(screen.getByLabelText('Beli email or phone'), 'fake@example.test');
  await user.type(screen.getByLabelText('Beli password'), 'synthetic-password');
  await user.click(screen.getByRole('button', { name: 'Connect Beli' }));
  expect(screen.getByLabelText('Beli password')).toHaveValue('');
  expect(screen.getByLabelText('Beli email or phone')).toHaveValue('fake@example.test');
  expect(beliApi.connect).toHaveBeenCalledWith(
    { email: 'fake@example.test', password: 'synthetic-password' },
    expect.any(AbortSignal)
  );
  complete(disconnected);
  await waitFor(() => expect(screen.getByLabelText('Beli email or phone')).not.toBeDisabled());
  expect(document.body).not.toHaveTextContent('synthetic-password');
});
it('erases the connection through the dedicated private API', async () => {
  const user = userEvent.setup();
  vi.mocked(beliApi.status).mockResolvedValue({
    ...disconnected,
    connected: true,
    state: 'connected',
    syncedAt: '2026-01-01T00:00:00Z',
  });
  vi.mocked(beliApi.disconnect).mockResolvedValue(disconnected);
  render(<BeliConnectionSection />);
  await user.click(await screen.findByRole('button', { name: 'Disconnect' }));
  await screen.findByText('Not connected');
  expect(beliApi.disconnect).toHaveBeenCalled();
});
