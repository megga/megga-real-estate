// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ScanSlider = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.9094 13.1309V15.7122C19.9094 18.3042 18.0792 19.9125 15.496 19.9125H8.5081C5.9161 19.9125 4.08594 18.2954 4.08594 15.7122V13.1309" stroke="currentColor"></path>
<path d="M4.08594 9.74086V8.296C4.08594 5.70497 5.9161 4.08789 8.5081 4.08789H15.496C18.0792 4.08789 19.9094 5.70497 19.9094 8.296V9.74086" stroke="currentColor"></path>
<path d="M3 13.1328H21" stroke="currentColor"></path>
    </svg>
  ),
)

ScanSlider.displayName = 'ScanSlider'

export default ScanSlider
