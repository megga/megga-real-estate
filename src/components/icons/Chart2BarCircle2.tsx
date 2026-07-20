// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Chart2BarCircle2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M9.36837 16.1939C8.77421 16.1939 8.29248 15.7122 8.29248 15.118V11.5064C8.29248 10.9122 8.77421 10.4305 9.36837 10.4305C9.96253 10.4305 10.4443 10.9122 10.4443 11.5064V15.118C10.4443 15.7122 9.96253 16.1939 9.36837 16.1939Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.6327 16.1937C14.0386 16.1937 13.5568 15.712 13.5568 15.1178V8.88473C13.5568 8.29057 14.0386 7.80884 14.6327 7.80884C15.2269 7.80884 15.7086 8.29057 15.7086 8.88473V15.1178C15.7086 15.712 15.2269 16.1937 14.6327 16.1937Z" stroke="currentColor"></path>
<path d="M3 12C3 7.03005 7.02908 3 12 3C16.9709 3 21 7.03005 21 12C21 16.9709 16.9709 21 12 21C7.02908 21 3 16.9709 3 12Z" stroke="currentColor"></path>
    </svg>
  ),
)

Chart2BarCircle2.displayName = 'Chart2BarCircle2'

export default Chart2BarCircle2
