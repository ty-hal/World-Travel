import type { SVGProps } from 'react'

export type AnimatedIconMotion = 'hover' | 'always'

export type AnimatedWalletIconProps = SVGProps<SVGSVGElement> & {
  size?: number
  /** hover = animate on parent/self hover; always = continuous */
  animate?: AnimatedIconMotion
}

// Adapted from Lucide + pqoqubbw/icons motion (MIT):
// https://github.com/pqoqubbw/icons/blob/main/icons/wallet.tsx
export default function AnimatedWalletIcon({
  size = 18,
  animate = 'hover',
  className,
  ...props
}: AnimatedWalletIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      className={`trek-animated-wallet trek-icon-motion trek-icon-motion--${animate}${className ? ` ${className}` : ''}`}
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
      <path className="trek-animated-wallet__body" d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path className="trek-animated-wallet__body" d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path className="trek-animated-wallet__clasp" d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  )
}
