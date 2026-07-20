// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Filter4 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3.10547 8.18098V6.26037C3.10547 4.45943 4.5649 3 6.36584 3H17.6336C19.4336 3 20.893 4.45943 20.893 6.26037V8.33568C20.893 9.30571 20.4688 10.2261 19.7313 10.8566L15.0767 14.835C14.4997 15.3283 14.168 16.0493 14.168 16.8082V18.1372C14.168 19.1063 13.5579 19.9712 12.6453 20.2972L10.9553 20.9004C9.85582 21.2925 8.69995 20.4781 8.69995 19.3106V16.6642C8.69995 15.987 8.44796 15.3341 7.99164 14.834L3.96848 10.4129C3.41292 9.80192 3.10547 9.00604 3.10547 8.18098Z" stroke="currentColor"></path>
<path d="M8.91016 8.42383H15.0884" stroke="currentColor"></path>
    </svg>
  ),
)

Filter4.displayName = 'Filter4'

export default Filter4
