import { useTranslation } from 'react-i18next'
import { Eye, X } from 'lucide-react'
import { useImpersonate } from '@/hooks/useImpersonate'

export default function ImpersonateBanner() {
  const { t } = useTranslation('admin')
  const { impersonating, stopImpersonate } = useImpersonate()

  if (!impersonating) return null

  return (
    <div className="sticky top-0 z-[90] flex items-center justify-center gap-3 h-10 bg-admin-accent text-white text-sm font-medium px-4">
      <Eye className="h-4 w-4" />
      <span>{t('userDrawer.impersonate')} <strong>{impersonating.full_name}</strong> ({impersonating.email})</span>
      <button
        onClick={stopImpersonate}
        className="ml-2 h-6 px-2 rounded text-xs bg-white/20 hover:bg-white/30 transition-colors flex items-center gap-1"
      >
        <X className="h-3 w-3" />
        {t('common.close')}
      </button>
    </div>
  )
}
