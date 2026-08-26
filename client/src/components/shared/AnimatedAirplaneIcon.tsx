import type { SVGProps } from 'react';

// Adapted from pqoqubbw/icons (MIT):
// https://github.com/pqoqubbw/icons/blob/main/icons/airplane.tsx
const SPEED_LINES = [
  { x1: 5, y1: 15, x2: 1, y2: 19, delay: '0s' },
  { x1: 7, y1: 17, x2: 3, y2: 21, delay: '0.1s' },
  { x1: 9, y1: 19, x2: 5, y2: 23, delay: '0.2s' },
];

export default function AnimatedAirplaneIcon({ size = 18, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      className={`trek-animated-airplane ${props.className ?? ''}`.trim()}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        className="trek-animated-airplane__body"
        d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
      />
      {SPEED_LINES.map((line) => (
        <line
          key={line.delay}
          className="trek-animated-airplane__trail"
          style={{ animationDelay: line.delay }}
          x1={line.x1}
          x2={line.x2}
          y1={line.y1}
          y2={line.y2}
        />
      ))}
    </svg>
  );
}
