// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ShieldLock2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.3237 13.6089C19.3237 19.7221 11.9997 21.9395 11.9997 21.9395C11.9997 21.9395 4.6767 19.7231 4.6767 13.6089C4.6767 7.49469 4.40968 7.01696 4.99768 6.42929C5.58668 5.84064 11.0397 3.93945 11.9997 3.93945C12.9607 3.93945 18.4127 5.83577 19.0017 6.42929C19.5897 7.02183 19.3237 7.49567 19.3237 13.6089Z" stroke="currentColor"></path>
<path d="M11.9433 13.5798L11.9444 15.767L11.9433 13.5798ZM13.1903 10.7196C13.8453 11.3744 13.8453 12.435 13.1903 13.0898C12.5353 13.7446 11.4744 13.7446 10.8204 13.0898C10.1654 12.435 10.1654 11.3744 10.8204 10.7196C11.4744 10.0648 12.5353 10.0648 13.1903 10.7196Z" stroke="currentColor"></path>
    </svg>
  ),
)

ShieldLock2.displayName = 'ShieldLock2'

export default ShieldLock2
