// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const AlignCenter2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 11.998H21" stroke="currentColor"></path>
<path d="M10.2266 12V17.8588C10.2266 19.0423 9.26806 20.0106 8.07478 20.0106H6.14792C4.96441 20.0106 3.99609 19.0423 3.99609 17.8588V12" stroke="currentColor"></path>
<path d="M20.0059 12V15.6288C20.0059 16.822 19.0376 17.7806 17.8541 17.7806H15.9272C14.7339 17.7806 13.7754 16.822 13.7754 15.6288V12" stroke="currentColor"></path>
<path d="M13.7754 9.40738V8.36081C13.7754 7.1773 14.7339 6.20898 15.9272 6.20898H17.8541C19.0376 6.20898 20.0059 7.1773 20.0059 8.36081V9.40738" stroke="currentColor"></path>
<path d="M3.99609 9.40892V6.14206C3.99609 4.94877 4.96441 3.99023 6.14792 3.99023H8.07478C9.26806 3.99023 10.2266 4.94877 10.2266 6.14206V9.40892" stroke="currentColor"></path>
    </svg>
  ),
)

AlignCenter2.displayName = 'AlignCenter2'

export default AlignCenter2
