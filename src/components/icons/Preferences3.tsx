// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Preferences3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 7.78216V16.2169C21 19.165 18.9188 21 15.9736 21H8.02638C5.08119 21 3 19.165 3 16.2159V7.78216C3 4.83405 5.08119 3 8.02638 3H15.9736C18.9188 3 21 4.84281 21 7.78216Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M8.85997 12.8243C7.92689 12.8184 7.16505 13.5695 7.15824 14.5026C7.1524 15.4357 7.90353 16.1976 8.83662 16.2044C9.77067 16.2102 10.5325 15.4591 10.5383 14.526V14.5143C10.5413 13.5841 9.79013 12.8272 8.85997 12.8243Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.1413 11.1751C16.0744 11.1819 16.8362 10.4298 16.843 9.49669C16.8488 8.5636 16.0977 7.80177 15.1646 7.79496C14.2306 7.78912 13.4687 8.54025 13.4629 9.47333V9.48501C13.46 10.4152 14.2111 11.1721 15.1413 11.1751Z" stroke="currentColor"></path>
<path d="M8.84961 12.8252V7.79492" stroke="currentColor"></path>
<path d="M15.1523 11.1738V16.2041" stroke="currentColor"></path>
    </svg>
  ),
)

Preferences3.displayName = 'Preferences3'

export default Preferences3
