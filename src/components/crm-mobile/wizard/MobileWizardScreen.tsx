/**
 * Wizard mobile de création de bien : formulaire principal (export) + primitives
 * UI (Title, SectionLabel, field, Chip, Stepper) + les 4 étapes (StepType,
 * StepLocation, StepSpecs, StepPrice).
 */
import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { useCreateProperty } from '@/hooks/useProperties'
import { CANTONS } from '@/lib/constants'
import { MOBILE_FONT } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'

type WType = 'appartement' | 'maison' | 'villa' | 'terrain'
type WTx = 'vente' | 'location'
type Energy = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

interface WData {
  type: WType | null
  transaction: WTx
  addr: string
  postCode: string
  city: string
  canton: string
  area: number | null
  rooms: number | null
  bedrooms: number | null
  bathrooms: number | null
  year: number | null
  energy: Energy | null
  features: string[]
  price: number | null
  rent: number | null
  charges: number | null
  description: string
  mandateType: '' | 'exclusive' | 'simple'
  publishMode: 'now' | 'draft'
}

const EMPTY: WData = {
  type: null, transaction: 'vente', addr: '', postCode: '', city: '', canton: '',
  area: null, rooms: null, bedrooms: null, bathrooms: null, year: null, energy: null,
  features: [], price: null, rent: null, charges: null, description: '', mandateType: '', publishMode: 'now',
}

