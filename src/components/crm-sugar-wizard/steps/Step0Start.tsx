// MEGGA CRM Sugar v2 Wizard — Step 0 : Démarrer
// Port du handoff « complet » (crm-wizard-sugar-v2.jsx — `SgStepStart` + `SgPorteCard`).
//
// Trois portes ÉGALES et centrées (SgPorteCard : ring noir 2px inset à la sélection,
// pilule « Sélectionné », aucune animation de survol). Titre centré unique — l'eyebrow,
// le sous-titre et la note d'autosave du port précédent tombent (l'indicateur d'autosave
// vit désormais dans le footer du shell).
//
// Le panneau « Reprendre une soumission » lit les vraies soumissions vendeur via
// useSellerLeads (table `seller_leads`, alimentée par le formulaire public `/sell`) —
// aucune donnée mock. Cap système : 5 soumissions (les plus récentes).
//
// ⛔ La porte « Importer un mandat » reste DÉSACTIVÉE : l'extraction PDF réelle n'est
// pas branchée et l'ancien chemin injectait un mandat FICTIF en base (fabrication
// compliance interdite). Le handoff la montre active ; on garde la désactivation
// (divergence d'honnêteté assumée) jusqu'à un vrai OCR (Gemini).

import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { SugarV2, type WizardData } from '../tokens'
import { SgIcon } from '../primitives'
import { useSellerLeads, type SellerLeadRow } from '@/hooks/useSellerLeads'

interface CrmSubmission {
  id: string
  title: string
  contactId?: string
  contactDraft?: { firstName: string; lastName: string; email: string; phone: string }
  // Affichage du contact (nom/email/tél) toujours présent — sert de snapshot
  // _ownerContact quand la soumission a déjà un contact_id (le chemin saute
  // Step1Vendor, donc rien ne peuple le registry en aval).
  contactDisplay: { firstName: string; lastName: string; email: string; phone: string }
  type: 'appartement' | 'maison' | 'villa' | 'terrain'
  transaction: 'vente' | 'location'
  addr: string
  canton: string
  area: number
  rooms: number
  beds: number
  baths: number
  year: number
  energy: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  features: string[]
  desc: string
  askingPrice: number
  accent: string
  receivedAt: string
}

function mapPropertyType(raw: string): CrmSubmission['type'] {
  const t = (raw || '').toLowerCase()
  if (t.includes('villa')) return 'villa'
  if (t.includes('house') || t.includes('maison')) return 'maison'
  if (t.includes('land') || t.includes('terrain')) return 'terrain'
  return 'appartement'
}

function leadToSubmission(lead: SellerLeadRow): CrmSubmission {
  const fullName = lead.contact_name.trim().split(/\s+/)
  const askingPrice =
    lead.estimation_median ?? lead.estimation_max ?? lead.estimation_min ?? 0
  const accents = ['#0041D9', '#E53935', '#10B981', '#F59E0B', '#7C3AED']
  const accentIdx = lead.id.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) % accents.length
  return {
    id: lead.id,
    title: `${lead.property_data.type} · ${lead.property_data.city}`,
    contactId: lead.contact_id ?? undefined,
    contactDraft: lead.contact_id
      ? undefined
      : {
          firstName: fullName[0] || '',
          lastName: fullName.slice(1).join(' ') || '',
          email: lead.contact_email,
          phone: lead.contact_phone ?? '',
        },
    contactDisplay: {
      firstName: fullName[0] || '',
      lastName: fullName.slice(1).join(' ') || '',
      email: lead.contact_email,
      phone: lead.contact_phone ?? '',
    },
    type: mapPropertyType(lead.property_data.type),
    transaction: 'vente',
    addr: lead.property_data.address,
    canton: lead.property_data.canton,
    area: lead.property_data.surface,
    rooms: Math.floor(Number.parseFloat(lead.property_data.rooms) || 0),
    beds: 0,
    baths: 0,
    year: 0,
    energy: 'C',
    features: [],
    desc: lead.motivation || '',
    askingPrice,
    accent: accents[accentIdx],
    receivedAt: lead.created_at,
  }
}

interface StepProps { data: WizardData; set: (patch: Partial<WizardData>) => void }

// ─── Porte « Trois portes épurées » — centrée, CTA par carte ──────────────
// Sélection Sugar : ring noir 2px inset + fond cardSubtle. Aucune animation de survol.
interface PorteCardProps {
  media: ReactNode
  title: string
  sub: string
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
  ctaLabel: string
  selectedLabel: string
  children?: ReactNode
}

