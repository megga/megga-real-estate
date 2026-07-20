// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FlashCircle = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.364 5.6361C21.8787 9.15082 21.8787 14.8493 18.364 18.364C14.8492 21.8787 9.15076 21.8787 5.63604 18.364C2.12132 14.8493 2.12132 9.15082 5.63604 5.6361C9.15076 2.12138 14.8492 2.12138 18.364 5.6361Z" stroke="currentColor"></path>
<path d="M8.74498 12.373L10.5545 7.95775C10.5951 7.84703 10.7005 7.77344 10.8184 7.77344H13.2442C13.4382 7.77344 13.5739 7.96532 13.5093 8.14825L12.4365 10.666C12.3718 10.8489 12.5075 11.0408 12.7016 11.0408H14.9921C15.2337 11.0408 15.3628 11.3255 15.2036 11.5072L10.8544 16.4713C10.6585 16.695 10.2947 16.501 10.3713 16.2136L11.2004 13.1045C11.248 12.926 11.1135 12.7509 10.9288 12.7509H9.00892C8.81348 12.7509 8.67768 12.5565 8.74498 12.373Z" stroke="currentColor"></path>
    </svg>
  ),
)

FlashCircle.displayName = 'FlashCircle'

export default FlashCircle
