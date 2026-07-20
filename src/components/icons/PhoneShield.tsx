// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PhoneShield = forwardRef<SVGSVGElement, Props>(
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
      <path d="M9.80371 3.62109H8.99428C6.9959 3.62109 5.37598 5.24108 5.37598 7.24008L5.37696 18.0031C5.37696 20.0001 6.99687 21.6201 8.99428 21.6201H14.5098C16.5081 21.6201 18.1271 20.0001 18.1271 18.0021L18.1261 13.5381" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.5888 11.0201C15.5888 11.0201 18.5991 10.1091 18.5991 7.5961C18.5991 5.0831 18.708 4.88908 18.4667 4.64508C18.2245 4.40208 15.9838 3.62109 15.5888 3.62109C15.1938 3.62109 12.9522 4.40308 12.7109 4.64508C12.4687 4.88708 12.5786 5.0831 12.5786 7.5961C12.5786 10.1101 15.5888 11.0201 15.5888 11.0201Z" stroke="currentColor"></path>
<path d="M11.7505 17.8873V17.8243V17.8873ZM11.4912 17.8743C11.4912 17.7303 11.6081 17.6133 11.7521 17.6133C11.8961 17.6133 12.0128 17.7303 12.0128 17.8743C12.0128 18.0183 11.8961 18.1353 11.7521 18.1353C11.6081 18.1353 11.4912 18.0183 11.4912 17.8743Z" stroke="currentColor"></path>
    </svg>
  ),
)

PhoneShield.displayName = 'PhoneShield'

export default PhoneShield
