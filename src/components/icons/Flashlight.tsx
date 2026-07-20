// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Flashlight = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.9788 11.4627L17.9265 14.515C17.51 14.9315 16.9698 15.2016 16.3863 15.2851L14.6031 15.54C13.9468 15.6333 13.3383 15.937 12.8687 16.4066L9.3695 19.9058C7.91278 21.3625 5.55035 21.3625 4.09254 19.9058C2.63582 18.448 2.63582 16.0856 4.09254 14.6288L7.5928 11.1297C8.06138 10.66 8.36509 10.0526 8.45946 9.39636L8.71327 7.61206C8.79679 7.02959 9.06688 6.48833 9.48339 6.0729L12.5357 3.01953" stroke="currentColor"></path>
<path d="M8.60918 15.3943L7.47461 16.5289" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M20.8534 11.5897C20.2351 12.208 17.8445 10.8185 15.5135 8.48644C13.1814 6.15547 11.7931 3.76484 12.4102 3.14657C13.0285 2.52939 15.4191 3.91778 17.7501 6.24984C20.0822 8.58081 21.4706 10.9725 20.8534 11.5897Z" stroke="currentColor"></path>
<path d="M14.0222 15.6833V15.693C14.0222 15.693 14.0125 15.6833 14.0125 15.693C13.0786 15.1214 11.9657 14.2287 10.8713 13.1354C9.76814 12.0312 8.88521 10.9172 8.3125 9.98438" stroke="currentColor"></path>
    </svg>
  ),
)

Flashlight.displayName = 'Flashlight'

export default Flashlight
