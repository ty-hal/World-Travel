import React, { useEffect, ReactNode, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useSettingsStore } from './store/settingsStore'
import { applyAppearance } from './theme/applyAppearance'
import { useAddonStore } from './store/addonStore'
import { usePluginStore } from './store/pluginStore'
import PluginPage from './pages/PluginPage'
import LoginPage from './pages/LoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'))
const TripPlannerPage = React.lazy(() => import('./pages/TripPlannerPage'))
const AdminPage = React.lazy(() => import('./pages/AdminPage'))
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'))
const VacayPage = React.lazy(() => import('./pages/VacayPage'))
const HelpPage = React.lazy(() => import('./pages/HelpPage'))
const AtlasPage = React.lazy(() => import('./pages/AtlasPage'))
const CollectionsPage = React.lazy(() => import('./pages/CollectionsPage'))
const JourneyPage = React.lazy(() => import('./pages/JourneyPage'))
const JourneyDetailPage = React.lazy(() => import('./pages/JourneyDetailPage'))
const JourneyPublicPage = React.lazy(() => import('./pages/JourneyPublicPage'))
const TravelTimelinePage = React.lazy(() => import('./pages/TravelTimelinePage'))
const SharedTripPage = React.lazy(() => import('./pages/SharedTripPage'))
const JoinTripPage = React.lazy(() => import('./pages/JoinTripPage'))
const InAppNotificationsPage = React.lazy(() => import('./pages/InAppNotificationsPage.tsx'))
const OAuthAuthorizePage = React.lazy(() => import('./pages/OAuthAuthorizePage'))
import { ToastContainer } from './components/shared/Toast'
import SaveToCollectionModal from './components/Collections/SaveToCollectionModal'
import BackgroundTasksWidget from './components/BackgroundTasks/BackgroundTasksWidget'
import BottomNav from './components/Layout/BottomNav'
import { TranslationProvider, useTranslation } from './i18n'
import { authApi } from './api/client'
import { usePermissionsStore, PermissionLevel } from './store/permissionsStore'
import { useInAppNotificationListener } from './hooks/useInAppNotificationListener.ts'
import { registerSyncTriggers, unregisterSyncTriggers } from './sync/syncTriggers'
import OfflineBanner from './components/Layout/OfflineBanner'
import { SystemNoticeHost } from './components/SystemNotices/SystemNoticeHost.js'
// Notice action registrations (side-effect imports):
import './pages/Trips/noticeActions.js'

interface ProtectedRouteProps {
  children: ReactNode
  adminRequired?: boolean
  addonId?: string
}

function ProtectedRoute({ children, adminRequired = false, addonId }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const isLoading = useAuthStore((s) => s.isLoading)
  const appRequireMfa = useAuthStore((s) => s.appRequireMfa)
  const addonStore = useAddonStore()
  const { t } = useTranslation()
  const location = useLocation()

  // A persisted authenticated snapshot is safe to render while its httpOnly
  // session is validated; a failed validation still redirects normally.
  if (isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
          <p className="text-slate-500 text-sm">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    const redirectParam = encodeURIComponent(location.pathname + location.search + location.hash)
    return <Navigate to={`/login?redirect=${redirectParam}`} replace />
  }

  if (
    appRequireMfa &&
    user &&
    !user.mfa_enabled &&
    location.pathname !== '/settings'
  ) {
    return <Navigate to="/settings?mfa=required" replace />
  }

  if (adminRequired && user && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  if (addonId && addonStore.loaded && !addonStore.isEnabled(addonId)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="flex flex-col h-dvh md:block md:h-auto">
      <div className="app-route-scroll flex-1 overflow-y-auto md:overflow-visible">
        <React.Suspense fallback={<RouteLoading />}>{children}</React.Suspense>
      </div>
      <BottomNav />
    </div>
  )
}

function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
      </div>
    )
  }

  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
}

function DevLoginRedirect() {
  const { isAuthenticated, error } = useAuthStore()
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">{error || 'Signing in to local development account…'}</div>
}

