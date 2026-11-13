import { useNavigate, useLocation, useMatch } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAddonStore } from '../../store/addonStore'
import { usePluginStore } from '../../store/pluginStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useTranslation } from '../../i18n'
import { LayoutGrid, MoreHorizontal, Plus } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { resolvePluginIcon } from '../shared/PluginIcon'
import AnimatedCalendarDaysIcon from '../shared/AnimatedCalendarDaysIcon'
import AnimatedGlobeIcon from '../shared/AnimatedGlobeIcon'
import AnimatedBookmarkIcon from '../shared/AnimatedBookmarkIcon'
import AnimatedCompassIcon from '../shared/AnimatedCompassIcon'
import { addonPath } from '../../utils/addonPaths'

type NavIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }>

const ADDON_NAV: Record<string, { icon: NavIcon; labelKey: string }> = {
  vacay:       { icon: AnimatedCalendarDaysIcon, labelKey: 'admin.addons.catalog.vacay.name' },
  atlas:       { icon: AnimatedGlobeIcon,        labelKey: 'admin.addons.catalog.atlas.name' },
  journey:     { icon: AnimatedCompassIcon,    labelKey: 'admin.addons.catalog.journey.name' },
  collections: { icon: AnimatedBookmarkIcon,     labelKey: 'admin.addons.catalog.collections.name' },
}

interface NavItem { to: string; label: string; icon: NavIcon }

// The centre "+" means something different per context: inside a trip it adds a
// place; everywhere else it creates a new trip. Pages pick the intent up from
// the ?create= query param.
function useCreateAction(): { label: string; run: () => void } {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const inTrip = useMatch('/trips/:id')

  if (inTrip) {
    // The "+" is context-aware per active tab: Bookings → reservation,
    // Transports → transport, Costs → expense. Tabs without a create modal
    // (lists / files / collab) fall through to adding a place. #1349
    const id = inTrip.params.id
    const tripTab = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(`trip-tab-${id}`) : null
    if (tripTab === 'finanzplan') return { label: t('costs.addExpense'), run: () => navigate(`/trips/${id}?create=expense`) }
    if (tripTab === 'buchungen') return { label: t('reservations.addManual'), run: () => navigate(`/trips/${id}?create=reservation`) }
    if (tripTab === 'transports') return { label: t('transport.addManual'), run: () => navigate(`/trips/${id}?create=transport`) }
    return { label: t('places.addPlace'), run: () => navigate(`/trips/${id}?create=place`) }
  }
  return { label: t('dashboard.newTrip'), run: () => navigate('/dashboard?create=1') }
}

