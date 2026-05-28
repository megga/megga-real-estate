// MEGGA CRM Sugar v2 Wizard — Step 0 : Démarrer
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-v2.jsx — `SgStepStart`).
//
// Le panneau "Reprendre une soumission" lit les vraies soumissions vendeur
// via useSellerLeads (table `seller_leads`, alimentée par le formulaire
// public `/sell`). Plus de CRM_SUBMISSIONS mock — chaque agence voit ses
// propres leads vendeur (filter status='new').

import { useMemo, useState } from 'react'
import { SugarV2, type WizardData } from '../tokens'
import { SgGateCard, SgIcon } from '../primitives'
import { useSellerLeads, type SellerLeadRow } from '@/hooks/useSellerLeads'

interface CrmSubmission {
  id: string
  title: string
  contactId?: string
  contactDraft?: { firstName: string; lastName: string; email: string; phone: string }
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

export function Step0Start({ data, set }: StepProps) {
  // Filtre status='new' : seules les soumissions encore à traiter (les autres
  // sont déjà converties en mandat ou perdues).
  const { data: leads = [] } = useSellerLeads('new')
  const subs = useMemo(() => leads.map(leadToSubmission), [leads])

  return (
    <div style={{
      maxWidth: 1100, margin: '0 auto',
      animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
    }}>
      {/* Header de page */}
      <div style={{ marginBottom: 48, maxWidth: 720 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: SugarV2.muted,
          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
        }}>Étape 1 sur 8 · Démarrer</div>
        <h1 style={{
          margin: '0 0 14px', fontSize: 38, fontWeight: 700,
          color: SugarV2.ink, letterSpacing: -0.8, lineHeight: 1.1,
        }}>
          Comment souhaitez-vous créer ce bien&nbsp;?
        </h1>
        <p style={{
          margin: 0, fontSize: 15, color: SugarV2.inkSoft,
          fontWeight: 500, lineHeight: 1.55,
        }}>
          Trois manières d'aller vite. Le contenu sera ensuite affiné étape par étape.
        </p>
      </div>

      {/* 3 portes — la recommandée à gauche prend plus d'espace */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.15fr 1fr 1.4fr',
        gap: 22,
      }}>
        <div style={{ display: 'flex' }}>
          <SgGateCard
            recommended
            icon={<SgIcon name="edit" size={26} stroke={SugarV2.black} />}
            title="Saisir manuellement"
            sub="Vous remplissez chaque section. Idéal quand vous connaissez le bien et avez les éléments en main."
            onClick={() => set({ source: 'manual', fromSubmissionId: null, ownerContactId: null })} />
        </div>
        <div style={{ display: 'flex' }}>
          <SgGateCard
            icon={<SgIcon name="upload" size={26} stroke={SugarV2.black} />}
            title="Importer un mandat"
            sub="PDF de mandat. MEGGA AI extrait les infos pour pré-remplir."
            onClick={() => set({ source: 'import', fromSubmissionId: null, ownerContactId: null })} />
        </div>
        <div style={{ display: 'flex' }}>
          <SubmissionsCard subs={subs} data={data} set={set} />
        </div>
      </div>

      {/* Note discrète en bas */}
      <div style={{
        marginTop: 56, padding: '20px 24px',
        background: 'transparent',
        display: 'flex', alignItems: 'center', gap: 14,
        color: SugarV2.muted, fontSize: 13, fontWeight: 500,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 999,
          background: SugarV2.cardSubtle,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <SgIcon name="check" size={16} stroke={SugarV2.inkSoft} />
        </div>
        <div>
          <div style={{ color: SugarV2.ink, fontWeight: 600, marginBottom: 2 }}>
            Brouillon sauvegardé automatiquement
          </div>
          Vous pouvez fermer le wizard à tout moment, vos données restent.
        </div>
      </div>
    </div>
  )
}

// ─── Card "Reprendre une soumission" ────────────────────────────────────
function SubmissionsCard({
  subs, data, set,
}: { subs: CrmSubmission[]; data: WizardData; set: (patch: Partial<WizardData>) => void }) {
  const [hover, setHover] = useState<string | null>(null)

  if (subs.length === 0) {
    return (
      <div style={{
        background: SugarV2.card, borderRadius: 28, padding: 28,
        boxShadow: SugarV2.shadow, opacity: 0.55, cursor: 'not-allowed',
        flex: 1, display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: SugarV2.cardSubtle,
          display: 'grid', placeItems: 'center',
        }}>
          <SgIcon name="inbox" size={26} stroke={SugarV2.muted} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: SugarV2.muted, letterSpacing: -0.3 }}>
          Aucune soumission
        </div>
        <div style={{ fontSize: 13, color: SugarV2.muted, fontWeight: 500, lineHeight: 1.5 }}>
          Aucun particulier n'a soumis de bien pour le moment.
        </div>
      </div>
    )
  }

