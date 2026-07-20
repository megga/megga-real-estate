// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Login2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M16.1849 12.0003L3.40717 12.0003" stroke="currentColor"></path>
<path d="M13.6454 15.2749L16.935 11.9999L13.6454 8.72385" stroke="currentColor"></path>
<path d="M9.664 7.375L9.664 2.75L21.0928 2.75L21.0928 21.25L9.664 21.25L9.664 16.625" stroke="currentColor"></path>
    </svg>
  ),
)

Login2.displayName = 'Login2'

export default Login2
