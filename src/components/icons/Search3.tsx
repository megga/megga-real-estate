// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Search3 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path fillRule="evenodd" clipRule="evenodd" d="M11.2754 2.71423C16.003 2.71423 19.8364 6.54661 19.8364 11.2752C19.8364 16.0038 16.003 19.8361 11.2754 19.8361C6.54686 19.8361 2.71448 16.0038 2.71448 11.2752C2.71448 6.54661 6.54686 2.71423 11.2754 2.71423Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M19.899 18.4875C20.678 18.4875 21.3095 19.1199 21.3095 19.898C21.3095 20.678 20.678 21.3095 19.899 21.3095C19.1199 21.3095 18.4875 20.678 18.4875 19.898C18.4875 19.1199 19.1199 18.4875 19.899 18.4875Z" stroke="currentColor"></path>
    </svg>
  ),
)

Search3.displayName = 'Search3'

export default Search3
