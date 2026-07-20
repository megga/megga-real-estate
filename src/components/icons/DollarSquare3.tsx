// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DollarSquare3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78313 3H16.2178C19.1659 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.1659 21 16.2169 21H7.78313C4.83503 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84378 3 7.78313 3Z" stroke="currentColor"></path>
<path d="M13.8375 9.14355H11.1822C10.3922 9.14355 9.75195 9.78377 9.75195 10.5738C9.75195 11.3629 10.3922 12.0031 11.1822 12.0031H12.8158C13.6059 12.0031 14.2461 12.6433 14.2461 13.4334C14.2461 14.2225 13.6059 14.8627 12.8158 14.8627H10.1606" stroke="currentColor"></path>
<path d="M12 14.8633V16.0639M12 7.93652V9.14787" stroke="currentColor"></path>
    </svg>
  ),
)

DollarSquare3.displayName = 'DollarSquare3'

export default DollarSquare3
