// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Store5 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M9.05487 7.89409C9.05487 9.52675 7.67226 10.85 6.09895 10.85C4.52565 10.85 2.91342 9.48199 3.14304 7.89409C3.26467 7.05441 3.66164 5.73213 4.00802 4.6745C4.33689 3.67427 5.269 3 6.32177 3H17.6648C18.7127 3 19.6419 3.66844 19.9746 4.66185C20.3288 5.7224 20.7345 7.05051 20.8571 7.89409C21.0858 9.48199 19.4735 10.85 17.9012 10.85C16.3279 10.85 14.9453 9.52675 14.9453 7.89409" stroke="currentColor"></path>
<path d="M9.04443 6.96973V7.89406C9.04443 9.52672 10.3677 10.85 12.0003 10.85C13.633 10.85 14.9563 9.52672 14.9563 7.89406V6.96973" stroke="currentColor"></path>
<path d="M4.06445 10.1504V18.1278C4.07224 19.7216 5.37116 21.0078 6.96588 21.0001H17.0323C18.627 21.0098 19.9269 19.7245 19.9367 18.1298V18.1278V10.1426" stroke="currentColor"></path>
<path d="M16.436 13.6394V13.6294" stroke="currentColor"></path>
<path d="M9.41992 20.9863V17.3386C9.41992 15.9132 10.5748 14.7583 12.0003 14.7583C13.4257 14.7583 14.5816 15.9132 14.5816 17.3386V20.9863" stroke="currentColor"></path>
    </svg>
  ),
)

Store5.displayName = 'Store5'

export default Store5
