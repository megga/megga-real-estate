// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Store10 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M9.03221 8.90885C9.03221 10.5541 7.63892 11.8871 6.05395 11.8871C4.46898 11.8871 3.07568 10.6028 3.07568 8.90885C3.07568 8.05361 3.5972 5.75351 3.94747 4.68713C4.27828 3.67913 5.21719 3 6.27773 3H17.7082C18.7639 3 19.7008 3.6733 20.0346 4.67448C20.3916 5.7428 20.9239 8.04972 20.9239 8.90885C20.9239 10.5104 19.5306 11.8871 17.9456 11.8871C16.3606 11.8871 14.9673 10.5541 14.9673 8.90885" stroke="currentColor"></path>
<path d="M9.02148 7.97803V8.90916C9.02148 10.5545 10.3554 11.8874 11.9997 11.8874C13.645 11.8874 14.978 10.5545 14.978 8.90916V7.97803" stroke="currentColor"></path>
<path d="M4.28809 14.1875V16.6939C4.28809 19.2178 5.85943 21.0002 8.38526 21.0002H15.6105C18.1373 21.0002 19.7097 19.2178 19.7097 16.6939V14.1875" stroke="currentColor"></path>
<path d="M10.1777 16.6104H13.8225" stroke="currentColor"></path>
    </svg>
  ),
)

Store10.displayName = 'Store10'

export default Store10
