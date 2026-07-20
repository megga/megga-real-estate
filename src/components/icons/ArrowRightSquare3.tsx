// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowRightSquare3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.0858 11.9999H7.91382" stroke="currentColor"></path>
<path d="M12.3218 8.24792C12.3218 8.24792 16.0858 10.7759 16.0858 11.9999C16.0858 13.2239 12.3218 15.7479 12.3218 15.7479" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12 21.2499C18.937 21.2499 21.25 18.9369 21.25 11.9999C21.25 5.06288 18.937 2.74988 12 2.74988C5.063 2.74988 2.75 5.06288 2.75 11.9999C2.75 18.9369 5.063 21.2499 12 21.2499Z" stroke="currentColor"></path>
    </svg>
  ),
)

ArrowRightSquare3.displayName = 'ArrowRightSquare3'

export default ArrowRightSquare3
