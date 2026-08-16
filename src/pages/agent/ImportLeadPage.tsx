// MEGGA CRM — Page Import Lead IA (plein écran)
// Port pixel-près de crm-import-lead-modal.jsx (handoff Sprint 3).
//
// Format : page route plein écran 2 étapes
//   0. Le message — textarea + exemples + bouton "Analyser avec MEGGA AI"
//   1. Vérifier & créer — extraction champ-par-champ, mode édition global,
//      toggle "créer aussi un deal", CTA "Créer le contact (+ le deal)"
//
// État géré via URL :
//   ?text=<initial>  → pré-remplit le textarea (depuis Today popover)
//   ?returnTo=<url>  → navigation au close + après création
//
// Garde-fou : aucun window.__* global (red-team D2 invalidé — pattern non
// utilisé en prod). Tout passe par useNavigate + searchParams.
//
// Spec : RED_TEAM_SPRINT_3.md §G.1 (D2 invalidé), §B.B3 (dédup), §F.F5.

import { crmVoileEncre } from '@/components/crm/tokens'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  dossierPalette,
  DOSSIER_KEYFRAMES,
  type DossierPalette,
} from '@/components/crm-dossiers/tokens'
import { useCrmDark } from '@/lib/crmDark'
import { CrmIcon } from '@/components/crm-dossiers/icons'
import {
  CrmBlackPill,
  CrmGhostPill,
  CrmStepper,
} from '@/components/crm-dossiers/primitives'
import { LEAD_SAMPLES } from '@/components/crm-dossiers/import-lead/samples'
import {
  INTENT_LABELS,
  URGENCY_LABELS,
  NEXT_ACTION_LABELS,
  formatBudget,
} from '@/components/crm-dossiers/import-lead/labels'
import { useExtractLead, type ExtractedLead, type LeadIntent } from '@/hooks/useExtractLead'
import { useFindContactDuplicates } from '@/hooks/useContactDuplicates'
import { useImportLead } from '@/hooks/useImportLead'

// Ids stables des étapes (labels résolus via i18n dans le composant).
const STEP_IDS = ['message', 'review'] as const
const STEP_COUNT = STEP_IDS.length

const REVEAL_DELAY_MS = 280
const FIELD_COUNT = 6  // identité, contact, intention+budget, critères, urgence, action

// SessionStorage backup (§B.5) — préserve l'état du wizard contre un refresh
// navigateur ou un mauvais clic. TTL court (1h) pour éviter qu'une session
// dormante ré-affiche des PII d'un autre jour. Cleared au close + au succès.
// SessionStorage uniquement (pas localStorage) — la donnée contient des PII
// (cf. CLAUDE.md projet : "DON'T localStorage pour données sensibles").
const STORAGE_KEY = 'megga.import-lead.state.v1'
const STORAGE_TTL_MS = 60 * 60 * 1000

interface StoredState {
  step: 0 | 1
  text: string
  extracted: ExtractedLead | null
  redactionSummary: string
  truncated: boolean
  editMode: boolean
  createDeal: boolean
  savedAt: number
}

function loadStoredState(): Partial<StoredState> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredState
    if (Date.now() - parsed.savedAt > STORAGE_TTL_MS) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function saveStoredState(s: Omit<StoredState, 'savedAt'>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, savedAt: Date.now() }))
  } catch {
    // sessionStorage quota dépassé ou désactivé — best-effort
  }
}

function clearStoredState() {
  try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
}

