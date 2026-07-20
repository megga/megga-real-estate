// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CameraVideo = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12.5684 10.75H6.54426C4.44479 10.75 3.12891 12.2587 3.12891 14.3927V17.3582C3.12891 19.4932 4.43808 21.0009 6.54426 21.0009H12.5674C14.6736 21.0009 15.9847 19.4932 15.9847 17.3582V14.3927C15.9847 12.2587 14.6736 10.75 12.5684 10.75Z" stroke="currentColor"></path>
<path d="M15.9785 14.9957L19.0006 12.4857C19.4898 12.079 20.212 12.1519 20.6129 12.6487C20.7807 12.8569 20.8728 13.1177 20.8718 13.3863L20.8613 18.3669C20.8594 19.0085 20.3463 19.5284 19.7133 19.5265C19.4485 19.5265 19.1934 19.4325 18.9891 19.2627L15.9785 16.7537" stroke="currentColor"></path>
<path d="M9.5957 14.4258H12.1162" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.4806 5.93676C15.4806 7.5586 14.1848 8.87353 12.587 8.87353C10.9891 8.87353 9.69336 7.5586 9.69336 5.93676C9.69336 4.31493 10.9891 3 12.587 3C14.1848 3 15.4806 4.31493 15.4806 5.93676Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M7.51335 6.98175C7.51335 8.02655 6.67862 8.87365 5.64925 8.87365C4.61989 8.87365 3.78516 8.02655 3.78516 6.98175C3.78516 5.93694 4.61989 5.08984 5.64925 5.08984C6.67862 5.08984 7.51335 5.93694 7.51335 6.98175Z" stroke="currentColor"></path>
    </svg>
  ),
)

CameraVideo.displayName = 'CameraVideo'

export default CameraVideo
