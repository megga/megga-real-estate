// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Flash2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M9.29297 7.89527L11.1446 3.3772C11.2277 3.15062 11.4434 3 11.6848 3H16.6493C17.0464 3 17.3241 3.39271 17.1918 3.76709L14.9963 8.91982C14.864 9.2942 15.1417 9.68691 15.5388 9.68691H20.2265C20.721 9.68691 20.9851 10.2695 20.6593 10.6414L11.7585 20.8009C11.3574 21.2586 10.613 20.8615 10.7698 20.2735L11.6182 17.092L12.123 15.1489" stroke="currentColor"></path>
<path d="M3.2182 13.5224L5.49065 7.97756C5.54166 7.83852 5.67401 7.74609 5.82211 7.74609H8.86852C9.11218 7.74609 9.28259 7.98707 9.2014 8.2168L7.85418 11.3787C7.77298 11.6084 7.94339 11.8494 8.18705 11.8494H11.0636C11.3671 11.8494 11.5291 12.2069 11.3292 12.4351L5.86735 18.6693C5.62125 18.9502 5.16444 18.7065 5.26066 18.3457L6.30185 14.4411C6.36161 14.217 6.19268 13.9971 5.96071 13.9971H3.54965C3.30422 13.9971 3.13367 13.7529 3.2182 13.5224Z" stroke="currentColor"></path>
    </svg>
  ),
)

Flash2.displayName = 'Flash2'

export default Flash2
