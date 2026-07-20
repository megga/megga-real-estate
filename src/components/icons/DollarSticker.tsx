// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DollarSticker = forwardRef<SVGSVGElement, Props>(
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
      <path d="M15.851 20.2557C15.3947 20.7315 14.7642 21 14.1055 21H7.78216C4.84281 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.83405 3 7.78216 3H16.2159C19.1659 3 21 5.08119 21 8.02638V13.9197C21 14.5443 20.7587 15.1446 20.3257 15.5951L15.851 20.2557Z" stroke="currentColor"></path>
<path d="M14.6758 20.9274V17.5133C14.6748 15.8466 16.0233 14.4951 17.6901 14.4912H20.9232" stroke="currentColor"></path>
<path d="M11.4841 8.4248H9.03028C8.30055 8.4248 7.70898 9.01637 7.70898 9.7461C7.70898 10.4758 8.30055 11.0674 9.03028 11.0674H10.5403C11.2701 11.0674 11.8616 11.659 11.8616 12.3887C11.8616 13.1184 11.2701 13.71 10.5403 13.71H8.0865" stroke="currentColor"></path>
<path d="M9.78516 13.7099V14.8191M9.78516 7.30859V8.42751" stroke="currentColor"></path>
    </svg>
  ),
)

DollarSticker.displayName = 'DollarSticker'

export default DollarSticker
