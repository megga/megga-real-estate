// P8b — Factures Stripe d'une agence (chargées à la demande via l'edge).

import { useTranslation } from 'react-i18next'
import { FileText, ExternalLink } from 'lucide-react'
import { formatCHF } from '@/lib/utils'
import { useAgencyInvoices } from '@/hooks/useAgencyInvoices'

function fmtAmount(cents: number, currency: string): string {
  const v = cents / 100
  // formatCHF pour CHF ; sinon montant + devise en clair.
  return currency.toLowerCase() === 'chf' ? formatCHF(v) : `${v.toFixed(2)} ${currency.toUpperCase()}`
}

export default function AgencyInvoicesSection({ agencyId }: { agencyId: string }) {
  const { t } = useTranslation('admin')
  const { data, isFetching, isError, refetch } = useAgencyInvoices(agencyId)

  return (
    <div className="rounded-xl border border-theme-border p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-theme-primary flex items-center gap-2">
          <FileText className="h-4 w-4 text-theme-tertiary" />
          {t('invoices.title')}
        </h3>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-8 px-3 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors disabled:opacity-50"
        >
          {isFetching ? t('common.loading') : t('invoices.load')}
        </button>
      </div>

      {isError && <p className="text-sm text-theme-tertiary">{t('invoices.error')}</p>}

      {data && !data.configured && (
        <p className="text-sm text-theme-tertiary">{t('invoices.notConfigured')}</p>
      )}

      {data?.configured && (
        <>
          {data.upcoming && (
            <p className="text-xs text-theme-secondary mb-3">
              {t('invoices.upcoming', { amount: fmtAmount(data.upcoming.amount_due, data.upcoming.currency) })}
            </p>
          )}
          {data.invoices.length === 0 ? (
            <p className="text-sm text-theme-tertiary">{t('invoices.empty')}</p>
          ) : (
            <div className="divide-y divide-theme-border-subtle">
              {data.invoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between py-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-theme-primary font-medium">{inv.number ?? inv.id.slice(-8)}</span>
                    <span className={inv.status === 'paid' ? 'text-emerald-500' : inv.status === 'open' ? 'text-amber-500' : 'text-theme-muted'}>
                      {t(`invoices.status.${inv.status}`, { defaultValue: inv.status ?? '' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-theme-secondary font-medium">{fmtAmount(inv.amount_paid || inv.amount_due, inv.currency)}</span>
                    {inv.hosted_invoice_url && (
                      <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer"
                        className="text-theme-tertiary hover:text-admin-accent" aria-label={t('invoices.open')}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