function SgPorteCard({
  media, title, sub, selected, disabled, onClick, ctaLabel, selectedLabel, children,
}: PorteCardProps) {
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => { if (!disabled) onClick?.() }}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick?.() }
      }}
      style={{
        flex: 1, minWidth: 0,
        background: selected ? SugarV2.cardSubtle : SugarV2.card,
        borderRadius: 'var(--crm-radius-5xl)',
        boxShadow: selected ? `0 0 0 2px ${SugarV2.black} inset, ${SugarV2.shadow}` : SugarV2.shadow,
        padding: '38px 28px 30px',
        textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        outline: 'none',
      }}
    >
      {media}
      <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.3, marginTop: 22 }}>{title}</div>
      <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: SugarV2.inkSoft, lineHeight: 1.5, marginTop: 8, maxWidth: 260 }}>{sub}</div>
      <span style={{
        marginTop: 26, height: 42, padding: '0 26px', borderRadius: 'var(--crm-radius-pill)',
        display: 'inline-flex', alignItems: 'center',
        background: selected ? SugarV2.black : SugarV2.cardSubtle,
        color: selected ? SugarV2.onBlack : SugarV2.ink,
        fontSize: 'var(--crm-text-lg)', fontWeight: 700,
        boxShadow: selected ? 'none' : SugarV2.shadowSm,
      }}>{selected ? selectedLabel : ctaLabel}</span>
      {children}
    </div>
  )
}

