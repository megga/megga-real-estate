// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowLeftCircle5 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.91418 12.0001L16.0862 12.0001" stroke="currentColor"></path>
<path d="M11.6782 15.7521C11.6782 15.7521 7.91422 13.2241 7.91422 12.0001C7.91422 10.7761 11.6782 8.25208 11.6782 8.25208" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12 2.75012C5.063 2.75012 2.75 5.06312 2.75 12.0001C2.75 18.9371 5.063 21.2501 12 21.2501C18.937 21.2501 21.25 18.9371 21.25 12.0001C21.25 5.06312 18.937 2.75012 12 2.75012Z" stroke="currentColor"></path>
    </svg>
  ),
)

ArrowLeftCircle5.displayName = 'ArrowLeftCircle5'

export default ArrowLeftCircle5
