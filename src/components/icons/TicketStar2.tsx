// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TicketStar2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M21.5 19.9346V14.524C20.3848 14.524 19.4866 13.637 19.4866 12.5356C19.4866 11.4342 20.3848 10.5463 21.5 10.5463V5.13464H3V10.6244C4.11525 10.6244 5.01343 11.4342 5.01343 12.5356C5.01343 13.637 4.11525 14.524 3 14.524V19.9346H21.5Z" stroke="currentColor"></path>
<path d="M12.2491 9.20801L13.2326 11.0721L15.3094 11.4315L13.8404 12.9429L14.1404 15.0291L12.2491 14.0991L10.3577 15.0291L10.6577 12.9429L9.18874 11.4315L11.2655 11.0721L12.2491 9.20801Z" stroke="currentColor"></path>
    </svg>
  ),
)

TicketStar2.displayName = 'TicketStar2'

export default TicketStar2
