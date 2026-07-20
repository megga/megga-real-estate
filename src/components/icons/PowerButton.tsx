// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PowerButton = forwardRef<SVGSVGElement, Props>(
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
<path d="M14.6021 8.89844C15.5361 9.65833 16.1355 10.8123 16.1355 12.1131C16.1355 14.3987 14.2849 16.2492 11.9994 16.2492C9.71485 16.2492 7.86328 14.3987 7.86328 12.1131C7.86328 10.8123 8.46263 9.65833 9.39766 8.89844" stroke="currentColor"></path>
<path d="M12 7.75V11.3539" stroke="currentColor"></path>
    </svg>
  ),
)

PowerButton.displayName = 'PowerButton'

export default PowerButton
