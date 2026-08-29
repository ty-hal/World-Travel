import React from 'react'
import { X, ChevronRight } from 'lucide-react'
import AnimatedSearchIcon from '../../components/shared/AnimatedSearchIcon'
import type { TranslationFn } from '../../types'

type CountryOption = { code: string; label: string }

interface AtlasCountrySearchProps {
  dark: boolean
  t: TranslationFn
  search: string
  setSearch: (v: string) => void
  results: CountryOption[]
  setResults: (v: CountryOption[]) => void
  open: boolean
  setOpen: (v: boolean) => void
  options: CountryOption[]
  onSelect: (code: string) => void
}

// The floating country search box that overlays the globe (search input + results
// dropdown). Solid elevated chrome — map tiles must not bleed through labels.
export default function AtlasCountrySearch({
  dark, t, search, setSearch, results, setResults, open, setOpen, options, onSelect,
}: AtlasCountrySearchProps): React.ReactElement {
  return (
    <div
      className="absolute z-20 flex justify-center"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 14px)', left: 0, right: 0, pointerEvents: 'none' }}
    >
      <div style={{ width: 'min(520px, calc(100vw - 28px))', pointerEvents: 'auto' }}>
        <div className="atlas-chrome" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 14,
        }}>
          <AnimatedSearchIcon size={16} className="text-content-muted" style={{ flexShrink: 0 }} />
          <input
            value={search}
            onChange={(e) => {
              const raw = e.target.value
              setSearch(raw)
              const q = raw.trim().toLowerCase()
              if (!q) {
                setResults([])
                setOpen(false)
                return
              }
              const next = options
                .filter(o => o.label.toLowerCase().includes(q) || o.code.toLowerCase() === q)
                .slice(0, 8)
              setResults(next)
              setOpen(true)
            }}
            onFocus={() => {
              if (results.length > 0) setOpen(true)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false)
                return
              }
              if (e.key === 'Enter') {
                const first = results[0]
                if (first) onSelect(first.code)
              }
            }}
            placeholder={t('atlas.searchCountry')}
            autoComplete="off"
            spellCheck={false}
            className="text-content"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 'calc(13px * var(--fs-scale-body, 1))',
              fontFamily: 'inherit',
            }}
          />
          {search.trim() && (
            <button
              onClick={() => {
                setSearch('')
                setResults([])
                setOpen(false)
              }}
              className="text-content-muted"
              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
              aria-label="Clear"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {open && results.length > 0 && (
          <div
            className="atlas-chrome"
            style={{
              marginTop: 8,
              borderRadius: 14,
              overflow: 'hidden',
            }}
            onMouseLeave={() => setOpen(false)}
          >
            {results.map((r) => (
              <button
                key={r.code}
                onClick={() => onSelect(r.code)}
                className="atlas-search-row"
                style={{
                  width: '100%',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <img src={`https://flagcdn.com/w40/${r.code.toLowerCase()}.png`} alt={r.code} style={{ width: 28, height: 20, borderRadius: 4, objectFit: 'cover' }} />
                  <span className="text-content" style={{ fontSize: 'calc(13px * var(--fs-scale-body, 1))', fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.label}
                  </span>
                </span>
                <ChevronRight size={16} className="text-content-muted" style={{ flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
