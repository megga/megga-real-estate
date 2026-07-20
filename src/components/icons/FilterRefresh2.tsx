// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FilterRefresh2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.7287 4.89062C19.122 4.89062 20.2516 6.02025 20.2516 7.41355V8.69495C20.2516 9.69906 19.8255 10.6555 19.0802 11.3269L14.4517 15.9047C14.1482 16.1791 13.974 16.5692 13.974 16.9789V18.8479C13.974 19.4405 13.613 19.9727 13.0633 20.1916L11.2944 20.8961C10.3448 21.2736 9.31346 20.574 9.31346 19.5524V16.5216C9.31346 16.1382 9.1607 15.7704 8.88924 15.499L4.78621 11.8454C4.12167 11.1809 3.74805 10.2799 3.74805 9.34004V7.41355C3.74805 6.02025 4.87767 4.89062 6.27097 4.89062" stroke="currentColor"></path>
<path d="M13.9894 8.26317C13.4591 8.73117 12.7625 9.01528 11.9997 9.01528C10.3388 9.01528 8.99219 7.66868 8.99219 6.00781" stroke="currentColor"></path>
<path d="M10.0098 3.75211C10.54 3.28411 11.2367 3 11.9995 3C13.6604 3 15.007 4.3466 15.007 6.00746" stroke="currentColor"></path>
    </svg>
  ),
)

FilterRefresh2.displayName = 'FilterRefresh2'

export default FilterRefresh2
