// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const GalleryViewClean = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.6232 20.0338H7.39199C4.68713 20.0338 3 18.1326 3 15.4277V8.13433C3 5.42947 4.68713 3.51953 7.39199 3.51953H15.1222C17.8359 3.51953 19.5142 5.42947 19.5142 8.13433V10.0715" stroke="currentColor"></path>
<path d="M3.0019 9.02734H19.5142M3 14.5716H11.3646" stroke="currentColor"></path>
<path d="M14.0436 11.892V3.52734M8.49609 3.53209V20.0337" stroke="currentColor"></path>
<path d="M19.0539 12.8159L20.6135 14.3756C21.1584 14.9205 21.1136 15.6453 20.5688 16.1892L16.71 20.048C16.1651 20.5929 15.4412 20.6386 14.8954 20.0928L13.3357 18.5331C12.7909 17.9882 12.8366 17.2643 13.3815 16.7195L17.2403 12.8607C17.7851 12.3168 18.51 12.272 19.0539 12.8159Z" stroke="currentColor"></path>
<path d="M15.4043 14.6934L18.7348 18.0238" stroke="currentColor"></path>
    </svg>
  ),
)

GalleryViewClean.displayName = 'GalleryViewClean'

export default GalleryViewClean
