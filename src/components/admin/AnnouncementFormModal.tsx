// P8a — Création/édition d'une annonce in-app (super-admin).
// Ciblage plans (segments) + agences (multi-select) + fenêtre + sévérité + CTA.
// Tableaux vides = universel. createPortal via le composant Modal partagé.
//
// Rendu en grammaire Sugar : champs sans bordure décorative (surface creuse +
// filet intérieur), segments à fond plein sur l'accent NOIR (le violet reste le
// repère plateforme, pas une couleur de sélection), publication en interrupteur
// (l'ancienne case à cocher ne disait pas son état au lecteur d'écran).

import { useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, X } from 'lucide-react'
import Modal from '@/components/ui/modal'
import { useToast } from '@/components/ui/Toast'
import { useAdminAgencies } from '@/hooks/useAdminAgencies'
import { useAnnouncementsAdmin, type Announcement, type AnnouncementInput } from '@/hooks/useAnnouncementsAdmin'
import { AdminCard, AdminDivider, AdminGhostBtn, AdminIc, AdminSolidBtn, AdminSwitch } from '@/components/admin/kit/adminKit'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'
import { useAdminSurfaces } from '@/hooks/useAdminSurfaces'
import { crmVoileEncre } from '@/components/crm/tokens'

const PLAN_IDS = ['starter', 'pro', 'entreprise'] as const
const SEVERITIES = ['info', 'warning', 'critical'] as const

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  // yyyy-MM-ddThh:mm pour <input type="datetime-local">
  return iso.slice(0, 16)
}

