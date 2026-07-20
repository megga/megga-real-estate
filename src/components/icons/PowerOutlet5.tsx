// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PowerOutlet5 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M7.83199 6.49346C5.00314 9.32231 5.16954 14.0108 8.33028 16.6212C11.0851 18.896 15.1885 18.4873 17.7147 15.9601L19.1766 14.4991C19.7691 13.9057 19.7691 12.9448 19.1766 12.3523L11.6483 4.82394C11.0558 4.23056 10.094 4.23056 9.5015 4.82394L7.83199 6.49346Z" stroke="currentColor"></path>
<path d="M15.1336 4L12.9795 6.15409" stroke="currentColor"></path>
<path d="M19.9998 8.86328L17.8457 11.0174" stroke="currentColor"></path>
<path d="M10.8926 10.0898L13.9116 13.1089" stroke="currentColor"></path>
<path d="M7.83275 16.168L4 20.0007" stroke="currentColor"></path>
    </svg>
  ),
)

PowerOutlet5.displayName = 'PowerOutlet5'

export default PowerOutlet5
