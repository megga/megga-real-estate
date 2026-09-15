/**
 * Orchestrateur de l'écran Messagerie : le chrome CRM (`CrmWorkspace` — barre
 * latérale + barre d'onglets) puis le bento `296px | 1fr` de la maquette
 * (README §« Écrans »).
 *
 * ⚠ L'écran montait `CrmTopNav` + `CrmIconRail`, les deux pièces de chrome que
 * la refonte du 4 septembre 2026 a SUPPRIMÉES. Il portait avec elles un
 * `onNavigate` de onze `switch` — exactement les vingt et un `switch` recopiés
 * que `crmSidebarNav.ts` a été écrit pour supprimer. La navigation vit
 * désormais dans la barre, et la messagerie y est une section.
 *
 * Le rail (T2.4), la liste (T2.5) et la lecture (T2.6) sont branchés ; les
 * modales restantes arrivent aux tâches 2.9-2.11. L'état vide reste honnête —
 * l'écran ne prétend pas afficher des messages qu'il ne sait pas encore lire.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import { crmPalette } from '@/components/crm/tokens'
import EtatVide from '@/components/crm/EtatVide'
import { useAuth } from '@/hooks/useAuth'
import { useMailAccounts } from '@/hooks/useMailAccounts'
import { useMailActions, type MailThreadAction } from '@/hooks/useMailActions'
import { useMailDrafts } from '@/hooks/useMailDrafts'
import { useMailLabels } from '@/hooks/useMailLabels'
import { useMailFolderCounts, useMailThreadRow, useMailThreads, type MailThreadRow } from '@/hooks/useMailThreads'
import { useCrmTabsOptionnel, useTabScopedState } from '@/hooks/useCrmTabs'
import { brouillonDepuisMail, deposerBrouillonCalendrier } from '@/lib/calendrierEvenements'
import { expediteurComplet } from '@/lib/mail/format'
import { codeErreurEnvoi } from '@/lib/mail/compose'
import { useMailThread } from '@/hooks/useMailThread'
import { useMailSend, type MailSendResult } from '@/hooks/useMailSend'
import { useMailRealtime } from '@/hooks/useMailRealtime'
import { MailList, type GesteLot } from './MailList'
import { MailAddAccountModal } from './MailAddAccountModal'
import { MailAttachmentPreviewModal } from './MailAttachmentPreviewModal'
import { MailComposeModal } from './MailComposeModal'
import { MailFileAttachmentModal } from './MailFileAttachmentModal'
import { MailContextMenu } from './MailContextMenu'
import { MailDeleteModal } from './MailDeleteModal'
import { MailDisconnectModal } from './MailDisconnectModal'
import { MailLinkContactModal } from './MailLinkContactModal'
import { MailNotification, type MailNotificationData } from './MailNotification'
import { MailCadreContext } from './mailCadre'
import { MailRail } from './MailRail'
import { MailReader } from './MailReader'
import { MailLabelMenu } from './MailLabelMenu'
import { mailReducer, initialMailState } from './mailState'
import { mailSurfaces, PILL } from './mailTokens'

/** Débounce de la recherche (README §2) : sans lui, une RPC part à chaque frappe. */
const DEBOUNCE_RECHERCHE = 250

interface Props { dark: boolean; setDark: (v: boolean) => void }

