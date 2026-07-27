/**
 * Wizard « Identité légale » (KYB) — coquille, navigation, persistance, soumission.
 * Rendu par la route /dashboard/identite (src/pages/agent/IdentitySugarPage.tsx),
 * tant que useIdentityGate() renvoie 'required'.
 *
 * Reprend TEL QUEL le mécanisme de thème de crm-sugar-wizard/WizardShell.tsx
 * (`setSugarV2Dark(dark)` au début du render, `SugarV2.foo` lu au render dans
 * chaque étape) et réutilise ses primitives (SgIcon, SgBlackPill, SgGhostPill,
 * SgInput dans StepSignataire) — voir tokens.ts pour le pourquoi d'un module de
 * thème séparé plutôt qu'un import croisé.
 *
 * Persistance (règle du plan étape 2, § Parcours cible) : l'étape qu'on est en
 * train de QUITTER est sauvegardée dans persistCurrentStep(), appelée par next()
 * ET prev() — pas seulement à la soumission finale (tâche 7). Fermer l'onglet ne
 * perd donc jamais une étape déjà validée. Les tables KYB sont la source de
 * vérité ; aucun stockage local parallèle (le brouillon d'étape en cours vit en
 * mémoire React le temps de la saisie, rien d'autre).
 *
 * Les étapes 0 (StepSignataire, tâche 3) et 1 (StepAgence, tâche 4) ont un écran
 * réel. Les étapes 2 à 4 rendent un palier honnête « à venir » jusqu'à ce que les
 * tâches 5 à 7 les remplacent une à une par leur propre écran + bloc de persistance
 * ici.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { SugarV2, setSugarV2Dark, SG_IDENTITY_STEPS, SG_IDENTITY_KEYFRAMES } from './tokens'
import { SgIcon, SgBlackPill, SgGhostPill } from '@/components/crm-sugar-wizard/primitives'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/hooks/useAuth'
import { useAgencyIdentity } from '@/hooks/useAgencyIdentity'
import type { AgencySettingsData } from '@/hooks/useAgencySettings'
import { StepSignataire } from './steps/StepSignataire'
import { StepAgence } from './steps/StepAgence'

/** Brouillon local de l'étape 1, contrôlé par IdentityShell (cf. en-tête de StepSignataire). */
export interface SignataireDraft {
  firstName: string
  lastName: string
  dateOfBirth: string | null
  nationality: string | null
  signaturePower: 'individual' | 'joint' | null
}

/** Brouillon vide — état initial avant hydratation depuis une personne déjà persistée. */
// eslint-disable-next-line react-refresh/only-export-components -- constante partagée avec StepSignataire/les tests, même motif que useTheme.tsx.
export const EMPTY_SIGNATAIRE_DRAFT: SignataireDraft = {
  firstName: '',
  lastName: '',
  dateOfBirth: null,
  nationality: null,
  signaturePower: null,
}

/**
 * true si les 5 champs de l'étape signataire sont renseignés. Gate le bouton
 * Continuer ET la tentative de sauvegarde (persistCurrentStep) : les colonnes DB
 * sont nullable, mais un signataire sans pouvoir de signature ni date de
 * naissance n'est pas une saisie complète du point de vue du parcours KYB.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que useIdentityGate.ts.
export function isSignataireStepComplete(draft: SignataireDraft): boolean {
  return (
    draft.firstName.trim() !== ''
    && draft.lastName.trim() !== ''
    && draft.dateOfBirth != null
    && draft.nationality != null
    && draft.signaturePower != null
  )
}

/**
 * Brouillon local de l'étape 2, contrôlé par IdentityShell (cf. en-tête de
 * StepAgence). Reprend délibérément les noms de champs de AgencySettingsData
 * (`legal` = raison sociale, `postal` = NPA) plutôt que des alias plus verbeux : la
 * persistance (persistCurrentStep) étale ce brouillon directement sur `agency`
 * chargé, sans aucun remappage. Nommé `AgencyDraft` (anglais), pas `AgenceDraft`
 * (français, comme SignataireDraft) : à un caractère de distance de `agency`
 * (AgencySettingsData renvoyée par le hook), une paire agence/agency aurait été un
 * copier-coller-typo attendant de se produire dans ce fichier précis.
 */
