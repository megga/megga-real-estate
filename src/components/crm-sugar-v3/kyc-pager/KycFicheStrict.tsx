// MEGGA CRM — KYC Pager · Fiche « table stricte » (overlay dans le bento)
// ─────────────────────────────────────────────────────────────────────────
// Port fidèle de `KypFiche` (kyc-pager-proto.jsx), branché sur la donnée LIVE
// et sur TOUTES les garanties compliance existantes :
//   • screening auto au réveil (EF kyc-screening / Dilisense) ;
//   • contrôles manuels id/domicile → upload réel (useUploadKycDocument) +
//     coche du checklist item ;
//   • ligne fonds → typologie source des fonds LBA art. 6 (SourceOfFundsOverlay) ;
//   • « Trancher » un match → décision documentée (justif ≥30 c, snapshot,
//     supersedes) via useCreateKycScreeningDecision — true_match ⇒ dossier
//     `failed` + MROS, false_positive ⇒ débloque ;
//   • log de consultation nLPD art. 12 (useLogKycRead) ;
//   • export = route print existante ; PAS de suppression (rétention LBA 10 ans).

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { SugarPalette } from '@/components/crm-sugar/tokens'
import {
  useKycCase,
  useKycDocuments,
  useScreenKycCase,
  useCreateKycScreeningDecision,
  useLatestKycScreeningDecision,
  useLogKycRead,
  useUploadKycDocument,
  useUpdateKycSourceOfFunds,
} from '@/hooks/useKyc'
import { useMarkKycCheck } from '@/hooks/useKycDossier'
import type {
  KycCaseWithChecklist,
  KycChecklistItem,
  KycCheckCategory,
  KycDocument,
  KycSourceOfFundsType,
  ScreeningDecisionTarget,
} from '@/types/kyc'
import { KYC_CHECK_LABELS } from '../tokens'
import { SourceOfFundsOverlay } from '../kyc/KycSourceOfFundsCard'
import {
  KYP_CHECK_ORDER,
  KYP_FONT,
  KYP_MANUAL_CHECKS,
  kypRiskMeta,
  kypStatusMeta,
  type KypSurf,
} from './kypTokens'
import { KypAvatar, KypCheckIcon, KypCta, KypIcon, KypPill } from './kypAtoms'
import { KycUploadModal } from './KycUploadModal'
import { KycDocViewer } from './KycDocViewer'

const CAT_TO_DOCCAT: Record<KycCheckCategory, KycDocument['document_category'][]> = {
  id: ['identity'],
  address: ['domicile'],
  funds: ['financial', 'compliance'],
  pep: [],
  sanctions: [],
}

const CAT_TO_UPLOADCAT: Record<'id' | 'address', 'identity' | 'domicile'> = {
  id: 'identity',
  address: 'domicile',
}

/**
 * Cadre des états SANS donnée de l'overlay — mêmes coordonnées que la fiche
 * elle-même (absolu, au-dessus du pager, fond opaque). Factorisé pour que l'attente
 * et l'échec occupent exactement la même surface : leur différence doit se lire dans
 * le texte, pas dans un déplacement de la mise en page.
 */
function KypFicheOverlay({ sp, children }: { sp: SugarPalette; children: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 40,
        background: sp.pageBg,
        display: 'grid',
        placeItems: 'center',
        padding: '26px 34px',
        boxSizing: 'border-box',
        fontFamily: KYP_FONT,
      }}
    >
      {children}
    </div>
  )
}

function fmtDate(iso: string | null | undefined, long?: boolean): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(
    'fr-CH',
    long ? { day: '2-digit', month: 'long', year: 'numeric' } : { day: '2-digit', month: 'short', year: 'numeric' },
  )
}

interface Props {
  dossierId: string
  agentId: string
  sp: SugarPalette
  surf: KypSurf
  onClose: () => void
  onNavigate: (screen: string) => void
}

