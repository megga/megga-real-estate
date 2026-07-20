// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoneyPaperSearch = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.4115 19.05H6.18939C4.22302 19.05 3 17.6625 3 15.6991V8.30061C3 6.33716 4.22302 4.94971 6.18842 4.94971H17.8115C19.7711 4.94971 20.9999 6.33716 20.9999 8.30061V10.2991" stroke="currentColor"></path>
<path d="M6.21484 8.45117H7.61787" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M9.71289 12.0003C9.71289 10.7365 10.7374 9.71289 12.0003 9.71289C13.2642 9.71289 14.2888 10.7365 14.2888 12.0003C14.2888 13.2642 13.2642 14.2878 12.0003 14.2878C10.7374 14.2878 9.71289 13.2642 9.71289 12.0003Z" stroke="currentColor"></path>
<path d="M19.78 17.8318L20.9992 19.0509M19.78 17.8318C19.3704 18.2404 18.8018 18.494 18.1733 18.494C16.9201 18.494 15.9043 17.4772 15.9043 16.225C15.9043 14.9728 16.9201 13.9561 18.1733 13.9561C19.4264 13.9561 20.4422 14.9728 20.4422 16.225C20.4422 16.8516 20.1896 17.4144 19.78 17.8318Z" stroke="currentColor"></path>
    </svg>
  ),
)

MoneyPaperSearch.displayName = 'MoneyPaperSearch'

export default MoneyPaperSearch