export type AgencyDraft = Pick<
  AgencySettingsData,
  'country' | 'legalFormId' | 'legal' | 'tradeName' | 'businessRegistrationNumber' | 'tva' | 'address' | 'postal' | 'city' | 'canton'
>

/** Brouillon vide — état initial avant hydratation depuis une agence déjà persistée. */
// eslint-disable-next-line react-refresh/only-export-components -- constante partagée avec StepAgence/les tests, même motif que EMPTY_SIGNATAIRE_DRAFT.
export const EMPTY_AGENCY_DRAFT: AgencyDraft = {
  country: '',
  legalFormId: '',
  legal: '',
  tradeName: '',
  businessRegistrationNumber: '',
  tva: '',
  address: '',
  postal: '',
  city: '',
  canton: '',
}

/**
 * true si les 9 champs BLOQUANTS de l'étape agence sont renseignés. `tva` est
 * volontairement EXCLU de ce tout-ou-rien (décision produit du 27.07.2026) :
 * l'assujettissement à la TVA suisse n'est obligatoire qu'au-delà d'un seuil de
 * chiffre d'affaires, donc une raison individuelle parfaitement légitime peut n'avoir
 * aucun numéro de TVA — l'exiger la bloquerait sans raison et la renverrait au
 * support. Même principe que le reste du dispositif de vérification KYB
 * (docs/agency-kyb-verification.md) : un signal absent en est exclu plutôt que
 * pénalisé. `tva` reste un champ normal de AgencyDraft par ailleurs : saisi, il est
 * toujours persisté (persistCurrentStep étale tout le brouillon d'un coup) — seule sa
 * présence a cessé d'être une condition d'avancement.
 *
 * Comme isSignataireStepComplete : gate à la fois le bouton Continuer ET la tentative
 * de sauvegarde (persistCurrentStep) — tout ou rien sur les 9 champs restants, jamais
 * une écriture partielle de l'identité légale de l'agence.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que isSignataireStepComplete.
export function isAgencyStepComplete(draft: AgencyDraft): boolean {
  return (
    draft.country.trim() !== ''
    && draft.legalFormId.trim() !== ''
    && draft.legal.trim() !== ''
    && draft.tradeName.trim() !== ''
    && draft.businessRegistrationNumber.trim() !== ''
    && draft.address.trim() !== ''
    && draft.postal.trim() !== ''
    && draft.city.trim() !== ''
    && draft.canton.trim() !== ''
  )
}

/**
 * Recalcule le `legalFormId` à conserver après un changement du pays du siège
 * (dépendance d'ordre du brief tâche 4, explicitement pas cosmétique). Chaque
 * `legal_forms.id` appartient à EXACTEMENT un pays par construction (colonne
 * `country`, pas de partage entre juridictions — migration 20260726130000) : tout
 * changement de pays invalide donc systématiquement la forme choisie, jamais
 * seulement "parfois" — inutile d'attendre le rechargement de useLegalForms(country)
 * pour le savoir. Une forme juridique désormais incohérente avec le pays affiché
 * n'est donc jamais laissée en place silencieusement.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que isAgencyStepComplete.
export function legalFormIdAfterCountryChange(previousCountry: string, nextCountry: string, currentLegalFormId: string): string {
  return previousCountry === nextCountry ? currentLegalFormId : ''
}

/** Borne `step` à [0, stepCount - 1] — jamais un index hors de SG_IDENTITY_STEPS. */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que useIdentityGate.ts.
export function clampIdentityStep(step: number, stepCount: number): number {
  return Math.min(Math.max(step, 0), stepCount - 1)
}

