// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Store9 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M9.00713 9.28067C9.00713 10.9396 7.60216 12.2842 6.00357 12.2842C4.40497 12.2842 3 10.9892 3 9.28067C3 8.41765 3.52638 6.09808 3.87957 5.02294C4.21232 4.00716 5.16 3.32219 6.2293 3.32219H17.7561C18.8215 3.32219 19.7653 4.00132 20.1029 5.01127C20.4629 6.08835 21 8.41473 21 9.28067C21 10.8958 19.595 12.2842 17.9964 12.2842C16.3978 12.2842 14.9919 10.9396 14.9919 9.28067" stroke="currentColor"></path>
<path d="M4.22363 14.6035V16.3344C4.22363 18.8797 5.80861 20.6778 8.35585 20.6778H15.6424C18.1907 20.6778 19.7756 18.8797 19.7756 16.3344V14.6035" stroke="currentColor"></path>
<path d="M8.99561 8.3418V9.28072C8.99561 10.9396 10.3403 12.2843 11.9992 12.2843C13.6581 12.2843 15.0027 10.9396 15.0027 9.28072V8.3418" stroke="currentColor"></path>
    </svg>
  ),
)

Store9.displayName = 'Store9'

export default Store9
