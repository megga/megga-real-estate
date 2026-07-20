// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const User19 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.54102 19.9996C5.54102 17.891 7.20466 15.2656 11.9998 15.2656C16.794 15.2656 18.4576 17.8719 18.4576 19.9815" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.1254 8.12567C16.1254 10.4043 14.2784 12.2513 11.9997 12.2513C9.722 12.2513 7.875 10.4043 7.875 8.12567C7.875 5.847 9.722 4 11.9997 4C14.2784 4 16.1254 5.847 16.1254 8.12567Z" stroke="currentColor"></path>
    </svg>
  ),
)

User19.displayName = 'User19'

export default User19
