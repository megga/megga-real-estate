// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Dollar = forwardRef<SVGSVGElement, Props>(
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
      <path d="M9.00007 16.6669H13.3335C14.6223 16.6669 15.6665 15.6227 15.6665 14.3339C15.6665 13.045 14.6223 12 13.3335 12H10.6669C9.37807 12 8.33301 10.9557 8.33301 9.66692C8.33301 8.3781 9.37807 7.33386 10.6669 7.33386H15.0003" stroke="currentColor"></path>
<path d="M12.002 19V5" stroke="currentColor"></path>
    </svg>
  ),
)

Dollar.displayName = 'Dollar'

export default Dollar