const TYPES: { id: WType; icon: MEIconName }[] = [
  { id: 'appartement', icon: 'building' },
  { id: 'maison', icon: 'home' },
  { id: 'villa', icon: 'villa' },
  { id: 'terrain', icon: 'land' },
]
const ENERGY: Energy[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
const ENERGY_TONE: Record<Energy, string> = { A: '#0E9F6E', B: '#4CAF50', C: '#8BC34A', D: '#FBC02D', E: '#FB8C00', F: '#F4511E', G: '#E53935' }
// Valeurs stockées telles quelles (data, comme le desktop) — pas du texte i18n.
const FEATURES = ['Balcon', 'Terrasse', 'Jardin', 'Garage', 'Place de parc', 'Cave', 'Ascenseur', 'Piscine']
const STEPS = 4

// WType (FR) → enum DB `property_type` (EN only : apartment|house|villa|commercial|land).
// Sans ce mapping, 3 tuiles sur 4 violent l'enum et l'insert échoue.
const WTYPE_TO_ENUM: Record<WType, string> = { appartement: 'apartment', maison: 'house', villa: 'villa', terrain: 'land' }

/** Parse une saisie libre en nombre (ne garde que chiffres/point) ; null si vide ou invalide. */
const num = (s: string): number | null => {
  const cleaned = s.replace(/[^\d.]/g, '')
  const n = Number(cleaned)
  return cleaned !== '' && Number.isFinite(n) ? n : null
}

/**
 * Wizard de création de bien (mobile, /dashboard/listings/new) — flux d'ÉCRITURE
 * réel : 4 étapes (type+tx, localisation, caractéristiques, prix+publication) →
 * `useCreateProperty` (insert `properties`, agency_id/created_by injectés par le
 * hook ; titre synthétisé + statut depuis le mode, mapping identique au desktop
 * handlePublish). Différés (plan §6.2) : photos (à ajouter depuis la fiche),
 * extraction IA, staging payant, programmation, lien vendeur (transaction).
 * `demo` (harnais) n'écrit jamais.
 */
export function MobileWizardScreen({ demo = false }: { demo?: boolean }) {
  const navigate = useNavigate()
  const { t } = useTranslation('listings')
  const { tk } = useMobileTokens()
  const createProperty = useCreateProperty()

  const [step, setStep] = useState(0)
  const [d, setD] = useState<WData>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const set = (patch: Partial<WData>) => setD((prev) => ({ ...prev, ...patch }))

  const canNext =
    step === 0 ? !!d.type :
    step === 1 ? d.addr.trim().length > 0 && d.city.trim().length > 0 :
    true
  const priceField = d.transaction === 'vente' ? d.price : d.rent
  const canPublish = d.publishMode === 'draft' || (priceField ?? 0) > 0

  const close = () => navigate('/dashboard/listings')

  async function publish() {
    if (createProperty.isPending) return
    setError(null)
    const status = d.publishMode === 'draft' ? 'draft' : 'active'
    const titleParts = [
      d.type ? d.type.charAt(0).toUpperCase() + d.type.slice(1) : 'Bien',
      d.rooms ? `${d.rooms} pièces` : null,
      d.city || d.addr ? `— ${d.city || d.addr}` : null,
    ].filter(Boolean) as string[]
    if (demo) { setDone(true); return }
    try {
      const created = await createProperty.mutateAsync({
        title: titleParts.join(' '),
        type: d.type ? WTYPE_TO_ENUM[d.type] : 'apartment',
        transaction_type: d.transaction === 'location' ? 'rent' : 'buy',
        status,
        price: (d.transaction === 'vente' ? d.price : d.rent) ?? 0,
        rooms: d.rooms ?? 0,
        bedrooms: d.bedrooms ?? 0,
        bathrooms: d.bathrooms ?? 0,
        surface_m2: d.area ?? 0,
        year_built: d.year ?? undefined,
        charges_monthly: d.transaction === 'location' ? (d.charges ?? undefined) : undefined,
        mandate_type: d.mandateType || undefined,
        energy_class: d.energy ?? null,
        description: d.description || undefined,
        address: d.addr,
        city: d.city,
        canton: d.canton,
        postal_code: d.postCode,
        features: d.features,
      })
      navigate(`/dashboard/listings/${created.id}`)
    } catch {
      setError(t('wizardMobile.publishError'))
    }
  }

  if (done) {
    return (
      <div style={{ fontFamily: MOBILE_FONT, color: tk.ink, minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 28px' }}>
        <div style={{ width: 64, height: 64, borderRadius: 'var(--crm-radius-pill)', background: tk.accent, display: 'grid', placeItems: 'center' }}>
          <MEIcon name="check" size={30} color={tk.accentInk} strokeWidth={2.4} />
        </div>
        <h1 style={{ margin: '20px 0 0', fontSize: 'var(--crm-text-5xl)', fontWeight: 500, letterSpacing: -0.6, color: tk.ink }}>{t('wizardMobile.doneTitle')}</h1>
        <p style={{ margin: '8px 0 0', fontSize: 'var(--crm-text-xl)', fontWeight: 500, color: tk.muted, lineHeight: 1.5 }}>{t('wizardMobile.doneDesc')}</p>
        <button type="button" onClick={close} style={{ marginTop: 24, height: 50, padding: '0 26px', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, background: tk.accent, color: tk.accentInk }}>
          {t('title')}
        </button>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: MOBILE_FONT, color: tk.ink, position: 'relative', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* En-tête + progression */}
      <header style={{ padding: 'calc(env(safe-area-inset-top) + 12px) 16px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)' }}>
          <button type="button" onClick={close} aria-label={t('common:actions.cancel')} style={{ width: 40, height: 40, borderRadius: 'var(--crm-radius-pill)', border: 0, background: tk.card, boxShadow: tk.shadowSm, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <MEIcon name="close" size={20} color={tk.ink} />
          </button>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.muted, fontVariantNumeric: 'tabular-nums' }}>{step + 1} / {STEPS}</span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--crm-space-xs)', marginTop: 12 }}>
          {Array.from({ length: STEPS }).map((_, i) => (
            <span key={i} style={{ flex: 1, height: 4, borderRadius: 'var(--crm-radius-pill)', background: i <= step ? tk.accent : tk.hair }} />
          ))}
        </div>
      </header>

      {/* Contenu */}
      <main style={{ flex: 1, overflowY: 'auto', padding: 'var(--crm-space-5xl) var(--crm-space-4xl) var(--crm-space-7xl)' }}>
        {step === 0 ? <StepType d={d} set={set} tk={tk} t={t} /> : null}
        {step === 1 ? <StepLocation d={d} set={set} tk={tk} t={t} /> : null}
        {step === 2 ? <StepSpecs d={d} set={set} tk={tk} t={t} /> : null}
        {step === 3 ? <StepPrice d={d} set={set} tk={tk} t={t} error={error} /> : null}
      </main>

      {/* Pied de navigation */}
      <footer style={{ flexShrink: 0, display: 'flex', gap: 'var(--crm-space-lg)', padding: '12px 16px calc(18px + env(safe-area-inset-bottom))', background: tk.canvas }}>
        {step > 0 ? (
          <button type="button" onClick={() => setStep((s) => s - 1)} style={{ width: 52, height: 52, borderRadius: 'var(--crm-radius-pill)', border: 0, background: tk.card, boxShadow: tk.shadowSm, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }} aria-label={t('common:actions.back')}>
            <MEIcon name="arrow-left" size={18} color={tk.ink} />
          </button>
        ) : null}
        {step < STEPS - 1 ? (
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setStep((s) => s + 1)}
            style={{ flex: 1, height: 52, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: canNext ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, background: canNext ? tk.accent : tk.cardSubtle, color: canNext ? tk.accentInk : tk.muted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-md)' }}
          >
            {t('wizardMobile.continue')}
            <MEIcon name="arrow-right" size={16} color={canNext ? tk.accentInk : tk.muted} strokeWidth={2} />
          </button>
        ) : (
          <button
            type="button"
            disabled={!canPublish || createProperty.isPending}
            onClick={() => void publish()}
            style={{ flex: 1, height: 52, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: canPublish ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, background: canPublish ? tk.accent : tk.cardSubtle, color: canPublish ? tk.accentInk : tk.muted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-md)' }}
          >
            {createProperty.isPending ? t('wizardMobile.publishing') : d.publishMode === 'draft' ? t('wizardMobile.saveDraft') : t('wizardMobile.publish')}
          </button>
        )}
      </footer>
    </div>
  )
}

// ─── helpers UI ──────────────────────────────────────────────────────────
type Tk = ReturnType<typeof useMobileTokens>['tk']
interface StepProps { d: WData; set: (p: Partial<WData>) => void; tk: Tk; t: TFunction }

/** En-tête d'étape : sur-titre (eyebrow) discret + titre. */
function Title({ tk, eyebrow, children }: { tk: Tk; eyebrow: string; children: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted}}>{eyebrow}</div>
      <h1 style={{ margin: '8px 0 0', fontSize: 'var(--crm-text-5xl)', fontWeight: 500, letterSpacing: -0.8, color: tk.ink, lineHeight: 1.1 }}>{children}</h1>
    </div>
  )
}
/** Intitulé de sous-section (label majuscule discret). */
function SectionLabel({ tk, children }: { tk: Tk; children: string }) {
  return <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: tk.muted, margin: '22px 2px 10px' }}>{children}</div>
}
/** Style partagé des champs texte / select du wizard. */
function field(tk: Tk): CSSProperties {
  return { width: '100%', height: 50, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-xl)', border: `1px solid ${tk.cardBorder}`, outline: 'none', background: tk.card, boxShadow: tk.shadowSm, fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: tk.ink }
}
/** Puce sélectionnable (toggle) — état actif = fond accent. */
function Chip({ tk, on, onClick, children }: { tk: Tk; on: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} style={{ height: 40, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, letterSpacing: -0.2, background: on ? tk.accent : tk.card, color: on ? tk.accentInk : tk.ink, boxShadow: on ? tk.shadow : tk.shadowSm }}>
      {children}
    </button>
  )
}
/** Incrémenteur −/+ pour une valeur numérique (pièces, chambres, salles de bain). */
function Stepper({ tk, label, value, step = 1, onChange }: { tk: Tk; label: string; value: number | null; step?: number; onChange: (v: number | null) => void }) {
  const v = value ?? 0
  return (
    <div style={{ background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-2xl)', boxShadow: tk.shadowSm, padding: 'var(--crm-space-xl) var(--crm-space-2xl)' }}>
      <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: tk.muted}}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <button type="button" onClick={() => onChange(Math.max(0, v - step) || null)} aria-label="−" style={{ width: 36, height: 36, borderRadius: 'var(--crm-radius-pill)', border: 0, background: tk.cardSubtle, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          <MEIcon name="minus" size={16} color={tk.ink} />
        </button>
        <span style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 500, color: tk.ink, fontVariantNumeric: 'tabular-nums' }}>{value ?? '—'}</span>
        <button type="button" onClick={() => onChange(v + step)} aria-label="+" style={{ width: 36, height: 36, borderRadius: 'var(--crm-radius-pill)', border: 0, background: tk.cardSubtle, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          <MEIcon name="plus" size={16} color={tk.ink} />
        </button>
      </div>
    </div>
  )
}

/** Étape 1 : type de bien (4 tuiles) + type de transaction (vente / location). */
function StepType({ d, set, tk, t }: StepProps) {
  return (
    <div>
      <Title tk={tk} eyebrow={t('wizardMobile.step.type')}>{t('wizardMobile.typeTitle')}</Title>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-lg)' }}>
        {TYPES.map((ty) => {
          const on = d.type === ty.id
          return (
            <button key={ty.id} type="button" onClick={() => set({ type: ty.id })} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-3xl)', border: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', background: on ? tk.accent : tk.card, color: on ? tk.accentInk : tk.ink, boxShadow: on ? tk.shadow : tk.shadowSm }}>
              <MEIcon name={ty.icon} size={26} color={on ? tk.accentInk : tk.inkSoft} strokeWidth={1.7} />
              <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, letterSpacing: -0.2 }}>{t(`type.${ty.id === 'appartement' ? 'apartment' : ty.id === 'maison' ? 'house' : ty.id === 'terrain' ? 'land' : 'villa'}`)}</span>
            </button>
          )
        })}
      </div>
      <SectionLabel tk={tk}>{t('wizardMobile.transaction')}</SectionLabel>
      <div style={{ display: 'flex', gap: 'var(--crm-space-md)' }}>
        <Chip tk={tk} on={d.transaction === 'vente'} onClick={() => set({ transaction: 'vente' })}>{t('mobile.txSale')}</Chip>
        <Chip tk={tk} on={d.transaction === 'location'} onClick={() => set({ transaction: 'location' })}>{t('mobile.txRent')}</Chip>
      </div>
    </div>
  )
}

