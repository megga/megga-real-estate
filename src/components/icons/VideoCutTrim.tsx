// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VideoCutTrim = forwardRef<SVGSVGElement, Props>(
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
      <path d="M8.71438 20.6649H7.53512C4.88079 20.6649 3 19.0001 3 16.3458V7.65114C3 4.98806 4.88079 3.33203 7.53512 3.33203H8.71438" stroke="currentColor"></path>
<path d="M15.2891 3.33203H16.4586C19.1227 3.33203 20.9947 4.98806 20.9947 7.65212V16.3458C20.9947 19.0099 19.1227 20.6649 16.4586 20.6649H15.2891" stroke="currentColor"></path>
<path d="M12 13.9116V15.8245M12 18.6941V20.607M12 8.5214V10.4343M12 3.39062V5.30353" stroke="currentColor"></path>
<path d="M6.65039 3.44922V20.5535" stroke="currentColor"></path>
<path d="M3.02481 7.69141H6.64629M6.6488 11.9803H3.02148M3.02481 16.2647H6.64629" stroke="currentColor"></path>
<path d="M17.3477 20.5535V3.44922" stroke="currentColor"></path>
<path d="M20.9963 7.69531H17.3505M20.9993 11.9842H17.3457M20.9963 16.2686H17.3505" stroke="currentColor"></path>
    </svg>
  ),
)

VideoCutTrim.displayName = 'VideoCutTrim'

export default VideoCutTrim