export default function ImportLeadPage() {
  const { t } = useTranslation('contacts')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const dark = useCrmDark()
  const S = useMemo(() => dossierPalette(dark), [dark])

  const steps = useMemo(
    () => STEP_IDS.map((id) => ({ id, label: t(`import.lead.steps.${id}`) })),
    [t],
  )

  const initialText = searchParams.get('text') ?? ''
  const returnTo    = searchParams.get('returnTo') ?? '/dashboard/pipeline'

  // §B.5 — hydrate depuis sessionStorage (TTL 1h). URL param `text` reste
  // prioritaire (link from Today popover, deep-link).
  const stored = initialText ? null : loadStoredState()

  const [step, setStep] = useState<0 | 1>(stored?.step ?? 0)
  const [text, setText] = useState(initialText || stored?.text || '')
  const [extracted, setExtracted] = useState<ExtractedLead | null>(stored?.extracted ?? null)
  const [redactionSummary, setRedactionSummary] = useState(stored?.redactionSummary ?? '')
  const [truncated, setTruncated] = useState(stored?.truncated ?? false) // §A.6 — flag remonté par l'Edge Function quand le texte dépasse 8 KB
  // Si on hydrate à step=1, on dévoile tous les champs immédiatement
  // (pas de replay de l'animation).
  const [revealedCount, setRevealedCount] = useState(stored?.step === 1 ? FIELD_COUNT : 0)
  const [editMode, setEditMode] = useState(stored?.editMode ?? false)
  const [createDeal, setCreateDeal] = useState(stored?.createDeal ?? false) // B2 : default OFF, on l'active après extraction si pertinent
  const [created, setCreated] = useState<{ contactId: string; dealId: string | null } | null>(null)

  // Persiste l'état du wizard à chaque changement significatif (§B.5).
  useEffect(() => {
    if (created) return // ne pas sauver après succès — on va clearStoredState
    saveStoredState({ step, text, extracted, redactionSummary, truncated, editMode, createDeal })
  }, [step, text, extracted, redactionSummary, truncated, editMode, createDeal, created])

  const extractMutation = useExtractLead()
  const importMutation  = useImportLead()

  // Dédup en background dès qu'on a un nom + email/phone
  const dedup = useFindContactDuplicates({
    email:     extracted?.email,
    phone:     extracted?.phone,
    firstName: extracted?.firstName,
    lastName:  extracted?.lastName,
  })

  // Garde-fou navigation (§B.4) — confirme la perte du travail si du texte
  // a été saisi ou si l'extraction est déjà faite. Évite à l'agent de
  // perdre 2KB d'email par un Esc accidentel.
  const confirmNavigation = (): boolean => {
    if (created) return true // déjà sauvegardé
    const hasUnsavedWork = text.trim().length > 50 || step > 0
    if (!hasUnsavedWork) return true
    return window.confirm(
      step > 0
        ? t('import.lead.confirmLeave.review')
        : t('import.lead.confirmLeave.message'),
    )
  }

  // Escape ferme et retourne à l'écran d'appel (avec confirm §B.4)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !importMutation.isPending) {
        if (confirmNavigation()) navigate(returnTo)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, returnTo, importMutation.isPending, text, step, created])

  const close = () => {
    if (confirmNavigation()) {
      clearStoredState() // §B.5 — pas de persistance après fermeture explicite
      navigate(returnTo)
    }
  }

  const runAnalysis = async () => {
    setRevealedCount(0)
    try {
      const result = await extractMutation.mutateAsync({ text })
      setExtracted(result.extracted)
      setRedactionSummary(result.redactionSummary)
      setTruncated(result.truncated) // §A.6
      // B2 : default ON pour buyer/tenant clair, OFF pour seller ou confidence basse
      setCreateDeal(result.extracted.intent !== 'seller' && result.extracted.confidence >= 0.6)
      setStep(1)
      // Reveal field by field (UX maquette §Étape 2)
      let i = 0
      const tick = () => {
        i++
        setRevealedCount(i)
        if (i < FIELD_COUNT) setTimeout(tick, REVEAL_DELAY_MS)
      }
      setTimeout(tick, 250)
      // F5 : si confidence < 0.5, ouvre le mode édition d'office
      if (result.extracted.confidence < 0.5) setEditMode(true)
    } catch {
      // L'erreur est déjà dans extractMutation.error — affichée plus bas
    }
  }

  const handleCreate = async () => {
    if (!extracted) return
    // §B.1 — guard idempotence : pas de double création sur double-clic ni
    // race condition pendant la mutation en cours.
    if (importMutation.isPending) return
    try {
      const result = await importMutation.mutateAsync({
        extracted,
        createDeal,
        redactionSummary,
        rawText: text, // §A.7 — stocké 90j sur contacts.import_raw_text
      })
      setCreated(result)
      clearStoredState() // §B.5 — succès, on libère le backup PII
    } catch {
      // Affiché via importMutation.error
    }
  }

  const updateField = <K extends keyof ExtractedLead>(key: K, value: ExtractedLead[K]) => {
    setExtracted((p) => (p ? { ...p, [key]: value } : p))
  }

  // §B.2 — bloquer le CTA tant que la dédup tourne. Évite la race condition
  // où l'agent clique "Créer" avant que la query de dédup ait répondu, en
  // bypassant la bannière "Contact existant".
  const dedupChecking = dedup.isFetching && revealedCount >= FIELD_COUNT
  const canCreate =
    !!extracted?.firstName &&
    !!extracted?.lastName &&
    revealedCount >= FIELD_COUNT &&
    !dedupChecking

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 220,
        background: S.bgGradient,
        animation: 'ilFadeIn .25s cubic-bezier(.2,.8,.2,1) both',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: S.font,
      }}
    >
      <style>{`
        ${DOSSIER_KEYFRAMES}
        @keyframes ilFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ilFieldIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ilPulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(0.92); opacity: 0.85; } }
      `}</style>

      {/* ─── HEADER ──────────────────────────────────────────────────────── */}
      <header
        style={{
          padding: '20px 40px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          flexShrink: 0,
        }}
      >
        <button
          onClick={close}
          title={t('common:actions.close')}
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            border: 0,
            background: S.cardSubtle,
            color: S.inkSoft,
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            boxShadow: S.shadowSm,
          }}
        >
          <CrmIcon name="close" size={18} stroke={S.inkSoft} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 'var(--crm-text-xs)',
              fontWeight: 600,
              color: S.muted,
                                          display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CrmIcon name="sparkle" size={12} stroke={S.muted} sw={1.8} />
            {t('import.lead.eyebrow')}
          </div>
        </div>

        <CrmStepper steps={steps} current={step} />

        {/* Crayon mode édition — Step 2 uniquement */}
        {step === 1 && extracted && !created && (
          <button
            onClick={() => setEditMode((e) => !e)}
            style={{
              height: 36,
              padding: '0 14px',
              borderRadius: 999,
              border: 0,
              background: editMode ? S.accent : S.card,
              color: editMode ? '#fff' : S.inkSoft,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 'var(--crm-text-sm)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              boxShadow: editMode ? `0 6px 16px ${crmVoileEncre(false, 0.18)}` : S.shadowSm,
              whiteSpace: 'nowrap',
            }}
          >
            {editMode ? (
              <>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: '#FACC15',
                    animation: 'ilPulse 1.2s ease-in-out infinite',
                    display: 'inline-block',
                  }}
                />
                {t('import.lead.editing')}
              </>
            ) : (
              <>
                <CrmIcon name="pencil" size={12} stroke={S.inkSoft} sw={2} />
                {t('common:actions.edit')}
              </>
            )}
          </button>
        )}
      </header>

      {/* ─── CONTENT ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 40px 40px' }}>
        {/* État final : créé */}
        {created && extracted && (
          <CreatedView
            contactId={created.contactId}
            dealId={created.dealId}
            extracted={extracted}
            onClose={close}
            onNavToContact={() => navigate(`/dashboard/contacts/${created.contactId}`)}
            onNavToDeal={() => created.dealId && navigate(`/dashboard/transactions/${created.dealId}`)}
          />
        )}

        {/* Étape 0 : coller le message */}
        {!created && step === 0 && (
          <PasteStep
            text={text}
            onTextChange={setText}
            error={extractMutation.error?.message}
            errorCode={extractMutation.error?.code}
          />
        )}

        {/* Étape 1 : vérifier & créer */}
        {!created && step === 1 && extracted && (
          <ReviewStep
            extracted={extracted}
            editMode={editMode}
            revealedCount={revealedCount}
            createDeal={createDeal}
            onToggleCreateDeal={() => setCreateDeal((v) => !v)}
            updateField={updateField}
            redactionSummary={redactionSummary}
            truncated={truncated}
            lowConfidence={extracted.confidence < 0.5}
            duplicates={dedup.data ?? []}
            duplicatesLoading={dedup.isLoading}
            onSelectDuplicate={(id) => navigate(`/dashboard/contacts/${id}`)}
            error={importMutation.error?.message}
          />
        )}
      </div>

      {/* ─── FOOTER ──────────────────────────────────────────────────────── */}
      {!created && (
        <footer
          style={{
            padding: '20px 40px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexShrink: 0,
            background: S.card,
            boxShadow: `0 -8px 24px ${crmVoileEncre(false, 0.04)}`,
          }}
        >
          <CrmGhostPill
            icon={<CrmIcon name="arrowL" size={15} stroke={S.inkSoft} />}
            onClick={() => (step > 0 ? setStep(0) : close())}
          >
            {step === 0 ? t('common:actions.cancel') : t('import.lead.repaste')}
          </CrmGhostPill>

          <div style={{ flex: 1 }} />

          <div style={{ fontSize: 'var(--crm-text-sm)', color: S.muted, fontWeight: 600 }}>
            {t('import.lead.stepProgress', { current: step + 1, total: STEP_COUNT })}
          </div>

          {step === 0 ? (
            <CrmBlackPill
              size="lg"
              disabled={!text.trim() || extractMutation.isPending}
              icon={
                extractMutation.isPending ? (
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      animation: 'ilPulse 1s ease-in-out infinite',
                      display: 'inline-block',
                    }}
                  >
                    <CrmIcon name="sparkle" size={14} stroke="#fff" sw={2} />
                  </span>
                ) : (
                  <CrmIcon name="sparkle" size={14} stroke="#fff" sw={2} />
                )
              }
              onClick={runAnalysis}
            >
              {extractMutation.isPending
                ? t('import.lead.analyzing')
                : t('import.lead.analyze')}
            </CrmBlackPill>
          ) : editMode ? (
            <CrmBlackPill
              size="lg"
              icon={<CrmIcon name="check" size={14} stroke="#fff" sw={2.5} />}
              onClick={() => setEditMode(false)}
            >
              {t('import.lead.finishEditing')}
            </CrmBlackPill>
          ) : (
            <CrmBlackPill
              size="lg"
              disabled={!canCreate || importMutation.isPending}
              icon={<CrmIcon name="check" size={14} stroke="#fff" sw={2.5} />}
              onClick={handleCreate}
            >
              {importMutation.isPending
                ? t('import.lead.creating')
                : dedupChecking
                  ? t('import.lead.checkingDuplicates')
                  : createDeal
                    ? t('import.lead.createContactAndDeal')
                    : t('import.lead.createContact')}
            </CrmBlackPill>
          )}
        </footer>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 0 — Coller le message
