import type { BeliStatus } from '@trek/shared';
import { Utensils } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { beliApi } from '../../api/beli';
import { useTranslation } from '../../i18n';
import { useAuthStore } from '../../store/authStore';
import Section from './Section';

export default function BeliConnectionSection() {
  const userId = useAuthStore((s) => s.user?.id);
  return <BeliConnectionForm key={userId} />;
}
function BeliConnectionForm() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<BeliStatus | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const c = new AbortController();
    controller.current = c;
    beliApi
      .status(c.signal)
      .then(setStatus)
      .catch(() => {
        if (!c.signal.aborted) setError(t('beli.failed'));
      })
      .finally(() => {
        if (!c.signal.aborted) setBusy(false);
      });
    return () => controller.current?.abort();
  }, [t]);
  async function act(action: 'connect' | 'sync' | 'disconnect') {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setError('');
    const identifier = email.trim();
    const credentials = identifier.includes('@') ? { email: identifier, password } : { phone_no: identifier, password };
    setPassword('');
    try {
      setStatus(
        await (action === 'connect'
          ? beliApi.connect(credentials, c.signal)
          : action === 'sync'
            ? beliApi.sync(c.signal)
            : beliApi.disconnect(c.signal))
      );
      if (action === 'connect') setEmail('');
    } catch (err) {
      if (!c.signal.aborted) {
        setError(err instanceof Error ? err.message : t('beli.failed'));
        await beliApi
          .status(c.signal)
          .then(setStatus)
          .catch(() => {});
      }
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  const input =
    'mt-1 min-h-11 w-full rounded-lg border border-edge bg-surface-primary px-3 py-2 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
  const button =
    'min-h-11 cursor-pointer rounded-lg border border-edge px-3 py-2 text-sm text-content transition-colors hover:bg-surface-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-50';
  return (
    <Section
      title="Beli"
      icon={Utensils}
      badge={
        <span
          role="status"
          className="ml-auto rounded-full bg-surface-secondary px-2.5 py-1 text-xs text-content-secondary"
        >
          {busy ? t('beli.working') : t(`beli.state.${status?.state ?? 'disconnected'}`)}
        </span>
      }
    >
      <p className="text-sm text-content-secondary">{t('beli.intro')}</p>
      {status?.syncedAt && (
        <p className="text-xs text-content-secondary">
          {t('beli.summary', {
            count: status.ratedCount,
            date: new Date(status.syncedAt).toLocaleDateString(),
          })}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {(!status?.connected || status.state === 'reconnect') && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void act('connect');
          }}
          className="grid gap-3 sm:grid-cols-2"
          autoComplete="off"
        >
          <label className="block text-sm text-content">
            {t('beli.email')}
            <input
              className={input}
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              name="beli-email"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={320}
              required
              disabled={busy}
            />
          </label>
          <label className="block text-sm text-content">
            {t('beli.password')}
            <input
              className={input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              name="beli-password"
              maxLength={1024}
              required
              disabled={busy}
            />
          </label>
          <div className="sm:col-span-2">
            <button
              className="min-h-11 cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-50"
              disabled={busy || !email || !password}
            >
              {busy ? t('beli.working') : t('beli.connect')}
            </button>
          </div>
        </form>
      )}
      {status && (status.connected || status.ratedCount > 0) && <div className="flex flex-wrap gap-2">
        {status?.connected && (
          <button className={button} onClick={() => void act('sync')} disabled={busy}>
            {t('beli.sync')}
          </button>
        )}
        {status && status.state !== 'disconnected' && (
          <button
            className="min-h-11 cursor-pointer px-2 text-sm text-content-secondary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-50"
            onClick={() => void act('disconnect')}
            disabled={busy}
          >
            {t('beli.disconnect')}
          </button>
        )}
      </div>}
      <details className="text-xs text-content-secondary">
        <summary className="cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
          {t('beli.privacyTitle')}
        </summary>
        <p className="mt-2 max-w-prose leading-relaxed">{t('beli.privacy')}</p>
      </details>
    </Section>
  );
}
