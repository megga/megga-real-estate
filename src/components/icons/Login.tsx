// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Login = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Login" stroke="none" fill="none" fillRule="evenodd"> <g id="Login" transform="translate(3.000000, 2.000000)" stroke="currentColor"> <line x1="12.8125" y1="10.0218" x2="0.7715" y2="10.0218" id="Stroke-1"></line> <polyline id="Stroke-3" points="9.8848 7.1058 12.8128 10.0218 9.8848 12.9378"></polyline> <path d="M5.5044,5.389 L5.5044,4.456 C5.5044,2.421 7.1534,0.772 9.1894,0.772 L14.0734,0.772 C16.1034,0.772 17.7484,2.417 17.7484,4.447 L17.7484,15.587 C17.7484,17.622 16.0984,19.272 14.0634,19.272 L9.1784,19.272 C7.1494,19.272 5.5044,17.626 5.5044,15.597 L5.5044,14.655" id="Stroke-4"></path> </g> </g>
    </svg>
  ),
)

Login.displayName = 'Login'

export default Login
