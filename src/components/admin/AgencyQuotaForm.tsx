// P6a — Édition des quotas d'usage d'une agence (super-admin).
// Modal createPortal z-[100] (règle design). Écrit via admin_set_agency_quotas
// (RPC auditée quota_changed). Champs vides = illimité (cap NULL).

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useToast } from '@/components/ui/Toast'
import { useSetAgencyQuotas, type AgencyQuotas } from '@/hooks/useAdminAgencyUsage'

interface Props {
  agencyId: string
  current: AgencyQuotas | null
  onClose: () => void
}

type FieldKey = 'ai_monthly_cost_cap_usd' | 'active_properties_cap' | 'whatsapp_monthly_cap' | 'storage_cap_mb'

const FIELDS: { key: FieldKey; i18nKey: string; unit: string }[] = [
  { key: 'ai_monthly_cost_cap_usd', i18nKey: 'usage.quota.aiCost', unit: 'USD' },
  { key: 'active_properties_cap', i18nKey: 'usage.quota.properties', unit: '' },
  { key: 'whatsapp_monthly_cap', i18nKey: 'usage.quota.whatsapp', unit: '' },
  { key: 'storage_cap_mb', i18nKey: 'usage.quota.storage', unit: 'MB' },
]

export default function AgencyQuotaForm({ agencyId, current, onClose }: Props) {
  const { t } = useTranslation('admin')
  const toast = useToast()
  const focusTrapRef = useFocusTrap(true)
  const setQuotas = useSetAgencyQuotas(agencyId)

  const [values, setValues] = useState<Record<FieldKey, string>>({
    ai_monthly_cost_cap_usd: current?.ai_monthly_cost_cap_usd?.toString() ?? '',
    active_properties_cap: current?.active_properties_cap?.toString() ?? '',
    whatsapp_monthly_cap: current?.whatsapp_monthly_cap?.toString() ?? '',
    storage_cap_mb: current?.storage_cap_mb?.toString() ?? '',
  })
  const [threshold, setThreshold] = useState(String(current?.alert_threshold_pct ?? 80))
  const [note, setNote] = useState('')

  const handleSave = () => {
    const th = Number(threshold)
    if (!Number.isFinite(th) || th < 50 || th > 100) {
      toast.error(t('usage.quota.thresholdError'))
      return
    }
    const quotas: Partial<AgencyQuotas> = {
      ai_monthly_cost_cap_usd: values.ai_monthly_cost_cap_usd === '' ? null : Number(values.ai_monthly_cost_cap_usd),
      active_properties_cap: values.active_properties_cap === '' ? null : Number(values.active_properties_cap),
      whatsapp_monthly_cap: values.whatsapp_monthly_cap === '' ? null : Number(values.whatsapp_monthly_cap),
      storage_cap_mb: values.storage_cap_mb === '' ? null : Number(values.storage_cap_mb),
      alert_threshold_pct: th,
    }
    setQuotas.mutate(
      { quotas, note },
      {
        onSuccess: () => {
          toast.success(t('usage.quota.saved'))
          onClose()
        },
        onError: () => toast.error(t('usage.quota.saveError')),
      },
    )
  }

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div ref={focusTrapRef} className="relative bg-theme-card rounded-xl border border-theme-border w-full max-w-md p-5 scrollbar-hide max-h-[85vh] overflow-y-auto">
        <h3 className="text-base font-semibold text-theme-primary mb-1">{t('usage.quota.title')}</h3>
        <p className="text-xs text-theme-tertiary mb-4">{t('usage.quota.subtitle')}</p>

        <div className="space-y-3">
          {FIELDS.map(field => (
            <div key={field.key}>
              <label className="text-xs text-theme-secondary mb-1 block">
                {t(field.i18nKey)}{field.unit && <span className="text-theme-muted"> ({field.unit})</span>}
              </label>
              <input
                type="number"
                min={0}
                value={values[field.key]}
                onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                placeholder={t('usage.quota.unlimited')}
                className="w-full h-9 px-3 rounded-lg bg-theme-hover text-sm text-theme-primary placeholder:text-theme-muted outline-none border border-theme-border focus:border-theme-active"
              />
            </div>
          ))}

          <div>
            <label className="text-xs text-theme-secondary mb-1 block">{t('usage.quota.threshold')} (%)</label>
            <input
              type="number"
              min={50}
              max={100}
              value={threshold}
              onChange={e => setThreshold(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-theme-hover text-sm text-theme-primary outline-none border border-theme-border focus:border-theme-active"
            />
          </div>

          <div>
            <label className="text-xs text-theme-secondary mb-1 block">{t('usage.quota.note')}</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={t('usage.quota.notePlaceholder')}
              className="w-full h-9 px-3 rounded-lg bg-theme-hover text-sm text-theme-primary placeholder:text-theme-muted outline-none border border-theme-border focus:border-theme-active"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-sm border border-theme-border text-theme-secondary hover:text-theme-primary transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={setQuotas.isPending}
            className="h-9 px-4 rounded-lg text-sm border border-admin-accent text-admin-accent hover:bg-admin-accent/10 transition-colors disabled:opacity-50"
          >
            {setQuotas.isPending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
