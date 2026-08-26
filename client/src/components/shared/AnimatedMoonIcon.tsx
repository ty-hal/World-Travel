import type { SVGProps } from 'react'

export type AnimatedIconMotion = 'hover' | 'always'

export type AnimatedMoonIconProps = SVGProps<SVGSVGElement> & {
  size?: number
  /** hover = animate on parent/self hover; always = continuous */
  animate?: AnimatedIconMotion
}

// Adapted from Lucide + pqoqubbw/icons motion (MIT):
// https://github.com/pqoqubbw/icons/blob/main/icons/moon.tsx
export default function AnimatedMoonIcon({
  size = 18,
  animate = 'hover',
  className,
  ...props
}: AnimatedMoonIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      className={`trek-animated-moon trek-icon-motion trek-icon-motion--${animate}${className ? ` ${className}` : ''}`}
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
      <path className="trek-animated-moon__body" d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}
