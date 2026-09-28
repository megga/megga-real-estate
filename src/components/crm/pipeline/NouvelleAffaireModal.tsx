/**
 * « Nouveau deal », refait — refonte du 27.09.2026 (banc : le bouton et les « Plus d'options » du
 * « Pipeline » l'ouvrent ; la modale d'avant reste celle de « Pipeline · ancien »).
 *
 * ⛔ UN PARCOURS, PAS TROIS COLONNES. L'ancienne modale posait trois décisions côte à côte — le
 * contact, le bien, l'étape parmi HUIT pilules — plus une valeur, et un bouton désactivé qui ne
 * disait pas ce qui manquait. Ici, dans l'ordre où l'agent pense : QUI, puis quel BIEN (facultatif),
 * puis OÙ en est l'affaire (les cinq phases) et son MONTANT — et, en pied, qui × quoi va être
 * créé. Une feuille découpée par des filets, comme la fiche d'affaire.
 *
 * ⚠ LES BIENS NE SE LISTENT QU'UNE FOIS LE CLIENT CHOISI : ils se classent alors sur SA recherche
 * (`proximite`), et la liste des clients, repliée en une ligne, leur laisse la place. Avant, le
 * champ de recherche suffit — sans quoi la modale vide dépassait l'écran et cachait la phase.
 *
 * ⚠ LE MOTEUR NE CHANGE PAS : `useCreateContact` → `useCreateTransaction` → « Premier suivi » à J+2.
 * Un contact créé ici est un ACHETEUR, comme dans la modale d'avant (décision du handoff v2).
 *
 * ⚠ Un loyer reste un loyer : la valeur reprend le loyer MENSUEL du bien, comme la carte l'affiche
 * (« /mois ») — l'ancienne modale le multipliait par douze, et la carte le relisait comme une vente.
 *
 * ⚠ LA CRÉATION SE VOIT (27.09.2026). La modale disparaissait d'un coup et la carte surgissait sans
 * mouvement : rien ne reliait le geste à son résultat. Le bouton dit « Créé », la feuille se retire,
 * la carte ATTERRIT dans sa colonne. Pour que seule elle s'anime, l'identifiant du deal est choisi
 * ICI, avant l'écriture (`onNaissance`) : la carte se sait nouvelle dès son montage, et attend,
 * invisible sous le voile, que la feuille s'en aille.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { encreSur } from '@/components/megga-x-crm/tokens'
import { useAuth } from '@/hooks/useAuth'
import { useContactsScreen } from '@/hooks/useContactsScreen'
import { useListingsScreen } from '@/hooks/useListingsScreen'
import { useCreateContact } from '@/hooks/useContacts'
import { useCreateTransaction } from '@/hooks/useTransactions'
import { usePipelineReminderCreators } from '@/hooks/usePipelineNextActions'
import { useEcranActif } from '@/hooks/useEcranActif'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { stageIdToTransactionStage } from '@/lib/crmAdapters'
import { COUNTRY_DIAL_CODES, composePhone, dialCodeOptions } from '@/lib/countries'
import type { TransactionStage } from '@/lib/constants'
import { crmMix, crmVoileAssombrissant, crmVoileEncre, type CrmPalette, type StageId } from '../tokens'
import type { CrmBien, CrmContact } from '../mockData'
import { PHASES, loyerCourt, phase, phaseDe, stadeDEntree, type PhaseId } from './phases'
import { ton } from './tons'

/** Préremplissage depuis la création en ligne d'une colonne (« Plus d'options »). */
export interface NewDealPrefill {
  stage?: StageId
  contactId?: string | null
  contactQuery?: string
  value?: number | null
}

