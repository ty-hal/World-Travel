import type { SVGProps } from 'react'

export type AnimatedIconMotion = 'hover' | 'always'

export type AnimatedRouteIconProps = SVGProps<SVGSVGElement> & {
  size?: number
  /** hover = animate on parent/self hover; always = continuous */
  animate?: AnimatedIconMotion
}

// Adapted from Lucide + pqoqubbw/icons motion (MIT):
// https://github.com/pqoqubbw/icons/blob/main/icons/route.tsx
export default function AnimatedRouteIcon({
  size = 18,
  animate = 'hover',
  className,
  ...props
}: AnimatedRouteIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      className={`trek-animated-route trek-icon-motion trek-icon-motion--${animate}${className ? ` ${className}` : ''}`}
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
      <circle className="trek-animated-route__a" cx="6" cy="19" r="3" />
      <path className="trek-animated-route__path" d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle className="trek-animated-route__b" cx="18" cy="5" r="3" />
    </svg>
  )
}
