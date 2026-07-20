// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const User8 = forwardRef<SVGSVGElement, Props>(
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
      <circle cx="11.9425" cy="8.6925" r="4.6925" stroke="currentColor"></circle>
<path d="M5.53573 20C5.42507 19.3629 5.47078 18.7027 5.47078 18.0592C5.47078 15.634 7.43674 13.6681 9.86187 13.6681H14.1377C16.5629 13.6681 18.5288 15.634 18.5288 18.0592C18.5288 18.7027 18.5745 19.3629 18.4639 20" stroke="currentColor"></path>
    </svg>
  ),
)

User8.displayName = 'User8'

export default User8
