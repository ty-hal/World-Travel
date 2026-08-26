import type { SVGProps } from 'react'
import type { AnimatedIconMotion } from './animatedIconTypes'

export type AnimatedCalendarDaysIconProps = SVGProps<SVGSVGElement> & {
  size?: number
  animate?: AnimatedIconMotion
}

// Adapted from pqoqubbw/icons (MIT):
// https://github.com/pqoqubbw/icons/blob/main/icons/calendar-days.tsx
export default function AnimatedCalendarDaysIcon({
  size = 16,
  animate = 'hover',
  className,
  ...props
}: AnimatedCalendarDaysIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      className={`trek-animated-calendar trek-icon-motion trek-icon-motion--${animate}${className ? ` ${className}` : ''}`}
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
      <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <g className="trek-animated-calendar__days">
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
      </g>
    </svg>
  )
}
