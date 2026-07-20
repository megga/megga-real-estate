// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Camera2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M15.29 3.99194L17.022 6.6973H21.5L21.5 20.0079H3.00001L3 6.6973H7.478L9.20901 3.99194H15.29Z" stroke="currentColor"></path>
<path d="M18.1771 10.5349H18.1861" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.4283 13.2139C15.4283 11.4579 14.0053 10.0349 12.2493 10.0349C10.4933 10.0349 9.07031 11.4579 9.07031 13.2139C9.07031 14.9699 10.4933 16.3929 12.2493 16.3929C14.0053 16.3929 15.4283 14.9699 15.4283 13.2139Z" stroke="currentColor"></path>
    </svg>
  ),
)

Camera2.displayName = 'Camera2'

export default Camera2