export default function BottomNav() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const darkMode = useSettingsStore(s => s.settings.dark_mode)
  const dark = darkMode === true || darkMode === 'dark' || (darkMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const addons = useAddonStore(s => s.addons)
  const globalAddons = addons.filter(a => a.type === 'global' && a.enabled)
  // Page plugins are reachable from the mobile tab bar too, mirroring the desktop
  // nav pill (Navbar) — otherwise they were only reachable by typing /plugins/:id.
  const pagePlugins = usePluginStore(s => s.plugins).filter(p => p.type === 'page')
  const location = useLocation()
  const create = useCreateAction()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const moreButtonRef = useRef<HTMLButtonElement>(null)

  const items: NavItem[] = [
    { to: '/dashboard', label: t('nav.myTrips'), icon: LayoutGrid },
    ...globalAddons.flatMap(addon => {
      const nav = ADDON_NAV[addon.id]
      return nav ? [{ to: addonPath(addon.id), label: t(nav.labelKey), icon: nav.icon }] : []
    }),
    ...pagePlugins.map(p => ({ to: `/plugins/${p.id}`, label: p.name, icon: resolvePluginIcon(p.icon) })),
  ]
  const overflowItems = items.length > 5 ? items.slice(4) : []
  const visibleItems = overflowItems.length ? items.slice(0, 4) : items
  // Split the items so the raised "+" sits dead centre.
  const splitAt = Math.ceil(visibleItems.length / 2)
  const left = visibleItems.slice(0, splitAt)
  const right = visibleItems.slice(splitAt)

  const isActive = (to: string) =>
    to === '/dashboard' ? location.pathname === '/dashboard' : location.pathname.startsWith(to)

  useEffect(() => {
    if (!moreOpen) return
    const closeOutside = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMoreOpen(false)
      moreButtonRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [moreOpen])

  const renderItem = ({ to, label, icon: Icon }: NavItem) => {
    const active = isActive(to)
    return (
      <button
        key={to}
        onClick={() => navigate(to)}
        className="flex flex-col items-center gap-1 py-1 px-1 min-w-0"
        style={{ color: active ? (dark ? '#fff' : 'oklch(0.22 0 0)') : (dark ? 'oklch(0.6 0 0)' : 'oklch(0.62 0.01 65)') }}
      >
        <Icon size={21} strokeWidth={active ? 2.4 : 1.9} />
        <span className="text-[10px] font-semibold tracking-tight truncate max-w-full">{label}</span>
      </button>
    )
  }

  return (
    <nav
      className="md:hidden fixed z-[60] flex items-center"
      style={{
        left: 12, right: 12,
        bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        padding: '8px 8px',
        borderRadius: 24,
        background: dark ? 'oklch(0.2 0 0 / 0.96)' : 'rgba(255,255,255,0.96)',
        backdropFilter: 'saturate(1.7) blur(22px)',
        WebkitBackdropFilter: 'saturate(1.7) blur(22px)',
        border: dark ? '1px solid oklch(1 0 0 / .1)' : '1px solid oklch(0.92 0.008 70 / .6)',
        boxShadow: dark
          ? '0 12px 40px -8px oklch(0 0 0 / .6), inset 0 1px 0 oklch(1 0 0 / .08)'
          : '0 12px 40px -8px oklch(0 0 0 / .22), inset 0 1px 0 oklch(1 0 0 / .8)',
      }}
    >
      <div className="flex flex-1 items-center justify-around min-w-0">{left.map(renderItem)}</div>

      <button
        onClick={create.run}
        aria-label={create.label}
        className="flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
        style={{
          width: 46, height: 46, marginInline: 8,
          borderRadius: '50%',
          background: dark ? '#fff' : 'oklch(0.22 0 0)',
          color: dark ? 'oklch(0.22 0 0)' : '#fff',
          boxShadow: '0 4px 12px oklch(0 0 0 / .22)',
        }}
      >
        <Plus size={24} strokeWidth={2.6} />
      </button>

      <div className="flex flex-1 items-center justify-around min-w-0">
        {right.map(renderItem)}
        {overflowItems.length > 0 && (
          <div ref={moreRef} style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}>
            <button
              ref={moreButtonRef}
              type="button"
              onClick={() => setMoreOpen(open => !open)}
              aria-label={t('nav.moreDestinations')}
              aria-expanded={moreOpen}
              aria-controls="bottom-nav-more-items"
              aria-current={overflowItems.some(item => isActive(item.to)) ? 'page' : undefined}
              className="flex flex-col items-center gap-1 py-1 px-1 min-w-0"
              style={{ color: overflowItems.some(item => isActive(item.to)) ? (dark ? '#fff' : 'oklch(0.22 0 0)') : (dark ? 'oklch(0.6 0 0)' : 'oklch(0.62 0.01 65)') }}
            >
              <MoreHorizontal size={21} strokeWidth={2} />
              <span className="text-[10px] font-semibold tracking-tight">{t('nav.bottomMore')}</span>
            </button>
            <div
              id="bottom-nav-more-items"
              role="group"
              aria-label={t('nav.moreDestinations')}
              hidden={!moreOpen}
              style={{
                position: 'absolute', right: 0, bottom: 'calc(100% + 14px)',
                minWidth: 208, maxWidth: 'calc(100vw - 24px)', maxHeight: 'min(55dvh, 420px)',
                overflowY: 'auto', padding: 6, borderRadius: 16, background: 'var(--bg-card)',
                border: '1px solid var(--border-primary)', boxShadow: '0 12px 32px rgba(0,0,0,.22)',
              }}
            >
              {overflowItems.map(({ to, label, icon: Icon }) => (
                <button
                  key={to}
                  type="button"
                  onClick={() => { navigate(to); setMoreOpen(false) }}
                  aria-current={isActive(to) ? 'page' : undefined}
                  className="flex w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-content transition-colors hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)]"
                  style={{ minHeight: 44 }}
                >
                  <Icon size={18} strokeWidth={1.9} />
                  <span className="min-w-0 break-words">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
