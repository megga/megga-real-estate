// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PowerOutlet3 = forwardRef<SVGSVGElement, Props>(
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
<path d="M10.4042 12.5189V11.4836M13.5939 12.5189V11.4836M17.2193 12.0012C17.2193 9.11833 14.8822 6.78125 11.9993 6.78125C9.11638 6.78125 6.7793 9.11833 6.7793 12.0012C6.7793 14.8842 9.11638 17.2213 11.9993 17.2213C14.8822 17.2213 17.2193 14.8842 17.2193 12.0012Z" stroke="currentColor"></path>
    </svg>
  ),
)

PowerOutlet3.displayName = 'PowerOutlet3'

export default PowerOutlet3
