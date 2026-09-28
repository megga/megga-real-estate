/**
 * MEGGA CRM — la fiche d'AFFAIRE (route /dashboard/transactions/:id, bureau ; le téléphone a son
 * propre écran, `MobileDealDetailPage`). Refonte du 27.09.2026, qui a remplacé la fiche deal V4
 * « Atelier scindé ».
 *
 * ⛔ UNE SEULE FEUILLE (Julien, 27.09.2026 : « il ne faudrait pas qu'il y ait de l'espace vide entre
 * les bentos »). La fiche d'avant posait deux cartes flottantes côte à côte, la gauche vide aux deux
 * tiers ; celle-ci est une feuille continue découpée par des FILETS — la grammaire que le board du
 * Pipeline et « Aujourd'hui » portent déjà. La dernière section de chaque colonne s'étire.
 *
 * Ce qu'elle corrige, mesuré sur le banc :
 *  - l'ÉTAPE était fausse — un deal chez le notaire s'affichait « Offre déposée · étape 7/8 » et la
 *    page invitait à « Saisir une offre ». Ici, les cinq phases et le stade exact, RÉGLABLES ;
 *  - rien ne s'y faisait AVANCER : la prochaine action n'avait ni date ni geste ;
 *  - les biens proposés venaient d'un calcul local (deux studios à 89 % pour une acheteuse de quatre
 *    pièces) : ici, le moteur de matching (`useFicheAffaire`) ;
 *  - l'offre se lisait sans le prix demandé : ici, l'écart de chaque tour au prix affiché ;
 *  - aucun historique : ici, les faits de l'affaire et ses offres, datés.
 *
 * ⚠ LE MOTEUR NE CHANGE PAS. Accepter une offre SIGNE l'affaire (trigger `trg_crm_offer_sign_deal`,
 * contrat de la boucle de négociation) et la conclut, exactement comme la fiche d'avant.
 *
 * Une affaire CONCLUE (27.09.2026) : la fiche devient un récapitulatif (prix final, écart au prix
 * demandé, cycle, commission estimée) et un bandeau dit où en est la CLÔTURE — enregistrée, ou à
 * terminer dans les 30 jours qui suivent la conclusion. Au-delà, une affaire conclue avant ce
 * chantier n'a jamais eu de clôture, et le lui réclamer serait du bruit.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import { CRM_KEYFRAMES } from '@/components/crm/CrmShell'
import OfferModal from '@/components/crm-dossiers/offer-modal/OfferModal'
import { useContact } from '@/hooks/useContacts'
import { useProperty } from '@/hooks/useProperties'
import { useOfferChain, lastOffer, useUpdateOfferStatus } from '@/hooks/useOffers'
import { useKycDossierByContact } from '@/hooks/useKycDossier'
import { useTransaction, useUpdateTransactionStage, useUpdateTransactionStatus } from '@/hooks/useTransactions'
import {
  useCompleteReminder, usePipelineReminderCreators, useRescheduleReminder, useTransactionNextReminder,
} from '@/hooks/usePipelineNextActions'
import { useFicheAffaire } from '@/hooks/useFicheAffaire'
import { ACTION_CLOTURE, useClotureAffaire, usePlanifierApresVente } from '@/hooks/useClotureAffaire'
import { useLogAudit } from '@/hooks/useAuditLog'
import { useMailAccounts } from '@/hooks/useMailAccounts'
import { useEcranActif } from '@/hooks/useEcranActif'
import { mapStage } from '@/lib/crmAdapters'
import type { TransactionStage } from '@/lib/constants'
import { useCrmDarkPref } from '@/lib/crmDark'
import { buildWaMeUrl } from '@/lib/waMeUrl'
import type { Offer, OfferKind } from '@/types/offer'
import { crmFmtCHF, crmMix, crmPalette, crmVoileEncre, type CrmPalette } from '@/components/crm/tokens'
import { CapsuleToast } from '@/components/crm/pipeline/CapsuleToast'
import { ClotureAffaire } from '@/components/crm/pipeline/ClotureAffaire'
import { ETAPES_APRES_VENTE, dateEtape } from '@/components/crm/pipeline/apresVente'
import { LostConfirmModal } from '@/components/crm/pipeline/LostConfirmModal'
import { iconeAction, jourCourt } from '@/components/crm/pipeline/affaire'
import { PHASES, echeanceDe, joursJusqua, montantCourt, phase, phaseDe, stadeDEntree } from '@/components/crm/pipeline/phases'
import { ton } from '@/components/crm/pipeline/tons'

/** Les choix d'une replanification : quatre jours, l'heure gardée — un geste, pas un calendrier. */
const CHOIX_JOURS: { cle: 'demain' | 'apresDemain' | 'lundi' | 'semaine'; jours: () => number }[] = [
  { cle: 'demain', jours: () => 1 },
  { cle: 'apresDemain', jours: () => 2 },
  { cle: 'lundi', jours: () => { const j = new Date().getDay(); return ((8 - j) % 7) || 7 } },
  { cle: 'semaine', jours: () => 7 },
]

/** Une section de la feuille : un filet en haut, jamais une carte. */
function Section({ sp, titre, droite, etire, premiere, children }: {
  sp: CrmPalette; titre?: string; droite?: ReactNode; etire?: boolean; premiere?: boolean; children: ReactNode
}) {
  return (
    <section style={{
      padding: 'var(--crm-space-2xl) var(--crm-space-7xl)', display: 'flex', flexDirection: 'column',
      gap: 'var(--crm-space-md)', borderTop: premiere ? 'none' : `1px solid ${sp.cardBorder}`,
      flex: etire ? 1 : undefined, minWidth: 0,
    }}>
      {(titre || droite) && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--crm-space-md)' }}>
          {titre && <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }}>{titre}</span>}
          {droite}
        </div>
      )}
      {children}
    </section>
  )
}

