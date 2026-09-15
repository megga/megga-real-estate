/**
 * Données du banc `/dev/messagerie` : trois états — « boîte pleine », « boîte
 * vide », « aucune boîte » — servis SANS base de données.
 *
 * ⛔ POURQUOI CE FICHIER EXISTE, ET CE QU'IL RÉPARE. Jusqu'ici le banc montait
 * l'écran RÉEL sans session : `useMailAccounts` est `enabled: !!user`, une
 * requête désactivée reste `isPending` pour toujours en TanStack v5, et
 * `MessagerieApp` rend `null` tant que `accounts.isLoading`. Le banc affichait
 * donc un panneau central VIDE — trois états, trois fois rien. Les captures des
 * tâches 2.4 à 2.11 venaient d'une sonde jetable, recréée puis annulée à chaque
 * fois. C'est ce trou-là que ce fichier ferme : après lui, un humain voit
 * l'écran sans base.
 *
 * ⛔ Rien n'y ressemble à une vraie fiche : adresses en `@exemple.ch`, raisons
 * sociales en « Exemple ». Une donnée d'exemple qui a l'air vraie finit citée
 * comme vraie.
 *
 * ⚠ VOCABULAIRE TRANSPOSÉ (maître §1) : contact, notaire, banque, agence. La
 * maquette d'origine est un ERP dentaire — patient, labo, assurance, cabinet.
 * Un mot du dentaire ici et il se recopierait dans l'i18n au premier
 * copier-coller.
 *
 * ⚠ LES DATES SONT RELATIVES À `MAINTENANT`, pas des littéraux comme les
 * écrivait le plan. `mailDateLabel` compare au jour civil suisse : des dates
 * fixes auraient affiché « 08:29 » le jour de leur écriture, « Hier » le
 * lendemain, puis « 03.09 », puis « 03.09.26 » au changement d'année — l'écran
 * changeait tout seul, et la capture de régression visuelle avec lui. C'est
 * exactement le motif pour lequel `/dashboard` a été retiré du jeu de captures.
 * Le banc reste donc lisible dans le temps, et la capture est rendue
 * déterministe par une horloge figée côté Playwright.
 *
 * ⚠ Le fichier est un `.ts` : il ne porte plus de JSX depuis que le fournisseur
 * de contexte a laissé la place au `Provider` du contexte lui-même, monté par la
 * page de banc. `react-refresh/only-export-components` est une ERREUR dans ce
 * dépôt et un `.tsx` qui exporte à la fois un composant et huit constantes la
 * déclenche.
 */
import { createContext, useContext } from 'react'
import { MXC_COLOR, MXC_SYSTEM } from '@/components/megga-x-crm/tokens'
import type { ImapDetection, ImapForm, MailAccount } from '@/hooks/useMailAccounts'
import type { MailInvokeResult } from '@/lib/mail/invoke'
import type { MailLabel } from '@/hooks/useMailLabels'
import type { MailFolderCounts, MailThreadRow } from '@/hooks/useMailThreads'
import type { MailMessageRow } from '@/hooks/useMailThread'
import type { MailFolder } from './mailState'

export type MailFixtureState = 'full' | 'empty' | 'none'

/**
 * L'état du banc, lu par les cinq hooks de lecture.
 *
 * `null` = pas de banc, donc les hooks parlent au réseau. C'est la valeur en
 * production : seuls des bancs de développement montent un `Provider` —
 * `/dev/messagerie`, la vue mobile de `/dev/mobile`, et `/dev/crm` en « Nominal »
 * (la Messagerie DANS la coquille, avec sa bande d'onglets).
 */
export const MailFixturesContext = createContext<MailFixtureState | null>(null)

/** L'état du banc pour un hook de lecture, `null` hors du banc. */
export function useMailFixtures(): MailFixtureState | null {
  return useContext(MailFixturesContext)
}

const AG = 'fx-agency'
const OWNER = 'fx-u1'

/** Horloge du jeu : figée à l'évaluation du module, donc stable pour un rendu. */
const MAINTENANT = Date.now()
const ilYA = (jours: number, heures: number, minutes: number) =>
  new Date(MAINTENANT - jours * 86_400_000 - heures * 3_600_000 - minutes * 60_000).toISOString()

