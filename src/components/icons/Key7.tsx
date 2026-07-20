// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Key7 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M10.0135 7.23856C9.32743 6.55253 8.05416 6.7139 7.17004 7.59803C6.28487 8.4832 6.12345 9.75651 6.80949 10.4425C7.57093 11.204 10.8203 8.04579 10.0135 7.23856Z" stroke="currentColor"></path>
<path d="M20.9996 21.4526L17.444 21.4526L17.1765 19.0847L15.0667 19.0091L14.733 16.6412L12.7003 16.6396L11.3573 15.2943C9.15982 16.151 6.56891 15.6908 4.79429 13.9162C2.4006 11.5225 2.4006 7.64159 4.79429 5.2479C7.18798 2.85421 11.0689 2.85421 13.4626 5.2479C15.2214 7.00665 15.6862 9.56994 14.8605 11.7546L20.9996 17.8971L20.9996 21.4526Z" stroke="currentColor"></path>
    </svg>
  ),
)

Key7.displayName = 'Key7'

export default Key7
