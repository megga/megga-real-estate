// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FilterRefresh3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M6.14088 4.52344C4.71547 4.52344 3.56055 5.67836 3.56055 7.10377V9.07502C3.56055 10.0363 3.94293 10.9577 4.62206 11.6378L8.81948 15.3741C9.09678 15.6514 9.25245 16.0279 9.25245 16.42V19.5199C9.25245 20.5649 10.3072 21.281 11.2792 20.8938L13.0879 20.1737C13.6503 19.949 14.02 19.4051 14.02 18.7989V16.887C14.02 16.4687 14.1971 16.0688 14.5085 15.7885L19.243 11.1066C20.0048 10.4197 20.4397 9.44086 20.4397 8.41534V7.10377C20.4397 5.67836 19.2848 4.52344 17.8604 4.52344" stroke="currentColor"></path>
<path d="M14.682 7.47666C14.1653 8.32996 13.2274 8.89915 12.1571 8.89915C10.5283 8.89915 9.20703 7.57882 9.20703 5.95006C9.20703 4.32033 10.5283 3 12.1571 3C13.3101 3 14.3083 3.66065 14.7939 4.62487" stroke="currentColor"></path>
<path d="M13.1602 4.6239H14.7928V3" stroke="currentColor"></path>
    </svg>
  ),
)

FilterRefresh3.displayName = 'FilterRefresh3'

export default FilterRefresh3
