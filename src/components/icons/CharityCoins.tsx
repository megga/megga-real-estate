// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CharityCoins = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.686 16.8436H12.1357C13.171 16.8436 14.0068 16.0992 14.0068 15.064C14.0068 14.2039 13.4249 13.516 12.5911 13.3068C11.3963 13.0071 10.2053 12.7716 8.95895 12.8018C6.98477 12.8505 5.60313 13.9509 4.03857 14.9988" stroke="currentColor"></path>
<path d="M10.6865 16.8765C11.4191 16.7694 12.1654 16.8774 12.9068 16.8599C14.6241 16.819 15.9698 15.3674 17.2765 14.3827C17.9449 13.8797 18.88 13.9468 19.4706 14.5393C20.1254 15.1981 20.1254 16.2644 19.4706 16.9232C18.0588 18.3398 16.8114 19.6553 14.8975 20.3986C12.2423 21.432 9.77868 20.9309 7.08936 20.3986C6.04924 20.1934 5.09085 20.1807 4.03711 20.1807" stroke="currentColor"></path>
<path d="M15.456 5.27508C15.3665 4.7341 15.1203 4.21355 14.7019 3.79614C13.6404 2.73462 11.9202 2.73462 10.8586 3.79614C9.79712 4.85767 9.79712 6.57888 10.8586 7.6404C11.5193 8.30106 12.4349 8.54917 13.2892 8.38765" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M18.6841 7.94508C18.6841 9.44639 17.4669 10.6626 15.9656 10.6626C14.4652 10.6626 13.248 9.44639 13.248 7.94508C13.248 6.44376 14.4652 5.22656 15.9656 5.22656C17.4669 5.22656 18.6841 6.44376 18.6841 7.94508Z" stroke="currentColor"></path>
    </svg>
  ),
)

CharityCoins.displayName = 'CharityCoins'

export default CharityCoins
