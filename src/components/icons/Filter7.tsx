// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Filter7 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 7.78216V16.2169C21 19.165 18.9188 21 15.9736 21H8.02638C5.08119 21 3 19.165 3 16.2159V7.78216C3 4.83405 5.08119 3 8.02638 3H15.9736C18.9188 3 21 4.84281 21 7.78216Z" stroke="currentColor"></path>
<path d="M7.70117 9.11722C7.70117 8.39138 8.28982 7.80273 9.01566 7.80273H14.9848C15.7107 7.80273 16.2993 8.39138 16.2993 9.11722V9.78468C16.2993 10.3072 16.0775 10.8063 15.6893 11.1566L13.2783 13.5404C13.1197 13.6834 13.0292 13.8867 13.0292 14.1008V15.0747C13.0292 15.3832 12.8404 15.6605 12.5544 15.7743L11.633 16.1411C11.1377 16.3386 10.6006 15.9738 10.6006 15.4415V13.8624C10.6006 13.663 10.5208 13.4713 10.3798 13.3292L8.24214 11.4261C7.89577 11.0797 7.70117 10.6107 7.70117 10.1213V9.11722Z" stroke="currentColor"></path>
    </svg>
  ),
)

Filter7.displayName = 'Filter7'

export default Filter7
