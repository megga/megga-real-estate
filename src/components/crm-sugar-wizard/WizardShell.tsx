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
import { useCreateProperty, useUpdateProperty, useUploadPropertyPhotos } from '@/hooks/useProperties'
import { useCreateContact } from '@/hooks/useContacts'
import { useCreateTransaction } from '@/hooks/useTransactions'
import { useAuth } from '@/hooks/useAuth'

// Vendeur brouillon vs existant : un brouillon (créé inline dans Step1Vendor,
// id `c-new-…`, ou dérivé d'un seller_lead sans contact_id dans Step0Start, id
// `c-from-…`) est reconnu par `data._newContact` dont l'`id` égale
// `data.ownerContactId` — handlePublish le persiste alors avant de lier la
// transaction. Un `ownerContactId` sans `_newContact` correspondant = un UUID
// de contact existant, utilisé tel quel.

// Wizard type (FR) → enum DB `property_type` (EN only : apartment|house|villa|
// commercial|land). Sans ce mapping, 3 tuiles sur 4 ('appartement'/'maison'/
// 'terrain') violent l'enum → l'insert échoue (22P02) et le bien n'est jamais
// créé. Même fix que le wizard mobile (WTYPE_TO_ENUM).
const TYPE_TO_ENUM: Record<WizardData['type'], 'apartment' | 'house' | 'villa' | 'land'> = {
  appartement: 'apartment',
  maison: 'house',
  villa: 'villa',
  terrain: 'land',
}

interface WizardShellProps {
  onClose: () => void
  /**
   * Embarqué dans un bento (pager « Mes biens ») : le shell remplit son conteneur
   * (`position:absolute; inset:0`) au lieu de couvrir tout l'écran
   * (`position:fixed; inset:0; z-index:9000`). Le bento parent gère le clip (coins
   * + overflow) et le z-index de l'overlay.
   */
  embedded?: boolean
}

