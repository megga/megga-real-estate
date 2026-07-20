// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ScanSlider2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.8672 3V21" stroke="currentColor"></path>
<path d="M14.2598 4.08594H15.7046C18.2957 4.08594 19.9127 5.9161 19.9127 8.5081V15.496C19.9127 18.0792 18.2957 19.9094 15.7046 19.9094H14.2598" stroke="currentColor"></path>
<path d="M10.8695 19.9094H8.28822C5.69622 19.9094 4.08789 18.0792 4.08789 15.496V8.5081C4.08789 5.9161 5.70497 4.08594 8.28822 4.08594H10.8695" stroke="currentColor"></path>
    </svg>
  ),
)

ScanSlider2.displayName = 'ScanSlider2'

export default ScanSlider2
