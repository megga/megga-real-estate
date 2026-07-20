// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Key5 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M10.814 12.283C10.814 14.441 9.064 16.189 6.908 16.189C4.75 16.189 3 14.441 3 12.283C3 10.125 4.75 8.37695 6.908 8.37695C9.064 8.37695 10.814 10.125 10.814 12.283Z" stroke="currentColor"></path>
<path d="M10.8145 12.2832H21.0005" stroke="currentColor"></path>
<path d="M15.5586 12.2832V15.9502H19.4036V12.2832" stroke="currentColor"></path>
    </svg>
  ),
)

Key5.displayName = 'Key5'

export default Key5
