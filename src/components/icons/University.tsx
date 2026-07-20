// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const University = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3.40673 8.4086L11.6045 3.11633C11.8449 2.96122 12.1551 2.96122 12.3955 3.11633L20.5942 8.4086C20.8017 8.54335 20.9277 8.77408 20.9277 9.02226V9.59715C20.9277 9.99948 20.601 10.3262 20.1977 10.3262H3.80227C3.39897 10.3262 3.07227 9.99948 3.07227 9.59715V9.02226C3.07227 8.77408 3.19829 8.54335 3.40673 8.4086Z" stroke="currentColor"></path>
<path d="M12 7.26367V7.27367" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M20.955 20.3804L20.5682 18.6248C20.5168 18.3911 20.3093 18.2244 20.0699 18.2244H3.92939C3.68993 18.2244 3.48247 18.3911 3.43109 18.6248L3.04427 20.3804C2.97447 20.6984 3.21684 20.9999 3.54257 20.9999H20.4577C20.7834 20.9999 21.0248 20.6984 20.955 20.3804Z" stroke="currentColor"></path>
<path d="M14.257 10.3259V18.2251M18.771 10.3259V18.2251M5.22705 10.3259V18.2251M9.74108 10.3259V18.2251" stroke="currentColor"></path>
    </svg>
  ),
)

University.displayName = 'University'

export default University
