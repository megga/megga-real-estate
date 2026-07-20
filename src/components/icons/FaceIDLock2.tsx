// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FaceIDLock2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.782 3.62109H16.217C19.165 3.62109 21 5.7021 21 8.6481V16.5951C21 19.5401 19.165 21.6211 16.216 21.6211H7.782C4.834 21.6211 3 19.5401 3 16.5951V8.6481C3 5.7021 4.843 3.62109 7.782 3.62109Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.7684 17.0173H10.2354C9.26641 17.0173 8.48242 16.2323 8.48242 15.2643V13.2813C8.48242 12.3123 9.26641 11.5273 10.2354 11.5273H13.7684C14.7364 11.5273 15.5214 12.3123 15.5214 13.2813V15.2643C15.5214 16.2323 14.7364 17.0173 13.7684 17.0173Z" stroke="currentColor"></path>
<path d="M14.1106 11.5638V10.3048C14.0956 9.14081 13.1406 8.20881 11.9756 8.22281C10.8346 8.23781 9.91158 9.15579 9.89258 10.2968V11.5638" stroke="currentColor"></path>
    </svg>
  ),
)

FaceIDLock2.displayName = 'FaceIDLock2'

export default FaceIDLock2
