import React from 'react'
import { CheckCheck, Trash2 } from 'lucide-react'
import AnimatedBellIcon from '../components/shared/AnimatedBellIcon'
import { useTranslation } from '../i18n'
import PageShell from '../components/Layout/PageShell'
import { Spinner } from '../components/shared/Spinner'
import InAppNotificationItem from '../components/Notifications/InAppNotificationItem.tsx'
import { useInAppNotifications } from './inAppNotifications/useInAppNotifications'

export default function InAppNotificationsPage(): React.ReactElement {
  const { t } = useTranslation()
  // Page = wiring container: store, filter, fetch + infinite scroll live in the hook.
  const {
    notifications, unreadCount, total, isLoading, loadError, hasMore, fetchNotifications,
    unreadOnly, setUnreadOnly, loaderRef, displayed,
    markAllRead, deleteAll,
  } = useInAppNotifications()

  return (
    <PageShell background="var(--bg-primary)">
      <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-content">
                {t('notifications.title')}
                {unreadCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium align-middle inline-flex items-center justify-center bg-content text-surface">
                    {unreadCount}
                  </span>
                )}
              </h1>
              <p className="text-sm mt-0.5 text-content-muted">
                {loadError && notifications.length === 0
                  ? t('notifications.countUnavailable')
                  : `${total} ${total === 1 ? 'notification' : 'notifications'}`}
              </p>
            </div>

            {/* Bulk actions */}
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  aria-label={t('notifications.markAllRead')}
                  onClick={markAllRead}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors text-content-secondary bg-surface-hover"
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                >
                  <CheckCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('notifications.markAllRead')}</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  aria-label={t('notifications.deleteAll')}
                  onClick={deleteAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors text-red-500 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('notifications.deleteAll')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter toggle */}
          <div className="flex gap-2 mb-4">
            <button
              aria-pressed={!unreadOnly}
              onClick={() => setUnreadOnly(false)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!unreadOnly ? 'bg-content text-surface' : 'bg-surface-hover text-content-secondary'}`}
            >
              {t('notifications.all')}
            </button>
            <button
              aria-pressed={unreadOnly}
              onClick={() => setUnreadOnly(true)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${unreadOnly ? 'bg-content text-surface' : 'bg-surface-hover text-content-secondary'}`}
            >
              {t('notifications.unreadOnly')}
            </button>
          </div>

          {/* Notification list */}
          <div className="rounded-xl border overflow-hidden border-edge bg-surface-card">
            {isLoading && displayed.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <Spinner className="w-6 h-6 border-2 border-slate-200 border-t-current" />
              </div>
            ) : displayed.length === 0 ? (
              loadError ? null : <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
                <AnimatedBellIcon size={48} animate="always" className="w-12 h-12 text-content-faint" />
                <p className="text-base font-medium text-content-muted">{t('notifications.empty')}</p>
                <p className="text-sm text-content-faint">{t('notifications.emptyDescription')}</p>
              </div>
            ) : (
              displayed.map(n => (
                <InAppNotificationItem key={n.id} notification={n} />
              ))
            )}

            {loadError && (
              <div role="alert" className="flex flex-col items-center gap-3 border-t border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-800 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">
                <p>{t('notifications.loadError')}</p>
                <button type="button" onClick={() => fetchNotifications(true)} className="rounded-lg px-3 py-2 font-semibold underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current">
                  {t('notifications.retry')}
                </button>
              </div>
            )}

            {/* Infinite scroll trigger */}
            {hasMore && (
              <div ref={loaderRef} className="flex items-center justify-center py-4">
                {isLoading && <Spinner className="w-5 h-5 border-2 border-slate-200 border-t-current" />}
              </div>
            )}
          </div>
        </div>
    </PageShell>
  )
}
