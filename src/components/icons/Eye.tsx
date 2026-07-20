// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Eye = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.998 19C15.703 19 19.092 16.3746 21 12C19.092 7.62537 15.703 5 11.998 5C8.297 5 4.908 7.62537 3 12C4.908 16.3766 8.297 19 12.002 19H11.998Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.0788 12.0052C15.0788 13.6785 13.7008 15.0366 12.0028 15.0366C10.3038 15.0366 8.92578 13.6785 8.92578 12.0052C8.92578 10.3308 10.3038 8.97278 12.0028 8.97278C13.7008 8.97278 15.0788 10.3308 15.0788 12.0052Z" stroke="currentColor"></path>
    </svg>
  ),
)

Eye.displayName = 'Eye'

export default Eye
