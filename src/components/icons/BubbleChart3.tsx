// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BubbleChart3 = forwardRef<SVGSVGElement, Props>(
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
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <ellipse cx="19.0986" cy="5.68079" rx="1.90134" ry="1.90369" stroke="currentColor"></ellipse>
<path d="M19.0986 10.2844V10.2944" stroke="currentColor"></path>
<path d="M19.0986 13.5945V13.6045" stroke="currentColor"></path>
<path d="M19.0986 16.9045V16.9145" stroke="currentColor"></path>
<path d="M19.0986 20.2141V20.2241" stroke="currentColor"></path>
<ellipse cx="4.90134" cy="8.99084" rx="1.90134" ry="1.90369" stroke="currentColor"></ellipse>
<path d="M4.90137 13.594V13.604" stroke="currentColor"></path>
<path d="M4.90137 16.9045V16.9145" stroke="currentColor"></path>
<path d="M4.90137 20.2141V20.2241" stroke="currentColor"></path>
<ellipse cx="12" cy="12.3004" rx="1.90134" ry="1.90369" stroke="currentColor"></ellipse>
<path d="M12 16.9045V16.9145" stroke="currentColor"></path>
<path d="M12 20.2141V20.2241" stroke="currentColor"></path>
    </svg>
  ),
)

BubbleChart3.displayName = 'BubbleChart3'

export default BubbleChart3