export function KycFicheStrict({ dossierId, agentId, sp, surf, onClose, onNavigate }: Props) {
  const { data: dossier, isPending, isError, refetch } = useKycCase(dossierId)
  const { data: docs = [] } = useKycDocuments(dossierId)
  const markCheck = useMarkKycCheck()
  const screen = useScreenKycCase()
  const createDecision = useCreateKycScreeningDecision()
  const updateFunds = useUpdateKycSourceOfFunds()
  const upload = useUploadKycDocument()
  const logRead = useLogKycRead()
  const { data: sanctionsDecision } = useLatestKycScreeningDecision(dossierId, 'sanctions')
  const { data: pepDecision } = useLatestKycScreeningDecision(dossierId, 'pep')

  const [docView, setDocView] = useState<KycDocument | null>(null)
  const [matchView, setMatchView] = useState<ScreeningDecisionTarget | null>(null)
  const [upKey, setUpKey] = useState<'id' | 'address' | null>(null)
  const [fundsOpen, setFundsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Index checklist par catégorie LBA
  const checksByCategory = useMemo<Record<KycCheckCategory, KycChecklistItem | null>>(() => {
    const map: Record<KycCheckCategory, KycChecklistItem | null> = {
      id: null,
      address: null,
      pep: null,
      sanctions: null,
      funds: null,
    }
    const items = (dossier as KycCaseWithChecklist | undefined)?.checklist ?? []
    items.forEach((c) => {
      if ((KYP_CHECK_ORDER as string[]).includes(c.category)) {
        map[c.category as KycCheckCategory] = c
      }
    })
    return map
  }, [dossier])

  // nLPD art. 12 — log de consultation (une fois par dossier).
  const readLoggedRef = useRef<string | null>(null)
  const logReadMutate = logRead.mutate
  useEffect(() => {
    if (!dossier?.agency_id || readLoggedRef.current === dossierId) return
    readLoggedRef.current = dossierId
    logReadMutate({ kycCaseId: dossierId, agencyId: dossier.agency_id, actorId: agentId })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossier?.agency_id, dossierId, agentId])

  // Coche un contrôle auto (pep/sanctions), dédupliqué par ref-set → jamais de
  // double coche ni de double AuditEvent, même si l'auto-screening ET l'effet de
  // réconciliation ciblent le même item. Un échec est signalé (et retenté au
  // prochain montage de la fiche — le ref-set est réinitialisé au remount).
  const reconciledRef = useRef<Set<string>>(new Set())
  const markAuto = (cat: 'pep' | 'sanctions') => {
    const item = checksByCategory[cat]
    if (item && !item.is_completed && !reconciledRef.current.has(item.id)) {
      reconciledRef.current.add(item.id)
      markCheck.mutate(
        { checkId: item.id, is_completed: true, actorId: agentId },
        {
          onError: () =>
            setError("La validation d'un contrôle automatique n'a pas abouti — rechargez la fiche."),
        },
      )
    }
  }

  // Réconciliation : un contrôle auto déjà « clair » (ou faux positif documenté)
  // mais NON coché est complété. Couvre le dossier screené ailleurs ou une coche
  // précédente échouée — sinon la fiche affiche « Vérifié » mais le trigger
  // auto_verify ne peut jamais finaliser (dossier figé « En cours »). Il ne
  // s'agit PAS d'une validation humaine : pep/sanctions sont les contrôles
  // AUTOMATIQUES du design (le dossier, lui, ne passe `verified` que si les
  // pièces manuelles ont toutes été validées par un geste agent). Jamais sur un
  // dossier déjà vérifié.
  useEffect(() => {
    if (!dossier || dossier.dossier_status === 'verified') return
    ;(['pep', 'sanctions'] as const).forEach((cat) => {
      const st = cat === 'pep' ? dossier.pep_status : dossier.sanctions_status
      const dec = cat === 'pep' ? pepDecision : sanctionsDecision
      if (st === 'clear' || dec?.decision === 'false_positive') markAuto(cat)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dossier?.id,
    dossier?.dossier_status,
    dossier?.pep_status,
    dossier?.sanctions_status,
    pepDecision?.decision,
    sanctionsDecision?.decision,
    checksByCategory,
  ])

  // Screening automatique au réveil : dossier jamais screené → PEP + sanctions
  // « sous les yeux de l'agent ». Une seule fois. La coche des contrôles clairs
  // est portée par l'effet de réconciliation ci-dessus (le backend ne coche pas seul).
  const autoScreenedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!dossier || autoScreenedRef.current === dossierId) return
    const notScreened =
      !dossier.last_screening_at &&
      (dossier.pep_status == null || dossier.pep_status === 'not_checked') &&
      (dossier.sanctions_status == null || dossier.sanctions_status === 'not_checked')
    if (!notScreened || dossier.dossier_status === 'verified' || !dossier.contact) return
    autoScreenedRef.current = dossierId
    const name = `${dossier.contact.first_name} ${dossier.contact.last_name}`.trim()
    screen.mutate(
      {
        kycCaseId: dossierId,
        contactName: name,
        contactNationality: dossier.contact_nationality ?? '',
        entityType: dossier.type.endsWith('_pm') ? 'entity' : 'individual',
      },
      {
        onError: () =>
          setError("Le screening automatique n'a pas abouti — rechargez la fiche pour le relancer."),
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossier?.id, dossier?.last_screening_at])

  // Attente RÉELLE et échec TERMINAL sont deux états distincts. Les confondre
  // (`isLoading || !dossier`) laissait cet overlay PLEIN ÉCRAN sur « Chargement du
  // dossier… » indéfiniment dès que la lecture échouait — dossier inexistant, hors
  // périmètre RLS, réseau coupé : `.single()` sur 0 ligne répond 406, `isLoading`
  // retombait à false et `dossier` restait undefined. L'agent se retrouvait devant
  // une page muette, sans explication ni issue, par-dessus le pager. Même discipline
  // que resolveLabGuardStatus (useLabGuard.ts) : un état non résolu n'est pas un
  // verdict, mais un échec acquis doit se DIRE.
  //
  // `isPending`, pas `isLoading` : `isLoading` = isPending && isFetching, donc il
  // retombe à false entre deux tentatives (retry: 1, App.tsx) — l'écran d'échec
  // clignoterait avant que l'échec soit acquis.
  if (isPending) {
    return (
      <KypFicheOverlay sp={sp}>
        <span style={{ color: sp.sub, fontSize: 'var(--crm-text-xl)', fontWeight: 500 }}>Chargement du dossier…</span>
      </KypFicheOverlay>
    )
  }

  // Lecture aboutie sans dossier, ou en échec. On n'énonce PAS un verdict qu'on n'a
  // pas : les deux causes — le dossier n'existe pas / il n'est pas visible depuis
  // cette agence — répondent au même 406, et un réseau coupé y ressemble. D'où
  // « indisponible » plutôt que « supprimé » (un dossier KYC ne se supprime jamais :
  // rétention LBA 10 ans, cf. l'en-tête de ce fichier) et une reprise, qui règle la
  // seule cause transitoire des trois.
  if (isError || !dossier) {
    return (
      <KypFicheOverlay sp={sp}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--crm-text-2xl)', fontWeight: 700, color: sp.ink }}>Dossier indisponible</h2>
          <p style={{ margin: '10px 0 0', fontSize: 'var(--crm-text-lg)', lineHeight: 1.55, color: sp.sub }}>
            Ce dossier n'a pas pu être ouvert : il n'existe pas, ou il n'est pas accessible depuis votre agence.
          </p>
          <div style={{ marginTop: 18, display: 'flex', gap: 'var(--crm-space-lg)', justifyContent: 'center' }}>
            <KypCta sp={sp} onClick={() => void refetch()}>
              Réessayer
            </KypCta>
            <button
              onClick={onClose}
              // Surface secondaire du pager (même carte + ombre que le bouton
              // « Retour » de l'en-tête de la fiche), pour ne pas mettre deux
              // appels à l'action de même poids côte à côte.
              style={{
                height: 34,
                padding: '0 var(--crm-space-2xl)',
                borderRadius: 'var(--crm-radius-pill)',
                border: 0,
                background: surf.card,
                boxShadow: sp.shadowSm,
                color: sp.ink,
                fontFamily: KYP_FONT,
                fontSize: 'var(--crm-text-md)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Retour aux dossiers
            </button>
          </div>
        </div>
      </KypFicheOverlay>
    )
  }

  const contact = dossier.contact
  const statusMeta = kypStatusMeta(dossier.dossier_status)
  const riskMeta = kypRiskMeta(dossier.risk_level)
  const verified = dossier.dossier_status === 'verified'

  const isDone = (item: KycChecklistItem | null) => !!item && (item.is_completed || item.is_required === false)
  const manualMissing = () => KYP_MANUAL_CHECKS.filter((k) => !isDone(checksByCategory[k])) as ('id' | 'address')[]

  const docsForCategory = (cat: KycCheckCategory) => {
    const wanted = CAT_TO_DOCCAT[cat]
    if (wanted.length === 0) return []
    return docs.filter((d) => wanted.includes(d.document_category))
  }

  const matchUnresolved = (cat: 'pep' | 'sanctions') => {
    const status = cat === 'pep' ? dossier.pep_status : dossier.sanctions_status
    const decision = cat === 'pep' ? pepDecision : sanctionsDecision
    return status === 'match' && decision?.decision !== 'false_positive'
  }

  // Téléversement d'un contrôle manuel → upload réel + coche du check.
  const handleUpload = (cat: 'id' | 'address', file: File) => {
    setError(null)
    if (!dossier.agency_id) {
      setError('Agence introuvable pour ce dossier.')
      return
    }
    upload.mutate(
      {
        kycCaseId: dossierId,
        agencyId: dossier.agency_id,
        file,
        documentCategory: CAT_TO_UPLOADCAT[cat],
        uploadedBy: agentId,
      },
      {
        onSuccess: () => {
          const item = checksByCategory[cat]
          if (item && !item.is_completed) {
            markCheck.mutate({ checkId: item.id, is_completed: true, actorId: agentId })
          }
          setUpKey(null)
        },
        onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Échec du téléversement.'),
      },
    )
  }

  const handleFundsSubmit = (
    sourceType: KycSourceOfFundsType,
    description: string | null,
    docId: string | null,
  ) => {
    if (!dossier.agency_id) return
    updateFunds.mutate(
      {
        kycCaseId: dossierId,
        agencyId: dossier.agency_id,
        actorId: agentId,
        sourceType,
        description,
        docId,
      },
      {
        onSuccess: () => {
          setFundsOpen(false)
          const item = checksByCategory.funds
          if (item && !item.is_completed) {
            markCheck.mutate({ checkId: item.id, is_completed: true, actorId: agentId })
          }
        },
      },
    )
  }

  const cols = '44px 1.1fr 1.6fr 110px 150px'

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 40,
        background: sp.pageBg,
        animation: 'kypFiche .42s cubic-bezier(.2,.8,.2,1) both',
        padding: '26px 34px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--crm-space-3xl)',
        overflow: 'hidden',
        fontFamily: KYP_FONT,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)' }}>
        <button
          onClick={onClose}
          title="Retour"
          style={{
            width: 42,
            height: 42,
            borderRadius: 'var(--crm-radius-pill)',
            border: 0,
            cursor: 'pointer',
            flexShrink: 0,
            background: surf.card,
            boxShadow: sp.shadowSm,
            color: sp.ink,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <KypIcon name="arrowL" size={18} />
        </button>
        {contact && <KypAvatar firstName={contact.first_name} lastName={contact.last_name} size={46} ring={sp.pageBg} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 800, letterSpacing: -0.5, color: sp.ink }}>
            {contact ? `${contact.first_name} ${contact.last_name}` : 'Dossier KYC'}
          </div>
          <div style={{ fontSize: 'var(--crm-text-md)', color: sp.sub, fontWeight: 500, marginTop: 3 }}>
            {dossier.created_at && dossier.dossier_status !== 'none'
              ? `Ouvert le ${fmtDate(dossier.created_at, true)}`
              : 'Dossier non démarré'}
          </div>
        </div>
        <KypPill tone={statusMeta.tone} label={statusMeta.label} />
        <KypPill tone={riskMeta.tone} label={riskMeta.label} />
      </div>

      {/* Table stricte */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          background: surf.card,
          borderRadius: 'var(--crm-radius-5xl)',
          boxShadow: sp.shadow,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: cols,
            gap: 'var(--crm-space-2xl)',
            padding: 'var(--crm-space-xl) var(--crm-space-7xl)',
            fontSize: 'var(--crm-text-sm)',
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            color: sp.sub,
            borderBottom: `1px solid ${surf.hairline}`,
            flexShrink: 0,
          }}
        >
          <div />
          <div>Contrôle</div>
          <div>Preuve / note</div>
          <div>Date</div>
          <div style={{ textAlign: 'right' }}>Statut</div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {KYP_CHECK_ORDER.map((cat, i) => {
            const item = checksByCategory[cat]
            const label = KYC_CHECK_LABELS[cat]?.title ?? cat
            const done = isDone(item)
            const isAuto = cat === 'pep' || cat === 'sanctions'
            const autoStatus = cat === 'pep' ? dossier.pep_status : dossier.sanctions_status
            const decision = cat === 'pep' ? pepDecision : cat === 'sanctions' ? sanctionsDecision : null
            const decisionCleared = decision?.decision === 'false_positive'
            const screeningThis = isAuto && screen.isPending && autoStatus !== 'clear' && autoStatus !== 'match'
            const rowDocs = docsForCategory(cat)
            // Contrôle auto « ok » = screening clair OU faux positif documenté.
            const okVisual = done || (isAuto && (autoStatus === 'clear' || decisionCleared))
            const na = item?.is_required === false

            return (
              <div
                key={cat}
                style={{
                  display: 'grid',
                  gridTemplateColumns: cols,
                  gap: 'var(--crm-space-2xl)',
                  alignItems: 'center',
                  padding: 'var(--crm-space-3xl) var(--crm-space-7xl)',
                  borderBottom: i < KYP_CHECK_ORDER.length - 1 ? `1px solid ${surf.hairline}` : '0',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--crm-radius-pill)',
                    flexShrink: 0,
                    background: okVisual ? sp.focusBg : surf.cardSub,
                    color: okVisual ? sp.focusInk : sp.ink,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <KypCheckIcon category={cat} size={16} sw={1.7} />
                </div>
                <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 700, color: sp.ink, letterSpacing: -0.2 }}>{label}</div>
                <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
                  {rowDocs.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => setDocView(doc)}
                      title={`Ouvrir ${doc.name}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--crm-space-sm)',
                        height: 26,
                        padding: '0 var(--crm-space-lg)',
                        borderRadius: 'var(--crm-radius-pill)',
                        border: 0,
                        background: surf.cardSub,
                        color: sp.ink,
                        fontFamily: KYP_FONT,
                        fontSize: 'var(--crm-text-sm)',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        flexShrink: 0,
                        maxWidth: 180,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      <KypIcon name="clip" size={12} />
                      {doc.name}
                    </button>
                  ))}
                  <span
                    style={{
                      fontSize: 'var(--crm-text-md)',
                      color: sp.soft,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {screeningThis
                      ? 'Interrogation des bases PEP & sanctions…'
                      : item?.notes || (rowDocs.length ? '' : '—')}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--crm-text-md)', color: sp.sub, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {screeningThis
                    ? '—'
                    : item?.completed_at
                      ? fmtDate(item.completed_at)
                      : isAuto && autoStatus === 'clear'
                        ? fmtDate(dossier.last_screening_at)
                        : '—'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {screeningThis ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-md)', fontSize: 'var(--crm-text-md)', fontWeight: 700, color: sp.ink, whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 'var(--crm-radius-pill)',
                          border: `2px solid ${surf.hairline}`,
                          borderTopColor: sp.ink,
                          animation: 'kypSpin .7s linear infinite',
                          flexShrink: 0,
                          boxSizing: 'border-box',
                        }}
                      />
                      Screening en cours…
                    </span>
                  ) : okVisual ? (
                    <span style={{ animation: isAuto ? 'kypPop .38s cubic-bezier(.2,.8,.2,1) both' : 'none', display: 'inline-flex' }}>
                      <KypPill tone={na ? sp.sub : '#059669'} label={na ? 'Non requis' : 'Vérifié'} />
                    </span>
                  ) : isAuto && matchUnresolved(cat as 'pep' | 'sanctions') ? (
                    <KypCta sp={sp} h={28} onClick={() => setMatchView(cat as ScreeningDecisionTarget)}>
                      Trancher
                    </KypCta>
                  ) : cat === 'id' || cat === 'address' ? (
                    <KypCta sp={sp} h={28} onClick={() => setUpKey(cat)}>
                      Téléverser
                    </KypCta>
                  ) : cat === 'funds' ? (
                    <KypCta sp={sp} h={28} onClick={() => setFundsOpen(true)}>
                      Renseigner
                    </KypCta>
                  ) : (
                    <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.sub, whiteSpace: 'nowrap' }}>
                      Automatique — en attente
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Pied */}
        <div
          style={{
            padding: 'var(--crm-space-2xl) var(--crm-space-7xl)',
            borderTop: `1px solid ${surf.hairline}`,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--crm-space-xl)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 'var(--crm-text-md)', color: sp.sub, fontWeight: 600 }}>
            {verified
              ? `Dossier complet — valable jusqu'au ${fmtDate(dossier.expires_at, true)}.`
              : 'Piste d’audit complète disponible dans le Journal.'}
          </span>
          <span
            onClick={() => onNavigate('audit')}
            style={{ fontSize: 'var(--crm-text-md)', fontWeight: 700, color: sp.ink, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Ouvrir le Journal ›
          </span>
          <span style={{ flex: 1 }} />
          <span
            onClick={() => window.open(`/dashboard/kyc/${dossierId}/export`, '_blank', 'noopener,noreferrer')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--crm-space-sm)',
              height: 36,
              padding: '0 var(--crm-space-2xl)',
              borderRadius: 'var(--crm-radius-pill)',
              background: surf.cardSub,
              boxShadow: sp.shadowSm,
              color: sp.ink,
              fontSize: 'var(--crm-text-md)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <KypIcon name="download" size={14} />
            Exporter le dossier
          </span>
          {manualMissing().length > 0 && (
            <KypCta sp={sp} h={36} onClick={() => setUpKey(manualMissing()[0])}>
              Téléverser les pièces
            </KypCta>
          )}
        </div>
      </div>

      {error && (
        <div style={{ position: 'absolute', bottom: 16, left: 34, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: surf.destructive }}>
          {error}
        </div>
      )}

      {docView && <KycDocViewer doc={docView} sp={sp} surf={surf} onClose={() => setDocView(null)} />}

      {upKey && contact && (
        <KycUploadModal
          category={upKey}
          contactName={`${contact.first_name} ${contact.last_name}`}
          sp={sp}
          surf={surf}
          pending={upload.isPending}
          onCancel={() => setUpKey(null)}
          onConfirm={(file) => handleUpload(upKey, file)}
        />
      )}

      {fundsOpen && (
        <SourceOfFundsOverlay
          dossier={dossier}
          documents={docs}
          isPending={updateFunds.isPending}
          onCancel={() => setFundsOpen(false)}
          onSubmit={handleFundsSubmit}
        />
      )}

      {matchView && (
        <MatchDecisionModal
          target={matchView}
          dossier={dossier}
          sp={sp}
          surf={surf}
          pending={createDecision.isPending}
          onCancel={() => setMatchView(null)}
          onDecide={(verdict, justification) => {
            if (!dossier.agency_id) return
            const snapshot = {
              sanctions_status: dossier.sanctions_status,
              pep_status: dossier.pep_status,
              sanctions_details: dossier.sanctions_details,
              pep_details: dossier.pep_details,
              risk_score: dossier.risk_score,
              risk_factors: dossier.risk_factors,
              last_screening_at: dossier.last_screening_at,
              taken_at: new Date().toISOString(),
            }
            const previous = matchView === 'sanctions' ? sanctionsDecision : pepDecision
            const target = matchView
            createDecision.mutate(
              {
                kycCaseId: dossierId,
                agencyId: dossier.agency_id,
                decidedBy: agentId,
                target,
                decision: verdict,
                justification,
                screeningSnapshot: snapshot,
                supersedesId: previous?.id ?? null,
              },
              {
                onSuccess: () => {
                  // Faux positif écarté → le contrôle auto passe vérifié (débloque
                  // la validation ; le trigger auto_verify accepte false_positive).
                  // true_match → dossier failed/MROS, on ne coche rien.
                  if (verdict === 'false_positive') markAuto(target)
                  setMatchView(null)
                },
              },
            )
          }}
        />
      )}
    </div>
  )
}

// ─── Modale « Trancher » (match PEP / sanctions) ────────────────────────
// Design KypFiche + champ justification OBLIGATOIRE ≥30 c (LBA art. 7 al. 1
// lit. b — le proto mock l'omettait faute de backend).
function MatchDecisionModal({
  target,
  dossier,
  sp,
  surf,
  pending,
  onCancel,
  onDecide,
}: {
  target: ScreeningDecisionTarget
  dossier: KycCaseWithChecklist
  sp: SugarPalette
  surf: KypSurf
  pending: boolean
  onCancel: () => void
  onDecide: (verdict: 'true_match' | 'false_positive', justification: string) => void
}) {
  const [justif, setJustif] = useState('')
  const isPep = target === 'pep'
  const details = (isPep ? dossier.pep_details : dossier.sanctions_details) as
    | { total?: number; records?: Array<Record<string, unknown>> }
    | null
  const record = details?.records?.[0] ?? null
  const recordName = (record?.name as string) || (contactName(dossier)) || '—'
  const total = details?.total ?? details?.records?.length ?? 0
  const canDecide = justif.trim().length >= 30

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 70,
        background: surf.dark ? 'rgba(0,0,4,.72)' : 'rgba(14,20,16,.42)',
        display: 'grid',
        placeItems: 'center',
        animation: 'kypDocFade .22s ease both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          maxWidth: 'calc(100% - 60px)',
          background: surf.card,
          borderRadius: 'var(--crm-radius-5xl)',
          boxShadow: '0 40px 100px rgba(15,23,42,0.30), 0 8px 24px rgba(15,23,42,0.14)',
          padding: '26px 26px 22px',
          boxSizing: 'border-box',
          animation: 'kypDocUp .3s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 800, letterSpacing: -0.4, color: sp.ink }}>
          {isPep ? 'Match PEP à trancher' : 'Alerte sanctions à trancher'}
        </div>
        <div style={{ background: surf.cardSub, borderRadius: 'var(--crm-radius-xl)', padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-lg)' }}>
            <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 700, color: sp.ink }}>{recordName}</span>
            <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
              {total} correspondance{total > 1 ? 's' : ''}
            </span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub }}>Dilisense</span>
          </div>
          <p style={{ margin: '9px 0 0', fontSize: 'var(--crm-text-lg)', color: sp.soft, fontWeight: 500, lineHeight: 1.55 }}>
            {isPep
              ? 'Correspondance sur les listes de Personnes Exposées Politiquement. Vérifiez l’identité (date de naissance, nationalité) avant de trancher.'
              : 'Correspondance sur les listes de sanctions (OFAC / SECO / ONU / UE). Vérifiez l’identité avant de trancher.'}
          </p>
        </div>

        <label style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.soft, margin: '14px 0 6px' }}>
          Justification (≥ 30 caractères — LBA art. 7) · {justif.trim().length}
        </label>
        <textarea
          value={justif}
          onChange={(e) => setJustif(e.target.value)}
          rows={3}
          placeholder="Éléments d’identité vérifiés, motif de la décision…"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: 'var(--crm-space-lg) var(--crm-space-xl)',
            borderRadius: 'var(--crm-radius-lg)',
            border: `1px solid ${surf.hairline}`,
            background: surf.cardSub,
            fontFamily: KYP_FONT,
            fontSize: 'var(--crm-text-lg)',
            color: sp.ink,
            resize: 'vertical',
            minHeight: 72,
          }}
        />
        <p style={{ margin: '10px 0 0', fontSize: 'var(--crm-text-md)', color: sp.sub, fontWeight: 500, lineHeight: 1.5 }}>
          Votre décision est consignée (append-only). « Confirmer le match » place le dossier en « à examiner »
          (communication MROS, LBA art. 9).
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--crm-space-lg)', marginTop: 18 }}>
          <button
            onClick={() => canDecide && onDecide('true_match', justif.trim())}
            disabled={!canDecide || pending}
            style={{
              height: 40,
              padding: '0 var(--crm-space-4xl)',
              borderRadius: 'var(--crm-radius-pill)',
              border: 0,
              cursor: canDecide && !pending ? 'pointer' : 'not-allowed',
              opacity: canDecide ? 1 : 0.5,
              background: surf.cardSub,
              color: sp.ink,
              fontFamily: KYP_FONT,
              fontSize: 'var(--crm-text-lg)',
              fontWeight: 700,
            }}
          >
            Confirmer le match
          </button>
          <button
            onClick={() => canDecide && onDecide('false_positive', justif.trim())}
            disabled={!canDecide || pending}
            style={{
              height: 40,
              padding: '0 var(--crm-space-4xl)',
              borderRadius: 'var(--crm-radius-pill)',
              border: 0,
              cursor: canDecide && !pending ? 'pointer' : 'not-allowed',
              opacity: canDecide ? 1 : 0.5,
              background: sp.focusBg,
              color: sp.focusInk,
              fontFamily: KYP_FONT,
              fontSize: 'var(--crm-text-lg)',
              fontWeight: 700,
            }}
          >
            Écarter le faux positif
          </button>
        </div>
      </div>
    </div>
  )
}

function contactName(dossier: KycCaseWithChecklist): string | null {
  return dossier.contact ? `${dossier.contact.first_name} ${dossier.contact.last_name}` : null
}
