// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ConnectedCable = forwardRef<SVGSVGElement, Props>(
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
      <path d="M9.35156 9.33007L10.9763 7.70538C12.4428 6.23883 14.8205 6.23883 16.2871 7.70538C17.7536 9.17192 17.7536 11.5497 16.2871 13.0162L14.6624 14.6409" stroke="currentColor"></path>
<path d="M16.291 7.69984L20.9909 3" stroke="currentColor"></path>
<path d="M14.6487 14.6702L13.024 16.2949C11.5575 17.7614 9.17973 17.7614 7.71319 16.2949C6.24665 14.8283 6.24665 12.4506 7.71319 10.9841L9.3379 9.35938" stroke="currentColor"></path>
<path d="M15.2856 15.2866L8.71387 8.71484" stroke="currentColor"></path>
<path d="M7.70961 16.3008L3.00977 21.0006" stroke="currentColor"></path>
<path d="M19.0029 14.3008L20.4763 14.6956" stroke="currentColor"></path>
<path d="M3.51074 9.16406L4.98414 9.55886" stroke="currentColor"></path>
<path d="M14.1631 19.0039L14.7031 20.4305" stroke="currentColor"></path>
<path d="M9.28516 3.42969L9.8252 4.85626" stroke="currentColor"></path>
    </svg>
  ),
)

ConnectedCable.displayName = 'ConnectedCable'

export default ConnectedCable
