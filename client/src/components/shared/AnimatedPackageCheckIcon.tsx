import type { SVGProps } from 'react'
import type { AnimatedIconMotion } from './animatedIconTypes'

export type AnimatedPackageCheckIconProps = SVGProps<SVGSVGElement> & {
  size?: number
  animate?: AnimatedIconMotion
}

// Adapted from Lucide + pqoqubbw/icons-inspired CSS motion (MIT):
// https://lucide.dev/icons/package-check
export default function AnimatedPackageCheckIcon({
  size = 18,
  animate = 'hover',
  className,
  ...props
}: AnimatedPackageCheckIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      className={`trek-animated-package-check trek-icon-motion trek-icon-motion--${animate}${className ? ` ${className}` : ''}`}
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
      <path className="trek-animated-package__body" d="m16 16 2 2 4-4" />
      <path className="trek-animated-package__body" d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14" />
      <path className="trek-animated-package__check" d="m7.5 4.27 9 5.15" />
      <polyline className="trek-animated-package__body" points="3.29 7 12 12 20.71 7" />
      <line className="trek-animated-package__body" x1="12" x2="12" y1="22" y2="12" />
    </svg>
  )
}
