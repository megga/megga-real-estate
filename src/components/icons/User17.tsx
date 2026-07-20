// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const User17 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
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
      <path d="M6.91989 20.5008C5.40087 20.5008 4.48295 19.5152 4.41797 18.1424C4.41797 15.348 7.44248 14.3841 11.9996 14.3516C16.5648 14.3949 19.5974 15.3588 19.5811 18.1424C19.508 19.5152 18.5955 20.5008 17.0792 20.5008H6.91989Z" stroke="currentColor" strokeMiterlimit="10"></path>
<path d="M12.0072 11.1628C14.1232 11.1628 15.8386 9.44744 15.8386 7.33141C15.8386 5.21538 14.1232 3.5 12.0072 3.5C9.89116 3.5 8.17578 5.21538 8.17578 7.33141C8.17578 9.44744 9.89116 11.1628 12.0072 11.1628Z" stroke="currentColor" strokeMiterlimit="10"></path>
    </svg>
  ),
)

User17.displayName = 'User17'

export default User17
