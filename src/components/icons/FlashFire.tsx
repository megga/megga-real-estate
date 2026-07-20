// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FlashFire = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.2998 6.4022L19.4478 5.34766" stroke="currentColor"></path>
<path d="M18.6367 16.8008L19.8098 17.8274" stroke="currentColor"></path>
<path d="M5.35263 6.39431L4.19043 5.35547" stroke="currentColor"></path>
<path d="M6.15187 17.3125L4.98145 18.3421" stroke="currentColor"></path>
<path d="M6.18707 12.4133L9.89035 3.3772C9.97346 3.15062 10.1892 3 10.4305 3H15.395C15.7921 3 16.0698 3.39271 15.9375 3.76709L13.742 8.91982C13.6097 9.2942 13.8874 9.68691 14.2845 9.68691H18.9723C19.4668 9.68691 19.7309 10.2695 19.405 10.6414L10.5042 20.8009C10.1032 21.2586 9.35873 20.8615 9.51555 20.2735L11.2123 13.9104C11.3097 13.5452 11.0344 13.1868 10.6564 13.1868H6.72722C6.32726 13.1868 6.04932 12.7888 6.18707 12.4133Z" stroke="currentColor"></path>
    </svg>
  ),
)

FlashFire.displayName = 'FlashFire'

export default FlashFire
