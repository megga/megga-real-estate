/**
 * Orchestrateur de l'écran Messagerie : chrome CRM (`CrmTopNav` + `CrmIconRail`,
 * copie du squelette de `CalendarApp`) puis le bento `296px | 1fr` de la maquette
 * (README §« Écrans »).
 *
 * Le rail (T2.4), la liste (T2.5) et la lecture (T2.6) sont branchés ; les
 * modales restantes arrivent aux tâches 2.9-2.11. L'état vide reste honnête —
 * l'écran ne prétend pas afficher des messages qu'il ne sait pas encore lire.
 */
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CrmTopNav, type CrmScreenId } from '@/components/crm/CrmShell'
import { CrmIconRail } from '@/components/crm/LiquidGlassRail'
import { crmPalette } from '@/components/crm/tokens'
import EtatVide from '@/components/crm/EtatVide'
import { useAuth } from '@/hooks/useAuth'
import { useMailAccounts } from '@/hooks/useMailAccounts'
import { useMailActions } from '@/hooks/useMailActions'
import { useMailDrafts } from '@/hooks/useMailDrafts'
import { useMailLabels } from '@/hooks/useMailLabels'
import { useMailFolderCounts, useMailThreads, type MailThreadRow } from '@/hooks/useMailThreads'
import { useMailThread } from '@/hooks/useMailThread'
import { useMailSend } from '@/hooks/useMailSend'
import { useMailRealtime } from '@/hooks/useMailRealtime'
import { parseRecipients } from '@/hooks/useMailContactSearch'
import { MailList } from './MailList'
import { MailAddAccountModal } from './MailAddAccountModal'
import { MailAttachmentPreviewModal } from './MailAttachmentPreviewModal'
import { MailComposeModal } from './MailComposeModal'
import { MailFileAttachmentModal } from './MailFileAttachmentModal'
import { MailContextMenu } from './MailContextMenu'
import { MailDeleteModal } from './MailDeleteModal'
import { MailLinkContactModal } from './MailLinkContactModal'
import { MailRail } from './MailRail'
import { MailReader } from './MailReader'
import { MailLabelMenu } from './MailLabelMenu'
import { mailReducer, initialMailState } from './mailState'
import { mailSurfaces } from './mailTokens'

/** Débounce de la recherche (README §2) : sans lui, une RPC part à chaque frappe. */
const DEBOUNCE_RECHERCHE = 250

interface Props { dark: boolean; setDark: (v: boolean) => void }

