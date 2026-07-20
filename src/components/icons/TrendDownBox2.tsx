// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TrendDownBox2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 16.2181V7.78341C21 4.8353 18.9188 3.00027 15.9736 3.00027H8.02638C5.08119 3.00027 3 4.8353 3 7.78438V16.2181C3 19.1662 5.08119 21.0003 8.02638 21.0003H15.9736C18.9188 21.0003 21 19.1575 21 16.2181Z" stroke="currentColor"></path>
<path d="M10.9277 14.7939L14.4996 15.5021L15.2074 11.93" stroke="currentColor"></path>
<path d="M14.4993 15.5004L9.9653 8.7252L6.39931 11.1118L3.19922 6.78543" stroke="currentColor"></path>
    </svg>
  ),
)

TrendDownBox2.displayName = 'TrendDownBox2'

export default TrendDownBox2
