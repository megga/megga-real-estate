// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PhoneLock2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.4836 10.13L17.4827 7.54398C17.4827 5.56298 15.8776 3.95898 13.8976 3.95898H8.43268C6.45168 3.95898 4.84668 5.56398 4.84668 7.54398L4.84766 18.211C4.84766 20.191 6.45268 21.797 8.43268 21.797" stroke="currentColor"></path>
<path d="M13.4322 21.9596H17.2562C18.3042 21.9596 19.1542 21.1106 19.1542 20.0626V17.9146C19.1542 16.8666 18.3042 16.0176 17.2562 16.0176H13.4322C12.3832 16.0176 11.5342 16.8666 11.5342 17.9146V20.0626C11.5342 21.1106 12.3832 21.9596 13.4322 21.9596Z" stroke="currentColor"></path>
<path d="M15.3447 18.7012V19.3772" stroke="currentColor"></path>
<path d="M17.6265 16.0538V14.9788C17.6115 13.7178 16.5765 12.7088 15.3155 12.7248C14.0815 12.7398 13.0825 13.7338 13.0615 14.9688V16.0538" stroke="currentColor"></path>
<path d="M9.78418 7.61523H12.5422" stroke="currentColor"></path>
    </svg>
  ),
)

PhoneLock2.displayName = 'PhoneLock2'

export default PhoneLock2
