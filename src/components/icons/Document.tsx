// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Document = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Document" stroke="none" fill="none" fillRule="evenodd"> <g id="Document" transform="translate(3.000000, 2.000000)" stroke="currentColor"> <line x1="12.7162" y1="14.2234" x2="5.4962" y2="14.2234" id="Stroke-1"></line> <line x1="12.7162" y1="10.0369" x2="5.4962" y2="10.0369" id="Stroke-2"></line> <line x1="8.2513" y1="5.8601" x2="5.4963" y2="5.8601" id="Stroke-3"></line> <path d="M12.9086,0.7498 C12.9086,0.7498 5.2316,0.7538 5.2196,0.7538 C2.4596,0.7708 0.7506,2.5868 0.7506,5.3568 L0.7506,14.5528 C0.7506,17.3368 2.4726,19.1598 5.2566,19.1598 C5.2566,19.1598 12.9326,19.1568 12.9456,19.1568 C15.7056,19.1398 17.4156,17.3228 17.4156,14.5528 L17.4156,5.3568 C17.4156,2.5728 15.6926,0.7498 12.9086,0.7498 Z" id="Stroke-4"></path> </g> </g>
    </svg>
  ),
)

Document.displayName = 'Document'

export default Document
