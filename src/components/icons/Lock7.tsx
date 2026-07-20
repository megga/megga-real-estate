// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Lock7 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path d="M21 12.9668C21 7.9958 16.9709 3.9668 12 3.9668C7.02908 3.9668 3 7.9958 3 12.9668C3 17.9378 7.02908 21.9668 12 21.9668C16.9709 21.9668 21 17.9378 21 12.9668Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.2368 13.2951C13.7515 12.9161 14.0881 12.3111 14.0881 11.6221C14.0881 10.4701 13.1551 9.53711 12.0031 9.53711C10.852 9.53711 9.91797 10.4701 9.91797 11.6221C9.91797 12.3111 10.2556 12.9161 10.7703 13.2951L10.1243 15.2381C9.93447 15.8111 10.3607 16.4011 10.963 16.4011H13.0441C13.6464 16.4011 14.0726 15.8111 13.8828 15.2381L13.2368 13.2951Z" stroke="currentColor"></path>
    </svg>
  ),
)

Lock7.displayName = 'Lock7'

export default Lock7
