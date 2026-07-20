// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const LoginUser = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.62695 10.0346H2.96068M7.62695 10.0346L5.74459 8.16016M7.62695 10.0346L5.74459 11.908" stroke="currentColor"></path>
<path d="M9.30819 19.8768C7.90086 19.8768 7.05044 18.9636 6.99023 17.6917C6.99023 15.1029 9.79236 14.2098 14.0144 14.1797C18.2439 14.2198 21.0535 15.1129 21.0385 17.6917C20.9707 18.9636 20.1253 19.8768 18.7205 19.8768H9.30819Z" stroke="currentColor" strokeMiterlimit="10"></path>
<path d="M14.0204 11.2244C15.9808 11.2244 17.5701 9.63513 17.5701 7.67469C17.5701 5.71425 15.9808 4.125 14.0204 4.125C12.06 4.125 10.4707 5.71425 10.4707 7.67469C10.4707 9.63513 12.06 11.2244 14.0204 11.2244Z" stroke="currentColor" strokeMiterlimit="10"></path>
    </svg>
  ),
)

LoginUser.displayName = 'LoginUser'

export default LoginUser
