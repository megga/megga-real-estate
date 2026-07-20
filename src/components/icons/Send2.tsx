// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Send2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M21.5481 2.71887L16.0583 21.315H16.0333L10.7932 13.4737L2.95187 8.2335V8.20447L21.5154 2.68494L21.5481 2.71887Z" stroke="currentColor"></path>
<path d="M11.0393 13.2855L15.4816 8.84314" stroke="currentColor"></path>
    </svg>
  ),
)

Send2.displayName = 'Send2'

export default Send2
