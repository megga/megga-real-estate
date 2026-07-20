// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TreadingHouseDown2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M15.835 15.6182L13.3765 12.4238L10.5722 14.6257L8.16642 11.5205" stroke="currentColor"></path>
<path d="M4.49609 8.77637V17.4514C4.49609 19.1434 5.86799 20.5153 7.55999 20.5153H16.4393C18.1313 20.5153 19.5032 19.1434 19.5032 17.4514V8.77637" stroke="currentColor"></path>
<path d="M21 9.95709L13.4741 3.99957C12.6101 3.31655 11.3899 3.31655 10.5259 3.99957L3 9.95709" stroke="currentColor"></path>
    </svg>
  ),
)

TreadingHouseDown2.displayName = 'TreadingHouseDown2'

export default TreadingHouseDown2