export default function WizardShell({ onClose, embedded = false }: WizardShellProps) {
  const { t } = useTranslation('listings')
  // Le wizard suit le mode clair/sombre du CRM via useTheme → `data-theme`
  // (source de vérité lue par le Proxy SugarV2, robuste au rendu concurrent).
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
  const [publishing, setPublishing] = useState(false)
  const [data, setDataRaw] = useState<WizardData>(EMPTY_WIZARD)
  const set = (patch: Partial<WizardData>) => setDataRaw(prev => ({ ...prev, ...patch }))

  // Garde-fou photo. Un bien publié (status 'active') sans AUCUNE photo persistable
  // n'est jamais diffusé, et la syndication IDX le rejette en silence
  // (validateIdxProperty exige ≥1 photo). Les tuiles des modes téléphone/drive sont
  // du stock sans `file` ni `url` : elles ne sont PAS persistées (cf handlePublish),
  // donc elles ne comptent pas ici — seules valent les vraies photos (fichier déposé
  // ou URL déjà persistée). Un brouillon, lui, peut rester sans photo.
  const persistablePhotoCount = data.photos.filter(p => p.file || p.url).length
  // 'schedule' est persisté en 'draft' (pas de backend de publication programmée) ;
  // seule la publication immédiate met le bien en 'active'.
  const willGoLive = data.publishMode !== 'draft' && data.publishMode !== 'schedule'
  const blockedNoPhoto = willGoLive && persistablePhotoCount === 0

  const { profile } = useAuth()
  const createProperty = useCreateProperty()
  const updateProperty = useUpdateProperty()
  const uploadPhotos = useUploadPropertyPhotos()
  const createContact = useCreateContact()
  const createTransaction = useCreateTransaction()

  // Map the wizard's publishMode to the (status, published_at) pair the
  // properties table expects. There's no scheduled-publish backend yet,
  // so 'schedule' is persisted as 'draft' — separate chip to wire a real
  // cron-based publication when the feature is designed.
  async function handlePublish() {
    if (publishing) return
    // Filet de sécurité : le bouton est déjà désactivé dans ce cas, mais on ne crée
    // jamais une annonce 'active' sans photo persistable, même si l'appel arrivait par
    // un autre chemin. Un brouillon sans photo reste autorisé (willGoLive=false).
    if (blockedNoPhoto) {
      setPublishError(t('wizard.shell.photoRequired'))
      return
    }
    setPublishing(true)
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
      if (data._newContact && data.ownerContactId === data._newContact.id) {
        // Vendeur brouillon à persister : créé inline dans Step1Vendor (id
        // « c-new-… ») OU issu d'un seller_lead sans contact_id dans Step0Start
        // (id « c-from-… »). On le crée d'abord et on lie l'id RÉEL. Le test
        // d'IDENTITÉ (ownerContactId === _newContact.id), et non de préfixe,
        // couvre les deux origines ET ignore un _newContact résiduel si l'agent
        // a finalement choisi un contact existant. Sans ça l'id synthétique
        // partait dans transactions.contact_seller_id → 22P02 avalé, lien perdu.
        const newC = await createContact.mutateAsync({
          firstName: data._newContact.firstName,
          lastName: data._newContact.lastName,
          email: data._newContact.email,
          phone: data._newContact.phone || undefined,
          type: 'seller',
          source: 'manual',
        })
        sellerContactId = newC.id
        // Idempotence : si une étape suivante (createProperty…) échoue et que
        // l'agent recommence « Publier », on ne doit PAS recréer le contact.
        // On remplace le brouillon par l'id réel → au retry, la branche ci-dessus
        // est fausse et on retombe dans le `else if` (contact existant).
        set({ ownerContactId: newC.id, _newContact: null, _ownerContact: null })
      } else if (data.ownerContactId) {
        // Contact existant sélectionné → UUID réel.
        sellerContactId = data.ownerContactId
      }

      // Photos réelles ajoutées par l'agent (dropzone PC) vs URLs déjà
      // persistées. Les tuiles sans `file` ni `url` (placeholders mobile/drive,
      // variantes staging) ne sont PAS persistées — aucune photo fabriquée.
      const photoFiles = data.photos.map(p => p.file).filter((f): f is File => !!f)
      const existingPhotoUrls = data.photos.map(p => p.url).filter((u): u is string => !!u)

      // 2) Create the property (no direct vendor column — link comes via
      // a transactions row below). Photos uploadées juste après (besoin de l'id).
      const created = await createProperty.mutateAsync({
        title,
        type: TYPE_TO_ENUM[data.type] ?? 'apartment',
        transaction_type: data.transaction === 'location' ? 'rent' : 'buy',
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
        photos: existingPhotoUrls,
        features: data.features,
        // published_at posé par le trigger DB set_property_published_at (1er passage en 'active')
      })

      // 2b) Upload des vraies photos maintenant qu'on a l'id, puis persistance
      // de leurs URLs (bucket property-photos + miroir R2, ownership server-side).
      // Échec d'upload = warning souple (le bien existe ; l'agent complète les
      // photos depuis la fiche) — même posture que l'échec de liaison vendeur,
      // jamais un upload silencieusement perdu sur le chemin nominal.
      if (photoFiles.length && profile?.agency_id) {
        try {
          const uploadedUrls = await uploadPhotos.mutateAsync({
            propertyId: created.id,
            files: photoFiles,
          })
          await updateProperty.mutateAsync({
            id: created.id,
            photos: [...existingPhotoUrls, ...uploadedUrls],
          })
        } catch (photoErr) {
          console.warn('[wizard] photo upload failed:', photoErr)
        }
      }

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
    } finally {
      setPublishing(false)
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
      position: embedded ? 'absolute' : 'fixed', inset: 0, zIndex: embedded ? 1 : 9000,
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
            <SgBlackPill onClick={handlePublish} disabled={publishing || blockedNoPhoto}>
              {publishing
                ? t('wizard.shell.publishing')
                : data.publishMode === 'schedule' ? t('wizard.shell.schedulePublish')
                : data.publishMode === 'draft' ? t('wizard.shell.saveDraft')
                : t('wizard.shell.publish')}
            </SgBlackPill>
          )}
        </div>
      </footer>}

      {/* Garde-fou photo — explique pourquoi « Publier » est désactivé tant qu'aucune
          photo réelle n'est ajoutée (la dernière étape porte le bouton Publier). */}
      {blockedNoPhoto && !published && step === SG_STEPS.length - 1 && (
        <div role="status" style={{
          position: 'absolute', bottom: 92, left: 32, right: 32, zIndex: 21,
          padding: '10px 14px', borderRadius: 12,
          background: dark ? 'rgba(245,158,11,0.12)' : '#FFFBEB',
          color: dark ? '#FBBF24' : '#B45309',
          border: `1px solid ${dark ? 'rgba(245,158,11,0.35)' : '#FCD34D'}`,
          fontSize: 12.5, fontWeight: 600,
        }}>
          {t('wizard.shell.photoRequired')}
        </div>
      )}

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
