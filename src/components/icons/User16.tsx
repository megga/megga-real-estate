// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const User16 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M6.91989 20.4991C5.40087 20.4991 4.48295 19.5135 4.41797 18.1407C4.41797 16.5862 5.35394 15.2498 6.96905 14.6734C8.25728 14.2137 9.97756 15.2838 11.9996 15.2694C14.0189 15.2886 15.7384 14.22 17.0268 14.6772C18.6511 15.2536 19.5902 16.5884 19.5812 18.1407C19.508 19.5135 18.5955 20.4991 17.0792 20.4991H6.91989Z" stroke="currentColor" strokeMiterlimit="10"></path>
<path d="M12.0075 11.6283C14.2521 11.6283 16.0717 9.80875 16.0717 7.56417C16.0717 5.31959 14.2521 3.5 12.0075 3.5C9.76295 3.5 7.94336 5.31959 7.94336 7.56417C7.94336 9.80875 9.76295 11.6283 12.0075 11.6283Z" stroke="currentColor" strokeMiterlimit="10"></path>
    </svg>
  ),
)

User16.displayName = 'User16'

export default User16
