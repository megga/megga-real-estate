// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Folder = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Folder" stroke="none" fill="none" fillRule="evenodd"> <g id="Folder" transform="translate(1.500000, 1.500000)" stroke="currentColor"> <path d="M19.9189,14.2321 C19.9189,17.8101 17.8099,19.9191 14.2319,19.9191 L6.4499,19.9191 C2.8629,19.9191 0.7499,17.8101 0.7499,14.2321 L0.7499,6.4321 C0.7499,2.8591 2.0639,0.7501 5.6429,0.7501 L7.6429,0.7501 C8.3609,0.7511 9.0369,1.0881 9.4669,1.6631 L10.3799,2.8771 C10.8119,3.4511 11.4879,3.7891 12.2059,3.7901 L15.0359,3.7901 C18.6229,3.7901 19.9469,5.6161 19.9469,9.2671 L19.9189,14.2321 Z" id="Stroke-1"></path> <line x1="5.981" y1="12.963" x2="14.716" y2="12.963" id="Stroke-3"></line> </g> </g>
    </svg>
  ),
)

Folder.displayName = 'Folder'

export default Folder
