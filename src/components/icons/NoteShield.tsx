// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const NoteShield = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.5443 21.2832H7.95221C5.67771 21.2832 3.83301 19.4392 3.83301 17.1632V7.40219C3.83301 5.12819 5.67771 3.2832 7.95221 3.2832H15.0494C17.324 3.2832 19.1686 5.12819 19.1686 7.40219V10.7672" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M17.3884 21.2495C17.3884 21.2495 20.1436 20.4145 20.1436 18.1145C20.1436 15.8155 20.2433 15.8885 20.0225 15.6655C19.8017 15.4415 17.7499 14.7285 17.3884 14.7285C17.0269 14.7285 14.9751 15.4435 14.7543 15.6655C14.5325 15.8865 14.6331 15.8145 14.6331 18.1145C14.6331 20.4145 17.3884 21.2495 17.3884 21.2495Z" stroke="currentColor"></path>
<path d="M11.6117 14.3647H8.95801M14.042 9.92773H8.95951H14.042Z" stroke="currentColor"></path>
    </svg>
  ),
)

NoteShield.displayName = 'NoteShield'

export default NoteShield
