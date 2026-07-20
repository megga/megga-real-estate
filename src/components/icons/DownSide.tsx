// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DownSide = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 16.2178V7.78313C3 4.83503 5.08119 3 8.02638 3H15.9736C18.9188 3 21 4.83503 21 7.78411V16.2178C21 19.1659 18.9188 21 15.9736 21H8.02638C5.08119 21 3 19.1572 3 16.2178Z" stroke="currentColor"></path>
<path d="M3 15.457H21" stroke="currentColor"></path>
<path d="M9.39648 8.35156L12.0002 11.1557L14.6038 8.35156" stroke="currentColor"></path>
    </svg>
  ),
)

DownSide.displayName = 'DownSide'

export default DownSide