function RouteLoading() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50" role="status">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin motion-reduce:animate-none" />
        <p className="text-slate-500 text-sm">{t('common.loading')}</p>
      </div>
    </div>
  )
}

/** Playwright runs Vite in dev mode but needs the real login form, not auto dev-login. */
const e2eMode = import.meta.env.VITE_E2E === '1' || import.meta.env.VITE_E2E === 'true'
const useDevAutoLogin = import.meta.env.DEV && import.meta.env.MODE !== 'test' && !e2eMode

export default function App() {
  const { loadUser, devLogin, isAuthenticated, demoMode, setDemoMode, setDevMode, setIsPrerelease, setAppVersion, setHasMapsKey, setServerTimezone, setAppRequireMfa, setTripRemindersEnabled, setPlacesPhotosEnabled, setPlacesAutocompleteEnabled, setPlacesDetailsEnabled } = useAuthStore()
  const { loadSettings } = useSettingsStore()
  const { loadAddons } = useAddonStore()
  const { loadPlugins } = usePluginStore()
  const [configUnavailable, setConfigUnavailable] = useState(false)

  useEffect(() => {
    if (useDevAutoLogin && !location.pathname.startsWith('/shared/') && !location.pathname.startsWith('/public/')) {
      devLogin().catch(() => loadUser())
    } else if (!location.pathname.startsWith('/shared/') && !location.pathname.startsWith('/public/') && !location.pathname.startsWith('/login')) {
      // If the persist snapshot already has an authenticated user, validate
      // silently so the PWA shell renders immediately without a spinner.
      const alreadyAuthenticated = useAuthStore.getState().isAuthenticated
      if (alreadyAuthenticated) {
        useAuthStore.setState({ isLoading: false })
        loadUser({ silent: true })
      } else {
        loadUser()
      }
    }
    let cancelled = false
    let retryTimer: number | undefined
    let configFailed = false
    const loadAppConfig = async () => {
      try {
        const config = await authApi.getAppConfig() as { demo_mode?: boolean; dev_mode?: boolean; is_prerelease?: boolean; has_maps_key?: boolean; version?: string; timezone?: string; require_mfa?: boolean; trip_reminders_enabled?: boolean; places_photos_enabled?: boolean; places_autocomplete_enabled?: boolean; places_details_enabled?: boolean; permissions?: Record<string, PermissionLevel> }
        if (cancelled) return
        setDemoMode(!!config?.demo_mode)
        if (config?.dev_mode) setDevMode(true)
        if (config?.is_prerelease !== undefined) setIsPrerelease(config.is_prerelease)
        if (config?.version) setAppVersion(config.version)
        if (config?.has_maps_key !== undefined) setHasMapsKey(config.has_maps_key)
        if (config?.timezone) setServerTimezone(config.timezone)
        if (config?.require_mfa !== undefined) setAppRequireMfa(!!config.require_mfa)
        if (config?.trip_reminders_enabled !== undefined) setTripRemindersEnabled(config.trip_reminders_enabled)
        if (config?.places_photos_enabled !== undefined) setPlacesPhotosEnabled(config.places_photos_enabled)
        if (config?.places_autocomplete_enabled !== undefined) setPlacesAutocompleteEnabled(config.places_autocomplete_enabled)
        if (config?.places_details_enabled !== undefined) setPlacesDetailsEnabled(config.places_details_enabled)
        if (config?.permissions) usePermissionsStore.getState().setPermissions(config.permissions)

        // VitePWA owns static-asset updates. Do not clear every cache or unregister
        // the worker on a version change: that discards offline map tiles and makes
        // an update indistinguishable from an offline reset.
        if (config?.version) localStorage.setItem('trek_app_version', config.version)
        setConfigUnavailable(false)
        if (configFailed) {
          const store = useAuthStore.getState()
          if (store.isAuthenticated) {
            loadSettings()
            loadAddons()
            loadPlugins()
          }
          window.dispatchEvent(new Event('trek:server-ready'))
        }
      } catch {
        if (cancelled) return
        configFailed = true
        setConfigUnavailable(true)
        retryTimer = window.setTimeout(loadAppConfig, 5000)
      }
    }
    void loadAppConfig()
    return () => {
      cancelled = true
      window.clearTimeout(retryTimer)
    }
  }, [])

  const { settings } = useSettingsStore()

  useInAppNotificationListener()

  useEffect(() => {
    if (isAuthenticated) {
      loadSettings()
      loadAddons()
      loadPlugins()
    }
  }, [isAuthenticated])

  useEffect(() => {
    registerSyncTriggers()
    return () => unregisterSyncTriggers()
  }, [])

  const location = useLocation()
  const isSharedPage = location.pathname.startsWith('/shared/')

  useEffect(() => {
    const run = () =>
      applyAppearance({
        darkMode: settings.dark_mode,
        appearance: settings.appearance,
        isSharedPage,
      })
    run()
    // Re-resolve on OS theme change while in auto mode.
    if (!isSharedPage && settings.dark_mode === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => run()
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [settings.dark_mode, settings.appearance, isSharedPage])

  const isAuthPage = location.pathname.startsWith('/login')
    || location.pathname.startsWith('/register')
    || location.pathname.startsWith('/forgot-password')
    || location.pathname.startsWith('/reset-password')

  return (
    <TranslationProvider>
      {!isAuthPage && <SystemNoticeHost />}
      <ToastContainer />
      {!isAuthPage && <BackgroundTasksWidget />}
      {!isAuthPage && <SaveToCollectionModal />}
      {configUnavailable && (
        <div role="status" className="fixed left-3 top-10 z-[10000] max-w-[calc(100vw-24px)] rounded-full bg-amber-700 px-2.5 py-0.5 text-[11px] font-semibold leading-4 text-white shadow-lg md:left-1/2 md:top-[var(--nav-h)] md:-translate-x-1/2">
          Server settings unavailable; trips still work.
        </div>
      )}
      <OfflineBanner />
      <React.Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={useDevAutoLogin ? <DevLoginRedirect /> : <LoginPage />} />
        <Route path="/public/journey/:token" element={<JourneyPublicPage />} />
        <Route path="/shared/:token" element={<SharedTripPage />} />
        <Route path="/register" element={useDevAutoLogin ? <DevLoginRedirect /> : <LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* OAuth 2.1 consent page — intentionally outside ProtectedRoute */}
        <Route path="/oauth/consent" element={<OAuthAuthorizePage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        {/* Trip invite link (#1143) — behind ProtectedRoute so an anonymous
            visitor is redirected to /login (never registration) and returns here. */}
        <Route
          path="/join/:token"
          element={
            <ProtectedRoute>
              <JoinTripPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/help"
          element={
            <ProtectedRoute>
              <HelpPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/help/:slug"
          element={
            <ProtectedRoute>
              <HelpPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/trips/:id"
          element={
            <ProtectedRoute>
              <TripPlannerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/trips/:id/:tab"
          element={
            <ProtectedRoute>
              <TripPlannerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute adminRequired>
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plugins/:pluginId"
          element={
            <ProtectedRoute>
              <PluginPage />
            </ProtectedRoute>
          }
        />
        <Route path="/vacay" element={<Navigate to="/calendar" replace />} />
        <Route path="/vacay/*" element={<Navigate to="/calendar" replace />} />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <VacayPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/atlas"
          element={
            <ProtectedRoute>
              <AtlasPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/journey"
          element={
            <ProtectedRoute addonId="journey">
              <JourneyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/journey/:id"
          element={
            <ProtectedRoute addonId="journey">
              <JourneyDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/timeline"
          element={
            <ProtectedRoute>
              <TravelTimelinePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/collections"
          element={
            <ProtectedRoute addonId="collections">
              <CollectionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/collections/:id"
          element={
            <ProtectedRoute addonId="collections">
              <CollectionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <InAppNotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </React.Suspense>
    </TranslationProvider>
  )
}
