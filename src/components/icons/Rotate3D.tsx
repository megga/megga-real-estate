// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Rotate3D = forwardRef<SVGSVGElement, Props>(
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
      <path d="M8.28594 13.9643C8.5535 14.2319 8.9242 14.3982 9.33284 14.3982C10.1501 14.3982 10.8127 13.7366 10.8127 12.9193C10.8127 12.1021 10.1501 11.4395 9.33284 11.4395L10.8166 9.60156H8.23438" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.1767 14.3982H13.377V9.60156H14.1767C15.5009 9.60156 16.5751 10.6747 16.5751 11.9999C16.5751 13.3241 15.5009 14.3982 14.1767 14.3982Z" stroke="currentColor"></path>
<path d="M3.02539 17.9483L5.6582 18.4737L6.18068 15.8555" stroke="currentColor"></path>
<path d="M21.0008 6.32002L18.3855 5.71484L17.7832 8.31652" stroke="currentColor"></path>
<path d="M5.68507 18.3112C2.22913 14.9458 2.08514 9.4184 5.39318 5.87685C7.46557 3.65754 10.4068 2.7381 13.1982 3.15063" stroke="currentColor"></path>
<path d="M18.3533 5.87891C21.7061 9.34651 21.6827 14.8768 18.2686 18.3172C16.1301 20.4713 13.1625 21.3022 10.3848 20.805" stroke="currentColor"></path>
    </svg>
  ),
)

Rotate3D.displayName = 'Rotate3D'

export default Rotate3D
