// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Target2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M19.928 12.7472C19.928 8.07219 16.138 4.2832 11.464 4.2832C6.78899 4.2832 2.99902 8.07219 2.99902 12.7472C2.99902 17.4222 6.78899 21.2112 11.464 21.2112C16.138 21.2112 19.928 17.4222 19.928 12.7472Z" stroke="currentColor"></path>
<path d="M16.0489 12.7471C16.0489 10.2141 13.9958 8.16211 11.4648 8.16211C8.93284 8.16211 6.87988 10.2141 6.87988 12.7471C6.87988 15.2781 8.93284 17.3311 11.4648 17.3311C13.9958 17.3311 16.0489 15.2781 16.0489 12.7471Z" stroke="currentColor"></path>
<path d="M18.8875 5.46552L11.7275 12.6265M21.0015 5.46552H18.8875H21.0015ZM18.8875 5.46552V3.35352V5.46552Z" stroke="currentColor"></path>
    </svg>
  ),
)

Target2.displayName = 'Target2'

export default Target2
