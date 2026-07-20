// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Thunderbolt = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M8.71759 19.9483H15.2824C16.1523 19.9483 16.9569 19.4842 17.3919 18.7311L20.6738 13.0449C21.1087 12.2918 21.1087 11.3636 20.6738 10.6105L17.3919 4.92425C16.9569 4.17115 16.1523 3.70703 15.2824 3.70703H8.71759C7.84773 3.70703 7.04403 4.17115 6.6091 4.92425L3.3262 10.6105C2.89127 11.3636 2.89127 12.2918 3.3262 13.0449L6.6091 18.7311C7.04403 19.4842 7.84773 19.9483 8.71759 19.9483Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.6533 7.7062L8.30582 12.3171C8.06695 12.6459 8.30193 13.1066 8.70814 13.1066H11.4465V16.0017C11.4465 16.4833 12.0639 16.6842 12.347 16.2936L15.6945 11.6832C15.9333 11.3543 15.6984 10.8931 15.2922 10.8931H12.5533V7.99858C12.5533 7.51647 11.9364 7.31604 11.6533 7.7062Z" stroke="currentColor"></path>
    </svg>
  ),
)

Thunderbolt.displayName = 'Thunderbolt'

export default Thunderbolt
