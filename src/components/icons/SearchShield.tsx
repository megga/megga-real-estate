// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SearchShield = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.3619 17.8682L20.7849 21.2832L17.3619 17.8682ZM11.6379 3.2832C16.2889 3.2832 20.0599 7.05421 20.0599 11.7062C20.0599 16.3572 16.2889 20.1282 11.6379 20.1282C6.98588 20.1282 3.21484 16.3572 3.21484 11.7062C3.21484 7.05421 6.98588 3.2832 11.6379 3.2832Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.7243 15.6321C11.7243 15.6321 14.8632 14.6821 14.8632 12.0611C14.8632 9.44107 14.9772 9.52609 14.7252 9.27109C14.4732 9.01709 12.1363 8.20508 11.7243 8.20508C11.3133 8.20508 8.97627 9.01909 8.72427 9.27109C8.47227 9.52309 8.58627 9.44107 8.58627 12.0611C8.58627 14.6821 11.7243 15.6321 11.7243 15.6321Z" stroke="currentColor"></path>
    </svg>
  ),
)

SearchShield.displayName = 'SearchShield'

export default SearchShield
