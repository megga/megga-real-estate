// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FilterCheck = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.9017 4.40625C19.3369 4.40625 20.5005 5.56991 20.5005 7.00502V8.32533C20.5005 9.35958 20.0617 10.3452 19.294 11.037L14.5265 15.7519C14.2132 16.0341 14.0342 16.4369 14.0342 16.8591V18.7837C14.0342 19.3947 13.6626 19.9425 13.0953 20.1682L11.2739 20.894C10.2951 21.2832 9.23267 20.5622 9.23267 19.5095V16.3882C9.23267 15.9932 9.07505 15.6138 8.79581 15.3345L4.56928 11.5711C3.88432 10.8862 3.5 9.95795 3.5 8.98986V7.00502C3.5 5.56991 4.66366 4.40625 6.09877 4.40625" stroke="currentColor"></path>
<path d="M9.0625 5.27575L11.2098 7.42696L15.6348 3" stroke="currentColor"></path>
    </svg>
  ),
)

FilterCheck.displayName = 'FilterCheck'

export default FilterCheck
