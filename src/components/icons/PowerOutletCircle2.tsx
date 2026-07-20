// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PowerOutletCircle2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.9995 16.2461C10.2167 16.2461 8.77148 14.8009 8.77148 13.0181L8.77148 11.0034C8.77148 10.65 9.05795 10.3636 9.41131 10.3636L14.5877 10.3636C14.9411 10.3636 15.2275 10.65 15.2275 11.0034L15.2275 13.0181C15.2275 14.8009 13.7823 16.2461 11.9995 16.2461Z" stroke="currentColor"></path>
<path d="M10.3164 10.3633L10.3164 8.28027M13.6839 10.3633L13.6839 8.28027" stroke="currentColor"></path>
<path d="M12 16.2516C13.1803 21.447 21 19.9797 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21" stroke="currentColor"></path>
    </svg>
  ),
)

PowerOutletCircle2.displayName = 'PowerOutletCircle2'

export default PowerOutletCircle2
