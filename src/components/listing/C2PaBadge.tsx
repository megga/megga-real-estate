import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface C2PaBadgeProps {
  verified: boolean
  verifiedAt?: string
  className?: string
}

export default function C2PaBadge({ verified, verifiedAt, className }: C2PaBadgeProps) {
  if (!verified) return null

  const dateStr = verifiedAt
    ? new Date(verifiedAt).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })
    : undefined

  return (
    <div className={cn('group relative inline-flex items-center gap-1.5', className)}>
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">Photos vérifiées</span>
      </div>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
        <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap max-w-xs">
          <p className="font-medium mb-0.5">Certifié MEGGA Shield</p>
          <p className="text-gray-500">
            Les photos de ce bien sont certifiées authentiques via la norme C2PA.
          </p>
          {dateStr && (
            <p className="text-gray-500 mt-1">Vérifié le {dateStr}</p>
          )}
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900" />
      </div>
    </div>
  )
}
