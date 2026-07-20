// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Share8 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.9985 3.00001L11.9985 15.0546M11.9985 3.00001L9.06445 5.93152M11.9985 3.00001L14.9337 5.93152" stroke="currentColor"></path>
<path d="M8.26646 9.44434L7.25084 9.44434C5.69124 9.44434 4.35979 10.565 4.10159 12.0949L3.04487 17.2975C2.71792 19.2348 4.21932 20.9999 6.19412 20.9999L17.8059 20.9999C19.7807 20.9999 21.2821 19.2348 20.9551 17.2975L19.8984 12.0949C19.6402 10.565 18.3088 9.44434 16.7492 9.44434L15.7346 9.44434" stroke="currentColor"></path>
    </svg>
  ),
)

Share8.displayName = 'Share8'

export default Share8
