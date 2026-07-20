// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowRightCircle3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12 21.2498C18.937 21.2498 21.25 18.9368 21.25 11.9998C21.25 5.06276 18.937 2.74976 12 2.74976C5.063 2.74976 2.75 5.06276 2.75 11.9998C2.75 18.9368 5.063 21.2498 12 21.2498Z" stroke="currentColor"></path>
<path d="M10.5581 15.4714C10.5581 15.4714 14.0441 13.0794 14.0441 11.9994C14.0441 10.9194 10.5581 8.52944 10.5581 8.52944" stroke="currentColor"></path>
    </svg>
  ),
)

ArrowRightCircle3.displayName = 'ArrowRightCircle3'

export default ArrowRightCircle3
