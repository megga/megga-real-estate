// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ShieldFlash2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M11.9997 21C11.9997 21 19.3237 18.7826 19.3237 12.6694C19.3237 6.55622 19.5897 6.08238 19.0017 5.48984C18.4127 4.89632 12.9607 3 11.9997 3C11.0397 3 5.58669 4.90119 4.99769 5.48984C4.40969 6.07751 4.67669 6.55524 4.67669 12.6694C4.67669 18.7836 11.9997 21 11.9997 21Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.6916 8.18329L8.71606 12.2818C8.50374 12.5742 8.71261 12.9837 9.07368 12.9837H11.5078V15.557C11.5078 15.9851 12.0566 16.1637 12.3082 15.8165L15.2838 11.7184C15.4961 11.4261 15.2872 11.0161 14.9262 11.0161H12.4916V8.44318C12.4916 8.01464 11.9433 7.83648 11.6916 8.18329Z" stroke="currentColor"></path>
    </svg>
  ),
)

ShieldFlash2.displayName = 'ShieldFlash2'

export default ShieldFlash2