/**
 * true si l'étape `step` autorise une navigation avant (bouton Continuer du pied de
 * page). Les étapes 0 (StepSignataire) et 1 (StepAgence) ont un écran réel — gate sur
 * leur complétude respective. Les étapes 2 à 4 sont des paliers StepComingSoon
 * (tâches 5 à 7, aucun contenu à valider aujourd'hui) : jamais navigables en avant
 * tant qu'elles n'ont pas de contenu réel, quels que soient les brouillons en cours.
 *
 * Revue tâche 3 : `canNext` valait `true` sans condition dès step > 0 — le bouton
 * Continuer du pied de page restait cliquable sur ces paliers vides jusqu'au
 * récapitulatif, sans que rien n'ait été renseigné. Le stepper du header respectait
 * déjà la règle (goToStep refuse toute cible > step, cf. plus bas), mais le rapport de
 * la tâche affirmait à tort que c'était vrai aussi du bouton du pied de page.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que isSignataireStepComplete/clampIdentityStep.
export function canAdvanceFromIdentityStep(step: number, signataire: SignataireDraft, agency: AgencyDraft): boolean {
  if (step === 0) return isSignataireStepComplete(signataire)
  if (step === 1) return isAgencyStepComplete(agency)
  return false
}

/** Palier honnête pour les étapes 2 à 5, pas encore livrées (tâches 4 à 7). */
function StepComingSoon({ eyebrow }: { eyebrow: string }) {
  const { t } = useTranslation('onboarding')
  return (
    <div style={{ maxWidth: 640, margin: '64px auto 0', textAlign: 'center' }}>
      <div style={{
        fontSize: 12, fontWeight: 600, color: SugarV2.muted,
        letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
      }}>{eyebrow}</div>
      <h1 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 700, color: SugarV2.ink }}>
        {t('wizard.comingSoon.title')}
      </h1>
      <p style={{ margin: 0, fontSize: 14, color: SugarV2.inkSoft, lineHeight: 1.5 }}>
        {t('wizard.comingSoon.body')}
      </p>
    </div>
  )
}

