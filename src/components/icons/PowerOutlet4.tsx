// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PowerOutlet4 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M7.10955 7.38495C4.33032 10.1642 4.49321 14.7709 7.59914 17.3351C10.3052 19.5707 14.3372 19.1699 16.8199 16.6872L19.1963 14.3108C19.7792 13.7279 19.7792 12.7835 19.1963 12.2005L11.7993 4.80359C11.2173 4.22157 10.2729 4.22157 9.68999 4.8045L7.10955 7.38495Z" stroke="currentColor"></path>
<path d="M2.9998 20.9989L6.95593 17.043" stroke="currentColor"></path>
<path d="M16.2188 3L13.1064 6.11233M20.9999 7.78116L17.8876 10.8935" stroke="currentColor"></path>
<path d="M9.35012 14.6027L13.0235 13.8152L10.155 10.9466L13.8282 10.1563" stroke="currentColor"></path>
    </svg>
  ),
)

PowerOutlet4.displayName = 'PowerOutlet4'

export default PowerOutlet4