export function Step0Start({ data, set }: StepProps) {
  const { t } = useTranslation('listings')
  // Filtre status='new' : seules les soumissions encore à traiter (les autres
  // sont déjà converties en mandat ou perdues).
  const { data: leads = [] } = useSellerLeads('new')
  const subs = useMemo(() => leads.map(leadToSubmission), [leads])

  const selectSubmission = (sub: CrmSubmission) => {
    let ownerId: string | null = null
    let newContact: WizardData['_newContact'] = null
    let ownerContact: WizardData['_ownerContact'] = null
    if (sub.contactId) {
      ownerId = sub.contactId
      // Contact existant → snapshot d'affichage pour les étapes aval (ce chemin
      // saute Step1Vendor ; sans snapshot le vendeur s'afficherait « — »).
      ownerContact = {
        id: sub.contactId, type: 'seller',
        firstName: sub.contactDisplay.firstName, lastName: sub.contactDisplay.lastName,
        email: sub.contactDisplay.email, phone: sub.contactDisplay.phone,
        kyc: { status: 'none' },
        avatarBg: sub.accent || '#0041D9',
      }
    } else if (sub.contactDraft) {
      const id = `c-from-${sub.id}`
      newContact = {
        id, type: 'seller',
        firstName: sub.contactDraft.firstName, lastName: sub.contactDraft.lastName,
        email: sub.contactDraft.email, phone: sub.contactDraft.phone,
        kyc: { status: 'none' },
        avatarBg: sub.accent || '#0041D9',
      }
      ownerId = id
    }
    set({
      source: 'submission',
      fromSubmissionId: sub.id,
      ownerContactId: ownerId,
      _newContact: newContact,
      _ownerContact: ownerContact,
      type: sub.type, transaction: sub.transaction,
      addr: sub.addr, canton: sub.canton,
      area: sub.area, rooms: sub.rooms, bedrooms: sub.beds, bathrooms: sub.baths,
      year: sub.year, energy: sub.energy,
      features: sub.features, description: sub.desc,
      price: sub.askingPrice,
    })
  }

  const subName = (sub: CrmSubmission): string =>
    sub.contactDisplay.firstName || sub.contactDisplay.lastName
      ? `${sub.contactDisplay.firstName} ${sub.contactDisplay.lastName}`.trim()
      : t('wizard.step0.submissions.unknownVendor')
  const subInitials = (name: string): string =>
    name.split(' ').filter(Boolean).map(p => p[0]).join('').substring(0, 2).toUpperCase()

  const subSelected = data.source === 'submission'
  // Limite système : 5 soumissions max reprises dans le wizard (les plus récentes).
  const SUB_CAP = 5
  const subsShown = [...subs]
    .sort((a, b) => +new Date(b.receivedAt || 0) - +new Date(a.receivedAt || 0))
    .slice(0, SUB_CAP)
  const subsHidden = subs.length - subsShown.length

  const iconCircle = (name: 'edit' | 'upload' | 'inbox'): ReactNode => (
    <div style={{
      width: 64, height: 64, borderRadius: 'var(--crm-radius-pill)',
      background: SugarV2.cardSubtle, boxShadow: SugarV2.shadowSm,
      display: 'grid', placeItems: 'center', flexShrink: 0,
    }}>
      <SgIcon name={name} size={24} stroke={SugarV2.black} />
    </div>
  )

  return (
    <div style={{
      maxWidth: 1060, margin: '0 auto', paddingTop: 'var(--crm-space-2xl)',
      animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
    }}>
      <h1 style={{
        margin: 0, fontSize: 'var(--crm-text-9xl)', fontWeight: 700, textAlign: 'center',
        color: SugarV2.ink, letterSpacing: -0.8, lineHeight: 1.1,
      }}>
        {t('wizard.step0.title')}
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--crm-space-6xl)', marginTop: 48, alignItems: 'start' }}>
        {/* Porte 1 — Saisir manuellement (recommandée) */}
        <SgPorteCard
          media={iconCircle('edit')}
          title={t('wizard.step0.manual.title')}
          sub={t('wizard.step0.manual.sub')}
          selected={data.source === 'manual'}
          ctaLabel={t('wizard.porte.choose')}
          selectedLabel={t('wizard.porte.selected')}
          onClick={() => set({ source: 'manual', fromSubmissionId: null, ownerContactId: null })}
        />

        {/* Porte 2 — Importer un mandat : DÉSACTIVÉE (compliance, cf. en-tête). */}
        <SgPorteCard
          disabled
          media={iconCircle('upload')}
          title={t('wizard.step0.import.title')}
          sub={t('wizard.step0.import.sub')}
          ctaLabel={t('wizard.step0.import.soon')}
          selectedLabel={t('wizard.porte.selected')}
        />

        {/* Porte 3 — Reprendre une soumission (vraies soumissions vendeur, cap 5) */}
        <SgPorteCard
          media={
            subs.length > 0 ? (
              <div style={{ display: 'flex', height: 64, alignItems: 'center' }}>
                {subs.slice(0, 3).map((sub, i) => (
                  <span key={sub.id} style={{
                    width: 40, height: 40, borderRadius: 'var(--crm-radius-pill)',
                    background: sub.accent || '#0041D9', color: '#fff',
                    display: 'grid', placeItems: 'center',
                    fontSize: 'var(--crm-text-md)', fontWeight: 800,
                    marginLeft: i === 0 ? 0 : -12,
                    boxShadow: `0 0 0 3px ${subSelected ? SugarV2.cardSubtle : SugarV2.card}`,
                  }}>{subInitials(subName(sub))}</span>
                ))}
                {subs.length > 3 && (
                  <span style={{
                    width: 40, height: 40, borderRadius: 'var(--crm-radius-pill)',
                    background: subSelected ? SugarV2.card : SugarV2.cardSubtle, color: SugarV2.inkSoft,
                    display: 'grid', placeItems: 'center',
                    fontSize: 'var(--crm-text-md)', fontWeight: 800, marginLeft: -12,
                    boxShadow: `0 0 0 3px ${subSelected ? SugarV2.cardSubtle : SugarV2.card}`,
                  }}>+{subs.length - 3}</span>
                )}
              </div>
            ) : iconCircle('inbox')
          }
          title={t('wizard.step0.submissions.title')}
          sub={subs.length > 0
            ? t('wizard.step0.submissions.subtitle', { count: subs.length })
            : t('wizard.step0.submissions.emptyBody')}
          selected={subSelected}
          disabled={subs.length === 0}
          ctaLabel={t('wizard.porte.choose')}
          selectedLabel={subSelected && !data.fromSubmissionId
            ? t('wizard.step0.submissions.selectVendor')
            : t('wizard.porte.selected')}
          onClick={() => { if (!subSelected) set({ source: 'submission', fromSubmissionId: null, ownerContactId: null }) }}
        >
          {subSelected && subs.length > 0 && (
            <div style={{
              width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)', marginTop: 22,
              maxHeight: 264, overflowY: 'auto',
              animation: 'sgFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
            }}>
              {subsShown.map((sub) => {
                const name = subName(sub)
                const sel = data.fromSubmissionId === sub.id
                return (
                  <button
                    key={sub.id}
                    onClick={(e) => { e.stopPropagation(); selectSubmission(sub) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)',
                      padding: 'var(--crm-space-lg) var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-xl)', border: 0,
                      background: sel ? SugarV2.black : SugarV2.card,
                      color: sel ? SugarV2.onBlack : SugarV2.ink,
                      fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
                      boxShadow: sel ? 'none' : SugarV2.shadowSm,
                    }}
                  >
                    <span style={{
                      width: 30, height: 30, borderRadius: 'var(--crm-radius-pill)',
                      background: sub.accent || '#0041D9', color: '#fff',
                      display: 'grid', placeItems: 'center',
                      fontSize: 'var(--crm-text-xs)', fontWeight: 800, flexShrink: 0,
                    }}>{subInitials(name)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        display: 'block', fontSize: 'var(--crm-text-lg)', fontWeight: 700, letterSpacing: -0.2,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{name}</span>
                    </span>
                    {sel && <SgIcon name="check" size={14} stroke={SugarV2.onBlack} />}
                  </button>
                )
              })}
              {subsHidden > 0 && (
                <div style={{ padding: 'var(--crm-space-md) var(--crm-space-2xl) var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: SugarV2.muted, textAlign: 'center' }}>
                  {t('wizard.step0.submissions.cap', { count: subsHidden })}
                </div>
              )}
            </div>
          )}
        </SgPorteCard>
      </div>
    </div>
  )
}
