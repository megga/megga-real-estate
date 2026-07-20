// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FlashSquare = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78216 3H16.2169C19.165 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.165 21 16.2159 21H7.78216C4.83405 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84281 3 7.78216 3Z" stroke="currentColor"></path>
<path d="M8.74401 12.373L10.5535 7.95775C10.5941 7.84703 10.6995 7.77344 10.8174 7.77344H13.2432C13.4372 7.77344 13.5729 7.96532 13.5083 8.14825L12.4355 10.666C12.3709 10.8489 12.5066 11.0408 12.7006 11.0408H14.9911C15.2327 11.0408 15.3618 11.3255 15.2026 11.5072L10.8535 16.4713C10.6575 16.695 10.2937 16.501 10.3704 16.2136L11.1994 13.1045C11.247 12.926 11.1125 12.7509 10.9278 12.7509H9.00794C8.81251 12.7509 8.6767 12.5565 8.74401 12.373Z" stroke="currentColor"></path>
    </svg>
  ),
)

FlashSquare.displayName = 'FlashSquare'

export default FlashSquare
