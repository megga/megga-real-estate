// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowLeftCircle3 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M12.25 2.75C7.142 2.75 3 6.891 3 12C3 17.108 7.142 21.25 12.25 21.25C17.358 21.25 21.5 17.108 21.5 12C21.5 6.891 17.358 2.75 12.25 2.75Z" stroke="currentColor"></path>
<path d="M13.6924 8.52881L10.2064 11.9998L13.6924 15.4708" stroke="currentColor"></path>
    </svg>
  ),
)

ArrowLeftCircle3.displayName = 'ArrowLeftCircle3'

export default ArrowLeftCircle3
