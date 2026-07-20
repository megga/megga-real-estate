// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CallSilent3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M6.10856 13.0575C1.52258 7.69624 2.37077 5.12706 3.00878 4.22467C3.10432 4.0548 5.40793 0.615083 7.86971 2.6322C12.7211 6.6346 8.86864 7.01679 9.61174 9.55411" stroke="currentColor"></path>
<path d="M11.5853 12.3142C16.5121 17.0598 15.8858 9.58579 20.8635 15.6265C22.8911 18.1002 19.441 20.3933 19.2711 20.4889C18.2743 21.2108 15.1628 22.1769 8.40063 15.4991" stroke="currentColor"></path>
<path d="M2 21.5001L20.5 3.00012" stroke="currentColor"></path>
    </svg>
  ),
)

CallSilent3.displayName = 'CallSilent3'

export default CallSilent3
