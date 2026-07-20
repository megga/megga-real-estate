// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Login6 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M15 21H15.0798C17.1521 21 18.1883 21 18.9798 20.5967C19.676 20.242 20.242 19.676 20.5967 18.9798C21 18.1883 21 17.1522 21 15.08V8.92C21 6.84781 21 5.81171 20.5967 5.02023C20.242 4.32404 19.676 3.75801 18.9798 3.40328C18.1883 3 17.1521 3 15.0798 3L15 3" stroke="currentColor"></path>
<path d="M11.2066 16.2183L15.5509 11.9998M15.5509 11.9998L11.2066 7.78133M15.5509 11.9998L3 11.9993" stroke="currentColor"></path>
    </svg>
  ),
)

Login6.displayName = 'Login6'

export default Login6
