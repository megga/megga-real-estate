// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ShieldInfo = forwardRef<SVGSVGElement, Props>(
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
<path d="M11.9976 15.9713V11.3467M12.0021 8.50105V8.41111" stroke="currentColor"></path>
    </svg>
  ),
)

ShieldInfo.displayName = 'ShieldInfo'

export default ShieldInfo
