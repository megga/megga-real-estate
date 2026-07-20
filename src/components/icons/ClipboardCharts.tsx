// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ClipboardCharts = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M14.3233 6.28658H9.67659C8.92742 6.28658 8.32031 5.67947 8.32031 4.93031V4.35725C8.32031 3.60809 8.92742 3.00098 9.67659 3.00098H14.3233C15.0725 3.00098 15.6796 3.60809 15.6796 4.35725V4.93031C15.6796 5.67947 15.0725 6.28658 14.3233 6.28658Z" stroke="currentColor"></path>
<path d="M15.6803 4.59473C17.7536 4.59473 19.4348 6.27596 19.4348 8.34929V17.2468C19.4348 19.3201 17.7536 21.0014 15.6803 21.0014H8.32097C6.24764 21.0014 4.56641 19.3201 4.56641 17.2468V8.34929C4.56641 6.27596 6.24764 4.59473 8.32097 4.59473" stroke="currentColor"></path>
<path d="M15.9639 17.0252V14.9319" stroke="currentColor"></path>
<path d="M10.7349 17.0255V14.1648" stroke="currentColor"></path>
<path d="M13.3498 17.0252V16.2515" stroke="currentColor"></path>
<path d="M8.04465 17.0252V16.2515" stroke="currentColor"></path>
<path d="M7.69775 13.0631L10.4562 10.0742L13.6031 12.1342L16.302 9.2283" stroke="currentColor"></path>
    </svg>
  ),
)

ClipboardCharts.displayName = 'ClipboardCharts'

export default ClipboardCharts
