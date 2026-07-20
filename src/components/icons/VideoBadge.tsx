// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VideoBadge = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.955 20.2064L9.53351 18.7849C9.12876 18.3801 8.58 18.1534 8.00789 18.1534H6.93957C4.764 18.1534 3 16.3894 3 14.2139V7.29894C3 5.12337 4.764 3.35938 6.93957 3.35938H17.0614C19.237 3.35938 21 5.12337 21 7.29894V14.2139C21 16.3894 19.237 18.1534 17.0614 18.1534H15.9931C15.421 18.1534 14.8722 18.3801 14.4675 18.7849L13.045 20.2064C12.468 20.7843 11.533 20.7843 10.955 20.2064Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.4813 11.8266C13.7136 12.5213 12.7552 13.1469 11.7005 13.5721C10.8025 13.9262 10.0504 13.4845 9.93945 12.5991C9.80518 11.2943 9.8081 10.046 9.93945 8.88039C10.0601 7.95996 10.8891 7.56979 11.7005 7.91131C12.7387 8.33747 13.6708 8.91444 14.4813 9.65682C15.174 10.2844 15.1896 11.1756 14.4813 11.8266Z" stroke="currentColor"></path>
    </svg>
  ),
)

VideoBadge.displayName = 'VideoBadge'

export default VideoBadge
