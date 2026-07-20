// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Setting2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M12.2503 15.6875C14.2869 15.6875 15.9379 14.0365 15.9379 11.9999C15.9379 9.96335 14.2869 8.31238 12.2503 8.31238C10.2138 8.31238 8.56281 9.96335 8.56281 11.9999C8.56281 14.0365 10.2138 15.6875 12.2503 15.6875Z" stroke="currentColor"></path>
<path d="M19.0539 18.7156L18.616 15.6753L21.4678 14.5345V9.46567L18.617 8.32522L19.055 5.28442L14.6652 2.75L12.2507 4.64979L9.83616 2.75L5.44642 5.28442L5.88433 8.32471L3.03229 9.46567V14.5345L5.88533 15.6759L5.4475 18.7156L9.83724 21.25L12.2507 19.3511L14.6642 21.25L19.0539 18.7156Z" stroke="currentColor"></path>
    </svg>
  ),
)

Setting2.displayName = 'Setting2'

export default Setting2