/** Étape 2 : localisation (adresse, NPA, ville, canton). */
function StepLocation({ d, set, tk, t }: StepProps) {
  return (
    <div>
      <Title tk={tk} eyebrow={t('wizardMobile.step.location')}>{t('wizardMobile.locationTitle')}</Title>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
        <input value={d.addr} onChange={(e) => set({ addr: e.target.value })} placeholder={t('wizardMobile.addr')} style={field(tk)} />
        <div style={{ display: 'flex', gap: 'var(--crm-space-lg)' }}>
          <input value={d.postCode} onChange={(e) => set({ postCode: e.target.value })} placeholder={t('wizardMobile.postCode')} inputMode="numeric" style={{ ...field(tk), flex: '0 0 110px' }} />
          <input value={d.city} onChange={(e) => set({ city: e.target.value })} placeholder={t('wizardMobile.city')} style={{ ...field(tk), flex: 1 }} />
        </div>
        <select value={d.canton} onChange={(e) => set({ canton: e.target.value })} style={{ ...field(tk), appearance: 'none' }}>
          <option value="">{t('wizardMobile.canton')}</option>
          {CANTONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>
  )
}

/** Étape 3 : caractéristiques (pièces/surface/chambres/SdB), classe énergétique, prestations. */
function StepSpecs({ d, set, tk, t }: StepProps) {
  const toggleFeature = (f: string) => set({ features: d.features.includes(f) ? d.features.filter((x) => x !== f) : [...d.features, f] })
  return (
    <div>
      <Title tk={tk} eyebrow={t('wizardMobile.step.specs')}>{t('wizardMobile.specsTitle')}</Title>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-lg)' }}>
        <Stepper tk={tk} label={t('mobile.spec.rooms')} value={d.rooms} step={0.5} onChange={(v) => set({ rooms: v })} />
        <div style={{ background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-2xl)', boxShadow: tk.shadowSm, padding: 'var(--crm-space-xl) var(--crm-space-2xl)' }}>
          <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: tk.muted}}>{t('mobile.spec.surface')}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-xs)', marginTop: 8 }}>
            <input value={d.area ?? ''} onChange={(e) => set({ area: num(e.target.value) })} inputMode="numeric" placeholder="—" aria-label={t('mobile.spec.surface')} style={{ width: '100%', border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 'var(--crm-text-4xl)', fontWeight: 500, color: tk.ink, fontVariantNumeric: 'tabular-nums' }} />
            <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.muted }}>{t('mobile.surfaceSuffix')}</span>
          </div>
        </div>
        <Stepper tk={tk} label={t('mobile.spec.beds')} value={d.bedrooms} onChange={(v) => set({ bedrooms: v })} />
        <Stepper tk={tk} label={t('mobile.spec.baths')} value={d.bathrooms} onChange={(v) => set({ bathrooms: v })} />
      </div>

      <SectionLabel tk={tk}>{t('wizardMobile.energy')}</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--crm-space-sm)' }}>
        {ENERGY.map((e) => {
          const on = d.energy === e
          return (
            <button key={e} type="button" onClick={() => set({ energy: on ? null : e })} style={{ padding: 'var(--crm-space-2xl) 0', borderRadius: 'var(--crm-radius-md)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-2xl)', fontWeight: 600, letterSpacing: -0.4, background: on ? ENERGY_TONE[e] : tk.card, color: on ? '#fff' : tk.ink, boxShadow: tk.shadowSm }}>
              {e}
            </button>
          )
        })}
      </div>

      <SectionLabel tk={tk}>{t('wizardMobile.features')}</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-md)' }}>
        {FEATURES.map((f) => <Chip key={f} tk={tk} on={d.features.includes(f)} onClick={() => toggleFeature(f)}>{f}</Chip>)}
      </div>
    </div>
  )
}