/** Un lien d'action discret — la même encre partout, soulignée au survol. */
function Lien({ sp, onClick, children }: { sp: CrmPalette; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      alignSelf: 'flex-start', border: 0, background: 'transparent', padding: 0, cursor: 'pointer',
      fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: ton('aujourdhui', sp).encre,
      display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)',
    }}>{children}<MEIcon name="arrow-right" size={12} color={ton('aujourdhui', sp).encre} /></button>
  )
}

/** Un bouton-pilule : `plein` porte l'accent (l'affordance PRIMAIRE), les autres restent au trait. */
function Pilule({ sp, onClick, plein, ton: t, children }: {
  sp: CrmPalette; onClick: () => void; plein?: boolean; ton?: { encre: string; filet: string }; children: ReactNode
}) {
  return (
    <button type="button" onClick={onClick} style={{
      height: 32, padding: '0 var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, whiteSpace: 'nowrap',
      display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)',
      background: plein ? sp.accent : 'transparent', color: plein ? sp.accentInk : t ? t.encre : sp.ink,
      border: plein ? '1px solid transparent' : `1px solid ${t ? t.filet : sp.cardBorder}`,
    }}>{children}</button>
  )
}

export default function DealDetailPage() {
  const { t, i18n } = useTranslation(['pipeline', 'contacts', 'common'])
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [dark, setDark] = useCrmDarkPref()
  const sp = crmPalette(dark)
  const langue = i18n.language

  const tx = useTransaction(id)
  const deal = tx.data
  const contactId = deal?.contact_buyer_id ?? deal?.contact_seller_id ?? undefined
  const { data: contact } = useContact(contactId)
  const { data: bien } = useProperty(deal?.property_id || undefined)
  const { data: chaine = [] } = useOfferChain(deal?.id)
  const { data: kyc } = useKycDossierByContact(deal?.contact_buyer_id ?? undefined)
  const { nextAction } = useTransactionNextReminder(deal?.id)
  const { faits, matchs, visites } = useFicheAffaire(deal?.id, contactId)
  // La clôture ne se lit que pour une affaire conclue : une affaire en cours n'a rien à clore.
  const { data: etatCloture } = useClotureAffaire(deal?.id, deal?.status === 'completed')
  const planifierApres = usePlanifierApresVente()
  const boites = useMailAccounts()
  const updateStage = useUpdateTransactionStage()
  const updateStatus = useUpdateTransactionStatus()
  const updateOffer = useUpdateOfferStatus()
  const replanifier = useRescheduleReminder()
  const terminer = useCompleteReminder()
  const { createNextAction } = usePipelineReminderCreators()
  const logAudit = useLogAudit()

  const [toast, setToast] = useState<string | null>(null)
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null)
  const montrer = (m: string) => {
    if (minuterie.current) clearTimeout(minuterie.current)
    setToast(m)
    minuterie.current = setTimeout(() => setToast(null), 4000)
  }
  useEffect(() => () => { if (minuterie.current) clearTimeout(minuterie.current) }, [])

  const [offre, setOffre] = useState<OfferKind | null>(null)
  const [perdu, setPerdu] = useState(false)
  const [clotureOuverte, setClotureOuverte] = useState(false)
  // Le pager de la fiche : la confirmation « Perdu » s'y monte, et son flou n'en déborde pas.
  const [pager, setPager] = useState<HTMLDivElement | null>(null)
  const [jours, setJours] = useState(false)
  const joursRef = useRef<HTMLDivElement>(null)
  const ecranActif = useEcranActif()
  useEffect(() => {
    if (!jours || !ecranActif) return
    const dehors = (e: MouseEvent) => { if (joursRef.current && !joursRef.current.contains(e.target as Node)) setJours(false) }
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') setJours(false) }
    document.addEventListener('mousedown', dehors)
    document.addEventListener('keydown', echap)
    return () => { document.removeEventListener('mousedown', dehors); document.removeEventListener('keydown', echap) }
  }, [jours, ecranActif])

  const cadre = (enfants: ReactNode) => (
    <div style={{
      position: 'relative', background: sp.pageBg, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--crm-font, "Inter Tight"), system-ui, sans-serif', color: sp.ink,
    }}>
      <style>{CRM_KEYFRAMES}</style>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <CrmWorkspace active="pipeline" sp={sp} dark={dark} setDark={setDark}>
          <main style={{
            flex: 1, minWidth: 0, minHeight: 0, height: '100%',
            padding: 'var(--crm-space-lg) var(--crm-space-7xl) var(--crm-space-6xl) var(--crm-space-lg)',
          }}>
            <div ref={setPager} style={{
              position: 'relative', height: '100%', borderRadius: 'var(--crm-radius-6xl)', overflow: 'hidden',
              border: `1px solid ${sp.frameBorder}`, boxShadow: sp.shadow, background: sp.cardBg,
              display: 'flex', flexDirection: 'column',
            }}>{enfants}</div>
          </main>
        </CrmWorkspace>
      </div>
      {toast && <CapsuleToast sp={sp} message={toast} />}
    </div>
  )

  if (tx.isLoading) return cadre(<div style={{ flex: 1, display: 'grid', placeItems: 'center', color: sp.sub }}>{t('deal.loading')}</div>)
  if (tx.isError) {
    return cadre(<div style={{ flex: 1, display: 'grid', placeItems: 'center', color: ton('retard', sp).encre }}>
      {t('deal.load_error', { message: tx.error?.message ?? t('deal.error_unknown') })}
    </div>)
  }
  if (!deal) return cadre(<div style={{ flex: 1, display: 'grid', placeItems: 'center', color: sp.sub }}>{t('deal.not_found')}</div>)

  const stade = deal.stage as TransactionStage
  const idPhase = phaseDe(stade)
  const rang = idPhase ? PHASES.findIndex((p) => p.id === idPhase) : -1
  const conclue = deal.status === 'completed'
  const perdue = stade === 'lost'
  const nom = contact ? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() : t('deal.buyer_fallback')
  const prixDemande = bien?.price ?? null
  const dernier = lastOffer(chaine)
  const vendeurSeul = !deal.contact_buyer_id && !!deal.contact_seller_id

  const rafraichir = () => { void queryClient.invalidateQueries({ queryKey: ['fiche-affaire'] }) }

  /** Pose un stade : l'écriture, le journal si la base a dit oui, la confirmation. */
  const poser = (s: TransactionStage, message = t('fiche.toast.etape')) => {
    const de = stade
    updateStage.mutate({ id: deal.id, stage: s }, {
      onSuccess: () => {
        logAudit.mutate({
          category: 'deal', severity: 'info', action: 'Étape changée', entityType: 'deal', entityId: deal.id,
          objectLabel: nom, metadata: { from: mapStage(de), to: mapStage(s), old_stage: de, new_stage: s },
        }, { onSettled: rafraichir })
        montrer(message)
      },
      onError: () => montrer(t('board.toast.moveFailedTitle')),
    })
  }
  const conclure = async () => {
    try {
      if (stade !== 'signed') await updateStage.mutateAsync({ id: deal.id, stage: 'signed' })
      await updateStatus.mutateAsync({ id: deal.id, status: 'completed' })
      rafraichir()
      setClotureOuverte(true)
    } catch { montrer(t('board.toast.moveFailedTitle')) }
  }
  const rouvrir = async () => {
    try {
      if (perdue) await updateStage.mutateAsync({ id: deal.id, stage: 'to_recontact' })
      if (conclue) await updateStatus.mutateAsync({ id: deal.id, status: 'active' })
      rafraichir()
      montrer(t('fiche.toast.etape'))
    } catch { montrer(t('board.toast.moveFailedTitle')) }
  }
  const repondre = (o: Offer, status: 'accepted' | 'rejected') => {
    updateOffer.mutate({ offerId: o.id, dealId: deal.id, status }, {
      onSuccess: () => {
        // Accepter SIGNE l'affaire (trigger) et la conclut — le contrat de la fiche d'avant.
        if (status === 'accepted') {
          void updateStatus.mutateAsync({ id: deal.id, status: 'completed' }).then(() => setClotureOuverte(true)).catch(() => {})
        }
        rafraichir()
        montrer(status === 'accepted' ? t('deal.toast.accepted') : t('deal.toast.rejected'))
      },
      onError: (err) => montrer(t('deal.offer_update_failed', { message: err.message })),
    })
  }
  const auJour = (plus: number) => {
    const d = new Date()
    d.setDate(d.getDate() + plus)
    if (nextAction) { const h = new Date(nextAction.dueAt); d.setHours(h.getHours(), h.getMinutes(), 0, 0) } else d.setHours(10, 0, 0, 0)
    return d
  }
  const choisirJour = async (plus: number) => {
    setJours(false)
    const quand = auJour(plus)
    try {
      if (nextAction?.reminderId) {
        await replanifier.mutateAsync({ id: nextAction.reminderId, triggerAt: quand.toISOString() })
        montrer(t('fiche.toast.replanifiee'))
      } else {
        await createNextAction({
          transactionId: deal.id, contactId: contactId ?? null, kind: 'call', at: quand, note: t('phases.agenda.relance'),
        })
        montrer(t('fiche.toast.planifiee'))
      }
    } catch { montrer(t('board.card.actionFailed', { message: t('board.card.unknownError') })) }
  }
  const actionFaite = async () => {
    if (!nextAction?.reminderId) return
    try { await terminer.mutateAsync(nextAction.reminderId); montrer(t('fiche.toast.fait')) } catch {
      montrer(t('board.card.actionFailed', { message: t('board.card.unknownError') }))
    }
  }
  const ecrire = () => {
    const email = contact?.email?.trim()
    if (!email) return
    if (boites.list.length === 0) { window.location.href = `mailto:${email}`; return }
    const requete = `ecrire=${encodeURIComponent(email)}&j=${Date.now().toString(36)}`
    navigate(`/dashboard/messagerie?${requete}`)
  }

  /* ─── L'échéance de la prochaine action ─────────────────────────────────── */
  const echeance = nextAction ? echeanceDe(nextAction.dueAt) : null
  const tonAction = !nextAction ? ton('aPlanifier', sp) : echeance === 'retard' ? ton('retard', sp) : ton('aujourdhui', sp)
  const heure = (iso: string) => { const d = new Date(iso); return `${d.getHours()}h${d.getMinutes() ? String(d.getMinutes()).padStart(2, '0') : ''}` }
  const quandAction = !nextAction ? null
    : `${echeance === 'retard' ? t('board.card.overdue') : echeance === 'aujourdhui' ? t('board.card.today')
      : echeance === 'demain' ? t('board.card.tomorrow') : jourCourt(nextAction.dueAt, langue)}, ${heure(nextAction.dueAt)}`

  /* ─── L'historique : les faits de la base, ceux de l'écran, les offres ──── */
  const libelleStade = (s: unknown, repli: unknown) => typeof s === 'string'
    ? t(`phases.stades.${s}`, { defaultValue: s })
    : typeof repli === 'string' ? t(`stages.${repli}`, { defaultValue: repli }) : ''
  // ⚠ En production, un changement d'étape s'écrit DEUX fois : par la base (`stage_change`) et par
  // l'écran (`Étape changée`). Le second n'est gardé que si la base n'a rien écrit à la même seconde
  // près (10 s) — le banc, qui n'a pas de trigger, ne garde donc que lui.
  const doublonDeLaBase = (iso: string) => faits.some((f) => f.action === 'stage_change'
    && Math.abs(new Date(f.created_at).getTime() - new Date(iso).getTime()) < 10_000)
  type Entree = { quand: string; icone: MEIconName; texte: string }
  const historique: Entree[] = [
    { quand: deal.created_at, icone: 'plus', texte: t('deal.timeline_created') } as Entree,
    ...faits.flatMap((f): Entree[] => {
      const m = f.metadata ?? {}
      if (f.action === 'stage_change' || (f.action === 'Étape changée' && !doublonDeLaBase(f.created_at))) {
        return [{ quand: f.created_at, icone: 'arrow-right' as MEIconName, texte: t('fiche.hist.etape', {
          de: libelleStade(m.old_stage, m.from), a: libelleStade(m.new_stage, m.to),
        }) }]
      }
      if (f.action === ACTION_CLOTURE) {
        return [{ quand: f.created_at, icone: 'check-circle' as MEIconName, texte: t('cloture.hist') }]
      }
      if (f.action === 'status_change') {
        const s = m.new_status
        const texte = s === 'completed' ? t('fiche.hist.conclue') : s === 'active' ? t('fiche.hist.rouverte')
          : s === 'on_hold' ? t('fiche.hist.enAttente') : null
        return texte ? [{ quand: f.created_at, icone: 'check-circle' as MEIconName, texte }] : []
      }
      return []
    }),
    ...chaine.map((o): Entree => ({
      quand: o.created_at, icone: 'banknote',
      texte: `${o.kind === 'counter' ? t('deal.offer_row.counter') : t('deal.offer_row.offer')} · ${crmFmtCHF(o.amount)}`,
    })),
  ].sort((a, b) => b.quand.localeCompare(a.quand)).slice(0, 8)
  const ilYA = (iso: string) => {
    const j = -joursJusqua(iso)
    return j <= 0 ? t('board.card.today') : j === 1 ? t('phases.agenda.hier') : t('phases.agenda.ilYA', { count: j })
  }

  /* ─── Le contenu propre à la phase ─────────────────────────────────────── */
  const ecart = (montant: number) => {
    if (!prixDemande) return null
    const p = ((montant - prixDemande) / prixDemande) * 100
    return `${p > 0 ? '+' : '−'}${Math.abs(p).toFixed(1).replace('.', /^(de|en)/.test(langue) ? '.' : ',')} %`
  }
  /* ─── Une affaire conclue : son récapitulatif, et où en est sa clôture ──── */
  const dateConclusion = conclue
    ? faits.filter((f) => f.action === 'status_change' && (f.metadata as { new_status?: string } | null)?.new_status === 'completed')
      .map((f) => f.created_at).sort().at(-1) ?? deal.updated_at
    : null
  const prixFinal = deal.price_final ?? chaine.find((o) => o.status === 'accepted')?.amount ?? deal.price_offered ?? null
  const location = bien?.transaction_type === 'rent'
  // Le taux du mandat, 3 % à défaut — la règle d'`analytics_objectif`, pour que l'objectif et la fiche disent pareil.
  const pct = bien?.mandate_commission_pct ?? 3
  // ⛔ Une donnée par case, sans sous-ligne (Julien, « règle numéro 1 ») : le prix demandé se lit déjà
  // dans « Bien », la date d'ouverture dans l'historique, le taux dans « estimée ».
  type Chiffre = { cle: string; libelle: string; valeur: string }
  const chiffres: Chiffre[] = !conclue ? [] : [
    prixFinal ? { cle: 'prix', libelle: location ? t('cloture.recap.loyerFinal') : t('cloture.recap.prixFinal'), valeur: loyerOuPrix(prixFinal) } : null,
    prixFinal && prixDemande ? { cle: 'ecart', libelle: t('cloture.recap.ecart'), valeur: ecart(prixFinal) ?? '—' } : null,
    dateConclusion ? {
      cle: 'cycle', libelle: t('cloture.recap.cycle'),
      valeur: t('cloture.recap.jours', { count: Math.max(0, Math.round((new Date(dateConclusion).getTime() - new Date(deal.created_at).getTime()) / 86_400_000)) }),
    } : null,
    // Une location ne se commissionne pas au pourcentage du loyer : la case n'y aurait rien de vrai à dire.
    prixFinal && !location ? { cle: 'commission', libelle: t('cloture.recap.commission'), valeur: crmFmtCHF(Math.round((prixFinal * pct) / 100)) } : null,
  ].filter((c): c is Chiffre => !!c)

  // « Clôture à terminer » : seulement dans les 30 jours qui suivent la conclusion, et s'il reste
  // quelque chose. Enregistrée, elle ne se dit plus : l'historique en garde la trace.
  const resteACloturer = !!etatCloture && !etatCloture.enregistree && (
    (!!etatCloture.bien && etatCloture.bien.statut !== 'sold' && etatCloture.bien.statut !== 'archived')
    || etatCloture.recherches.length > 0 || etatCloture.suiveurs.length > 0 || etatCloture.relances.length > 0)
  const bandeauCloture = conclue && resteACloturer && !!dateConclusion && -joursJusqua(dateConclusion) <= 30

  /* ─── L'après-vente : trois rappels, la prochaine étape se coche ────────── */
  const dateCourte = (iso: string) => {
    const d = new Date(iso)
    const jj = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
    return d.getFullYear() === new Date().getFullYear() ? jj : `${jj}.${d.getFullYear()}`
  }
  const apresVente = etatCloture?.apresVente ?? []
  const prochaineEtape = apresVente.find((e) => !e.fait)
  const planifierApresVente = async () => {
    try {
      await planifierApres.mutateAsync({
        dealId: deal.id, contactId: etatCloture?.contactId ?? contactId ?? null,
        etapes: ETAPES_APRES_VENTE.map((e) => ({ jours: e.jours, kind: e.kind, at: dateEtape(new Date(), e.jours), note: t(`apresVente.etapes.${e.cle}`) })),
      })
      montrer(t('apresVente.toast'))
    } catch { montrer(t('board.card.actionFailed', { message: t('board.card.unknownError') })) }
  }
  const etapeFaite = async (id: string) => {
    try {
      await terminer.mutateAsync(id)
      await queryClient.invalidateQueries({ queryKey: ['cloture-affaire'] })
    } catch { montrer(t('board.card.actionFailed', { message: t('board.card.unknownError') })) }
  }

  const phaseContenu = (() => {
    // Conclue sans offre : une section « Négociation » vide ne dirait rien que le récapitulatif ne dise.
    if (conclue && chaine.length === 0) return null
    if (conclue || perdue || idPhase === 'offre' || idPhase === 'signature' || chaine.length > 0) {
      return (
        <Section sp={sp} premiere={chiffres.length === 0} titre={idPhase === 'signature' && !conclue ? t('fiche.jusquaSignature') : t('deal.negotiation')}
          droite={prixDemande ? <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>{t('deal.asking_price')} {crmFmtCHF(prixDemande)}</span> : undefined}>
          {idPhase === 'signature' && !conclue && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[
                { cle: 'kyc', fait: kyc?.dossier_status === 'verified', texte: t('fiche.kycClient') },
                ...phase('signature').stades.map((s, i) => ({
                  cle: s, fait: phase('signature').stades.indexOf(stade) > i, courant: s === stade,
                  texte: t(`phases.stades.${s}`), stade: s,
                })),
              ].map((etape, i) => (
                <button key={etape.cle} type="button"
                  onClick={() => { if ('stade' in etape && etape.stade && etape.stade !== stade) poser(etape.stade) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', textAlign: 'left',
                    padding: 'var(--crm-space-md) 0', border: 0, background: 'transparent', fontFamily: 'inherit',
                    cursor: 'stade' in etape ? 'pointer' : 'default',
                    borderTop: i === 0 ? 'none' : `1px solid ${sp.cardBorder}`,
                  }}>
                  {(() => {
                    const courant = 'courant' in etape && etape.courant
                    const encre = etape.fait ? ton('conclu', sp).encre : courant ? ton('aujourdhui', sp).encre : sp.sub
                    return (
                      <>
                        <MEIcon name={etape.fait ? 'check-circle' : courant ? 'arrow-right' : 'clock'} size={15} color={encre} />
                        <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: etape.fait || courant ? 600 : 500, color: courant ? encre : etape.fait ? sp.ink : sp.sub }}>{etape.texte}</span>
                      </>
                    )
                  })()}
                </button>
              ))}
            </div>
          )}
          {chaine.length === 0 ? (
            idPhase !== 'signature' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 'var(--crm-text-md)', color: sp.sub }}>{t('deal.no_offer_hint')}</span>
                {!conclue && !perdue && <Pilule sp={sp} plein onClick={() => setOffre('offer')}>{t('deal.record_offer')}</Pilule>}
              </div>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {chaine.map((o, i) => {
                const courant = o.id === dernier?.id && o.status === 'pending'
                const restant = courant && o.expires_at ? Math.max(0, joursJusqua(o.expires_at)) : null
                const statut = o.status === 'pending'
                  ? (restant !== null ? t('fiche.joursRestants', { count: restant }) : t('deal.offer_status.pending'))
                  : t(`deal.offer_status.${o.status}`)
                return (
                  <div key={o.id} style={{
                    display: 'grid', gridTemplateColumns: '52px minmax(0, 1fr) auto minmax(120px, auto)', alignItems: 'center',
                    gap: 'var(--crm-space-md)', padding: 'var(--crm-space-md)',
                    borderTop: i === 0 ? 'none' : `1px solid ${sp.cardBorder}`,
                    background: courant ? ton('aujourdhui', sp).fond : 'transparent', borderRadius: courant ? 'var(--crm-radius-md)' : 0,
                  }}>
                    <span style={{ fontSize: 'var(--crm-text-sm)', color: courant ? ton('aujourdhui', sp).encre : sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                      {new Date(o.created_at).toLocaleDateString(langue, { day: '2-digit', month: '2-digit' })}
                    </span>
                    <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: courant ? 600 : 500, color: sp.ink, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {o.kind === 'counter' ? t('deal.offer_row.counter') : t('deal.offer_row.offer')}
                      {o.conditions?.financing?.active ? ` · ${t('deal.cond.financing', { days: o.conditions.financing.days })}` : ''}
                    </span>
                    <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>{loyerOuPrix(o.amount)}</span>
                    <span style={{ fontSize: 'var(--crm-text-sm)', textAlign: 'right', color: courant ? ton('aujourdhui', sp).encre : o.status === 'accepted' ? ton('conclu', sp).encre : sp.sub, whiteSpace: 'nowrap' }}>
                      {[ecart(o.amount), statut].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                )
              })}
              {dernier?.status === 'pending' && !conclue && !perdue && (
                <div style={{ display: 'flex', gap: 'var(--crm-space-md)', paddingTop: 'var(--crm-space-md)' }}>
                  <Pilule sp={sp} plein onClick={() => repondre(dernier, 'accepted')}>{t('deal.accept_offer')}</Pilule>
                  <Pilule sp={sp} onClick={() => setOffre('counter')}>{t('deal.counter_offer')}</Pilule>
                  <Pilule sp={sp} onClick={() => repondre(dernier, 'rejected')}>{t('deal.reject')}</Pilule>
                </div>
              )}
              {dernier?.status === 'rejected' && !conclue && !perdue && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', paddingTop: 'var(--crm-space-md)' }}>
                  <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>{t('deal.rejected_note')}</span>
                  <div style={{ display: 'flex', gap: 'var(--crm-space-md)' }}>
                    <Pilule sp={sp} plein onClick={() => setOffre('counter')}>{t('deal.relaunch_offer')}</Pilule>
                    <Pilule sp={sp} ton={ton('retard', sp)} onClick={() => setPerdu(true)}>{t('deal.mark_lost')}</Pilule>
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>
      )
    }
    if (idPhase === 'visites') {
      return (
        <Section sp={sp} premiere titre={t('fiche.visites')}>
          {visites.length === 0
            ? <span style={{ fontSize: 'var(--crm-text-md)', color: sp.sub }}>{t('fiche.aucuneVisite')}</span>
            : visites.map((v, i) => (
              <div key={v.id} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-md) 0',
                borderTop: i === 0 ? 'none' : `1px solid ${sp.cardBorder}`,
              }}>
                <MEIcon name="home" size={15} color={sp.sub} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink }}>{v.bien ?? '—'}</span>
                <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>{jourCourt(v.scheduled_at, langue)}, {heure(v.scheduled_at)}</span>
              </div>
            ))}
          <Lien sp={sp} onClick={() => navigate('/dashboard/visits/new')}>{t('fiche.planifierVisite')}</Lien>
        </Section>
      )
    }
    return (
      <Section sp={sp} premiere titre={t('deal.matches_title')}
        droite={<span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>{t('deal.matches_count', { count: matchs.length })}</span>}>
        {matchs.length === 0
          ? <span style={{ fontSize: 'var(--crm-text-md)', color: sp.sub }}>{t('deal.no_matches')}</span>
          : matchs.map((m, i) => (
            <button key={m.id} type="button"
              onClick={() => { if (m.bien.interne && m.bien.id) navigate(`/dashboard/listings/${m.bien.id}`) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-md) 0', textAlign: 'left',
                border: 0, background: 'transparent', fontFamily: 'inherit', cursor: m.bien.interne ? 'pointer' : 'default',
                borderTop: i === 0 ? 'none' : `1px solid ${sp.cardBorder}`,
              }}>
              <span style={{
                minWidth: 40, textAlign: 'center', padding: 'var(--crm-space-2xs) var(--crm-space-xs)', borderRadius: 'var(--crm-radius-pill)',
                background: i === 0 ? ton('aujourdhui', sp).fond : crmVoileEncre(dark, dark ? 0.06 : 0.05),
                color: i === 0 ? ton('aujourdhui', sp).encre : sp.ink, fontSize: 'var(--crm-text-xs)', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
              }}>{m.score} %</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.bien.titre}</span>
              {m.bien.prix ? <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>{crmFmtCHF(m.bien.prix)}</span> : null}
            </button>
          ))}
        <Lien sp={sp} onClick={() => navigate(`/dashboard/matching${contactId ? `?contact=${contactId}` : ''}`)}>{t('fiche.ouvrirMatching')}</Lien>
      </Section>
    )
  })()

  function loyerOuPrix(montant: number): string {
    return bien?.transaction_type === 'rent' ? `${crmFmtCHF(montant)} ${t('phases.parMois')}` : crmFmtCHF(montant)
  }

  const kycEtat = kyc?.dossier_status === 'verified' ? { texte: t('fiche.kycEtat.verified'), t: ton('conclu', sp), icone: 'check-circle' as MEIconName }
    : kyc && kyc.dossier_status !== 'none' ? { texte: t('fiche.kycEtat.pending'), t: ton('aujourdhui', sp), icone: 'clock' as MEIconName }
      // « Recommandé avant la signature » n'a plus de sens une fois la signature passée.
      : rang >= 3 && !conclue ? { texte: t('deal.kyc_banner_title'), t: ton('aPlanifier', sp), icone: 'shield' as MEIconName }
        : { texte: t('fiche.kycEtat.none'), t: null, icone: 'shield' as MEIconName }
  const criteres = contact?.search_criteria as { budget_max?: number; rooms_min?: number; zones?: string[]; transaction_type?: string } | null | undefined

  return cadre(
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* ── L'affaire : qui, quoi, où elle en est ─────────────────────────── */}
      <div style={{ padding: 'var(--crm-space-4xl) var(--crm-space-7xl) var(--crm-space-2xl)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)' }}>
          <button type="button" onClick={() => navigate('/dashboard/pipeline')} title={t('title')} style={{
            width: 32, height: 32, borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${sp.cardBorder}`,
            background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0,
          }}><MEIcon name="arrow-left" size={14} color={sp.ink} /></button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 'var(--crm-text-4xl)', fontWeight: 600, letterSpacing: -0.4, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {nom}{bien ? <span style={{ color: sp.sub, fontWeight: 500 }}> × {bien.title}</span> : null}
            </h1>
          </div>
          {contact?.phone && (
            <a href={buildWaMeUrl(contact.phone)} target="_blank" rel="noreferrer" title="WhatsApp" style={{
              height: 32, padding: '0 var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${sp.cardBorder}`,
              display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', textDecoration: 'none',
              fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink,
            }}><MEIcon name="message" size={13} color={sp.ink} />{t('deal.message')}</a>
          )}
          {contact?.email && <Pilule sp={sp} onClick={ecrire}><MEIcon name="mail" size={13} color={sp.ink} />{t('deal.email')}</Pilule>}
        </div>

        {/* Les cinq phases, RÉGLABLES : un clic pose le premier stade de la phase. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr)) auto', gap: 'var(--crm-space-xs)', alignItems: 'end' }}>
            {PHASES.map((p, i) => {
              const etat = conclue ? 'fait' : perdue ? 'perdu' : i < rang ? 'fait' : i === rang ? 'courant' : 'avenir'
              // La teinte de la phase, celle du kanban : pleine pour la phase en cours, adoucie pour les
              // phases passées ; les phases à venir restent au filet. Conclue, tout passe au vert.
              const trait = etat === 'courant' ? p.teinte : etat === 'fait' ? (conclue ? ton('conclu', sp).encre : crmMix(p.teinte, sp.cardBg, 0.55))
                : etat === 'perdu' ? ton('retard', sp).filet : sp.cardBorder
              return (
                <button key={p.id} type="button" disabled={conclue || perdue}
                  onClick={() => { if (i !== rang) poser(stadeDEntree(p.id)) }}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xs)', textAlign: 'left', padding: 0,
                    border: 0, background: 'transparent', fontFamily: 'inherit', cursor: conclue || perdue || i === rang ? 'default' : 'pointer', minWidth: 0,
                  }}>
                  <span style={{ height: 4, borderRadius: 'var(--crm-radius-pill)', background: trait }} />
                  <span style={{
                    fontSize: 'var(--crm-text-sm)', fontWeight: etat === 'courant' ? 600 : 500,
                    color: etat === 'avenir' ? sp.sub : sp.ink,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {etat === 'fait' ? '✓ ' : ''}{t(`phases.noms.${p.id}`)}
                    {etat === 'courant' && p.stades.length > 1 && t(`phases.stades.${stade}`) !== t(`phases.noms.${p.id}`)
                      ? ` · ${t(`phases.stades.${stade}`)}` : ''}
                  </span>
                </button>
              )
            })}
            <div style={{ display: 'flex', gap: 'var(--crm-space-xs)', paddingLeft: 'var(--crm-space-lg)' }}>
              {conclue || perdue ? (
                <>
                  <span style={{ alignSelf: 'center', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: conclue ? ton('conclu', sp).encre : ton('retard', sp).encre }}>
                    {conclue ? t('fiche.conclue') : t('fiche.perdue')}
                  </span>
                  <Pilule sp={sp} onClick={() => void rouvrir()}>{t('fiche.rouvrir')}</Pilule>
                </>
              ) : (
                <>
                  <Pilule sp={sp} ton={ton('conclu', sp)} onClick={() => void conclure()}>{t('phases.conclu')}</Pilule>
                  <Pilule sp={sp} onClick={() => setPerdu(true)}>{t('phases.perdu')}</Pilule>
                </>
              )}
            </div>
          </div>
          {idPhase && phase(idPhase).stades.length > 1 && !conclue && !perdue && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xs)', flexWrap: 'wrap' }}>
              {phase(idPhase).stades.map((s) => (
                <button key={s} type="button" onClick={() => { if (s !== stade) poser(s) }} style={{
                  height: 28, padding: '0 var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: s === stade ? 600 : 500,
                  background: s === stade ? crmMix(phase(idPhase).teinte, sp.cardBg, sp.isDark ? 0.8 : 0.86) : 'transparent',
                  color: s === stade ? sp.ink : sp.sub,
                  border: `1px solid ${s === stade ? phase(idPhase).teinte : sp.cardBorder}`,
                }}>{t(`phases.stades.${s}`)}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── La prochaine action : datée, et on peut la faire, la déplacer, la poser ── */}
      {!conclue && !perdue && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', flexShrink: 0, position: 'relative',
          padding: 'var(--crm-space-lg) var(--crm-space-7xl)', borderTop: `1px solid ${sp.cardBorder}`,
          background: crmMix(tonAction.encre, sp.cardBg, sp.isDark ? 0.9 : 0.94),
        }}>
          <MEIcon name={nextAction ? iconeAction(nextAction.kind) : 'calendar'} size={16} color={tonAction.encre} />
          <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-md)', color: sp.ink }}>
            <span style={{ color: sp.sub }}>{t('deal.next_action')} · </span>
            {nextAction ? (
              <>
                <span style={{ fontWeight: 600 }}>{nextAction.note || t(`timeline.kind.${nextAction.kind}`, { defaultValue: t('timeline.kind.fallback') })}</span>
                <span style={{ fontWeight: 600, color: tonAction.encre }}> · {quandAction}</span>
              </>
            ) : <span style={{ fontWeight: 600, color: tonAction.encre }}>{t('fiche.aucuneAction')}</span>}
          </div>
          {nextAction && <Pilule sp={sp} onClick={() => void actionFaite()}><MEIcon name="check" size={12} color={sp.ink} />{t('fiche.fait')}</Pilule>}
          <div ref={joursRef} style={{ position: 'relative' }}>
            <Pilule sp={sp} plein={!nextAction} onClick={() => setJours((o) => !o)}>
              <MEIcon name="calendar" size={12} color={nextAction ? sp.ink : sp.accentInk} />
              {nextAction ? t('fiche.replanifier') : t('fiche.planifier')}
            </Pilule>
            {jours && (
              <div role="menu" style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 30, minWidth: 160,
                display: 'flex', flexDirection: 'column', padding: 'var(--crm-space-2xs)',
                background: sp.solidBg, border: `1px solid ${sp.solidBorder}`, borderRadius: 'var(--crm-radius-lg)', boxShadow: sp.solidShadow,
              }}>
                {/* Un jour ne se propose qu'une fois (un dimanche, « Lundi » EST « Demain »), et sans sa date
                    en regard : le nom suffit (Julien, 27.09.2026, « règle numéro 1 »). */}
                {CHOIX_JOURS.filter((c, i, tous) => tous.findIndex((x) => x.jours() === c.jours()) === i).map((c) => (
                  <button key={c.cle} type="button" role="menuitem" onClick={() => void choisirJour(c.jours())} style={{
                    textAlign: 'left', border: 0, cursor: 'pointer', fontFamily: 'inherit', background: 'transparent',
                    padding: 'var(--crm-space-md) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-md)',
                    fontSize: 'var(--crm-text-md)', color: sp.ink,
                  }}>{t(`fiche.quand.${c.cle}`)}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Une affaire conclue dont la clôture reste à terminer ── */}
      {bandeauCloture && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', flexShrink: 0,
          padding: 'var(--crm-space-lg) var(--crm-space-7xl)', borderTop: `1px solid ${sp.cardBorder}`,
          background: crmMix(ton('aPlanifier', sp).encre, sp.cardBg, sp.isDark ? 0.9 : 0.94),
        }}>
          <MEIcon name="clock" size={16} color={ton('aPlanifier', sp).encre} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: ton('aPlanifier', sp).encre }}>
            {t('cloture.bandeau.aTerminer')}
          </span>
          <Pilule sp={sp} plein onClick={() => setClotureOuverte(true)}>{t('cloture.bandeau.terminer')}</Pilule>
        </div>
      )}

      {/* ── Deux colonnes, UNE feuille : un filet vertical, pas un espace ──────── */}
      <div style={{
        flex: '1 0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, 1fr)',
        borderTop: `1px solid ${sp.cardBorder}`,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: `1px solid ${sp.cardBorder}`, minWidth: 0 }}>
          {chiffres.length > 0 && (
            <Section sp={sp} premiere>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${chiffres.length}, minmax(0, 1fr))`, gap: 'var(--crm-space-2xl)' }}>
                {chiffres.map((c) => (
                  <div key={c.cle} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)', minWidth: 0 }}>
                    <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>{c.libelle}</span>
                    <span style={{
                      fontSize: 'var(--crm-text-4xl)', fontWeight: 600, letterSpacing: -0.3, color: sp.ink, fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{c.valeur}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
          {conclue && etatCloture && (
            <Section sp={sp} premiere={chiffres.length === 0} titre={t('apresVente.titre')}>
              {apresVente.length === 0
                ? <Lien sp={sp} onClick={() => void planifierApresVente()}>{t('apresVente.planifier')}</Lien>
                : apresVente.map((e, i) => {
                  const prochaine = e.id === prochaineEtape?.id
                  return (
                    <div key={e.id} style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', height: 40,
                      borderTop: i === 0 ? 'none' : `1px solid ${sp.cardBorder}`,
                    }}>
                      <MEIcon name={e.fait ? 'check-circle' : 'clock'} size={15}
                        color={e.fait ? ton('conclu', sp).encre : prochaine ? ton('aujourdhui', sp).encre : sp.sub} />
                      <span style={{ minWidth: 72, fontSize: 'var(--crm-text-sm)', color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>{dateCourte(e.le)}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-md)', fontWeight: e.fait ? 500 : 600, color: e.fait ? sp.sub : sp.ink }}>
                        {e.etape ? t(`apresVente.etapes.${e.etape}`) : e.note}
                      </span>
                      {prochaine && <Pilule sp={sp} onClick={() => void etapeFaite(e.id)}><MEIcon name="check" size={12} color={sp.ink} />{t('fiche.fait')}</Pilule>}
                    </div>
                  )
                })}
            </Section>
          )}
          {phaseContenu}
          <Section sp={sp} titre={t('fiche.historique')} etire>
            {historique.map((h, i) => (
              <div key={`${h.quand}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', fontSize: 'var(--crm-text-sm)' }}>
                <MEIcon name={h.icone} size={13} color={sp.sub} />
                <span style={{ color: sp.sub, minWidth: 92, flexShrink: 0 }}>{ilYA(h.quand)}</span>
                <span style={{ color: sp.ink, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.texte}</span>
              </div>
            ))}
          </Section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Section sp={sp} premiere titre={vendeurSeul ? t('contacts:contactType.seller') : t('fiche.client')}>
            <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink }}>{nom}</span>
            <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub, lineHeight: 1.6 }}>
              {[contact?.phone, contact?.email, contact?.language ? t(`deal.lang.${contact.language}`, { defaultValue: contact.language }) : null]
                .filter(Boolean).map((l) => <span key={String(l)} style={{ display: 'block' }}>{l}</span>)}
            </span>
            {contact && <Lien sp={sp} onClick={() => navigate(`/dashboard/contacts/${contact.id}`)}>{t('deal.open_contact')}</Lien>}
          </Section>
          <Section sp={sp} titre={t('common:nav.kyc')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: kycEtat.t ? kycEtat.t.encre : sp.sub }}>
              <MEIcon name={kycEtat.icone} size={14} color={kycEtat.t ? kycEtat.t.encre : sp.sub} />{kycEtat.texte}
            </span>
            {contact && kyc?.dossier_status !== 'verified' && (
              <Lien sp={sp} onClick={() => navigate(`/dashboard/kyc?openContactId=${contact.id}`)}>{t('deal.open_kyc_dossier')}</Lien>
            )}
          </Section>
          <Section sp={sp} titre={bien ? t('fiche.bien') : t('fiche.criteres')} etire>
            {bien ? (
              <>
                <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink }}>{bien.title}</span>
                <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub, lineHeight: 1.6 }}>
                  {t('deal.property_line', { addr: bien.address ?? bien.city ?? '', area: bien.surface_m2 ?? 0, rooms: bien.rooms ?? 0 })}
                  {prixDemande ? <span style={{ display: 'block' }}>{t('deal.asking_price')} {loyerOuPrix(prixDemande)}</span> : null}
                </span>
                <Lien sp={sp} onClick={() => navigate(`/dashboard/listings/${bien.id}`)}>{t('fiche.ouvrirBien')}</Lien>
              </>
            ) : (
              <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub, lineHeight: 1.6 }}>
                {[
                  criteres?.transaction_type === 'rent' ? t('deal.crit.rent') : criteres?.transaction_type ? t('deal.crit.buy') : null,
                  criteres?.zones?.filter((z) => z.length > 2).slice(0, 3).join(', '),
                  criteres?.budget_max ? t('deal.crit.budget_max', { amount: `CHF ${montantCourt(criteres.budget_max, langue)}` }) : null,
                  criteres?.rooms_min ? t('deal.crit.rooms_min', { count: criteres.rooms_min }) : null,
                ].filter(Boolean).join(' · ') || '—'}
              </span>
            )}
          </Section>
        </div>
      </div>

      {offre && (
        <OfferModal
          dealId={deal.id} kind={offre} parentOffer={offre === 'counter' ? dernier ?? null : null}
          contained dark={dark}
          onSubmit={() => { rafraichir(); montrer(offre === 'counter' ? t('deal.toast.counter_sent') : t('deal.toast.offer_sent')) }}
          onClose={() => setOffre(null)}
        />
      )}
      {clotureOuverte && (
        <ClotureAffaire
          sp={sp} dealId={deal.id} cadre={pager}
          nom={nom}
          onFermer={() => { setClotureOuverte(false); rafraichir() }}
          onEnregistree={() => montrer(t('cloture.toast'))}
        />
      )}
      {perdu && (
        <LostConfirmModal sp={sp} dark={dark} contactName={nom} cadre={pager}
          onCancel={() => setPerdu(false)}
          onConfirm={() => { setPerdu(false); poser('lost', t('board.toast.lost')) }}
        />
      )}
    </div>,
  )
}
