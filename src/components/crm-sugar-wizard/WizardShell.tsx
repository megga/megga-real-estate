// MEGGA CRM Sugar v2 Wizard — Shell.
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-v2.jsx — `CRMWizardSugarV2`).

import { useState, useEffect, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import {
  SugarV2, setSugarV2Dark, EMPTY_WIZARD, SG_STEPS, SG_KEYFRAMES, type WizardData,
} from './tokens'
import {
  SgIcon, SgCircleBtn, SgBlackPill, SgGhostPill,
} from './primitives'
import { useTheme } from '@/hooks/useTheme'
import { Step0Start } from './steps/Step0Start'
import { Step1Vendor } from './steps/Step1Vendor'
import { Step1Mandate } from './steps/Step1Mandate'
import { Step2Address } from './steps/Step2Address'
import { Step3Specs } from './steps/Step3Specs'
import { Step4Photos } from './steps/Step4Photos'
import { Step5PriceDesc } from './steps/Step5PriceDesc'
import { Step6Options } from './steps/Step6Options'
import { Step7Publish } from './steps/Step7Publish'
import { Step8Success } from './steps/Step8Success'
import { useCreateProperty } from '@/hooks/useProperties'
import { useCreateContact } from '@/hooks/useContacts'
import { useCreateTransaction } from '@/hooks/useTransactions'
import { useAuth } from '@/hooks/useAuth'

// Mock-ID guard — Step1Vendor's saveNew assigns `c-new-${Date.now()}` to
// `data.ownerContactId` when the agent fills the inline new-contact form.
// We detect that here so handlePublish knows to create the contact first
// before linking it via a transaction row.
const NEW_CONTACT_PREFIX = 'c-new-'

interface WizardShellProps {
  onClose: () => void
}

export default function WizardShell({ onClose }: WizardShellProps) {
  const { t } = useTranslation('listings')
  // Le wizard suit le mode clair/sombre du CRM. On bascule le thème actif lu par
  // le Proxy SugarV2 AU RENDER (avant que les step files lisent leurs couleurs),
  // exactement comme le prototype Sugar (window.__setSugarV2Dark).
  const { theme } = useTheme()
  const dark = theme === 'dark'
  // Épingle le thème du wizard sur celui de l'app. Quand l'override est levé (cleanup),
  // le Proxy retombe sur `data-theme` — donc aucun render concurrent ne lit du périmé.
  setSugarV2Dark(dark)
  // À la fermeture, on rend la main au thème de l'app (null = suivre `data-theme`).
  useEffect(() => () => { setSugarV2Dark(null) }, [])

  const [step, setStep] = useState(0)
  const [subStep, setSubStep] = useState(0)        // 0 = Vendeur, 1 = Mandat
  const [published, setPublished] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [data, setDataRaw] = useState<WizardData>(EMPTY_WIZARD)
  const set = (patch: Partial<WizardData>) => setDataRaw(prev => ({ ...prev, ...patch }))

  const { profile } = useAuth()
  const createProperty = useCreateProperty()
  const createContact = useCreateContact()
  const createTransaction = useCreateTransaction()

  // Map the wizard's publishMode to the (status, published_at) pair the
  // properties table expects. There's no scheduled-publish backend yet,
  // so 'schedule' is persisted as 'draft' — separate chip to wire a real
  // cron-based publication when the feature is designed.
  async function handlePublish() {
    if (createProperty.isPending || createContact.isPending || createTransaction.isPending) return
    setPublishError(null)

    const status =
      data.publishMode === 'draft' ? 'draft'
      : data.publishMode === 'schedule' ? 'draft'
      : 'active'

    // Build a readable title from the address. The DB column is NOT NULL,
    // so we synthesize one (the agent can rename later from the listing
    // detail page).
    const titleParts = [
      data.type ? data.type.charAt(0).toUpperCase() + data.type.slice(1) : 'Bien',
      data.rooms ? `${data.rooms} pièces` : null,
      data.city || data.addr ? `— ${data.city || data.addr}` : null,
    ].filter(Boolean)
    const title = titleParts.join(' ')

    try {
      // 1) Resolve the vendor contact_id. If the agent created a new vendor
      // inline (Step 1 — `_newContact` populated with a `c-new-…` mock id),
      // persist it first and use the real id. Otherwise use the existing
      // selected contact id. Without this, the new vendor used to be
      // silently dropped — property published with NO linkage (data loss).
      let sellerContactId: string | null = null
      if (
        data._newContact &&
        data.ownerContactId &&
        data.ownerContactId.startsWith(NEW_CONTACT_PREFIX)
      ) {
        const newC = await createContact.mutateAsync({
          firstName: data._newContact.firstName,
          lastName: data._newContact.lastName,
          email: data._newContact.email,
          phone: data._newContact.phone || undefined,
          type: 'seller',
          source: 'manual',
        })
        sellerContactId = newC.id
      } else if (
        data.ownerContactId &&
        !data.ownerContactId.startsWith(NEW_CONTACT_PREFIX)
      ) {
        sellerContactId = data.ownerContactId
      }

      // 2) Create the property (no direct vendor column — link comes via
      // a transactions row below).
      const created = await createProperty.mutateAsync({
        title,
        type: data.type,
        status,
        price: data.transaction === 'vente' ? (data.price ?? 0) : (data.rent ?? 0),
        rooms: data.rooms ?? 0,
        bedrooms: data.bedrooms ?? 0,
        bathrooms: data.bathrooms ?? 0,
        surface_m2: data.area ?? 0,
        floor: data.floor ?? undefined,
        total_floors: data.floorsTotal ?? undefined,
        year_built: data.year ?? undefined,
        charges_monthly: data.charges ?? undefined,
        mandate_type: data.mandate?.type,
        mandate_commission_pct: data.mandate?.commission ?? null,
        mandate_signed_at: data.mandate?.signed ? new Date().toISOString() : null,
        mandate_expires_at: data.mandate?.duration && data.mandate?.signed
          ? new Date(Date.now() + data.mandate.duration * 30 * 24 * 3600 * 1000).toISOString()
          : null,
        energy_class: data.energy ?? null,
        description: data.description || undefined,
        address: data.addr,
        city: data.city ?? '',
        canton: data.cantonShort ?? data.canton,
        postal_code: data.postCode,
        photos: data.photos.map(p => (typeof p === 'string' ? p : '')).filter(Boolean),
        features: data.features,
        // published_at posé par le trigger DB set_property_published_at (1er passage en 'active')
      })

      // 3) Link the vendor — properties has no contact_seller_id column;
      // the relationship lives in `transactions` (same model the deal
      // pipeline uses). Only create the transaction if we have BOTH a
      // resolved seller AND an agency_id (RLS gate).
      if (sellerContactId && profile?.agency_id) {
        // Wizard `mandate.type` is 'simple' | 'exclusive' | 'co'.
        // DB enum is 'simple' | 'exclusive' | 'semi_exclusive'.
        // Map 'co' → 'semi_exclusive'.
        const mandateType = data.mandate?.type === 'co'
          ? 'semi_exclusive'
          : data.mandate?.type
        try {
          await createTransaction.mutateAsync({
            agency_id: profile.agency_id,
            property_id: created.id,
            contact_seller_id: sellerContactId,
            // 'new_lead' if the mandate isn't signed yet, otherwise we
            // treat the listing as actively brokered.
            stage: data.mandate?.signed ? 'active_search' : 'new_lead',
            mandate_type: mandateType,
          })
        } catch (txErr) {
          // The property published successfully — surface the transaction
          // failure as a soft warning rather than blocking the success
          // screen (the agent can re-link from the deal detail page).
           
          console.warn('[wizard] vendor-link transaction failed:', txErr)
        }
      }

      // Cache Helpers auto-invalidates the properties + transactions lists
      // — the agent's /dashboard/listings and /dashboard/pipeline both
      // refresh on next render.
      setPublished(true)
    } catch (e) {
      const message = e instanceof Error ? e.message : t('wizard.shell.unknownError')
      setPublishError(message)
    }
  }

  const canNext = (() => {
    if (step === 0) {
      if (!data.source) return false
      if (data.source === 'submission' && !data.fromSubmissionId) return false
      return true
    }
    if (step === 1 && subStep === 0) return !!data.ownerContactId
    if (step === 1 && subStep === 1) return !!(data.mandate && data.mandate.type)
    return true
  })()

  const next = () => {
    if (step === 0 && data.source === 'import') { setStep(1); setSubStep(1); return }
    if (step === 0 && data.source === 'submission' && data.ownerContactId) { setStep(1); setSubStep(1); return }
    if (step === 1 && subStep === 0) { setSubStep(1); return }
    setSubStep(0)
    setStep(s => Math.min(s + 1, SG_STEPS.length - 1))
  }
  const prev = () => {
    if (step === 1 && subStep === 1) {
      if (data.source === 'import' || data.source === 'submission') {
        setStep(0); setSubStep(0); return
      }
      setSubStep(0); return
    }
    setSubStep(0)
    setStep(s => Math.max(s - 1, 0))
  }

  const headerLabel = published
    ? t('wizard.steps.publish')
    : (step === 1)
      ? (subStep === 0 ? t('wizard.steps.mandate') : t('wizard.shell.mandateTitle'))
      : SG_STEPS[step].label

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      // En dark on pose le wizard sur le noir plat #0A0A0F (= bg du CRM), pas le
      // radial Sugar — il colle ainsi au fond exact de l'app. En clair, radial.
      background: dark ? SugarV2.bg : SugarV2.bgGradient,
      fontFamily: '"Inter Tight", system-ui, sans-serif', color: SugarV2.ink,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      // Accent suivi par le thumb du slider natif (.sg-range) — voir SG_KEYFRAMES.
      '--sg-accent': SugarV2.black,
    } as CSSProperties}>
      <style>{SG_KEYFRAMES}</style>

      {/* TOP BAR */}
      <header style={{
        flexShrink: 0,
        padding: '20px 32px',
        display: 'flex', alignItems: 'center', gap: 18,
        position: 'relative', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          {/* Logo MEGGA — utilisons le SVG inline du Today (cohérent) */}
          <svg viewBox="0 0 694.81 419.02" width="38" height="24" style={{ display: 'block' }} aria-label="MEGGA">
            <path fill={SugarV2.ink} d="M212.94,0c46.64,5.38,88.55,22.94,122.21,59.67-22.79,28.12-37.71,60.3-47.08,96.28-7.89-14.68-16.56-27.02-28.35-37.25-40.39-35.04-99.55-30.53-134.81,9.66-40.25,45.89-40.1,117.16.48,162.82,35.48,39.93,94.73,44.05,134.83,8.67,14.5-12.89,25.12-28.95,32.24-48.42l-95.26-.1-.03-83.65,192.78-.02c8.8,28.23,5.09,73.7-2.86,101.4-22.71,79.15-85.98,140.1-169.06,149-2.17.23-4.11.34-5.1.93h-31c-42.03-4.33-81.34-20.79-113.04-49.92C-27.8,280.23-21.84,119.65,81.31,39.5,110.93,16.49,145.39,3.92,181.93,0h31.01Z"/>
            <path fill={SugarV2.ink} d="M511.94,419.01h-29c-47.56,0-91.35-24.53-123.87-60,24.65-30.5,36.53-57.89,47.2-96.18,7.43,14.3,16.5,27.51,28.71,37.93,36.96,31.55,90.34,30.86,126.22-1.89,13.97-12.75,24.27-28.48,31.18-47.43l-94.84-.08-.05-83.65,192.4-.03c2.59,9.14,3.94,17.82,4.5,27.2,4.34,72.2-25.1,142.48-83.13,186.34-29.43,22.24-63.45,34.03-99.32,37.8h0Z"/>
            <path fill={SugarV2.ink} d="M511.94,0c43.2,4.34,82.78,21.02,114.61,50.52,6.43,5.96,12.05,11.43,17.39,19.2l-56.72,84.95c-7.57-14.34-16.16-25.96-27.71-36.03-33.9-29.56-83.44-31.58-119.35-4.39-12.97,9.71-22.64,21.92-30.74,35.77l-101.14-.14c10.87-40.77,32.85-75.32,63.12-102.25C402.99,19.45,441.75,4.18,482.95.02h29-.01Z"/>
          </svg>
          <div style={{
            width: 1, height: 28, background: SugarV2.line,
          }} />
          <div>
            <div style={{
              fontSize: 11, fontWeight: 600, color: SugarV2.muted,
              letterSpacing: 1, textTransform: 'uppercase',
            }}>{t('form.header.new')}</div>
            <div style={{
              fontSize: 18, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.3,
            }}>{headerLabel}</div>
          </div>
        </div>

        {/* Stepper retiré du header (demande utilisateur) — navigation via
            Précédent / Continuer + compteur « N / 8 » en bas. */}
        <div style={{ flex: 1 }} />

        <SgCircleBtn
          icon={<SgIcon name="close" size={18} stroke={SugarV2.ink} />}
          onClick={onClose}
          title={t('common:actions.close')}
        />
      </header>

      {/* BODY */}
      <main key={(published ? 'success' : step + '-' + subStep)} style={{
        flex: 1, overflowY: 'auto',
        padding: published ? '32px 32px 80px' : '40px 32px 140px',
        position: 'relative', zIndex: 5,
      }}>
        {published ? (
          <Step8Success data={data} onClose={onClose} onBackToCRM={onClose} />
        ) : (
          <>
            {step === 0 && <Step0Start data={data} set={set} />}
            {step === 1 && subStep === 0 && <Step1Vendor data={data} set={set} />}
            {step === 1 && subStep === 1 && <Step1Mandate data={data} set={set} />}
            {step === 2 && <Step2Address data={data} set={set} />}
            {step === 3 && <Step3Specs data={data} set={set} />}
            {step === 4 && <Step4Photos data={data} set={set} />}
            {step === 5 && <Step5PriceDesc data={data} set={set} />}
            {step === 6 && <Step6Options data={data} set={set} />}
            {step === 7 && <Step7Publish data={data} set={set} onClose={onClose} />}
          </>
        )}
      </main>

      {/* FOOTER ACTIONS */}
      {!published && <footer style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '24px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, zIndex: 20,
        background: dark
          ? `linear-gradient(180deg, transparent 0%, ${SugarV2.bg} 72%)`
          : SugarV2.footerFade,
        pointerEvents: 'none',
      }}>
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {step > 0 && (
            <SgGhostPill onClick={prev}
              icon={<SgIcon name="arrowL" size={16} stroke={SugarV2.inkSoft} />}>
              {t('common:actions.previous')}
            </SgGhostPill>
          )}
        </div>

        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: SugarV2.muted, fontWeight: 500 }}>
            {step + 1} / {SG_STEPS.length}
          </span>
          {step < SG_STEPS.length - 1 ? (
            <SgBlackPill onClick={next} disabled={!canNext}
              icon={<SgIcon name="arrowR" size={16} stroke={SugarV2.onBlack} />}>
              {t('wizard.shell.continue')}
            </SgBlackPill>
          ) : (
            <SgBlackPill onClick={handlePublish} disabled={createProperty.isPending}>
              {createProperty.isPending
                ? t('wizard.shell.publishing')
                : data.publishMode === 'schedule' ? t('wizard.shell.schedulePublish')
                : data.publishMode === 'draft' ? t('wizard.shell.saveDraft')
                : t('wizard.shell.publish')}
            </SgBlackPill>
          )}
        </div>
      </footer>}

      {/* Inline publish error — sits above the footer so the agent sees
          exactly what went wrong without losing their wizard state. */}
      {publishError && !published && (
        <div role="alert" style={{
          position: 'absolute', bottom: 92, left: 32, right: 32, zIndex: 21,
          padding: '10px 14px', borderRadius: 12,
          background: dark ? 'rgba(242,107,101,0.12)' : '#FEF2F2',
          color: SugarV2.err,
          border: `1px solid ${dark ? 'rgba(242,107,101,0.35)' : '#FCA5A5'}`,
          fontSize: 12.5, fontWeight: 600,
        }}>
          {t('wizard.shell.publishError', { message: publishError })}
        </div>
      )}
    </div>
  )
}