  const selectSubmission = (sub: CrmSubmission) => {
    let ownerId: string | null = null
    let newContact: WizardData['_newContact'] = null
    if (sub.contactId) {
      ownerId = sub.contactId
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
      type: sub.type, transaction: sub.transaction,
      addr: sub.addr, canton: sub.canton,
      area: sub.area, rooms: sub.rooms, bedrooms: sub.beds, bathrooms: sub.baths,
      year: sub.year, energy: sub.energy,
      features: sub.features, description: sub.desc,
      price: sub.askingPrice,
    })
  }

  const isSelected = data.source === 'submission'

  return (
    <div style={{
      background: isSelected ? SugarV2.black : SugarV2.card, color: isSelected ? '#fff' : SugarV2.ink,
      borderRadius: 28, padding: 22,
      boxShadow: isSelected
        ? '0 24px 60px rgba(11,12,14,0.30), 0 4px 16px rgba(11,12,14,0.15)'
        : SugarV2.shadow,
      flex: 1, display: 'flex', flexDirection: 'column', gap: 14,
      transition: 'all .25s cubic-bezier(.2,.8,.2,1)',
      transform: isSelected ? 'translateY(-3px)' : 'translateY(0)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '6px 6px 0' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: isSelected ? 'rgba(255,255,255,0.10)' : SugarV2.cardSubtle,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <SgIcon name="inbox" size={26} stroke={isSelected ? '#fff' : SugarV2.black} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3, marginBottom: 2 }}>
            Reprendre une soumission
          </div>
          <div style={{
            fontSize: 12.5, fontWeight: 500, lineHeight: 1.45,
            color: isSelected ? 'rgba(255,255,255,0.7)' : SugarV2.inkSoft,
          }}>
            {subs.length} particuliers ont soumis leur bien. Sélectionnez-en un pour pré-remplir.
          </div>
        </div>
      </div>

      {/* Liste des soumissions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
        {subs.map(sub => {
          const sel = data.fromSubmissionId === sub.id
          // Pas de lookup CRM_CONTACTS — seller_leads embarque contact_name +
          // contact_email + contact_phone directement, donc contactDraft est
          // toujours rempli côté adapter leadToSubmission().
          const name = sub.contactDraft
            ? `${sub.contactDraft.firstName} ${sub.contactDraft.lastName}`
            : 'Vendeur inconnu'
          const initials = name.split(' ').filter(Boolean).map(p => p[0]).join('').substring(0, 2).toUpperCase()

          return (
            <button key={sub.id}
              onClick={e => { e.stopPropagation(); selectSubmission(sub) }}
              onMouseEnter={() => setHover(sub.id)}
              onMouseLeave={() => setHover(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 14, border: 0,
                background: sel
                  ? (isSelected ? 'rgba(255,255,255,0.16)' : SugarV2.black)
                  : (hover === sub.id
                      ? (isSelected ? 'rgba(255,255,255,0.08)' : SugarV2.cardSubtle)
                      : (isSelected ? 'rgba(255,255,255,0.04)' : 'transparent')),
                color: sel
                  ? '#fff'
                  : (isSelected ? '#fff' : SugarV2.ink),
                fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
                transition: 'all .18s ease',
              }}>
              <div style={{
                width: 32, height: 32, borderRadius: 999,
                background: sub.accent || '#0041D9',
                color: '#fff', display: 'grid', placeItems: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 700, letterSpacing: -0.2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 1,
                }}>
                  {name}
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 500,
                  color: sel
                    ? (isSelected ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.75)')
                    : (isSelected ? 'rgba(255,255,255,0.55)' : SugarV2.muted),
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {sub.title}
                </div>
              </div>
              {sel && (
                <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>✓</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
