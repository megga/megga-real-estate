// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FolderServer = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M18.6504 11.3983C18.6504 13.8851 17.1852 15.3504 14.6994 15.3504H9.29185C6.7992 15.3504 5.33105 13.8851 5.33105 11.3983V6.94814C5.33105 4.4662 6.24463 3 8.73144 3H10.1208C10.6199 3.00097 11.0888 3.23545 11.3885 3.63532L12.0229 4.47788C12.3225 4.87678 12.7924 5.11223 13.2916 5.1132H15.2578C17.7495 5.1132 18.6699 6.38093 18.6699 8.91832L18.6504 11.3983Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.4966 19.5022C13.4966 20.3292 12.8263 20.9996 11.9993 20.9996C11.1723 20.9996 10.502 20.3292 10.502 19.5022C10.502 18.6752 11.1723 18.0049 11.9993 18.0049C12.8263 18.0049 13.4966 18.6752 13.4966 19.5022Z" stroke="currentColor"></path>
<path d="M17.8141 19.5029H13.4952M10.4991 19.5029H6.18359" stroke="currentColor"></path>
<path d="M11.998 18.0009V15.3633" stroke="currentColor"></path>
    </svg>
  ),
)

FolderServer.displayName = 'FolderServer'

export default FolderServer
