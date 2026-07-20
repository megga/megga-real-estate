// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Target3 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path d="M20.489 9.98114C20.69 10.7221 20.796 11.5011 20.796 12.3091C20.796 17.2251 16.814 21.2072 11.899 21.2072C6.98299 21.2072 3 17.2251 3 12.3091C3 7.40314 6.98299 3.41016 11.899 3.41016C12.639 3.41016 13.36 3.50714 14.053 3.67114" stroke="currentColor"></path>
<path d="M11.9081 7.5H11.8991C9.23311 7.5 7.07812 9.65502 7.07812 12.309C7.07812 14.974 9.23311 17.128 11.8991 17.128C14.4671 17.128 16.5831 15.108 16.6981 12.559" stroke="currentColor"></path>
<path d="M21.0003 5.58136H18.7793V3.35938" stroke="currentColor"></path>
<path d="M13.209 11.1541L18.781 5.58203" stroke="currentColor"></path>
    </svg>
  ),
)

Target3.displayName = 'Target3'

export default Target3
