import type { SVGProps } from 'react'

export type AnimatedIconMotion = 'hover' | 'always'

export type AnimatedMapPinPlusIconProps = SVGProps<SVGSVGElement> & {
  size?: number
  /** hover = animate on parent/self hover; always = continuous */
  animate?: AnimatedIconMotion
}

// Adapted from Lucide + pqoqubbw/icons motion (MIT):
// https://github.com/pqoqubbw/icons/blob/main/icons/map-pin-plus.tsx
export default function AnimatedMapPinPlusIcon({
  size = 18,
  animate = 'hover',
  className,
  ...props
}: AnimatedMapPinPlusIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      className={`trek-animated-map-pin trek-icon-motion trek-icon-motion--${animate}${className ? ` ${className}` : ''}`}
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
      <path className="trek-animated-map-pin__body" d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle className="trek-animated-map-pin__dot" cx="12" cy="10" r="3" />
      <path className="trek-animated-map-pin__plus" d="M16 18h6" />
      <path className="trek-animated-map-pin__plus" d="M19 15v6" />
    </svg>
  )
}
