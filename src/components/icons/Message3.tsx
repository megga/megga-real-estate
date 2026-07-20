// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Message3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.5448 9.01892C17.5448 9.01892 14.3348 12.8716 11.9869 12.8716C9.64004 12.8716 6.39392 9.01892 6.39392 9.01892" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M2.45203 11.9687C2.45203 5.13063 4.83298 2.85193 11.9758 2.85193C19.1187 2.85193 21.4996 5.13063 21.4996 11.9687C21.4996 18.8058 19.1187 21.0855 11.9758 21.0855C4.83298 21.0855 2.45203 18.8058 2.45203 11.9687Z" stroke="currentColor"></path>
    </svg>
  ),
)

Message3.displayName = 'Message3'

export default Message3
