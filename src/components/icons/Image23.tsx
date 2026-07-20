// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Image23 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M10.9531 9.1792C10.9531 10.315 10.0333 11.2349 8.89746 11.2349C7.76273 11.2349 6.8418 10.315 6.8418 9.1792C6.8418 8.04335 7.76273 7.12354 8.89746 7.12354C10.0322 7.12465 10.952 8.04446 10.9531 9.1792Z" stroke="currentColor" strokeLinecap="round"></path>
<path d="M3.3855 21.3324L7.39499 16.0017H7.50865L10.335 18.5382H10.5397L14.8559 12.2573H15.0132L21.269 21.0817" stroke="currentColor" strokeLinecap="square"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M21.5 21.854L21.5 3.354L3 3.354L3 21.854L21.5 21.854Z" stroke="currentColor" strokeLinecap="round"></path>
    </svg>
  ),
)

Image23.displayName = 'Image23'

export default Image23
