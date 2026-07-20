// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PaperDownload = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Paper-Download" stroke="none" fill="none" fillRule="evenodd"> <g id="Paper-Download" transform="translate(3.500000, 2.000000)" stroke="currentColor"> <path d="M11.2367,0.761771154 L4.5847,0.761771154 C2.5047,0.7538 0.8007,2.4108 0.7507,4.4908 L0.7507,15.2278 C0.7057,17.3298 2.3737,19.0698 4.4747,19.1148 C4.5117,19.1148 4.5487,19.1158 4.5847,19.1148 L12.5727,19.1148 C14.6627,19.0408 16.3147,17.3188 16.302765,15.2278 L16.302765,6.0378 L11.2367,0.761771154 Z" id="Stroke-1"></path> <path d="M10.9749,0.7501 L10.9749,3.6591 C10.9749,5.0791 12.1239,6.2301 13.5439,6.2341 L16.2979,6.2341" id="Stroke-3"></path> <line x1="8.1419" y1="13.9498" x2="8.1419" y2="7.9088" id="Stroke-5"></line> <polyline id="Stroke-7" points="5.7962 11.5944 8.1412 13.9494 10.4862 11.5944"></polyline> </g> </g>
    </svg>
  ),
)

PaperDownload.displayName = 'PaperDownload'

export default PaperDownload