interface Props {
  open: boolean
  onClose: () => void
  sp: CrmPalette
  dark: boolean
  prefill: NewDealPrefill | null
  /** Le deal est créé et la feuille se retire : le parent le dit (et propose de le ranger s'il est une erreur). */
  onCreated: (txId: string) => void
  /** L'identifiant du deal qu'on va écrire, AVANT l'écriture — `null` si elle échoue. */
  onNaissance?: (txId: string | null) => void
  /** Le cadre de la page — le « pager » — où monter la modale ; sans lui, plein écran. */
  cadre?: HTMLElement | null
}

/** Clients proposés avant toute saisie : assez pour choisir, pas assez pour pousser la phase hors écran. */
const CLIENTS_VUS = 4
const BIENS_VUS = 3
/** « Créé » reste lisible sur le bouton, puis la feuille se retire. */
const TENUE_MS = 280
const SORTIE_MS = 160

/** Le titre d'un bloc de la feuille, et sa précision éventuelle. */
function Titre({ sp, titre, note }: { sp: CrmPalette; titre: string; note?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-md)' }}>
      <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }}>{titre}</span>
      {note && <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>{note}</span>}
    </div>
  )
}

/** Une section de la feuille : un filet en haut, jamais une carte. */
function Section({ sp, children, grille }: { sp: CrmPalette; children: ReactNode; grille?: string }) {
  return (
    <section style={{
      display: grille ? 'grid' : 'flex', flexDirection: 'column', gridTemplateColumns: grille,
      gap: grille ? 'var(--crm-space-4xl)' : 'var(--crm-space-md)',
      padding: 'var(--crm-space-2xl) var(--crm-space-4xl)', borderTop: `1px solid ${sp.cardBorder}`,
    }}>
      {children}
    </section>
  )
}

/** Une ligne choisissable (contact, bien) : même hauteur, même survol, même état choisi. */
function Ligne({ sp, onClick, gauche, titre, sous, droite, choisie }: {
  sp: CrmPalette; onClick: () => void; gauche: ReactNode; titre: string; sous?: string; droite?: ReactNode; choisie?: boolean
}) {
  const [survol, setSurvol] = useState(false)
  const accent = ton('aujourdhui', sp)
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setSurvol(true)} onMouseLeave={() => setSurvol(false)} style={{
      display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', width: '100%', textAlign: 'left',
      padding: 'var(--crm-space-md)', borderRadius: 'var(--crm-radius-lg)', cursor: 'pointer', fontFamily: 'inherit',
      border: `1px solid ${choisie ? accent.filet : 'transparent'}`,
      background: choisie ? accent.fond : survol ? sp.focusSurface : 'transparent',
    }}>
      {gauche}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titre}</span>
        {sous && <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sous}</span>}
      </span>
      {droite}
    </button>
  )
}

/** Un champ de saisie de la feuille : un filet, jamais un aplat gris. */
function Champ({ sp, valeur, onChange, placeholder, prefixe, suffixe, type, autoFocus, entree, refChamp, onFocus }: {
  sp: CrmPalette; valeur: string; onChange: (v: string) => void; placeholder: string
  prefixe?: ReactNode; suffixe?: string; type?: string; autoFocus?: boolean; entree?: () => void
  refChamp?: RefObject<HTMLInputElement | null>; onFocus?: () => void
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', height: 40, padding: '0 var(--crm-space-lg)',
      borderRadius: 'var(--crm-radius-lg)', border: `1px solid ${sp.cardBorder}`, background: sp.cardBg, minWidth: 0,
    }}>
      {prefixe}
      <input
        ref={refChamp} value={valeur} type={type ?? 'text'} autoFocus={autoFocus} placeholder={placeholder}
        aria-label={placeholder} onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && entree) { e.preventDefault(); entree() } }}
        style={{
          flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit',
          fontSize: 'var(--crm-text-md)', color: sp.ink, fontVariantNumeric: 'tabular-nums',
        }}
      />
      {suffixe && <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub, flexShrink: 0 }}>{suffixe}</span>}
    </label>
  )
}

