import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n'
import Navbar from '../components/Layout/Navbar'
import apiClient from '../api/client'
import CustomSelect from '../components/shared/CustomSelect'
import { MapPin, Briefcase, Calendar, Flag, PanelLeftOpen, PanelLeftClose, X, Star, Plus, Trash2, Landmark } from 'lucide-react'
import AnimatedGlobeIcon from '../components/shared/AnimatedGlobeIcon'
import AnimatedSearchIcon from '../components/shared/AnimatedSearchIcon'
import type { TranslationFn } from '../types'
import { A2_TO_A3, countryCodeToFlag, type AtlasCountry, type AtlasStats, type AtlasData, type CountryDetail } from './atlas/atlasModel'
import { continentForCountry } from '@trek/shared'
import { useAtlas } from './atlas/useAtlas'
import { atlasMapBackground } from '../components/Map/leafletTiles'
import WonderDetailDrawer from './atlas/WonderDetailDrawer'
import { useToast } from '../components/shared/Toast'
import { getApiErrorMessage } from '../types'

function MobileStats({ data, stats, countries, resolveName, t, dark }: { data: AtlasData | null; stats: AtlasStats; countries: AtlasCountry[]; resolveName: (code: string) => string; t: TranslationFn; dark: boolean }): React.ReactElement {
  const tp = dark ? '#f8fafc' : '#0f172a'
  const tf = dark ? '#94a3b8' : '#64748b'
  const { continents, lastTrip, nextTrip, streak, firstYear, tripsThisYear } = data || {}
  const CL = { 'Europe': t('atlas.europe'), 'Asia': t('atlas.asia'), 'North America': t('atlas.northAmerica'), 'South America': t('atlas.southAmerica'), 'Africa': t('atlas.africa'), 'Oceania': t('atlas.oceania') }
  const thisYear = new Date().getFullYear()

  return (
    <div className="space-y-4">
      {/* Stats grid */}
      <div className="grid grid-cols-5 gap-2">
        {[[stats.totalCountries, t('atlas.countries')], [stats.totalTrips, t('atlas.trips')], [stats.totalPlaces, t('atlas.places')], [stats.totalCities || 0, t('atlas.cities')], [stats.totalDays, t('atlas.days')]].map(([v, l], i) => (
          <div key={i} className="text-center py-2">
            <p className="text-xl font-black tabular-nums" style={{ color: tp }}>{v}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: tf }}>{l}</p>
          </div>
        ))}
      </div>
      {/* Continents */}
      <div className="grid grid-cols-6 gap-1">
        {['Europe', 'Asia', 'North America', 'South America', 'Africa', 'Oceania'].map(cont => {
          const count = continents?.[cont] || 0
          return (
            <div key={cont} className="text-center py-1">
              <p className="text-base font-bold tabular-nums" style={{ color: count > 0 ? tp : (dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)') }}>{count}</p>
              <p className="text-[8px] font-semibold uppercase" style={{ color: count > 0 ? tf : (dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)') }}>{CL[cont]}</p>
            </div>
          )
        })}
      </div>
      {/* Highlights */}
      <div className="flex gap-3">
        {streak > 0 && (
          <div className="text-center flex-1 py-2">
            <p className="text-xl font-black tabular-nums" style={{ color: tp }}>{streak}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: tf }}>{streak === 1 ? t('atlas.yearInRow') : t('atlas.yearsInRow')}</p>
          </div>
        )}
        {tripsThisYear > 0 && (
          <div className="text-center flex-1 py-2">
            <p className="text-xl font-black tabular-nums" style={{ color: tp }}>{tripsThisYear}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: tf }}>{tripsThisYear === 1 ? t('atlas.tripIn') : t('atlas.tripsIn')} {thisYear}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AtlasPage(): React.ReactElement {
  // Page = wiring container: the whole interactive globe (map lifecycle, atlas +
  // bucket data, mark/unmark flows, country search) lives in useAtlas. The page
  // only wires that state into JSX and its presentational SidebarContent helper.
  const {
    t, language, navigate, resolveName, dark, loading,
    mapRef, regionTooltipRef, panelRef,
    data, setData, stats, countries, selectedCountry, countryDetail,
    loadCountryDetail, handleUnmarkCountry, select_country_from_search,
    visitedRegions, setVisitedRegions,
    atlas_country_search, set_atlas_country_search,
    atlas_country_results, set_atlas_country_results,
    atlas_country_open, set_atlas_country_open, atlas_country_options,
    confirmAction, setConfirmAction, executeConfirmAction,
    bucketMonth, setBucketMonth, bucketYear, setBucketYear,
    bucketList, setBucketList, bucketTab, setBucketTab, wonders, visitHeatmap,
    focusWonder,
    showBucketAdd, setShowBucketAdd, bucketForm, setBucketForm,
    handleAddBucketItem, handleDeleteBucketItem, handleBucketPoiSearch, handleSelectBucketPoi,
    bucketSearchResults, setBucketSearchResults,
    bucketPoiMonth, setBucketPoiMonth, bucketPoiYear, setBucketPoiYear,
    bucketSearching, bucketSearch, setBucketSearch,
  } = useAtlas()
  const toast = useToast()
  const [detailWonder, setDetailWonder] = useState<any | null>(null)
  const handleWonderClick = (wonder: any) => {
    focusWonder(wonder)
    setDetailWonder(wonder)
  }
  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <Navbar />
        <div className="flex items-center justify-center" style={{ paddingTop: 'var(--nav-h)', minHeight: 'calc(100vh - var(--nav-h))' }}>
          <div className="w-8 h-8 border-2 rounded-full animate-spin border-edge border-t-content" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen overflow-hidden bg-surface">
      <Navbar />
      <div style={{ position: 'fixed', top: 'var(--nav-h)', left: 0, right: 0, bottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {/* Map */}
        <div ref={mapRef} className="atlas-map-host" style={{ position: 'absolute', inset: 0, zIndex: 1, background: atlasMapBackground(dark) }} />

        {/* Region tooltip (custom, always on top, ref-controlled to avoid re-renders) */}
        <div ref={regionTooltipRef} className="atlas-chrome" style={{
          position: 'fixed', display: 'none',
          zIndex: 9999, pointerEvents: 'none',
          borderRadius: 10, padding: '10px 14px',
          fontSize: 'calc(12px * var(--fs-scale-body, 1))', minWidth: 120,
        }} />

        {/* Map legend — visited countries and wonder pins */}
        <div className="atlas-chrome hidden md:block absolute z-10 rounded-xl px-3 py-2.5" style={{ top: 12, left: 12, fontSize: 11 }}>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-content-faint mb-1.5">{t('atlas.mapLegend')}</div>
          <div className="flex flex-col gap-1.5 text-content-muted">
            <span className="inline-flex items-center gap-2"><span style={{ width: 12, height: 12, borderRadius: 3, background: '#6366f1', opacity: 0.85 }} />{t('atlas.legendVisited')}</span>
            <span className="inline-flex items-center gap-2"><span style={{ width: 12, height: 12, borderRadius: 3, background: dark ? '#ffffff' : '#f8fafc', border: `1px solid ${dark ? '#d4d4d8' : '#cbd5e1'}` }} />{t('atlas.legendUnvisited')}</span>
            {bucketTab === 'wonders' && (
              <>
                <span className="inline-flex items-center gap-2"><span style={{ width: 10, height: 10, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', background: '#22c55e', border: '1.5px solid white' }} />{t('atlas.legendWonderVisited')}</span>
                <span className="inline-flex items-center gap-2"><span style={{ width: 10, height: 10, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', background: '#818cf8', border: '1.5px solid white' }} />{t('atlas.legendWonderUnvisited')}</span>
              </>
            )}
          </div>
        </div>

        <AtlasCountrySearch
          dark={dark}
          t={t}
          search={atlas_country_search}
          setSearch={set_atlas_country_search}
          results={atlas_country_results}
          setResults={set_atlas_country_results}
          open={atlas_country_open}
          setOpen={set_atlas_country_open}
          options={atlas_country_options}
          onSelect={select_country_from_search}
        />

        {/* Mobile: Bottom bar — solid surface so map never bleeds through labels */}
        <div className="md:hidden absolute left-0 right-0 z-10 flex justify-center" style={{ bottom: 'calc(84px + env(safe-area-inset-bottom, 0px) + 8px)', touchAction: 'manipulation' }}>
          <div className="atlas-chrome flex items-center gap-3 px-4 py-3 rounded-2xl">
            <div className="atlas-stat-hero text-center px-3 py-1.5 rounded-xl">
              <p className="text-3xl font-black tabular-nums leading-none text-content">{stats.totalCountries}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide mt-1 text-content-muted">{t('atlas.countries')}</p>
            </div>
            {[[stats.totalTrips, t('atlas.trips')], [stats.totalPlaces, t('atlas.places')], [stats.totalCities || 0, t('atlas.cities')], [stats.totalDays, t('atlas.days')]].map(([v, l], i) => (
              <div key={i} className="text-center px-1">
                <p className="text-xl font-black tabular-nums leading-none text-content">{v}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide mt-1 text-content-muted">{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop Panel — solid elevated card (not glass) for readable stats over the map */}
        <div
          ref={panelRef}
          className="atlas-chrome atlas-bottom-panel hidden md:flex flex-col absolute z-10 overflow-hidden transition-[width,height,transform,box-shadow] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'fit-content',
            maxWidth: 'calc(100vw - 40px)',
          }}
        >
          <SidebarContent
            data={data} stats={stats} countries={countries} selectedCountry={selectedCountry}
            countryDetail={countryDetail} resolveName={resolveName}
            onCountryClick={loadCountryDetail} onTripClick={(id) => navigate(`/trips/${id}`)} onUnmarkCountry={handleUnmarkCountry}
            bucketList={bucketList} bucketTab={bucketTab} setBucketTab={setBucketTab} wonders={wonders} visitHeatmap={visitHeatmap} onWonderClick={handleWonderClick}
            showBucketAdd={showBucketAdd} setShowBucketAdd={setShowBucketAdd}
            bucketForm={bucketForm} setBucketForm={setBucketForm}
            onAddBucket={handleAddBucketItem} onDeleteBucket={handleDeleteBucketItem}
            onSearchBucket={handleBucketPoiSearch} onSelectBucketPoi={handleSelectBucketPoi}
            bucketSearchResults={bucketSearchResults} setBucketSearchResults={setBucketSearchResults} bucketPoiMonth={bucketPoiMonth} setBucketPoiMonth={setBucketPoiMonth}
            bucketPoiYear={bucketPoiYear} setBucketPoiYear={setBucketPoiYear} bucketSearching={bucketSearching}
            bucketSearch={bucketSearch} setBucketSearch={setBucketSearch}
            t={t} dark={dark}
          />
        </div>

      </div>

      <WonderDetailDrawer
        wonder={detailWonder}
        onClose={() => setDetailWonder(null)}
        onFocusMap={w => { focusWonder(w); setDetailWonder(w) }}
        t={t}
        dark={dark}
      />

      {/* Country action popup */}
      {confirmAction && (
        <div className="bg-[rgba(0,0,0,0.4)]" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setConfirmAction(null)}>
          <div className="bg-surface-card" style={{ borderRadius: 16, padding: 24, maxWidth: 340, width: '100%', boxShadow: '0 16px 48px rgba(0,0,0,0.2)', textAlign: 'center' }}
            onClick={e => e.stopPropagation()}>
            {confirmAction.code.length === 2 ? (
              <img src={`https://flagcdn.com/w80/${confirmAction.code.toLowerCase()}.png`} alt={confirmAction.code} style={{ width: 48, height: 34, borderRadius: 6, objectFit: 'cover', marginBottom: 12, display: 'inline-block' }} />
            ) : (
              <div style={{ fontSize: 'calc(36px * var(--fs-scale-title, 1))', marginBottom: 12 }}>{countryCodeToFlag(confirmAction.code)}</div>
            )}
            <h3 className="text-content" style={{ margin: '0 0 16px', fontSize: 'calc(16px * var(--fs-scale-subtitle, 1))', fontWeight: 700 }}>{confirmAction.name}</h3>

            {confirmAction.type === 'choose' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={async () => {
                  try {
                    await apiClient.post(`/addons/atlas/country/${confirmAction.code}/mark`)
                    setData(prev => {
                      if (!prev || prev.countries.find(c => c.code === confirmAction.code)) return prev
                      const cont = continentForCountry(confirmAction.code)
                      return { ...prev, countries: [...prev.countries, { code: confirmAction.code, placeCount: 0, tripCount: 0, firstVisit: null, lastVisit: null }], stats: { ...prev.stats, totalCountries: prev.stats.totalCountries + 1 }, continents: { ...prev.continents, [cont]: (prev.continents?.[cont] || 0) + 1 } }
                    })
                  } catch (err) {
                    toast.error(getApiErrorMessage(err, t('common.error')))
                  }
                  setConfirmAction(null)
                }}
                  className="border border-edge"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px', borderRadius: 12, background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <MapPin size={18} className="text-content" style={{ flexShrink: 0 }} />
                  <div>
                    <div className="text-content" style={{ fontSize: 'calc(13px * var(--fs-scale-body, 1))', fontWeight: 600 }}>{t('atlas.markVisited')}</div>
                    <div className="text-content-muted" style={{ fontSize: 'calc(11px * var(--fs-scale-caption, 1))', marginTop: 1 }}>{t('atlas.markVisitedHint')}</div>
                  </div>
                </button>
                <button onClick={() => setConfirmAction({ ...confirmAction, type: 'bucket' as any })}
                  className="border border-edge"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px', borderRadius: 12, background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <Star size={18} className="text-[#fbbf24]" style={{ flexShrink: 0 }} />
                  <div>
                    <div className="text-content" style={{ fontSize: 'calc(13px * var(--fs-scale-body, 1))', fontWeight: 600 }}>{t('atlas.addToBucket')}</div>
                    <div className="text-content-muted" style={{ fontSize: 'calc(11px * var(--fs-scale-caption, 1))', marginTop: 1 }}>{t('atlas.addToBucketHint')}</div>
                  </div>
                </button>
              </div>
            )}

            {confirmAction.type === 'choose-region' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {confirmAction.countryName && (
                  <p className="text-content-muted" style={{ margin: '-8px 0 8px', fontSize: 'calc(12px * var(--fs-scale-body, 1))' }}>{confirmAction.countryName}</p>
                )}
                <button onClick={async () => {
                  const { code: countryCode, name: rName, regionCode: rCode } = confirmAction
                  if (!rCode) return
                  try {
                    await apiClient.post(`/addons/atlas/region/${rCode}/mark`, { name: rName, country_code: countryCode })
                    setVisitedRegions(prev => {
                      const existing = prev[countryCode] || []
                      if (existing.find(r => r.code === rCode)) return prev
                      return { ...prev, [countryCode]: [...existing, { code: rCode, name: rName, placeCount: 0, manuallyMarked: true }] }
                    })
                    setData(prev => {
                      if (!prev || prev.countries.find(c => c.code === countryCode)) return prev
                      const cont = continentForCountry(countryCode)
                      return { ...prev, countries: [...prev.countries, { code: countryCode, placeCount: 0, tripCount: 0, firstVisit: null, lastVisit: null }], stats: { ...prev.stats, totalCountries: prev.stats.totalCountries + 1 }, continents: { ...prev.continents, [cont]: (prev.continents?.[cont] || 0) + 1 } }
                    })
                  } catch (err) {
                    toast.error(getApiErrorMessage(err, t('common.error')))
                  }
                  setConfirmAction(null)
                }}
                  className="border border-edge"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px', borderRadius: 12, background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <MapPin size={18} className="text-content" style={{ flexShrink: 0 }} />
                  <div>
                    <div className="text-content" style={{ fontSize: 'calc(13px * var(--fs-scale-body, 1))', fontWeight: 600 }}>{t('atlas.markVisited')}</div>
                    <div className="text-content-muted" style={{ fontSize: 'calc(11px * var(--fs-scale-caption, 1))', marginTop: 1 }}>{t('atlas.markRegionVisitedHint')}</div>
                  </div>
                </button>
                <button onClick={() => setConfirmAction({ ...confirmAction, type: 'bucket' })}
                  className="border border-edge"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 16px', borderRadius: 12, background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <Star size={18} className="text-[#fbbf24]" style={{ flexShrink: 0 }} />
                  <div>
                    <div className="text-content" style={{ fontSize: 'calc(13px * var(--fs-scale-body, 1))', fontWeight: 600 }}>{t('atlas.addToBucket')}</div>
                    <div className="text-content-muted" style={{ fontSize: 'calc(11px * var(--fs-scale-caption, 1))', marginTop: 1 }}>{t('atlas.addToBucketHint')}</div>
                  </div>
                </button>
              </div>
            )}

            {confirmAction.type === 'unmark' && (
              <>
                <p className="text-content-muted" style={{ margin: '0 0 20px', fontSize: 'calc(13px * var(--fs-scale-body, 1))' }}>{t('atlas.confirmUnmark')}</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button onClick={() => setConfirmAction(null)}
                    className="border border-edge text-content-muted"
                    style={{ padding: '8px 20px', borderRadius: 10, background: 'none', fontSize: 'calc(13px * var(--fs-scale-body, 1))', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {t('common.cancel')}
                  </button>
                  <button onClick={executeConfirmAction}
                    className="bg-[#ef4444] text-white"
                    style={{ padding: '8px 20px', borderRadius: 10, border: 'none', fontSize: 'calc(13px * var(--fs-scale-body, 1))', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {t('atlas.unmark')}
                  </button>
                </div>
              </>
            )}

            {confirmAction.type === 'unmark-region' && (
              <>
                {confirmAction.countryName && (
                  <p className="text-content-muted" style={{ margin: '-8px 0 8px', fontSize: 'calc(12px * var(--fs-scale-body, 1))' }}>{confirmAction.countryName}</p>
                )}
                <p className="text-content-muted" style={{ margin: '0 0 20px', fontSize: 'calc(13px * var(--fs-scale-body, 1))' }}>{t('atlas.confirmUnmarkRegion')}</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button onClick={() => setConfirmAction(null)}
                    className="border border-edge text-content-muted"
                    style={{ padding: '8px 20px', borderRadius: 10, background: 'none', fontSize: 'calc(13px * var(--fs-scale-body, 1))', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {t('common.cancel')}
                  </button>
                  <button onClick={async () => {
                    const { code: countryCode, regionCode: rCode } = confirmAction
                    if (!rCode) return
                    try {
                      await apiClient.delete(`/addons/atlas/region/${rCode}/mark`)
                      setVisitedRegions(prev => {
                        const remaining = (prev[countryCode] || []).filter(r => r.code !== rCode)
                        const next = { ...prev, [countryCode]: remaining }
                        if (remaining.length === 0) delete next[countryCode]
                        return next
                      })
                      // If no visible regions remain at all (not just manually-marked ones —
                      // the server now hides a region regardless of how it was derived, and
                      // cascades to the country the same way), remove the country too, but
                      // only when it has no real place/trip data of its own: a country with
                      // real places is never actually hidden server-side (#1490), so
                      // optimistically removing it here would just flash and reappear on
                      // the next reload.
                      setData(prev => {
                        if (!prev) return prev
                        const c = prev.countries.find(c => c.code === countryCode)
                        if (!c || c.placeCount > 0 || c.tripCount > 0) return prev
                        const remainingRegions = (visitedRegions[countryCode] || []).filter(r => r.code !== rCode)
                        if (remainingRegions.length > 0) return prev
                        const cont = continentForCountry(countryCode)
                        return {
                          ...prev,
                          countries: prev.countries.filter(c => c.code !== countryCode),
                          stats: { ...prev.stats, totalCountries: Math.max(0, prev.stats.totalCountries - 1) },
                          continents: { ...prev.continents, [cont]: Math.max(0, (prev.continents?.[cont] || 0) - 1) },
                        }
                      })
                    } catch (err) {
                      toast.error(getApiErrorMessage(err, t('common.error')))
                    }
                    setConfirmAction(null)
                  }}
                    className="bg-[#ef4444] text-white"
                    style={{ padding: '8px 20px', borderRadius: 10, border: 'none', fontSize: 'calc(13px * var(--fs-scale-body, 1))', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {t('atlas.unmark')}
                  </button>
                </div>
              </>
            )}

            {confirmAction.type === 'bucket' && (
              <>
                <p className="text-content-muted" style={{ margin: '0 0 14px', fontSize: 'calc(13px * var(--fs-scale-body, 1))' }}>{t('atlas.bucketWhen')}</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <CustomSelect
                      value={String(bucketMonth)}
                      onChange={v => setBucketMonth(Number(v))}
                      placeholder={t('atlas.month')}
                      options={[
                        { value: '0', label: '—' },
                        ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: new Date(2000, i).toLocaleString(language, { month: 'long' }) })),
                      ]}
                      size="sm"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <CustomSelect
                      value={String(bucketYear)}
                      onChange={v => setBucketYear(Number(v))}
                      placeholder={t('atlas.year')}
                      options={[
                        { value: '0', label: '—' },
                        ...Array.from({ length: 20 }, (_, i) => ({ value: String(new Date().getFullYear() + i), label: String(new Date().getFullYear() + i) })),
                      ]}
                      size="sm"
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => setConfirmAction({ ...confirmAction, type: confirmAction.regionCode ? 'choose-region' : 'choose' })}
                    className="border border-edge text-content-muted"
                    style={{ padding: '8px 20px', borderRadius: 10, background: 'none', fontSize: 'calc(13px * var(--fs-scale-body, 1))', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {t('common.back')}
                  </button>
                  <button onClick={async () => {
                    const targetDate = bucketMonth > 0 && bucketYear > 0 ? `${bucketYear}-${String(bucketMonth).padStart(2, '0')}` : null
                    try {
                      const r = await apiClient.post('/addons/atlas/bucket-list', { name: confirmAction.name, country_code: confirmAction.code, target_date: targetDate })
                      setBucketList(prev => [r.data.item, ...prev])
                    } catch (err) {
                      toast.error(getApiErrorMessage(err, t('common.error')))
                    }
                    setBucketMonth(0); setBucketYear(0)
                    setConfirmAction(null)
                  }}
                    className="bg-[#fbbf24] text-[#1a1a1a]"
                    style={{ padding: '8px 20px', borderRadius: 10, border: 'none', fontSize: 'calc(13px * var(--fs-scale-body, 1))', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {t('atlas.addToBucket')}
                  </button>
                </div>
              </>
            )}

            {confirmAction.type === 'mark' && (
              <>
                <p className="text-content-muted" style={{ margin: '0 0 20px', fontSize: 'calc(13px * var(--fs-scale-body, 1))' }}>{t('atlas.confirmMark')}</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button onClick={() => setConfirmAction(null)}
                    className="border border-edge text-content-muted"
                    style={{ padding: '8px 20px', borderRadius: 10, background: 'none', fontSize: 'calc(13px * var(--fs-scale-body, 1))', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {t('common.cancel')}
                  </button>
                  <button onClick={executeConfirmAction}
                    className="bg-content text-white"
                    style={{ padding: '8px 20px', borderRadius: 10, border: 'none', fontSize: 'calc(13px * var(--fs-scale-body, 1))', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {t('atlas.markVisited')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface SidebarContentProps {
  data: AtlasData | null
  stats: AtlasStats
  countries: AtlasCountry[]
  selectedCountry: string | null
  countryDetail: CountryDetail | null
  resolveName: (code: string) => string
  onCountryClick: (code: string) => void
  onTripClick: (id: number) => void
  onUnmarkCountry?: (code: string) => void
  bucketList: any[]
  bucketTab: 'stats' | 'bucket' | 'wonders'
  setBucketTab: (tab: 'stats' | 'bucket' | 'wonders') => void
  wonders: any[]
  visitHeatmap?: Array<{ year: string; trips: number }>
  onWonderClick: (wonder: any) => void
  showBucketAdd: boolean
  setShowBucketAdd: (v: boolean) => void
  bucketForm: { name: string; notes: string; lat: string; lng: string; target_date: string }
  setBucketForm: (f: { name: string; notes: string; lat: string; lng: string; target_date: string }) => void
  onAddBucket: () => Promise<void>
  onDeleteBucket: (id: number) => Promise<void>
  onSearchBucket: () => Promise<void>
  onSelectBucketPoi: (result: any) => void
  bucketSearchResults: any[]
  setBucketSearchResults: (v: string[]) => void
  bucketPoiMonth: number
  setBucketPoiMonth: (v: number) => void
  bucketPoiYear: number
  setBucketPoiYear: (v: number) => void
  bucketSearching: boolean
  bucketSearch: string
  setBucketSearch: (v: string) => void
  t: TranslationFn
  dark: boolean
}

function SidebarContent({ data, stats, countries, selectedCountry, countryDetail, resolveName, onTripClick, onUnmarkCountry, bucketList, bucketTab, setBucketTab, wonders, visitHeatmap = [], onWonderClick, showBucketAdd, setShowBucketAdd, bucketForm, setBucketForm, onAddBucket, onDeleteBucket, onSearchBucket, onSelectBucketPoi, bucketSearchResults, setBucketSearchResults, bucketPoiMonth, setBucketPoiMonth, bucketPoiYear, setBucketPoiYear, bucketSearching, bucketSearch, setBucketSearch, t, dark }: SidebarContentProps): React.ReactElement {
  const { language } = useTranslation()
  const statsContentRef = useRef<HTMLDivElement>(null)
  const [statsWidth, setStatsWidth] = useState<number | undefined>(undefined)
  const [wonderSearch, setWonderSearch] = useState('')
  const [wonderFilter, setWonderFilter] = useState<'all' | 'visited' | 'unvisited'>('all')
  const [selectedWonderId, setSelectedWonderId] = useState<string | null>(null)
  useEffect(() => {
    const el = statsContentRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setStatsWidth(el.offsetWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const tp = dark ? '#f8fafc' : '#0f172a'
  const tm = dark ? '#cbd5e1' : '#475569'
  const tf = dark ? '#94a3b8' : '#64748b'
  const accent = '#6366f1'

  const { continents, lastTrip, streak, tripsThisYear } = data || {}
  const CL = { 'Europe': t('atlas.europe'), 'Asia': t('atlas.asia'), 'North America': t('atlas.northAmerica'), 'South America': t('atlas.southAmerica'), 'Africa': t('atlas.africa'), 'Oceania': t('atlas.oceania') }

  // Tab switcher — solid segmented control (readable inactive labels)
  const tabBar = (
    <div className="atlas-tabbar">
      {[{ id: 'stats', label: t('atlas.statsTab'), icon: AnimatedGlobeIcon }, { id: 'bucket', label: t('atlas.bucketTab'), icon: Star }, { id: 'wonders', label: t('atlas.wondersTab'), icon: Landmark }].map(tab => (
        <button key={tab.id} onClick={() => setBucketTab(tab.id as any)}
          className={`atlas-tab${bucketTab === tab.id ? ' on' : ''}`}
          type="button"
        >
          <tab.icon size={13} />
          {tab.label}
        </button>
      ))}
    </div>
  )

  if (countries.length === 0 && !lastTrip && wonders.length === 0 && bucketTab === 'stats') {
    return (
      <>
        {tabBar}
        <div className="p-8 text-center">
          <AnimatedGlobeIcon size={28} animate="always" className="mx-auto mb-2" style={{ color: tf, opacity: 0.4 }} />
          <p className="text-sm font-medium" style={{ color: tm }}>{t('atlas.noData')}</p>
          <p className="text-xs mt-1" style={{ color: tf }}>{t('atlas.noDataHint')}</p>
        </div>
      </>
    )
  }

  const thisYear = new Date().getFullYear()

  // Bucket list content
  const bucketContent = (
    <>
    <div className="flex items-stretch" style={{ overflowX: 'auto', padding: '0 8px', maxWidth: statsWidth, width: '100%' }}>
      {bucketList.map(item => (
        <div key={item.id} className="group flex flex-col items-center justify-center shrink-0" style={{ padding: '8px 14px', position: 'relative', minWidth: 80 }}>
          {(() => {
            const code = item.country_code?.length === 2 ? item.country_code : (Object.entries(A2_TO_A3).find(([, v]) => v === item.country_code)?.[0] || '')
            return code ? (
              <img src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`} alt={code} style={{ width: 28, height: 20, borderRadius: 4, objectFit: 'cover', marginBottom: 4 }} />
            ) : <Star size={16} className="text-[#fbbf24]" style={{ marginBottom: 4 }} fill="#fbbf24" />
          })()}
          <span className="text-xs font-semibold text-center leading-tight" style={{ color: tp, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
          {item.target_date && (() => {
            const [y, m] = item.target_date.split('-')
            const label = m ? new Date(Number(y), Number(m) - 1).toLocaleString(language, { month: 'short', year: 'numeric' }) : y
            return <span className="text-[9px] mt-0.5 text-center" style={{ color: tf }}>{label}</span>
          })()}
          {!item.target_date && item.notes && <span className="text-[9px] mt-0.5 text-center" style={{ color: tf, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.notes}</span>}
          <button onClick={() => onDeleteBucket(item.id)}
            className="opacity-0 group-hover:opacity-100"
            style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: tf, display: 'flex', transition: 'opacity 0.15s' }}>
            <X size={10} />
          </button>
        </div>
      ))}
      {bucketList.length === 0 && !showBucketAdd && (
        <div className="flex items-center justify-center py-4 px-6" style={{ color: tf, fontSize: 'calc(12px * var(--fs-scale-body, 1))' }}>
          {t('atlas.bucketEmptyHint')}
        </div>
      )}
    </div>
    {showBucketAdd ? (
      <div style={{ padding: '8px 16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Search or manual name */}
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <input type="text" value={bucketForm.name || bucketSearch}
              onChange={e => { const v = e.target.value; if (bucketForm.name) setBucketForm({ ...bucketForm, name: v }); else setBucketSearch(v) }}
              onKeyDown={e => { if (e.key === 'Enter' && !bucketForm.name) onSearchBucket(); else if (e.key === 'Enter') onAddBucket(); if (e.key === 'Escape') setShowBucketAdd(false) }}
              placeholder={t('atlas.bucketNamePlaceholder')}
              autoFocus
              className="border border-edge text-content bg-surface-input"
              style={{ flex: 1, padding: '6px 10px', borderRadius: 8, fontSize: 'calc(12px * var(--fs-scale-body, 1))', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            />
            {!bucketForm.name && (
              <button onClick={onSearchBucket} disabled={bucketSearching}
                className="bg-accent text-accent-text"
                style={{ padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <AnimatedSearchIcon size={12} />
              </button>
            )}
            {bucketForm.name && (
              <button onClick={() => { setBucketForm({ ...bucketForm, name: '', lat: '', lng: '' }); setBucketSearch('') }}
                className="border border-edge text-content-faint"
                style={{ padding: '6px 8px', borderRadius: 8, background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <X size={12} />
              </button>
            )}
          </div>
          {bucketSearchResults.length > 0 && (
            <div className="bg-surface-card border border-edge" style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 50, marginBottom: 4, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', maxHeight: 160, overflowY: 'auto' }}>
              {bucketSearchResults.slice(0, 6).map((r, i) => (
                <button key={i} onClick={() => onSelectBucketPoi(r)} className="border-b border-edge-faint" style={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%', padding: '6px 10px', borderTop: 'none', borderLeft: 'none', borderRight: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                  <span className="text-content" style={{ fontSize: 'calc(12px * var(--fs-scale-body, 1))', fontWeight: 500 }}>{r.name}</span>
                  {r.address && <span className="text-content-faint" style={{ fontSize: 'calc(10px * var(--fs-scale-caption, 1))' }}>{r.address}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Selected place indicator */}
        {bucketForm.lat && bucketForm.lng && (
          <div className="text-content-faint" style={{ fontSize: 'calc(10px * var(--fs-scale-caption, 1))', display: 'flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={10} /> {Number(bucketForm.lat).toFixed(4)}, {Number(bucketForm.lng).toFixed(4)}
          </div>
        )}
        {/* Month / Year with CustomSelect */}
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <CustomSelect value={String(bucketPoiMonth)} onChange={v => setBucketPoiMonth(Number(v))} placeholder={t('atlas.month')} size="sm"
              options={[{ value: '0', label: '—' }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: new Date(2000, i).toLocaleString(language, { month: 'short' }) }))]} />
          </div>
          <div style={{ flex: 1 }}>
            <CustomSelect value={String(bucketPoiYear)} onChange={v => setBucketPoiYear(Number(v))} placeholder={t('atlas.year')} size="sm"
              options={[{ value: '0', label: '—' }, ...Array.from({ length: 20 }, (_, i) => ({ value: String(new Date().getFullYear() + i), label: String(new Date().getFullYear() + i) }))]} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button onClick={() => { setShowBucketAdd(false); setBucketForm({ name: '', notes: '', lat: '', lng: '', target_date: '' }); setBucketSearch(''); setBucketSearchResults([]); setBucketPoiMonth(0); setBucketPoiYear(0) }}
            className="border border-edge text-content-muted"
            style={{ fontSize: 'calc(11px * var(--fs-scale-caption, 1))', padding: '4px 10px', borderRadius: 6, background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('common.cancel')}
          </button>
          <button onClick={onAddBucket} disabled={!bucketForm.name.trim()}
            className="bg-[#fbbf24] text-[#1a1a1a]"
            style={{ fontSize: 'calc(11px * var(--fs-scale-caption, 1))', padding: '4px 12px', borderRadius: 6, border: 'none', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: bucketForm.name.trim() ? 1 : 0.5 }}>
            {t('common.add')}
          </button>
        </div>
      </div>
    ) : (
      <div style={{ padding: '4px 16px 8px' }}>
        <button onClick={() => setShowBucketAdd(true)}
          className="border border-dashed border-edge"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, width: '100%', padding: '5px 0', borderRadius: 8, background: 'none', fontSize: 'calc(11px * var(--fs-scale-caption, 1))', color: tf, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Plus size={11} /> {t('atlas.addPoi')}
        </button>
      </div>
    )}
    </>
  )

  const wondersContent = (
    <div style={{ padding: '10px 14px 14px', minWidth: 760, maxWidth: 860 }}>
      <div className="atlas-stat-hero" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 10px', borderRadius: 10 }}>
        <AnimatedSearchIcon size={13} style={{ color: tf, flexShrink: 0 }} />
        <input
          value={wonderSearch}
          onChange={e => setWonderSearch(e.target.value)}
          placeholder={t('atlas.searchWonders')}
          aria-label={t('atlas.searchWonders')}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: tp, font: 'inherit', fontSize: 12 }}
        />
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {(['all', 'visited', 'unvisited'] as const).map(filter => (
            <button key={filter} onClick={() => setWonderFilter(filter)} className={`atlas-tab${wonderFilter === filter ? ' on' : ''}`} style={{ flex: 'none', padding: '4px 8px', fontSize: 10 }} type="button">
              {filter === 'all' ? t('atlas.wondersFilterAll') : filter === 'visited' ? t('atlas.wondersFilterVisited') : t('atlas.wondersFilterUnvisited')}
            </button>
          ))}
        </div>
      </div>
      <div style={{ color: tf, fontSize: 11, marginBottom: 6, fontWeight: 500 }}>
        {wonders.filter(w => `${w.label} ${w.country} ${w.region}`.toLowerCase().includes(wonderSearch.toLowerCase()) && (wonderFilter === 'all' || Boolean(w.visited) === (wonderFilter === 'visited'))).length} / {wonders.length}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 18, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
        {wonders.filter(w => `${w.label} ${w.country} ${w.region}`.toLowerCase().includes(wonderSearch.toLowerCase()) && (wonderFilter === 'all' || Boolean(w.visited) === (wonderFilter === 'visited'))).map(wonder => (
          <button key={String(wonder.source_id)} onClick={() => { setSelectedWonderId(String(wonder.source_id)); onWonderClick(wonder) }} aria-label={`Show ${wonder.label} on map`} style={{ display: 'flex', gap: 9, alignItems: 'center', width: '100%', color: tp, fontSize: 12, padding: '7px 0', border: 'none', borderBottom: `1px solid ${dark ? '#2e3a4d' : '#e2e8f0'}`, background: selectedWonderId === String(wonder.source_id) ? (dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9') : 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
            <Landmark size={15} style={{ color: wonder.visited ? '#22c55e' : accent, flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <div style={{ fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{wonder.label}</div>
                {wonder.visited ? (
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#16a34a', background: 'rgba(34,197,94,0.12)', padding: '1px 6px', borderRadius: 99, flexShrink: 0 }}>
                    {t('atlas.wondersVisited')}
                  </span>
                ) : null}
              </div>
              <div style={{ color: tf, fontSize: 11 }}>{wonder.country}{wonder.region ? ` · ${wonder.region}` : ''}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <>
    {tabBar}
    {/* Keep Stats and Bucket mounted for shared sizing; collapse the inactive
        Wonders layer so its 300px scroll area cannot inflate this panel. */}
    <div style={{ display: 'grid' }}>
    <div style={bucketTab === 'stats' ? { gridArea: '1/1' } : { visibility: 'hidden' as const, gridArea: '1/1', maxHeight: 0, overflow: 'hidden' }}>
    <div ref={statsContentRef} className="flex items-stretch justify-center">

      {/* Countries hero */}
      <div className="atlas-stat-hero flex items-baseline gap-1.5 px-4 py-3 mx-2 my-2 rounded-xl">
        <span className="text-4xl font-black tabular-nums leading-none" style={{ color: tp }}>{stats.totalCountries}</span>
        <span className="text-sm font-medium" style={{ color: tm }}>{t('atlas.countries')}</span>
      </div>
      {/* Other stats */}
      {[[stats.totalTrips, t('atlas.trips')], [stats.totalPlaces, t('atlas.places')], [stats.totalCities || 0, t('atlas.cities')], [stats.totalDays, t('atlas.days')]].map(([v, l], i) => (
        <div key={i} className="flex flex-col items-center justify-center px-3 py-3.5 shrink-0">
          <span className="text-xl font-black tabular-nums leading-none" style={{ color: tp }}>{v}</span>
          <span className="text-[10px] font-semibold mt-1 uppercase tracking-wide whitespace-nowrap" style={{ color: tf }}>{l}</span>
        </div>
      ))}

      {/* ═══ DIVIDER ═══ */}
      <div className="atlas-divider" />

      {/* ═══ SECTION 2: Continents ═══ */}
      <div className="flex items-center gap-3.5 px-3 py-3.5 shrink-0">
        {['Europe', 'Asia', 'North America', 'South America', 'Africa', 'Oceania'].map((cont) => {
          const count = continents?.[cont] || 0
          const active = count > 0
          return (
            <div key={cont} className="flex flex-col items-center shrink-0">
              <span className="text-xl font-black tabular-nums leading-none" style={{ color: active ? tp : (dark ? 'rgba(148,163,184,0.35)' : 'rgba(100,116,139,0.35)') }}>{count}</span>
              <span className="text-[10px] font-semibold mt-1 uppercase tracking-wide whitespace-nowrap" style={{ color: active ? tf : (dark ? 'rgba(148,163,184,0.4)' : 'rgba(100,116,139,0.4)') }}>{CL[cont]}</span>
            </div>
          )
        })}
      </div>

      {/* ═══ DIVIDER ═══ */}
      <div className="atlas-divider" />

      {/* ═══ SECTION 3: Highlights & Streaks ═══ */}
      <div className="flex items-center gap-4 px-3 py-3.5">
        {/* Last trip */}
        {lastTrip && (
          <button onClick={() => onTripClick(lastTrip.id)} className="flex items-center gap-2.5 text-left transition-opacity hover:opacity-75">
            <div className="atlas-stat-hero w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0">
              {lastTrip.countryCode ? countryCodeToFlag(lastTrip.countryCode) : <MapPin size={16} style={{ color: tm }} />}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: tf }}>{t('atlas.lastTrip')}</p>
              <p className="text-[13px] font-bold truncate" style={{ color: tp }}>{lastTrip.title}</p>
            </div>
          </button>
        )}
        {/* Streak */}
        {streak > 0 && (
          <div className="flex flex-col items-center justify-center px-2.5">
            <span className="text-xl font-black tabular-nums leading-none" style={{ color: tp }}>{streak}</span>
            <span className="text-[10px] font-semibold mt-1 uppercase tracking-wide text-center leading-tight whitespace-nowrap" style={{ color: tf }}>
              {streak === 1 ? t('atlas.yearInRow') : t('atlas.yearsInRow')}
            </span>
          </div>
        )}
        {/* This year */}
        {tripsThisYear > 0 && (
          <div className="flex flex-col items-center justify-center px-2.5">
            <span className="text-xl font-black tabular-nums leading-none" style={{ color: tp }}>{tripsThisYear}</span>
            <span className="text-[10px] font-semibold mt-1 uppercase tracking-wide text-center leading-tight whitespace-nowrap" style={{ color: tf }}>
              {tripsThisYear === 1 ? t('atlas.tripIn') : t('atlas.tripsIn')} {thisYear}
            </span>
          </div>
        )}
      </div>

      {visitHeatmap.length > 1 ? (
        <div style={{ padding: '8px 16px 12px' }}>
          <p style={{ color: tf, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px' }}>{t('atlas.visitHeatmap')}</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 48 }}>
            {visitHeatmap.slice(-8).map(row => {
              const max = Math.max(...visitHeatmap.map(r => r.trips), 1)
              const h = Math.max(6, Math.round((row.trips / max) * 40))
              return (
                <div key={row.year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: '100%', height: h, borderRadius: 4, background: 'linear-gradient(180deg, #818cf8, #6366f1)' }} title={`${row.trips} trips`} />
                  <span style={{ fontSize: 9, color: tf }}>{row.year.slice(-2)}</span>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* ═══ Country detail overlay ═══ */}
      {selectedCountry && countryDetail && (
        <>
          <div className="atlas-divider" />
          <div className="flex items-center gap-3 px-5 py-3.5">
            <span className="text-3xl">{countryCodeToFlag(selectedCountry)}</span>
            <div>
              <p className="text-sm font-bold" style={{ color: tp }}>{resolveName(selectedCountry)}</p>
              <p className="text-[11px] mb-1" style={{ color: tf }}>{countryDetail.places.length} {t('atlas.places')} · {countryDetail.trips.length} Trips</p>
              <div className="flex flex-wrap gap-1">
                {countryDetail.trips.slice(0, 3).map(trip => (
                  <button key={trip.id} onClick={() => onTripClick(trip.id)}
                    className="atlas-stat-hero flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-opacity hover:opacity-75"
                    style={{ color: tp }}>
                    <Briefcase size={9} style={{ color: tm }} />
                    {trip.title}
                  </button>
                ))}
                {countryDetail.manually_marked && onUnmarkCountry && (
                  <button onClick={() => onUnmarkCountry(selectedCountry!)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-opacity hover:opacity-75 bg-[rgba(239,68,68,0.1)] text-[#ef4444]">
                    <X size={9} />
                    {t('atlas.unmark')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
    </div>
    <div style={bucketTab === 'bucket' ? { gridArea: '1/1' } : { visibility: 'hidden' as const, gridArea: '1/1' }}>
      {bucketContent}
    </div>
    <div style={bucketTab === 'wonders' ? { gridArea: '1/1' } : { visibility: 'hidden' as const, gridArea: '1/1', maxHeight: 0, overflow: 'hidden' }}>
      {wondersContent}
    </div>
    </div>
    </>
  )
}
