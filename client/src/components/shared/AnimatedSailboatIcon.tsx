import type { SVGProps } from 'react'
import type { AnimatedIconMotion } from './animatedIconTypes'

export type AnimatedSailboatIconProps = SVGProps<SVGSVGElement> & {
  size?: number
  animate?: AnimatedIconMotion
}

// Adapted from Lucide + pqoqubbw/icons-inspired CSS motion (MIT):
// https://lucide.dev/icons/sailboat
export default function AnimatedSailboatIcon({
  size = 18,
  animate = 'hover',
  className,
  ...props
}: AnimatedSailboatIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      className={`trek-animated-sailboat trek-icon-motion trek-icon-motion--${animate}${className ? ` ${className}` : ''}`}
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
      <g className="trek-animated-sailboat__body">
      <path d="M22 18H2a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4Z" />
      <path d="M21 14 10 2 3 14h18Z" />
      <path d="M10 2v16" />
      </g>
    </svg>
  )
}
