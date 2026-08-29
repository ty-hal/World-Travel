import type { SVGProps } from 'react'
import type { AnimatedIconMotion } from './animatedIconTypes'

export type AnimatedBusIconProps = SVGProps<SVGSVGElement> & {
  size?: number
  animate?: AnimatedIconMotion
}

// Adapted from Lucide + pqoqubbw/icons-inspired CSS motion (MIT):
// https://lucide.dev/icons/bus
export default function AnimatedBusIcon({
  size = 18,
  animate = 'hover',
  className,
  ...props
}: AnimatedBusIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      className={`trek-animated-bus trek-icon-motion trek-icon-motion--${animate}${className ? ` ${className}` : ''}`}
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
      <g className="trek-animated-bus__body">
      <path d="M8 6v6" />
      <path d="M15 6v6" />
      <path d="M2 12h19.6" />
      <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" />
      <circle cx="7" cy="18" r="2" />
      <path d="M9 18h5" />
      <circle cx="16" cy="18" r="2" />
      </g>
    </svg>
  )
}
