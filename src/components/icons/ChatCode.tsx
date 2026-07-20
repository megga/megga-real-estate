// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ChatCode = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.955 20.2064L9.53351 18.7849C9.12876 18.3801 8.58 18.1534 8.00789 18.1534H6.93957C4.764 18.1534 3 16.3894 3 14.2139V7.29894C3 5.12337 4.764 3.35938 6.93957 3.35938H17.0614C19.237 3.35938 21 5.12337 21 7.29894V14.2139C21 16.3894 19.237 18.1534 17.0614 18.1534H15.9931C15.421 18.1534 14.8722 18.3801 14.4675 18.7849L13.045 20.2064C12.468 20.7834 11.533 20.7834 10.955 20.2064Z" stroke="currentColor"></path>
<path d="M9.79235 8.625L7.50586 10.9115L9.79235 13.197" stroke="currentColor"></path>
<path d="M14.209 8.625L16.4955 10.9115L14.209 13.197" stroke="currentColor"></path>
    </svg>
  ),
)

ChatCode.displayName = 'ChatCode'

export default ChatCode
