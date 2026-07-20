// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Setting12 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.1685 8.89532V15.1039C20.1685 16.1013 19.6362 17.0227 18.7722 17.5218L13.3965 20.6256C12.5325 21.1248 11.468 21.1248 10.604 20.6256L5.22729 17.5218C4.36425 17.0227 3.83203 16.1013 3.83203 15.1039V8.89532C3.83203 7.89801 4.36425 6.97659 5.22729 6.47843L10.604 3.37363C11.468 2.87546 12.5325 2.87546 13.3965 3.37363L18.7722 6.47843C19.6362 6.97659 20.1685 7.89801 20.1685 8.89532Z" stroke="currentColor"></path>
<path d="M11.9996 14.7668C13.5282 14.7668 14.7668 13.5282 14.7668 11.9996C14.7668 10.471 13.5282 9.23242 11.9996 9.23242C10.471 9.23242 9.23242 10.471 9.23242 11.9996C9.23242 13.5282 10.471 14.7668 11.9996 14.7668Z" stroke="currentColor"></path>
    </svg>
  ),
)

Setting12.displayName = 'Setting12'

export default Setting12
