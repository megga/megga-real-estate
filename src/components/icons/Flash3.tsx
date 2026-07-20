// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Flash3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.33648 12.4133L9.03976 3.3772C9.12288 3.15062 9.33857 3 9.57991 3H14.5445C14.9415 3 15.2192 3.39271 15.0869 3.76709L12.8914 8.91982C12.7591 9.2942 13.0368 9.68691 13.4339 9.68691H18.1217C18.6162 9.68691 18.8803 10.2695 18.5544 10.6414L9.65365 20.8009C9.25258 21.2586 8.50815 20.8615 8.66496 20.2735L10.3617 13.9104C10.4591 13.5452 10.1838 13.1868 9.80578 13.1868H5.87664C5.47667 13.1868 5.19874 12.7888 5.33648 12.4133Z" stroke="currentColor"></path>
    </svg>
  ),
)

Flash3.displayName = 'Flash3'

export default Flash3
