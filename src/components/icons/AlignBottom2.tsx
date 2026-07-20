// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const AlignBottom2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M5.198 21H7.802C9.016 21 10 20.016 10 18.802V5.198C10 3.984 9.016 3 7.802 3H5.198C3.984 3 3 3.984 3 5.198V18.802C3 20.016 3.984 21 5.198 21Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.198 21H18.802C20.016 21 21 20.016 21 18.802V12.198C21 10.984 20.016 10 18.802 10H16.198C14.984 10 14 10.984 14 12.198V18.802C14 20.016 14.984 21 16.198 21Z" stroke="currentColor"></path>
    </svg>
  ),
)

AlignBottom2.displayName = 'AlignBottom2'

export default AlignBottom2
