import type { SVGProps } from 'react'
import type { AnimatedIconMotion } from './animatedIconTypes'

export type AnimatedImagesIconProps = SVGProps<SVGSVGElement> & {
  size?: number
  animate?: AnimatedIconMotion
}

// Adapted from Lucide + pqoqubbw/icons-inspired CSS motion (MIT):
// https://lucide.dev/icons/images
export default function AnimatedImagesIcon({
  size = 18,
  animate = 'hover',
  className,
  ...props
}: AnimatedImagesIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      className={`trek-animated-images trek-icon-motion trek-icon-motion--${animate}${className ? ` ${className}` : ''}`}
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
      <path className="trek-animated-images__back" d="M18 22H4a2 2 0 0 1-2-2V6" />
      <path className="trek-animated-images__front" d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18" />
      <circle cx="12" cy="8" r="2" />
      <rect width="16" height="16" x="6" y="2" rx="2" />
    </svg>
  )
}
