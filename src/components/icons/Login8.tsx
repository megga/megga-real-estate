// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Login8 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16 11.9995L4 11.9995M16 11.9995L13.0823 9M16 11.9995L13.0823 15" stroke="currentColor"></path>
<path d="M10 8.75L10 7.5C10 5.01472 12.2386 3 15 3C17.7614 3 20 5.01472 20 7.5L20 16.5C20 18.9853 17.7614 21 15 21C12.2386 21 10 18.9853 10 16.5L10 15.25" stroke="currentColor"></path>
    </svg>
  ),
)

Login8.displayName = 'Login8'

export default Login8
