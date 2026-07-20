// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Filter3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.1437 17.8828H4.67114" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.205 17.8837C15.205 19.9254 15.8859 20.6054 17.9267 20.6054C19.9676 20.6054 20.6485 19.9254 20.6485 17.8837C20.6485 15.8419 19.9676 15.1619 17.9267 15.1619C15.8859 15.1619 15.205 15.8419 15.205 17.8837Z" stroke="currentColor"></path>
<path d="M14.1765 7.39415H20.6481" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M10.1153 7.39281C10.1153 5.35192 9.43436 4.67102 7.39346 4.67102C5.35167 4.67102 4.67078 5.35192 4.67078 7.39281C4.67078 9.4346 5.35167 10.1146 7.39346 10.1146C9.43436 10.1146 10.1153 9.4346 10.1153 7.39281Z" stroke="currentColor"></path>
    </svg>
  ),
)

Filter3.displayName = 'Filter3'

export default Filter3
