// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ConnectingCable = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.80664 18.1944C4.30794 16.6957 4.30794 14.2659 5.80664 12.7672L6.65962 11.9142C6.95668 11.6171 7.4383 11.6171 7.73536 11.9142L12.0869 16.2657C12.3839 16.5628 12.3839 17.0444 12.0869 17.3415L11.2339 18.1944C9.73521 19.6931 7.30534 19.6931 5.80664 18.1944Z" stroke="currentColor"></path>
<path d="M5.8029 18.1953L3 20.9982" stroke="currentColor"></path>
<path d="M18.1935 5.80762C16.6948 4.30892 14.2649 4.30892 12.7662 5.80762L11.9132 6.66059C11.6162 6.95765 11.6162 7.43928 11.9132 7.73634L16.2648 12.0879C16.5618 12.3849 17.0434 12.3849 17.3405 12.0879L18.1935 11.2349C19.6922 9.73619 19.6922 7.30632 18.1935 5.80762Z" stroke="currentColor"></path>
<path d="M18.1973 5.8029L21.0002 3" stroke="currentColor"></path>
<path d="M8.49609 12.6734L10.1774 10.9921M11.327 15.5043L13.0083 13.823" stroke="currentColor"></path>
    </svg>
  ),
)

ConnectingCable.displayName = 'ConnectingCable'

export default ConnectingCable