/** Étape 4 : prix ou loyer (+ charges), description, mandat, mode de publication. */
function StepPrice({ d, set, tk, t, error }: StepProps & { error: string | null }) {
  const isRent = d.transaction === 'location'
  return (
    <div>
      <Title tk={tk} eyebrow={t('wizardMobile.step.price')}>{t('wizardMobile.priceTitle')}</Title>
      <div style={{ background: tk.card, borderRadius: 'var(--crm-radius-5xl)', boxShadow: tk.shadow, padding: 'var(--crm-space-5xl) var(--crm-space-4xl)' }}>
        <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: tk.muted}}>
          {isRent ? t('wizardMobile.rentLabel') : t('wizardMobile.priceLabel')}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-md)', marginTop: 8 }}>
          <input
            value={(isRent ? d.rent : d.price) ?? ''}
            onChange={(e) => set(isRent ? { rent: num(e.target.value) } : { price: num(e.target.value) })}
            inputMode="numeric"
            placeholder="0"
            style={{ width: '100%', border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 'var(--crm-text-9xl)', fontWeight: 500, letterSpacing: -1.5, color: tk.ink, fontVariantNumeric: 'tabular-nums' }}
          />
          <span style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: tk.muted }}>CHF</span>
        </div>
        {isRent ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginTop: 12 }}>
            <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.muted }}>{t('wizardMobile.charges')}</span>
            <input value={d.charges ?? ''} onChange={(e) => set({ charges: num(e.target.value) })} inputMode="numeric" placeholder="0" style={{ width: 90, height: 38, padding: '0 var(--crm-space-xl)', borderRadius: 'var(--crm-radius-md)', border: `1px solid ${tk.cardBorder}`, outline: 'none', background: tk.cardSubtle, fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: tk.ink, fontVariantNumeric: 'tabular-nums' }} />
            <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.muted }}>{t('wizardMobile.chargesUnit')}</span>
          </div>
        ) : null}
      </div>

      <SectionLabel tk={tk}>{t('mobile.descriptionTitle')}</SectionLabel>
      <textarea value={d.description} onChange={(e) => set({ description: e.target.value })} rows={5} placeholder={t('wizardMobile.descPlaceholder')} style={{ width: '100%', padding: 'var(--crm-space-2xl) var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-2xl)', border: `1px solid ${tk.cardBorder}`, outline: 'none', resize: 'vertical', background: tk.card, boxShadow: tk.shadowSm, fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 500, lineHeight: 1.55, color: tk.ink }} />

      <SectionLabel tk={tk}>{t('wizardMobile.mandate')}</SectionLabel>
      <div style={{ display: 'flex', gap: 'var(--crm-space-md)' }}>
        <Chip tk={tk} on={d.mandateType === 'exclusive'} onClick={() => set({ mandateType: d.mandateType === 'exclusive' ? '' : 'exclusive' })}>{t('wizardMobile.mandateExclusive')}</Chip>
        <Chip tk={tk} on={d.mandateType === 'simple'} onClick={() => set({ mandateType: d.mandateType === 'simple' ? '' : 'simple' })}>{t('wizardMobile.mandateSimple')}</Chip>
      </div>

      <SectionLabel tk={tk}>{t('wizardMobile.publishWhen')}</SectionLabel>
      <div style={{ display: 'flex', gap: 'var(--crm-space-md)' }}>
        <Chip tk={tk} on={d.publishMode === 'now'} onClick={() => set({ publishMode: 'now' })}>{t('wizardMobile.publishNow')}</Chip>
        <Chip tk={tk} on={d.publishMode === 'draft'} onClick={() => set({ publishMode: 'draft' })}>{t('wizardMobile.draft')}</Chip>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginTop: 16, color: tk.muted }}>
        <MEIcon name="camera" size={15} color={tk.muted} />
        <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{t('wizardMobile.photosLater')}</span>
      </div>

      {error ? <div style={{ marginTop: 12, fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.danger }}>{error}</div> : null}
    </div>
  )
}
