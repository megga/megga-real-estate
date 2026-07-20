// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Upload3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.1208 2.209V14.25" stroke="currentColor"></path>
<path d="M9.20483 5.13574L12.1208 2.20774L15.0368 5.13574" stroke="currentColor"></path>
<path d="M7.63 7.64026C4.05 7.97026 2.75 9.31026 2.75 14.6403C2.75 21.7413 5.06 21.7413 12 21.7413C18.94 21.7413 21.25 21.7413 21.25 14.6403C21.25 9.31026 19.95 7.97026 16.37 7.64026" stroke="currentColor"></path>
    </svg>
  ),
)

Upload3.displayName = 'Upload3'

export default Upload3
