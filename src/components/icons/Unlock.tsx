// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Unlock = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Unlock" stroke="none" fill="none" fillRule="evenodd"> <g id="Unlock" transform="translate(4.500000, 2.500000)" stroke="currentColor"> <path d="M11.9242,3.06203682 C11.3072,1.28003682 9.6142,0 7.6222,0 C5.1092,-0.00996317625 3.0632,2.01803682 3.0522,4.53103682 L3.0522,4.55103682 L3.0522,6.69803682" id="Stroke-1"></path> <path d="M11.433,18.5004368 L3.792,18.5004368 C1.698,18.5004368 1.13686838e-13,16.8024368 1.13686838e-13,14.7074368 L1.13686838e-13,10.4194368 C1.13686838e-13,8.32443682 1.698,6.62643682 3.792,6.62643682 L11.433,6.62643682 C13.527,6.62643682 15.225,8.32443682 15.225,10.4194368 L15.225,14.7074368 C15.225,16.8024368 13.527,18.5004368 11.433,18.5004368 Z" id="Stroke-3"></path> <line x1="7.6127" y1="11.4526368" x2="7.6127" y2="13.6746368" id="Stroke-5"></line> </g> </g>
    </svg>
  ),
)

Unlock.displayName = 'Unlock'

export default Unlock
