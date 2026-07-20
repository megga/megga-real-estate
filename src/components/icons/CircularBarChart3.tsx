// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CircularBarChart3 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M3.5 13.7933C3.5 17.7698 6.72355 20.9933 10.7 20.9933C11.5098 20.9933 12.2884 20.8596 13.0149 20.6131C13.2502 20.5333 13.3595 20.269 13.2651 20.0392L10.7337 13.8754C10.7115 13.8212 10.7 13.7631 10.7 13.7045V7.04332C10.7 6.79479 10.498 6.59186 10.2499 6.60716C6.48313 6.83949 3.5 9.96803 3.5 13.7933Z" stroke="currentColor"></path>
<path d="M17.5409 18.7921L15.3869 13.9718C15.2843 13.7421 15.3899 13.4729 15.6214 13.3742L20.5678 11.267C20.7941 11.1706 21.0576 11.2733 21.1407 11.5049C21.3704 12.1454 21.5001 12.8421 21.5001 13.5537C21.5001 15.9384 20.1466 17.9908 18.1192 19.0097C17.9009 19.1194 17.6405 19.0152 17.5409 18.7921Z" stroke="currentColor"></path>
<path d="M14.2998 3.44327V9.49277C14.2998 9.82047 14.6389 10.0383 14.9369 9.90203L20.2055 7.49355C20.4256 7.39292 20.5279 7.13535 20.4225 6.91751C19.3534 4.70973 17.235 3.17457 14.7497 3.00827C14.5017 2.99168 14.2998 3.19475 14.2998 3.44327Z" stroke="currentColor"></path>
    </svg>
  ),
)

CircularBarChart3.displayName = 'CircularBarChart3'

export default CircularBarChart3