/** Modale de création/édition d'une annonce plateforme (ciblage, fenêtre, sévérité, CTA). */
export default function AnnouncementFormModal({ existing, onClose }: {
  existing: Announcement | null
  onClose: () => void
}) {
  const { t } = useTranslation('admin')
  const toast = useToast()
  const { agencies } = useAdminAgencies()
  const { create, update } = useAnnouncementsAdmin()
  const { sp, surf, dark } = useAdminSurfaces()

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

  const labelStyle: CSSProperties = {
    display: 'block', marginBottom: 6,
    fontSize: 'var(--crm-text-sm)', fontWeight: 600, letterSpacing: 0.2, color: sp.sub,
  }
  // Champ Sugar : pas de bordure, une surface creuse et un filet INTÉRIEUR — le
  // trait ne sépare rien, l'ombre du bento s'en charge.
  const fieldStyle: CSSProperties = {
    width: '100%', height: 38, padding: '0 var(--crm-space-xl)', borderRadius: ADMIN_RADII.row, border: 0,
    background: surf.cardSub, color: sp.ink,
    fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, outline: 'none',
    boxShadow: `0 0 0 1.5px ${crmVoileEncre(dark, 0.07)} inset`,
  }
  /** Segment de sélection (sévérité, plans) — accent plein quand actif. */
  const segmentStyle = (on: boolean): CSSProperties => ({
    height: 32, padding: '0 var(--crm-space-2xl)', borderRadius: ADMIN_RADII.pill, border: 0, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap',
    background: on ? sp.accent : surf.cardSub, color: on ? sp.accentInk : sp.soft,
  })
  const hintStyle: CSSProperties = { margin: '6px 0 0', fontSize: 'var(--crm-text-sm)', color: sp.soft }

  // Survol des options et couleur du placeholder : deux choses qu'un style inline
  // ne sait pas exprimer, et qui doivent suivre le thème.
  const menuCss = `
    .annf-opt { transition: background-color .14s ease; }
    .annf-opt:hover { background: ${crmVoileEncre(dark, 0.05)}; }
    .annf-search::placeholder { color: ${sp.soft}; }
  `

  return (
    <Modal open onClose={onClose} title={existing ? t('announcements.form.editTitle') : t('announcements.form.newTitle')} size="md">
      {/* `space-y-4` pose une marge sur tous les enfants sauf le premier : la
          feuille de style se met en DERNIER, sinon elle décale tout le corps. */}
      <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-hide">
        {/* Titre + corps */}
        <div>
          <label style={labelStyle}>{t('announcements.form.title')}</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} autoFocus style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t('announcements.form.body')}</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={3}
            style={{ ...fieldStyle, height: 'auto', padding: 'var(--crm-space-lg) var(--crm-space-xl)', lineHeight: 1.5, resize: 'none' }} />
        </div>

        {/* Sévérité */}
        <div>
          <label style={labelStyle}>{t('announcements.form.severity')}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)' }}>
            {SEVERITIES.map(s => (
              <button key={s} onClick={() => setSeverity(s)} aria-pressed={severity === s} style={segmentStyle(severity === s)}>
                {t(`announcements.severity.${s}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Ciblage plans */}
        <div>
          <label style={labelStyle}>{t('announcements.form.plans')}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)' }}>
            {PLAN_IDS.map(p => (
              <button key={p} onClick={() => togglePlan(p)} aria-pressed={plans.includes(p)} style={segmentStyle(plans.includes(p))}>
                {t(`common.plan.${p}`)}
              </button>
            ))}
          </div>
          <p style={hintStyle}>{plans.length === 0 ? t('announcements.form.allPlans') : ''}</p>
        </div>

        {/* Ciblage agences */}
        <div>
          <label style={labelStyle}>{t('announcements.form.agencies')}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--crm-space-sm)' }}>
            {agencyIds.map(id => (
              <span key={id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', height: 28, padding: '0 var(--crm-space-xs) 0 var(--crm-space-lg)',
                borderRadius: ADMIN_RADII.pill, background: surf.cardSub, color: sp.ink,
                fontSize: 'var(--crm-text-sm)', fontWeight: 600, maxWidth: '100%',
              }}>
                <span className="truncate" style={{ maxWidth: 140 }}>{agencies.find(a => a.id === id)?.name ?? id}</span>
                <button onClick={() => toggleAgency(id)} style={{
                  width: 20, height: 20, borderRadius: ADMIN_RADII.pill, border: 0, padding: 0,
                  background: 'transparent', color: sp.sub, cursor: 'pointer', display: 'grid', placeItems: 'center',
                }}>
                  <AdminIc icon={X} size={12} />
                </button>
              </span>
            ))}
            <div className="relative">
              <button onClick={() => setAgencyOpen(o => !o)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 28, padding: '0 var(--crm-space-xl)',
                borderRadius: ADMIN_RADII.pill, border: 0, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, whiteSpace: 'nowrap',
                color: sp.ink, background: surf.card, boxShadow: sp.shadowSm,
              }}>
                {t('announcements.form.addAgency')}
                <AdminIc icon={ChevronDown} size={13} style={{ transform: agencyOpen ? 'rotate(180deg)' : 'none', transition: 'transform .18s ease' }} />
              </button>
              {agencyOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAgencyOpen(false)} />
                  {/* `overflow: hidden` : sans lui, le survol d'une option déborde du rayon 18 de la carte. */}
                  {/* Menu déroulant = surface flottante : palier haut opaque,
                      sinon il se confond avec la carte de la modale dessous. */}
                  <AdminCard className="absolute left-0 top-full z-20" padding="7px 0"
                    style={{ marginTop: 6, width: 240, overflow: 'hidden', background: sp.solidBg, boxShadow: sp.solidShadow }}>
                    <div style={{ padding: '0 var(--crm-space-md) var(--crm-space-sm)' }}>
                      <input type="text" value={agencySearch} onChange={e => setAgencySearch(e.target.value)}
                        placeholder={t('announcements.form.searchAgency')}
                        className="annf-search"
                        style={{
                          width: '100%', height: 30, padding: '0 var(--crm-space-lg)', borderRadius: ADMIN_RADII.row, border: 0,
                          background: surf.cardSub, color: sp.ink, outline: 'none',
                          fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
                        }} />
                    </div>
                    <div className="max-h-48 overflow-y-auto scrollbar-hide">
                      {filteredAgencies.slice(0, 40).map(a => {
                        const on = agencyIds.includes(a.id)
                        return (
                          <button key={a.id} onClick={() => toggleAgency(a.id)} className="annf-opt" style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-md)',
                            padding: 'var(--crm-space-sm) var(--crm-space-xl)', border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left',
                            fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: on ? 600 : 500, color: on ? sp.ink : sp.sub,
                          }}>
                            <span className="truncate">{a.name}</span>
                            {on && <AdminIc icon={Check} size={13} color={sp.ink} />}
                          </button>
                        )
                      })}
                    </div>
                  </AdminCard>
                </>
              )}
            </div>
          </div>
          <p style={hintStyle}>{agencyIds.length === 0 ? t('announcements.form.allAgencies') : ''}</p>
        </div>

        {/* Fenêtre */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>{t('announcements.form.startsAt')}</label>
            <input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)}
              style={{ ...fieldStyle, fontVariantNumeric: 'tabular-nums' }} />
          </div>
          <div>
            <label style={labelStyle}>{t('announcements.form.endsAt')}</label>
            <input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)}
              style={{ ...fieldStyle, fontVariantNumeric: 'tabular-nums' }} />
          </div>
        </div>

        {/* CTA optionnel */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>{t('announcements.form.ctaLabel')}</label>
            <input type="text" value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('announcements.form.ctaHref')}</label>
            <input type="text" value={ctaHref} onChange={e => setCtaHref(e.target.value)} placeholder="/dashboard/..." style={fieldStyle} />
          </div>
        </div>

        {/* Publication + actions */}
        <div>
          <AdminDivider margin="4px 0 0" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-xl)', paddingTop: 'var(--crm-space-2xl)' }}>
            {/* `<label>` et non `<div>` : `<button>` est un élément « labelable »,
                donc le libellé nomme l'interrupteur ET lui renvoie le clic — ce que
                faisait l'ancienne case à cocher enveloppée. D'où l'absence
                d'`aria-label` sur l'interrupteur : il doublerait l'annonce du même
                mot (une fois comme nom, une fois comme texte voisin). */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', minWidth: 0, cursor: 'pointer' }}>
              <AdminSwitch on={published} onClick={() => setPublished(!published)} />
              <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }}>{t('announcements.form.published')}</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', flexShrink: 0 }}>
              <AdminGhostBtn onClick={onClose}>{t('common.cancel')}</AdminGhostBtn>
              <AdminSolidBtn onClick={handleSave} disabled={pending}>
                {pending ? t('common.saving') : t('common.save')}
              </AdminSolidBtn>
            </div>
          </div>
        </div>

        <style>{menuCss}</style>
      </div>
    </Modal>
  )
}
