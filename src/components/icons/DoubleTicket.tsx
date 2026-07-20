// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DoubleTicket = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M9.83544 17.2307L14.4551 18.4761C16.0887 18.9159 17.77 17.9458 18.2059 16.3112L20.3922 8.10131C20.8251 6.47547 19.8502 4.78737 18.2263 4.34954L13.6154 3.10608C11.976 2.66533 10.2908 3.6383 9.85393 5.27775L7.66961 13.4789C7.23567 15.1038 8.21058 16.7928 9.83544 17.2307Z" stroke="currentColor"></path>
<path d="M14.4099 18.4651V19.1783C14.4099 20.1854 13.5936 21.0017 12.5865 21.0017L6.57071 21.0016C4.87677 21.0016 3.50391 19.6288 3.50391 17.9348V9.44277C3.50391 7.74883 4.87677 6.375 6.57071 6.375H9.56161" stroke="currentColor"></path>
    </svg>
  ),
)

DoubleTicket.displayName = 'DoubleTicket'

export default DoubleTicket
