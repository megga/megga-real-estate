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
import { useWizardDraft, wizardPayload, wizardTitre } from './useWizardDraft'
import { useTheme } from '@/hooks/useTheme'
import { Step0Start } from './steps/Step0Start'
import { Step1Vendor } from './steps/Step1Vendor'
import { Step1Mandate } from './steps/Step1Mandate'
import { Step2Address } from './steps/Step2Address'
import { Step3Specs } from './steps/Step3Specs'
import { Step4Photos } from './steps/Step4Photos'
import { Step5PriceDesc } from './steps/Step5PriceDesc'
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

interface WizardShellProps {
  onClose: () => void
  /**
   * Embarqué dans un bento (pager « Mes biens ») : le shell remplit son conteneur
   * (`position:absolute; inset:0`) au lieu de couvrir tout l'écran
   * (`position:fixed; inset:0; z-index:9000`). Le bento parent gère le clip (coins
   * + overflow) et le z-index de l'overlay.
   */
  embedded?: boolean
  /**
   * Force le mode sombre au lieu de le déduire de `data-theme`.
   *
   * ⚠ Le CRM porte DEUX clés de thème sans lien : `megga-theme` (lue par
   * `useTheme`, donc par `data-theme`) et `megga.sugar.dark` (lue par les
   * surfaces Sugar et basculée par leur rail). Monté dans le pager « Mes biens »,
   * le wizard restait donc CLAIR dans un chrome sombre — sa page connaît l'état
   * Sugar, lui non.
   *
   * L'hôte qui connaît l'état le transmet. Omis, le comportement d'origine tient :
   * le wizard suit `data-theme`.
   */
  dark?: boolean
}

