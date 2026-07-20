// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Edit = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Edit" stroke="none" fill="none" fillRule="evenodd"> <g id="Edit" transform="translate(3.000000, 3.000000)" stroke="currentColor"> <line x1="10.7473996" y1="17.4429051" x2="18" y2="17.4429051" id="Stroke-1"></line> <path d="M9.7800071,0.794792587 C10.5556498,-0.132213323 11.949987,-0.268144478 12.8962256,0.491732963 C12.9485416,0.532957985 14.6294799,1.83878843 14.6294799,1.83878843 C15.6689776,2.46719147 15.9919725,3.80310504 15.3493946,4.8225887 C15.3152754,4.877184 5.81194644,16.7644749 5.81194644,16.7644749 C5.49577537,17.1588981 5.01583223,17.3917638 4.50290722,17.3973347 L0.863527997,17.4430165 L0.0435303654,13.9723153 C-0.0713375414,13.4843002 0.0435303654,12.9717729 0.359701436,12.5773497 L9.7800071,0.794792587 Z" id="Stroke-3"></path> <line x1="8.02082217" y1="3.00088838" x2="13.4730672" y2="7.18801364" id="Stroke-5"></line> </g> </g>
    </svg>
  ),
)

Edit.displayName = 'Edit'

export default Edit
