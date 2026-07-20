// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FlashCircle2 = forwardRef<SVGSVGElement, Props>(
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
<path fillRule="evenodd" clipRule="evenodd" d="M11.6533 7.7062L8.30582 12.3171C8.06695 12.6459 8.30193 13.1066 8.70814 13.1066H11.4465V16.0017C11.4465 16.4833 12.0639 16.6842 12.347 16.2936L15.6945 11.6832C15.9333 11.3543 15.6984 10.8931 15.2922 10.8931H12.5533V7.99858C12.5533 7.51647 11.9364 7.31604 11.6533 7.7062Z" stroke="currentColor"></path>
    </svg>
  ),
)

FlashCircle2.displayName = 'FlashCircle2'

export default FlashCircle2
