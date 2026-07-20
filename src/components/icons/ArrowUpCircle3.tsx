// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowUpCircle3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M21.2498 11.9999C21.2498 5.06288 18.9368 2.74988 11.9998 2.74988C5.06276 2.74988 2.74976 5.06288 2.74976 11.9999C2.74976 18.9369 5.06276 21.2499 11.9998 21.2499C18.9368 21.2499 21.2498 18.9369 21.2498 11.9999Z" stroke="currentColor"></path>
<path d="M15.4714 13.4418C15.4714 13.4418 13.0794 9.95577 11.9994 9.95577C10.9194 9.95577 8.52944 13.4418 8.52944 13.4418" stroke="currentColor"></path>
    </svg>
  ),
)

ArrowUpCircle3.displayName = 'ArrowUpCircle3'

export default ArrowUpCircle3
