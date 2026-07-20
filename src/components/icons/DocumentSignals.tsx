// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DocumentSignals = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.85998 20.5907C5.63683 20.5907 3.83398 18.7888 3.83398 16.5657V7.02698C3.83398 4.80383 5.63683 3.00098 7.85998 3.00098H14.7951C17.0182 3.00098 18.8201 4.80383 18.8201 7.02698V13.1789" stroke="currentColor"></path>
<path d="M9.1572 10.5991L9.1572 13.1919L9.1572 10.5991ZM13.4937 8.22456L13.4937 13.1914L13.4937 8.22456Z" stroke="currentColor"></path>
<path d="M11.8472 21.0011L14.5143 18.1341L17.5572 20.1101L20.1668 17.3228" stroke="currentColor"></path>
    </svg>
  ),
)

DocumentSignals.displayName = 'DocumentSignals'

export default DocumentSignals
