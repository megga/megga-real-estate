/**
 * L'état LOCAL de l'écran Messagerie, reprise des clés de « Gestion d'état » du
 * README de la maquette. Les DONNÉES (fils, messages, libellés, comptes) vivent
 * dans TanStack Query, pas ici : ce reducer ne décide que de ce qui est affiché.
 */
export type MailFolder = 'in' | 'arch' | 'star' | 'sent' | 'draft'
export type MailModal =
  | { kind: 'none' }
  | { kind: 'compose'; draftId?: string }
  | { kind: 'delete'; threadId: string }
  | { kind: 'add-account'; step: 'list' | 'oauth' | 'imap' | 'done'; provider?: 'gmail' | 'outlook' | 'infomaniak' | 'bluewin' | 'imap'; accountId?: string }
  | { kind: 'link-contact'; threadId: string; email: string; name: string | null }
  | { kind: 'file'; attachmentId: string }
  | { kind: 'preview'; attachmentId: string }
export interface MailCtxMenu { x: number; y: number; threadId: string }
export interface MailLabelCtx { x: number; y: number; labelId: string }

export interface MailState {
  accountId: string | null
  boxOpen: boolean
  folder: MailFolder
  labelId: string | null
  q: string
  unreadOnly: boolean
  attOnly: boolean
  page: number
  sel: string | null
  ctx: MailCtxMenu | null
  labelCtx: MailLabelCtx | null
  labelCreatorOpen: boolean
  editLabelId: string | null
  composer: 'none' | 'reply' | 'forward'
  modal: MailModal
}

export const initialMailState = (accountId: string | null): MailState => ({
  accountId, boxOpen: false, folder: 'in', labelId: null, q: '', unreadOnly: false, attOnly: false, page: 0, sel: null,
  ctx: null, labelCtx: null, labelCreatorOpen: false, editLabelId: null, composer: 'none', modal: { kind: 'none' },
})

export type MailAction =
  // ⚠ `null` est une valeur LÉGITIME depuis T2.14 : déconnecter la boîte
  // courante laisse l'écran sans boîte, et l'effet de `MessagerieApp` en
  // resélectionne une s'il en reste. Un `''` aurait fait le même effet par
  // accident — il est falsy — sans le dire.
  | { type: 'select-account'; accountId: string | null }
  | { type: 'toggle-box' } | { type: 'close-box' }
  | { type: 'folder'; folder: MailFolder }
  | { type: 'label'; labelId: string | null }
  | { type: 'q'; q: string }
  | { type: 'unread-only'; on: boolean } | { type: 'att-only'; on: boolean }
  | { type: 'page'; page: number }
  | { type: 'open'; threadId: string } | { type: 'back' }
  | { type: 'ctx'; ctx: MailCtxMenu | null }
  | { type: 'label-ctx'; ctx: MailLabelCtx | null }
  | { type: 'label-creator'; open: boolean; editLabelId?: string | null }
  | { type: 'composer'; composer: MailState['composer'] }
  | { type: 'modal'; modal: MailModal }

/** Le reducer de l'écran. Pur : aucune lecture réseau, aucun effet. */
export function mailReducer(s: MailState, a: MailAction): MailState {
  switch (a.type) {
    // Changer de boîte réinitialise dossier, libellé, sélection et page (README §« Sélection de boîte »).
    case 'select-account': return { ...initialMailState(a.accountId), modal: s.modal }
    case 'toggle-box': return { ...s, boxOpen: !s.boxOpen }
    case 'close-box': return { ...s, boxOpen: false }
    case 'folder': return { ...s, folder: a.folder, page: 0, sel: null, composer: 'none' }
    // Re-cliquer le libellé courant le désélectionne (filtre additif).
    case 'label': return { ...s, labelId: s.labelId === a.labelId ? null : a.labelId, page: 0, sel: null }
    case 'q': return { ...s, q: a.q, page: 0 }
    case 'unread-only': return { ...s, unreadOnly: a.on, page: 0 }
    case 'att-only': return { ...s, attOnly: a.on, page: 0 }
    case 'page': return { ...s, page: Math.max(0, a.page) }
    case 'open': return { ...s, sel: a.threadId, ctx: null, composer: 'none' }
    case 'back': return { ...s, sel: null, composer: 'none' }
    case 'ctx': return { ...s, ctx: a.ctx, labelCtx: null }
    case 'label-ctx': return { ...s, labelCtx: a.ctx, ctx: null }
    case 'label-creator': return { ...s, labelCreatorOpen: a.open, editLabelId: a.open ? (a.editLabelId ?? null) : null, labelCtx: null }
    case 'composer': return { ...s, composer: a.composer }
    case 'modal': return { ...s, modal: a.modal, ctx: null, labelCtx: null }
    default: return s
  }
}
