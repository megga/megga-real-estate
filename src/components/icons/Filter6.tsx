// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Filter6 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.8135 4.6543C19.2272 4.6543 20.3734 5.80043 20.3734 7.21413V8.51496C20.3734 9.53267 19.9414 10.5037 19.1854 11.1847L14.489 15.8296C14.1805 16.1069 14.0044 16.5039 14.0044 16.9193V18.8156C14.0044 19.4169 13.6376 19.9569 13.0792 20.1787L11.285 20.8938C10.3218 21.2771 9.27493 20.5669 9.27493 19.5297V16.4552C9.27493 16.066 9.12023 15.6934 8.84489 15.418L4.68164 11.7111C4.00738 11.0368 3.62891 10.1223 3.62891 9.16878V7.21413C3.62891 5.80043 4.77504 4.6543 6.18874 4.6543" stroke="currentColor"></path>
<path d="M11.9995 3V8.75208M14.2334 5.24265L12.0005 3L9.76758 5.24265" stroke="currentColor"></path>
    </svg>
  ),
)

Filter6.displayName = 'Filter6'

export default Filter6
