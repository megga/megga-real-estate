// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ShieldFlash3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M11.9997 21C11.9997 21 19.3237 18.7826 19.3237 12.6694C19.3237 6.55622 19.5897 6.08238 19.0017 5.48984C18.4127 4.89632 12.9607 3 11.9997 3C11.0397 3 5.58669 4.90119 4.99769 5.48984C4.40969 6.07751 4.67669 6.55524 4.67669 12.6694C4.67669 18.7836 11.9997 21 11.9997 21Z" stroke="currentColor"></path>
<path d="M8.74401 12.2011L10.5535 7.78587C10.5941 7.67516 10.6995 7.60156 10.8174 7.60156H13.2432C13.4372 7.60156 13.5729 7.79345 13.5083 7.97638L12.4355 10.4941C12.3709 10.677 12.5066 10.8689 12.7006 10.8689H14.9911C15.2327 10.8689 15.3618 11.1536 15.2026 11.3353L10.8535 16.2994C10.6575 16.5231 10.2937 16.3291 10.3704 16.0417L11.1994 12.9326C11.247 12.7542 11.1125 12.5791 10.9278 12.5791H9.00794C8.81251 12.5791 8.6767 12.3846 8.74401 12.2011Z" stroke="currentColor"></path>
    </svg>
  ),
)

ShieldFlash3.displayName = 'ShieldFlash3'

export default ShieldFlash3
