// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ScanningLoad = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.9994 16.1523V17.7293C20.9994 19.8783 19.2564 21.6213 17.1064 21.6213H15.8174" stroke="currentColor"></path>
<path d="M2.99902 16.1523V17.7293C2.99902 19.8783 4.742 21.6213 6.892 21.6213H8.14902" stroke="currentColor"></path>
<path d="M2.99902 9.09009V7.51309C2.99902 5.36309 4.742 3.62109 6.892 3.62109H8.181" stroke="currentColor"></path>
<path d="M21.0006 9.09009V7.51309C21.0006 5.36309 19.2576 3.62109 17.1076 3.62109H15.8506" stroke="currentColor"></path>
<path d="M14.5049 15.4621C13.8379 16.0521 12.9599 16.4091 11.9999 16.4091C9.90794 16.4091 8.21191 14.7131 8.21191 12.6211" stroke="currentColor"></path>
<path d="M9.49316 9.77902C10.1612 9.18902 11.0392 8.83203 11.9992 8.83203C14.0912 8.83203 15.7872 10.528 15.7872 12.62" stroke="currentColor"></path>
    </svg>
  ),
)

ScanningLoad.displayName = 'ScanningLoad'

export default ScanningLoad
