// P8b — Factures Stripe d'une agence (chargées à la demande via l'edge).
// Grammaire Sugar : bento séparé par l'ombre, statut de facture en pilule pleine
// (fond plein + texte blanc, plus de texte teinté), montants en chiffres tabulaires.

import { useTranslation } from 'react-i18next'
import { FileText, ExternalLink } from 'lucide-react'
import { formatCHF } from '@/lib/utils'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import {
  AdminCard,
  AdminDivider,
  AdminEmpty,
  AdminError,
  AdminGhostBtn,
  AdminIc,
  AdminPill,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'
import { useAgencyInvoices } from '@/hooks/useAgencyInvoices'

function fmtAmount(cents: number, currency: string): string {
  const v = cents / 100
  // formatCHF pour CHF ; sinon montant + devise en clair.
  return currency.toLowerCase() === 'chf' ? formatCHF(v) : `${v.toFixed(2)} ${currency.toUpperCase()}`
}

/** Ton de pilule par statut Stripe ; tout le reste (draft, void…) reste sans signal. */
const STATUS_TONE: Record<string, AdminToneName> = { paid: 'ok', open: 'warn' }

/** Bento « Factures » : bouton de chargement à la demande puis liste des factures Stripe. */
export default function AgencyInvoicesSection({ agencyId }: { agencyId: string }) {
  const { t } = useTranslation('admin')
  const { sp } = useAdminSugar()
  const { data, isFetching, isError, refetch } = useAgencyInvoices(agencyId)

  return (
    <AdminCard>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <AdminIc icon={FileText} size={16} color={sp.soft} />
        <h3 style={{ flex: 1, margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: -0.2, color: sp.ink }}>
          {t('invoices.title')}
        </h3>
        <AdminGhostBtn onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? t('common.loading') : t('invoices.load')}
        </AdminGhostBtn>
      </div>

      {isError && <AdminError message={t('invoices.error')} onRetry={() => refetch()} retryLabel={t('invoices.load')} />}

      {data && !data.configured && <AdminEmpty title={t('invoices.notConfigured')} />}

      {data?.configured && (
        <>
          {data.upcoming && (
            <p style={{ margin: '0 0 10px', fontSize: 12, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
              {t('invoices.upcoming', { amount: fmtAmount(data.upcoming.amount_due, data.upcoming.currency) })}
            </p>
          )}
          {data.invoices.length === 0 ? (
            <AdminEmpty title={t('invoices.empty')} />
          ) : (
            data.invoices.map((inv, i) => (
              <div key={inv.id}>
                {i > 0 && <AdminDivider />}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>
                      {inv.number ?? inv.id.slice(-8)}
                    </span>
                    {/* Statut absent → libellé vide → `AdminPill` ne rend rien du tout
                        (et non un rectangle de couleur vide). Rien ici ne dépend de la
                        présence de la pilule : le `gap` du conteneur ne crée pas d'espace
                        fantôme pour un enfant absent, le numéro reste simplement seul. */}
                    <AdminPill
                      label={t(`invoices.status.${inv.status}`, { defaultValue: inv.status ?? '' })}
                      tone={STATUS_TONE[inv.status ?? ''] ?? 'neutral'}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtAmount(inv.amount_paid || inv.amount_due, inv.currency)}
                    </span>
                    {inv.hosted_invoice_url && (
                      <a
                        href={inv.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('invoices.open')}
                        style={{
                          display: 'grid', placeItems: 'center', width: 26, height: 26,
                          borderRadius: ADMIN_RADII.pill, color: sp.soft,
                        }}
                      >
                        <AdminIc icon={ExternalLink} size={14} color={sp.soft} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </>
      )}
    </AdminCard>
  )
}