/** Proximité grossière d'un bien avec la recherche d'un client — pour ORDONNER, jamais pour noter. */
function proximite(b: CrmBien, c: CrmContact | null): number {
  const k = c?.criteria
  if (!k) return 0
  const prix = (b.transaction === 'location' ? b.rent : b.price) ?? 0
  return (k.transaction === b.transaction ? 2 : 0)
    + (k.cantons?.includes(b.canton) ? 2 : 0)
    + (k.types?.includes(b.type) ? 1 : 0)
    + (k.budgetMax && prix && prix <= k.budgetMax ? 2 : 0)
    + (k.roomsMin && b.rooms >= k.roomsMin ? 1 : 0)
}

export function NouvelleAffaireModal({ open, onClose, sp, dark, prefill, onCreated, onNaissance, cadre }: Props) {
  const { t, i18n } = useTranslation('pipeline')
  const { profile } = useAuth()
  const { contacts } = useContactsScreen()
  const { biens } = useListingsScreen()
  const actifs = useMemo(() => biens.filter((b) => b.status === 'active'), [biens])
  // Un client se lit à son NOM seul — l'e-mail sous chaque ligne chargeait la liste. Il ne revient
  // que pour départager deux homonymes : choisir le mauvais rattacherait le deal au mauvais client.
  const homonymes = useMemo(() => {
    const vus = new Map<string, number>()
    for (const c of contacts) {
      const nom = `${c.firstName} ${c.lastName}`.trim().toLowerCase()
      vus.set(nom, (vus.get(nom) ?? 0) + 1)
    }
    return new Set([...vus].filter(([, n]) => n > 1).map(([nom]) => nom))
  }, [contacts])
  const precision = (c: CrmContact) =>
    homonymes.has(`${c.firstName} ${c.lastName}`.trim().toLowerCase()) ? c.email || c.phone || undefined : undefined
  const createContact = useCreateContact()
  const createTransaction = useCreateTransaction()
  const { createFirstFollowUp } = usePipelineReminderCreators()

  const [requeteClient, setRequeteClient] = useState('')
  const [clientId, setClientId] = useState<string | null>(null)
  // ⚠ Le téléphone en DEUX temps, comme « Nouveau contact » et l'onboarding : l'indicatif se CHOISIT
  // (Suisse par défaut, c'est le marché), le reste se tape, et `composePhone` rend le format international
  // qu'attend la passerelle WhatsApp — sans le 0 de tête, et jamais « +41 » tout seul.
  const [nouveau, setNouveau] = useState<{ prenom: string; nom: string; pays: string; tel: string; email: string } | null>(null)
  const optionsIndicatif = useMemo(() => dialCodeOptions(i18n.language), [i18n.language])
  const [requeteBien, setRequeteBien] = useState('')
  const [chercheBien, setChercheBien] = useState(false)
  const [bienId, setBienId] = useState<string | null>(null)
  const [stade, setStade] = useState<TransactionStage>('new_lead')
  const [montant, setMontant] = useState('')
  const [montantTouche, setMontantTouche] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [aide, setAide] = useState(false)
  const champClient = useRef<HTMLInputElement>(null)
  const champBien = useRef<HTMLInputElement>(null)
  const boutonCreer = useRef<HTMLButtonElement>(null)
  // La fin : « Créé » sur le bouton, puis la sortie. Le verrou est une ref, pas un état : un Échap
  // ou un second ⌘↵ tapé dans la même image ne doit pas relancer la sortie ni l'écriture.
  const [cree, setCree] = useState(false)
  const [sortie, setSortie] = useState(false)
  // Le bouton garde sa largeur de « Créer le deal » : « Création… » et « Créé » le faisaient rétrécir.
  const [largeurBouton, setLargeurBouton] = useState<number | null>(null)
  const verrou = useRef(false)
  const minuteries = useRef<number[]>([])
  useEffect(() => () => { minuteries.current.forEach(clearTimeout) }, [])
  const plusTard = (f: () => void, ms: number) => { minuteries.current.push(window.setTimeout(f, ms)) }
  const reduit = useReducedMotion()

  // Ouverture : tout repart de zéro, ou de ce que la carte fantôme avait déjà saisi.
  useEffect(() => {
    if (!open) return
    setRequeteClient(prefill?.contactQuery ?? ''); setClientId(prefill?.contactId ?? null); setNouveau(null)
    setRequeteBien(''); setChercheBien(false); setBienId(null)
    setStade(prefill?.stage ? stageIdToTransactionStage(prefill.stage) : 'new_lead')
    setMontant(prefill?.value ? String(prefill.value) : ''); setMontantTouche(!!prefill?.value)
    setEnCours(false); setErreur(null); setAide(false)
    setCree(false); setSortie(false); setLargeurBouton(null); verrou.current = false
  }, [open, prefill])

  const partir = () => {
    setSortie(true)
    plusTard(onClose, reduit ? 0 : SORTIE_MS)
  }
  /** Toute fermeture passe par la sortie — Annuler, la croix, Échap, le voile. */
  const fermer = () => {
    if (verrou.current) return
    verrou.current = true
    partir()
  }

  const client = clientId ? contacts.find((c) => c.id === clientId) ?? null : null
  const bien = bienId ? actifs.find((b) => b.id === bienId) ?? null : null
  const location = bien?.transaction === 'location'

  // Le montant suit le bien tant que l'agent ne l'a pas écrit lui-même.
  useEffect(() => {
    if (montantTouche) return
    const prix = bien ? (bien.transaction === 'location' ? bien.rent : bien.price) : null
    setMontant(prix ? String(prix) : '')
  }, [bien, montantTouche])

  const q = requeteClient.trim().toLowerCase()
  const clients = contacts
    .filter((c) => !q || `${c.firstName} ${c.lastName} ${c.email} ${c.phone}`.toLowerCase().includes(q))
    .slice(0, CLIENTS_VUS)
  const qb = requeteBien.trim().toLowerCase()
  const biensVus = (qb
    ? actifs.filter((b) => `${b.title} ${b.ref} ${b.addr} ${b.city ?? ''}`.toLowerCase().includes(qb))
    : [...actifs].sort((a, b) => proximite(b, client) - proximite(a, client))
  ).slice(0, BIENS_VUS)
  const montrerBiens = !!client || !!nouveau || chercheBien || !!qb

  const idPhase: PhaseId = phaseDe(stade) ?? 'prospects'
  const laPhase = phase(idPhase)
  const nomClient = client ? `${client.firstName} ${client.lastName}` : nouveau ? `${nouveau.prenom} ${nouveau.nom}`.trim() : ''
  const pret = !!client || !!(nouveau && nouveau.prenom.trim() && nouveau.nom.trim())

  const choisirClient = (id: string) => {
    setClientId(id); setAide(false)
    // Le clavier continue là où l'agent pense : le bien, puis le geste.
    requestAnimationFrame(() => champBien.current?.focus())
  }
  const choisirBien = (id: string) => {
    setBienId(id)
    requestAnimationFrame(() => boutonCreer.current?.focus())
  }

  const creer = async () => {
    if (enCours || verrou.current) return
    if (!pret) { setAide(true); champClient.current?.focus(); return }
    const agence = profile?.agency_id
    if (!agence) { setErreur(t('modal.error.noAgency')); return }
    setLargeurBouton(boutonCreer.current?.offsetWidth ?? null)
    setEnCours(true); setErreur(null)
    const txId = crypto.randomUUID()
    onNaissance?.(txId)
    try {
      let cid = clientId
      if (!cid && nouveau) {
        const ligne = await createContact.mutateAsync({
          firstName: nouveau.prenom.trim(), lastName: nouveau.nom.trim(),
          email: nouveau.email.trim(), phone: composePhone(nouveau.pays, nouveau.tel) || undefined,
          type: 'buyer', source: 'manual', agency_id: agence,
        })
        cid = ligne.id
      }
      await createTransaction.mutateAsync({
        id: txId,
        agency_id: agence,
        contact_buyer_id: cid ?? undefined,
        property_id: bienId ?? undefined,
        stage: stade,
        price_offered: Number(montant) || undefined,
      })
      // Le deal naît avec une échéance réelle — la carte l'affiche dès son apparition. ⚠ Son échec
      // ne retient PAS la modale : le deal existe déjà, et « Créer » une seconde fois le doublerait.
      // La carte dira « À planifier ».
      await createFirstFollowUp({ transactionId: txId, contactId: cid ?? null }).catch(() => undefined)
      verrou.current = true
      setCree(true)
      plusTard(() => { onCreated(txId); partir() }, TENUE_MS)
    } catch (e) {
      onNaissance?.(null)
      setLargeurBouton(null)
      setErreur(e instanceof Error ? e.message : t('modal.error.unknown'))
    } finally {
      setEnCours(false)
    }
  }

  // Échap ferme et Tab reste dans la modale : le piège de `MailModalShell`, qui garde l'`autoFocus`
  // du champ Client et rend le focus au bouton à la fermeture. ⌘↵ (Ctrl+↵) crée d'où que soit le
  // curseur ; son gestionnaire lit la DERNIÈRE version de `creer`, sinon l'état de l'ouverture.
  const piege = useFocusTrap(open, fermer)
  const creerRef = useRef(creer)
  useEffect(() => { creerRef.current = creer })
  const ecranActif = useEcranActif()
  useEffect(() => {
    if (!open || !ecranActif) return
    const clavier = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void creerRef.current() }
    }
    document.addEventListener('keydown', clavier)
    return () => document.removeEventListener('keydown', clavier)
  }, [open, ecranActif])

  if (!open) return null

  const avatar = (c: CrmContact) => (
    <span style={{
      width: 28, height: 28, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0, display: 'grid', placeItems: 'center',
      background: c.avatarBg || sp.ink, color: encreSur(c.avatarBg || sp.ink), fontSize: 'var(--crm-text-xs)', fontWeight: 600,
    }}>{`${c.firstName[0] ?? ''}${c.lastName[0] ?? ''}`.toUpperCase()}</span>
  )
  const vignette = (b: CrmBien) => (
    <span style={{
      width: 36, height: 28, borderRadius: 'var(--crm-radius-md)', flexShrink: 0, overflow: 'hidden',
      background: crmVoileEncre(dark, dark ? 0.06 : 0.05), display: 'grid', placeItems: 'center',
    }}>
      {b.coverPhoto
        ? <img src={b.coverPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <MEIcon name="building" size={15} color={sp.sub} />}
    </span>
  )
  const lien = (libelle: string, onClick: () => void) => (
    <button type="button" onClick={onClick} style={{
      border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
      fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: ton('aujourdhui', sp).encre, flexShrink: 0,
    }}>{libelle}</button>
  )

  // Le reçu du pied : qui × quoi. Le stade et le montant se lisent déjà au-dessus — les y répéter
  // chargeait le pied sans rien apprendre.
  const recuHaut = !nomClient ? null : bien ? `${nomClient} × ${bien.title}` : `${nomClient} · ${t('nouvelle.sansBien')}`

  return createPortal(
    // ⚠ LE VOILE ÉPOUSE LE PAGER, PAS L'ÉCRAN (Julien, 27.09.2026 — la règle de la Messagerie et de
    // « Planifier une visite ») : monté DANS le cadre, en `absolute` et à son rayon, il laisse nettes
    // la barre latérale et la bande d'onglets, et suit le cadre quand le dock s'ouvre. Mêmes
    // réglages que `MailModalShell` : voile 0,4, flou 6 px. Sans cadre, il retombe sur l'écran.
    <div onClick={fermer} style={{
      position: cadre ? 'absolute' : 'fixed', inset: 0, zIndex: cadre ? 130 : 140, borderRadius: cadre ? 'inherit' : undefined,
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 'var(--crm-space-7xl)',
      background: crmVoileAssombrissant(0.4), backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      // La sortie défait l'entrée : le voile s'éteint, la feuille remonte d'un cran en s'effaçant.
      animation: sortie ? `crm-fondu-sortie ${SORTIE_MS}ms ease-in both` : 'sgSignVeil .15s ease-out',
      pointerEvents: sortie ? 'none' : undefined,
    }}>
      {/* ⚠ ANCRÉE EN HAUT, JAMAIS CENTRÉE : sa hauteur change à chaque choix (liste repliée, biens
          proposés), et centrée elle sautait sous le curseur — l'en-tête bougeait de 120 px. */}
      <div ref={piege} role="dialog" aria-modal="true" aria-label={t('new_deal')} onClick={(e) => e.stopPropagation()} style={{
        width: 600, maxWidth: '100%', maxHeight: '100%',
        display: 'flex', flexDirection: 'column',
        background: sp.solidBg, border: `1px solid ${sp.solidBorder}`, borderRadius: 'var(--crm-radius-6xl)',
        boxShadow: sp.solidShadow, overflow: 'hidden', color: sp.ink,
        fontFamily: 'var(--crm-font, "Inter Tight"), system-ui, sans-serif',
        animation: sortie ? `crm-feuille-sortie ${SORTIE_MS}ms ease-in both` : 'crm-fade-up .3s cubic-bezier(.2,.8,.2,1) both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: 'var(--crm-space-2xl) var(--crm-space-4xl)', flexShrink: 0 }}>
          <span style={{ flex: 1, fontSize: 'var(--crm-text-3xl)', fontWeight: 600, letterSpacing: -0.4 }}>{t('new_deal')}</span>
          <button type="button" onClick={fermer} title={t('modal.close')} aria-label={t('modal.close')} style={{
            width: 32, height: 32, borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${sp.cardBorder}`,
            background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center',
          }}><MEIcon name="close" size={13} color={sp.ink} /></button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {/* ── 1. Qui ── */}
          <Section sp={sp}>
            <Titre sp={sp} titre={t('fiche.client')} />
            {client ? (
              <Ligne sp={sp} choisie onClick={() => setClientId(null)} gauche={avatar(client)}
                titre={`${client.firstName} ${client.lastName}`} sous={precision(client)}
                droite={<span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: ton('aujourdhui', sp).encre }}>{t('nouvelle.changer')}</span>} />
            ) : nouveau ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-md)' }}>
                <Champ sp={sp} valeur={nouveau.prenom} onChange={(v) => { setNouveau({ ...nouveau, prenom: v }); setAide(false) }} placeholder={t('modal.firstName')} autoFocus />
                <Champ sp={sp} valeur={nouveau.nom} onChange={(v) => { setNouveau({ ...nouveau, nom: v }); setAide(false) }} placeholder={t('modal.lastName')} />
                <Champ sp={sp} valeur={nouveau.tel} onChange={(v) => setNouveau({ ...nouveau, tel: v })} placeholder={t('modal.phone')} type="tel"
                  prefixe={
                    // L'indicatif affiché, et sous lui la liste native des pays (par NOM) : compact au repos,
                    // complet quand on l'ouvre.
                    <span style={{
                      position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', flexShrink: 0,
                      paddingRight: 'var(--crm-space-md)', borderRight: `1px solid ${sp.cardBorder}`,
                      fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, fontVariantNumeric: 'tabular-nums',
                    }}>
                      +{COUNTRY_DIAL_CODES[nouveau.pays] ?? '41'}
                      <MEIcon name="chevron-down" size={10} color={sp.sub} />
                      <select value={nouveau.pays} aria-label={t('modal.indicatif')}
                        onChange={(e) => setNouveau({ ...nouveau, pays: e.target.value })}
                        style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer' }}>
                        {optionsIndicatif.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
                      </select>
                    </span>
                  } />
                <Champ sp={sp} valeur={nouveau.email} onChange={(v) => setNouveau({ ...nouveau, email: v })} placeholder={t('modal.email')} type="email" />
                <div style={{ gridColumn: 'span 2' }}>{lien(t('inline.changeContact'), () => setNouveau(null))}</div>
              </div>
            ) : (
              <>
                <Champ sp={sp} refChamp={champClient} valeur={requeteClient} autoFocus
                  onChange={(v) => { setRequeteClient(v); setAide(false) }}
                  placeholder={t('modal.searchContact')}
                  prefixe={<MEIcon name="search" size={14} color={sp.sub} />}
                  entree={() => { if (clients[0]) choisirClient(clients[0].id) }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {clients.map((c) => (
                    <Ligne key={c.id} sp={sp} onClick={() => choisirClient(c.id)} gauche={avatar(c)}
                      titre={`${c.firstName} ${c.lastName}`} sous={precision(c)} />
                  ))}
                  <Ligne sp={sp}
                    onClick={() => {
                      const [prenom = '', ...reste] = requeteClient.trim().split(/\s+/)
                      setNouveau({ prenom, nom: reste.join(' '), pays: 'CH', tel: '', email: '' })
                    }}
                    gauche={<span style={{ width: 28, height: 28, borderRadius: 'var(--crm-radius-pill)', display: 'grid', placeItems: 'center', border: `1px dashed ${sp.cardBorder}`, flexShrink: 0 }}>
                      <MEIcon name="plus" size={13} color={sp.ink} />
                    </span>}
                    titre={requeteClient.trim() ? t('modal.createNamed', { name: requeteClient.trim() }) : t('modal.createContact')} />
                </div>
              </>
            )}
            {aide && <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: ton('aPlanifier', sp).encre }}>{t('nouvelle.choisirClient')}</span>}
          </Section>

          {/* ── 2. Quel bien ── */}
          <Section sp={sp}>
            <Titre sp={sp} titre={t('fiche.bien')} note={t('nouvelle.facultatif')} />
            {bien ? (
              <Ligne sp={sp} choisie onClick={() => setBienId(null)} gauche={vignette(bien)} titre={bien.title}
                droite={<span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: ton('aujourdhui', sp).encre }}>{t('modal.removeBien')}</span>} />
            ) : (
              <>
                <Champ sp={sp} refChamp={champBien} valeur={requeteBien} onChange={setRequeteBien} placeholder={t('modal.searchBien')}
                  onFocus={() => setChercheBien(true)}
                  prefixe={<MEIcon name="search" size={14} color={sp.sub} />}
                  entree={() => { if (biensVus[0]) choisirBien(biensVus[0].id) }} />
                {montrerBiens && (
                  <>
                    {!qb && (
                      <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
                        {client?.criteria ? t('nouvelle.suggeres') : t('nouvelle.actifs')}
                      </span>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {biensVus.length === 0
                        ? <span style={{ fontSize: 'var(--crm-text-md)', color: sp.sub, padding: 'var(--crm-space-md)' }}>{actifs.length === 0 ? t('modal.noActiveBiens') : t('modal.noBienFound')}</span>
                        : biensVus.map((b) => (
                          <Ligne key={b.id} sp={sp} onClick={() => choisirBien(b.id)} gauche={vignette(b)} titre={b.title}
 />
                        ))}
                    </div>
                  </>
                )}
              </>
            )}
          </Section>

          {/* ── 3. Où en est l'affaire, et combien ── */}
          <Section sp={sp} grille="minmax(0, 1fr) 176px">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', minWidth: 0 }}>
              <Titre sp={sp} titre={t('nouvelle.etape')} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 'var(--crm-space-xs)' }}>
                {/* ⛔ LES COULEURS DU KANBAN (Julien, 27.09.2026 : « ce n'est pas la même que dans le kanban »).
                    Chaque phase garde SA teinte — pleine choisie, adoucie sinon — et la même phase se
                    reconnaît d'un écran à l'autre. Le libellé reste en encre : ces teintes ne tiennent
                    pas le contraste d'un texte. */}
                {PHASES.map((p) => {
                  const actif = p.id === idPhase
                  return (
                    <button key={p.id} type="button" aria-pressed={actif} onClick={() => setStade(stadeDEntree(p.id))} style={{
                      display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xs)', padding: 0, border: 0, textAlign: 'left',
                      background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', minWidth: 0,
                    }}>
                      <span style={{ height: 4, borderRadius: 'var(--crm-radius-pill)', background: actif ? p.teinte : crmMix(p.teinte, sp.solidBg, 0.7) }} />
                      <span style={{
                        fontSize: 'var(--crm-text-sm)', fontWeight: actif ? 600 : 500,
                        color: actif ? sp.ink : sp.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{t(`phases.noms.${p.id}`)}</span>
                    </button>
                  )
                })}
              </div>
              {laPhase.stades.length > 1 && (
                <div style={{ display: 'flex', gap: 'var(--crm-space-xs)', flexWrap: 'wrap' }}>
                  {laPhase.stades.map((s) => (
                    <button key={s} type="button" aria-pressed={s === stade} onClick={() => setStade(s)} style={{
                      height: 28, padding: '0 var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: s === stade ? 600 : 500,
                      background: s === stade ? crmMix(laPhase.teinte, sp.solidBg, sp.isDark ? 0.8 : 0.86) : 'transparent',
                      color: s === stade ? sp.ink : sp.sub,
                      border: `1px solid ${s === stade ? laPhase.teinte : sp.cardBorder}`,
                    }}>{t(`phases.stades.${s}`)}</button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', minWidth: 0 }}>
              <Titre sp={sp} titre={t('nouvelle.montant')} />
              <Champ sp={sp} valeur={montant ? loyerCourt(Number(montant)) : ''} placeholder="0"
                onChange={(v) => { setMontant(v.replace(/[^\d]/g, '')); setMontantTouche(true) }}
                prefixe={<span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub }}>CHF</span>}
                suffixe={location ? t('phases.parMois') : undefined} />
              {bien && !montantTouche && (
                <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>{location ? t('nouvelle.loyerDuBien') : t('nouvelle.prixDuBien')}</span>
              )}
            </div>
          </Section>
        </div>

        {/* ── Le reçu, et le geste ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', flexShrink: 0,
          padding: 'var(--crm-space-2xl) var(--crm-space-4xl)', borderTop: `1px solid ${sp.cardBorder}`,
        }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
            {erreur
              ? <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: ton('retard', sp).encre }}>{erreur}</span>
              : <span style={{
                fontSize: 'var(--crm-text-md)', fontWeight: 600, color: recuHaut ? sp.ink : sp.sub,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{recuHaut ?? t('nouvelle.aucunClient')}</span>}
          </div>
          <button type="button" onClick={fermer} style={{
            height: 40, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', cursor: 'pointer',
            border: `1px solid ${sp.cardBorder}`, background: 'transparent', color: sp.ink,
            fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
          }}>{t('modal.cancel')}</button>
          <button ref={boutonCreer} type="button" onClick={() => void creer()} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-xs)',
            width: largeurBouton ?? undefined, height: 40, padding: '0 var(--crm-space-4xl)',
            borderRadius: 'var(--crm-radius-pill)', cursor: 'pointer', border: 0,
            background: sp.accent, color: sp.accentInk, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
            opacity: enCours ? 0.7 : 1, transition: 'opacity .15s',
          }}>
            {cree ? (
              <>
                <span style={{ display: 'inline-flex', animation: 'sgSealIn .2s ease-out both' }}>
                  <MEIcon name="check" size={13} color={sp.accentInk} />
                </span>
                {t('nouvelle.cree')}
              </>
            ) : enCours ? t('modal.creating') : t('modal.create')}
          </button>
        </div>
      </div>
    </div>,
    cadre ?? document.body,
  )
}
