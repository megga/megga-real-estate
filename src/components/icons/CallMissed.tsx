// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CallMissed = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Call-Missed" stroke="none" fill="none" fillRule="evenodd"> <g id="Call-Missed" transform="translate(2.000000, 2.500000)" stroke="currentColor"> <line x1="19.3149" y1="1.2499" x2="13.3149" y2="7.2499" id="Stroke-1"></line> <line x1="13.3149" y1="1.2499" x2="19.3149" y2="7.2499" id="Stroke-3"></line> <path d="M9.03152183,9.97238745 C13.0205087,13.9603606 13.9254376,9.34671782 16.46525,11.8848116 C18.9138181,14.3327574 20.322201,14.8232052 17.2188207,17.9247236 C16.8302273,18.2370218 14.3612634,21.9942591 5.68446558,13.3196663 C-2.9934057,4.64400029 0.761566311,2.17244427 1.07394391,1.78394958 C4.18376493,-1.32615434 4.66682308,0.0893829491 7.11539117,2.53732879 C9.65413011,5.07649576 5.04253498,5.9844143 9.03152183,9.97238745 Z" id="Stroke-5"></path> </g> </g>
    </svg>
  ),
)

CallMissed.displayName = 'CallMissed'

export default CallMissed
