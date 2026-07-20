// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Lampshade2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M9.96674 3H13.9987C14.8841 3 15.6616 3.58768 15.9019 4.43903L17.9899 11.8258C18.2292 12.6723 17.591 13.513 16.7104 13.5091L7.2755 13.4672C6.40177 13.4624 5.77128 12.6276 6.00674 11.7859L8.06263 4.44389C8.30198 3.59059 9.08036 3 9.96674 3Z" stroke="currentColor"></path>
<path d="M7.82227 21H16.1859" stroke="currentColor"></path>
<path d="M15.8691 15.9792V13.5195" stroke="currentColor"></path>
<path d="M12.0039 13.5508V20.9658" stroke="currentColor"></path>
    </svg>
  ),
)

Lampshade2.displayName = 'Lampshade2'

export default Lampshade2
