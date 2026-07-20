// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Profile2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path d="M12.25 14.8188C15.5064 14.8104 18.2752 16.3056 19.2929 19.5241C17.2415 20.7746 14.8269 21.2563 12.25 21.25C9.67313 21.2563 7.25849 20.7746 5.20712 19.5241C6.22603 16.3021 8.99015 14.8104 12.25 14.8188Z" stroke="currentColor"></path>
<path d="M16.6699 7.16961C16.6699 9.61056 14.6911 11.5893 12.2501 11.5893C9.80919 11.5893 7.83041 9.61056 7.83041 7.16961C7.83041 4.72866 9.80919 2.74988 12.2501 2.74988C14.6911 2.74988 16.6699 4.72866 16.6699 7.16961Z" stroke="currentColor"></path>
    </svg>
  ),
)

Profile2.displayName = 'Profile2'

export default Profile2
