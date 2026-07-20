// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Scroll = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.71665 11.0058L6.93331 9.78906M5.71665 11.0058L4.5 9.78906M5.71665 11.0058V4M5.71665 4L6.93331 5.21666M5.71665 4L4.5 5.21666" stroke="currentColor" strokeMiterlimit="10"></path>
<path d="M19.1384 11.6447C20.0428 14.0861 19.1529 17.3164 17.5681 18.9013C15.7518 20.7175 11.8949 21.0198 9.49164 19.8722C7.95682 19.1394 6.3477 17.9915 5.38517 17.2576C4.83486 16.838 4.59715 16.1356 4.74727 15.4601C5.01884 14.238 6.39901 13.6312 7.48308 14.2574L8.6473 14.9298C9.0529 15.1641 9.56001 14.8714 9.56001 14.403V5.0373C9.56001 4.16023 10.271 3.44922 11.1481 3.44922C12.0157 3.44922 12.7227 4.14545 12.736 5.01291L12.7991 9.12148C15.0216 9.33371 18.2397 9.21905 19.1384 11.6447Z" stroke="currentColor"></path>
    </svg>
  ),
)

Scroll.displayName = 'Scroll'

export default Scroll
