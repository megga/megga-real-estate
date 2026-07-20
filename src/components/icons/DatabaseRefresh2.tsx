// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DatabaseRefresh2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.4562 9.0308C15.5029 9.0308 18.7834 7.70743 18.7834 6.07497C18.7834 4.44251 15.5029 3.11914 11.4562 3.11914C7.40944 3.11914 4.12891 4.44251 4.12891 6.07497C4.12891 7.70743 7.40944 9.0308 11.4562 9.0308Z" stroke="currentColor"></path>
<path d="M4.12891 11.9062V17.7677C4.12891 17.7677 4.12891 20.3762 10.3324 20.6687" stroke="currentColor"></path>
<path d="M18.7828 10.9337V6.04883" stroke="currentColor"></path>
<path d="M10.3324 14.8093C4.12891 14.5168 4.12891 11.9083 4.12891 11.9083V6.04688" stroke="currentColor"></path>
<path d="M15.8252 19.0645H13.8711V20.8818" stroke="currentColor"></path>
<path d="M19.8711 14.2852V16.2393H17.918" stroke="currentColor"></path>
<path d="M13.9414 16.0835C14.4887 15.1258 15.5148 14.4902 16.6966 14.4902C18.8164 14.4902 19.8713 16.2491 19.8713 16.2491" stroke="currentColor"></path>
<path d="M19.4401 19.2478C18.8928 20.1956 17.8666 20.8301 16.6947 20.8301C14.9458 20.8301 13.8711 19.0723 13.8711 19.0723" stroke="currentColor"></path>
    </svg>
  ),
)

DatabaseRefresh2.displayName = 'DatabaseRefresh2'

export default DatabaseRefresh2
