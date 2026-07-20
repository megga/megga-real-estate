// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const InfoSquare2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M2.74976 12.0001C2.74976 5.06312 5.06276 2.75012 11.9998 2.75012C18.9368 2.75012 21.2498 5.06312 21.2498 12.0001C21.2498 18.9371 18.9368 21.2501 11.9998 21.2501C5.06276 21.2501 2.74976 18.9371 2.74976 12.0001Z" stroke="currentColor"></path>
<path d="M11.9998 8.10498V12" stroke="currentColor"></path>
<path d="M11.9955 15.5H12.0045" stroke="currentColor"></path>
    </svg>
  ),
)

InfoSquare2.displayName = 'InfoSquare2'

export default InfoSquare2
