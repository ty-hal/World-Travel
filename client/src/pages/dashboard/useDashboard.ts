import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { tripsApi, placesApi, authApi, reservationsApi } from '../../api/client'
import { tripRepo } from '../../repo/tripRepo'
import { useAuthStore } from '../../store/authStore'
import { useTranslation } from '../../i18n'
import { useToast } from '../../components/shared/Toast'
import { getApiErrorMessage } from '../../types'
import type { TripCreateRequest } from '@trek/shared'
import {
  type DashboardTrip,
  type TravelStats,
  type UpcomingReservation,
  type RecentActivity,
  type HeroBundle,
  type CompletedSortKey,
  COMPLETED_SORT_STORAGE_KEY,
  getTripStatus,
  sortTrips,
  sortTripsByPriority,
  sortCompletedTrips,
  applyTripOrder,
} from './dashboardModel'

function readCompletedSort(): CompletedSortKey {
  const raw = localStorage.getItem(COMPLETED_SORT_STORAGE_KEY)
  const allowed: CompletedSortKey[] = [
    'date-desc', 'date-asc', 'duration-desc', 'duration-asc', 'places-desc', 'places-asc',
  ]
  return allowed.includes(raw as CompletedSortKey) ? (raw as CompletedSortKey) : 'date-desc'
}

/**
 * Dashboard data hook — owns every bit of the page's state, data loading and
 * mutations (trip CRUD, archive/copy, travel stats, upcoming reservations,
 * the spotlight hero bundle) and exposes derived values + handlers. The
 * DashboardPage component is a pure wiring container that renders what this
 * returns. Behaviour is identical to the previous in-component logic.
 */
