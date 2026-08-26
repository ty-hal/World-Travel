import type { SVGProps } from 'react'

export type AnimatedIconMotion = 'hover' | 'always'

export type AnimatedTrainTrackIconProps = SVGProps<SVGSVGElement> & {
  size?: number
  /** hover = animate on parent/self hover; always = continuous */
  animate?: AnimatedIconMotion
}

// Adapted from Lucide + pqoqubbw/icons motion (MIT):
// https://github.com/pqoqubbw/icons/blob/main/icons/train-track.tsx
export default function AnimatedTrainTrackIcon({
  size = 18,
  animate = 'hover',
  className,
  ...props
}: AnimatedTrainTrackIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      className={`trek-animated-train-track trek-icon-motion trek-icon-motion--${animate}${className ? ` ${className}` : ''}`}
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
      <path className="trek-animated-train-track__rail" d="M2 17 17 2" />
      <path className="trek-animated-train-track__tie" style={{ animationDelay: '0.05s' }} d="m2 14 8 8" />
      <path className="trek-animated-train-track__tie" style={{ animationDelay: '0.1s' }} d="m5 11 8 8" />
      <path className="trek-animated-train-track__tie" style={{ animationDelay: '0.15000000000000002s' }} d="m8 8 8 8" />
      <path className="trek-animated-train-track__tie" style={{ animationDelay: '0.2s' }} d="m11 5 8 8" />
      <path className="trek-animated-train-track__tie" style={{ animationDelay: '0.25s' }} d="m14 2 8 8" />
      <path className="trek-animated-train-track__rail" d="M7 22 22 7" />
    </svg>
  )
}