const FX_ACCOUNTS: MailAccount[] = [
  { id: 'fx-a1', agency_id: AG, owner_id: OWNER, provider: 'gmail', email: 'contact@agence-exemple.ch', display_name: 'Boîte générale', visibility: 'agency', status: 'active', last_sync_at: ilYA(0, 0, 4), last_error: null, created_at: ilYA(35, 0, 0) },
  { id: 'fx-a2', agency_id: AG, owner_id: OWNER, provider: 'outlook', email: 'facturation@agence-exemple.ch', display_name: 'Facturation', visibility: 'agency', status: 'active', last_sync_at: ilYA(0, 0, 11), last_error: null, created_at: ilYA(35, 0, 0) },
  // La troisième boîte porte le statut d'échec : sans elle, le banc ne montrerait
  // jamais la pastille « Autorisation à renouveler », qui est pourtant le seul
  // endroit où l'agent apprend qu'une boîte a cessé de se synchroniser.
  { id: 'fx-a3', agency_id: AG, owner_id: OWNER, provider: 'imap', email: 'j.exemple@agence-exemple.ch', display_name: 'J. Exemple · personnelle', visibility: 'owner', status: 'reauth_required', last_sync_at: null, last_error: 'invalid_grant', created_at: ilYA(35, 0, 0) },
]

/**
 * Les boîtes déconnectées au banc, le temps de la page — un rechargement les rend.
 *
 * ⚠ Sans elles, « Déconnecter » y confirmait un geste que l'écran démentait : la
 * notification disait la boîte déconnectée, et le sélecteur la montrait encore.
 */
const deconnectees = new Set<string>()

/** Déconnecte une boîte du banc (le `mail-oauth disconnect` des fixtures). */
export function fxDeconnecter(accountId: string): void {
  deconnectees.add(accountId)
}

/** Les boîtes ajoutées au banc par l'assistant, le temps de la page. */
const ajoutees: MailAccount[] = []

/** Les boîtes du banc encore connectées. */
export function fxBoites(): MailAccount[] {
  return [...FX_ACCOUNTS, ...ajoutees].filter((a) => !deconnectees.has(a.id))
}

