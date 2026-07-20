// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Command = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78313 3H16.2178C19.1659 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.1659 21 16.2169 21H7.78313C4.83503 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84378 3 7.78313 3Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M8.36182 9.81739C7.55814 9.81739 6.90625 9.16549 6.90625 8.36182C6.90625 7.55814 7.55814 6.90625 8.36182 6.90625C9.16549 6.90625 9.81739 7.55814 9.81739 8.36182V15.6397C9.81739 16.4433 9.16549 17.0942 8.36182 17.0942C7.55814 17.0942 6.90625 16.4433 6.90625 15.6397C6.90625 14.835 7.55814 14.1841 8.36182 14.1841H15.6387C16.4433 14.1841 17.0943 14.835 17.0943 15.6397C17.0943 16.4433 16.4433 17.0942 15.6387 17.0942C14.835 17.0942 14.1841 16.4433 14.1841 15.6397V8.36182C14.1841 7.55814 14.835 6.90625 15.6387 6.90625C16.4433 6.90625 17.0943 7.55814 17.0943 8.36182C17.0943 9.16549 16.4433 9.81739 15.6387 9.81739H8.36182Z" stroke="currentColor"></path>
    </svg>
  ),
)

Command.displayName = 'Command'

export default Command
