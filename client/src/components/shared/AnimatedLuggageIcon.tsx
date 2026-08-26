import type { SVGProps } from 'react'

export type AnimatedIconMotion = 'hover' | 'always'

export type AnimatedLuggageIconProps = SVGProps<SVGSVGElement> & {
  size?: number
  /** hover = animate on parent/self hover; always = continuous */
  animate?: AnimatedIconMotion
}

// Adapted from Lucide + pqoqubbw/icons motion (MIT):
// https://lucide.dev/icons/luggage (CSS motion inspired by pqoqubbw/icons)
export default function AnimatedLuggageIcon({
  size = 18,
  animate = 'hover',
  className,
  ...props
}: AnimatedLuggageIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      className={`trek-animated-luggage trek-icon-motion trek-icon-motion--${animate}${className ? ` ${className}` : ''}`}
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
      <path className="trek-animated-luggage__body" d="M6 20h0a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h0" />
      <path className="trek-animated-luggage__body" d="M8 18V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14" />
      <path className="trek-animated-luggage__body" d="M10 20h4" />
      <circle className="trek-animated-luggage__wheel" cx="16" cy="20" r="2" />
      <circle className="trek-animated-luggage__wheel" cx="8" cy="20" r="2" />
    </svg>
  )
}