/** Le temps d'un aller-retour : sans lui, le banc ne montrerait jamais « Recherche… » ni « Test des serveurs… ». */
const latence = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Le `mail-oauth imap_detect` du banc. ⚠ Aucun vrai fournisseur : les domaines en
 * `exemple.ch` sont reconnus chez un « Hébergeur Exemple » (`webmail-exemple.ch` chez un
 * « Webmail Exemple » dont l'IMAP est à activer, comme GMX), les adresses Google et
 * Microsoft sont renvoyées vers leur connexion — les réponses que l'écran sait montrer.
 */
export async function fxDetecterImap(email: string): Promise<MailInvokeResult<ImapDetection>> {
  await latence(250)
  const domaine = email.split('@')[1] ?? ''
  const data: ImapDetection = domaine === 'webmail-exemple.ch'
    ? { oauth: null, preset: { nom: 'Webmail Exemple', imapHost: 'imap.webmail-exemple.ch', imapPort: 993, smtpHost: 'smtp.webmail-exemple.ch', smtpPort: 465, motDePasseApplication: false, activerImap: true } }
    : domaine.endsWith('exemple.ch')
      ? { oauth: null, preset: { nom: 'Hébergeur Exemple', imapHost: 'imap.hebergeur-exemple.ch', imapPort: 993, smtpHost: 'smtp.hebergeur-exemple.ch', smtpPort: 465, motDePasseApplication: false } }
      : domaine === 'gmail.com'
        ? { oauth: 'gmail', preset: { nom: 'Google', imapHost: 'imap.gmail.com', imapPort: 993, smtpHost: 'smtp.gmail.com', smtpPort: 465, motDePasseApplication: true } }
        : domaine === 'outlook.com' ? { oauth: 'outlook', preset: null } : { oauth: null, preset: null }
  return { data, error: null, status: 200 }
}

/**
 * Le `mail-oauth connect_imap` du banc : le mot de passe « faux » est refusé par le serveur
 * IMAP, une adresse déjà connectée par Google ou Microsoft l'est aussi — le reste connecte.
 */
export async function fxConnecterImap(form: ImapForm): Promise<MailInvokeResult<{ account: MailAccount }>> {
  await latence(600)
  const email = form.email.trim().toLowerCase()
  const jumelle = fxBoites().find((a) => a.email === email && a.provider !== 'imap')
  if (jumelle) return { data: null, error: 'already_connected', detail: jumelle.provider, status: 409 }
  if (form.password === 'faux') return { data: null, error: 'connection_failed', detail: 'imap_auth', status: 502 }
  const account: MailAccount = {
    id: `fx-imap-${ajoutees.length + 1}`, agency_id: AG, owner_id: OWNER, provider: 'imap', email, display_name: null,
    visibility: form.visibility, status: 'active', last_sync_at: new Date().toISOString(), last_error: null, created_at: new Date().toISOString(),
  }
  ajoutees.push(account)
  return { data: { account }, error: null, status: 200 }
}

/** Les six libellés semés par le lot 1, transposés (maître §1). */
export const FX_LABELS: MailLabel[] = [
  { id: 'fx-l1', agency_id: AG, name: 'À traiter', color: '#fe566b', position: 0, is_default: true },
  { id: 'fx-l2', agency_id: AG, name: 'Banques', color: '#8dc1ff', position: 1, is_default: true },
  { id: 'fx-l3', agency_id: AG, name: 'Notaires', color: '#efc42c', position: 2, is_default: true },
  { id: 'fx-l4', agency_id: AG, name: 'Clients', color: '#adecbb', position: 3, is_default: true },
  { id: 'fx-l5', agency_id: AG, name: 'Visites', color: '#424bfb', position: 4, is_default: true },
  { id: 'fx-l6', agency_id: AG, name: 'Fournisseurs', color: '#686868', position: 5, is_default: true },
]

/** Correspondants du remplissage : quatre registres du métier, aucun du dentaire. */
const CORRESPONDANTS: { nom: string; email: string; objet: string; extrait: string }[] = [
  { nom: 'Étude Exemple', email: 'etude@notaire-exemple.ch', objet: "Projet d'acte · rue Fictive", extrait: "Le projet d'acte est prêt pour relecture." },
  { nom: 'Banque Exemple SA', email: 'credit@banque-exemple.ch', objet: 'Dossier de financement', extrait: "Le dossier est complet, il manque l'attestation." },
  { nom: 'Régie Exemple', email: 'gerance@regie-exemple.ch', objet: 'État des lieux · appartement témoin', extrait: "L'état des lieux est fixé, merci de confirmer." },
  { nom: 'Camille Exemple', email: 'camille@exemple.ch', objet: 'Demande de visite', extrait: 'Serait-il possible de visiter en fin de semaine ?' },
]

const T = (i: number, over: Partial<MailThreadRow> = {}): MailThreadRow => {
  const c = CORRESPONDANTS[i % CORRESPONDANTS.length]
  return {
    id: `fx-t${i}`,
    account_id: 'fx-a1',
    subject: `${c.objet} ${i}`,
    snippet: c.extrait,
    from_name: c.nom,
    from_email: c.email,
    participants: [{ name: c.nom, email: c.email }],
    last_message_at: ilYA(i, (i * 3) % 11, (i * 17) % 60),
    has_attachments: i % 4 === 0,
    is_read: i % 3 !== 0,
    is_starred: i % 7 === 0,
    // Six fils archivés : sans eux le dossier « Archivé » serait vide sur le
    // banc, et un dossier vide ne se distingue pas d'un dossier cassé.
    is_archived: i % 8 === 5,
    is_trashed: false,
    is_spam: false,
    label_id: FX_LABELS[i % FX_LABELS.length].id,
    contact_id: i % 2 === 0 ? 'fx-c1' : null,
    message_count: 1 + (i % 3),
    // Écrasé par `fxThreads`, qui connaît le total de la requête servie.
    total: 0,
    ...over,
  }
}

/**
 * 48 fils : quatre pages de douze, de quoi voir la pagination bouger — plus trois spams,
 * que seul le dossier « Spam » montre.
 *
 * Les trois premiers sont RÉDIGÉS (README §« Données ») — ce sont eux que la
 * capture montre en haut de liste, et un objet générique en tête de banc ne dit
 * rien de l'écran.
 */
export const FX_THREADS: MailThreadRow[] = [
  T(1, { subject: 'Visite de samedi · confirmation', snippet: 'Bonjour, je confirme la visite de samedi à 10h.', from_name: 'Zoé Exemple', from_email: 'zoe@exemple.ch', participants: [{ name: 'Zoé Exemple', email: 'zoe@exemple.ch' }], is_read: false, is_starred: false, has_attachments: false, label_id: 'fx-l4', contact_id: 'fx-c1', message_count: 1, last_message_at: ilYA(0, 1, 12) }),
  T(2, { subject: 'Attestation de financement', snippet: "Veuillez trouver ci-joint l'attestation.", from_name: 'Banque Exemple SA', from_email: 'credit@banque-exemple.ch', participants: [{ name: 'Banque Exemple SA', email: 'credit@banque-exemple.ch' }], is_read: true, is_starred: true, has_attachments: true, label_id: 'fx-l2', contact_id: null, message_count: 2, last_message_at: ilYA(1, 2, 0) }),
  T(3, { subject: "Projet d'acte · chemin Fictif 7", snippet: "Le projet d'acte est prêt pour relecture.", from_name: 'Étude Exemple', from_email: 'etude@notaire-exemple.ch', participants: [{ name: 'Étude Exemple', email: 'etude@notaire-exemple.ch' }], is_read: false, is_starred: false, has_attachments: true, label_id: 'fx-l3', contact_id: 'fx-c1', message_count: 1, last_message_at: ilYA(2, 4, 30) }),
  ...Array.from({ length: 45 }, (_, k) => T(k + 4)),
  // Sans eux, le dossier « Spam » serait vide au banc. Des expéditeurs qui n'existent pas,
  // comme le reste du jeu ; aucun n'est rattaché, aucun ne porte de libellé.
  ...([
    [49, 'Votre colis est en attente de livraison', 'Des frais restent à régler pour libérer votre colis.', 'Service Colis Exemple', 'avis@colis-exemple.com', false, ilYA(0, 3, 40)],
    [50, 'Vous avez été sélectionné', 'Réclamez votre récompense avant minuit.', 'Loterie Exemple', 'gains@loterie-exemple.com', true, ilYA(3, 5, 10)],
    [51, 'Doublez la visibilité de vos biens', 'Offre réservée aux agences, sans engagement.', 'Offre Exemple', 'promo@offre-exemple.com', true, ilYA(9, 2, 0)],
  ] as const).map(([i, subject, snippet, nom, email, lu, date]) => T(i, {
    subject, snippet, from_name: nom, from_email: email, participants: [{ name: nom, email }], is_read: lu, is_starred: false,
    is_archived: false, is_spam: true, has_attachments: false, label_id: null, contact_id: null, message_count: 1, last_message_at: date,
  })),
]

/** Les quatre messages RÉDIGÉS, ceux des trois fils de tête. */
const FX_MESSAGES_REDIGES: MailMessageRow[] = [
  {
    id: 'fx-m1', thread_id: 'fx-t1', direction: 'inbound', from_name: 'Zoé Exemple', from_email: 'zoe@exemple.ch',
    to: [{ name: null, email: 'contact@agence-exemple.ch' }], cc: [], subject: 'Visite de samedi · confirmation',
    snippet: 'Bonjour, je confirme la visite de samedi à 10h.',
    body_text: 'Bonjour,\n\nJe confirme la visite de samedi à 10h. Est-il possible de voir aussi la cave ?\n\nMerci, Zoé',
    body_html: null, body_truncated: false, sent_at: ilYA(0, 1, 12), is_read: false, has_attachments: false,
    contact_id: 'fx-c1', mail_attachments: [],
  },
  {
    id: 'fx-m2', thread_id: 'fx-t2', direction: 'inbound', from_name: 'Banque Exemple SA', from_email: 'credit@banque-exemple.ch',
    to: [{ name: null, email: 'contact@agence-exemple.ch' }], cc: [], subject: 'Attestation de financement',
    snippet: "Veuillez trouver ci-joint l'attestation.",
    body_text: "Bonjour,\n\nVeuillez trouver ci-joint l'attestation de financement de votre client.\n\nCordialement",
    body_html: "<p>Bonjour,</p><p>Veuillez trouver ci-joint l'attestation de financement de votre client.</p><p>Cordialement</p>",
    body_truncated: false, sent_at: ilYA(1, 3, 0), is_read: true, has_attachments: true, contact_id: null,
    mail_attachments: [{ id: 'fx-att1', message_id: 'fx-m2', filename: 'attestation-exemple.pdf', mime_type: 'application/pdf', size_bytes: 184_320, is_inline: false, content_id: null, document_id: null }],
  },
  {
    id: 'fx-m3', thread_id: 'fx-t2', direction: 'outbound', from_name: 'Boîte générale', from_email: 'contact@agence-exemple.ch',
    to: [{ name: 'Banque Exemple SA', email: 'credit@banque-exemple.ch' }], cc: [], subject: 'Re: Attestation de financement',
    snippet: 'Bien reçu, merci.', body_text: 'Bien reçu, merci.', body_html: null, body_truncated: false,
    sent_at: ilYA(1, 2, 0), is_read: true, has_attachments: false, contact_id: null, mail_attachments: [],
  },
  {
    id: 'fx-m4', thread_id: 'fx-t3', direction: 'inbound', from_name: 'Étude Exemple', from_email: 'etude@notaire-exemple.ch',
    to: [{ name: null, email: 'contact@agence-exemple.ch' }], cc: [], subject: "Projet d'acte · chemin Fictif 7",
    snippet: "Le projet d'acte est prêt pour relecture.",
    body_text: "Bonjour,\n\nLe projet d'acte est prêt pour relecture. Merci de nous retourner vos remarques avant la signature.\n\nBien à vous",
    body_html: null, body_truncated: false, sent_at: ilYA(2, 4, 30), is_read: false, has_attachments: true, contact_id: 'fx-c1',
    mail_attachments: [{ id: 'fx-att2', message_id: 'fx-m4', filename: 'projet-acte-exemple.pdf', mime_type: 'application/pdf', size_bytes: 512_000, is_inline: false, content_id: null, document_id: null }],
  },
]

/**
 * ⛔ CHAQUE FIL A SES MESSAGES, ET C'EST LE POINT LE PLUS IMPORTANT DE CE
 * FICHIER. Le plan n'en rédigeait que trois, pour 48 fils. Mesuré à l'écran le
 * 05.09.2026 : `MailReader` fait `if (!first) return null` — juste, en
 * production, où le cache d'un fil peut arriver vide le temps d'une
 * synchronisation. Sur le banc, ça donnait **44 clics sur 48 qui ouvraient un
 * panneau BLANC**. Un humain en aurait conclu que la lecture est cassée, et une
 * capture de régression aurait figé ce blanc comme la référence. Un banc qui ne
 * rend rien est pire que pas de banc.
 *
 * Les messages sont donc DÉRIVÉS des fils : même correspondant, même objet,
 * même date, et exactement `message_count` messages, alternés entrant/sortant
 * en partant de l'entrant. Les deux jeux ne peuvent plus diverger.
 */
function messagesDe(t: MailThreadRow): MailMessageRow[] {
  const boite = FX_ACCOUNTS[0].email
  const dedans = { name: t.from_name, email: t.from_email ?? '' }
  return Array.from({ length: t.message_count }, (_, k) => {
    const sortant = k % 2 === 1
    return {
      id: `fx-m-${t.id}-${k}`,
      thread_id: t.id,
      direction: sortant ? 'outbound' : 'inbound',
      from_name: sortant ? FX_ACCOUNTS[0].display_name : t.from_name,
      from_email: sortant ? boite : t.from_email,
      to: sortant ? [dedans] : [{ name: null, email: boite }],
      cc: [],
      subject: k === 0 ? t.subject : `Re: ${t.subject ?? ''}`,
      snippet: t.snippet,
      body_text: sortant
        ? `Bien reçu, merci.\n\nNous revenons vers vous rapidement.`
        : `Bonjour,\n\n${t.snippet ?? ''}\n\nBien à vous`,
      body_html: null,
      body_truncated: false,
      // Les messages précédents remontent le fil d'une heure chacun : la lecture
      // doit se dérouler du plus ancien au plus récent, pas s'empiler à la même
      // seconde.
      sent_at: new Date(new Date(t.last_message_at).getTime() - (t.message_count - 1 - k) * 3_600_000).toISOString(),
      is_read: t.is_read,
      has_attachments: k === 0 && t.has_attachments,
      contact_id: t.contact_id,
      mail_attachments: k === 0 && t.has_attachments
        ? [{ id: `fx-att-${t.id}`, message_id: `fx-m-${t.id}-0`, filename: 'piece-jointe-exemple.pdf', mime_type: 'application/pdf', size_bytes: 96_000 + (k + 1) * 4_096, is_inline: false, content_id: null, document_id: null }]
        : [],
    }
  })
}

const REDIGES = new Set(FX_MESSAGES_REDIGES.map((m) => m.thread_id))

/** Tous les messages du banc : les quatre rédigés, plus un jeu par fil restant. */
export const FX_MESSAGES: MailMessageRow[] = [
  ...FX_MESSAGES_REDIGES,
  ...FX_THREADS.filter((t) => !REDIGES.has(t.id)).flatMap(messagesDe),
]

/** Les fils qui ont au moins un message sortant — le prédicat réel du dossier « Envoyés ». */
const AVEC_SORTANT = new Set(FX_MESSAGES.filter((m) => m.direction === 'outbound').map((m) => m.thread_id))

/**
 * Les gestes faits au banc sur un fil — étoile, lu, archive, corbeille, libellé —, le
 * temps de la page : un rechargement les efface.
 *
 * ⛔ Sans eux, CHAQUE geste se défaisait sous les yeux : l'écran le montrait (mise à jour
 * optimiste), puis la liste se relisait dans des fixtures inchangées et le reprenait
 * (Julien, 14.09.2026 : « l'étoile ne reste pas, et c'est pareil pour les autres »). En
 * production c'est la base que la liste relit, et `mail-actions` l'a écrite.
 */
const gestes = new Map<string, Partial<MailThreadRow>>()

/** Répercute un geste sur un fil du banc (le `mail-actions` des fixtures). */
export function fxAgir(threadId: string, patch: Partial<MailThreadRow>): void {
  gestes.set(threadId, { ...gestes.get(threadId), ...patch })
}

/** Les fils du banc, gestes compris — la seule lecture que les hooks doivent faire. */
function fils(): MailThreadRow[] {
  return FX_THREADS.map((t) => {
    const g = gestes.get(t.id)
    return g ? { ...t, ...g } : t
  })
}

/** Un fil du banc par son identifiant, gestes compris — le lien d'un événement du Calendrier. */
export function fxFil(id: string): MailThreadRow | null {
  return fils().find((t) => t.id === id) ?? null
}

/**
 * Non-lus par boîte, tels que le rail les affiche.
 *
 * ⚠ DÉRIVÉ du jeu, jamais écrit à la main : une pastille qui annonce un compte
 * que la liste ne montre pas est le défaut exact que ce banc doit rendre
 * visible, pas reproduire. Et recalculé à chaque lecture : un fil ouvert est lu.
 */
export function fxNonLus(): Record<string, number> {
  return fils().reduce<Record<string, number>>((acc, t) => {
    if (!t.is_read && !t.is_archived && !t.is_trashed && !t.is_spam) acc[t.account_id] = (acc[t.account_id] ?? 0) + 1
    return acc
  }, {})
}

/**
 * Le dossier est une REQUÊTE, pas une colonne (maître D8) : le banc rejoue le
 * même prédicat que la RPC `mail_list_threads`, sinon les compteurs du rail
 * mentiraient sur la liste servie à côté.
 */
function filtreDossier(t: MailThreadRow, folder: MailFolder): boolean {
  // ⛔ Le spam n'apparaît QUE dans « Spam », comme dans la RPC.
  if (folder === 'spam') return t.is_spam && !t.is_trashed
  if (t.is_spam) return false
  switch (folder) {
    case 'in': return !t.is_archived && !t.is_trashed
    case 'arch': return t.is_archived && !t.is_trashed
    case 'star': return t.is_starred && !t.is_trashed
    // ⚠ « Envoyés » se lit sur les MESSAGES (`last_outbound_at is not null` dans
    // la RPC), pas sur `message_count` comme l'écrivait le plan : un fil de deux
    // messages entrants n'a jamais rien envoyé.
    case 'sent': return AVEC_SORTANT.has(t.id) && !t.is_trashed
    default: return false
  }
}

export interface FxThreadFilters { folder: MailFolder; labelId: string | null; q: string; unreadOnly: boolean; attOnly: boolean }

/** Une page de fils, filtres compris : le banc doit répondre à la barre d'outils. */
export function fxThreads(
  state: MailFixtureState,
  accountId: string | null,
  f: FxThreadFilters,
  page: number,
  perPage: number,
): { rows: MailThreadRow[]; total: number } {
  if (state !== 'full' || !accountId) return { rows: [], total: 0 }
  const q = f.q.trim().toLowerCase()
  const tous = fils().filter((t) =>
    t.account_id === accountId
    && filtreDossier(t, f.folder)
    && (!f.labelId || t.label_id === f.labelId)
    && (!f.unreadOnly || !t.is_read)
    && (!f.attOnly || t.has_attachments)
    && (!q || `${t.subject ?? ''} ${t.from_name ?? ''} ${t.from_email ?? ''}`.toLowerCase().includes(q)),
  // L'ordre de la RPC (`last_message_at desc, id desc`) : un fil rendu du spam reprend sa
  // place dans la Réception, pas la fin du jeu.
  ).sort((a, b) => b.last_message_at.localeCompare(a.last_message_at) || b.id.localeCompare(a.id))
  const total = tous.length
  return { rows: tous.slice(page * perPage, (page + 1) * perPage).map((r) => ({ ...r, total })), total }
}

// ─── Logos d'expéditeurs (14.09.2026) ──────────────────────────────────────────
/** Un logo tel que `mail_sender_logos` le range : son type, ses octets en base64, sa source. */
export interface FxSenderLogo { source: string; mime: string; data: string }

const marque = (fond: string, encre: string, forme: string) =>
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${fond}"/><g fill="${encre}">${forme}</g></svg>`)

/**
 * Trois marques FICTIVES pour les trois sociétés fictives du banc — des formes, aucun
 * logo existant (même règle que les raisons sociales en « Exemple »). Les particuliers
 * (`@exemple.ch`) n'en ont pas : le banc montre les deux visages de la pastille. Les
 * couleurs sont des barreaux de la direction, pas des hexadécimaux, et un aplat PÂLE
 * prend l'encre sombre (CLAUDE.md §3).
 */
export const FX_SENDER_LOGOS: Record<string, FxSenderLogo> = {
  'banque-exemple.ch': {
    source: 'bimi', mime: 'image/svg+xml',
    data: marque(MXC_COLOR.accent, MXC_COLOR.n1000, '<path d="M12 26 32 13l20 13z"/><rect x="16" y="29" width="6" height="16"/><rect x="29" y="29" width="6" height="16"/><rect x="42" y="29" width="6" height="16"/><rect x="12" y="48" width="40" height="4"/>'),
  },
  'notaire-exemple.ch': {
    source: 'apple-touch-icon', mime: 'image/svg+xml',
    data: marque(MXC_SYSTEM.green400, MXC_COLOR.n100, '<circle cx="32" cy="30" r="13"/><path d="M24 40 20 54l12-6 12 6-4-14z"/>'),
  },
  'regie-exemple.ch': {
    source: 'icon', mime: 'image/svg+xml',
    data: marque(MXC_SYSTEM.yellow400, MXC_COLOR.n100, '<path d="M14 32 32 16l18 16h-5v17H37V38H27v11H19V32z"/>'),
  },
}

/** Les logos du banc pour ces domaines — hors « boîte pleine », aucun. */
export function fxSenderLogos(state: MailFixtureState, domaines: string[]): Record<string, FxSenderLogo> {
  if (state !== 'full') return {}
  return Object.fromEntries(domaines.filter((d) => d in FX_SENDER_LOGOS).map((d) => [d, FX_SENDER_LOGOS[d]]))
}

/**
 * Les compteurs du rail, recalculés sur le même jeu — jamais écrits à la main, et avec les
 * prédicats de `mail_folder_counts` : sans la corbeille ni le spam, depuis que les gestes
 * du banc tiennent (un fil supprimé comptait encore parmi les archivés).
 */
export function fxCounts(state: MailFixtureState, accountId: string | null): MailFolderCounts {
  if (state !== 'full' || !accountId) return { inbox_unread: 0, archived: 0, drafts: 0, spam: 0, label_counts: {} }
  const dansLaBoite = fils().filter((t) => t.account_id === accountId && !t.is_trashed)
  const courrier = dansLaBoite.filter((t) => !t.is_spam)
  const label_counts: Record<string, number> = {}
  for (const t of courrier) if (t.label_id) label_counts[t.label_id] = (label_counts[t.label_id] ?? 0) + 1
  return {
    inbox_unread: courrier.filter((t) => !t.is_read && !t.is_archived).length,
    archived: courrier.filter((t) => t.is_archived).length,
    drafts: 0,
    spam: dansLaBoite.filter((t) => t.is_spam).length,
    label_counts,
  }
}