/** Coquille du wizard identité : chrome, navigation entre étapes, persistance au changement d'étape. */
export default function IdentityShell() {
  const { t } = useTranslation('onboarding')
  const { theme } = useTheme()
  const dark = theme === 'dark'
  setSugarV2Dark(dark)
  useEffect(() => () => { setSugarV2Dark(null) }, [])

  const { signOut } = useAuth()
  const navigate = useNavigate()
  const { agency, persons, isLoading, savePerson, saveAgency } = useAgencyIdentity()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  // Flash "Enregistré" pendant 1.8s après une sauvegarde réussie (footer).
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!justSaved) return
    savedTimerRef.current = setTimeout(() => setJustSaved(false), 1800)
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current) }
  }, [justSaved])

  const existingSignatory = useMemo(
    () => persons.find((p) => p.roles.some((r) => r.role === 'signatory')) ?? null,
    [persons],
  )

  const [signataire, setSignataireRaw] = useState<SignataireDraft>(EMPTY_SIGNATAIRE_DRAFT)
  const setSignataire = (patch: Partial<SignataireDraft>) => setSignataireRaw((prev) => ({ ...prev, ...patch }))

  // Hydrate le brouillon dès que la personne persistée est connue (chargement
  // initial, ou retour sur le wizard après une fermeture d'onglet — cf. en-tête).
  // Ne se redéclenche que si l'id change : ne doit jamais écraser une saisie en
  // cours avec la même valeur déjà chargée.
  useEffect(() => {
    if (existingSignatory) {
      setSignataireRaw({
        firstName: existingSignatory.firstName,
        lastName: existingSignatory.lastName,
        dateOfBirth: existingSignatory.dateOfBirth,
        nationality: existingSignatory.nationality,
        signaturePower: existingSignatory.roles.find((r) => r.role === 'signatory')?.signaturePower ?? null,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingSignatory?.id])

  const [agencyDraft, setAgencyDraftRaw] = useState<AgencyDraft>(EMPTY_AGENCY_DRAFT)
  const setAgencyDraft = (patch: Partial<AgencyDraft>) => setAgencyDraftRaw((prev) => ({ ...prev, ...patch }))

  // Hydrate le brouillon dès que l'agence chargée porte une identité légale déjà
  // saisie (retour sur le wizard après une fermeture d'onglet). Les 10 colonnes de
  // cette étape sont écrites ENSEMBLE par persistCurrentStep (tout ou rien, comme le
  // signataire) : n'importe laquelle suffit comme déclencheur de l'hydratation ;
  // legalFormId est prise pour rester au plus près du motif existingSignatory?.id.
  useEffect(() => {
    if (agency.legalFormId) {
      setAgencyDraftRaw({
        country: agency.country,
        legalFormId: agency.legalFormId,
        legal: agency.legal,
        tradeName: agency.tradeName,
        businessRegistrationNumber: agency.businessRegistrationNumber,
        tva: agency.tva,
        address: agency.address,
        postal: agency.postal,
        city: agency.city,
        canton: agency.canton,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agency.legalFormId])

  const canNext = canAdvanceFromIdentityStep(step, signataire, agencyDraft)

  /** Enveloppe commune à chaque étape persistable : bascule saving/error/justSaved
   *  autour de l'opération d'écriture réelle (savePerson ou saveAgency selon
   *  l'étape). Extrait de l'ancien corps inline de persistCurrentStep pour éviter de
   *  dupliquer ce triptyque try/catch/finally à chaque étape persistable ajoutée par
   *  les tâches 4 à 7 — comportement inchangé pour l'étape 0. */
  const runPersist = async (save: () => Promise<unknown>): Promise<boolean> => {
    setSaving(true)
    setError(null)
    try {
      await save()
      setJustSaved(true)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : t('wizard.footer.unknownError'))
      return false
    } finally {
      setSaving(false)
    }
  }

  /**
   * Persiste l'étape qu'on est en train de QUITTER (appelée par next(), prev() ET
   * le clic sur un palier du header) — c'est ce qui garantit qu'aucune étape
   * validée n'est perdue à la fermeture de l'onglet. Renvoie false si l'étape est
   * incomplète (bloque next(), n'empêche jamais prev()).
   */
  const persistCurrentStep = async (): Promise<boolean> => {
    if (step === 0) {
      if (!isSignataireStepComplete(signataire)) return false
      return runPersist(() => savePerson(
        {
          id: existingSignatory?.id ?? null,
          firstName: signataire.firstName,
          lastName: signataire.lastName,
          dateOfBirth: signataire.dateOfBirth,
          nationality: signataire.nationality,
        },
        [{
          role: 'signatory',
          signaturePower: signataire.signaturePower,
          ownershipPct: null,
          // Non demandé à cette étape (le PEP se déclare pour les bénéficiaires
          // effectifs, étape 3 / tâche 5) — la colonne défaut déjà à false.
          pepSelfDeclared: false,
        }],
      ))
    }
    if (step === 1) {
      if (!isAgencyStepComplete(agencyDraft)) return false
      // Étale le brouillon sur `agency` chargé : les champs hors étape 2 (name,
      // phone, email, website, logoUrl, foundedYear, aboutShort) ne sont jamais
      // touchés par ce wizard, save() les réécrit pourtant tous à chaque appel
      // (contrat de useAgencySettings) — d'où l'étalement plutôt qu'un patch.
      return runPersist(() => saveAgency({ ...agency, ...agencyDraft }))
    }
    return true // étapes 2 à 4 : rien à persister avant les tâches 5 à 7
  }

  const next = async () => {
    if (!canNext || saving) return
    if (!(await persistCurrentStep())) return
    setStep((s) => clampIdentityStep(s + 1, SG_IDENTITY_STEPS.length))
  }
  const prev = async () => {
    if (saving) return
    await persistCurrentStep()
    setStep((s) => clampIdentityStep(s - 1, SG_IDENTITY_STEPS.length))
  }
  const goToStep = async (target: number) => {
    if (target === step || target > step || saving) return // seuls les paliers déjà visités sont accessibles
    await persistCurrentStep()
    setStep(clampIdentityStep(target, SG_IDENTITY_STEPS.length))
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: dark ? SugarV2.bg : SugarV2.bgGradient,
      fontFamily: '"Inter Tight", system-ui, sans-serif', color: SugarV2.ink,
    } as CSSProperties}>
      <style>{SG_IDENTITY_KEYFRAMES}</style>

      <header style={{
        flexShrink: 0, padding: '24px 32px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, overflowX: 'auto' }}>
          {SG_IDENTITY_STEPS.map((s, i) => {
            const clickable = i < step && !saving
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => { if (clickable) void goToStep(i) }}
                disabled={!clickable}
                style={{
                  background: 'transparent', border: 0, padding: 0,
                  fontFamily: 'inherit', whiteSpace: 'nowrap',
                  cursor: clickable ? 'pointer' : 'default',
                  fontSize: 13, fontWeight: i === step ? 700 : 600,
                  paddingBottom: 8,
                  borderBottom: `2px solid ${i <= step ? SugarV2.ink : 'transparent'}`,
                  color: i === step ? SugarV2.ink : i < step ? SugarV2.inkSoft : SugarV2.muted,
                  transition: 'all .18s ease',
                }}
              >
                {i + 1}. {s.label}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => { void signOut().then(() => navigate('/login')) }}
          style={{
            flexShrink: 0, background: 'transparent', border: 0, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: SugarV2.muted,
          }}
        >
          {t('common:logout')}
        </button>
      </header>

      <main key={step} style={{
        flex: 1, padding: '16px 32px 140px', animation: 'sgPage .45s cubic-bezier(.2,.8,.2,1) both',
      }}>
        {isLoading ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '96px 0', color: SugarV2.muted, fontSize: 13, fontWeight: 500,
          }} role="status" aria-live="polite">
            <span style={{
              width: 14, height: 14, borderRadius: 999,
              border: `2px solid ${SugarV2.line}`, borderTopColor: SugarV2.ink,
              animation: 'sgSpin .8s linear infinite',
            }} />
            {t('gate.shell.preparing')}
          </div>
        ) : step === 0 ? (
          <StepSignataire value={signataire} onChange={setSignataire} />
        ) : step === 1 ? (
          <StepAgence value={agencyDraft} onChange={setAgencyDraft} />
        ) : (
          <StepComingSoon eyebrow={SG_IDENTITY_STEPS[step].label} />
        )}
      </main>

      <footer style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, padding: '24px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, zIndex: 20,
        background: dark
          ? `linear-gradient(180deg, transparent 0%, ${SugarV2.bg} 72%)`
          : SugarV2.footerFade,
        pointerEvents: 'none',
      }}>
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          {step > 0 && (
            <SgGhostPill onClick={() => { void prev() }} icon={<SgIcon name="arrowL" size={16} stroke={SugarV2.inkSoft} />}>
              {t('common:actions.previous')}
            </SgGhostPill>
          )}
          {/* Indicateur de sauvegarde : reflète la persistance réelle (savePerson ou
              saveAgency selon l'étape), jamais un état optimiste — il ne s'allume
              qu'après succès. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: SugarV2.ok }}>
            {justSaved ? (
              <span style={{
                width: 15, height: 15, borderRadius: 999, display: 'grid', placeItems: 'center', flexShrink: 0,
                background: SugarV2.ok, animation: 'sgSavePop .4s cubic-bezier(.2,.8,.2,1) both',
              }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={SugarV2.onBlack} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              </span>
            ) : (
              <span style={{ width: 7, height: 7, borderRadius: 999, flexShrink: 0, background: SugarV2.ok }} />
            )}
            {justSaved ? t('wizard.footer.saved') : t('wizard.footer.autosave')}
          </div>
        </div>

        <div style={{ pointerEvents: 'auto' }}>
          {step < SG_IDENTITY_STEPS.length - 1 && (
            <SgBlackPill onClick={() => { void next() }} disabled={!canNext || saving}
              icon={<SgIcon name="arrowR" size={16} stroke={SugarV2.onBlack} />}>
              {saving ? t('wizard.footer.saving') : t('wizard.footer.continue')}
            </SgBlackPill>
          )}
        </div>
      </footer>

      {error && (
        <div role="alert" style={{
          position: 'fixed', bottom: 92, left: 32, right: 32, zIndex: 21,
          padding: '10px 14px', borderRadius: 12, textAlign: 'center',
          background: dark ? 'rgba(242,107,101,0.12)' : '#FEF2F2',
          color: SugarV2.err,
          border: `1px solid ${dark ? 'rgba(242,107,101,0.35)' : '#FCA5A5'}`,
          fontSize: 12.5, fontWeight: 600,
        }}>
          {error}
        </div>
      )}
    </div>
  )
}
