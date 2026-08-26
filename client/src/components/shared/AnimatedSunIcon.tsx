import type { SVGProps } from 'react'

export type AnimatedIconMotion = 'hover' | 'always'

export type AnimatedSunIconProps = SVGProps<SVGSVGElement> & {
  size?: number
  /** hover = animate on parent/self hover; always = continuous */
  animate?: AnimatedIconMotion
}

// Adapted from Lucide + pqoqubbw/icons motion (MIT):
// https://github.com/pqoqubbw/icons/blob/main/icons/sun.tsx
export default function AnimatedSunIcon({
  size = 18,
  animate = 'hover',
  className,
  ...props
}: AnimatedSunIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      className={`trek-animated-sun trek-icon-motion trek-icon-motion--${animate}${className ? ` ${className}` : ''}`}
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
      <circle className="trek-animated-sun__core" cx="12" cy="12" r="4" />
      <path className="trek-animated-sun__ray" style={{ animationDelay: '0.0s' }} d="M12 2v2" />
      <path className="trek-animated-sun__ray" style={{ animationDelay: '0.05s' }} d="M12 20v2" />
      <path className="trek-animated-sun__ray" style={{ animationDelay: '0.1s' }} d="m4.93 4.93 1.41 1.41" />
      <path className="trek-animated-sun__ray" style={{ animationDelay: '0.15000000000000002s' }} d="m17.66 17.66 1.41 1.41" />
      <path className="trek-animated-sun__ray" style={{ animationDelay: '0.2s' }} d="M2 12h2" />
      <path className="trek-animated-sun__ray" style={{ animationDelay: '0.25s' }} d="M20 12h2" />
      <path className="trek-animated-sun__ray" style={{ animationDelay: '0.30000000000000004s' }} d="m6.34 17.66-1.41 1.41" />
      <path className="trek-animated-sun__ray" style={{ animationDelay: '0.35000000000000003s' }} d="m19.07 4.93-1.41 1.41" />
    </svg>
  )
}
