// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Film2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3.11914 16.5172V7.4838C3.11914 4.72103 5.06998 3 7.83073 3H16.1686C18.9294 3 20.8802 4.72103 20.8802 7.48481V16.5172C20.8802 19.28 18.9294 21 16.1686 21H7.83073C5.06998 21 3.11914 19.2719 3.11914 16.5172Z" stroke="currentColor"></path>
<path d="M6.91016 3.11719V20.8823" stroke="currentColor"></path>
<path d="M17.0898 20.8833V3.11719" stroke="currentColor"></path>
<path d="M3.14453 7.52734H6.90651M3.14453 16.4321H6.90651" stroke="currentColor"></path>
<path d="M20.881 7.52734H17.0938M20.881 16.4321H17.0938" stroke="currentColor"></path>
<path d="M3.14453 11.9766H20.8813" stroke="currentColor"></path>
    </svg>
  ),
)

Film2.displayName = 'Film2'

export default Film2
