// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PowerOutletCircle4 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.8877 11.3048C18.9657 11.3048 20.6502 12.9893 20.6502 15.0673C20.6502 17.1453 18.9657 18.8298 16.8877 18.8298H6.55925C5.36083 18.8298 4.38939 19.8015 4.38965 20.9999" stroke="currentColor"></path>
<path d="M7.11345 10.5234C5.03548 10.5234 3.35095 8.83891 3.35095 6.76094C3.35095 4.68297 5.03548 2.99845 7.11345 2.99845H18.6509" stroke="currentColor"></path>
<path d="M15.4342 7.3866C17.3247 9.27706 17.3247 12.3421 15.4342 14.2326C13.5438 16.123 10.4787 16.123 8.58826 14.2326C6.6978 12.3421 6.6978 9.27706 8.58826 7.3866C10.4787 5.49614 13.5438 5.49614 15.4342 7.3866Z" stroke="currentColor"></path>
<path d="M12.0044 12.7657L13.2702 10.8092H10.7539L12.0183 8.85156" stroke="currentColor"></path>
    </svg>
  ),
)

PowerOutletCircle4.displayName = 'PowerOutletCircle4'

export default PowerOutletCircle4