// ═══════════════════════════════════════════════════════════════════════════

function PasteStep({
  text,
  onTextChange,
  error,
  errorCode,
}: {
  text: string
  onTextChange: (v: string) => void
  error?: string
  errorCode?: string
}) {
  const { t } = useTranslation('contacts')
  const dark = useCrmDark()
  const S = useMemo(() => dossierPalette(dark), [dark])
  return (
    <div
      style={{
        maxWidth: 920,
        margin: '0 auto',
        animation: 'ilFieldIn .4s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div style={{ marginBottom: 36, maxWidth: 720 }}>
        <div
          style={{
            fontSize: 'var(--crm-text-sm)',
            fontWeight: 600,
            color: S.muted,
                                    marginBottom: 14,
          }}
        >
          {t('import.lead.stepOf', { current: 1, total: 2 })}
        </div>
        <h1
          style={{
            margin: '0 0 14px',
            fontSize: 'var(--crm-text-9xl)',
            fontWeight: 600,
            color: S.ink,
            letterSpacing: -0.8,
            lineHeight: 1.1,
          }}
        >
          {t('import.lead.paste.title')}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--crm-text-xl)',
            color: S.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          {t('import.lead.paste.subtitle')}
        </p>
      </div>

      <div
        style={{
          background: S.card,
          borderRadius: 24,
          boxShadow: S.shadowLg,
          padding: 8,
          marginBottom: 18,
        }}
      >
        <textarea
          autoFocus
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={t('import.lead.paste.placeholder')}
          style={{
            width: '100%',
            minHeight: 260,
            padding: 20,
            border: 0,
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'inherit',
            fontSize: 'var(--crm-text-xl)',
            fontWeight: 500,
            color: S.ink,
            lineHeight: 1.6,
            background: 'transparent',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 'var(--crm-text-xs)',
            fontWeight: 600,
            color: S.muted,
                                  }}
        >
          {t('import.lead.paste.tryExample')}
        </span>
        {LEAD_SAMPLES.map((s) => (
          <button
            key={s.label}
            onClick={() => onTextChange(s.text)}
            style={{
              height: 32,
              padding: '0 14px',
              borderRadius: 999,
              border: 0,
              background: S.card,
              color: S.inkSoft,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 'var(--crm-text-sm)',
              fontWeight: 600,
              boxShadow: S.shadowSm,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && (
        <div
          style={{
            marginTop: 24,
            padding: '14px 18px',
            borderRadius: 14,
            background: S.errSoft,
            color: S.errDarker,
            fontSize: 'var(--crm-text-md)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <CrmIcon name="alert" size={16} stroke={S.err} sw={1.8} />
          {errorCode === 'unauthorized'
            ? t('import.lead.errors.unauthorized')
            : errorCode === 'text_too_short'
              ? t('import.lead.errors.textTooShort')
              : errorCode === 'rate_limit_exceeded'
                ? t('import.lead.errors.rateLimit')
                : errorCode === 'llm_unavailable'
                  ? t('import.lead.errors.llmUnavailable')
                  : t('import.lead.errors.generic')}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1 — Vérifier & créer
// ═══════════════════════════════════════════════════════════════════════════

interface ReviewStepProps {
  extracted: ExtractedLead
  editMode: boolean
  revealedCount: number
  createDeal: boolean
  onToggleCreateDeal: () => void
  updateField: <K extends keyof ExtractedLead>(key: K, value: ExtractedLead[K]) => void
  redactionSummary: string
  /** §A.6 — Edge a tronqué le message à 8 KB. À signaler à l'agent. */
  truncated: boolean
  lowConfidence: boolean
  duplicates: Array<{ id: string; first_name: string; last_name: string; email: string | null; phone: string | null; match_kind: string; created_at: string }>
  duplicatesLoading: boolean
  onSelectDuplicate: (id: string) => void
  error?: string
}

function ReviewStep({
  extracted,
  editMode,
  revealedCount,
  createDeal,
  onToggleCreateDeal,
  updateField,
  redactionSummary,
  truncated,
  lowConfidence,
  duplicates,
  onSelectDuplicate,
  error,
}: ReviewStepProps) {
  const { t } = useTranslation('contacts')
  const dark = useCrmDark()
  const S = useMemo(() => dossierPalette(dark), [dark])
  return (
    <div
      style={{
        maxWidth: 920,
        margin: '0 auto',
        animation: 'ilFieldIn .4s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div style={{ marginBottom: 28, maxWidth: 720 }}>
        <div
          style={{
            fontSize: 'var(--crm-text-sm)',
            fontWeight: 600,
            color: S.muted,
                                    marginBottom: 14,
          }}
        >
          {t('import.lead.stepOf', { current: 2, total: 2 })}
        </div>
        <h1
          style={{
            margin: '0 0 14px',
            fontSize: 'var(--crm-text-9xl)',
            fontWeight: 600,
            color: S.ink,
            letterSpacing: -0.8,
            lineHeight: 1.1,
          }}
        >
          {editMode ? t('import.lead.review.titleEdit') : t('import.lead.review.title')}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--crm-text-xl)',
            color: S.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          {editMode
            ? t('import.lead.review.subtitleEdit')
            : t('import.lead.review.subtitle')}
        </p>
      </div>

      {/* Bandeau confidence basse (F5) */}
      {lowConfidence && !editMode && (
        <BannerInfo
          icon="alert"
          title={t('import.lead.banner.lowConfidence.title')}
          body={t('import.lead.banner.lowConfidence.body')}
        />
      )}

      {/* Bandeau truncation §A.6 — message tronqué à 8 KB côté serveur */}
      {truncated && (
        <BannerInfo
          icon="alert"
          title={t('import.lead.banner.truncated.title')}
          body={t('import.lead.banner.truncated.body')}
        />
      )}

      {/* Bandeau redaction (A1) */}
      {redactionSummary && (
        <BannerInfo
          icon="shieldStar"
          title={t('import.lead.banner.redaction.title')}
          body={t('import.lead.banner.redaction.body', { summary: redactionSummary })}
        />
      )}

      {/* Bandeau dédup (B3) */}
      {duplicates.length > 0 && !editMode && (
        <DuplicateBanner candidates={duplicates} onSelect={onSelectDuplicate} />
      )}

      {/* Grille de champs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {/* Identité (2 colonnes) */}
        {revealedCount >= 1 && (
          <RevealField span={2}>
            {editMode ? (
              <EditField icon="user" label={t('import.lead.field.identity')}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input
                    value={extracted.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
                    placeholder={t('import.lead.field.firstName')}
                    style={editInputStyle(S)}
                  />
                  <input
                    value={extracted.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    placeholder={t('import.lead.field.lastName')}
                    style={editInputStyle(S)}
                  />
                </div>
              </EditField>
            ) : (
              <ExtractedField
                icon="user"
                label={t('import.lead.field.identity')}
                value={`${extracted.firstName} ${extracted.lastName}`.trim() || null}
              />
            )}
          </RevealField>
        )}

        {/* Email */}
        {revealedCount >= 2 && (
          <RevealField>
            {editMode ? (
              <EditField icon="mail" label={t('import.lead.field.email')}>
                <input
                  type="email"
                  value={extracted.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="email@example.com"
                  style={editInputStyle(S)}
                />
              </EditField>
            ) : (
              <ExtractedField icon="mail" label={t('import.lead.field.email')} value={extracted.email} />
            )}
          </RevealField>
        )}

        {/* Téléphone */}
        {revealedCount >= 2 && (
          <RevealField>
            {editMode ? (
              <EditField icon="phone" label={t('import.lead.field.phone')}>
                <input
                  type="tel"
                  value={extracted.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="+41 79 …"
                  style={editInputStyle(S)}
                />
              </EditField>
            ) : (
              <ExtractedField icon="phone" label={t('import.lead.field.phone')} value={extracted.phone} />
            )}
          </RevealField>
        )}

        {/* Intention */}
        {revealedCount >= 3 && (
          <RevealField>
            {editMode ? (
              <EditField icon="target" label={t('import.lead.field.intent')}>
                <SegmentedChoice
                  value={extracted.intent}
                  onChange={(v) => updateField('intent', v as LeadIntent)}
                  options={[
                    { v: 'buyer',  l: t('contactType.buyer') },
                    { v: 'seller', l: t('contactType.seller') },
                    { v: 'tenant', l: t('contactType.tenant') },
                  ]}
                />
              </EditField>
            ) : (
              <ExtractedField
                icon="target"
                label={t('import.lead.field.intent')}
                value={INTENT_LABELS[extracted.intent]}
              />
            )}
          </RevealField>
        )}

        {/* Budget */}
        {revealedCount >= 3 && (
          <RevealField>
            {editMode ? (
              <EditField icon="coins" label={t('import.lead.field.budget')}>
                <input
                  type="number"
                  value={extracted.budget ?? ''}
                  onChange={(e) =>
                    updateField('budget', e.target.value ? Number(e.target.value) : null)
                  }
                  placeholder="0"
                  style={editInputStyle(S)}
                />
              </EditField>
            ) : (
              <ExtractedField
                icon="coins"
                label={t('import.lead.field.budget')}
                value={extracted.budget ? formatBudget(extracted.budget, extracted.intent) : null}
              />
            )}
          </RevealField>
        )}

        {/* Critères (2 colonnes) */}
        {revealedCount >= 4 && (
          <RevealField span={2}>
            {editMode ? (
              <EditField icon="home" label={t('import.lead.field.criteria')}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
                  <input
                    type="number"
                    step={0.5}
                    value={extracted.rooms ?? ''}
                    onChange={(e) =>
                      updateField('rooms', e.target.value ? Number(e.target.value) : null)
                    }
                    placeholder={t('import.lead.field.rooms')}
                    style={editInputStyle(S)}
                  />
                  <input
                    value={extracted.zone}
                    onChange={(e) => updateField('zone', e.target.value)}
                    placeholder={t('import.lead.field.zone')}
                    style={editInputStyle(S)}
                  />
                </div>
              </EditField>
            ) : (
              <ExtractedField
                icon="map"
                label={t('import.lead.field.criteria')}
                value={
                  [
                    extracted.rooms ? t('import.lead.roomsCount', { count: extracted.rooms }) : null,
                    extracted.zone || null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || null
                }
              />
            )}
          </RevealField>
        )}

        {/* Urgence */}
        {revealedCount >= 5 && (
          <RevealField>
            {editMode ? (
              <EditField icon="flame" label={t('import.lead.field.urgency')}>
                <SegmentedChoice
                  value={extracted.urgency}
                  onChange={(v) => updateField('urgency', v as ExtractedLead['urgency'])}
                  options={[
                    { v: 'high',   l: t('import.urgency.high') },
                    { v: 'medium', l: t('import.urgency.medium') },
                    { v: 'normal', l: t('import.urgency.normal') },
                  ]}
                />
              </EditField>
            ) : (
              <ExtractedField
                icon="flame"
                label={t('import.lead.field.urgency')}
                value={URGENCY_LABELS[extracted.urgency]}
                accentTone={
                  extracted.urgency === 'high'
                    ? S.warn
                    : extracted.urgency === 'medium'
                      ? S.ink
                      : S.muted
                }
              />
            )}
          </RevealField>
        )}

        {/* Action suggérée */}
        {revealedCount >= 6 && (
          <RevealField>
            {editMode ? (
              <EditField icon="sparkle" label={t('import.lead.field.nextAction')}>
                <select
                  value={extracted.nextAction}
                  onChange={(e) => updateField('nextAction', e.target.value as ExtractedLead['nextAction'])}
                  style={{ ...editInputStyle(S), padding: '0 12px', appearance: 'none', cursor: 'pointer' }}
                >
                  <option value="call">{t('import.nextAction.call')}</option>
                  <option value="visit">{t('import.nextAction.visit')}</option>
                  <option value="match">{t('import.nextAction.match')}</option>
                  <option value="kyc">{t('import.nextAction.kyc')}</option>
                </select>
              </EditField>
            ) : (
              <ExtractedField
                icon="sparkle"
                label={t('import.lead.field.nextAction')}
                value={NEXT_ACTION_LABELS[extracted.nextAction]}
              />
            )}
          </RevealField>
        )}
      </div>

      {/* Toggle créer un deal */}
      {revealedCount >= FIELD_COUNT && !editMode && (
        <div
          style={{
            background: S.card,
            borderRadius: 20,
            padding: 22,
            boxShadow: S.shadow,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            animation: 'ilFieldIn .35s cubic-bezier(.2,.8,.2,1) both',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: S.ink, marginBottom: 3 }}>
              {t('import.lead.deal.title')}
            </div>
            <div
              style={{
                fontSize: 'var(--crm-text-sm)',
                color: S.muted,
                fontWeight: 500,
                lineHeight: 1.5,
              }}
            >
              {t('import.lead.deal.desc', { intent: INTENT_LABELS[extracted.intent] })}
              {extracted.intent !== 'tenant' && ` ${t('import.lead.deal.kycNote')}`}
            </div>
          </div>
          <ToggleSwitch active={createDeal} onClick={onToggleCreateDeal} />
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: '14px 18px',
            borderRadius: 14,
            background: S.errSoft,
            color: S.errDarker,
            fontSize: 'var(--crm-text-md)',
            fontWeight: 600,
          }}
        >
          {t('import.lead.createFailed', { message: error })}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function RevealField({ children, span = 1 }: { children: React.ReactNode; span?: 1 | 2 }) {
  return (
    <div
      style={{
        gridColumn: `span ${span}`,
        animation: 'ilFieldIn .35s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      {children}
    </div>
  )
}

function ExtractedField({
  icon,
  label,
  value,
  accentTone,
}: {
  icon: string
  label: string
  value: string | null
  accentTone?: string
}) {
  const { t } = useTranslation('contacts')
  const dark = useCrmDark()
  const S = useMemo(() => dossierPalette(dark), [dark])
  return (
    <div
      style={{
        padding: '16px 18px',
        borderRadius: 16,
        background: S.cardSubtle,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: S.card,
          color: S.ink,
          display: 'grid',
          placeItems: 'center',
          boxShadow: S.shadowSm,
          flexShrink: 0,
        }}
      >
        <CrmIcon name={icon as never} size={16} stroke={S.ink} sw={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--crm-text-xs)',
            fontWeight: 600,
            color: S.muted,
                                    marginBottom: 4,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 'var(--crm-text-xl)',
            fontWeight: 600,
            color: S.ink,
            letterSpacing: -0.2,
            lineHeight: 1.3,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {accentTone && (
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: accentTone,
                flexShrink: 0,
              }}
            />
          )}
          {value || <span style={{ color: S.muted, fontWeight: 500 }}>{t('import.lead.notDetected')}</span>}
        </div>
      </div>
    </div>
  )
}

function EditField({
  icon,
  label,
  children,
}: {
  icon: string
  label: string
  children: React.ReactNode
}) {
  const dark = useCrmDark()
  const S = useMemo(() => dossierPalette(dark), [dark])
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 16,
        background: S.cardSubtle,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: S.card,
            color: S.ink,
            display: 'grid',
            placeItems: 'center',
            boxShadow: S.shadowSm,
            flexShrink: 0,
          }}
        >
          <CrmIcon name={icon as never} size={13} stroke={S.ink} sw={1.8} />
        </div>
        <div
          style={{
            fontSize: 'var(--crm-text-xs)',
            fontWeight: 600,
            color: S.muted,
                                  }}
        >
          {label}
        </div>
      </div>
      {children}
    </div>
  )
}

// Helper de MODULE : il ne peut pas lire de hook, la palette lui est donc passée
// par l'appelant (ReviewStep, seul lecteur).
function editInputStyle(S: DossierPalette): React.CSSProperties {
  return {
    width: '100%',
    height: 40,
    padding: '0 14px',
    background: S.card,
    border: 0,
    borderRadius: 10,
    fontFamily: 'inherit',
    fontSize: 'var(--crm-text-lg)',
    fontWeight: 600,
    color: S.ink,
    outline: 'none',
    boxSizing: 'border-box',
    boxShadow: `inset 0 0 0 2px ${S.ink}`,
    fontVariantNumeric: 'tabular-nums',
  }
}

function SegmentedChoice<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { v: T; l: string }[]
}) {
  const dark = useCrmDark()
  const S = useMemo(() => dossierPalette(dark), [dark])
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          style={{
            flex: 1,
            height: 36,
            borderRadius: 8,
            border: 0,
            background: value === o.v ? S.invBg : S.card,
            color: value === o.v ? S.invInk : S.inkSoft,
            fontFamily: 'inherit',
            fontSize: 'var(--crm-text-sm)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {o.l}
        </button>
      ))}
    </div>
  )
}

function ToggleSwitch({ active, onClick }: { active: boolean; onClick: () => void }) {
  const dark = useCrmDark()
  const S = useMemo(() => dossierPalette(dark), [dark])
  return (
    <button
      onClick={onClick}
      style={{
        width: 48,
        height: 28,
        borderRadius: 999,
        border: 0,
        background: active ? S.invBg : S.cardSubtle,
        position: 'relative',
        cursor: 'pointer',
        transition: 'all .2s ease',
        boxShadow: active
          ? `0 4px 12px ${crmVoileEncre(false, 0.18)}`
          : `inset 0 0 0 2px ${S.ghost}`,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: active ? 23 : 3,
          width: 22,
          height: 22,
          borderRadius: 999,
          background: active ? S.invInk : S.card,
          transition: 'all .2s ease',
        }}
      />
    </button>
  )
}

function BannerInfo({ icon, title, body }: { icon: string; title: string; body: string }) {
  const dark = useCrmDark()
  const S = useMemo(() => dossierPalette(dark), [dark])
  return (
    <div
      style={{
        marginBottom: 16,
        padding: '14px 18px',
        borderRadius: 14,
        background: S.cardSubtle,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: S.card,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          boxShadow: S.shadowSm,
          marginTop: 2,
        }}
      >
        <CrmIcon name={icon as never} size={14} stroke={S.inkSoft} sw={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: S.ink, marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: 'var(--crm-text-sm)', color: S.inkSoft, fontWeight: 500, lineHeight: 1.5 }}>
          {body}
        </div>
      </div>
    </div>
  )
}

function DuplicateBanner({
  candidates,
  onSelect,
}: {
  candidates: Array<{ id: string; first_name: string; last_name: string; email: string | null; phone: string | null; match_kind: string; created_at: string }>
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation('contacts')
  const dark = useCrmDark()
  const S = useMemo(() => dossierPalette(dark), [dark])
  return (
    <div
      style={{
        marginBottom: 16,
        padding: '16px 20px',
        borderRadius: 14,
        background: S.warnSoft,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <CrmIcon name="alert" size={16} stroke={S.warn} sw={2} />
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: S.ink }}>
          {t('import.lead.duplicate.title', { count: candidates.length })}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {candidates.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            style={{
              textAlign: 'left',
              padding: '10px 12px',
              borderRadius: 10,
              border: 0,
              background: S.card,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: S.ink }}>
                {c.first_name} {c.last_name}
              </div>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: S.muted, fontWeight: 500, marginTop: 2 }}>
                {[c.email, c.phone].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
            <span
              style={{
                fontSize: 'var(--crm-text-xs)',
                fontWeight: 600,
                padding: '3px 9px',
                borderRadius: 999,
                background: S.cardSubtle,
                color: S.inkSoft,
                                              }}
            >
              {t('import.lead.duplicate.matchBadge', { kind: t(`import.lead.duplicate.kind.${c.match_kind}`) })}
            </span>
            <CrmIcon name="arrowR" size={14} stroke={S.inkSoft} sw={2} />
          </button>
        ))}
      </div>
      <div style={{ fontSize: 'var(--crm-text-xs)', color: S.muted, fontWeight: 500 }}>
        {t('import.lead.duplicate.note')}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// VUE DE CONFIRMATION — créé avec succès
// ═══════════════════════════════════════════════════════════════════════════

function CreatedView({
  contactId,
  dealId,
  extracted,
  onClose,
  onNavToContact,
  onNavToDeal,
}: {
  contactId: string
  dealId: string | null
  extracted: ExtractedLead
  onClose: () => void
  onNavToContact: () => void
  onNavToDeal: () => void
}) {
  const { t } = useTranslation('contacts')
  const dark = useCrmDark()
  const S = useMemo(() => dossierPalette(dark), [dark])
  const fullName = `${extracted.firstName} ${extracted.lastName}`.trim() || t('import.lead.created.fallbackName')
  const initials = useMemo(
    () => `${(extracted.firstName[0] ?? '?')}${(extracted.lastName[0] ?? '')}`.toUpperCase(),
    [extracted.firstName, extracted.lastName],
  )
  // Use contactId to allow future deep-link helpers (consumed by onNavToContact callback).
  void contactId

  return (
    <div
      style={{
        maxWidth: 720,
        margin: '60px auto 0',
        animation: 'ilFieldIn .45s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 999,
            background: 'rgba(16,185,129,0.12)',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 22px',
          }}
        >
          <CrmIcon name="check" size={28} stroke={S.ok} sw={2.5} />
        </div>
        <h1
          style={{
            margin: '0 0 12px',
            fontSize: 'var(--crm-text-7xl)',
            fontWeight: 600,
            color: S.ink,
            letterSpacing: -0.6,
            lineHeight: 1.15,
          }}
        >
          {t('import.lead.created.title', { name: fullName })}
        </h1>
        <p style={{ margin: 0, fontSize: 'var(--crm-text-xl)', color: S.inkSoft, fontWeight: 500 }}>
          {dealId
            ? t('import.lead.created.subtitleDeal', { intent: INTENT_LABELS[extracted.intent] })
            : t('import.lead.created.subtitleContact')}
        </p>
      </div>

      <div
        style={{
          background: S.card,
          borderRadius: 24,
          padding: 28,
          boxShadow: S.shadowLg,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: dealId ? 22 : 0 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 999,
              background: S.invBg,
              color: S.invInk,
              display: 'grid',
              placeItems: 'center',
              fontSize: 'var(--crm-text-3xl)',
              fontWeight: 600,
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: S.ink, letterSpacing: -0.3 }}>
              {fullName}
            </div>
            <div style={{ fontSize: 'var(--crm-text-md)', color: S.muted, fontWeight: 500, marginTop: 2 }}>
              {[extracted.email, extracted.phone].filter(Boolean).join(' · ') || t('import.lead.created.partialContact')}
            </div>
          </div>
          <span
            style={{
              padding: '5px 11px',
              borderRadius: 999,
              background: S.cardSubtle,
              color: S.inkSoft,
              fontSize: 'var(--crm-text-xs)',
              fontWeight: 600,
                                        }}
          >
            {INTENT_LABELS[extracted.intent]}
          </span>
        </div>

        {dealId && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 14,
              background: S.cardSubtle,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <CrmIcon name="sparkle" size={16} stroke={S.ink} sw={1.8} />
            <div
              style={{
                flex: 1,
                fontSize: 'var(--crm-text-md)',
                fontWeight: 500,
                color: S.inkSoft,
                lineHeight: 1.5,
              }}
            >
              <span style={{ color: S.ink, fontWeight: 600}}>{t('import.lead.created.nextActionLabel')}</span>{' '}
              {NEXT_ACTION_LABELS[extracted.nextAction]}
              {extracted.urgency === 'high' && (
                <span style={{ color: S.warnDarker, fontWeight: 600 }}> {t('import.lead.created.highUrgencySuffix')}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: dealId ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 16 }}>
        {dealId && (
          <button
            onClick={onNavToDeal}
            style={{
              padding: '14px 20px',
              borderRadius: 16,
              border: 0,
              background: S.card,
              boxShadow: S.shadow,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: S.ink, marginBottom: 2 }}>
              {t('import.lead.created.viewPipeline')}
            </div>
            <div style={{ fontSize: 'var(--crm-text-xs)', color: S.muted, fontWeight: 500 }}>
              {t('import.lead.created.viewPipelineDesc')}
            </div>
          </button>
        )}
        <button
          onClick={onNavToContact}
          style={{
            padding: '14px 20px',
            borderRadius: 16,
            border: 0,
            background: S.card,
            boxShadow: S.shadow,
            cursor: 'pointer',
            fontFamily: 'inherit',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: S.ink, marginBottom: 2 }}>
            {t('import.lead.created.viewContact')}
          </div>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: S.muted, fontWeight: 500 }}>
            {t('import.lead.created.viewContactDesc')}
          </div>
        </button>
      </div>

      <div style={{ textAlign: 'center' }}>
        <button
          onClick={onClose}
          style={{
            height: 42,
            padding: '0 24px',
            borderRadius: 999,
            border: 0,
            background: S.accent,
            color: '#fff',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 'var(--crm-text-md)',
            fontWeight: 600,
            boxShadow: `0 6px 16px ${crmVoileEncre(false, 0.18)}`,
          }}
        >
          {t('common:actions.close')}
        </button>
      </div>
    </div>
  )
}
