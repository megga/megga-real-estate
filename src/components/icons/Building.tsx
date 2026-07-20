// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Building = forwardRef<SVGSVGElement, Props>(
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
      <path d="M14.4934 18.4312C14.4866 19.5862 13.5457 20.5164 12.3907 20.5096H5.10077C3.94676 20.5154 3.00584 19.5843 3 18.4293V13.1584C3.00487 12.705 3.2199 12.2797 3.58187 12.0063L7.54501 8.82549C8.24462 8.27281 9.23224 8.27281 9.93088 8.82549L13.9115 12.0034C14.2716 12.2768 14.4856 12.7011 14.4934 13.1525V18.4312Z" stroke="currentColor"></path>
<path d="M8.74512 16.7227V20.2713" stroke="currentColor"></path>
<path d="M17.5649 20.4H18.863C20.0432 20.4 20.9997 19.4435 20.9997 18.2632V5.62749C20.9997 4.44721 20.0432 3.49072 18.863 3.49072H13.6397C12.4663 3.49072 11.5156 4.44137 11.5156 5.61484V6.49349" stroke="currentColor"></path>
<path d="M17.7666 16.2588V16.2688" stroke="currentColor"></path>
<path d="M17.7666 12.0461V12.0361" stroke="currentColor"></path>
<path d="M14.707 7.8125V7.8225" stroke="currentColor"></path>
<path d="M17.7666 7.8125V7.8225" stroke="currentColor"></path>
    </svg>
  ),
)

Building.displayName = 'Building'

export default Building
