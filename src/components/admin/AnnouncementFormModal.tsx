// P8a — Création/édition d'une annonce in-app (super-admin).
// Ciblage plans (pills) + agences (multi-select) + fenêtre + sévérité + CTA.
// Tableaux vides = universel. createPortal via le composant Modal partagé.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import Modal from '@/components/ui/modal'
import { useToast } from '@/components/ui/Toast'
import { useAdminAgencies } from '@/hooks/useAdminAgencies'
import { useAnnouncementsAdmin, type Announcement, type AnnouncementInput } from '@/hooks/useAnnouncementsAdmin'

const PLAN_IDS = ['starter', 'pro', 'entreprise'] as const
const SEVERITIES = ['info', 'warning', 'critical'] as const

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  // yyyy-MM-ddThh:mm pour <input type="datetime-local">
  return iso.slice(0, 16)
}

export default function AnnouncementFormModal({ existing, onClose }: {
  existing: Announcement | null
  onClose: () => void
}) {
  const { t } = useTranslation('admin')
  const toast = useToast()
  const { agencies } = useAdminAgencies()
  const { create, update } = useAnnouncementsAdmin()

  const [title, setTitle] = useState(existing?.title ?? '')
  const [body, setBody] = useState(existing?.body ?? '')
  const [severity, setSeverity] = useState<typeof SEVERITIES[number]>(existing?.severity ?? 'info')
  const [plans, setPlans] = useState<string[]>(existing?.audience_plans ?? [])
  const [agencyIds, setAgencyIds] = useState<string[]>(existing?.audience_agencies ?? [])
  const [startsAt, setStartsAt] = useState(toLocalInput(existing?.starts_at ?? null))
  const [endsAt, setEndsAt] = useState(toLocalInput(existing?.ends_at ?? null))
  const [ctaLabel, setCtaLabel] = useState(existing?.cta_label ?? '')
  const [ctaHref, setCtaHref] = useState(existing?.cta_href ?? '')
  const [published, setPublished] = useState(existing?.published ?? false)
  const [agencyOpen, setAgencyOpen] = useState(false)
  const [agencySearch, setAgencySearch] = useState('')

  const togglePlan = (p: string) => setPlans(v => v.includes(p) ? v.filter(x => x !== p) : [...v, p])
  const toggleAgency = (id: string) => setAgencyIds(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id])

  const filteredAgencies = agencies.filter(a => a.name.toLowerCase().includes(agencySearch.trim().toLowerCase()))

  const handleSave = () => {
    if (!title.trim() || !body.trim()) { toast.error(t('announcements.form.required')); return }
    const input: AnnouncementInput = {
      title: title.trim(),
      body: body.trim(),
      severity,
      audience_plans: plans,
      audience_agencies: agencyIds,
      starts_at: startsAt ? new Date(startsAt).toISOString() : new Date().toISOString(),
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      cta_label: ctaLabel.trim() || null,
      cta_href: ctaHref.trim() || null,
      published,
    }
    const onDone = {
      onSuccess: () => { toast.success(t('announcements.form.saved')); onClose() },
      onError: () => toast.error(t('announcements.form.error')),
    }
    if (existing) update.mutate({ id: existing.id, patch: input }, onDone)
    else create.mutate(input, onDone)
  }

  const pending = create.isPending || update.isPending

  return (
    <Modal open onClose={onClose} title={existing ? t('announcements.form.editTitle') : t('announcements.form.newTitle')} size="md">
      <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-hide">
        {/* Titre + corps */}
        <div>
          <label className="text-xs font-medium text-theme-secondary block mb-1.5">{t('announcements.form.title')}</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} autoFocus
            className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-accent/20 focus:border-admin-accent" />
        </div>
        <div>
          <label className="text-xs font-medium text-theme-secondary block mb-1.5">{t('announcements.form.body')}</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={3}
            className="w-full px-3 py-2 text-sm bg-transparent border border-theme-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-admin-accent/20 focus:border-admin-accent" />
        </div>

        {/* Sévérité */}
        <div>
          <label className="text-xs font-medium text-theme-secondary block mb-1.5">{t('announcements.form.severity')}</label>
          <div className="flex items-center gap-1.5">
            {SEVERITIES.map(s => (
              <button key={s} onClick={() => setSeverity(s)}
                className={cn('h-8 px-3 rounded-lg text-xs font-medium transition-colors',
                  severity === s ? 'bg-admin-accent/10 text-admin-accent' : 'bg-theme-hover text-theme-muted hover:text-theme-primary')}>
                {t(`announcements.severity.${s}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Ciblage plans */}
        <div>
          <label className="text-xs font-medium text-theme-secondary block mb-1.5">{t('announcements.form.plans')}</label>
          <div className="flex items-center gap-1.5">
            {PLAN_IDS.map(p => (
              <button key={p} onClick={() => togglePlan(p)}
                className={cn('h-8 px-3 rounded-lg text-xs font-medium transition-colors',
                  plans.includes(p) ? 'bg-admin-accent/10 text-admin-accent' : 'bg-theme-hover text-theme-muted hover:text-theme-primary')}>
                {t(`common.plan.${p}`)}
              </button>
            ))}
          </div>
          <p className="text-xs text-theme-muted mt-1">{plans.length === 0 ? t('announcements.form.allPlans') : ''}</p>
        </div>

        {/* Ciblage agences */}
        <div>
          <label className="text-xs font-medium text-theme-secondary block mb-1.5">{t('announcements.form.agencies')}</label>
          <div className="flex flex-wrap items-center gap-1.5">
            {agencyIds.map(id => (
              <span key={id} className="flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-lg text-xs font-medium bg-admin-accent/10 text-admin-accent">
                <span className="truncate max-w-[140px]">{agencies.find(a => a.id === id)?.name ?? id}</span>
                <button onClick={() => toggleAgency(id)} className="p-0.5 rounded hover:bg-admin-accent/20"><X className="h-3 w-3" /></button>
              </span>
            ))}
            <div className="relative">
              <button onClick={() => setAgencyOpen(o => !o)}
                className="h-7 px-2.5 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center gap-1.5">
                {t('announcements.form.addAgency')}
                <ChevronDown className={cn('h-3 w-3 transition-transform', agencyOpen && 'rotate-180')} />
              </button>
              {agencyOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAgencyOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 z-20 bg-theme-card border border-theme-border rounded-lg py-1 w-60">
                    <div className="px-2 pb-1">
                      <input type="text" value={agencySearch} onChange={e => setAgencySearch(e.target.value)}
                        placeholder={t('announcements.form.searchAgency')}
                        className="w-full h-7 px-2 rounded-md bg-theme-hover text-xs text-theme-primary placeholder:text-theme-muted outline-none" />
                    </div>
                    <div className="max-h-48 overflow-y-auto scrollbar-hide">
                      {filteredAgencies.slice(0, 40).map(a => (
                        <button key={a.id} onClick={() => toggleAgency(a.id)}
                          className={cn('w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between gap-2',
                            agencyIds.includes(a.id) ? 'text-admin-accent' : 'text-theme-secondary hover:bg-theme-hover hover:text-theme-primary')}>
                          <span className="truncate">{a.name}</span>
                          {agencyIds.includes(a.id) && <Check className="h-3 w-3 flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-theme-muted mt-1">{agencyIds.length === 0 ? t('announcements.form.allAgencies') : ''}</p>
        </div>

        {/* Fenêtre */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-theme-secondary block mb-1.5">{t('announcements.form.startsAt')}</label>
            <input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:border-admin-accent" />
          </div>
          <div>
            <label className="text-xs font-medium text-theme-secondary block mb-1.5">{t('announcements.form.endsAt')}</label>
            <input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:border-admin-accent" />
          </div>
        </div>

        {/* CTA optionnel */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-theme-secondary block mb-1.5">{t('announcements.form.ctaLabel')}</label>
            <input type="text" value={ctaLabel} onChange={e => setCtaLabel(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:border-admin-accent" />
          </div>
          <div>
            <label className="text-xs font-medium text-theme-secondary block mb-1.5">{t('announcements.form.ctaHref')}</label>
            <input type="text" value={ctaHref} onChange={e => setCtaHref(e.target.value)} placeholder="/dashboard/..."
              className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:border-admin-accent" />
          </div>
        </div>

        {/* Publication + actions */}
        <div className="flex items-center justify-between pt-2 border-t border-theme-border-subtle">
          <label className="flex items-center gap-2 text-sm text-theme-secondary cursor-pointer">
            <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} className="accent-admin-accent" />
            {t('announcements.form.published')}
          </label>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="h-9 px-4 text-sm text-theme-secondary hover:text-theme-primary transition-colors">{t('common.cancel')}</button>
            <button onClick={handleSave} disabled={pending}
              className="h-9 px-4 text-sm font-medium border border-admin-accent text-admin-accent rounded-lg hover:bg-admin-accent/10 transition-colors disabled:opacity-50">
              {pending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
