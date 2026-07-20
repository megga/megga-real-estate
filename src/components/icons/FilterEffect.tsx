// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FilterEffect = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M9.68798 5.63002C9.91177 5.14937 10.5948 5.14937 10.8186 5.63002L12.7363 9.73889C12.7986 9.87121 12.9056 9.97824 13.0379 10.0405L17.1468 11.9573C17.6275 12.182 17.6275 12.8651 17.1468 13.0888L13.0379 15.0066C12.9056 15.0688 12.7986 15.1749 12.7363 15.3082L10.8186 19.4171C10.5948 19.8967 9.91177 19.8967 9.68798 19.4171L7.77025 15.3082C7.70895 15.1749 7.60193 15.0688 7.46863 15.0066L3.35976 13.0888C2.88008 12.8651 2.88008 12.182 3.35976 11.9573L7.46863 10.0405C7.60193 9.97824 7.70895 9.87121 7.77025 9.73889L9.68798 5.63002Z" stroke="currentColor"></path>
<path d="M19.0152 16.7266V20.6982M21.001 18.7124H17.0293" stroke="currentColor"></path>
<path d="M17.1746 3.30078V5.91808M18.4835 4.6094H15.8652" stroke="currentColor"></path>
    </svg>
  ),
)

FilterEffect.displayName = 'FilterEffect'

export default FilterEffect