export function MessagerieApp({ dark, setDark }: Props) {
  const { t, i18n } = useTranslation('messages')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const { profile } = useAuth()
  const sp = useMemo(() => crmPalette(dark), [dark])
  const ms = useMemo(() => mailSurfaces(sp, dark), [sp, dark])
  const accounts = useMailAccounts()
  const labels = useMailLabels()
  const [state, dispatch] = useReducer(mailReducer, null, () => initialMailState(null))
  const counts = useMailFolderCounts(state.accountId)
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
  const filOuvert = filTrouve ?? (filMemo?.id === state.sel ? filMemo : null)

  // Première boîte visible = boîte courante ; `?account=` (retour de pop-up sans opener) prime.
  useEffect(() => {
    if (state.accountId || accounts.list.length === 0) return
    const wanted = params.get('account')
    const first = accounts.list.find((a) => a.id === wanted) ?? accounts.list[0]
    dispatch({ type: 'select-account', accountId: first.id })
  }, [accounts.list, params, state.accountId])
  // `?add=1` (depuis Réglages) ouvre l'assistant.
  useEffect(() => {
    if (params.get('add') === '1') { dispatch({ type: 'modal', modal: { kind: 'add-account', step: 'list' } }); params.delete('add'); setParams(params, { replace: true }) }
  }, [params, setParams])

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

  const idSuppression = state.modal.kind === 'delete' ? state.modal.threadId : null
  const filASupprimer = idSuppression
    ? threads.rows.find((r) => r.id === idSuppression) ?? (filOuvert?.id === idSuppression ? filOuvert : null)
    : null

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
   * Déconnexion d'UNE boîte, depuis le sélecteur du rail.
   *
   * ⚠ `window.confirm` et non une modale du dépôt, à dessein et par exception :
   * le geste part d'un POPOVER, qui se ferme au premier clic dehors — une modale
   * portée aurait dû survivre à la fermeture de son propre déclencheur, donc
   * remonter dans l'état de l'écran pour un cas à trois lignes. Le natif bloque,
   * et il y a un précédent (`ImportLeadPage:153`). À revoir si un second geste
   * destructeur naît dans ce menu.
   *
   * ⚠ Si la boîte déconnectée était la boîte COURANTE, l'écran doit repartir de
   * zéro : sans ça il garderait un `accountId` qui n'existe plus et la liste
   * resterait sur la dernière page servie.
   */
  const deconnecterBoite = useCallback((id: string) => {
    if (!window.confirm(t('mail.box.disconnectConfirm'))) return
    accounts.disconnect.mutate(id, {
      onSuccess: () => { if (state.accountId === id) dispatch({ type: 'select-account', accountId: null }) },
    })
  }, [accounts.disconnect, state.accountId, t])

  const onNavigate = useCallback((id: CrmScreenId | string) => {
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'matching': navigate('/dashboard/matching'); break
      case 'parcours': navigate('/dashboard/journey'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'messagerie': break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings'); break
    }
  }, [navigate])

  return (
    <div style={{ position: 'relative', background: sp.pageBg, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'var(--crm-font)', color: sp.ink }}>
      <CrmTopNav active="messagerie" sp={sp} dark={dark} onNavigate={onNavigate} helpKey="messagerie" />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <CrmIconRail active="messagerie" sp={sp} dark={dark} setDark={setDark} onNavigate={onNavigate} />
        <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingRight: 'var(--crm-space-7xl)', paddingBottom: 'var(--crm-space-6xl)' }}>
          <div
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
                onCompose={() => dispatch({ type: 'modal', modal: { kind: 'compose' } })}
                folder={state.folder}
                onFolder={(f) => dispatch({ type: 'folder', folder: f })}
                counts={counts}
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
              {accounts.isLoading ? null : accounts.list.length === 0 ? (
                <div style={{ margin: 'auto' }}>
                  <EtatVide dark={dark} registre="aFaire" titre={t('mail.empty.noAccount.title')} corps={t('mail.empty.noAccount.body')}
                    action={{ libelle: t('mail.add.cta'), onClick: () => dispatch({ type: 'modal', modal: { kind: 'add-account', step: 'list' } }) }} />
                </div>
              ) : state.sel && filOuvert && thread.data ? (
                <MailReader
                  ms={ms}
                  lang={i18n.language.slice(0, 2)}
                  boxEmail={currentAccount?.email ?? ''}
                  thread={filOuvert}
                  messages={thread.data}
                  label={labels.labels.find((l) => l.id === filOuvert.label_id) ?? null}
                  composer={state.composer}
                  sending={send.isPending}
                  onBack={() => dispatch({ type: 'back' })}
                  onReply={() => dispatch({ type: 'composer', composer: 'reply' })}
                  onForward={() => dispatch({ type: 'composer', composer: 'forward' })}
                  onCancelComposer={() => dispatch({ type: 'composer', composer: 'none' })}
                  // `to` vide : `mail-send` déduit le destinataire du message d'origine.
                  onSendReply={(text, m) => send.mutate({ kind: 'reply', to: [], body_text: text, in_reply_to_message_id: m.id }, { onSuccess: () => dispatch({ type: 'composer', composer: 'none' }) })}
                  onSendForward={(to, note, m) => send.mutate({ kind: 'forward', to, body_text: note, in_reply_to_message_id: m.id }, { onSuccess: () => dispatch({ type: 'composer', composer: 'none' }) })}
                  onArchive={() => { actions.act.mutate({ action: filOuvert.is_archived ? 'unarchive' : 'archive', threadId: filOuvert.id }); dispatch({ type: 'back' }) }}
                  onDelete={() => dispatch({ type: 'modal', modal: { kind: 'delete', threadId: filOuvert.id } })}
                  onOpenAttachment={(a) => dispatch({ type: 'modal', modal: { kind: 'preview', attachmentId: a.id } })}
                  onLinkContact={(email, name) => dispatch({ type: 'modal', modal: { kind: 'link-contact', threadId: filOuvert.id, email, name } })}
                />
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
                  drafts={state.folder === 'draft' ? drafts.drafts : null}
                  onOpen={ouvrirFil}
                  onOpenDraft={(id) => dispatch({ type: 'modal', modal: { kind: 'compose', draftId: id } })}
                  onStar={(r) => actions.act.mutate({ action: r.is_starred ? 'unstar' : 'star', threadId: r.id })}
                  onContext={(e, r) => dispatch({ type: 'ctx', ctx: { x: e.clientX, y: e.clientY, threadId: r.id } })}
                />
              )}
            </section>
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
                onDelete={() => dispatch({ type: 'modal', modal: { kind: 'delete', threadId: fil.id } })}
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
              draft={brouillonCompose}
              sending={send.isPending}
              error={send.error?.message ?? null}
              onClose={(contenu) => {
                // Fermer sans envoyer n'efface rien : la saisie devient un
                // brouillon LOCAL (D7), jamais poussé chez le fournisseur.
                if (contenu) drafts.save.mutate({ id: brouillonCompose?.id, kind: 'new', to: parseRecipients(contenu.to), subject: contenu.subject, body_text: contenu.body })
                dispatch({ type: 'modal', modal: { kind: 'none' } })
              }}
              // README : à l'envoi, le message rejoint le dossier « Envoyés ».
              onSend={(input) => send.mutate(input, { onSuccess: () => { dispatch({ type: 'modal', modal: { kind: 'none' } }); dispatch({ type: 'folder', folder: 'sent' }) } })}
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
                onClose={() => dispatch({ type: 'modal', modal: { kind: 'none' } })}
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
              onFiled={() => {
                void queryClient.invalidateQueries({ queryKey: ['mail', 'thread', state.sel] })
                dispatch({ type: 'modal', modal: { kind: 'none' } })
              }}
            />
          )}

          <MailDeleteModal
            ms={ms}
            row={filASupprimer}
            busy={actions.act.isPending}
            onCancel={() => dispatch({ type: 'modal', modal: { kind: 'none' } })}
            // On revient à la liste APRÈS la corbeille : fermer la modale sur la
            // lecture d'un fil qui n'y est plus laisserait un écran sans objet.
            onConfirm={() => filASupprimer && actions.act.mutate({ action: 'trash', threadId: filASupprimer.id }, {
              onSuccess: () => { dispatch({ type: 'modal', modal: { kind: 'none' } }); dispatch({ type: 'back' }) },
            })}
          />
        </main>
      </div>
    </div>
  )
}
