// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Filter9 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.98047 6.72377C5.98047 5.11268 7.28651 3.80664 8.8976 3.80664H11.7527C13.3638 3.80664 14.6698 5.11268 14.6698 6.72377C14.6698 8.33486 13.3637 9.6409 11.7527 9.6409H8.8976C7.28651 9.6409 5.98047 8.33486 5.98047 6.72377Z" stroke="currentColor"></path>
<path d="M18.0211 17.2746C18.0211 18.8856 16.7151 20.1917 15.104 20.1917H13.6144C12.0033 20.1917 10.6973 18.8856 10.6973 17.2746C10.6973 15.6635 12.0033 14.3574 13.6144 14.3574H15.104C16.7151 14.3574 18.0211 15.6635 18.0211 17.2746Z" stroke="currentColor"></path>
<path d="M20.9995 17.2656H18.1048M10.6342 17.2657H3" stroke="currentColor"></path>
<path d="M3 6.73245H5.89464M14.7929 6.73242H20.9993" stroke="currentColor"></path>
    </svg>
  ),
)

Filter9.displayName = 'Filter9'

export default Filter9
