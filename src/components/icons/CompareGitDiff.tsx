// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CompareGitDiff = forwardRef<SVGSVGElement, Props>(
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
      <path d="M6.49512 9.53125V13.4441C6.49512 14.5171 6.92153 15.5456 7.67998 16.304L10.8781 19.5021" stroke="currentColor"></path>
<path d="M10.877 16.1328L10.8772 19.5033L7.50586 19.5039" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M6.53837 4.45703C7.93993 4.45703 9.07674 5.59384 9.07674 6.9954C9.07674 8.39696 7.93993 9.53377 6.53837 9.53377C5.1368 9.53377 4 8.39696 4 6.9954C4 5.59384 5.1368 4.45703 6.53837 4.45703Z" stroke="currentColor"></path>
<path d="M13.123 7.86719V4.49609H16.4941" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M17.4622 19.5455C16.0606 19.5455 14.9238 18.4087 14.9238 17.0071C14.9238 15.6056 16.0606 14.4688 17.4622 14.4688C18.8638 14.4688 20.0006 15.6056 20.0006 17.0071C20.0006 18.4087 18.8638 19.5455 17.4622 19.5455Z" stroke="currentColor"></path>
<path d="M17.506 14.4669V10.5541C17.506 9.48108 17.0796 8.45263 16.3211 7.69418L13.123 4.49609" stroke="currentColor"></path>
    </svg>
  ),
)

CompareGitDiff.displayName = 'CompareGitDiff'

export default CompareGitDiff
