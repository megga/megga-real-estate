// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ZoomOut = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.9323 9.22109V7.54284C18.9323 4.93546 17.3085 3.09375 14.6982 3.09375H7.2331C4.63156 3.09375 3 4.93546 3 7.54284V14.5769C3 17.1843 4.62378 19.026 7.2331 19.026H9.20128" stroke="currentColor"></path>
<path d="M7.0918 7.26953L10.8676 11.0454M7.0918 7.26953L7.09863 10.6659M7.0918 7.26953L10.4882 7.27634" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M18.7974 12.6172H14.9156C13.5622 12.6172 12.7148 13.5755 12.7148 14.9308V18.5889C12.7148 19.9441 13.5584 20.9015 14.9156 20.9015H18.7974C20.1546 20.9015 20.9991 19.9441 20.9991 18.5889V14.9308C20.9991 13.5755 20.1546 12.6172 18.7974 12.6172Z" stroke="currentColor"></path>
    </svg>
  ),
)

ZoomOut.displayName = 'ZoomOut'

export default ZoomOut
