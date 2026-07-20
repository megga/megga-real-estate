// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CardLock = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 11.46V8.16599C21 5.72399 19.48 4 17.035 4H6.965C4.528 4 3 5.72399 3 8.16599V14.753C3 17.195 4.521 18.921 6.965 18.921H9.907" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M18.9596 20.5675H15.7666C14.8906 20.5675 14.1816 19.8585 14.1816 18.9825V17.1905C14.1816 16.3155 14.8906 15.6055 15.7666 15.6055H18.9596C19.8356 15.6055 20.5446 16.3155 20.5446 17.1905V18.9825C20.5446 19.8585 19.8356 20.5675 18.9596 20.5675Z" stroke="currentColor"></path>
<path d="M19.269 15.6363V14.4574C19.257 13.4044 18.392 12.5614 17.339 12.5744C16.309 12.5874 15.475 13.4174 15.457 14.4484V15.6363" stroke="currentColor"></path>
<path d="M3 9.29688H21" stroke="currentColor"></path>
    </svg>
  ),
)

CardLock.displayName = 'CardLock'

export default CardLock
