import type { SVGProps } from 'react'

export type AnimatedIconMotion = 'hover' | 'always'

export type AnimatedCompassIconProps = SVGProps<SVGSVGElement> & {
  size?: number
  /** hover = animate on parent/self hover; always = continuous */
  animate?: AnimatedIconMotion
}

// Adapted from Lucide + pqoqubbw/icons motion (MIT):
// https://github.com/pqoqubbw/icons/blob/main/icons/compass.tsx
export default function AnimatedCompassIcon({
  size = 18,
  animate = 'hover',
  className,
  ...props
}: AnimatedCompassIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      className={`trek-animated-compass trek-icon-motion trek-icon-motion--${animate}${className ? ` ${className}` : ''}`}
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
      <circle cx="12" cy="12" r="10" />
      <polygon className="trek-animated-compass__needle" points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  )
}
