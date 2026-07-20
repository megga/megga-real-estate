// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const HomeElectricity = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M17.2159 21H6.78462C4.94959 21 3.46289 19.5123 3.46289 17.6783V10.5045C3.46289 9.6133 3.86376 8.76973 4.55457 8.20638L10.1287 3.66551C11.2185 2.77816 12.782 2.77816 13.8718 3.66551L19.4459 8.20638C20.1367 8.76973 20.5376 9.6133 20.5376 10.5045V17.6783C20.5376 19.5123 19.0509 21 17.2159 21Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.6916 9.03876L8.71606 13.1373C8.50374 13.4296 8.71261 13.8391 9.07368 13.8391H11.5078V16.4125C11.5078 16.8406 12.0566 17.0192 12.3082 16.672L15.2838 12.5739C15.4961 12.2815 15.2872 11.8716 14.9262 11.8716H12.4916V9.29865C12.4916 8.87011 11.9433 8.69195 11.6916 9.03876Z" stroke="currentColor"></path>
    </svg>
  ),
)

HomeElectricity.displayName = 'HomeElectricity'

export default HomeElectricity
