// P6a — Édition des quotas d'usage d'une agence (super-admin).
// Modal createPortal z-[100] (règle design). Écrit via admin_set_agency_quotas
// (RPC auditée quota_changed). Champs vides = illimité (cap NULL).
// Grammaire Sugar : surface OPAQUE (sp.solidBg — la carte translucide du kit
// laisserait voir le fond à travers), rayon de cadre, validation à l'accent noir
// (l'ancien bouton violet était le repère plateforme détourné en action).

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useToast } from '@/components/ui/Toast'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import { AdminGhostBtn, AdminSolidBtn } from '@/components/admin/kit/adminKit'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'
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
  const { sp, dark } = useAdminSugar()

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

  const labelStyle = { display: 'block', marginBottom: 5, fontSize: 11.5, fontWeight: 700, color: sp.sub } as const
  const inputStyle = {
    width: '100%', height: 38, padding: '0 12px', borderRadius: ADMIN_RADII.row, border: 0,
    background: sp.solidBgSub, color: sp.ink, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600,
    outline: 'none', fontVariantNumeric: 'tabular-nums' as const,
  }

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Le placeholder et l'anneau de focus ne s'expriment pas en style inline. */}
      <style>{`
        .aqf-inp::placeholder { color: ${sp.soft}; font-weight: 500; }
        .aqf-inp:focus { box-shadow: 0 0 0 2px ${sp.accent} inset; }
      `}</style>

      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: dark ? 'rgba(0,0,4,.68)' : 'rgba(14,20,16,.42)',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        }}
      />

      <div
        ref={focusTrapRef}
        className="relative scrollbar-hide"
        style={{
          width: 420, maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 24,
          borderRadius: ADMIN_RADII.frame, background: sp.solidBg,
          border: `1px solid ${sp.solidBorder}`, boxShadow: sp.solidShadow,
          animation: 'admFadeUp .28s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: -0.4, color: sp.ink }}>
          {t('usage.quota.title')}
        </h3>
        <p style={{ margin: '5px 0 18px', fontSize: 12, color: sp.sub, lineHeight: 1.45 }}>
          {t('usage.quota.subtitle')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {FIELDS.map(field => (
            <div key={field.key}>
              <label style={labelStyle}>
                {t(field.i18nKey)}{field.unit && <span style={{ color: sp.soft, fontWeight: 500 }}> ({field.unit})</span>}
              </label>
              <input
                className="aqf-inp"
                type="number"
                min={0}
                value={values[field.key]}
                onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                placeholder={t('usage.quota.unlimited')}
                style={inputStyle}
              />
            </div>
          ))}

          <div>
            <label style={labelStyle}>{t('usage.quota.threshold')} (%)</label>
            <input
              className="aqf-inp"
              type="number"
              min={50}
              max={100}
              value={threshold}
              onChange={e => setThreshold(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>{t('usage.quota.note')}</label>
            <input
              className="aqf-inp"
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={t('usage.quota.notePlaceholder')}
              style={{ ...inputStyle, fontVariantNumeric: 'normal' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 9, marginTop: 22 }}>
          <AdminGhostBtn onClick={onClose}>{t('common.cancel')}</AdminGhostBtn>
          <AdminSolidBtn onClick={handleSave} disabled={setQuotas.isPending}>
            {setQuotas.isPending ? t('common.saving') : t('common.save')}
          </AdminSolidBtn>
        </div>
      </div>
    </div>,
    document.body,
  )
}
