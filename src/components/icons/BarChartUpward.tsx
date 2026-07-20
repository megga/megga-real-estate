// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BarChartUpward = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M4.55189 20.9998C5.40908 20.9998 6.10378 20.3051 6.10378 19.4479V16.9658C6.10378 16.1087 5.40908 15.414 4.55189 15.414C3.6947 15.414 3 16.1087 3 16.9658V19.4479C3 20.3051 3.6947 20.9998 4.55189 20.9998Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.9993 20.9997C12.8565 20.9997 13.5512 20.305 13.5512 19.4478V13.2412C13.5512 12.384 12.8565 11.6893 11.9993 11.6893C11.1421 11.6893 10.4474 12.384 10.4474 13.2412V19.4478C10.4474 20.305 11.1421 20.9997 11.9993 20.9997Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M19.4477 21C20.3049 21 20.9996 20.3053 20.9996 19.4481V4.55189C20.9996 3.6947 20.3049 3 19.4477 3C18.5905 3 17.8958 3.6947 17.8958 4.55189V19.4481C17.8958 20.3053 18.5905 21 19.4477 21Z" stroke="currentColor"></path>
<path d="M3 11.0689L11.0689 3M11.0689 3L11.069 7.3453M11.0689 3H6.72466" stroke="currentColor"></path>
    </svg>
  ),
)

BarChartUpward.displayName = 'BarChartUpward'

export default BarChartUpward
