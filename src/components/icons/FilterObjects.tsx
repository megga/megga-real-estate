// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FilterObjects = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M7.8903 13.9797H4.76989C3.68207 13.9797 3 14.7503 3 15.8391V18.7795C3 19.8693 3.67915 20.6399 4.76989 20.6399H7.8903C8.98104 20.6399 9.66019 19.8693 9.66019 18.7795V15.8391C9.66019 14.7503 8.98104 13.9797 7.8903 13.9797Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M17.4225 13.7324C19.3976 13.7324 20.9992 15.334 20.9992 17.3101C20.9992 19.2853 19.3976 20.8869 17.4225 20.8869C15.4473 20.8869 13.8457 19.2853 13.8457 17.3101C13.8457 15.334 15.4473 13.7324 17.4225 13.7324Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M8.63763 9.84402H14.4571C15.0925 9.84402 15.4905 9.15805 15.1762 8.60636L12.2854 3.53119C11.9682 2.9756 11.1684 2.97366 10.8483 3.5273L7.92053 8.60247C7.60235 9.15416 8.00031 9.84402 8.63763 9.84402Z" stroke="currentColor"></path>
    </svg>
  ),
)

FilterObjects.displayName = 'FilterObjects'

export default FilterObjects