export function useDashboard() {
  const [trips, setTrips] = useState<DashboardTrip[]>([])
  const [archivedTrips, setArchivedTrips] = useState<DashboardTrip[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [showForm, setShowForm] = useState<boolean>(false)
  const [editingTrip, setEditingTrip] = useState<DashboardTrip | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'seasons'>(() => {
    const saved = localStorage.getItem('trek_dashboard_view')
    return saved === 'list' || saved === 'seasons' ? saved : 'grid'
  })
  const [deleteTrip, setDeleteTrip] = useState<DashboardTrip | null>(null)
  const [copyTrip, setCopyTrip] = useState<DashboardTrip | null>(null)
  const [tripFilter, setTripFilter] = useState<'planned' | 'archive' | 'completed'>('planned')
  const [completedSort, setCompletedSortState] = useState<CompletedSortKey>(readCompletedSort)
  const [allSubOpen, setAllSubOpen] = useState<boolean>(false)
  const [loadError, setLoadError] = useState<boolean>(false)

  const [stats, setStats] = useState<TravelStats | null>(null)
  const [upcoming, setUpcoming] = useState<UpcomingReservation[]>([])
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [heroBundle, setHeroBundle] = useState<HeroBundle | null>(null)

  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()
  const { t, locale } = useTranslation()
  const { demoMode, authCheckFailed, loadUser } = useAuthStore()

  const selectViewMode = (next: 'grid' | 'list' | 'seasons') => {
    setViewMode(next)
    localStorage.setItem('trek_dashboard_view', next)
  }

  const setCompletedSort = (next: CompletedSortKey) => {
    setCompletedSortState(next)
    localStorage.setItem(COMPLETED_SORT_STORAGE_KEY, next)
  }

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setShowForm(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams])

  useEffect(() => { void loadTrips() }, [])

  // Travel stats + upcoming reservations power the atlas row and the sidebar.
  // Both are best-effort: a failure just leaves that section empty.
  useEffect(() => {
    authApi.travelStats().then(setStats).catch(() => {})
    reservationsApi.upcoming().then((r: { reservations: UpcomingReservation[] }) => setUpcoming(r.reservations || [])).catch(() => {})
    tripsApi.recentActivity().then((r: { items: RecentActivity[] }) => setRecentActivity(r.items || [])).catch(() => {})
  }, [])

  const loadTrips = async (showErrorToast = true) => {
    if (showErrorToast) setIsLoading(true)
    try {
      const { trips, archivedTrips } = await tripRepo.list()
      setTrips(sortTripsByPriority(trips))
      setArchivedTrips(sortTripsByPriority(archivedTrips))
      setLoadError(false)
    } catch {
      setLoadError(true)
      if (showErrorToast) toast.error(t('dashboard.toast.loadError'))
    } finally {
      if (showErrorToast) setIsLoading(false)
    }
  }

  // Re-run both the trip fetch and the auth check so a recovered backend clears
  // the error banner (loadUser resets authCheckFailed on success). #1283
  const refreshDashboard = (showErrorToast = false) => {
    loadUser({ silent: true })
    void loadTrips(showErrorToast)
    authApi.travelStats().then(setStats).catch(() => {})
    reservationsApi.upcoming().then((r: { reservations: UpcomingReservation[] }) => setUpcoming(r.reservations || [])).catch(() => {})
    tripsApi.recentActivity().then((r: { items: RecentActivity[] }) => setRecentActivity(r.items || [])).catch(() => {})
  }

  const retryLoad = () => refreshDashboard(true)

  const refreshDashboardRef = useRef(refreshDashboard)
  refreshDashboardRef.current = refreshDashboard

  useEffect(() => {
    const handleServerReady = () => refreshDashboardRef.current()
    window.addEventListener('trek:server-ready', handleServerReady)
    return () => window.removeEventListener('trek:server-ready', handleServerReady)
  }, [])

  useEffect(() => {
    if (!loadError && !authCheckFailed) return
    const retryTimer = window.setInterval(() => refreshDashboardRef.current(false), 5000)
    return () => window.clearInterval(retryTimer)
  }, [loadError, authCheckFailed])

  const today = new Date().toISOString().split('T')[0]
  // Spotlight stays chronological (next live/upcoming trip), independent of manual priority.
  const chronological = sortTrips(trips)
  const spotlight = chronological.find(t => t.start_date && t.end_date && t.start_date <= today && t.end_date >= today)
    || chronological.find(t => t.start_date && t.start_date >= today)
    || chronological[0]
    || null
  const rest = spotlight ? trips.filter(t => t.id !== spotlight.id) : trips

  // Pull only the two spotlight resources the boarding pass renders. The full
  // offline bundle is reserved for tripSyncManager's explicit cache download.
  useEffect(() => {
    if (!spotlight) { setHeroBundle(null); return }
    let cancelled = false
    Promise.all([tripsApi.getMembers(spotlight.id), placesApi.list(spotlight.id)])
      .then(([memberData, placeData]) => {
        if (cancelled) return
        setHeroBundle({
          members: [memberData.owner, ...(memberData.members || [])].filter(Boolean),
          places: placeData.places || [],
        } as HeroBundle)
      })
      .catch(() => { if (!cancelled) setHeroBundle(null) })
    return () => { cancelled = true }
  }, [spotlight?.id])

  const handleCreate = async (tripData: TripCreateRequest) => {
    try {
      const data = await tripsApi.create(tripData)
      setTrips(prev => sortTripsByPriority([...prev, data.trip]))
      toast.success(t('dashboard.toast.created'))
      return data
    } catch (err: unknown) {
      throw new Error(getApiErrorMessage(err, t('dashboard.toast.createError')))
    }
  }

  const handleUpdate = async (tripData: TripCreateRequest) => {
    if (!editingTrip) return
    try {
      const data = await tripsApi.update(editingTrip.id, tripData)
      setTrips(prev => sortTripsByPriority(prev.map(t => t.id === editingTrip.id ? data.trip : t)))
      toast.success(t('dashboard.toast.updated'))
    } catch (err: unknown) {
      throw new Error(getApiErrorMessage(err, t('dashboard.toast.updateError')))
    }
  }

  const confirmDelete = async () => {
    if (!deleteTrip) return
    try {
      await tripsApi.delete(deleteTrip.id)
      setTrips(prev => prev.filter(t => t.id !== deleteTrip.id))
      setArchivedTrips(prev => prev.filter(t => t.id !== deleteTrip.id))
      toast.success(t('dashboard.toast.deleted'))
    } catch {
      toast.error(t('dashboard.toast.deleteError'))
    }
    setDeleteTrip(null)
  }

  const handleArchive = async (id: number) => {
    try {
      const data = await tripsApi.archive(id)
      setTrips(prev => prev.filter(t => t.id !== id))
      setArchivedTrips(prev => sortTripsByPriority([...prev, data.trip]))
      toast.success(t('dashboard.toast.archived'))
    } catch {
      toast.error(t('dashboard.toast.archiveError'))
    }
  }

  const handleUnarchive = async (id: number) => {
    try {
      const data = await tripsApi.unarchive(id)
      setArchivedTrips(prev => prev.filter(t => t.id !== id))
      setTrips(prev => sortTripsByPriority([...prev, data.trip]))
      toast.success(t('dashboard.toast.restored'))
    } catch {
      toast.error(t('dashboard.toast.restoreError'))
    }
  }

  const confirmCopy = async () => {
    if (!copyTrip) return
    try {
      const data = await tripsApi.copy(copyTrip.id, { title: `${copyTrip.title} (${t('dashboard.copySuffix')})` })
      setTrips(prev => sortTripsByPriority([...prev, data.trip]))
      toast.success(t('dashboard.toast.copied'))
    } catch {
      toast.error(t('dashboard.toast.copyError'))
    }
    setCopyTrip(null)
  }

  const canReorder = tripFilter === 'planned' || tripFilter === 'archive'

  const gridTrips = (() => {
    if (tripFilter === 'archive') return archivedTrips
    if (tripFilter === 'completed') {
      return sortCompletedTrips(rest.filter(t => getTripStatus(t) === 'past'), completedSort)
    }
    return rest.filter(t => getTripStatus(t) !== 'past')
  })()

  const handleReorderGrid = async (orderedIds: number[]) => {
    if (!canReorder || orderedIds.length === 0) return
    const previousTrips = trips
    const previousArchived = archivedTrips
    const ids = tripFilter === 'archive'
      ? orderedIds
      : [
          ...(spotlight?.id && !orderedIds.includes(spotlight.id) ? [spotlight.id] : []),
          ...orderedIds,
          ...trips.filter(t => t.id !== spotlight?.id && !orderedIds.includes(t.id)).map(t => t.id),
        ]

    if (tripFilter === 'archive') setArchivedTrips(applyTripOrder(archivedTrips, ids))
    else setTrips(applyTripOrder(trips, ids))

    try {
      await tripsApi.reorder(ids)
    } catch {
      setTrips(previousTrips)
      setArchivedTrips(previousArchived)
      toast.error(t('dashboard.toast.reorderError'))
    }
  }

  return {
    // cross-cutting
    demoMode, locale, t, navigate,
    // data + derived
    spotlight, heroBundle, stats, upcoming, recentActivity, gridTrips, isLoading,
    loadError: loadError || authCheckFailed, retryLoad,
    // ui state
    tripFilter, setTripFilter, viewMode, selectViewMode,
    completedSort, setCompletedSort, canReorder,
    showForm, setShowForm, editingTrip, setEditingTrip,
    deleteTrip, setDeleteTrip, copyTrip, setCopyTrip, setTrips,
    allSubOpen, setAllSubOpen,
    // actions
    handleCreate, handleUpdate, confirmDelete, handleArchive, handleUnarchive, confirmCopy,
    handleReorderGrid,
  }
}
