// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Store15 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M4.05433 4.62973V6.67489L3.01716 11.7683C2.91111 12.2888 3.31002 12.7773 3.84223 12.7773H20.1587C20.6909 12.7773 21.0889 12.2888 20.9828 11.7673L19.9252 6.59413L19.9875 4.64724C19.9972 4.17633 19.6177 3.78812 19.1468 3.78812H4.89594C4.43087 3.78812 4.05433 4.16563 4.05433 4.62973Z" stroke="currentColor"></path>
<path d="M4.0542 6.6748L19.9245 6.67556" stroke="currentColor"></path>
<path d="M4.15332 12.7776V19.0609C4.15332 19.6973 4.66801 20.2119 5.30433 20.2119H13.2008C13.8362 20.2119 14.3509 19.6973 14.3509 19.0609V12.7776" stroke="currentColor"></path>
<path d="M19.8672 20.2119V12.7776" stroke="currentColor"></path>
    </svg>
  ),
)

Store15.displayName = 'Store15'

export default Store15