export default function WizardShell({ onClose, embedded = false, dark: darkOverride }: WizardShellProps) {
  const { t } = useTranslation('listings')
  // Le wizard suit le mode clair/sombre du CRM via useTheme → `data-theme`
  // (source de vérité lue par le Proxy SugarV2, robuste au rendu concurrent),
  // sauf si l'hôte impose l'état (cf. `dark` ci-dessus).
  const { theme } = useTheme()
  const dark = darkOverride ?? theme === 'dark'
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

  // Brouillon automatique — le témoin du pied lit l'état RÉEL de l'écriture.
  // Avant le 11 août 2026 il faisait clignoter « Enregistré » à chaque frappe
  // sans que rien ne soit persisté : fermer l'onglet perdait tout le parcours.
  // Suspendu pendant et après la publication, sinon la sauvegarde repasserait
  // le bien en `draft` juste après l'avoir activé.
  const { etat: etatBrouillon } = useWizardDraft(data, set, !publishing && !published, wizardPayload)

  // Le gating de publication vit dans la checklist « Prêt à publier » du Step 7
  // (≥5 photos requis pour une publication PUBLIQUE ; brouillon & « Privé » jamais
  // bloqués) + le backend (source de vérité). Le bouton « Publier » du Step 7 est
  // désactivé tant que la checklist n'est pas verte, donc handlePublish n'est jamais
  // appelé sur une publication publique incomplète.
  const { profile } = useAuth()
  const createProperty = useCreateProperty()
  const updateProperty = useUpdateProperty()
  const uploadPhotos = useUploadPropertyPhotos()
  const createContact = useCreateContact()
  const createTransaction = useCreateTransaction()

  // Publier = faire passer le bien de `draft` à `active`. Le brouillon existe
  // déjà (`useWizardDraft` l'a créé à la première adresse) : on le MET À JOUR,
  // sinon la publication sèmerait une seconde ligne à côté de la première.
  // `published_at` est posé par le trigger DB au premier passage en `active`.
  //
  // ⚠ Il n'y a plus qu'une issue : le mode de publication ('now'/'schedule'/
  // 'draft') a été retiré le 11 août 2026 — voir la JSDoc de `_draftId`.
  async function handlePublish() {
    if (publishing) return
    setPublishing(true)
    setPublishError(null)

    const title = wizardTitre(data)

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

      // 2) Le bien : mise à jour du brouillon si le sauvegarde automatique l'a
      // déjà créé, création sinon (agent arrivé sans qu'aucune écriture n'ait
      // abouti). La charge utile vient de `wizardPayload` — la MÊME que celle
      // du brouillon, sinon les deux chemins divergeraient au premier champ
      // ajouté et l'agent publierait autre chose que ce qu'il a enregistré.
      // `photos` s'y ajoute ici seulement : l'upload exige l'id du bien.
      const charge = { ...wizardPayload(data, 'active'), title, photos: existingPhotoUrls }
      const created = data._draftId
        ? await updateProperty.mutateAsync({ id: data._draftId, ...charge })
        : await createProperty.mutateAsync(charge)

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
    // Étape Prix & Description : phase 0 (prix) exige une valeur ; phase 1 (desc) libre.
    if (step === 5) {
      if ((data.priceStep || 0) < 1) return !!(data.transaction === 'location' ? data.rent : data.price)
      return true
    }
    return true
  })()

  const next = () => {
    if (step === 0 && data.source === 'import') { setStep(1); setSubStep(1); return }
    if (step === 0 && data.source === 'submission' && data.ownerContactId) { setStep(1); setSubStep(1); return }
    if (step === 1 && subStep === 0) { setSubStep(1); return }
    // Adresse → Caractéristiques : démarre le sous-parcours guidé (Q1)
    if (step === 2) { set({ specsQ: 0 }); setSubStep(0); setStep(3); return }
    // Caractéristiques : 7 sous-questions pilotées par data.specsQ (Q7 = accordéon)
    if (step === 3) {
      const cq = data.specsQ || 0
      if (cq < 6) { set({ specsQ: cq + 1 }); return }
      setSubStep(0); setStep(4); return
    }
    // Photos → Prix : démarre sur la phase Prix
    if (step === 4) { set({ priceStep: 0 }); setSubStep(0); setStep(5); return }
    // Prix & Description : 2 phases pilotées par data.priceStep
    if (step === 5) {
      if ((data.priceStep || 0) < 1) { set({ priceStep: 1 }); return }
      setSubStep(0); setStep(6); return
    }
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
    // Caractéristiques : recule question par question, puis vers Adresse
    if (step === 3) {
      const cq = data.specsQ || 0
      if (cq > 0) { set({ specsQ: cq - 1 }); return }
      setSubStep(0); setStep(2); return
    }
    // Photos → retour Caractéristiques atterrit sur la dernière question (Q7)
    if (step === 4) { set({ specsQ: 6 }); setSubStep(0); setStep(3); return }
    // Prix & Description : description → prix → Photos
    if (step === 5) {
      if ((data.priceStep || 0) > 0) { set({ priceStep: 0 }); return }
      setSubStep(0); setStep(4); return
    }
    setSubStep(0)
    setStep(s => Math.max(s - 1, 0))
  }

  return (
    <div style={{
      position: embedded ? 'absolute' : 'fixed', inset: 0, zIndex: embedded ? 1 : 9000,
      // En dark on pose le wizard sur le noir plat #0A0A0F (= bg du CRM), pas le
      // radial Sugar — il colle ainsi au fond exact de l'app. En clair, radial.
      background: SugarV2.bg,
      fontFamily: '"Inter Tight", system-ui, sans-serif', color: SugarV2.ink,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      // Accent suivi par le thumb du slider natif (.sg-range) — voir SG_KEYFRAMES.
      '--sg-accent': SugarV2.black,
    } as CSSProperties}>
      <style>{SG_KEYFRAMES}</style>

      {/* TOP BAR — minimale : flotte au-dessus du corps, bouton × seul (handoff).
          Transparente sur l'étape Adresse (carte pleine largeur derrière). */}
      <header style={{
        flexShrink: 0,
        padding: '20px 32px',
        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-4xl)',
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        background: (!published && step === 2)
          ? 'transparent'
          : `linear-gradient(180deg, ${SugarV2.bg} 58%, ${SugarV2.bg}00 100%)`,
      }}>
        <div style={{ flex: 1 }} />
        <SgCircleBtn
          icon={<SgIcon name="close" size={18} stroke={SugarV2.ink} />}
          onClick={onClose}
          title={t('common:actions.close')}
        />
      </header>

      {/* BODY — padding haut 96 pour dégager le header flottant ; l'étape Adresse
          (carte) ne scrolle pas ; animation d'entrée sgPage au changement d'étape. */}
      <main key={(published ? 'success' : step + '-' + subStep)} style={{
        flex: 1,
        overflowY: (!published && step === 2) ? 'hidden' : 'auto',
        scrollbarGutter: (!published && step === 2) ? 'auto' : 'stable both-edges',
        padding: published ? '96px 32px 80px' : '96px 32px 140px',
        position: 'relative', zIndex: 5,
        animation: 'sgPage .45s cubic-bezier(.2,.8,.2,1) both',
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
            {step === 6 && (
              <Step7Publish
                data={data}
                set={set}
                onPublish={handlePublish}
                onGoStep={(s) => { if (s === 3) set({ specsQ: 0 }); setSubStep(0); setStep(s) }}
                publishing={publishing}
              />
            )}
          </>
        )}
      </main>

      {/* FOOTER ACTIONS */}
      {!published && <footer style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '24px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 'var(--crm-space-3xl)', zIndex: 20,
        background: dark
          ? `linear-gradient(180deg, transparent 0%, ${SugarV2.bg} 72%)`
          : SugarV2.footerFade,
        pointerEvents: 'none',
      }}>
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)' }}>
          {step > 0 && (
            <SgGhostPill onClick={prev}
              icon={<SgIcon name="arrowL" size={16} stroke={SugarV2.inkSoft} />}>
              {t('common:actions.previous')}
            </SgGhostPill>
          )}
          {/* Témoin de brouillon — il ne dit QUE ce qui a réellement eu lieu.
              `inactif` (avant la première adresse) n'affiche rien : il n'y a
              rien à enregistrer, donc rien à promettre. */}
          {etatBrouillon !== 'inactif' && (() => {
            const vert = SugarV2.isDark ? '#34C796' : '#047857'
            const teinte = etatBrouillon === 'echec' ? SugarV2.err
              : etatBrouillon === 'enregistrement' ? SugarV2.muted : vert
            const libelle = etatBrouillon === 'echec' ? t('wizard.shell.saveFailed')
              : etatBrouillon === 'enregistrement' ? t('wizard.shell.saving')
              : t('wizard.shell.saved')
            return (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)',
                fontSize: 'var(--crm-text-md)', fontWeight: 600, color: teinte,
              }}>
                {etatBrouillon === 'enregistre' ? (
                  <span style={{
                    width: 15, height: 15, borderRadius: 'var(--crm-radius-pill)', display: 'grid', placeItems: 'center', flexShrink: 0,
                    background: vert, animation: 'sgSavePop .4s cubic-bezier(.2,.8,.2,1) both',
                  }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={SugarV2.isDark ? '#0B0B0C' : '#fff'} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  </span>
                ) : (
                  <span style={{ width: 7, height: 7, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0, background: teinte }} />
                )}
                {libelle}
              </div>
            )
          })()}
        </div>

        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3xl)' }}>
          {/* Le CTA de publication vit dans le Step 7 (concept E) — le footer ne
              montre « Continuer » que sur les étapes intermédiaires. */}
          {step < SG_STEPS.length - 1 && (
            <SgBlackPill onClick={next} disabled={!canNext}
              icon={<SgIcon name="arrowR" size={16} stroke={SugarV2.onBlack} />}>
              {t('wizard.shell.continue')}
            </SgBlackPill>
          )}
        </div>
      </footer>}

      {/* Inline publish error — sits above the footer so the agent sees
          exactly what went wrong without losing their wizard state. */}
      {publishError && !published && (
        <div role="alert" style={{
          position: 'absolute', bottom: 92, left: 32, right: 32, zIndex: 21,
          padding: 'var(--crm-space-lg) var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-lg)',
          background: dark ? 'rgba(242,107,101,0.12)' : '#FEF2F2',
          color: SugarV2.err,
          border: `1px solid ${dark ? 'rgba(242,107,101,0.35)' : '#FCA5A5'}`,
          fontSize: 'var(--crm-text-md)', fontWeight: 600,
        }}>
          {t('wizard.shell.publishError', { message: publishError })}
        </div>
      )}
    </div>
  )
}
