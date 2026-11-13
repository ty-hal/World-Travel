import { useEffect, useState } from 'react'
import { Compass } from 'lucide-react'

export interface CompassMap {
  getBearing: () => number
  on: (type: 'rotate', listener: () => void) => unknown
  off: (type: 'rotate', listener: () => void) => unknown
  easeTo: (options: { bearing: number; pitch: number; duration: number }) => unknown
}

/**
 * Compact compass control — resets bearing/pitch to north + flat.
 * Styled like LocationButton (circular FAB) so both sit as a pair bottom-right.
 */
export function MapCompassPill({ map }: { map: CompassMap }) {
  const [bearing, setBearing] = useState(() => map.getBearing())

  useEffect(() => {
    const update = () => setBearing(map.getBearing())
    update()
    map.on('rotate', update)
    return () => { map.off('rotate', update) }
  }, [map])

  return (
    <button
      type="button"
      onClick={() => map.easeTo({ bearing: 0, pitch: 0, duration: 300 })}
      aria-label="Reset map north"
      title="Reset map north"
      style={{
        width: 42,
        height: 42,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        background: 'var(--bg-card, white)',
        color: 'var(--text-muted, #6b7280)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        transition: 'background 0.2s, color 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card, white)' }}
    >
      <Compass size={20} strokeWidth={2} style={{ transform: `rotate(${-bearing}deg)`, transition: 'transform 0.1s linear' }} />
    </button>
  )
}
