import type { SVGProps } from 'react'
import type { AnimatedIconMotion } from './animatedIconTypes'

export type AnimatedBikeIconProps = SVGProps<SVGSVGElement> & {
  size?: number
  animate?: AnimatedIconMotion
}

// Adapted from Lucide + pqoqubbw/icons-inspired CSS motion (MIT):
// https://lucide.dev/icons/bike
export default function AnimatedBikeIcon({
  size = 18,
  animate = 'hover',
  className,
  ...props
}: AnimatedBikeIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      className={`trek-animated-bike trek-icon-motion trek-icon-motion--${animate}${className ? ` ${className}` : ''}`}
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
      <circle className="trek-animated-bike__wheel" cx="18.5" cy="17.5" r="3.5" />
      <circle className="trek-animated-bike__wheel" cx="5.5" cy="17.5" r="3.5" />
      <circle className="trek-animated-bike__frame" cx="15" cy="5" r="1" />
      <path className="trek-animated-bike__frame" d="M12 17.5V14l-3-3 4-3 2 3h2" />
    </svg>
  )
}
