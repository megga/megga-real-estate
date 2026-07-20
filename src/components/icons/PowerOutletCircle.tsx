// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PowerOutletCircle = forwardRef<SVGSVGElement, Props>(
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
<path d="M6.86967 19.3955C4.53099 17.7701 3 15.0639 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.4617 17.7534 20.1651 13.4937 20.8766C12.6766 21.0131 12 20.3284 12 19.5V16.2516" stroke="currentColor"></path>
<path d="M10.3164 10.3633L10.3164 8.28027M13.6839 10.3633L13.6839 8.28027" stroke="currentColor"></path>
    </svg>
  ),
)

PowerOutletCircle.displayName = 'PowerOutletCircle'

export default PowerOutletCircle
