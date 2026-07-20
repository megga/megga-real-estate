// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DollarDown = forwardRef<SVGSVGElement, Props>(
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
      <path d="M4.78418 10.9031C4.78418 6.53856 8.32274 3 12.6873 3C17.0529 3 20.5905 6.53856 20.5905 10.9031C20.5905 13.6312 19.2089 16.0363 17.1064 17.4568" stroke="currentColor"></path>
<path d="M14.2691 8.22107H11.9847C11.3046 8.22107 10.7539 8.77175 10.7539 9.45086C10.7539 10.1309 11.3046 10.6816 11.9847 10.6816H13.3906C14.0697 10.6816 14.6203 11.2323 14.6203 11.9114C14.6203 12.5915 14.0697 13.1422 13.3906 13.1422H11.1061" stroke="currentColor"></path>
<path d="M12.6875 13.1409V14.1741M12.6875 7.18164V8.22365" stroke="currentColor"></path>
<path d="M11.2686 20.3849L13.4051 20.9998L14.02 18.8633" stroke="currentColor"></path>
<path d="M3.41016 13.915L5.66347 17.5499L10.5933 16.074L13.408 20.9999" stroke="currentColor"></path>
    </svg>
  ),
)

DollarDown.displayName = 'DollarDown'

export default DollarDown
