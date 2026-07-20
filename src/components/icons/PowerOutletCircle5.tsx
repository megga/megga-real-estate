// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PowerOutletCircle5 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.364 5.63604C21.8787 9.15076 21.8787 14.8492 18.364 18.364C14.8492 21.8787 9.15076 21.8787 5.63604 18.364C2.12132 14.8492 2.12132 9.15076 5.63604 5.63604C9.15076 2.12132 14.8492 2.12132 18.364 5.63604Z" stroke="currentColor"></path>
<path d="M11.9995 16.2461C10.2167 16.2461 8.77148 14.8009 8.77148 13.0181L8.77148 11.0034C8.77148 10.65 9.05795 10.3636 9.41131 10.3636L14.5877 10.3636C14.9411 10.3636 15.2275 10.65 15.2275 11.0034L15.2275 13.0181C15.2275 14.8009 13.7823 16.2461 11.9995 16.2461Z" stroke="currentColor"></path>
<path d="M12 16.2516L12 21" stroke="currentColor"></path>
<path d="M10.3164 10.3633L10.3164 8.52209M13.6839 10.3633L13.6839 8.52209" stroke="currentColor"></path>
    </svg>
  ),
)

PowerOutletCircle5.displayName = 'PowerOutletCircle5'

export default PowerOutletCircle5
