// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const LiveTv = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.9719 20.7958H7.02908C4.80389 20.7958 3 18.992 3 16.7668V11.3103C3 9.08514 4.80389 7.28125 7.02908 7.28125H16.9719C19.1961 7.28125 21 9.08514 21 11.3103V16.7668C21 18.992 19.1961 20.7958 16.9719 20.7958Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.2021 15.1806C13.4948 15.8209 12.6113 16.3969 11.6393 16.789C10.8123 17.1149 10.1195 16.7082 10.0174 15.8929C9.8938 14.6903 9.89672 13.5402 10.0174 12.466C10.1283 11.6186 10.8921 11.2586 11.6393 11.5738C12.5967 11.9659 13.4559 12.4982 14.2021 13.1812C14.8394 13.7601 14.855 14.5803 14.2021 15.1806Z" stroke="currentColor"></path>
<path d="M16.5528 3.20703L12.0002 7.28184L7.5625 3.20703" stroke="currentColor"></path>
    </svg>
  ),
)

LiveTv.displayName = 'LiveTv'

export default LiveTv
