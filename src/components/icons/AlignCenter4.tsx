// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const AlignCenter4 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M5.198 21H7.802C9.016 21 10 20.016 10 18.802V5.198C10 3.984 9.016 3 7.802 3H5.198C3.984 3 3 3.984 3 5.198V18.802C3 20.016 3.984 21 5.198 21Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.198 17.5H18.802C20.016 17.5 21 16.516 21 15.302V8.698C21 7.484 20.016 6.5 18.802 6.5H16.198C14.984 6.5 14 7.484 14 8.698V15.302C14 16.516 14.984 17.5 16.198 17.5Z" stroke="currentColor"></path>
    </svg>
  ),
)

AlignCenter4.displayName = 'AlignCenter4'

export default AlignCenter4
