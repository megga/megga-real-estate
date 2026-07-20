// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const EyeScan = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M11.9999 16.8055C14.1823 16.8055 16.1788 15.2365 17.3026 12.6215C16.1788 10.0065 14.1823 8.4375 11.9999 8.4375C9.81952 8.4375 7.82292 10.0065 6.69922 12.6215C7.82292 15.2375 9.81951 16.8055 12.0019 16.8055H11.9999Z" stroke="currentColor"></path>
<path d="M3 16.1523V17.7293C3 19.8793 4.74261 21.6213 6.89291 21.6213H8.15" stroke="currentColor"></path>
<path d="M21.0004 16.1523V17.7293C21.0004 19.8793 19.2579 21.6213 17.1076 21.6213H15.8184" stroke="currentColor"></path>
<path d="M20.9996 9.09106V7.51312C20.9996 5.36412 19.257 3.62109 17.1067 3.62109H15.8496" stroke="currentColor"></path>
<path d="M3 9.09106V7.51312C3 5.36412 4.74261 3.62109 6.89291 3.62109H8.18211" stroke="currentColor"></path>
<path d="M11.9995 12.6451V12.5821V12.6451ZM11.7402 12.6321C11.7402 12.4881 11.857 12.3711 12.0011 12.3711C12.1451 12.3711 12.2618 12.4881 12.2618 12.6321C12.2618 12.7761 12.1451 12.8931 12.0011 12.8931C11.857 12.8931 11.7402 12.7761 11.7402 12.6321Z" stroke="currentColor"></path>
    </svg>
  ),
)

EyeScan.displayName = 'EyeScan'

export default EyeScan
