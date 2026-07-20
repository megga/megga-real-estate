// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const AlignLeft = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 20.9087V3.08984" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M6.63672 7.76102V5.69501C6.63672 4.4147 7.67447 3.37695 8.95478 3.37695H13.8936C15.1739 3.37695 16.2116 4.4147 16.2116 5.69501V7.76102C16.2116 9.04133 15.1739 10.0791 13.8936 10.0791H8.95478C7.67447 10.0791 6.63672 9.04133 6.63672 7.76102Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M6.63672 18.304V16.238C6.63672 14.9577 7.67447 13.9199 8.95478 13.9199H18.6816C19.9619 13.9199 20.9996 14.9577 20.9996 16.238V18.304C20.9996 19.5843 19.9619 20.622 18.6816 20.622H8.95478C7.67447 20.622 6.63672 19.5843 6.63672 18.304Z" stroke="currentColor"></path>
    </svg>
  ),
)

AlignLeft.displayName = 'AlignLeft'

export default AlignLeft
