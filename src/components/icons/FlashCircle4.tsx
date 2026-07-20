// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FlashCircle4 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.63604 5.63618C2.12132 9.15089 2.12132 14.8494 5.63604 18.3641C6.60933 19.3374 7.75009 20.0412 8.96556 20.4754L10.6285 13.2514H8.5918L10.6487 3.10156C8.8141 3.37866 7.04868 4.22353 5.63604 5.63618Z" stroke="currentColor"></path>
<path d="M13.7847 11.6473H16.1279L11.1055 20.9549C13.697 21.2123 16.3789 20.3484 18.3641 18.3632C21.8788 14.8485 21.8788 9.14998 18.3641 5.63527C17.7789 5.05002 17.1331 4.56222 16.4469 4.17188L13.7847 11.6473Z" stroke="currentColor"></path>
    </svg>
  ),
)

FlashCircle4.displayName = 'FlashCircle4'

export default FlashCircle4
