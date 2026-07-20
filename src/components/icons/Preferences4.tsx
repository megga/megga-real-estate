// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Preferences4 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78216 3H16.2169C19.165 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.165 21 16.2159 21H7.78216C4.83405 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84281 3 7.78216 3Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.8243 15.1393C12.8184 16.0724 13.5695 16.8342 14.5026 16.8411C15.4357 16.8469 16.1976 16.0958 16.2044 15.1627C16.2102 14.2286 15.4591 13.4668 14.526 13.4609H14.5143C13.5841 13.458 12.8272 14.2092 12.8243 15.1393Z" stroke="currentColor"></path>
<path d="M12.8252 15.1523H7.79492" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.1751 8.85801C11.1809 7.92493 10.4298 7.16309 9.49669 7.15628C8.5636 7.15045 7.80177 7.90158 7.79496 8.83466C7.78912 9.76872 8.54025 10.5306 9.47333 10.5364H9.48501C10.4152 10.5393 11.1721 9.78818 11.1751 8.85801Z" stroke="currentColor"></path>
<path d="M11.1758 8.84766H16.2061" stroke="currentColor"></path>
    </svg>
  ),
)

Preferences4.displayName = 'Preferences4'

export default Preferences4
