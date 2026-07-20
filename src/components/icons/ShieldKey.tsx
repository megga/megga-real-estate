// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ShieldKey = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M11.9997 21.4526C11.9997 21.4526 19.3237 19.2352 19.3237 13.122C19.3237 7.00886 19.5897 6.53502 19.0017 5.94248C18.4127 5.34896 12.9607 3.45264 11.9997 3.45264C11.0397 3.45264 5.58669 5.35383 4.99769 5.94248C4.40969 6.53015 4.67669 7.00788 4.67669 13.122C4.67669 19.2362 11.9997 21.4526 11.9997 21.4526Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.8977 10.6841C13.602 11.3884 14.7423 11.388 15.4461 10.6842C16.1499 9.98036 16.1504 8.84007 15.4461 8.1358C14.7425 7.43222 13.6015 7.43194 12.8977 8.1358L12.8949 8.13855C12.1939 8.84241 12.1956 9.98198 12.8977 10.6841Z" stroke="currentColor"></path>
<path d="M12.8945 10.6909L8.5478 15.0376L9.82201 16.3119" stroke="currentColor"></path>
<path d="M11.7664 14.3672L10.4922 13.093" stroke="currentColor"></path>
    </svg>
  ),
)

ShieldKey.displayName = 'ShieldKey'

export default ShieldKey
