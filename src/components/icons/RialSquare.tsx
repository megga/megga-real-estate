// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const RialSquare = forwardRef<SVGSVGElement, Props>(
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
<path d="M13.5884 15.6201H12.2817" stroke="currentColor"></path>
<path d="M17.1894 11.1113V13.39C17.169 14.3912 16.5356 15.2776 15.5938 15.6201" stroke="currentColor"></path>
<path d="M15.1788 11.2132V12.2445C15.1788 12.984 14.5784 13.5843 13.839 13.5853H13.622C12.8816 13.5853 12.2812 12.985 12.2812 12.2445V8.37891" stroke="currentColor"></path>
<path d="M6.8125 12.7028V13.6349C6.8125 14.568 7.5685 15.324 8.50158 15.324C9.43369 15.324 10.1897 14.568 10.1897 13.6349V8.37988" stroke="currentColor"></path>
    </svg>
  ),
)

RialSquare.displayName = 'RialSquare'

export default RialSquare
