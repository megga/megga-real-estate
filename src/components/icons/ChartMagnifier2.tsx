// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ChartMagnifier2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.0504 11.4185C20.0504 6.77042 16.2819 3.00098 11.6328 3.00098C6.9838 3.00098 3.21533 6.77042 3.21533 11.4185C3.21533 16.0685 6.9838 19.837 11.6328 19.837C16.2819 19.837 20.0504 16.0685 20.0504 11.4185Z" stroke="currentColor"></path>
<path d="M17.3594 17.583L20.7844 20.9992" stroke="currentColor"></path>
<path d="M7.54688 13.545L10.0991 10.228L13.0103 12.5136L15.5081 9.29004" stroke="currentColor"></path>
    </svg>
  ),
)

ChartMagnifier2.displayName = 'ChartMagnifier2'

export default ChartMagnifier2