export function MessagerieApp({ dark, setDark }: Props) {
  const { t, i18n } = useTranslation('messages')
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const { profile } = useAuth()
  const sp = useMemo(() => crmPalette(dark), [dark])
  const ms = useMemo(() => mailSurfaces(sp, dark), [sp, dark])
  const accounts = useMailAccounts()
  const labels = useMailLabels()
  const [state, dispatch] = useReducer(mailReducer, null, () => initialMailState(null))
  const compteurs = useMailFolderCounts(state.accountId)
  // Un fil qui change chez le fournisseur (ou sous la main d'un collègue, sur une
  // boîte partagée) doit remonter sans rechargement : c'est ce qui fait bouger la
  // pastille de non-lus du rail.
  useMailRealtime(profile?.agency_id ?? null)

  /**
   * ⚠ Le débounce vit ICI et non dans `MailList`, où le plan le plaçait. Changer
   * de boîte REMET `state.q` à vide (le reducer reconstruit l'état) : un état
   * local dans la liste, lui, garderait la saisie et la repousserait au parent
   * 250 ms plus tard — la recherche de l'ancienne boîte reviendrait toute seule.
   * Ici le miroir suit toujours la source.
   */
  /**
   * ⛔ LE PORTEUR DES SUCCÈS PARTIELS. Deux edges du lot 1 répondent 200 avec un
   * `warning` : `mail-send` (`sent_but_not_recorded` — le fournisseur a envoyé,
   * la copie locale a échoué) et `mail-attachment` (`not_marked_filed` — le
   * document est créé, le lien vers la pièce n'a pas pu être posé). Les deux
   * étaient jetés, et le prix était le même à chaque fois : l'agent, ne voyant
   * pas son geste, le refaisait — un mail reçu deux fois par le client, un
   * document en double au dossier. Un succès partiel n'est ni une erreur ni un
   * silence ; il lui faut un endroit où se dire.
   */
  const [avis, setAvis] = useState<string | null>(null)
  /** La confirmation qui suit un geste, en bas du cadre (`MailNotification`). */
  const [notification, setNotification] = useState<MailNotificationData | null>(null)
  // Le cadre (le « pager ») où les modales se montent : leur voile l'épouse, lui seul.
  const [cadre, setCadre] = useState<HTMLDivElement | null>(null)
  /**
   * Le seul lecteur de `MailSendResult.warning`. Les trois chemins d'envoi
   * (réponse, transfert, nouveau message) passent par lui, sans quoi la
   * correction ne tiendrait que sur celui qu'on aurait pensé à câbler.
   */
  const apresEnvoi = (d: MailSendResult) => { if (d.warning === 'sent_but_not_recorded') setAvis('sentNotRecorded') }
  const [qDebounce, setQDebounce] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setQDebounce(state.q), DEBOUNCE_RECHERCHE)
    return () => clearTimeout(id)
  }, [state.q])

  const threads = useMailThreads(state.accountId, {
    folder: state.folder, labelId: state.labelId, q: qDebounce,
    unreadOnly: state.unreadOnly, attOnly: state.attOnly, page: state.page,
  })
  const drafts = useMailDrafts(state.accountId)
  const actions = useMailActions(state.accountId)
  const thread = useMailThread(state.sel)
  const send = useMailSend(state.accountId)
  const currentAccount = accounts.list.find((a) => a.id === state.accountId) ?? null

  /**
   * ⚠ Cinq sources d'échec n'ont AUCUN symptôme propre à l'écran : des compteurs
   * en panne se lisent « zéro non-lu », une liste d'étiquettes en panne se lit
   * « aucune étiquette », des brouillons en panne se lisent « aucun brouillon »,
   * et un geste refusé (archiver, étoiler, étiqueter) laisse simplement la ligne
   * revenir à son état d'avant — un rendu optimiste qui se défait ressemble à un
   * clic mal visé. Le bandeau est le seul endroit qui les rende visibles.
   *
   * ⚠ Non refermable, à dessein : il disparaît quand la cause disparaît (une
   * requête qui repasse, une mutation qui réussit). Un bouton « fermer »
   * laisserait croire que la panne est réglée.
   */
  const panne =
    compteurs.error ?? labels.error ?? drafts.error ?? actions.act.error ?? actions.actLot.error ?? actions.setLabel.error ?? null

  /**
   * ⚠ Le fil ouvert doit SURVIVRE à sa page. Un changement de filtre, un passage
   * à la page suivante ou un rafraîchissement Realtime peut le faire sortir de
   * `threads.rows` : sans repli, la lecture disparaîtrait sous l'utilisateur au
   * premier `invalidate`, sans qu'il ait rien fait.
   *
   * ⛔ ET CE N'EST PAS UNE `useRef`, que le plan prescrivait : `react-hooks/refs`
   * est une ERREUR dans ce dépôt, et lire `.current` pendant le rendu en lève
   * QUATRE (mesuré le 05.09.2026). Le souvenir passe par un état ajusté PENDANT
   * le rendu — le patron que React documente pour « dériver d'une donnée qui
   * change ». ⚠ Pas dans un effet non plus : `react-hooks/set-state-in-effect`
   * le signale, et l'effet ferait un rendu de plus, donc un clignotement.
   *
   * ⚠ Le repli n'est servi que si son identifiant correspond ENCORE : sinon on
   * montrerait le fil précédent sous le titre du suivant.
   */
  const filTrouve = threads.rows.find((r) => r.id === state.sel) ?? null
  const [filMemo, setFilMemo] = useState<MailThreadRow | null>(null)
  if (filTrouve && filTrouve !== filMemo) setFilMemo(filTrouve)

  /**
   * Un fil demandé par son LIEN (`?fil=…`, l'e-mail d'origine d'un événement du Calendrier,
   * 15.09.2026). Lu une fois au montage — le paramètre, lui, reste dans l'adresse (voir
   * l'effet plus bas) — et chargé hors de toute page : il peut vivre dans une autre boîte, un
   * autre dossier, une page loin.
   */
  const [filDemande] = useState(() => params.get('fil'))
  const filLie = useMailThreadRow(filDemande).data ?? null
  const filOuvert = filTrouve
    ?? (filMemo?.id === state.sel ? filMemo : null)
    ?? (filLie && filLie.id === state.sel ? filLie : null)

  // Première boîte visible = boîte courante ; `?account=` (retour de pop-up sans opener) prime.
  useEffect(() => {
    if (state.accountId || accounts.list.length === 0) return
    const wanted = params.get('account')
    const first = accounts.list.find((a) => a.id === wanted) ?? accounts.list[0]
    dispatch({ type: 'select-account', accountId: first.id })
  }, [accounts.list, params, state.accountId])
  /**
   * Le fil lié : sa boîte d'abord (changer de boîte vide l'état), puis le fil lui-même — UNE
   * fois par lien.
   *
   * ⛔ `filLie` change d'IDENTITÉ à chaque relecture de sa requête (retour du focus ou du
   * réseau, au-delà d'une minute) : l'effet rouvrait alors le fil, même archivé depuis, fermait
   * le composeur ouvert sur un autre — la réponse en cours perdue — et vidait la sélection.
   *
   * ⛔ ET LE PARAMÈTRE RESTE DANS L'ADRESSE, comme `?add=` plus bas. Le retirer la rendait à
   * `/dashboard/messagerie`, celle d'un onglet Messagerie déjà ouvert, que la barre activait :
   * l'agent atterrissait sur son ancienne Messagerie, sans le fil, et l'onglet d'où il venait
   * devenait une Messagerie cachée.
   */
  const lienOuvert = useRef<string | null>(null)
  useEffect(() => {
    if (!filLie || lienOuvert.current === filLie.id) return
    lienOuvert.current = filLie.id
    if (state.accountId !== filLie.account_id) dispatch({ type: 'select-account', accountId: filLie.account_id })
    dispatch({ type: 'open', threadId: filLie.id })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une fois par lien
  }, [filLie])
  // `?add=<jeton>` (depuis Réglages) ouvre l'assistant — une fois par demande : l'écran remonté
  // (rechargement, onglet évincé puis rouvert) ne le rouvre pas sous l'agent, et la demande
  // suivante, qui porte un autre jeton, l'ouvre bien. Le jeton traité se range dans l'onglet.
  const [ajoutDemande] = useState(() => params.get('add'))
  const [ajoutTraite, setAjoutTraite] = useTabScopedState<string | null>('ajout-boite', null)
  useEffect(() => {
    if (!ajoutDemande || ajoutTraite === ajoutDemande) return
    setAjoutTraite(ajoutDemande)
    dispatch({ type: 'modal', modal: { kind: 'add-account', step: 'list' } })
  }, [ajoutDemande, ajoutTraite, setAjoutTraite])

  const editLabel = labels.labels.find((l) => l.id === state.editLabelId) ?? null
  /**
   * Le brouillon rouvert depuis le dossier « Brouillons » ; `null` = message neuf.
   *
   * ⚠ L'identifiant est SORTI de l'union avant le `find` : le rétrécissement de
   * `state.modal` ne survit pas à l'entrée dans un callback, que TS suppose
   * appelable plus tard.
   */
  const idBrouillon = state.modal.kind === 'compose' ? state.modal.draftId ?? null : null
  const brouillonCompose = idBrouillon ? drafts.drafts.find((d) => d.id === idBrouillon) ?? null : null

  /**
   * Le fil visé par « Supprimer ce message ? ».
   *
   * ⚠ Le repli sur `filOuvert` n'est pas décoratif : depuis le LECTEUR, le fil
   * peut déjà avoir quitté la page courante (c'est tout l'objet du repli
   * ci-dessus). Sans lui, la modale se serait ouverte sur `null`, donc pas du
   * tout — un bouton « Supprimer » sans effet et sans message.
   */
  /**
   * La pièce visée par l'aperçu ou le classement. Elle se cherche dans les
   * MESSAGES du fil ouvert : les métadonnées de pièces n'existent que là, la
   * ligne de liste ne porte qu'un booléen `has_attachments`.
   */
  const idPiece = state.modal.kind === 'preview' || state.modal.kind === 'file' ? state.modal.attachmentId : null
  const piece = idPiece ? thread.data?.flatMap((m) => m.mail_attachments).find((a) => a.id === idPiece) ?? null : null

  const idsSuppression = state.modal.kind === 'delete' ? state.modal.threadIds : []
  const filsASupprimer = idsSuppression
    .map((id) => threads.rows.find((r) => r.id === id) ?? (filOuvert?.id === id ? filOuvert : null))
    .filter((r): r is MailThreadRow => r !== null)

  /**
   * La SÉLECTION de la liste (15.09.2026) : les fils cochés que la page MONTRE encore. Un
   * rafraîchissement (Realtime, synchro) peut en faire sortir un — il n'est alors plus
   * compté, ni visé par le geste suivant.
   */
  const selectionVisible = threads.rows.filter((r) => state.selection.includes(r.id))
  // Le dernier fil coché à la main : Maj+clic coche la plage qui va de lui au fil cliqué.
  const [ancre, setAncre] = useState<string | null>(null)
  const selectionner = (id: string, plage: boolean) => {
    const de = ancre ? threads.rows.findIndex((r) => r.id === ancre) : -1
    const a = threads.rows.findIndex((r) => r.id === id)
    if (plage && de >= 0 && a >= 0) {
      dispatch({ type: 'select-many', threadIds: threads.rows.slice(Math.min(de, a), Math.max(de, a) + 1).map((r) => r.id), on: true })
    } else {
      dispatch({ type: 'select', threadId: id })
    }
    setAncre(id)
  }

  /**
   * Un geste sur la sélection, puis le compte rendu : combien sont passés. Un lot dont un
   * fil a été refusé le DIT (notification d'alerte) — la liste, relue, montre lequel.
   */
  const agirEnLot = (action: MailThreadAction, ids: string[], apres?: () => void) => {
    actions.actLot.mutate({ action, threadIds: ids }, {
      onSuccess: ({ reussis, total }) => {
        dispatch({ type: 'select-clear' })
        apres?.()
        const texte = reussis === total ? t(`mail.lot.${action}`, { count: reussis })
          : reussis === 0 ? t('mail.lot.echec', { total }) : t('mail.lot.partiel', { reussis, total })
        setNotification({ id: Date.now(), texte, alerte: reussis < total })
      },
    })
  }

  /** Les gestes de la barre de sélection, selon le dossier ouvert. */
  const toutLu = selectionVisible.length > 0 && selectionVisible.every((r) => r.is_read)
  const idsSelection = selectionVisible.map((r) => r.id)
  const gestesLot: GesteLot[] = [
    ...(state.folder === 'spam' ? [] : [state.folder === 'arch'
      ? { cle: 'unarchive', libelle: t('mail.ctx.unarchive'), icone: 'inbox' as const, onClick: () => agirEnLot('unarchive', idsSelection) }
      : { cle: 'archive', libelle: t('mail.ctx.archive'), icone: 'archive' as const, onClick: () => agirEnLot('archive', idsSelection) }]),
    ...(state.folder === 'spam'
      ? [{ cle: 'not_spam', libelle: t('mail.ctx.notSpam'), icone: 'inbox' as const, onClick: () => agirEnLot('not_spam', idsSelection) }]
      // Rien à signaler dans une sélection qui n'a rien reçu (`rienASignaler`, mail-actions).
      : selectionVisible.some((r) => r.last_inbound_at)
        ? [{ cle: 'spam', libelle: t('mail.ctx.spam'), icone: 'spam' as const, onClick: () => agirEnLot('spam', idsSelection) }]
        : []),
    toutLu
      ? { cle: 'mark_unread', libelle: t('mail.ctx.markUnread'), icone: 'mail', onClick: () => agirEnLot('mark_unread', idsSelection) }
      : { cle: 'mark_read', libelle: t('mail.ctx.markRead'), icone: 'mail', onClick: () => agirEnLot('mark_read', idsSelection) },
    { cle: 'trash', libelle: t('mail.ctx.delete'), icone: 'trash', danger: true, onClick: () => dispatch({ type: 'modal', modal: { kind: 'delete', threadIds: idsSelection, depuisSelection: true } }) },
  ]

  /**
   * Créer, renommer ou recolorer — un seul geste d'écran, trois mutations
   * possibles. ⚠ Renommer ET recolorer se font en DEUX appels enchaînés : les
   * deux mutations de `useMailLabels` écrivent une colonne chacune, et le
   * créateur rend toujours les deux valeurs (il ne sait pas laquelle a bougé).
   */
  const saveLabel = useCallback((v: { name: string; color: string }) => {
    const done = () => dispatch({ type: 'label-creator', open: false })
    if (editLabel) {
      labels.rename.mutate({ id: editLabel.id, name: v.name }, {
        onSuccess: () => labels.recolor.mutate({ id: editLabel.id, color: v.color }, { onSuccess: done }),
      })
    } else {
      labels.create.mutate(v, { onSuccess: done })
    }
  }, [editLabel, labels])

  /**
   * Ouvrir un fil le marque lu — mais seulement s'il ne l'était pas : sinon
   * chaque ouverture partirait chez Gmail ou Graph pour ne rien y changer, et le
   * verrou de synchronisation du compte sérialiserait des appels vides.
   */
  const ouvrirFil = useCallback((id: string) => {
    dispatch({ type: 'open', threadId: id })
    const fil = threads.rows.find((r) => r.id === id)
    if (fil && !fil.is_read) actions.act.mutate({ action: 'mark_read', threadId: id })
  }, [threads.rows, actions.act])

  /**
   * Déconnexion d'UNE boîte, depuis le × du sélecteur du rail : le geste ouvre
   * « Déconnecter cette boîte ? » (`MailDisconnectModal`), qui seul déconnecte.
   *
   * ⚠ La modale vit dans l'état de l'ÉCRAN et non dans le sélecteur : le popover se
   * ferme au clic qui l'appelle, et une modale portée par lui mourrait avec lui.
   */
  /**
   * « Signaler comme spam » et « Ce n'est pas un spam », d'où qu'ils viennent (menu de la
   * ligne, lecteur) — et la notification qui dit où le fil est parti : il QUITTE le
   * dossier courant, et un fil qui disparaît sans un mot se cherche.
   */
  const signalerSpam = (fil: MailThreadRow) => {
    const retour = fil.is_spam
    actions.act.mutate({ action: retour ? 'not_spam' : 'spam', threadId: fil.id }, {
      onSuccess: () => setNotification({ id: Date.now(), texte: t(retour ? 'mail.spam.restored' : 'mail.spam.reported') }),
    })
  }

  /**
   * « Planifier » (15.09.2026, Julien : « que les mails soient connectés avec le
   * calendrier ») : l'e-mail devient un brouillon d'événement — objet, contact du fil,
   * expéditeur et extrait en notes, et le lien retour —, déposé EN MÉMOIRE, puis le
   * Calendrier s'ouvre dans un onglet neuf sur sa création pré-remplie. La Messagerie
   * reste où elle était.
   */
  const tabs = useCrmTabsOptionnel()
  const navigate = useNavigate()
  const planifier = (fil: MailThreadRow) => {
    const jeton = deposerBrouillonCalendrier(brouillonDepuisMail({
      sujet: fil.subject,
      extrait: fil.snippet,
      expediteur: expediteurComplet(fil.from_name, fil.from_email),
      date: new Date(fil.last_message_at).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      contactId: fil.contact_id,
      mailThreadId: fil.id,
      enTete: (o) => t('mail.plan.notes', o),
    }))
    if (tabs) tabs.ouvrirDans(`/dashboard/calendar?nouveau=${jeton}`)
    else navigate(`/dashboard/calendar?nouveau=${jeton}`)
  }

  const deconnecterBoite = useCallback((id: string) => {
    accounts.disconnect.reset()
    dispatch({ type: 'modal', modal: { kind: 'disconnect', accountId: id } })
  }, [accounts.disconnect])

  const idDeconnexion = state.modal.kind === 'disconnect' ? state.modal.accountId : null
  const boiteADeconnecter = idDeconnexion ? accounts.list.find((a) => a.id === idDeconnexion) ?? null : null
  /**
   * La déconnexion confirmée, puis la notification qui dit qu'elle a eu lieu (Julien,
   * 14.09.2026) — un geste destructeur qui réussit en silence se refait.
   *
   * ⚠ Si la boîte déconnectée était la boîte COURANTE, l'écran passe à la SUIVANTE,
   * prise dans la liste d'avant le geste. Repartir de `null` laissait l'effet de
   * sélection reprendre la première boîte de la liste pas encore rafraîchie — la boîte
   * même qu'on venait de déconnecter, gardée ensuite comme un `accountId` orphelin.
   */
  const confirmerDeconnexion = () => {
    const b = boiteADeconnecter
    if (!b) return
    accounts.disconnect.mutate(b.id, {
      onSuccess: () => {
        dispatch({ type: 'modal', modal: { kind: 'none' } })
        if (state.accountId === b.id) dispatch({ type: 'select-account', accountId: accounts.list.find((a) => a.id !== b.id)?.id ?? null })
        setNotification({ id: Date.now(), texte: t('mail.box.disconnected') })
      },
    })
  }

  return (
    <MailCadreContext.Provider value={cadre}>
    <div style={{ position: 'relative', background: sp.pageBg, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'var(--crm-font)', color: sp.ink }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <CrmWorkspace active="messagerie" helpKey="messagerie" sp={sp} dark={dark} setDark={setDark}>
        {/* ⚠ LES QUATRE GOUTTIÈRES DES AUTRES ÉCRANS — `lg` en haut et à gauche,
            `7xl` à droite, `6xl` en bas (Aujourd'hui, Réglages, Calendrier,
            Analytics). ⛔ Il manquait les deux premières : mesuré le 12.09.2026,
            le cadre collait à la carte latérale (0 px au lieu de 12) et montait
            sous la bande d'onglets (0 px au lieu de 12), 12 px plus haut que la
            carte latérale qu'il est censé border. */}
        <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingTop: 'var(--crm-space-lg)', paddingLeft: 'var(--crm-space-lg)', paddingRight: 'var(--crm-space-7xl)', paddingBottom: 'var(--crm-space-6xl)' }}>
          <div
            ref={setCadre}
            data-mail-bento
            style={{
              position: 'relative', height: '100%', borderRadius: 'var(--crm-radius-6xl)', overflow: 'hidden',
              border: `1px solid ${ms.bord2}`, boxShadow: ms.shadow, background: ms.side,
              display: 'grid', gridTemplateColumns: '296px 1fr', gridTemplateRows: '1fr', minHeight: 0,
            }}
          >
            <aside style={{ padding: 'var(--crm-space-7xl) var(--crm-space-6xl)', borderRight: `1px solid ${ms.bord2}`, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-7xl)', overflowY: 'auto', minHeight: 0 }}>
              <MailRail
                ms={ms}
                accounts={accounts.list}
                unread={accounts.unread}
                accountId={state.accountId}
                boxOpen={state.boxOpen}
                onToggleBox={() => dispatch({ type: 'toggle-box' })}
                onCloseBox={() => dispatch({ type: 'close-box' })}
                onSelectAccount={(id) => dispatch({ type: 'select-account', accountId: id })}
                onAddAccount={() => dispatch({ type: 'modal', modal: { kind: 'add-account', step: 'list' } })}
                onDisconnectAccount={deconnecterBoite}
                onCompose={() => { send.reset(); dispatch({ type: 'modal', modal: { kind: 'compose' } }) }}
                folder={state.folder}
                onFolder={(f) => dispatch({ type: 'folder', folder: f })}
                counts={compteurs.counts}
                labels={labels.labels}
                activeLabelId={state.labelId}
                onLabel={(id) => dispatch({ type: 'label', labelId: id })}
                onLabelContext={(e, id) => dispatch({ type: 'label-ctx', ctx: { x: e.clientX, y: e.clientY, labelId: id } })}
                creatorOpen={state.labelCreatorOpen}
                editLabel={editLabel}
                onOpenCreator={() => dispatch({ type: 'label-creator', open: true })}
                onCloseCreator={() => dispatch({ type: 'label-creator', open: false })}
                onSaveLabel={saveLabel}
                creatorBusy={labels.create.isPending || labels.rename.isPending || labels.recolor.isPending}
              />
            </aside>
            {/* Liste (T2.5) ou lecture du fil sélectionné (T2.6) — jamais les deux. */}
            <section style={{ minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              {avis && (
                <div
                  role="status"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)',
                    margin: 'var(--crm-space-2xl) var(--crm-space-7xl) 0',
                    padding: 'var(--crm-space-md) var(--crm-space-3xl)', borderRadius: PILL,
                    background: ms.warn, color: ms.warnInk, fontSize: 'var(--crm-text-sm)',
                  }}
                >
                  <span style={{ flex: 1 }}>{t(`mail.notice.${avis}`)}</span>
                  <button
                    type="button"
                    onClick={() => setAvis(null)}
                    aria-label={t('mail.notice.dismiss')}
                    style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                  >
                    {t('mail.notice.dismiss')}
                  </button>
                </div>
              )}
              {panne && (
                <div
                  role="alert"
                  style={{
                    margin: 'var(--crm-space-2xl) var(--crm-space-7xl) 0',
                    padding: 'var(--crm-space-md) var(--crm-space-3xl)', borderRadius: PILL,
                    background: ms.danger, color: ms.dangerInk, fontSize: 'var(--crm-text-sm)',
                  }}
                >
                  {t('mail.notice.degraded')}
                </div>
              )}
              {accounts.isLoading ? null : accounts.list.length === 0 ? (
                <div style={{ margin: 'auto' }}>
                  <EtatVide dark={dark} registre="aFaire" titre={t('mail.empty.noAccount.title')} corps={t('mail.empty.noAccount.body')}
                    action={{ libelle: t('mail.add.cta'), onClick: () => dispatch({ type: 'modal', modal: { kind: 'add-account', step: 'list' } }) }} />
                </div>
              ) : state.sel && filOuvert ? (
                thread.data ? (
                <MailReader
                  // Un fil, une lecture : ce qu'on y a déplié (le spam tenu à part) ne passe pas au suivant.
                  key={filOuvert.id}
                  ms={ms}
                  lang={i18n.language.slice(0, 2)}
                  boxEmail={currentAccount?.email ?? ''}
                  thread={filOuvert}
                  messages={thread.data}
                  label={labels.labels.find((l) => l.id === filOuvert.label_id) ?? null}
                  composer={state.composer}
                  sending={send.isPending}
                  sendError={send.error ? t(`mail.sendError.${codeErreurEnvoi(send.error.message)}`) : null}
                  onBack={() => dispatch({ type: 'back' })}
                  onReply={() => { send.reset(); dispatch({ type: 'composer', composer: 'reply' }) }}
                  onForward={() => { send.reset(); dispatch({ type: 'composer', composer: 'forward' }) }}
                  onCancelComposer={() => { send.reset(); dispatch({ type: 'composer', composer: 'none' }) }}
                  // `to` vide : `mail-send` déduit le destinataire du message d'origine.
                  onSendReply={(text, m) => send.mutate({ kind: 'reply', to: [], body_text: text, in_reply_to_message_id: m.id }, { onSuccess: (d) => { apresEnvoi(d); dispatch({ type: 'composer', composer: 'none' }) } })}
                  onSendForward={(to, note, m) => send.mutate({ kind: 'forward', to, body_text: note, in_reply_to_message_id: m.id }, { onSuccess: (d) => { apresEnvoi(d); dispatch({ type: 'composer', composer: 'none' }) } })}
                  onArchive={() => { actions.act.mutate({ action: filOuvert.is_archived ? 'unarchive' : 'archive', threadId: filOuvert.id }); dispatch({ type: 'back' }) }}
                  onDelete={() => dispatch({ type: 'modal', modal: { kind: 'delete', threadIds: [filOuvert.id] } })}
                  onSpam={() => { signalerSpam(filOuvert); dispatch({ type: 'back' }) }}
                  onPlanifier={() => planifier(filOuvert)}
                  onOpenAttachment={(a) => dispatch({ type: 'modal', modal: { kind: 'preview', attachmentId: a.id } })}
                  onLinkContact={(email, name) => dispatch({ type: 'modal', modal: { kind: 'link-contact', threadId: filOuvert.id, email, name } })}
                />
                ) : (
                  /*
                   * ⛔ CETTE BRANCHE ÉTAIT UN RETOUR SILENCIEUX À LA LISTE. Le gabarit
                   * testait `thread.data` : ses messages absents renvoyaient l'écran
                   * sur la liste, alors que `ouvrirFil` avait DÉJÀ marqué le fil comme
                   * lu. Le non-lu disparaissait sans que rien n'ait été lu, et l'échec
                   * ne laissait aucune trace. Le fil ouvert reste donc ouvert, et dit
                   * ce qui se passe.
                   */
                  <div style={{ margin: 'auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3xl)', alignItems: 'center' }}>
                    {thread.error ? (
                      <>
                        <span style={{ color: ms.mut, fontSize: 'var(--crm-text-sm)' }}>{t('mail.list.err.load')}</span>
                        <button
                          type="button"
                          onClick={() => { void thread.refetch() }}
                          style={{
                            padding: 'var(--crm-space-md) var(--crm-space-4xl)', borderRadius: PILL,
                            background: ms.accent, color: ms.accentInk, border: 'none', cursor: 'pointer',
                            fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600,
                          }}
                        >
                          {t('mail.list.err.retry')}
                        </button>
                      </>
                    ) : null}
                  </div>
                )
              ) : (
                <MailList
                  ms={ms}
                  lang={i18n.language.slice(0, 2)}
                  q={state.q}
                  onQ={(q) => dispatch({ type: 'q', q })}
                  unreadOnly={state.unreadOnly}
                  onUnreadOnly={(on) => dispatch({ type: 'unread-only', on })}
                  attOnly={state.attOnly}
                  onAttOnly={(on) => dispatch({ type: 'att-only', on })}
                  page={state.page}
                  total={threads.total}
                  onPage={(page) => dispatch({ type: 'page', page })}
                  rows={threads.rows}
                  labels={labels.labels}
                  isLoading={threads.isLoading}
                  error={threads.error}
                  onRetry={threads.refetch}
                  drafts={state.folder === 'draft' ? drafts.drafts : null}
                  onOpen={ouvrirFil}
                  onOpenDraft={(id) => { send.reset(); dispatch({ type: 'modal', modal: { kind: 'compose', draftId: id } }) }}
                  onStar={(r) => actions.act.mutate({ action: r.is_starred ? 'unstar' : 'star', threadId: r.id })}
                  onContext={(e, r) => dispatch({ type: 'ctx', ctx: { x: e.clientX, y: e.clientY, threadId: r.id } })}
                  selection={state.selection}
                  onSelect={selectionner}
                  onSelectAll={(on) => dispatch(on ? { type: 'select-many', threadIds: threads.rows.map((r) => r.id), on: true } : { type: 'select-clear' })}
                  gestesLot={gestesLot}
                />
              )}
            </section>
            <MailNotification ms={ms} notification={notification} onFin={() => setNotification(null)} />
          </div>

          {state.ctx && (() => {
            // Le menu meurt avec sa ligne : si la page a changé sous lui
            // (Realtime, pagination), il n'a plus de fil à commander.
            const fil = threads.rows.find((r) => r.id === state.ctx?.threadId)
            if (!fil) return null
            return (
              <MailContextMenu
                ms={ms}
                x={state.ctx.x}
                y={state.ctx.y}
                row={fil}
                labels={labels.labels}
                onClose={() => dispatch({ type: 'ctx', ctx: null })}
                onOpen={() => ouvrirFil(fil.id)}
                onAction={(a) => actions.act.mutate({ action: a, threadId: fil.id })}
                onDelete={() => dispatch({ type: 'modal', modal: { kind: 'delete', threadIds: [fil.id] } })}
                onSpam={() => signalerSpam(fil)}
                onPlanifier={() => planifier(fil)}
                onLabel={(id) => actions.setLabel.mutate({ threadId: fil.id, labelId: id })}
              />
            )
          })()}

          {state.labelCtx && (
            <MailLabelMenu
              ms={ms}
              x={state.labelCtx.x}
              y={state.labelCtx.y}
              onClose={() => dispatch({ type: 'label-ctx', ctx: null })}
              onRename={() => dispatch({ type: 'label-creator', open: true, editLabelId: state.labelCtx?.labelId })}
              onRecolor={() => dispatch({ type: 'label-creator', open: true, editLabelId: state.labelCtx?.labelId })}
              onDelete={() => labels.remove.mutate(state.labelCtx!.labelId)}
            />
          )}

          {/* Monté à l'ouverture, démonté à la fermeture : la saisie repart de
              zéro à chaque « Nouveau message », sans effet d'amorçage. */}
          {state.modal.kind === 'compose' && (
            <MailComposeModal
              ms={ms}
              boites={accounts.list}
              boiteOuverte={state.accountId}
              draft={brouillonCompose}
              sending={send.isPending}
              error={send.error ? t(`mail.sendError.${codeErreurEnvoi(send.error.message)}`) : null}
              onClose={(contenu) => {
                // Fermer sans envoyer n'efface rien : la saisie devient un
                // brouillon LOCAL (D7), jamais poussé chez le fournisseur — rangé
                // sous la boîte d'envoi choisie.
                if (contenu) {
                  drafts.save.mutate({
                    id: brouillonCompose?.id, kind: 'new', account_id: contenu.accountId ?? undefined,
                    to: contenu.to, cc: contenu.cc, bcc: contenu.bcc, subject: contenu.subject, body_text: contenu.body,
                  })
                }
                dispatch({ type: 'modal', modal: { kind: 'none' } })
              }}
              // README : à l'envoi, le message rejoint le dossier « Envoyés » — celui de la
              // boîte qui a ENVOYÉ, qui devient la boîte ouverte si c'en était une autre.
              onSend={(input) => send.mutate(input, {
                onSuccess: (d) => {
                  apresEnvoi(d)
                  dispatch({ type: 'modal', modal: { kind: 'none' } })
                  if (input.account_id && input.account_id !== state.accountId) dispatch({ type: 'select-account', accountId: input.account_id })
                  dispatch({ type: 'folder', folder: 'sent' })
                },
              })}
            />
          )}

          {/* L'assistant est monté / démonté comme le composeur : rouvrir « Ajouter
              une boîte » repart du choix du fournisseur, jamais d'une étape à
              moitié franchie. */}
          {state.modal.kind === 'add-account' && (
            <MailAddAccountModal
              ms={ms}
              open
              onClose={() => dispatch({ type: 'modal', modal: { kind: 'none' } })}
              onOpenAccount={(id) => dispatch({ type: 'select-account', accountId: id })}
            />
          )}

          {/* « Rapprocher l'adresse » — montée avec sa cible, donc la recherche
              repart du nom de l'expéditeur à chaque ouverture. */}
          {state.modal.kind === 'link-contact' && (() => {
            const cible = state.modal
            return (
              <MailLinkContactModal
                ms={ms}
                open
                email={cible.email}
                name={cible.name}
                busy={actions.linkContact.isPending}
                error={actions.linkContact.error?.message ?? null}
                onClose={() => { actions.linkContact.reset(); dispatch({ type: 'modal', modal: { kind: 'none' } }) }}
                onLink={(contactId) => actions.linkContact.mutate(
                  { threadId: cible.threadId, contactId, email: cible.email },
                  { onSuccess: () => dispatch({ type: 'modal', modal: { kind: 'none' } }) },
                )}
              />
            )
          })()}

          {/* Les deux modales de pièce jointe s'appellent l'une l'autre : depuis
              l'aperçu on classe, depuis le classement on agrandit. Elles gardent
              le même `attachmentId`, seule la nature de la modale change. */}
          <MailAttachmentPreviewModal
            ms={ms}
            att={state.modal.kind === 'preview' ? piece : null}
            onClose={() => dispatch({ type: 'modal', modal: { kind: 'none' } })}
            onFile={() => piece && dispatch({ type: 'modal', modal: { kind: 'file', attachmentId: piece.id } })}
          />

          {state.modal.kind === 'file' && piece && (
            <MailFileAttachmentModal
              ms={ms}
              att={piece}
              defaultContactId={filOuvert?.contact_id ?? null}
              onClose={() => dispatch({ type: 'modal', modal: { kind: 'none' } })}
              onPreview={() => dispatch({ type: 'modal', modal: { kind: 'preview', attachmentId: piece.id } })}
              // Le fil est rechargé : c'est lui qui porte `document_id`, donc la
              // pastille « Classé au dossier » de l'aperçu et du lecteur.
              onFiled={(a) => {
                void queryClient.invalidateQueries({ queryKey: ['mail', 'thread', state.sel] })
                dispatch({ type: 'modal', modal: { kind: 'none' } })
                if (a) setAvis(a)
              }}
            />
          )}

          <MailDisconnectModal
            ms={ms}
            boite={boiteADeconnecter}
            busy={accounts.disconnect.isPending}
            error={accounts.disconnect.error ? t('mail.box.disconnectError') : null}
            onCancel={() => { accounts.disconnect.reset(); dispatch({ type: 'modal', modal: { kind: 'none' } }) }}
            onConfirm={confirmerDeconnexion}
          />

          <MailDeleteModal
            ms={ms}
            rows={filsASupprimer}
            busy={actions.act.isPending || actions.actLot.isPending}
            onCancel={() => dispatch({ type: 'modal', modal: { kind: 'none' } })}
            // On revient à la liste APRÈS la corbeille : fermer la modale sur la
            // lecture d'un fil qui n'y est plus laisserait un écran sans objet.
            onConfirm={() => {
              if (state.modal.kind === 'delete' && state.modal.depuisSelection && filsASupprimer.length > 0) {
                agirEnLot('trash', filsASupprimer.map((r) => r.id), () => dispatch({ type: 'modal', modal: { kind: 'none' } }))
              } else if (filsASupprimer.length === 1) {
                actions.act.mutate({ action: 'trash', threadId: filsASupprimer[0].id }, {
                  onSuccess: () => { dispatch({ type: 'modal', modal: { kind: 'none' } }); dispatch({ type: 'back' }) },
                })
              }
            }}
          />
        </main>
        </CrmWorkspace>
      </div>
    </div>
    </MailCadreContext.Provider>
  )
}
