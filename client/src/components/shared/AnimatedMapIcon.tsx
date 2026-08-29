import type { SVGProps } from 'react'
import type { AnimatedIconMotion } from './animatedIconTypes'

export type AnimatedMapIconProps = SVGProps<SVGSVGElement> & {
  size?: number
  animate?: AnimatedIconMotion
}

// Adapted from Lucide + pqoqubbw/icons-inspired CSS motion (MIT):
// https://lucide.dev/icons/map
export default function AnimatedMapIcon({
  size = 18,
  animate = 'hover',
  className,
  ...props
}: AnimatedMapIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      className={`trek-animated-map trek-icon-motion trek-icon-motion--${animate}${className ? ` ${className}` : ''}`}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={props.strokeWidth ?? 2}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <polygon className="trek-animated-map__body" points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line className="trek-animated-map__body" x1="9" x2="9" y1="3" y2="18" />
      <line className="trek-animated-map__body" x1="15" x2="15" y1="6" y2="21" />
    </svg>
  )
}
