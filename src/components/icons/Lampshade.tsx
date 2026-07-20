// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Lampshade = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M10.6429 3H13.3361C14.058 3 14.6914 3.47968 14.888 4.17341L16.3192 9.23578C16.5245 9.96162 15.9767 10.6826 15.2217 10.6787L8.76893 10.6495C8.01974 10.6466 7.47974 9.93049 7.68115 9.20951L9.09001 4.1773C9.28558 3.48162 9.91996 3 10.6429 3Z" stroke="currentColor"></path>
<path d="M8.94922 21H15.0614" stroke="currentColor"></path>
<path d="M12.0039 10.7109V20.9758" stroke="currentColor"></path>
<path d="M14.8281 13.8506V10.6875" stroke="currentColor"></path>
    </svg>
  ),
)

Lampshade.displayName = 'Lampshade'

export default Lampshade
