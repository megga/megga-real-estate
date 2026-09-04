# Messagerie CRM — Lot 2 : l'écran de la maquette en MEGGA X, la pop-up OAuth, les modales

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Avant de commencer** : le plan maître [2026-09-03-messagerie-crm.md](2026-09-03-messagerie-crm.md)
> — §1 (transposition et table des tokens, **la source des valeurs de ce lot**), §3 D1, D6, D7,
> D9, D12-D14, D16, §7 (portes) — et le lot 1 livré (les edges et les RPC existent).
> La maquette : `~/Downloads/Client mail .zip` → `design_handoff_messagerie/README.md`
> §« Écrans / vues » 1 à 9, §« Interactions & comportement », §« Gestion d'état ».
> **Toute dimension non écrite ici est dans le README** ; ce lot ne le recopie pas, il le
> transpose (tokens) et le câble (hooks).

**Goal:** L'agent ouvre l'onglet Messagerie, voit ses boîtes, lit, cherche, filtre, classe, répond, transfère, compose, rattache un expéditeur à un contact, classe une pièce au dossier, et connecte une boîte Google ou Microsoft dans une pop-up — au pixel de la maquette, en MEGGA X, en quatre langues.

**Architecture:** Une page (`MessageriePage`) qui monte `MessagerieApp` sur le squelette exact de `CalendarApp` (chrome CRM + bento `296px 1fr`) ; un état d'écran local (`useReducer`) qui reprend les clés de la maquette (`mailFolder`, `mailLabel`, `mailQ`, `mailSel`…) ; des hooks TanStack Query par ressource (`useMailAccounts`, `useMailThreads`, `useMailThread`, `useMailLabels`, `useMailActions`, `useMailSend`, `useMailDrafts`) avec mutations optimistes ; Realtime sur `mail_threads` ; sept modales portées sur `document.body` derrière un même `MailModalShell`. La pop-up OAuth est un `window.open` dont le retour arrive par `postMessage` (`useMailOAuthPopup`) ; la page `/oauth/mail/callback` ne fait que relayer.

**Tech Stack:** React 18, TanStack Query v5, react-i18next, `MEIcon`, tokens `sp` (`crmPalette`) + variables `--crm-*`, DOMPurify (à ajouter), Vitest, Playwright (visuel).

---

## Règles du lot

1. **Zéro littéral de couleur, de rayon, d'espacement, de taille de texte, de police** dans `src/components/crm/messagerie/**` : tokens `sp.*`, `MXC_SYSTEM.*`, `crmVoileEncre`, `crmVoileAssombrissant`, `encreSur`, et `var(--crm-*)`. Les gardes `couleur-barreaux`, `megga-x-crm-tokens`, `polices-domaines`, `accent-ramp`, `voile-modale`, `interpolation-morte` scannent `src/**` (maître §7.1).
2. **Encre sur un aplat de donnée** (pastille de libellé, compteur non lus) = `encreSur(fond)`, jamais `#fff` — garde `messagerie-contraste.spec.ts` (T2.13).
3. **Modale** = `createPortal(document.body)` + voile `crmVoileAssombrissant(0.40)` + `backdropFilter: blur(6px)` + `useFocusTrap` + `Escape`. z-index : lire l'empilement local (top nav/rail 75, `CrmSearch` 200, profil 9000). Les modales de cet écran prennent **300** (calque) ; les popovers internes **310** ; le menu contextuel **320**.
4. **Pas de `Manrope`, pas de `Poppins`** : `fontFamily` hérité de l'écran (`var(--crm-font)` posé une fois à la racine de `MessagerieApp`).
5. **i18n** : tout texte visible vient de `useTranslation('messages')` (namespace vivant, sans consommateur — maître §2) ou de `common`. `npm run lint:i18n` bloque le français en dur.
6. **Rien n'est inventé dans les fixtures** : le banc `/dev/messagerie` porte des données d'exemple clairement fausses (`@exemple.ch`, noms de scène), jamais des données qui ressemblent à de vraies fiches (mémoire `feedback_maquette_fidelity_vs_data_honesty`).

---

## Fichiers du lot

| Créé | Rôle |
|---|---|
| `src/pages/agent/MessageriePage.tsx` | entrée de route, préférence sombre |
| `src/pages/agent/MailOAuthCallbackPage.tsx` | `/oauth/mail/callback` : relais `postMessage` (ou repli sans opener) — sous `pages/agent`, pas `pages/public` (domaine Manrope de `polices-domaines.spec.ts`) |
| `src/pages/dev/MessagerieShowcasePage.tsx` | banc `/dev/messagerie`, 3 états |
| `src/components/crm/messagerie/MessagerieApp.tsx` | chrome CRM + bento + état d'écran |
| `src/components/crm/messagerie/mailState.ts` | reducer de l'écran (clés de la maquette) |
| `src/components/crm/messagerie/mailTokens.ts` | surfaces dérivées de `sp` pour cet écran |
| `src/components/crm/messagerie/MailRail.tsx` · `MailBoxSelector.tsx` · `MailLabelCreator.tsx` · `MailLabelMenu.tsx` | colonne gauche |
| `src/components/crm/messagerie/MailList.tsx` · `MailListRow.tsx` · `MailPager.tsx` · `MailContextMenu.tsx` | liste |
| `src/components/crm/messagerie/MailReader.tsx` · `MailBodyFrame.tsx` · `MailReplyComposer.tsx` · `MailForwardComposer.tsx` | lecture |
| `src/components/crm/messagerie/MailModalShell.tsx` | portail + voile + carte + piège de focus |
| `src/components/crm/messagerie/MailComposeModal.tsx` · `MailAttachPopover.tsx` | « Nouveau message » |
| `src/components/crm/messagerie/MailDeleteModal.tsx` | « Supprimer ce message ? » |
| `src/components/crm/messagerie/MailAddAccountModal.tsx` · `MailProviderLogo.tsx` | « Ajouter une boîte » |
| `src/components/crm/messagerie/MailLinkContactModal.tsx` | « Rapprocher l'adresse » |
| `src/components/crm/messagerie/MailFileAttachmentModal.tsx` · `MailAttachmentPreviewModal.tsx` | « Classer dans le dossier » · « Aperçu de la pièce » |
| `src/components/crm/messagerie/fixtures.tsx` | données du banc (⚠ `.tsx` : le fournisseur rend du JSX, corrigé le 04.09.2026) |
| `src/components/crm-mobile/messagerie/MobileMessagerieScreen.tsx` | mobile minimal (D16) |
| `src/hooks/useMailAccounts.ts` · `useMailLabels.ts` · `useMailThreads.ts` · `useMailThread.ts` · `useMailActions.ts` · `useMailSend.ts` · `useMailDrafts.ts` · `useMailRealtime.ts` · `useMailOAuthPopup.ts` · `useMailAttachmentBlob.ts` | données |
| `src/lib/mail/format.ts` · `src/lib/mail/sanitize.ts` · `src/lib/mail/oauthPopup.ts` | pur, testé |
| `tests/unit/mail-format.spec.ts` · `mail-sanitize.spec.ts` · `mail-oauth-popup.spec.ts` · `messagerie-contraste.spec.ts` | gardes |
| Modifié | |
| `src/App.tsx` | 3 routes |
| `src/components/crm/CrmShell.tsx` | `CrmScreenId` + onglet |
| `src/pages/agent/*.tsx` (≈20) | `case 'messagerie'` |
| `src/i18n/locales/{fr,de,en,it}/messages.json`, `common.json` | clés `mail.*`, `nav.messagerie`, `audit.action.email_*` |
| `src/components/crm/settings/IntegrationsSection.tsx` | carte « Messagerie » |
| `tests/unit/megga-x-grammar.spec.ts` | zone `crm/messagerie` |
| `package.json` | `dompurify`, `@types/dompurify` |

---

### Task 2.1 : Route, page, onglet, squelette du bento, banc vide

**Files:**
- Create: `src/pages/agent/MessageriePage.tsx`
- Create: `src/components/crm/messagerie/MessagerieApp.tsx`
- Create: `src/components/crm/messagerie/mailTokens.ts`
- Create: `src/components/crm/messagerie/mailState.ts`
- Create: `src/pages/dev/MessagerieShowcasePage.tsx`
- Modify: `src/App.tsx`, `src/components/crm/CrmShell.tsx:66-68,142-150`, `src/pages/agent/*.tsx` (switch `onNavigate`), `src/i18n/locales/*/common.json`, `src/i18n/locales/*/messages.json`, `tests/unit/megga-x-grammar.spec.ts`

⛔ **CETTE TÂCHE DÉPEND DE DEUX FICHIERS DE LA 2.3, et ce n'est pas négociable** (mesuré
le 04.09.2026) : `MessagerieApp` importe `useMailAccounts` pour savoir s'il a une boîte à
montrer, et ce hook importe `invokeMail`. Sans eux, `tsc -b` échoue et l'étape 8 ne peut
pas être verte. `src/lib/mail/invoke.ts` (T2.3 step 1) et `src/hooks/useMailAccounts.ts`
(T2.3 step 2) sont donc écrits ICI, à l'identique ; la 2.3 livre les neuf autres hooks.

⛔ **ET TROIS CLAUSES DU CLIQUET DE GRAMMAIRE ROUGISSENT DÈS CETTE TÂCHE**, pas en T2.12 :
la clause de fermeture (« tout porteur de `src/` est couvert ») voit `MessagerieApp.tsx`
le jour où il est écrit, et la clause « aucune page n'échappe au cliquet » voit les deux
pages neuves. Il faut donc, dans le MÊME commit : ajouter
`{ root: 'src/components/crm/messagerie', keep: (n) => /\.tsx?$/.test(n) }` à `ZONES`, et
`MessageriePage.tsx` + `MailOAuthCallbackPage.tsx` à `PAGES` **et** `PAGES_ACQUISES` (les
deux listes, la seconde étant écrite à part exprès). La zone entre VIDE de dette — c'est la
règle 1 du lot, elle ne coûte rien tant qu'on ne pose aucun littéral.

- [ ] **Step 1 : Onglet + id d'écran**

`src/components/crm/CrmShell.tsx` — ajouter `| 'messagerie'` à `CrmScreenId` (`:66-68`) et l'onglet après `calendar` (`:142-150`) :
```ts
  { id: 'messagerie', label: tc('nav.messagerie') },
```
`common.json` (4 langues), sous `nav` : fr `"messagerie": "Messagerie"`, de `"messagerie": "Nachrichten"`, en `"messagerie": "Mail"`, it `"messagerie": "Messaggi"`.

Dans chaque page agent qui porte un `switch` `onNavigate` :
```bash
grep -l "onNavigate = (id" src/pages/agent/*.tsx
```
ajouter, avant `case 'settings'` :
```ts
    case 'messagerie': navigate('/dashboard/messagerie'); break
```

- [ ] **Step 2 : Tokens d'écran**

```ts
// src/components/crm/messagerie/mailTokens.ts
// Surfaces de l'écran Messagerie dérivées de la palette MEGGA X (maître §1, table des
// tokens). Une seule source : `sp`. Aucun littéral ici, aucun dans les composants.
import type { CrmPalette } from '@/components/crm/tokens'
import { crmVoileEncre } from '@/components/crm/tokens'
import { MXC_SYSTEM, encreSur } from '@/components/megga-x-crm/tokens'

export interface MailSurfaces {
  /** fond du bento (`--side`) */ side: string
  /** carte (`--card`) */ card: string
  /** surface creusée : champs, pilules, ligne active (`--elev`) */ elev: string
  /** survol (`--hover` / `--hover2`) */ hover: string
  hover2: string
  /** bordures (`--bord`, `--bord2`, `--bord3`) */ bord: string
  bord2: string
  bord3: string
  ink: string
  txt2: string
  txt3: string
  mut: string
  dim: string
  accent: string
  accentInk: string
  /** étoile suivie */ star: string
  /** encre des libellés « À traiter » etc. sur leur aplat */ pillInk: (bg: string) => string
  danger: string
  dangerInk: string
  success: string
  successInk: string
  shadow: string
  solid: string
  solidBorder: string
  solidShadow: string
}

export function mailSurfaces(sp: CrmPalette, dark: boolean): MailSurfaces {
  return {
    side: sp.pageBg,
    card: sp.cardBg,
    elev: sp.cardSubBg,
    hover: sp.focusSurface,
    hover2: crmVoileEncre(dark, 0.06),
    bord: sp.cardBorder,
    bord2: sp.frameBorder,
    bord3: sp.solidBorder,
    ink: sp.ink,
    txt2: sp.ink,
    txt3: sp.sub,
    mut: sp.soft,
    dim: crmVoileEncre(dark, 0.25),
    accent: sp.accent,
    accentInk: sp.accentInk,
    star: MXC_SYSTEM.yellow400,
    pillInk: (bg) => encreSur(bg),
    danger: MXC_SYSTEM.red400,
    dangerInk: encreSur(MXC_SYSTEM.red400),
    success: MXC_SYSTEM.green300,
    successInk: encreSur(MXC_SYSTEM.green300),
    shadow: sp.shadow,
    solid: sp.solidBg,
    solidBorder: sp.solidBorder,
    solidShadow: sp.solidShadow,
  }
}

/** Transition unique de la maquette (§« Interactions ») ; coupée par prefers-reduced-motion via la feuille globale. */
export const MAIL_TRANSITION = 'background-color .18s ease, border-color .18s ease, color .18s ease'
/** Pilule (`border-radius:999px`). */
export const PILL = 'var(--crm-radius-pill)'
```

⛔ **`MAIL_TRANSITION` et `PILL` N'ENTRENT PAS EN T2.1 mais en T2.4**, avec leur premier
consommateur : `npm run lint:deadcode` refuse un export que rien ne lit, et il les a
nommés tous les deux (mesuré le 04.09.2026). Les poser d'avance aurait coûté une exemption
dans `scripts/check-dead-exports.mjs` pour deux constantes de trois lignes.

- [ ] **Step 3 : État d'écran (les clés de la maquette)**

```ts
// src/components/crm/messagerie/mailState.ts
// L'état LOCAL de l'écran, reprise des clés de « Gestion d'état » du README. Les
// données (fils, messages, libellés, comptes) vivent dans TanStack Query, pas ici.
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
  | { type: 'select-account'; accountId: string }
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
```

- [ ] **Step 4 : La page et l'application (squelette, sans contenu encore)**

```tsx
// src/pages/agent/MessageriePage.tsx
// MEGGA CRM — Messagerie (boîte mail intégrée). Écran d'entrée : monte l'app et porte la
// préférence sombre, comme CalendarPage.
import { useEffect, useState } from 'react'
import { MessagerieApp } from '@/components/crm/messagerie/MessagerieApp'
import { CRM_DARK_KEY, readCrmDark } from '@/lib/crmDark'

function useDarkPref(): [boolean, (v: boolean) => void] {
  const [dark, setDark] = useState<boolean>(() => (typeof window === 'undefined' ? false : readCrmDark()))
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(CRM_DARK_KEY, dark ? '1' : '0')
  }, [dark])
  return [dark, setDark]
}

export default function MessageriePage() {
  const [dark, setDark] = useDarkPref()
  return <MessagerieApp dark={dark} setDark={setDark} />
}
```

```tsx
// src/components/crm/messagerie/MessagerieApp.tsx
// Orchestrateur de l'écran : chrome CRM (CrmTopNav + CrmIconRail, copie de
// CalendarApp:456-505) puis le bento 296px | 1fr de la maquette (README §« Écrans »).
// Les trois zones (rail, liste, lecture) et les modales arrivent aux tâches 2.4-2.11 ;
// cette version monte le cadre et l'état, avec un état vide honnête.
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CrmTopNav, type CrmScreenId } from '@/components/crm/CrmShell'
import { CrmIconRail } from '@/components/crm/LiquidGlassRail'
import { crmPalette } from '@/components/crm/tokens'
import EtatVide from '@/components/crm/EtatVide' // ⚠ export DEFAULT (corrigé le 04.09.2026)
import { useMailAccounts } from '@/hooks/useMailAccounts'
import { mailReducer, initialMailState } from './mailState'
import { mailSurfaces } from './mailTokens'

interface Props { dark: boolean; setDark: (v: boolean) => void }

export function MessagerieApp({ dark, setDark }: Props) {
  const { t } = useTranslation('messages')
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const sp = useMemo(() => crmPalette(dark), [dark])
  const ms = useMemo(() => mailSurfaces(sp, dark), [sp, dark])
  const accounts = useMailAccounts()
  const [state, dispatch] = useReducer(mailReducer, null, () => initialMailState(null))

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
            {/* Rail (T2.4) */}
            <aside style={{ padding: 'var(--crm-space-7xl) var(--crm-space-6xl)', borderRight: `1px solid ${ms.bord2}`, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-7xl)', overflowY: 'auto', minHeight: 0 }} />
            {/* Liste / lecture (T2.5, T2.6) */}
            <section style={{ minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              {accounts.isLoading ? null : accounts.list.length === 0 ? (
                <div style={{ margin: 'auto' }}>
                  <EtatVide dark={dark} registre="aFaire" titre={t('mail.empty.noAccount.title')} corps={t('mail.empty.noAccount.body')}
                    action={{ libelle: t('mail.add.cta'), onClick: () => dispatch({ type: 'modal', modal: { kind: 'add-account', step: 'list' } }) }} />
                </div>
              ) : null}
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
```

⚠ Vérifier les props réelles de `CrmTopNav` (`CrmShell.tsx:70-83`) et de `CrmIconRail` (`LiquidGlassRail.tsx:304-322`) : les noms ci-dessus (`active`, `sp`, `dark`, `setDark`, `onNavigate`, `helpKey`) viennent du relevé du 03.09.2026 ; si `setDark` n'est pas une prop du rail, il porte le bouton sombre par `onCmd` ou un autre nom — copier **exactement** `CalendarApp.tsx:464-467`.

- [ ] **Step 5 : Routes**

`src/App.tsx` : près de `:126`
```ts
const MessageriePage = lazy(() => import('@/pages/agent/MessageriePage'))
const MobileMessagerieScreen = lazy(() => import('@/components/crm-mobile/messagerie/MobileMessagerieScreen'))
const MailOAuthCallbackPage = lazy(() => import('@/pages/agent/MailOAuthCallbackPage'))
const MessagerieShowcasePage = lazy(() => import('@/pages/dev/MessagerieShowcasePage'))
```
dans le bloc `/dashboard`, après la route `calendar` :
```tsx
<Route path="messagerie" element={<ResponsiveRoute desktop={<MessageriePage />} mobile={<MobileMessagerieScreen />} />} />
```
au niveau des routes racine, à côté de `/auth/callback` :
```tsx
<Route path="/oauth/mail/callback" element={<ProtectedRoute><MailOAuthCallbackPage /></ProtectedRoute>} />
```
et dans le bloc `/dev/*` :
```tsx
<Route path="/dev/messagerie" element={<MessagerieShowcasePage />} />
```
⛔ **La déclaration du banc passe par le TERNAIRE, jamais par un `lazy()` nu** :
`dev-bancs-frontiere.spec.ts` énumère `src/pages/dev` depuis l'arbre et exige que tout banc
routé soit gelé — un `lazy()` nu émet un chunk et sert le banc sur `app.megga.ch`.
```ts
const MessagerieShowcasePage = import.meta.env.DEV
  ? lazy(() => import('@/pages/dev/MessagerieShowcasePage'))
  : () => null
```
Tant que T2.9 n'a pas écrit `MailOAuthCallbackPage` et T2.14 le mobile, créer les deux fichiers comme composants vides `export default function X() { return null }` — ils sont remplacés dans leurs tâches.

- [ ] **Step 6 : Clés i18n minimales (les autres arrivent avec chaque composant, T2.12 les consolide)**

`fr/messages.json`, ajouter la sous-arborescence :
```json
"mail": {
  "empty": {
    "noAccount": { "title": "Aucune boîte connectée", "body": "Connectez la boîte de l'agence ou la vôtre pour lire et répondre ici." },
    "noMessage": "Aucun message ne correspond."
  },
  "add": { "cta": "Ajouter une boîte" }
}
```
`en` : "No mailbox connected" / "Connect the agency mailbox or your own to read and reply here." / "No message matches." / "Add a mailbox" — `de` : "Kein Postfach verbunden" / "Verbinden Sie das Postfach der Agentur oder Ihr eigenes, um hier zu lesen und zu antworten." / "Keine Nachricht entspricht der Suche." / "Postfach hinzufügen" — `it` : "Nessuna casella collegata" / "Collega la casella dell'agenzia o la tua per leggere e rispondere qui." / "Nessun messaggio corrisponde." / "Aggiungi una casella".

- [ ] **Step 7 : Banc `/dev/messagerie` (squelette ; les fixtures complètes en T2.13)**

```tsx
// src/pages/dev/MessagerieShowcasePage.tsx
// Banc de l'écran Messagerie : trois états (boîte pleine, boîte vide, aucune boîte),
// sans réseau — les hooks sont remplacés par des fixtures via MailFixturesProvider (T2.13).
import { useState } from 'react'
import { MessagerieApp } from '@/components/crm/messagerie/MessagerieApp'
import { MailFixturesProvider, type MailFixtureState } from '@/components/crm/messagerie/fixtures'

export default function MessagerieShowcasePage() {
  const [dark, setDark] = useState(false)
  const [state, setState] = useState<MailFixtureState>('full')
  return (
    <MailFixturesProvider state={state}>
      <div style={{ position: 'fixed', top: 8, right: 8, zIndex: 400, display: 'flex', gap: 'var(--crm-space-sm)' }}>
        {(['full', 'empty', 'none'] as MailFixtureState[]).map((s) => (
          <button key={s} onClick={() => setState(s)} style={{ fontWeight: s === state ? 700 : 400 }}>{s}</button>
        ))}
      </div>
      <MessagerieApp dark={dark} setDark={setDark} />
    </MailFixturesProvider>
  )
}
```
(`fixtures.tsx` avec un `MailFixturesProvider` qui rend `state` par contexte est écrit en T2.13 ; d'ici là, créer le fichier avec le provider vide : `export type MailFixtureState = 'full'|'empty'|'none'; export const MailFixturesContext = createContext<MailFixtureState|null>(null); export function MailFixturesProvider({state, children}) { return <MailFixturesContext.Provider value={state}>{children}</MailFixturesContext.Provider> }`.)

- [ ] **Step 8 : Build, lint, commit**

```bash
npm run build && npm run lint:i18n && npm run i18n:parity:ci
git add -A
git commit -m "feat(messagerie): onglet, route, page, bento 296px et état d'écran"
```

⚠ **`tests/unit/visual-baseline-fraicheur.spec.ts` ROUGIT, et c'est attendu** : le
`case 'messagerie'` ajouté à `PipelinePage.tsx` change l'empreinte de l'écran photographié,
même sans déplacer un pixel (la garde est conservatrice par écrit). ⛔ Ne PAS éditer
`empreintes.json` à la main : l'empreinte et l'image doivent voyager ensemble, et les
séparer est exactement le faux-vert que cette garde existe pour empêcher. La reprise est
`/regenerate-visual-baselines` en commentaire de PR.

---

### Task 2.2 : Bibliothèque pure — format, sanitisation, pop-up (avec tests)

**Files:**
- Create: `src/lib/mail/format.ts`, `src/lib/mail/sanitize.ts`, `src/lib/mail/oauthPopup.ts`
- Test: `tests/unit/mail-format.spec.ts`, `tests/unit/mail-sanitize.spec.ts`, `tests/unit/mail-oauth-popup.spec.ts`
- Modify: `package.json`

- [ ] **Step 1 : Dépendance**

```bash
npm install dompurify@3
```

⛔ **PAS de `@types/dompurify`** (corrigé le 04.09.2026) : depuis la 3.0.6, dompurify livre
ses propres définitions (`dist/purify.es.d.mts`, `exports['.'].import.types`), et le paquet
DefinitelyTyped n'est plus qu'un **stub déprécié** qui dit lui-même de ne pas l'installer.
⚠ La dépendance était déjà là en TRANSITIF (par `posthog-js`, en 3.3.3) : la déclarer la
fige à notre compte — sans quoi une montée de version d'un paquet tiers changerait le
comportement du rendu des mails. `npm install` l'a portée à **3.4.14** pour tout le dépôt.

- [ ] **Step 2 : Tests (rouges)**

```ts
// tests/unit/mail-format.spec.ts
import { describe, it, expect } from 'vitest'
import { mailDateLabel, initialsOf, displayAddress } from '@/lib/mail/format'

const NOW = new Date('2026-09-03T14:00:00+02:00')
describe('mailDateLabel (maquette : 08:29 · Hier · 23.08)', () => {
  it('aujourd hui = heure, hier = Hier, sinon JJ.MM', () => {
    expect(mailDateLabel('2026-09-03T06:29:00Z', NOW, 'fr')).toBe('08:29')
    expect(mailDateLabel('2026-09-02T18:00:00Z', NOW, 'fr')).toBe('Hier')
    expect(mailDateLabel('2026-08-23T18:00:00Z', NOW, 'fr')).toBe('23.08')
    expect(mailDateLabel('2026-09-02T18:00:00Z', NOW, 'de')).toBe('Gestern')
    expect(mailDateLabel('2026-09-02T18:00:00Z', NOW, 'en')).toBe('Yesterday')
    expect(mailDateLabel('2026-09-02T18:00:00Z', NOW, 'it')).toBe('Ieri')
  })
  it('année différente = JJ.MM.AA', () => {
    expect(mailDateLabel('2025-12-24T10:00:00Z', NOW, 'fr')).toBe('24.12.25')
  })
})
describe('initialsOf / displayAddress', () => {
  it('initiales sur nom, sinon sur adresse', () => {
    expect(initialsOf('Zoé Rochat', 'zoe@ex.ch')).toBe('ZR')
    expect(initialsOf(null, 'zoe@ex.ch')).toBe('Z')
    expect(initialsOf('Banque Cantonale de Genève', 'x@bcge.ch')).toBe('BC')
  })
  it('affichage : nom sinon adresse', () => {
    expect(displayAddress({ name: 'Zoé', email: 'zoe@ex.ch' })).toBe('Zoé')
    expect(displayAddress({ name: null, email: 'zoe@ex.ch' })).toBe('zoe@ex.ch')
  })
})
```

```ts
// tests/unit/mail-sanitize.spec.ts
import { describe, it, expect } from 'vitest'
import { sanitizeMailHtml, buildBodySrcdoc } from '@/lib/mail/sanitize'

describe('sanitizeMailHtml', () => {
  it('retire scripts, handlers, iframes, et les images distantes par défaut', () => {
    const out = sanitizeMailHtml('<p onclick="x()">a</p><script>x()</script><iframe src="https://e.x"></iframe><img src="https://t.example/p.gif"><img src="cid:logo">', { remoteImages: false })
    expect(out).not.toContain('<script')
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('<iframe')
    // ⛔ CES DEUX LIGNES SE CONTREDISAIENT (corrigé le 04.09.2026) : l'URL SURVIT dans
    // `data-blocked-src` — c'est elle que « Afficher les images » restaure. Ce qui doit
    // disparaître est l'attribut CHARGEABLE. ⚠ Et la borne ne peut pas être `src="` nu :
    // `data-blocked-src="` le contient littéralement.
    expect(out).not.toMatch(/\ssrc="https?:/)
    expect(out).toContain('data-blocked-src="https://t.example/p.gif"')
  })
  it('garde les images distantes quand on les a demandées', () => {
    expect(sanitizeMailHtml('<img src="https://t.example/p.gif">', { remoteImages: true })).toContain('src="https://t.example/p.gif"')
  })
  it('les liens s ouvrent hors de l app, sans opener', () => {
    const out = sanitizeMailHtml('<a href="https://ex.ch">x</a>', { remoteImages: false })
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
  })
})
describe('buildBodySrcdoc', () => {
  it('porte une CSP qui interdit script et connexions, et la typographie de la maquette', () => {
    const doc = buildBodySrcdoc('<p>x</p>', { ink: '#111', font: 'Inter Tight', remoteImages: false })
    expect(doc).toContain("default-src 'none'")
    expect(doc).toContain("img-src data: cid:")
    expect(doc).toContain('line-height:1.75')
  })
})
```

```ts
// tests/unit/mail-oauth-popup.spec.ts
import { describe, it, expect } from 'vitest'
import { isOAuthReply, POPUP_FEATURES } from '@/lib/mail/oauthPopup'

describe('isOAuthReply', () => {
  const origin = 'https://app.megga.ch'
  it('accepte seulement notre origine, notre type et le state attendu', () => {
    const ok = { origin, data: { type: 'megga:mail-oauth', code: 'c', state: 's1' } }
    expect(isOAuthReply(ok, origin, 's1')).toBe(true)
    expect(isOAuthReply({ ...ok, origin: 'https://evil.example' }, origin, 's1')).toBe(false)
    expect(isOAuthReply({ origin, data: { type: 'other', code: 'c', state: 's1' } }, origin, 's1')).toBe(false)
    expect(isOAuthReply({ origin, data: { type: 'megga:mail-oauth', code: 'c', state: 'zz' } }, origin, 's1')).toBe(false)
    expect(isOAuthReply({ origin, data: 'string' }, origin, 's1')).toBe(false)
  })
  it('la pop-up a la taille de la maquette (520×680) et est une vraie pop-up', () => {
    expect(POPUP_FEATURES).toContain('width=520')
    expect(POPUP_FEATURES).toContain('height=680')
    expect(POPUP_FEATURES).toContain('popup')
  })
})
```
```bash
npx vitest run tests/unit/mail-format.spec.ts tests/unit/mail-sanitize.spec.ts tests/unit/mail-oauth-popup.spec.ts
```
Attendu : FAIL (modules absents).

- [ ] **Step 3 : Implémentations**

```ts
// src/lib/mail/format.ts
// Formats d'affichage de la Messagerie (README §2 « Date » : '08:29' | 'Hier' | '23.08').
export interface MailAddress { name: string | null; email: string }

const YESTERDAY: Record<string, string> = { fr: 'Hier', de: 'Gestern', en: 'Yesterday', it: 'Ieri' }
const TZ = 'Europe/Zurich'

function ymd(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** Libellé de date d'une ligne de liste, dans le fuseau suisse. */
export function mailDateLabel(iso: string, now: Date = new Date(), lang = 'fr'): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const today = ymd(now)
  const day = ymd(d)
  if (day === today) return new Intl.DateTimeFormat('fr-CH', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  const yesterday = ymd(new Date(now.getTime() - 86_400_000))
  if (day === yesterday) return YESTERDAY[lang] ?? YESTERDAY.fr
  const [y, m, dd] = day.split('-')
  return y === today.slice(0, 4) ? `${dd}.${m}` : `${dd}.${m}.${y.slice(2)}`
}

/** Deux lettres au plus : initiales du nom, sinon première lettre de l'adresse. */
export function initialsOf(name: string | null | undefined, email: string): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase()
  return email.slice(0, 1).toUpperCase()
}

export function displayAddress(a: MailAddress): string {
  return a.name?.trim() || a.email
}

/** Taille lisible d'une pièce jointe (README : « 11px var(--mut) »). */
export function fileSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`
}
```

```ts
// src/lib/mail/sanitize.ts
// Rendu d'un corps HTML reçu (D9) : DOMPurify + iframe sandbox + CSP. Les images
// distantes sont BLOQUÉES par défaut (traqueurs d'ouverture) ; l'agent les affiche
// d'un clic. Les images inline (cid:) et data: passent.
import DOMPurify from 'dompurify'

export interface SanitizeOptions { remoteImages: boolean }

export function sanitizeMailHtml(html: string, opts: SanitizeOptions): string {
  const purifier = DOMPurify()
  purifier.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
    if (node.tagName === 'IMG' && !opts.remoteImages) {
      const src = node.getAttribute('src') ?? ''
      if (/^https?:/i.test(src)) {
        node.setAttribute('data-blocked-src', src)
        node.removeAttribute('src')
      }
    }
  })
  return purifier.sanitize(html, {
    USE_PROFILES: { html: true },
    // `style` (balise et attribut) est GARDÉ : un mail sans ses styles est illisible, et la
    // CSP de l'iframe interdit déjà tout `url()` distant (img-src) et toute feuille externe.
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'meta', 'link', 'base'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    ALLOW_DATA_ATTR: true,
  })
}

export interface SrcdocTheme { ink: string; font: string; remoteImages: boolean }

/** Document complet pour `<iframe sandbox srcdoc>` : CSP fermée, typographie de la maquette. */
export function buildBodySrcdoc(sanitizedHtml: string, theme: SrcdocTheme): string {
  const img = theme.remoteImages ? 'img-src data: cid: https:' : 'img-src data: cid:'
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; ${img}; style-src 'unsafe-inline'; font-src 'none'; connect-src 'none'; script-src 'none'; form-action 'none'">`,
    `<style>html,body{margin:0;padding:0;background:transparent}body{font-family:${theme.font},system-ui,sans-serif;font-size:13px;line-height:1.75;color:${theme.ink};max-width:760px;word-break:break-word}p{margin:14px 0 0}p:first-child{margin-top:0}img{max-width:100%;height:auto}blockquote{margin:12px 0 0 8px;padding-left:12px;border-left:2px solid currentColor;opacity:.75}table{max-width:100%}pre{white-space:pre-wrap}</style>`,
    '</head><body>', sanitizedHtml, '</body></html>',
  ].join('')
}
```

```ts
// src/lib/mail/oauthPopup.ts
// Contrat entre la pop-up de consentement et la fenêtre d'origine (maître §4).
export const OAUTH_REPLY_TYPE = 'megga:mail-oauth'
export const POPUP_NAME = 'megga-mail-oauth'
export const POPUP_FEATURES = 'popup,width=520,height=680,resizable=yes,scrollbars=yes'

export interface OAuthReply { type: typeof OAUTH_REPLY_TYPE; code?: string; state: string; error?: string }

/** Vrai seulement pour un message de NOTRE origine, de NOTRE type, portant le state attendu. */
export function isOAuthReply(ev: { origin: string; data: unknown }, expectedOrigin: string, expectedState: string): ev is { origin: string; data: OAuthReply } {
  if (ev.origin !== expectedOrigin) return false
  const d = ev.data as Partial<OAuthReply> | null
  return !!d && typeof d === 'object' && d.type === OAUTH_REPLY_TYPE && d.state === expectedState
}

/** Ouvre la pop-up ; null si le navigateur l'a bloquée (repli : navigation pleine page). */
export function openOAuthPopup(url: string): Window | null {
  const w = window.open(url, POPUP_NAME, POPUP_FEATURES)
  return w && !w.closed ? w : null
}
```

- [ ] **Step 4 : Vert, commit**

```bash
npx vitest run tests/unit/mail-format.spec.ts tests/unit/mail-sanitize.spec.ts tests/unit/mail-oauth-popup.spec.ts
git add src/lib/mail tests/unit/mail-format.spec.ts tests/unit/mail-sanitize.spec.ts tests/unit/mail-oauth-popup.spec.ts package.json package-lock.json scripts/check-dead-exports.mjs
git commit -m "feat(messagerie): format de liste, sanitisation HTML (DOMPurify + CSP), contrat de pop-up"
```
Attendu : 10 tests PASS.

⛔ **`lint:email-shell` ROUGIT SUR `sanitize.ts`, et le plan maître ne l'avait vu qu'à
moitié** : sa D10 dit que la porte « n'est pas concernée », mais elle raisonnait sur les
EDGES, alors que la porte scanne aussi `src/` depuis le 15.08.2026 (un `<!DOCTYPE>` y suffit)
— et `buildBodySrcdoc` en écrit un. La reprise n'est PAS `A_MIGRER` (rien à migrer) mais
`HORS_EMAIL`, la liste des documents de `src/` qui ne sont pas des e-mails : ce fichier
enveloppe le HTML de QUELQU'UN D'AUTRE pour l'afficher sans le laisser s'exécuter. Lui
appliquer la coquille MEGGA poserait notre en-tête et un lien de désinscription autour du
message d'un client.

⛔ **UNE BIBLIOTHÈQUE PURE LIVRÉE AVANT SES ÉCRANS NE PASSE PAS `lint:deadcode`** (mesuré le
04.09.2026 : les huit exports signalés). `ts-prune` tourne sur `tsconfig.app.json`, dont
l'`include` vaut `["src"]` : un module que seules les SPECS lisent lui paraît mort. C'est
l'angle mort déjà exempté pour `formatSurface`, et la reprise est la même — huit entrées
dans `ALLOW_SYMBOLS` avec leur motif et la tâche qui les consommera. ⛔ Les retirer au fur
et à mesure : `oauthPopup` dès T2.3, `format` en T2.5, `sanitize` en T2.6.

---

### Task 2.3 : Hooks de données

**Files:**
- Create: `src/lib/mail/invoke.ts`
- Create: `src/hooks/useMailAccounts.ts`, `src/hooks/useMailLabels.ts`, `src/hooks/useMailThreads.ts`, `src/hooks/useMailThread.ts`, `src/hooks/useMailActions.ts`, `src/hooks/useMailSend.ts`, `src/hooks/useMailDrafts.ts`, `src/hooks/useMailRealtime.ts`, `src/hooks/useMailOAuthPopup.ts`, `src/hooks/useMailAttachmentBlob.ts`

- [ ] **Step 0 : Vérifier deux prérequis**

```bash
grep -n "agency_id" src/hooks/useAuth.ts | head -5
grep -n "export const SUPABASE_FUNCTIONS_URL\|export const SUPABASE_PUBLIC_ANON_KEY" src/lib/supabase.ts
grep -n "mail_threads: {" src/types/database.ts
```
Attendu : `useAuth()` expose le profil avec `agency_id` (sinon lire `profiles` par `user.id` dans `useMailLabels`) ; les deux constantes existent ; les types `mail_*` sont dans `database.ts` (régénérés au lot 1).

- [ ] **Step 1 : Appel d'edge uniforme**

```ts
// src/lib/mail/invoke.ts
// Un seul point d'appel des edges de la Messagerie : dépaquette FunctionsHttpError
// pour rendre le `error` du serveur (comme useSendAgentEmail), jamais « non-2xx ».
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type MailEdge = 'mail-oauth' | 'mail-sync' | 'mail-actions' | 'mail-send' | 'mail-attachment'
export interface MailInvokeResult<T> { data: T | null; error: string | null; detail?: string; status: number }

export async function invokeMail<T = Record<string, unknown>>(name: MailEdge, body: Record<string, unknown>): Promise<MailInvokeResult<T>> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body })
  if (!error) return { data: data ?? null, error: null, status: 200 }
  if (error instanceof FunctionsHttpError) {
    const status = error.context?.status ?? 500
    try {
      const j = (await error.context.json()) as { error?: string; detail?: string }
      return { data: null, error: j.error ?? `http_${status}`, detail: j.detail, status }
    } catch {
      return { data: null, error: `http_${status}`, status }
    }
  }
  return { data: null, error: error.message, status: 0 }
}
```

- [ ] **Step 2 : Comptes**

```ts
// src/hooks/useMailAccounts.ts
// Boîtes visibles par l'agent (RLS owner/agency), compteurs non lus par boîte, et
// les gestes de connexion/déconnexion (edge mail-oauth).
import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { invokeMail } from '@/lib/mail/invoke'
import type { Database } from '@/types/database'

export type MailProviderId = Database['public']['Tables']['mail_accounts']['Row']['provider']
export interface MailAccount {
  id: string; agency_id: string; owner_id: string; provider: MailProviderId; email: string
  display_name: string | null; visibility: 'owner' | 'agency'; status: 'active' | 'reauth_required' | 'error' | 'disabled'
  last_sync_at: string | null; last_error: string | null; created_at: string
}
export interface ImapForm {
  email: string; imap_host: string; imap_port: number; smtp_host: string; smtp_port: number
  user: string; password: string; encryption: 'ssl' | 'starttls'; visibility: 'owner' | 'agency'
}

const COLS = 'id, agency_id, owner_id, provider, email, display_name, visibility, status, last_sync_at, last_error, created_at'

export function useMailAccounts() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const list = useQuery({
    queryKey: ['mail', 'accounts'],
    enabled: !!user,
    queryFn: async (): Promise<MailAccount[]> => {
      const { data, error } = await supabase.from('mail_accounts').select(COLS).order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as MailAccount[]
    },
    staleTime: 30_000,
  })
  const unread = useQuery({
    queryKey: ['mail', 'unread'],
    enabled: !!user,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.rpc('mail_unread_counts')
      if (error) throw error
      return Object.fromEntries((data ?? []).map((r: { account_id: string; unread: number }) => [r.account_id, Number(r.unread)]))
    },
    staleTime: 15_000,
  })
  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['mail'] })
  }, [qc])

  const startOAuth = useCallback(async (provider: 'gmail' | 'outlook', opts: { loginHint?: string; visibility: 'owner' | 'agency' }) => {
    return invokeMail<{ url: string; state: string }>('mail-oauth', { action: 'start', provider, origin: window.location.origin, login_hint: opts.loginHint ?? null, visibility: opts.visibility })
  }, [])
  const exchange = useCallback(async (code: string, state: string) => {
    const r = await invokeMail<{ account: MailAccount }>('mail-oauth', { action: 'exchange', code, state })
    if (!r.error) invalidate()
    return r
  }, [invalidate])
  const connectImap = useCallback(async (form: ImapForm) => {
    const r = await invokeMail<{ account: MailAccount }>('mail-oauth', { action: 'connect_imap', ...form })
    if (!r.error) invalidate()
    return r
  }, [invalidate])
  const disconnect = useMutation({
    mutationFn: async (accountId: string) => {
      const r = await invokeMail('mail-oauth', { action: 'disconnect', account_id: accountId })
      if (r.error) throw new Error(r.error)
    },
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: async (a: { accountId: string; display_name?: string; visibility?: 'owner' | 'agency' }) => {
      const r = await invokeMail('mail-oauth', { action: 'update', account_id: a.accountId, display_name: a.display_name, visibility: a.visibility })
      if (r.error) throw new Error(r.error)
    },
    onSuccess: invalidate,
  })

  return { list: list.data ?? [], isLoading: list.isPending, unread: unread.data ?? {}, startOAuth, exchange, connectImap, disconnect, update, invalidate }
}
```

- [ ] **Step 3 : Libellés**

```ts
// src/hooks/useMailLabels.ts
// Libellés de l'agence (D12) : lecture et CRUD directs par PostgREST sous RLS.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface MailLabel { id: string; agency_id: string; name: string; color: string; position: number; is_default: boolean }

export function useMailLabels() {
  const { user, profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['mail', 'labels'],
    enabled: !!user,
    queryFn: async (): Promise<MailLabel[]> => {
      const { data, error } = await supabase.from('mail_labels').select('id, agency_id, name, color, position, is_default').order('position').order('created_at')
      if (error) throw error
      return (data ?? []) as MailLabel[]
    },
    staleTime: 60_000,
  })
  const done = () => { void qc.invalidateQueries({ queryKey: ['mail', 'labels'] }); void qc.invalidateQueries({ queryKey: ['mail', 'threads'] }) }
  const create = useMutation({
    mutationFn: async (a: { name: string; color: string }) => {
      if (!agencyId) throw new Error('no_agency')
      const position = (q.data?.length ?? 0)
      const { error } = await supabase.from('mail_labels').insert({ agency_id: agencyId, name: a.name.trim(), color: a.color, position })
      if (error) throw error
    },
    onSuccess: done,
  })
  const rename = useMutation({
    mutationFn: async (a: { id: string; name: string }) => { const { error } = await supabase.from('mail_labels').update({ name: a.name.trim() }).eq('id', a.id); if (error) throw error },
    onSuccess: done,
  })
  const recolor = useMutation({
    mutationFn: async (a: { id: string; color: string }) => { const { error } = await supabase.from('mail_labels').update({ color: a.color }).eq('id', a.id); if (error) throw error },
    onSuccess: done,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('mail_labels').delete().eq('id', id); if (error) throw error },
    onSuccess: done,
  })
  return { labels: q.data ?? [], isLoading: q.isPending, create, rename, recolor, remove }
}
```

- [ ] **Step 4 : Liste des fils (RPC) + compteurs de dossiers**

```ts
// src/hooks/useMailThreads.ts
// Une page de fils (12) par la RPC mail_list_threads ; les dossiers sont des requêtes (D8).
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MailFolder } from '@/components/crm/messagerie/mailState'

export const MAIL_PER_PAGE = 12
export type { MailAddress } from '@/lib/mail/format'
import type { MailAddress } from '@/lib/mail/format'
export interface MailThreadRow {
  id: string; account_id: string; subject: string | null; snippet: string | null; from_name: string | null; from_email: string | null
  participants: MailAddress[]; last_message_at: string; has_attachments: boolean
  is_read: boolean; is_starred: boolean; is_archived: boolean; is_trashed: boolean
  label_id: string | null; contact_id: string | null; message_count: number; total: number
}
export interface MailThreadFilters { folder: MailFolder; labelId: string | null; q: string; unreadOnly: boolean; attOnly: boolean; page: number }

export const threadsKey = (accountId: string | null, f: MailThreadFilters) => ['mail', 'threads', accountId, f.folder, f.labelId, f.q, f.unreadOnly, f.attOnly, f.page] as const

export function useMailThreads(accountId: string | null, f: MailThreadFilters) {
  const q = useQuery({
    queryKey: threadsKey(accountId, f),
    enabled: !!accountId && f.folder !== 'draft',
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{ rows: MailThreadRow[]; total: number }> => {
      const { data, error } = await supabase.rpc('mail_list_threads', {
        p_account_id: accountId, p_folder: f.folder, p_label_id: f.labelId, p_q: f.q || null,
        p_unread_only: f.unreadOnly, p_att_only: f.attOnly, p_page: f.page, p_per_page: MAIL_PER_PAGE,
      })
      if (error) throw error
      const rows = (data ?? []) as MailThreadRow[]
      return { rows, total: rows.length ? Number(rows[0].total) : 0 }
    },
    staleTime: 10_000,
  })
  return { rows: q.data?.rows ?? [], total: q.data?.total ?? 0, isLoading: q.isPending, isFetching: q.isFetching }
}

export function useMailFolderCounts(accountId: string | null) {
  const q = useQuery({
    queryKey: ['mail', 'folder-counts', accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<MailFolderCounts> => {
      const { data, error } = await supabase.rpc('mail_folder_counts', { p_account_id: accountId })
      if (error) throw error
      const r = data?.[0] ?? { inbox_unread: 0, archived: 0, drafts: 0, label_counts: {} }
      return { inbox_unread: Number(r.inbox_unread), archived: Number(r.archived), drafts: Number(r.drafts), label_counts: (r.label_counts ?? {}) as Record<string, number> }
    },
    staleTime: 15_000,
  })
  return q.data ?? { inbox_unread: 0, archived: 0, drafts: 0, label_counts: {} }
}
export interface MailFolderCounts { inbox_unread: number; archived: number; drafts: number; label_counts: Record<string, number> }
```

- [ ] **Step 5 : Un fil (messages + pièces)**

```ts
// src/hooks/useMailThread.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MailAddress } from '@/hooks/useMailThreads'

export interface MailAttachmentRow { id: string; message_id: string; filename: string; mime_type: string; size_bytes: number; is_inline: boolean; content_id: string | null; document_id: string | null }
export interface MailMessageRow {
  id: string; thread_id: string; direction: 'inbound' | 'outbound'; from_name: string | null; from_email: string | null
  to: MailAddress[]; cc: MailAddress[]; subject: string | null; snippet: string | null; body_text: string | null; body_html: string | null
  body_truncated: boolean; sent_at: string; is_read: boolean; has_attachments: boolean; contact_id: string | null
  mail_attachments: MailAttachmentRow[]
}

export function useMailThread(threadId: string | null) {
  return useQuery({
    queryKey: ['mail', 'thread', threadId],
    enabled: !!threadId,
    queryFn: async (): Promise<MailMessageRow[]> => {
      const { data, error } = await supabase.from('mail_messages')
        .select('id, thread_id, direction, from_name, from_email, to, cc, subject, snippet, body_text, body_html, body_truncated, sent_at, is_read, has_attachments, contact_id, mail_attachments(id, message_id, filename, mime_type, size_bytes, is_inline, content_id, document_id)')
        .eq('thread_id', threadId).order('sent_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as MailMessageRow[]
    },
    staleTime: 10_000,
  })
}
```

- [ ] **Step 6 : Gestes optimistes**

```ts
// src/hooks/useMailActions.ts
// Gestes sur un fil : l'écran change tout de suite, l'edge répercute chez le fournisseur ;
// un refus rétablit l'état et remonte l'erreur (maître §4 « Flux d'actions »).
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { invokeMail } from '@/lib/mail/invoke'
import type { MailThreadRow } from '@/hooks/useMailThreads'

export type MailThreadAction = 'mark_read' | 'mark_unread' | 'star' | 'unstar' | 'archive' | 'unarchive' | 'trash' | 'untrash'
const PATCH: Record<MailThreadAction, Partial<MailThreadRow>> = {
  mark_read: { is_read: true }, mark_unread: { is_read: false }, star: { is_starred: true }, unstar: { is_starred: false },
  archive: { is_archived: true }, unarchive: { is_archived: false }, trash: { is_trashed: true }, untrash: { is_trashed: false, is_archived: false },
}

export function useMailActions(accountId: string | null) {
  const qc = useQueryClient()
  const patchCaches = (threadId: string, patch: Partial<MailThreadRow>) => {
    qc.setQueriesData<{ rows: MailThreadRow[]; total: number }>({ queryKey: ['mail', 'threads', accountId] }, (old) =>
      old ? { ...old, rows: old.rows.map((r) => (r.id === threadId ? { ...r, ...patch } : r)) } : old)
  }
  const settle = () => {
    void qc.invalidateQueries({ queryKey: ['mail', 'threads', accountId] })
    void qc.invalidateQueries({ queryKey: ['mail', 'unread'] })
    void qc.invalidateQueries({ queryKey: ['mail', 'folder-counts', accountId] })
  }

  const act = useMutation({
    mutationFn: async (a: { action: MailThreadAction; threadId: string }) => {
      const r = await invokeMail('mail-actions', { action: a.action, account_id: accountId, thread_id: a.threadId })
      if (r.error) throw new Error(r.detail ? `${r.error}: ${r.detail}` : r.error)
    },
    onMutate: async (a) => {
      await qc.cancelQueries({ queryKey: ['mail', 'threads', accountId] })
      const snapshot = qc.getQueriesData<{ rows: MailThreadRow[]; total: number }>({ queryKey: ['mail', 'threads', accountId] })
      patchCaches(a.threadId, PATCH[a.action])
      return { snapshot }
    },
    onError: (_e, _a, ctx) => { for (const [key, data] of ctx?.snapshot ?? []) qc.setQueryData(key, data) },
    onSettled: settle,
  })

  const setLabel = useMutation({
    mutationFn: async (a: { threadId: string; labelId: string | null }) => {
      const { error } = await supabase.from('mail_threads').update({ label_id: a.labelId }).eq('id', a.threadId)
      if (error) throw error
    },
    onMutate: async (a) => { patchCaches(a.threadId, { label_id: a.labelId }) },
    onSettled: settle,
  })

  const linkContact = useMutation({
    mutationFn: async (a: { threadId: string; contactId: string; email: string }) => {
      const r = await invokeMail('mail-actions', { action: 'link_contact', account_id: accountId, thread_id: a.threadId, contact_id: a.contactId, email: a.email })
      if (r.error) throw new Error(r.error)
    },
    onSuccess: (_d, a) => { patchCaches(a.threadId, { contact_id: a.contactId }); void qc.invalidateQueries({ queryKey: ['mail', 'thread', a.threadId] }) },
  })

  const syncNow = useMutation({
    mutationFn: async () => { const r = await invokeMail('mail-actions', { action: 'sync_now', account_id: accountId }); if (r.error) throw new Error(r.error) },
    onSettled: settle,
  })

  return { act, setLabel, linkContact, syncNow }
}
```

- [ ] **Step 7 : Envoi, brouillons, Realtime, pièces, pop-up**

```ts
// src/hooks/useMailSend.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invokeMail } from '@/lib/mail/invoke'
import type { MailAddress } from '@/hooks/useMailThreads'

export interface MailSendInput {
  kind: 'new' | 'reply' | 'forward'
  to: MailAddress[]; cc?: MailAddress[]; bcc?: MailAddress[]
  subject?: string; body_text: string
  in_reply_to_message_id?: string
  attachments?: { filename: string; mime_type: string; base64: string }[]
  draft_id?: string
}
export function useMailSend(accountId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: MailSendInput) => {
      const r = await invokeMail<{ ok: true; message_id: string | null; thread_id: string | null }>('mail-send', { account_id: accountId, ...input })
      if (r.error) throw new Error(r.detail ? `${r.error}: ${r.detail}` : r.error)
      return r.data!
    },
    onSuccess: (d) => {
      void qc.invalidateQueries({ queryKey: ['mail', 'threads', accountId] })
      void qc.invalidateQueries({ queryKey: ['mail', 'folder-counts', accountId] })
      if (d.thread_id) void qc.invalidateQueries({ queryKey: ['mail', 'thread', d.thread_id] })
      void qc.invalidateQueries({ queryKey: ['mail', 'drafts', accountId] })
    },
  })
}
```

```ts
// src/hooks/useMailDrafts.ts
// Brouillons locaux (D7) : une ligne par composition non envoyée, auteur seul (RLS).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { MailAddress } from '@/hooks/useMailThreads'

export interface MailDraft {
  id: string; account_id: string; kind: 'new' | 'reply' | 'forward'; thread_id: string | null; in_reply_to_message_id: string | null
  to: MailAddress[]; cc: MailAddress[]; subject: string | null; body_text: string | null; attachments: { name: string; size: number; storage_path: string }[]; updated_at: string
}
export function useMailDrafts(accountId: string | null) {
  const { user, profile } = useAuth()
  const qc = useQueryClient()
  const list = useQuery({
    queryKey: ['mail', 'drafts', accountId],
    enabled: !!user && !!accountId,
    queryFn: async (): Promise<MailDraft[]> => {
      const { data, error } = await supabase.from('mail_drafts').select('*').eq('account_id', accountId).order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as MailDraft[]
    },
  })
  const done = () => { void qc.invalidateQueries({ queryKey: ['mail', 'drafts', accountId] }); void qc.invalidateQueries({ queryKey: ['mail', 'folder-counts', accountId] }) }
  const save = useMutation({
    mutationFn: async (d: Partial<MailDraft> & { id?: string }) => {
      if (!accountId || !user || !profile?.agency_id) throw new Error('no_account')
      const row = { account_id: accountId, agency_id: profile.agency_id, author_id: user.id, kind: d.kind ?? 'new', thread_id: d.thread_id ?? null,
        in_reply_to_message_id: d.in_reply_to_message_id ?? null, to: d.to ?? [], cc: d.cc ?? [], subject: d.subject ?? null, body_text: d.body_text ?? null, attachments: d.attachments ?? [] }
      const q = d.id ? supabase.from('mail_drafts').update(row).eq('id', d.id).select('id').single() : supabase.from('mail_drafts').insert(row).select('id').single()
      const { data, error } = await q
      if (error) throw error
      return data.id as string
    },
    onSuccess: done,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('mail_drafts').delete().eq('id', id); if (error) throw error },
    onSuccess: done,
  })
  return { drafts: list.data ?? [], isLoading: list.isPending, save, remove }
}
```

```ts
// src/hooks/useMailRealtime.ts
// Un fil change (synchro, geste d'un collègue) → on invalide. useId() pour le nom du canal
// (CLAUDE.md §4, pattern Realtime obligatoire).
import { useEffect, useId } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useMailRealtime(agencyId: string | null) {
  const qc = useQueryClient()
  const channelId = useId()
  useEffect(() => {
    if (!agencyId) return
    const channel = supabase
      .channel(`mail-threads-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mail_threads', filter: `agency_id=eq.${agencyId}` }, () => {
        void qc.invalidateQueries({ queryKey: ['mail', 'threads'] })
        void qc.invalidateQueries({ queryKey: ['mail', 'unread'] })
        void qc.invalidateQueries({ queryKey: ['mail', 'folder-counts'] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [agencyId, channelId, qc])
}
```

```ts
// src/hooks/useMailAttachmentBlob.ts
// Une pièce n'a pas d'URL publique : on la lit par l'edge avec le JWT, en blob local.
import { useEffect, useState } from 'react'
import { supabase, SUPABASE_FUNCTIONS_URL, SUPABASE_PUBLIC_ANON_KEY } from '@/lib/supabase'

export function useMailAttachmentBlob(attachmentId: string | null) {
  const [state, setState] = useState<{ url: string | null; error: string | null; loading: boolean }>({ url: null, error: null, loading: !!attachmentId })
  useEffect(() => {
    if (!attachmentId) return
    let url: string | null = null
    let cancelled = false
    ;(async () => {
      setState({ url: null, error: null, loading: true })
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setState({ url: null, error: 'no_session', loading: false }); return }
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/mail-attachment?id=${encodeURIComponent(attachmentId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_PUBLIC_ANON_KEY },
      })
      if (cancelled) return
      if (!res.ok) { setState({ url: null, error: `http_${res.status}`, loading: false }); return }
      url = URL.createObjectURL(await res.blob())
      setState({ url, error: null, loading: false })
    })()
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [attachmentId])
  return state
}
```

```ts
// src/hooks/useMailOAuthPopup.ts
// La pop-up de consentement (D1, maître §4) : start → window.open → postMessage → exchange.
// Pop-up bloquée ⇒ navigation pleine page ; la page de retour fait l'échange elle-même.
import { useCallback, useRef } from 'react'
import { useMailAccounts, type MailAccount } from '@/hooks/useMailAccounts'
import { isOAuthReply, openOAuthPopup } from '@/lib/mail/oauthPopup'

const TIMEOUT_MS = 5 * 60_000
export type OAuthOutcome = { ok: true; account: MailAccount } | { ok: false; error: string; detail?: string }

export function useMailOAuthPopup() {
  const { startOAuth, exchange } = useMailAccounts()
  const active = useRef<Window | null>(null)

  const connect = useCallback(async (provider: 'gmail' | 'outlook', opts: { loginHint?: string; visibility: 'owner' | 'agency' }): Promise<OAuthOutcome> => {
    const start = await startOAuth(provider, opts)
    if (start.error || !start.data) return { ok: false, error: start.error ?? 'start_failed', detail: start.detail }
    const { url, state } = start.data
    const popup = openOAuthPopup(url)
    if (!popup) {
      // Bloquée : on quitte la page ; MailOAuthCallbackPage reprendra sans opener.
      window.location.assign(url)
      return { ok: false, error: 'popup_blocked' }
    }
    active.current = popup
    const origin = window.location.origin
    const reply = await new Promise<{ code?: string; error?: string } | 'closed' | 'timeout'>((resolve) => {
      const onMsg = (ev: MessageEvent) => { if (isOAuthReply(ev, origin, state)) { cleanup(); resolve({ code: ev.data.code, error: ev.data.error }) } }
      const poll = window.setInterval(() => { if (popup.closed) { cleanup(); resolve('closed') } }, 500)
      const timer = window.setTimeout(() => { cleanup(); resolve('timeout') }, TIMEOUT_MS)
      const cleanup = () => { window.removeEventListener('message', onMsg); window.clearInterval(poll); window.clearTimeout(timer) }
      window.addEventListener('message', onMsg)
    })
    active.current = null
    if (reply === 'closed') return { ok: false, error: 'cancelled' }
    if (reply === 'timeout') return { ok: false, error: 'timeout' }
    if (reply.error || !reply.code) return { ok: false, error: reply.error ?? 'denied' }
    const ex = await exchange(reply.code, state)
    if (ex.error || !ex.data) return { ok: false, error: ex.error ?? 'exchange_failed', detail: ex.detail }
    return { ok: true, account: ex.data.account }
  }, [exchange, startOAuth])

  const cancel = useCallback(() => { active.current?.close(); active.current = null }, [])
  return { connect, cancel }
}
```

- [ ] **Step 8 : Build, lint, commit**

```bash
npm run build && npm run lint
git add src/lib/mail/invoke.ts src/hooks/useMail*.ts
git commit -m "feat(messagerie): hooks comptes, libellés, fils, gestes optimistes, envoi, brouillons, Realtime, pop-up"
```

---

### Task 2.4 : Le rail — sélecteur de boîte, « Nouveau message », dossiers, libellés, créateur

**Files:**
- Create: `src/components/crm/messagerie/MailModalShell.tsx`
- Create: `src/components/crm/messagerie/MailBoxSelector.tsx`, `MailRail.tsx`, `MailLabelCreator.tsx`, `MailLabelMenu.tsx`
- Modify: `src/components/crm/messagerie/MessagerieApp.tsx`

Dimensions : README §1 a-d. Rappel de transposition : `--elev`→`ms.elev`, `--hover`→`ms.hover`, `--hover2`→`ms.hover2`, `--bord`→`ms.bord`, `--mut`→`ms.mut`, `--txt3/4`→`ms.txt3`, accent→`ms.accent`/`ms.accentInk`, 10-11 px→`--crm-text-xs`, 12-12.5→`sm`, 13-13.5→`md`, rayons 13-16→`--crm-radius-xl`, 999→`PILL`.

- [ ] **Step 1 : La coquille de modale (réutilisée par les 7 modales)**

```tsx
// src/components/crm/messagerie/MailModalShell.tsx
// Une modale = portail sur document.body + voile assombrissant + carte + piège de focus +
// Escape (modèle WhatsAppConnectModal.tsx:70-101). z-index 300 par défaut (règle 3 du lot).
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { crmVoileAssombrissant } from '@/components/crm/tokens'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { MailSurfaces } from './mailTokens'

interface Props {
  ms: MailSurfaces
  open: boolean
  onClose: () => void
  width: number
  ariaLabel: string
  zIndex?: number
  /** opacité du voile (README : .12 / .14 / .28 selon la modale) */
  veil?: number
  blur?: number
  children: ReactNode
  /** colonne (la liste défile seule) — modale « Rapprocher » */
  column?: boolean
}

export function MailModalShell({ ms, open, onClose, width, ariaLabel, zIndex = 300, veil = 0.4, blur = 6, children, column }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, open)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex, display: 'grid', placeItems: 'center', padding: 'var(--crm-space-7xl)', background: crmVoileAssombrissant(veil), backdropFilter: `blur(${blur}px)`, WebkitBackdropFilter: `blur(${blur}px)` }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={ariaLabel} onClick={(e) => e.stopPropagation()}
        style={{ width: `min(${width}px, 100%)`, maxHeight: '100%', overflowY: column ? 'hidden' : 'auto', display: column ? 'flex' : 'block', flexDirection: 'column',
          background: ms.card, border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-6xl)', boxShadow: ms.solidShadow, padding: 'var(--crm-space-7xl) var(--crm-space-7xl)', color: ms.ink, fontFamily: 'var(--crm-font)' }}>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** Bouton rond de fermeture (32 px, fond `--elev`) commun aux modales. */
export function MailCloseButton({ ms, onClick, label }: { ms: MailSurfaces; onClick: () => void; label: string }) {
  return (
    <button type="button" aria-label={label} onClick={onClick}
      style={{ width: 32, height: 32, borderRadius: '50%', background: ms.elev, border: `1px solid ${ms.bord}`, color: ms.ink, cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-lg)', lineHeight: 1 }}>
      ×
    </button>
  )
}
```
(⚠ `useFocusTrap(ref, active)` : vérifier la signature dans `src/hooks/useFocusTrap.ts` et s'y conformer.)

- [ ] **Step 2 : Sélecteur de boîte**

```tsx
// src/components/crm/messagerie/MailBoxSelector.tsx — README §1a.
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { MEIcon } from '@/components/propertyx/MEIcon'
import type { MailAccount } from '@/hooks/useMailAccounts'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

interface Props {
  ms: MailSurfaces; accounts: MailAccount[]; unread: Record<string, number>; currentId: string | null
  open: boolean; onToggle: () => void; onClose: () => void; onSelect: (id: string) => void; onAdd: () => void
}
const PROVIDER_LABEL: Record<MailAccount['provider'], string> = { gmail: 'Google Workspace', outlook: 'Outlook / Microsoft 365', imap: 'IMAP' }

export function MailBoxSelector({ ms, accounts, unread, currentId, open, onToggle, onClose, onSelect, onAdd }: Props) {
  const { t } = useTranslation('messages')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onClose])
  const current = accounts.find((a) => a.id === currentId) ?? null
  const desc = (a: MailAccount) => a.status === 'active' ? `${PROVIDER_LABEL[a.provider]} · ${t('mail.box.synced')}` : t(`mail.box.status.${a.status}`)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-md) var(--crm-space-lg)', background: ms.elev, border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-xl)', cursor: 'pointer', color: ms.ink, textAlign: 'left', transition: MAIL_TRANSITION }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = ms.dim }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = ms.bord }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: ms.mut }}>{t('mail.box.label')}</div>
          <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current?.email ?? t('mail.box.none')}</div>
        </div>
        <MEIcon name="chevron-down" size={12} color={ms.mut} />
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 40, background: ms.card, border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-xl)', padding: 'var(--crm-space-2xs)', display: 'flex', flexDirection: 'column', gap: 2, boxShadow: ms.shadow }}>
          {accounts.map((a) => (
            <button key={a.id} type="button" role="menuitem" onClick={() => { onSelect(a.id); onClose() }}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-md) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', background: a.id === currentId ? ms.elev : 'transparent', border: 'none', cursor: 'pointer', color: ms.ink, textAlign: 'left', transition: MAIL_TRANSITION }}
              onMouseEnter={(e) => { e.currentTarget.style.background = ms.hover }} onMouseLeave={(e) => { e.currentTarget.style.background = a.id === currentId ? ms.elev : 'transparent' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.email}</div>
                <div style={{ fontSize: 'var(--crm-text-xs)', color: a.status === 'active' ? ms.mut : ms.danger }}>{desc(a)}</div>
              </div>
              {(unread[a.id] ?? 0) > 0 && (
                <span style={{ borderRadius: PILL, padding: '2px 7px', fontSize: 'var(--crm-text-xs)', fontWeight: 700, background: ms.accent, color: ms.accentInk }}>{unread[a.id]}</span>
              )}
            </button>
          ))}
          <button type="button" role="menuitem" onClick={() => { onAdd(); onClose() }}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', padding: 'var(--crm-space-md) var(--crm-space-lg)', marginTop: 2, borderTop: `1px solid ${ms.bord2}`, background: 'transparent', border: 'none', borderRadius: 0, cursor: 'pointer', color: ms.txt3, fontSize: 'var(--crm-text-xs)', fontWeight: 500, transition: MAIL_TRANSITION }}
            onMouseEnter={(e) => { e.currentTarget.style.color = ms.ink }} onMouseLeave={(e) => { e.currentTarget.style.color = ms.txt3 }}>
            <MEIcon name="plus" size={12} /> {t('mail.add.cta')}
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3 : Créateur de libellé (nom + pastilles + teinte/luminosité + hex)**

```tsx
// src/components/crm/messagerie/MailLabelCreator.tsx — README §1d « Créateur de libellé ».
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MXC_COLOR, MXC_SYSTEM } from '@/components/megga-x-crm/tokens'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'
import type { MailLabel } from '@/hooks/useMailLabels'

const PRESETS = [MXC_SYSTEM.red400, MXC_SYSTEM.blue300, MXC_SYSTEM.yellow400, MXC_SYSTEM.green300, MXC_COLOR.accent, MXC_COLOR.n500]
const LIGHTNESS = [30, 40, 50, 60, 70, 80]

export function hslToHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const f = (n: number) => { const k = (n + h / 30) % 12; const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * c).toString(16).padStart(2, '0') }
  return `#${f(0)}${f(8)}${f(4)}`
}

interface Props { ms: MailSurfaces; initial?: MailLabel | null; onCancel: () => void; onSave: (v: { name: string; color: string }) => void; busy?: boolean }

export function MailLabelCreator({ ms, initial, onCancel, onSave, busy }: Props) {
  const { t } = useTranslation('messages')
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? PRESETS[0])
  const [custom, setCustom] = useState(false)
  const [hue, setHue] = useState(220)
  const [light, setLight] = useState(50)
  useEffect(() => { if (custom) setColor(hslToHex(hue, 85, light)) }, [custom, hue, light])
  const hexOk = useMemo(() => /^#[0-9a-fA-F]{6}$/.test(color), [color])
  const field = { background: ms.elev, border: `1px solid ${ms.bord}`, color: ms.ink, fontFamily: 'inherit', outline: 'none' } as const

  return (
    <div style={{ background: ms.elev, border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-xl)', padding: 'var(--crm-space-md) var(--crm-space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)' }}>
      <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: ms.mut }}>{initial ? t('mail.labels.rename') : t('mail.labels.new')}</div>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={t('mail.labels.namePlaceholder')} autoFocus
        style={{ ...field, borderRadius: PILL, padding: 'var(--crm-space-sm) var(--crm-space-lg)', fontSize: 'var(--crm-text-sm)' }} />
      <div style={{ display: 'flex', gap: 'var(--crm-space-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
        {PRESETS.map((c) => (
          <button key={c} type="button" aria-label={c} onClick={() => { setCustom(false); setColor(c) }}
            style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: `2px solid ${color === c && !custom ? ms.ink : 'transparent'}`, cursor: 'pointer', transition: MAIL_TRANSITION }} />
        ))}
        <button type="button" onClick={() => setCustom((v) => !v)} aria-pressed={custom} title={t('mail.labels.custom')}
          style={{ width: 22, height: 22, borderRadius: '50%', background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)', border: `2px solid ${custom ? ms.ink : 'transparent'}`, cursor: 'pointer' }} />
      </div>
      {custom && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
          <input type="range" min={0} max={360} value={hue} onChange={(e) => setHue(Number(e.target.value))} aria-label={t('mail.labels.hue')}
            style={{ width: '100%', height: 12, borderRadius: 6, appearance: 'none', background: 'linear-gradient(90deg, hsl(0 85% 50%), hsl(60 85% 50%), hsl(120 85% 50%), hsl(180 85% 50%), hsl(240 85% 50%), hsl(300 85% 50%), hsl(360 85% 50%))' }} />
          <div style={{ display: 'flex', gap: 'var(--crm-space-sm)' }}>
            {LIGHTNESS.map((l) => (
              <button key={l} type="button" aria-label={`${l}%`} onClick={() => setLight(l)}
                style={{ flex: 1, height: 18, borderRadius: 'var(--crm-radius-xs)', background: hslToHex(hue, 85, l), border: `2px solid ${light === l ? ms.ink : 'transparent'}`, cursor: 'pointer' }} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)' }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: hexOk ? color : ms.bord }} />
            <input value={color} onChange={(e) => setColor(e.target.value)} maxLength={7} aria-label="hex"
              style={{ ...field, borderRadius: PILL, padding: 'var(--crm-space-xs) var(--crm-space-md)', fontSize: 'var(--crm-text-xs)', letterSpacing: '0.04em', width: 96 }} />
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--crm-space-lg)' }}>
        <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', color: ms.txt3, fontSize: 'var(--crm-text-xs)', cursor: 'pointer', fontFamily: 'inherit' }}>{t('mail.actions.cancel')}</button>
        <button type="button" disabled={!name.trim() || !hexOk || busy} onClick={() => onSave({ name: name.trim(), color })}
          style={{ background: ms.accent, color: ms.accentInk, border: 'none', borderRadius: PILL, padding: 'var(--crm-space-sm) var(--crm-space-2xl)', fontSize: 'var(--crm-text-xs)', fontWeight: 500, cursor: 'pointer', opacity: !name.trim() || !hexOk || busy ? 0.5 : 1, fontFamily: 'inherit' }}>
          {initial ? t('mail.actions.save') : t('mail.labels.create')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4 : Menu contextuel d'un libellé (clic droit)**

```tsx
// src/components/crm/messagerie/MailLabelMenu.tsx — Renommer · Changer la couleur · Supprimer.
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { MAIL_TRANSITION, type MailSurfaces } from './mailTokens'

interface Props { ms: MailSurfaces; x: number; y: number; onClose: () => void; onRename: () => void; onRecolor: () => void; onDelete: () => void }

export function MailLabelMenu({ ms, x, y, onClose, onRename, onRecolor, onDelete }: Props) {
  const { t } = useTranslation('messages')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDoc); document.addEventListener('contextmenu', onDoc); window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('contextmenu', onDoc); window.removeEventListener('keydown', onKey) }
  }, [onClose])
  const item = (label: string, fn: () => void, danger = false) => (
    <button type="button" role="menuitem" onClick={() => { fn(); onClose() }}
      style={{ display: 'block', width: '100%', textAlign: 'left', padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', background: 'transparent', border: 'none', color: danger ? ms.danger : ms.ink, fontSize: 'var(--crm-text-sm)', cursor: 'pointer', fontFamily: 'inherit', transition: MAIL_TRANSITION }}
      onMouseEnter={(e) => { e.currentTarget.style.background = danger ? ms.danger : ms.hover; if (danger) e.currentTarget.style.color = ms.dangerInk }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = danger ? ms.danger : ms.ink }}>
      {label}
    </button>
  )
  return createPortal(
    <div ref={ref} role="menu" style={{ position: 'fixed', left: Math.min(x, window.innerWidth - 220), top: Math.min(y, window.innerHeight - 140), zIndex: 320, minWidth: 200, background: ms.solid, border: `1px solid ${ms.solidBorder}`, borderRadius: 'var(--crm-radius-xl)', boxShadow: ms.solidShadow, padding: 'var(--crm-space-2xs)' }}>
      {item(t('mail.labels.rename'), onRename)}
      {item(t('mail.labels.recolor'), onRecolor)}
      {item(t('mail.labels.delete'), onDelete, true)}
    </div>,
    document.body,
  )
}
```

- [ ] **Step 5 : Le rail**

```tsx
// src/components/crm/messagerie/MailRail.tsx — README §1 (a, b, c, d).
import { useTranslation } from 'react-i18next'
import { MEIcon, type MEIconName } from '@/components/propertyx/MEIcon'
import type { MailAccount } from '@/hooks/useMailAccounts'
import type { MailLabel } from '@/hooks/useMailLabels'
import type { MailFolderCounts } from '@/hooks/useMailThreads'
import type { MailFolder } from './mailState'
import { MailBoxSelector } from './MailBoxSelector'
import { MailLabelCreator } from './MailLabelCreator'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

interface Props {
  ms: MailSurfaces
  accounts: MailAccount[]; unread: Record<string, number>; accountId: string | null
  boxOpen: boolean; onToggleBox: () => void; onCloseBox: () => void; onSelectAccount: (id: string) => void; onAddAccount: () => void
  onCompose: () => void
  folder: MailFolder; onFolder: (f: MailFolder) => void; counts: MailFolderCounts
  labels: MailLabel[]; activeLabelId: string | null; onLabel: (id: string) => void; onLabelContext: (e: React.MouseEvent, id: string) => void
  creatorOpen: boolean; editLabel: MailLabel | null; onOpenCreator: () => void; onCloseCreator: () => void; onSaveLabel: (v: { name: string; color: string }) => void; creatorBusy: boolean
}

const FOLDERS: { key: MailFolder; icon: MEIconName; label: string }[] = [
  { key: 'in', icon: 'inbox', label: 'mail.folders.in' }, { key: 'arch', icon: 'archive', label: 'mail.folders.arch' },
  { key: 'star', icon: 'star', label: 'mail.folders.star' }, { key: 'sent', icon: 'send', label: 'mail.folders.sent' },
  { key: 'draft', icon: 'file-text', label: 'mail.folders.draft' },
]

export function MailRail(p: Props) {
  const { t } = useTranslation('messages')
  const { ms } = p
  const row = (active: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-md) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)',
    fontSize: 'var(--crm-text-md)', fontWeight: 500, color: active ? ms.ink : ms.txt3, cursor: 'pointer', width: '100%', textAlign: 'left' as const,
    background: active ? ms.elev : 'transparent', border: `1px solid ${active ? ms.bord : 'transparent'}`, fontFamily: 'inherit', transition: MAIL_TRANSITION,
  })
  const hover = (active: boolean) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => { if (!active) e.currentTarget.style.background = ms.hover2 },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => { if (!active) e.currentTarget.style.background = 'transparent' },
  })
  const counter = (n: number) => n > 0 ? <span style={{ marginLeft: 'auto', fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{n}</span> : null

  return (
    <>
      <MailBoxSelector ms={ms} accounts={p.accounts} unread={p.unread} currentId={p.accountId} open={p.boxOpen} onToggle={p.onToggleBox} onClose={p.onCloseBox} onSelect={p.onSelectAccount} onAdd={p.onAddAccount} />

      <button type="button" onClick={p.onCompose} disabled={!p.accountId}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-sm)', background: ms.accent, color: ms.accentInk, border: 'none', borderRadius: PILL, padding: 'var(--crm-space-lg) var(--crm-space-4xl)', fontSize: 'var(--crm-text-md)', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: p.accountId ? 1 : 0.5, transition: MAIL_TRANSITION }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.92' }} onMouseLeave={(e) => { e.currentTarget.style.opacity = p.accountId ? '1' : '0.5' }}>
        <MEIcon name="edit" size={14} /> {t('mail.compose.cta')}
      </button>

      <nav aria-label={t('mail.folders.aria')} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
        {FOLDERS.map((f) => {
          const active = p.folder === f.key
          return (
            <button key={f.key} type="button" aria-current={active ? 'page' : undefined} onClick={() => p.onFolder(f.key)} style={row(active)} {...hover(active)}>
              <MEIcon name={f.icon} size={16} />
              <span>{t(f.label)}</span>
              {f.key === 'in' && p.counts.inbox_unread > 0 && (
                <span style={{ marginLeft: 'auto', borderRadius: PILL, padding: '2px 8px', fontSize: 'var(--crm-text-xs)', fontWeight: 700, background: ms.accent, color: ms.accentInk }}>{p.counts.inbox_unread}</span>
              )}
              {f.key === 'arch' && counter(p.counts.archived)}
              {f.key === 'draft' && counter(p.counts.drafts)}
            </button>
          )
        })}
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 var(--crm-space-sm) 0 var(--crm-space-lg)' }}>
          <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: ms.mut }}>{t('mail.labels.title')}</span>
          <button type="button" title={t('mail.labels.new')} onClick={p.onOpenCreator}
            style={{ marginLeft: 'auto', width: 22, height: 22, borderRadius: '50%', background: 'transparent', border: 'none', color: ms.txt3, cursor: 'pointer', display: 'grid', placeItems: 'center', transition: MAIL_TRANSITION }}
            onMouseEnter={(e) => { e.currentTarget.style.background = ms.hover2 }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
            <MEIcon name="plus" size={12} />
          </button>
        </div>
        {p.creatorOpen && !p.editLabel && <MailLabelCreator ms={ms} onCancel={p.onCloseCreator} onSave={p.onSaveLabel} busy={p.creatorBusy} />}
        {p.labels.map((l) => {
          const active = p.activeLabelId === l.id
          if (p.creatorOpen && p.editLabel?.id === l.id) return <MailLabelCreator key={l.id} ms={ms} initial={l} onCancel={p.onCloseCreator} onSave={p.onSaveLabel} busy={p.creatorBusy} />
          return (
            <button key={l.id} type="button" aria-pressed={active} onClick={() => p.onLabel(l.id)} onContextMenu={(e) => { e.preventDefault(); p.onLabelContext(e, l.id) }} style={row(active)} {...hover(active)}>
              <span style={{ width: 9, height: 9, borderRadius: 'var(--crm-radius-2xs)', background: l.color, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
              {counter(p.counts.label_counts[l.id] ?? 0)}
            </button>
          )
        })}
      </div>
    </>
  )
}
```

⚠ Icônes : `inbox`, `archive`, `star`, `send`, `file-text`, `edit`, `plus`, `chevron-down`, `search`, `paperclip`, `reply`, `forward`, `trash`, `chevron-left`, `chevron-right`, `x`, `check`, `maximize` doivent exister dans `MEIconName` (`src/components/propertyx/MEIcon.tsx:12-37`) ou dans `PxIconFontName`. Pour chaque nom absent, l'ajouter à l'union **et** à sa table de chemins/glyphes (jamais un SVG inline dans un composant Messagerie — règle §1 du maître). Vérifier :
```bash
for n in inbox archive star send file-text edit plus chevron-down search paperclip reply forward trash chevron-left chevron-right x check maximize; do grep -q "'$n'" src/components/propertyx/MEIcon.tsx src/components/propertyx/PxIconFont.tsx && echo "ok $n" || echo "MANQUE $n"; done
```

- [ ] **Step 6 : Brancher le rail dans `MessagerieApp`**

Remplacer l'`<aside … />` vide de T2.1 par `<aside …><MailRail … /></aside>` avec, dans `MessagerieApp` :
```ts
const labels = useMailLabels()
const counts = useMailFolderCounts(state.accountId)
const saveLabel = (v: { name: string; color: string }) => {
  const edit = labels.labels.find((l) => l.id === state.editLabelId)
  const done = () => dispatch({ type: 'label-creator', open: false })
  if (edit) { labels.rename.mutate({ id: edit.id, name: v.name }, { onSuccess: () => labels.recolor.mutate({ id: edit.id, color: v.color }, { onSuccess: done }) }) }
  else labels.create.mutate(v, { onSuccess: done })
}
```
et les props : `accounts={accounts.list} unread={accounts.unread} accountId={state.accountId} boxOpen={state.boxOpen} onToggleBox={() => dispatch({ type: 'toggle-box' })} onCloseBox={() => dispatch({ type: 'close-box' })} onSelectAccount={(id) => dispatch({ type: 'select-account', accountId: id })} onAddAccount={() => dispatch({ type: 'modal', modal: { kind: 'add-account', step: 'list' } })} onCompose={() => dispatch({ type: 'modal', modal: { kind: 'compose' } })} folder={state.folder} onFolder={(f) => dispatch({ type: 'folder', folder: f })} counts={counts} labels={labels.labels} activeLabelId={state.labelId} onLabel={(id) => dispatch({ type: 'label', labelId: id })} onLabelContext={(e, id) => dispatch({ type: 'label-ctx', ctx: { x: e.clientX, y: e.clientY, labelId: id } })} creatorOpen={state.labelCreatorOpen} editLabel={labels.labels.find((l) => l.id === state.editLabelId) ?? null} onOpenCreator={() => dispatch({ type: 'label-creator', open: true })} onCloseCreator={() => dispatch({ type: 'label-creator', open: false })} onSaveLabel={saveLabel} creatorBusy={labels.create.isPending || labels.rename.isPending}`

Et le menu de libellé :
```tsx
{state.labelCtx && (
  <MailLabelMenu ms={ms} x={state.labelCtx.x} y={state.labelCtx.y} onClose={() => dispatch({ type: 'label-ctx', ctx: null })}
    onRename={() => dispatch({ type: 'label-creator', open: true, editLabelId: state.labelCtx!.labelId })}
    onRecolor={() => dispatch({ type: 'label-creator', open: true, editLabelId: state.labelCtx!.labelId })}
    onDelete={() => labels.remove.mutate(state.labelCtx!.labelId)} />
)}
```
Appeler aussi `useMailRealtime(profile?.agency_id ?? null)` dans `MessagerieApp` (import `useAuth`).

- [ ] **Step 7 : Clés i18n de cette tâche (FR ; EN/DE/IT en T2.12)**

```json
"box": { "label": "Boîte", "none": "Aucune boîte", "synced": "synchronisée", "disconnect": "Déconnecter", "disconnectConfirm": "Déconnecter cette boîte ? Ses messages seront retirés du CRM ; les documents classés restent.", "status": { "reauth_required": "Autorisation à renouveler", "error": "Erreur de synchronisation", "disabled": "Désactivée" } },
"compose": { "cta": "Nouveau message" },
"folders": { "aria": "Dossiers", "in": "Boîte de réception", "arch": "Archivé", "star": "Suivis", "sent": "Envoyés", "draft": "Brouillons" },
"labels": { "title": "Libellés", "new": "Nouveau libellé", "rename": "Renommer", "recolor": "Changer la couleur", "delete": "Supprimer", "namePlaceholder": "Nom du libellé", "custom": "Couleur personnalisée", "hue": "Teinte", "create": "Créer" },
"actions": { "cancel": "Annuler", "save": "Enregistrer" }
```

- [ ] **Step 8 : Build, lint, commit**

```bash
npm run build && npm run lint && npm run lint:i18n
git add -A
git commit -m "feat(messagerie): rail (sélecteur de boîte, dossiers, libellés, créateur, menu de libellé)"
```

---

### Task 2.5 : La liste — barre d'outils, lignes, pagination, menu contextuel

**Files:**
- Create: `src/components/crm/messagerie/MailList.tsx`, `MailListRow.tsx`, `MailPager.tsx`, `MailContextMenu.tsx`
- Modify: `src/components/crm/messagerie/MessagerieApp.tsx`

Dimensions : README §2. Grille de ligne `26px 185px minmax(0,1fr) 16px 58px`, `gap:10px`, `padding:11px 12px`, `border-bottom:1px solid --bord2`, étoile 15 px (`ms.star` active, `ms.dim` inactive), expéditeur 700/500, pastille de libellé `3px 10px / 10px / 600`, extrait `— …` en `ms.mut`, trombone 13 px, date `ms.txt3` à droite.

- [ ] **Step 1 : Pager (porté d'`AdminPager`, `sp` en prop)**

```tsx
// src/components/crm/messagerie/MailPager.tsx — « 1–12 sur 48 » + chevrons (README §2).
import { useTranslation } from 'react-i18next'
import { MEIcon } from '@/components/propertyx/MEIcon'
import { MAIL_TRANSITION, type MailSurfaces } from './mailTokens'

interface Props { ms: MailSurfaces; page: number; perPage: number; total: number; onPage: (p: number) => void }
export function MailPager({ ms, page, perPage, total, onPage }: Props) {
  const { t } = useTranslation('messages')
  const from = total === 0 ? 0 : page * perPage + 1
  const to = Math.min((page + 1) * perPage, total)
  const last = Math.max(0, Math.ceil(total / perPage) - 1)
  const btn = (dir: 'prev' | 'next', disabled: boolean) => (
    <button type="button" aria-label={t(`mail.pager.${dir}`)} disabled={disabled} onClick={() => onPage(dir === 'prev' ? page - 1 : page + 1)}
      style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', background: 'transparent', border: 'none', color: disabled ? ms.dim : ms.txt3, cursor: disabled ? 'default' : 'pointer', transition: MAIL_TRANSITION }}>
      <MEIcon name={dir === 'prev' ? 'chevron-left' : 'chevron-right'} size={12} />
    </button>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', marginLeft: 'auto' }}>
      <span style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut, fontVariantNumeric: 'tabular-nums' }}>{t('mail.pager.range', { from, to, total })}</span>
      {btn('prev', page <= 0)}
      {btn('next', page >= last)}
    </div>
  )
}
```

- [ ] **Step 2 : Ligne**

```tsx
// src/components/crm/messagerie/MailListRow.tsx — README §2 « Lignes ».
import { useTranslation } from 'react-i18next'
import { MEIcon } from '@/components/propertyx/MEIcon'
import type { MailThreadRow } from '@/hooks/useMailThreads'
import type { MailLabel } from '@/hooks/useMailLabels'
import { displayAddress, mailDateLabel } from '@/lib/mail/format'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

interface Props { ms: MailSurfaces; row: MailThreadRow; label: MailLabel | null; lang: string; onOpen: () => void; onStar: () => void; onContext: (e: React.MouseEvent) => void }

export function MailListRow({ ms, row, label, lang, onOpen, onStar, onContext }: Props) {
  const { t } = useTranslation('messages')
  const weight = row.is_read ? 500 : 700
  const sender = row.from_name || row.from_email || (row.participants[0] ? displayAddress(row.participants[0]) : '')
  return (
    <div role="row" tabIndex={0} onClick={onOpen} onContextMenu={(e) => { e.preventDefault(); onContext(e) }} onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }}
      style={{ display: 'grid', gridTemplateColumns: '26px 185px minmax(0,1fr) 16px 58px', gap: 'var(--crm-space-md)', alignItems: 'center', padding: 'var(--crm-space-md) var(--crm-space-lg)', fontSize: 'var(--crm-text-sm)', borderBottom: `1px solid ${ms.bord2}`, cursor: 'pointer', color: ms.ink, transition: MAIL_TRANSITION }}
      onMouseEnter={(e) => { e.currentTarget.style.background = ms.hover2 }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
      <button type="button" aria-label={row.is_starred ? t('mail.row.unstar') : t('mail.row.star')} aria-pressed={row.is_starred} onClick={(e) => { e.stopPropagation(); onStar() }}
        style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: row.is_starred ? ms.star : ms.dim }}>
        <MEIcon name="star" size={15} color={row.is_starred ? ms.star : ms.dim} />
      </button>
      <span style={{ fontWeight: weight, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sender}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', minWidth: 0 }}>
        {label && <span style={{ borderRadius: PILL, padding: '3px 10px', fontSize: 'var(--crm-text-xs)', fontWeight: 600, background: label.color, color: ms.pillInk(label.color), flexShrink: 0 }}>{label.name}</span>}
        <span style={{ fontWeight: weight, whiteSpace: 'nowrap', flexShrink: 0 }}>{row.subject || t('mail.row.noSubject')}</span>
        {row.snippet && <span style={{ fontSize: 'var(--crm-text-sm)', color: ms.mut, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>— {row.snippet}</span>}
      </span>
      <span style={{ width: 16, display: 'grid', placeItems: 'center' }}>{row.has_attachments && <MEIcon name="paperclip" size={13} color={ms.mut} />}</span>
      <span style={{ fontSize: 'var(--crm-text-xs)', color: ms.txt3, textAlign: 'right', whiteSpace: 'nowrap' }}>{mailDateLabel(row.last_message_at, new Date(), lang)}</span>
    </div>
  )
}
```

- [ ] **Step 3 : Menu contextuel de ligne**

```tsx
// src/components/crm/messagerie/MailContextMenu.tsx — README §2 « Menu contextuel de ligne ».
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { MailThreadRow } from '@/hooks/useMailThreads'
import type { MailLabel } from '@/hooks/useMailLabels'
import type { MailThreadAction } from '@/hooks/useMailActions'
import { MAIL_TRANSITION, type MailSurfaces } from './mailTokens'

interface Props {
  ms: MailSurfaces; x: number; y: number; row: MailThreadRow; labels: MailLabel[]
  onClose: () => void; onOpen: () => void; onAction: (a: MailThreadAction) => void; onDelete: () => void; onLabel: (id: string | null) => void
}
export function MailContextMenu({ ms, x, y, row, labels, onClose, onOpen, onAction, onDelete, onLabel }: Props) {
  const { t } = useTranslation('messages')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDoc); document.addEventListener('contextmenu', onDoc); window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('contextmenu', onDoc); window.removeEventListener('keydown', onKey) }
  }, [onClose])
  const item = (label: string, fn: () => void, opts: { danger?: boolean; dot?: string } = {}) => (
    <button key={label} type="button" role="menuitem" onClick={() => { fn(); onClose() }}
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', width: '100%', textAlign: 'left', padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', background: 'transparent', border: 'none', color: opts.danger ? ms.danger : ms.ink, fontSize: 'var(--crm-text-sm)', cursor: 'pointer', fontFamily: 'inherit', transition: MAIL_TRANSITION }}
      onMouseEnter={(e) => { e.currentTarget.style.background = ms.hover }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
      {opts.dot && <span style={{ width: 9, height: 9, borderRadius: 'var(--crm-radius-2xs)', background: opts.dot }} />}
      {label}
    </button>
  )
  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 319 }} />
      <div ref={ref} role="menu" style={{ position: 'fixed', left: Math.min(x, window.innerWidth - 240), top: Math.min(y, window.innerHeight - 320), zIndex: 320, minWidth: 220, background: ms.solid, border: `1px solid ${ms.solidBorder}`, borderRadius: 'var(--crm-radius-xl)', boxShadow: ms.solidShadow, padding: 'var(--crm-space-2xs)' }}>
        {item(t('mail.ctx.open'), onOpen)}
        {item(row.is_read ? t('mail.ctx.markUnread') : t('mail.ctx.markRead'), () => onAction(row.is_read ? 'mark_unread' : 'mark_read'))}
        {item(row.is_starred ? t('mail.ctx.unstar') : t('mail.ctx.star'), () => onAction(row.is_starred ? 'unstar' : 'star'))}
        {item(row.is_archived ? t('mail.ctx.unarchive') : t('mail.ctx.archive'), () => onAction(row.is_archived ? 'unarchive' : 'archive'))}
        {item(t('mail.ctx.delete'), onDelete, { danger: true })}
        <div style={{ height: 1, background: ms.bord2, margin: 'var(--crm-space-2xs) 0' }} />
        <div style={{ padding: 'var(--crm-space-2xs) var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: ms.mut }}>{t('mail.labels.title')}</div>
        {labels.map((l) => item(l.name, () => onLabel(row.label_id === l.id ? null : l.id), { dot: l.color }))}
      </div>
    </>,
    document.body,
  )
}
```

- [ ] **Step 4 : La liste**

```tsx
// src/components/crm/messagerie/MailList.tsx — README §2 (barre d'outils + lignes + vide).
import { useTranslation } from 'react-i18next'
import { MEIcon } from '@/components/propertyx/MEIcon'
import { MAIL_PER_PAGE, type MailThreadRow } from '@/hooks/useMailThreads'
import type { MailLabel } from '@/hooks/useMailLabels'
import type { MailDraft } from '@/hooks/useMailDrafts'
import { MailListRow } from './MailListRow'
import { MailPager } from './MailPager'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

interface Props {
  ms: MailSurfaces; lang: string
  q: string; onQ: (q: string) => void; unreadOnly: boolean; onUnreadOnly: (v: boolean) => void; attOnly: boolean; onAttOnly: (v: boolean) => void
  page: number; total: number; onPage: (p: number) => void
  rows: MailThreadRow[]; labels: MailLabel[]; isLoading: boolean
  drafts: MailDraft[] | null   // non nul en dossier « Brouillons »
  onOpen: (id: string) => void; onOpenDraft: (id: string) => void; onStar: (row: MailThreadRow) => void; onContext: (e: React.MouseEvent, row: MailThreadRow) => void
}

export function MailList(p: Props) {
  const { t } = useTranslation('messages')
  const { ms } = p
  const chip = (active: boolean, label: string, onClick: () => void) => (
    <button type="button" aria-pressed={active} onClick={onClick}
      style={{ borderRadius: PILL, padding: 'var(--crm-space-sm) var(--crm-space-2xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 500, border: `1px solid ${active ? ms.accent : ms.bord3}`, background: active ? ms.accent : ms.elev, color: active ? ms.accentInk : ms.txt3, cursor: 'pointer', fontFamily: 'inherit', transition: MAIL_TRANSITION }}>
      {label}
    </button>
  )
  const labelOf = (id: string | null) => p.labels.find((l) => l.id === id) ?? null
  return (
    <>
      <div style={{ padding: 'var(--crm-space-4xl) var(--crm-space-7xl) var(--crm-space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', flexWrap: 'wrap' }}>
        <label style={{ flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', background: ms.elev, border: `1px solid ${ms.bord}`, borderRadius: PILL, padding: 'var(--crm-space-md) var(--crm-space-3xl)' }}>
          <MEIcon name="search" size={15} color={ms.mut} />
          <input value={p.q} onChange={(e) => p.onQ(e.target.value)} placeholder={t('mail.list.searchPlaceholder')} aria-label={t('mail.list.search')}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: ms.ink, fontSize: 'var(--crm-text-sm)', fontFamily: 'inherit' }} />
        </label>
        {chip(p.unreadOnly, t('mail.list.unread'), () => p.onUnreadOnly(!p.unreadOnly))}
        {chip(p.attOnly, t('mail.list.attachment'), () => p.onAttOnly(!p.attOnly))}
        <MailPager ms={ms} page={p.page} perPage={MAIL_PER_PAGE} total={p.drafts ? p.drafts.length : p.total} onPage={p.onPage} />
      </div>
      <div className="scrollbar-hide" style={{ padding: '0 var(--crm-space-2xl) var(--crm-space-3xl)', overflowY: 'auto', minHeight: 0, flex: 1 }}>
        {p.drafts ? (
          p.drafts.length === 0 ? <Empty ms={ms} text={t('mail.empty.noMessage')} /> : p.drafts.map((d) => (
            <div key={d.id} role="row" tabIndex={0} onClick={() => p.onOpenDraft(d.id)} onKeyDown={(e) => { if (e.key === 'Enter') p.onOpenDraft(d.id) }}
              style={{ display: 'grid', gridTemplateColumns: '26px 185px minmax(0,1fr) 16px 58px', gap: 'var(--crm-space-md)', alignItems: 'center', padding: 'var(--crm-space-md) var(--crm-space-lg)', fontSize: 'var(--crm-text-sm)', borderBottom: `1px solid ${ms.bord2}`, cursor: 'pointer', color: ms.ink }}>
              <span />
              <span style={{ fontWeight: 500, color: ms.txt3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.to.map((a) => a.email).join(', ') || t('mail.draft.noRecipient')}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><span style={{ fontWeight: 500 }}>{d.subject || t('mail.row.noSubject')}</span> <span style={{ color: ms.mut }}>— {(d.body_text ?? '').slice(0, 120)}</span></span>
              <span />
              <span style={{ fontSize: 'var(--crm-text-xs)', color: ms.txt3, textAlign: 'right' }}>{t('mail.draft.badge')}</span>
            </div>
          ))
        ) : p.isLoading ? null : p.rows.length === 0 ? <Empty ms={ms} text={t('mail.empty.noMessage')} /> : (
          p.rows.map((r) => <MailListRow key={r.id} ms={ms} row={r} label={labelOf(r.label_id)} lang={p.lang} onOpen={() => p.onOpen(r.id)} onStar={() => p.onStar(r)} onContext={(e) => p.onContext(e, r)} />)
        )}
      </div>
    </>
  )
}

function Empty({ ms, text }: { ms: MailSurfaces; text: string }) {
  return <div style={{ padding: 'var(--crm-space-7xl) var(--crm-space-4xl)', textAlign: 'center', fontSize: 'var(--crm-text-sm)', color: ms.mut }}>{text}</div>
}
```

- [ ] **Step 5 : Brancher dans `MessagerieApp`**

Dans la `<section>` principale, quand `state.sel === null` :
```tsx
const filters = { folder: state.folder, labelId: state.labelId, q: state.q, unreadOnly: state.unreadOnly, attOnly: state.attOnly, page: state.page }
const threads = useMailThreads(state.accountId, filters)
const drafts = useMailDrafts(state.accountId)
const actions = useMailActions(state.accountId)
const { i18n } = useTranslation()
// …
<MailList ms={ms} lang={i18n.language.slice(0, 2)} q={state.q} onQ={(q) => dispatch({ type: 'q', q })}
  unreadOnly={state.unreadOnly} onUnreadOnly={(on) => dispatch({ type: 'unread-only', on })} attOnly={state.attOnly} onAttOnly={(on) => dispatch({ type: 'att-only', on })}
  page={state.page} total={threads.total} onPage={(page) => dispatch({ type: 'page', page })}
  rows={threads.rows} labels={labels.labels} isLoading={threads.isLoading}
  drafts={state.folder === 'draft' ? drafts.drafts : null}
  onOpen={(id) => { dispatch({ type: 'open', threadId: id }); const r = threads.rows.find((x) => x.id === id); if (r && !r.is_read) actions.act.mutate({ action: 'mark_read', threadId: id }) }}
  onOpenDraft={(id) => dispatch({ type: 'modal', modal: { kind: 'compose', draftId: id } })}
  onStar={(r) => actions.act.mutate({ action: r.is_starred ? 'unstar' : 'star', threadId: r.id })}
  onContext={(e, r) => dispatch({ type: 'ctx', ctx: { x: e.clientX, y: e.clientY, threadId: r.id } })} />
{state.ctx && (() => { const r = threads.rows.find((x) => x.id === state.ctx!.threadId); return r ? (
  <MailContextMenu ms={ms} x={state.ctx.x} y={state.ctx.y} row={r} labels={labels.labels} onClose={() => dispatch({ type: 'ctx', ctx: null })}
    onOpen={() => dispatch({ type: 'open', threadId: r.id })} onAction={(a) => actions.act.mutate({ action: a, threadId: r.id })}
    onDelete={() => dispatch({ type: 'modal', modal: { kind: 'delete', threadId: r.id } })} onLabel={(id) => actions.setLabel.mutate({ threadId: r.id, labelId: id })} />
) : null })()}
```
La recherche est débouncée à 250 ms dans `MailList` (un `useState` local + `useEffect` avec `setTimeout` avant d'appeler `onQ`) — sinon une RPC par frappe.

- [ ] **Step 6 : Clés i18n FR**

```json
"list": { "search": "Recherche", "searchPlaceholder": "Chercher un expéditeur, un objet ...", "unread": "Non lus", "attachment": "Pièce jointe" },
"pager": { "range": "{{from}}–{{to}} sur {{total}}", "prev": "Page précédente", "next": "Page suivante" },
"row": { "star": "Suivre", "unstar": "Ne plus suivre", "noSubject": "(sans objet)" },
"ctx": { "open": "Ouvrir", "markRead": "Marquer comme lu", "markUnread": "Marquer comme non lu", "star": "Suivre", "unstar": "Ne plus suivre", "archive": "Archiver", "unarchive": "Désarchiver", "delete": "Supprimer" },
"draft": { "badge": "Brouillon", "noRecipient": "(sans destinataire)" }
```
⚠ `lint:prose` refuse le tiret cadratin dans `locales/` : le `–` de `pager.range` est un tiret **demi-cadratin** (U+2013) ; vérifier la règle exacte de `scripts/check-prose-typography.mjs` — si elle le refuse aussi, écrire `"{{from}} à {{to}} sur {{total}}"`.

- [ ] **Step 7 : Build, lint, commit**

```bash
npm run build && npm run lint && npm run lint:i18n && npm run lint:prose
git add -A
git commit -m "feat(messagerie): liste (recherche, chips, pagination 12, lignes, menu contextuel, brouillons)"
```

---

### Task 2.6 : La lecture — bandeau, corps assaini, pièces, réponses, composeurs, barre d'actions

**Files:**
- Create: `src/components/crm/messagerie/MailReader.tsx`, `MailBodyFrame.tsx`, `MailReplyComposer.tsx`, `MailForwardComposer.tsx`
- Create: `src/hooks/useMailContactSearch.ts`
- Modify: `src/components/crm/messagerie/MessagerieApp.tsx`

Dimensions : README §3.

- [ ] **Step 1 : Corps HTML dans une iframe sandbox**

```tsx
// src/components/crm/messagerie/MailBodyFrame.tsx — D9 : DOMPurify + sandbox + CSP.
// `allow-same-origin` (sans `allow-scripts`) sert UNIQUEMENT à mesurer la hauteur ;
// la CSP interdit script, connexion et image distante par défaut.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildBodySrcdoc, sanitizeMailHtml } from '@/lib/mail/sanitize'
import type { MailSurfaces } from './mailTokens'

interface Props { ms: MailSurfaces; html: string | null; text: string | null; truncated: boolean }

export function MailBodyFrame({ ms, html, text, truncated }: Props) {
  const { t } = useTranslation('messages')
  const [remote, setRemote] = useState(false)
  const [height, setHeight] = useState(120)
  const ref = useRef<HTMLIFrameElement>(null)
  const hasRemote = useMemo(() => !!html && /<img[^>]+src=["']?https?:/i.test(html), [html])
  const doc = useMemo(() => (html ? buildBodySrcdoc(sanitizeMailHtml(html, { remoteImages: remote }), { ink: ms.txt2, font: 'var(--crm-font)', remoteImages: remote }) : null), [html, remote, ms.txt2])
  useEffect(() => {
    const el = ref.current
    if (!el || !doc) return
    const measure = () => { const h = el.contentDocument?.documentElement?.scrollHeight; if (h) setHeight(Math.min(Math.max(h + 8, 40), 20000)) }
    el.addEventListener('load', measure)
    const id = window.setInterval(measure, 500)
    const stop = window.setTimeout(() => window.clearInterval(id), 5000)
    return () => { el.removeEventListener('load', measure); window.clearInterval(id); window.clearTimeout(stop) }
  }, [doc])
  if (!doc) {
    return (
      <div style={{ maxWidth: 760 }}>
        {(text ?? '').split(/\n{2,}/).map((para, i) => <p key={i} style={{ fontSize: 'var(--crm-text-md)', lineHeight: 1.75, color: ms.txt2, margin: 'var(--crm-space-2xl) 0 0', whiteSpace: 'pre-wrap' }}>{para}</p>)}
      </div>
    )
  }
  return (
    <div style={{ maxWidth: 760 }}>
      {hasRemote && !remote && (
        <button type="button" onClick={() => setRemote(true)} style={{ marginTop: 'var(--crm-space-lg)', background: ms.elev, border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-pill)', padding: 'var(--crm-space-xs) var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', color: ms.txt3, cursor: 'pointer', fontFamily: 'inherit' }}>
          {t('mail.read.showImages')}
        </button>
      )}
      <iframe ref={ref} title={t('mail.read.bodyTitle')} sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcDoc={doc}
        style={{ width: '100%', height, border: 'none', display: 'block', marginTop: 'var(--crm-space-lg)', background: 'transparent', colorScheme: 'normal' }} />
      {truncated && <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut, marginTop: 'var(--crm-space-md)' }}>{t('mail.read.truncated')}</div>}
    </div>
  )
}
```

- [ ] **Step 2 : Recherche de destinataires (RPC `mail_search_contacts`)**

```ts
// src/hooks/useMailContactSearch.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface MailContactHit { id: string; first_name: string; last_name: string; email: string; phone: string | null }
export function useMailContactSearch(q: string) {
  const needle = q.trim()
  return useQuery({
    queryKey: ['mail', 'contact-search', needle],
    enabled: needle.length >= 2,
    queryFn: async (): Promise<MailContactHit[]> => {
      const { data, error } = await supabase.rpc('mail_search_contacts', { p_q: needle })
      if (error) throw error
      return (data ?? []) as MailContactHit[]
    },
    staleTime: 30_000,
  })
}

/** « a@b.ch, Nom <c@d.ch> » → adresses ; les entrées sans @ sont ignorées. */
export function parseRecipients(s: string): { name: string | null; email: string }[] {
  return s.split(/[,;]/).map((x) => x.trim()).filter(Boolean).map((x) => {
    const m = x.match(/^(.*?)<([^>]+)>$/)
    const email = (m ? m[2] : x).trim().toLowerCase()
    return email.includes('@') ? { name: m ? (m[1].trim().replace(/^"|"$/g, '') || null) : null, email } : null
  }).filter((a): a is { name: string | null; email: string } => !!a)
}
```

- [ ] **Step 3 : Composeurs de réponse et de transfert**

```tsx
// src/components/crm/messagerie/MailReplyComposer.tsx — README §3 « Composeur de réponse ».
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

interface Props { ms: MailSurfaces; toName: string; busy: boolean; onCancel: () => void; onSend: (text: string) => void }
export function MailReplyComposer({ ms, toName, busy, onCancel, onSend }: Props) {
  const { t } = useTranslation('messages')
  const [text, setText] = useState('')
  const can = text.trim().length > 0 && !busy
  return (
    <div style={{ borderRadius: 'var(--crm-radius-xl)', background: ms.elev, padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', marginTop: 'var(--crm-space-4xl)' }}>
      <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.txt3, marginBottom: 'var(--crm-space-md)' }}>{t('mail.read.replyTo')} <b style={{ color: ms.ink }}>{toName}</b></div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} autoFocus aria-label={t('mail.read.replyBody')}
        style={{ width: '100%', minHeight: 110, boxSizing: 'border-box', borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-lg) var(--crm-space-2xl)', fontSize: 'var(--crm-text-md)', lineHeight: 1.6, background: ms.card, border: `1px solid ${ms.bord}`, color: ms.ink, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-md)' }}>
        <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', color: ms.txt3, fontSize: 'var(--crm-text-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>{t('mail.actions.cancel')}</button>
        <button type="button" disabled={!can} onClick={() => onSend(text)} style={{ background: ms.accent, color: ms.accentInk, border: 'none', borderRadius: PILL, padding: 'var(--crm-space-md) var(--crm-space-4xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 500, cursor: can ? 'pointer' : 'default', opacity: can ? 1 : 0.5, fontFamily: 'inherit', transition: MAIL_TRANSITION }}>
          {busy ? t('mail.actions.sending') : t('mail.actions.send')}
        </button>
      </div>
    </div>
  )
}
```

```tsx
// src/components/crm/messagerie/MailForwardComposer.tsx — README §3 « Transfert ».
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { parseRecipients } from '@/hooks/useMailContactSearch'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

interface Props { ms: MailSurfaces; originalFrom: string; originalSubject: string; busy: boolean; onCancel: () => void; onSend: (to: { name: string | null; email: string }[], note: string) => void }
export function MailForwardComposer({ ms, originalFrom, originalSubject, busy, onCancel, onSend }: Props) {
  const { t } = useTranslation('messages')
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  const rcpts = parseRecipients(to)
  const can = rcpts.length > 0 && !busy
  return (
    <div style={{ borderRadius: 'var(--crm-radius-xl)', background: ms.elev, padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', marginTop: 'var(--crm-space-4xl)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)' }}>
      <input value={to} onChange={(e) => setTo(e.target.value)} placeholder={t('mail.compose.toPlaceholder')} aria-label={t('mail.compose.to')} autoFocus
        style={{ borderRadius: PILL, padding: 'var(--crm-space-lg) var(--crm-space-3xl)', fontSize: 'var(--crm-text-sm)', background: ms.card, border: `1px solid ${ms.bord}`, color: ms.ink, fontFamily: 'inherit', outline: 'none' }} />
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('mail.read.forwardNote')} aria-label={t('mail.read.forwardNote')}
        style={{ minHeight: 70, borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-lg) var(--crm-space-2xl)', fontSize: 'var(--crm-text-md)', lineHeight: 1.6, background: ms.card, border: `1px solid ${ms.bord}`, color: ms.ink, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
      <div style={{ border: `1px solid ${ms.bord2}`, borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-md) var(--crm-space-2xl)', fontSize: 'var(--crm-text-xs)', color: ms.txt3 }}>
        {t('mail.read.forwardOriginal')} · {originalFrom} · {originalSubject}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--crm-space-lg)' }}>
        <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', color: ms.txt3, fontSize: 'var(--crm-text-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>{t('mail.actions.cancel')}</button>
        <button type="button" disabled={!can} onClick={() => onSend(rcpts, note)} style={{ background: ms.accent, color: ms.accentInk, border: 'none', borderRadius: PILL, padding: 'var(--crm-space-md) var(--crm-space-4xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 500, cursor: can ? 'pointer' : 'default', opacity: can ? 1 : 0.5, fontFamily: 'inherit', transition: MAIL_TRANSITION }}>
          {busy ? t('mail.actions.sending') : t('mail.actions.forward')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4 : La lecture**

```tsx
// src/components/crm/messagerie/MailReader.tsx — README §3.
import { useTranslation } from 'react-i18next'
import { MEIcon } from '@/components/propertyx/MEIcon'
import type { MailThreadRow } from '@/hooks/useMailThreads'
import type { MailMessageRow, MailAttachmentRow } from '@/hooks/useMailThread'
import type { MailLabel } from '@/hooks/useMailLabels'
import { displayAddress, fileSizeLabel, initialsOf, mailDateLabel } from '@/lib/mail/format'
import { MailBodyFrame } from './MailBodyFrame'
import { MailReplyComposer } from './MailReplyComposer'
import { MailForwardComposer } from './MailForwardComposer'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

interface Props {
  ms: MailSurfaces; lang: string; boxEmail: string
  thread: MailThreadRow; messages: MailMessageRow[]; label: MailLabel | null
  composer: 'none' | 'reply' | 'forward'; sending: boolean
  onBack: () => void; onReply: () => void; onForward: () => void; onCancelComposer: () => void
  onSendReply: (text: string, inReplyTo: MailMessageRow) => void; onSendForward: (to: { name: string | null; email: string }[], note: string, original: MailMessageRow) => void
  onArchive: () => void; onDelete: () => void; onOpenAttachment: (a: MailAttachmentRow) => void; onLinkContact: (email: string, name: string | null) => void
}

export function MailReader(p: Props) {
  const { t } = useTranslation('messages')
  const { ms } = p
  const first = p.messages[0]
  const inboundLast = [...p.messages].reverse().find((m) => m.direction === 'inbound') ?? first
  const btn = (label: string, onClick: () => void, opts: { primary?: boolean; danger?: boolean; right?: boolean } = {}) => (
    <button type="button" onClick={onClick}
      style={{ border: `1px solid ${opts.primary ? ms.ink : ms.bord3}`, borderRadius: PILL, padding: 'var(--crm-space-md) var(--crm-space-4xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 500, background: 'transparent', color: opts.primary ? ms.ink : ms.txt3, cursor: 'pointer', fontFamily: 'inherit', marginLeft: opts.right ? 'auto' : undefined, transition: MAIL_TRANSITION }}
      onMouseEnter={(e) => { if (opts.danger) { e.currentTarget.style.borderColor = ms.danger; e.currentTarget.style.color = ms.danger } else if (opts.primary) { e.currentTarget.style.background = ms.accent; e.currentTarget.style.borderColor = ms.accent; e.currentTarget.style.color = ms.accentInk } else { e.currentTarget.style.borderColor = ms.ink; e.currentTarget.style.color = ms.ink } }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = opts.primary ? ms.ink : ms.bord3; e.currentTarget.style.color = opts.primary ? ms.ink : ms.txt3 }}>
      {label}
    </button>
  )
  const attachmentChips = (m: MailMessageRow) => m.mail_attachments.filter((a) => !a.is_inline).length > 0 && (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-md)', marginTop: 'var(--crm-space-2xl)' }}>
      {m.mail_attachments.filter((a) => !a.is_inline).map((a) => (
        <button key={a.id} type="button" onClick={() => p.onOpenAttachment(a)}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', border: `1px solid ${ms.bord}`, background: ms.elev, borderRadius: 'var(--crm-radius-xl)', padding: 'var(--crm-space-md) var(--crm-space-2xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: ms.ink, cursor: 'pointer', fontFamily: 'inherit', transition: MAIL_TRANSITION }}>
          <MEIcon name="paperclip" size={13} color={ms.accent} /> {a.filename} <span style={{ color: ms.mut, fontSize: 'var(--crm-text-xs)' }}>{fileSizeLabel(a.size_bytes)}</span>
          {a.document_id && <MEIcon name="check" size={12} color={ms.success} />}
        </button>
      ))}
    </div>
  )
  if (!first) return null
  const senderName = first.from_name || first.from_email || ''
  return (
    <div className="scrollbar-hide" style={{ padding: 'var(--crm-space-6xl) var(--crm-space-7xl) var(--crm-space-7xl)', overflowY: 'auto', minHeight: 0, flex: 1 }}>
      <button type="button" onClick={p.onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', background: 'none', border: 'none', color: ms.txt3, fontSize: 'var(--crm-text-md)', cursor: 'pointer', fontFamily: 'inherit', padding: 0, transition: MAIL_TRANSITION }}
        onMouseEnter={(e) => { e.currentTarget.style.color = ms.ink }} onMouseLeave={(e) => { e.currentTarget.style.color = ms.txt3 }}>
        <MEIcon name="chevron-left" size={14} /> {t('mail.read.back')}
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginTop: 'var(--crm-space-2xl)' }}>
        <h1 style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 700, margin: 0 }}>{p.thread.subject || t('mail.row.noSubject')}</h1>
        {p.label && <span style={{ borderRadius: PILL, padding: '3px 10px', fontSize: 'var(--crm-text-xs)', fontWeight: 600, background: p.label.color, color: ms.pillInk(p.label.color) }}>{p.label.name}</span>}
      </div>
      {!p.thread.contact_id && inboundLast.from_email && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginTop: 'var(--crm-space-lg)', padding: 'var(--crm-space-md) var(--crm-space-2xl)', border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-lg)', fontSize: 'var(--crm-text-xs)', color: ms.txt3 }}>
          {t('mail.read.unlinked', { email: inboundLast.from_email })}
          <button type="button" onClick={() => p.onLinkContact(inboundLast.from_email!, inboundLast.from_name)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: ms.accent, fontWeight: 600, fontSize: 'var(--crm-text-xs)', cursor: 'pointer', fontFamily: 'inherit' }}>{t('mail.link.cta')}</button>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', paddingBottom: 'var(--crm-space-2xl)', borderBottom: `1px solid ${ms.bord2}`, marginTop: 'var(--crm-space-2xl)' }}>
        <div aria-hidden style={{ width: 38, height: 38, borderRadius: '50%', background: ms.elev, border: `1px solid ${ms.bord}`, display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-sm)', fontWeight: 700 }}>{initialsOf(first.from_name, first.from_email ?? '')}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{senderName}</div>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{t('mail.read.to', { box: p.boxEmail })}</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 'var(--crm-text-xs)', color: ms.txt3 }}>{mailDateLabel(first.sent_at, new Date(), p.lang)}</div>
      </div>

      <MailBodyFrame ms={ms} html={first.body_html} text={first.body_text} truncated={first.body_truncated} />
      {attachmentChips(first)}

      {p.messages.slice(1).map((m) => (
        <div key={m.id} style={{ borderRadius: 'var(--crm-radius-xl)', background: ms.elev, padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', marginTop: 'var(--crm-space-2xl)' }}>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.txt3, marginBottom: 'var(--crm-space-md)' }}>
            {m.direction === 'outbound' ? `${t('mail.read.me')} → ${m.to.map(displayAddress).join(', ')}` : (m.from_name || m.from_email)} · {mailDateLabel(m.sent_at, new Date(), p.lang)}
          </div>
          {m.body_html ? <MailBodyFrame ms={ms} html={m.body_html} text={m.body_text} truncated={m.body_truncated} /> : <div style={{ fontSize: 'var(--crm-text-md)', lineHeight: 1.7, whiteSpace: 'pre-wrap', color: ms.txt2 }}>{m.body_text}</div>}
          {attachmentChips(m)}
        </div>
      ))}

      {p.composer === 'reply' && <MailReplyComposer ms={ms} toName={inboundLast.from_name || inboundLast.from_email || ''} busy={p.sending} onCancel={p.onCancelComposer} onSend={(text) => p.onSendReply(text, inboundLast)} />}
      {p.composer === 'forward' && <MailForwardComposer ms={ms} originalFrom={inboundLast.from_name || inboundLast.from_email || ''} originalSubject={p.thread.subject ?? ''} busy={p.sending} onCancel={p.onCancelComposer} onSend={(to, note) => p.onSendForward(to, note, inboundLast)} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginTop: 'var(--crm-space-7xl)' }}>
        {btn(t('mail.read.reply'), p.onReply, { primary: true })}
        {btn(t('mail.read.forward'), p.onForward)}
        {btn(p.thread.is_archived ? t('mail.ctx.unarchive') : t('mail.ctx.archive'), p.onArchive)}
        {btn(t('mail.ctx.delete'), p.onDelete, { danger: true, right: true })}
      </div>
    </div>
  )
}
```

- [ ] **Step 5 : Brancher dans `MessagerieApp`** (quand `state.sel`)

```tsx
const selRow = threads.rows.find((r) => r.id === state.sel) ?? null
const thread = useMailThread(state.sel)
const send = useMailSend(state.accountId)
const currentAccount = accounts.list.find((a) => a.id === state.accountId) ?? null
// … dans la section :
{state.sel && selRow && thread.data && (
  <MailReader ms={ms} lang={i18n.language.slice(0, 2)} boxEmail={currentAccount?.email ?? ''} thread={selRow} messages={thread.data} label={labels.labels.find((l) => l.id === selRow.label_id) ?? null}
    composer={state.composer} sending={send.isPending}
    onBack={() => dispatch({ type: 'back' })} onReply={() => dispatch({ type: 'composer', composer: 'reply' })} onForward={() => dispatch({ type: 'composer', composer: 'forward' })} onCancelComposer={() => dispatch({ type: 'composer', composer: 'none' })}
    onSendReply={(text, m) => send.mutate({ kind: 'reply', to: [], body_text: text, in_reply_to_message_id: m.id }, { onSuccess: () => dispatch({ type: 'composer', composer: 'none' }) })}
    onSendForward={(to, note, m) => send.mutate({ kind: 'forward', to, body_text: note, in_reply_to_message_id: m.id }, { onSuccess: () => dispatch({ type: 'composer', composer: 'none' }) })}
    onArchive={() => { actions.act.mutate({ action: selRow.is_archived ? 'unarchive' : 'archive', threadId: selRow.id }); dispatch({ type: 'back' }) }}
    onDelete={() => dispatch({ type: 'modal', modal: { kind: 'delete', threadId: selRow.id } })}
    onOpenAttachment={(a) => dispatch({ type: 'modal', modal: { kind: 'preview', attachmentId: a.id } })}
    onLinkContact={(email, name) => dispatch({ type: 'modal', modal: { kind: 'link-contact', threadId: selRow.id, email, name } })} />
)}
```
⚠ Si le fil ouvert sort de la page courante (filtre, page suivante), `selRow` devient null : garder la dernière ligne ouverte dans un `useRef` (`lastSel.current = selRow ?? lastSel.current`) et l'utiliser en repli — sinon la lecture disparaît sous l'utilisateur au premier `invalidate`.

- [ ] **Step 6 : Clés i18n FR**

```json
"read": { "back": "Retour à la liste", "to": "à {{box}}", "me": "moi", "reply": "Répondre", "forward": "Transférer", "replyTo": "Réponse à", "replyBody": "Votre réponse", "forwardNote": "Note facultative", "forwardOriginal": "Message d'origine joint", "showImages": "Afficher les images", "bodyTitle": "Corps du message", "truncated": "Message tronqué (trop volumineux) : ouvrez-le dans votre messagerie pour la version complète.", "unlinked": "Adresse non rattachée : {{email}}" },
"link": { "cta": "Rapprocher" },
"actions": { "cancel": "Annuler", "save": "Enregistrer", "send": "Envoyer", "sending": "Envoi…", "forward": "Transférer" }
```

- [ ] **Step 7 : Build, lint, commit**

```bash
npm run build && npm run lint && npm run lint:i18n
git add -A
git commit -m "feat(messagerie): lecture (corps assaini en iframe, pièces, fil, réponse, transfert, actions)"
```

---

### Task 2.7 : Modale « Nouveau message » + popover « Joindre un document »

**Files:**
- Create: `src/components/crm/messagerie/MailComposeModal.tsx`, `MailAttachPopover.tsx`
- Create: `src/hooks/useAgencyDocuments.ts`
- Modify: `src/components/crm/messagerie/MessagerieApp.tsx`

Dimensions : README §4 (carte 600, calque `.12` + blur 6, titre 17/700, pilules `12px 18px`, textarea min 170, popover 340 ancré `bottom: calc(100% + 10px)`).

- [ ] **Step 1 : Documents de l'agence (pour « DOCUMENTS DE L'AGENCE »)**

```ts
// src/hooks/useAgencyDocuments.ts
// Les 50 derniers documents de l'agence (RLS), pour les joindre à un message.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AgencyDocument { id: string; name: string; size_bytes: number; storage_path: string; type: string }
export function useAgencyDocuments(enabled: boolean) {
  return useQuery({
    queryKey: ['mail', 'agency-documents'],
    enabled,
    queryFn: async (): Promise<AgencyDocument[]> => {
      const { data, error } = await supabase.from('documents').select('id, name, size_bytes, storage_path, type').eq('status', 'available').order('created_at', { ascending: false }).limit(50)
      if (error) throw error
      return (data ?? []) as AgencyDocument[]
    },
    staleTime: 60_000,
  })
}

/** Télécharge un document du bucket et le rend en base64 (pour mail-send). */
export async function documentToBase64(storagePath: string): Promise<{ base64: string; mimeType: string }> {
  const { data, error } = await supabase.storage.from('documents').download(storagePath)
  if (error || !data) throw new Error(error?.message ?? 'download_failed')
  return { base64: await blobToBase64(data), mimeType: data.type || 'application/octet-stream' }
}
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}
```

- [ ] **Step 2 : Popover de pièces**

```tsx
// src/components/crm/messagerie/MailAttachPopover.tsx — README §4 « Joindre un document ».
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { MEIcon } from '@/components/propertyx/MEIcon'
import { useAgencyDocuments, type AgencyDocument } from '@/hooks/useAgencyDocuments'
import { fileSizeLabel } from '@/lib/mail/format'
import { MAIL_TRANSITION, type MailSurfaces } from './mailTokens'

interface Props { ms: MailSurfaces; chosenDocIds: Set<string>; onFiles: (files: File[]) => void; onToggleDoc: (d: AgencyDocument) => void; onClose: () => void }

export function MailAttachPopover({ ms, chosenDocIds, onFiles, onToggleDoc, onClose }: Props) {
  const { t } = useTranslation('messages')
  const docs = useAgencyDocuments(true)
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [onClose])
  const row = (label: string, sub: string | null, onClick: () => void, chosen = false) => (
    <button key={label + sub} type="button" onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', width: '100%', textAlign: 'left', padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', background: 'transparent', border: 'none', color: ms.ink, fontSize: 'var(--crm-text-sm)', cursor: 'pointer', fontFamily: 'inherit', transition: MAIL_TRANSITION }}
      onMouseEnter={(e) => { e.currentTarget.style.background = ms.hover }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {sub && <span style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{sub}</span>}
      {chosen && <MEIcon name="check" size={13} color={ms.accent} />}
    </button>
  )
  return (
    <div ref={ref} style={{ position: 'absolute', bottom: 'calc(100% + 10px)', left: 0, width: 340, background: ms.card, border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-4xl)', padding: 'var(--crm-space-sm)', zIndex: 310, boxShadow: ms.solidShadow }}>
      <input ref={fileRef} type="file" multiple hidden onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); onClose() }} />
      {row(t('mail.compose.fromComputer'), null, () => fileRef.current?.click())}
      <div style={{ padding: 'var(--crm-space-md) var(--crm-space-lg) var(--crm-space-2xs)', fontSize: 'var(--crm-text-xs)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: ms.mut }}>{t('mail.compose.agencyDocs')}</div>
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {(docs.data ?? []).map((d) => row(d.name, fileSizeLabel(d.size_bytes), () => onToggleDoc(d), chosenDocIds.has(d.id)))}
        {docs.data?.length === 0 && <div style={{ padding: 'var(--crm-space-md) var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{t('mail.compose.noAgencyDocs')}</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3 : La modale**

```tsx
// src/components/crm/messagerie/MailComposeModal.tsx — README §4.
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MEIcon } from '@/components/propertyx/MEIcon'
import { blobToBase64, documentToBase64, type AgencyDocument } from '@/hooks/useAgencyDocuments'
import { parseRecipients, useMailContactSearch } from '@/hooks/useMailContactSearch'
import type { MailDraft } from '@/hooks/useMailDrafts'
import type { MailSendInput } from '@/hooks/useMailSend'
import { fileSizeLabel } from '@/lib/mail/format'
import { MailAttachPopover } from './MailAttachPopover'
import { MailCloseButton, MailModalShell } from './MailModalShell'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

interface Pending { key: string; name: string; size: number; mimeType: string; source: { kind: 'file'; file: File } | { kind: 'doc'; doc: AgencyDocument } }
interface Props { ms: MailSurfaces; open: boolean; draft: MailDraft | null; sending: boolean; error: string | null
  onClose: (draft: { to: string; subject: string; body: string } | null) => void; onSend: (input: MailSendInput) => void }

export function MailComposeModal({ ms, open, draft, sending, error, onClose, onSend }: Props) {
  const { t } = useTranslation('messages')
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [atts, setAtts] = useState<Pending[]>([])
  const [popover, setPopover] = useState(false)
  const [suggest, setSuggest] = useState(false)
  const lastTerm = to.split(/[,;]/).pop()?.trim() ?? ''
  const hits = useMailContactSearch(suggest ? lastTerm : '')
  useEffect(() => {
    if (!open) return
    setTo(draft?.to.map((a) => (a.name ? `${a.name} <${a.email}>` : a.email)).join(', ') ?? '')
    setSubject(draft?.subject ?? ''); setBody(draft?.body_text ?? ''); setAtts([]); setPopover(false)
  }, [open, draft])
  const rcpts = useMemo(() => parseRecipients(to), [to])
  const can = rcpts.length > 0 && subject.trim().length > 0 && !sending
  const field = { background: ms.elev, border: `1px solid ${ms.bord}`, color: ms.ink, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const }

  const submit = async () => {
    const attachments = await Promise.all(atts.map(async (a) => {
      if (a.source.kind === 'file') return { filename: a.name, mime_type: a.mimeType, base64: await blobToBase64(a.source.file) }
      const d = await documentToBase64(a.source.doc.storage_path)
      return { filename: a.name, mime_type: d.mimeType, base64: d.base64 }
    }))
    onSend({ kind: 'new', to: rcpts, subject: subject.trim(), body_text: body, attachments, draft_id: draft?.id })
  }
  const close = () => onClose(to.trim() || subject.trim() || body.trim() ? { to, subject, body } : null)

  return (
    <MailModalShell ms={ms} open={open} onClose={close} width={600} ariaLabel={t('mail.compose.title')} veil={0.12}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 700, margin: 0 }}>{t('mail.compose.title')}</h2>
        <MailCloseButton ms={ms} onClick={close} label={t('mail.actions.close')} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', marginTop: 'var(--crm-space-4xl)' }}>
        <div style={{ position: 'relative' }}>
          <input value={to} onChange={(e) => { setTo(e.target.value); setSuggest(true) }} onBlur={() => setTimeout(() => setSuggest(false), 150)} placeholder={t('mail.compose.toPlaceholder')} aria-label={t('mail.compose.to')} autoFocus
            style={{ ...field, borderRadius: PILL, padding: 'var(--crm-space-lg) var(--crm-space-3xl)', fontSize: 'var(--crm-text-sm)' }} />
          {suggest && (hits.data?.length ?? 0) > 0 && (
            <div role="listbox" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 310, background: ms.card, border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-xl)', padding: 'var(--crm-space-2xs)', boxShadow: ms.solidShadow }}>
              {hits.data!.map((h) => (
                <button key={h.id} type="button" role="option" onMouseDown={(e) => { e.preventDefault(); const parts = to.split(/[,;]/); parts.pop(); setTo([...parts.map((x) => x.trim()).filter(Boolean), `${h.first_name} ${h.last_name} <${h.email}>`].join(', ') + ', '); setSuggest(false) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', background: 'transparent', border: 'none', color: ms.ink, fontSize: 'var(--crm-text-sm)', cursor: 'pointer', fontFamily: 'inherit' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = ms.hover }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                  {h.first_name} {h.last_name} <span style={{ color: ms.mut }}>· {h.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('mail.compose.subject')} aria-label={t('mail.compose.subject')}
          style={{ ...field, borderRadius: PILL, padding: 'var(--crm-space-lg) var(--crm-space-3xl)', fontSize: 'var(--crm-text-sm)' }} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} aria-label={t('mail.compose.body')}
          style={{ ...field, borderRadius: 'var(--crm-radius-xl)', padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', minHeight: 170, resize: 'vertical', fontSize: 'var(--crm-text-md)', lineHeight: 1.6 }} />
        {atts.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-sm)' }}>
            {atts.map((a) => (
              <span key={a.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-sm) var(--crm-space-lg)', fontSize: 'var(--crm-text-sm)', background: ms.elev, border: `1px solid ${ms.bord}` }}>
                <span style={{ maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                <span style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{fileSizeLabel(a.size)}</span>
                <button type="button" aria-label={t('mail.compose.removeAttachment')} onClick={() => setAtts((l) => l.filter((x) => x.key !== a.key))} style={{ background: 'none', border: 'none', color: ms.txt3, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><MEIcon name="x" size={12} /></button>
              </span>
            ))}
          </div>
        )}
        {error && <div role="alert" style={{ fontSize: 'var(--crm-text-xs)', color: ms.danger }}>{error}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-4xl)', position: 'relative' }}>
        <button type="button" onClick={() => setPopover((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', background: 'none', border: 'none', color: ms.txt3, fontSize: 'var(--crm-text-sm)', cursor: 'pointer', fontFamily: 'inherit', padding: 0, transition: MAIL_TRANSITION }}>
          <MEIcon name="paperclip" size={14} /> {t('mail.compose.attach')}
        </button>
        {popover && (
          <MailAttachPopover ms={ms} chosenDocIds={new Set(atts.filter((a) => a.source.kind === 'doc').map((a) => (a.source as { doc: AgencyDocument }).doc.id))}
            onFiles={(files) => setAtts((l) => [...l, ...files.map((f) => ({ key: `f-${f.name}-${f.size}-${Date.now()}`, name: f.name, size: f.size, mimeType: f.type || 'application/octet-stream', source: { kind: 'file' as const, file: f } }))])}
            onToggleDoc={(d) => setAtts((l) => l.some((a) => a.source.kind === 'doc' && a.source.doc.id === d.id) ? l.filter((a) => !(a.source.kind === 'doc' && a.source.doc.id === d.id)) : [...l, { key: `d-${d.id}`, name: d.name, size: d.size_bytes, mimeType: 'application/octet-stream', source: { kind: 'doc' as const, doc: d } }])}
            onClose={() => setPopover(false)} />
        )}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={close} style={{ border: `1px solid ${ms.bord3}`, borderRadius: PILL, padding: 'var(--crm-space-md) var(--crm-space-3xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 500, background: 'transparent', color: ms.txt3, cursor: 'pointer', fontFamily: 'inherit' }}>{t('mail.actions.cancel')}</button>
        <button type="button" disabled={!can} onClick={() => void submit()} style={{ background: ms.accent, color: ms.accentInk, border: 'none', borderRadius: PILL, padding: 'var(--crm-space-md) var(--crm-space-4xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, cursor: can ? 'pointer' : 'default', opacity: can ? 1 : 0.5, fontFamily: 'inherit', transition: MAIL_TRANSITION }}>
          {sending ? t('mail.actions.sending') : t('mail.actions.send')}
        </button>
      </div>
    </MailModalShell>
  )
}
```

- [ ] **Step 4 : Brancher** (dans `MessagerieApp`)

```tsx
const composeDraft = state.modal.kind === 'compose' && state.modal.draftId ? drafts.drafts.find((d) => d.id === state.modal.draftId) ?? null : null
<MailComposeModal ms={ms} open={state.modal.kind === 'compose'} draft={composeDraft} sending={send.isPending} error={send.error?.message ?? null}
  onClose={(content) => {
    if (content) drafts.save.mutate({ id: composeDraft?.id, kind: 'new', to: parseRecipients(content.to), subject: content.subject, body_text: content.body })
    dispatch({ type: 'modal', modal: { kind: 'none' } })
  }}
  onSend={(input) => send.mutate(input, { onSuccess: () => { dispatch({ type: 'modal', modal: { kind: 'none' } }); dispatch({ type: 'folder', folder: 'sent' }) } })} />
```
(README : « à l'envoi, le message rejoint le dossier Envoyés de la boîte courante ».)

- [ ] **Step 5 : Clés i18n FR + commit**

```json
"compose": { "cta": "Nouveau message", "title": "Nouveau message", "to": "Destinataire", "toPlaceholder": "À · destinataire", "subject": "Objet", "body": "Message", "attach": "Joindre un document", "fromComputer": "Depuis mon ordinateur", "agencyDocs": "Documents de l'agence", "noAgencyDocs": "Aucun document disponible.", "removeAttachment": "Retirer la pièce" },
"actions": { "close": "Fermer" }
```
```bash
npm run build && npm run lint && npm run lint:i18n
git add -A && git commit -m "feat(messagerie): modale Nouveau message (destinataires suggérés, pièces, brouillon à la fermeture)"
```

---

### Task 2.8 : Modale « Supprimer ce message ? »

**Files:**
- Create: `src/components/crm/messagerie/MailDeleteModal.tsx`
- Modify: `MessagerieApp.tsx`

- [ ] **Step 1 : Composant** (README §5 : carte 400, `.14` + blur 6, titre 16/500, objet `12.5px txt3`, expéditeur `11.5px mut`, mention légale)

```tsx
// src/components/crm/messagerie/MailDeleteModal.tsx
import { useTranslation } from 'react-i18next'
import type { MailThreadRow } from '@/hooks/useMailThreads'
import { MailModalShell } from './MailModalShell'
import { PILL, type MailSurfaces } from './mailTokens'

interface Props { ms: MailSurfaces; row: MailThreadRow | null; busy: boolean; onCancel: () => void; onConfirm: () => void }
export function MailDeleteModal({ ms, row, busy, onCancel, onConfirm }: Props) {
  const { t } = useTranslation('messages')
  return (
    <MailModalShell ms={ms} open={!!row} onClose={onCancel} width={400} ariaLabel={t('mail.delete.title')} veil={0.14}>
      <h2 style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 500, margin: 0 }}>{t('mail.delete.title')}</h2>
      <div style={{ fontSize: 'var(--crm-text-sm)', color: ms.txt3, marginTop: 'var(--crm-space-md)' }}>{row?.subject || t('mail.row.noSubject')}</div>
      <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{row?.from_name || row?.from_email}</div>
      <p style={{ fontSize: 'var(--crm-text-xs)', color: ms.txt3, lineHeight: 1.6, marginTop: 'var(--crm-space-2xl)' }}>{t('mail.delete.legal')}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-4xl)' }}>
        <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', color: ms.txt3, fontSize: 'var(--crm-text-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>{t('mail.actions.cancel')}</button>
        <button type="button" disabled={busy} onClick={onConfirm} style={{ background: ms.danger, color: ms.dangerInk, border: 'none', borderRadius: PILL, padding: 'var(--crm-space-md) var(--crm-space-4xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}>{t('mail.ctx.delete')}</button>
      </div>
    </MailModalShell>
  )
}
```
Branchement : `row = threads.rows.find(r => r.id === (state.modal.kind === 'delete' ? state.modal.threadId : ''))` ; `onConfirm` → `actions.act.mutate({ action: 'trash', threadId }, { onSuccess: () => { dispatch({ type: 'modal', modal: { kind: 'none' } }); dispatch({ type: 'back' }) } })`.

i18n FR : `"delete": { "title": "Supprimer ce message ?", "legal": "Le message part à la corbeille et quitte la liste. La conservation légale de dix ans s'applique au dossier, pas à la boîte." }`

```bash
npm run build && git add -A && git commit -m "feat(messagerie): modale de suppression (corbeille, mention de conservation)"
```

---

### Task 2.9 : Assistant « Ajouter une boîte » + pop-up OAuth + page de retour

**Files:**
- Create: `src/components/crm/settings/brandLogos.tsx` (déplacement de `GoogleG`, `MsLogo`, `WhatsAppLogo` hors d'`IntegrationsSection.tsx`)
- Create: `src/components/crm/messagerie/MailProviderLogo.tsx`, `MailAddAccountModal.tsx`
- Create: `src/pages/agent/MailOAuthCallbackPage.tsx`
- Modify: `src/components/crm/settings/IntegrationsSection.tsx` (importe les logos), `MessagerieApp.tsx`

Dimensions : README §6 (carte 520, lignes fournisseur `12px 14px` / rayon 18, WhatsApp plus grande `16px` / rayon 20 / logo 40, étape OAuth logo 40 + encart « ACCÈS DEMANDÉ » rayon 20, étape IMAP grille 2 colonnes, étape connectée cercle 40 vert).

- [ ] **Step 1 : Sortir les logos de marque dans un module partagé**

Couper `GoogleG`, `MsLogo`, `WhatsAppLogo` d'`IntegrationsSection.tsx` (leurs SVG, sans les modifier), les coller dans `src/components/crm/settings/brandLogos.tsx` avec `export function …`, et importer dans `IntegrationsSection.tsx` : `import { GoogleG, MsLogo, WhatsAppLogo } from './brandLogos'`. `npm run build` doit rester vert.

- [ ] **Step 2 : Logo de fournisseur (avec repli honnête pour les PNG absents)**

```tsx
// src/components/crm/messagerie/MailProviderLogo.tsx
// Google / Microsoft / WhatsApp = SVG du dépôt. Infomaniak / Swisscom = PNG à déposer par
// Julien dans public/mail/ (maître §6.4) ; tant qu'ils manquent, un monogramme — pas un
// 200 qui ment (le fallback SPA rend index.html pour un fichier absent : on teste le chargement).
import { useState } from 'react'
import { GoogleG, MsLogo, WhatsAppLogo } from '@/components/crm/settings/brandLogos'
import type { MailSurfaces } from './mailTokens'

export type MailProviderKey = 'wa' | 'gmail' | 'outlook' | 'infomaniak' | 'bluewin' | 'imap'
const PNG: Partial<Record<MailProviderKey, { src: string; mono: string }>> = { infomaniak: { src: '/mail/infomaniak.png', mono: 'ik' }, bluewin: { src: '/mail/swisscom.png', mono: 'bw' } }

export function MailProviderLogo({ ms, provider, size = 36 }: { ms: MailSurfaces; provider: MailProviderKey; size?: number }) {
  const [broken, setBroken] = useState(false)
  const inner = size - 14
  const circle = { width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0 } as const
  if (provider === 'wa') return <div style={{ ...circle, background: 'transparent' }}><WhatsAppLogo size={size} /></div>
  if (provider === 'gmail') return <div style={{ ...circle, background: ms.elev, border: `1px solid ${ms.bord}` }}><GoogleG size={inner} /></div>
  if (provider === 'outlook') return <div style={{ ...circle, background: ms.elev, border: `1px solid ${ms.bord}` }}><MsLogo size={inner} /></div>
  if (provider === 'imap') return <div style={{ ...circle, background: ms.elev, border: `1px solid ${ms.bord}`, fontSize: 'var(--crm-text-md)', fontWeight: 700 }}>@</div>
  const png = PNG[provider]!
  return (
    <div style={{ ...circle, background: ms.elev, border: `1px solid ${ms.bord}`, fontSize: 'var(--crm-text-xs)', fontWeight: 700, letterSpacing: '0.04em' }}>
      {broken ? png.mono : <img src={png.src} alt="" width={inner} height={inner} style={{ objectFit: 'contain' }} onLoad={(e) => { if (e.currentTarget.naturalWidth === 0) setBroken(true) }} onError={() => setBroken(true)} />}
    </div>
  )
}
```

- [ ] **Step 3 : L'assistant**

```tsx
// src/components/crm/messagerie/MailAddAccountModal.tsx — README §6, transposé (maître D6, D13, D14).
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MEIcon } from '@/components/propertyx/MEIcon'
import { useMailAccounts, type ImapForm, type MailAccount } from '@/hooks/useMailAccounts'
import { useMailOAuthPopup } from '@/hooks/useMailOAuthPopup'
import { MailCloseButton, MailModalShell } from './MailModalShell'
import { MailProviderLogo, type MailProviderKey } from './MailProviderLogo'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

type Step = 'list' | 'oauth' | 'imap' | 'done'
interface Props { ms: MailSurfaces; open: boolean; onClose: () => void; onOpenAccount: (accountId: string) => void }

/** Présélections de la maquette (README « Fournisseurs de l'assistant »), ports 465 pour SMTP (maître D5). */
const PRESET: Record<Exclude<MailProviderKey, 'wa'>, { name: string; imap: string; smtp: string; oauth: boolean }> = {
  gmail: { name: 'Google Workspace', imap: 'imap.gmail.com', smtp: 'smtp.gmail.com', oauth: true },
  outlook: { name: 'Outlook / Microsoft 365', imap: 'outlook.office365.com', smtp: 'smtp.office365.com', oauth: true },
  infomaniak: { name: 'Infomaniak Mail', imap: 'mail.infomaniak.com', smtp: 'mail.infomaniak.com', oauth: false },
  bluewin: { name: 'Bluewin (Swisscom)', imap: 'imap.bluewin.ch', smtp: 'smtpauths.bluewin.ch', oauth: false },
  imap: { name: 'IMAP / SMTP', imap: '', smtp: '', oauth: false },
}
const IMAP_ERRORS: Record<string, string> = { invalid_input: 'mail.add.imap.err.invalid', starttls_unsupported: 'mail.add.imap.err.starttls', connection_failed: 'mail.add.imap.err.connection', unknown_action: 'mail.add.imap.unavailable' }
const OAUTH_ERRORS: Record<string, string> = { popup_blocked: 'mail.add.oauth.err.popupBlocked', cancelled: 'mail.add.oauth.err.cancelled', timeout: 'mail.add.oauth.err.timeout', denied: 'mail.add.oauth.err.denied', provider_not_configured: 'mail.add.oauth.err.notConfigured', exchange_failed: 'mail.add.oauth.err.exchange' }

export function MailAddAccountModal({ ms, open, onClose, onOpenAccount }: Props) {
  const { t } = useTranslation('messages')
  const navigate = useNavigate()
  const { connect, cancel } = useMailOAuthPopup()
  const { connectImap } = useMailAccounts()
  const [step, setStep] = useState<Step>('list')
  const [prov, setProv] = useState<Exclude<MailProviderKey, 'wa'>>('gmail')
  const [addr, setAddr] = useState('')
  const [shared, setShared] = useState(false)
  const [form, setForm] = useState<ImapForm>({ email: '', imap_host: '', imap_port: 993, smtp_host: '', smtp_port: 465, user: '', password: '', encryption: 'ssl', visibility: 'owner' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<MailAccount | null>(null)
  useEffect(() => { if (open) { setStep('list'); setBusy(false); setError(null); setDone(null); setAddr('') } }, [open])

  const pick = (p: MailProviderKey) => {
    if (p === 'wa') { onClose(); navigate('/dashboard/settings?tab=integrations'); return }
    setProv(p); setError(null)
    const pr = PRESET[p]
    setForm((f) => ({ ...f, imap_host: pr.imap, smtp_host: pr.smtp, imap_port: 993, smtp_port: 465, encryption: 'ssl' }))
    setStep(pr.oauth ? 'oauth' : 'imap')
  }
  const authorize = async () => {
    setBusy(true); setError(null)
    const r = await connect(prov === 'outlook' ? 'outlook' : 'gmail', { loginHint: addr.trim() || undefined, visibility: shared ? 'agency' : 'owner' })
    setBusy(false)
    if (r.ok) { setDone(r.account); setStep('done') } else setError(t(OAUTH_ERRORS[r.error] ?? 'mail.add.oauth.err.generic', { detail: r.detail ?? '' }))
  }
  const testImap = async () => {
    setBusy(true); setError(null)
    const r = await connectImap({ ...form, email: form.email.trim().toLowerCase(), user: form.user.trim() || form.email.trim().toLowerCase(), visibility: shared ? 'agency' : 'owner' })
    setBusy(false)
    if (!r.error && r.data) { setDone(r.data.account); setStep('done') } else setError(t(IMAP_ERRORS[r.error ?? ''] ?? 'mail.add.imap.err.generic'))
  }
  const field = { background: ms.elev, border: `1px solid ${ms.bord}`, color: ms.ink, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, borderRadius: PILL, padding: 'var(--crm-space-lg) var(--crm-space-3xl)', fontSize: 'var(--crm-text-sm)', width: '100%' }
  const ghost = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} style={{ border: `1px solid ${ms.bord3}`, borderRadius: PILL, padding: 'var(--crm-space-md) var(--crm-space-3xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 500, background: 'transparent', color: ms.txt3, cursor: 'pointer', fontFamily: 'inherit', transition: MAIL_TRANSITION }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = ms.ink; e.currentTarget.style.color = ms.ink }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = ms.bord3; e.currentTarget.style.color = ms.txt3 }}>{label}</button>
  )
  const primary = (label: string, onClick: () => void, disabled = false) => (
    <button type="button" disabled={disabled || busy} onClick={onClick} style={{ background: ms.accent, color: ms.accentInk, border: 'none', borderRadius: PILL, padding: 'var(--crm-space-md) var(--crm-space-4xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, cursor: disabled || busy ? 'default' : 'pointer', opacity: disabled || busy ? 0.6 : 1, fontFamily: 'inherit', transition: MAIL_TRANSITION }}>{label}</button>
  )
  const shareRow = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginTop: 'var(--crm-space-lg)', fontSize: 'var(--crm-text-sm)', cursor: 'pointer' }}>
      <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> {t('mail.add.share')}
    </label>
  )
  const providerRow = (p: MailProviderKey, name: string, sub: string | null, big = false) => (
    <button key={p} type="button" onClick={() => pick(p)}
      style={{ display: 'flex', alignItems: 'center', gap: big ? 'var(--crm-space-3xl)' : 'var(--crm-space-lg)', padding: big ? 'var(--crm-space-2xl)' : 'var(--crm-space-lg) var(--crm-space-2xl)', border: `1px solid ${ms.bord}`, borderRadius: big ? 'var(--crm-radius-4xl)' : 'var(--crm-radius-xl)', background: 'transparent', color: ms.ink, cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit', transition: MAIL_TRANSITION }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = ms.dim; e.currentTarget.style.background = ms.hover }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = ms.bord; e.currentTarget.style.background = 'transparent' }}>
      <MailProviderLogo ms={ms} provider={p} size={big ? 40 : 36} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: big ? 'var(--crm-text-lg)' : 'var(--crm-text-md)', fontWeight: 600 }}>{name}</span>
        {sub && <span style={{ display: 'block', fontSize: 'var(--crm-text-sm)', color: ms.mut, marginTop: 2 }}>{sub}</span>}
      </span>
      <MEIcon name="chevron-right" size={13} color={ms.mut} />
    </button>
  )

  return (
    <MailModalShell ms={ms} open={open} onClose={() => { cancel(); onClose() }} width={520} ariaLabel={t('mail.add.title')} veil={0.12}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 700, margin: 0 }}>{t('mail.add.title')}</h2>
        <MailCloseButton ms={ms} onClick={() => { cancel(); onClose() }} label={t('mail.actions.close')} />
      </div>

      {step === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)', marginTop: 'var(--crm-space-2xl)' }}>
          {providerRow('wa', 'WhatsApp Business', t('mail.add.waSub'), true)}
          {providerRow('gmail', PRESET.gmail.name, null)}
          {providerRow('outlook', PRESET.outlook.name, null)}
          {providerRow('infomaniak', PRESET.infomaniak.name, t('mail.add.imapSub'))}
          {providerRow('bluewin', PRESET.bluewin.name, t('mail.add.imapSub'))}
          {providerRow('imap', t('mail.add.other'), t('mail.add.otherSub'))}
        </div>
      )}

      {step === 'oauth' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-4xl)' }}>
            <MailProviderLogo ms={ms} provider={prov} size={40} />
            <div><div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{PRESET[prov].name}</div><div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{t('mail.add.oauth.subtitle')}</div></div>
          </div>
          <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder={t('mail.add.oauth.addrPlaceholder')} aria-label={t('mail.add.oauth.addr')} style={{ ...field, marginTop: 'var(--crm-space-2xl)' }} />
          <div style={{ marginTop: 'var(--crm-space-lg)', border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-4xl)', padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)' }}>
            <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: ms.mut }}>{t('mail.add.oauth.access')}</div>
            {(['read', 'file', 'labels'] as const).map((k) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', fontSize: 'var(--crm-text-sm)' }}><MEIcon name="check" size={13} color={ms.accent} /> {t(`mail.add.oauth.scope.${k}`)}</div>
            ))}
          </div>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut, lineHeight: 1.6, marginTop: 'var(--crm-space-lg)' }}>{t('mail.add.oauth.note', { provider: PRESET[prov].name })}</div>
          {shareRow}
          {error && <div role="alert" style={{ fontSize: 'var(--crm-text-xs)', color: ms.danger, marginTop: 'var(--crm-space-md)' }}>{error}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-3xl)' }}>
            <button type="button" onClick={() => { setForm((f) => ({ ...f, email: addr, user: addr })); setStep('imap') }} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', color: ms.txt3, fontSize: 'var(--crm-text-xs)', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}>{t('mail.add.oauth.useImap')}</button>
            {ghost(t('mail.add.back'), () => { cancel(); setStep('list') })}
            {primary(busy ? t('mail.add.oauth.busy') : t('mail.add.oauth.authorize'), () => void authorize())}
          </div>
        </div>
      )}

      {step === 'imap' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-4xl)' }}>
            <MailProviderLogo ms={ms} provider={prov} size={40} />
            <div><div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{PRESET[prov].name}</div><div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{t('mail.add.imap.subtitle')}</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-md)', marginTop: 'var(--crm-space-2xl)' }}>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={t('mail.add.imap.email')} aria-label={t('mail.add.imap.email')} style={{ ...field, gridColumn: 'span 2' }} />
            <input value={form.imap_host} onChange={(e) => setForm({ ...form, imap_host: e.target.value })} placeholder={t('mail.add.imap.imapHost')} aria-label={t('mail.add.imap.imapHost')} style={field} />
            <input value={form.imap_port} onChange={(e) => setForm({ ...form, imap_port: Number(e.target.value) || 0 })} placeholder={t('mail.add.imap.port')} aria-label={t('mail.add.imap.imapPort')} inputMode="numeric" style={field} />
            <input value={form.smtp_host} onChange={(e) => setForm({ ...form, smtp_host: e.target.value })} placeholder={t('mail.add.imap.smtpHost')} aria-label={t('mail.add.imap.smtpHost')} style={field} />
            <input value={form.smtp_port} onChange={(e) => setForm({ ...form, smtp_port: Number(e.target.value) || 0 })} placeholder={t('mail.add.imap.port')} aria-label={t('mail.add.imap.smtpPort')} inputMode="numeric" style={field} />
            <input value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} placeholder={t('mail.add.imap.user')} aria-label={t('mail.add.imap.user')} autoComplete="username" style={field} />
            <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={t('mail.add.imap.password')} aria-label={t('mail.add.imap.password')} type="password" autoComplete="current-password" style={field} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginTop: 'var(--crm-space-lg)' }}>
            <span style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{t('mail.add.imap.encryption')}</span>
            {(['ssl', 'starttls'] as const).map((enc) => (
              <button key={enc} type="button" aria-pressed={form.encryption === enc} onClick={() => setForm({ ...form, encryption: enc, smtp_port: enc === 'ssl' ? 465 : 587 })}
                style={{ borderRadius: PILL, padding: 'var(--crm-space-xs) var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', fontWeight: 500, border: `1px solid ${form.encryption === enc ? ms.accent : ms.bord3}`, background: form.encryption === enc ? ms.accent : ms.elev, color: form.encryption === enc ? ms.accentInk : ms.txt3, cursor: 'pointer', fontFamily: 'inherit', transition: MAIL_TRANSITION }}>
                {enc === 'ssl' ? 'SSL / TLS' : 'STARTTLS'}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut, lineHeight: 1.6, marginTop: 'var(--crm-space-lg)' }}>{t('mail.add.imap.note')}</div>
          {shareRow}
          {error && <div role="alert" style={{ fontSize: 'var(--crm-text-xs)', color: ms.danger, marginTop: 'var(--crm-space-md)' }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-3xl)' }}>
            {ghost(t('mail.add.back'), () => setStep('list'))}
            {primary(busy ? t('mail.add.oauth.busy') : t('mail.add.imap.test'), () => void testImap(), !form.email.includes('@') || !form.password)}
          </div>
        </div>
      )}

      {step === 'done' && done && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-4xl)' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: ms.success, display: 'grid', placeItems: 'center', flexShrink: 0 }}><MEIcon name="check" size={18} color={ms.successInk} /></div>
            <div style={{ minWidth: 0 }}><div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{t('mail.add.done.title')}</div><div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{done.email}</div></div>
          </div>
          <div style={{ marginTop: 'var(--crm-space-2xl)', border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-4xl)', padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', fontSize: 'var(--crm-text-sm)' }}>
            {([['sync', 'syncValue'], ['folders', 'foldersValue'], ['linking', 'linkingValue']] as const).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}><span style={{ color: ms.mut }}>{t(`mail.add.done.${k}`)}</span><span style={{ marginLeft: 'auto' }}>{t(`mail.add.done.${v}`)}</span></div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-3xl)' }}>
            {ghost(t('mail.add.done.another'), () => { setDone(null); setStep('list') })}
            {primary(t('mail.add.done.open'), () => { onOpenAccount(done.id); onClose() })}
          </div>
        </div>
      )}
    </MailModalShell>
  )
}
```
Branchement : `<MailAddAccountModal ms={ms} open={state.modal.kind === 'add-account'} onClose={() => dispatch({ type: 'modal', modal: { kind: 'none' } })} onOpenAccount={(id) => dispatch({ type: 'select-account', accountId: id })} />`.

- [ ] **Step 4 : La page de retour**

```tsx
// src/pages/agent/MailOAuthCallbackPage.tsx
// /oauth/mail/callback — la pop-up y atterrit après le consentement (maître §4).
// Avec un opener : on relaie {code,state} par postMessage et on se ferme.
// Sans opener (pop-up bloquée ⇒ navigation pleine page) : on fait l'échange ici.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMailAccounts } from '@/hooks/useMailAccounts'
import { OAUTH_REPLY_TYPE, type OAuthReply } from '@/lib/mail/oauthPopup'

export default function MailOAuthCallbackPage() {
  const { t } = useTranslation('messages')
  const navigate = useNavigate()
  const { exchange } = useMailAccounts()
  const [msg, setMsg] = useState(t('mail.callback.working'))
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const code = p.get('code'); const state = p.get('state') ?? ''; const error = p.get('error')
    if (window.opener && window.opener !== window) {
      const reply: OAuthReply = { type: OAUTH_REPLY_TYPE, code: code ?? undefined, state, error: error ?? undefined }
      ;(window.opener as Window).postMessage(reply, window.location.origin)
      setMsg(t('mail.callback.closing'))
      window.setTimeout(() => window.close(), 300)
      return
    }
    if (!code || !state) { setMsg(t('mail.callback.denied')); return }
    void exchange(code, state).then((r) => {
      if (r.error || !r.data) { setMsg(t('mail.callback.failed', { detail: r.detail ?? r.error ?? '' })); return }
      navigate(`/dashboard/messagerie?account=${r.data.account.id}`, { replace: true })
    })
  }, [exchange, navigate, t])
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'var(--crm-font)', fontSize: 'var(--crm-text-md)', color: 'var(--color-text-primary)' }}>{msg}</div>
  )
}
```
⚠ `useMailAccounts()` appelle `useQuery` : la page est sous `ProtectedRoute`, donc `QueryClientProvider` et la session existent. Le texte utilise un jeton de thème existant (`--color-text-primary`, cf. CLAUDE.md §3 « Tokens ») — vérifier son nom dans `globals.css` ; sinon `text-theme-primary` en classe.

- [ ] **Step 5 : Clés i18n FR**

```json
"add": {
  "cta": "Ajouter une boîte", "title": "Ajouter une boîte", "back": "Retour", "share": "Partager cette boîte avec toute l'agence",
  "waSub": "Coexistence · app + Cloud API sur le même numéro", "imapSub": "Connexion IMAP / SMTP", "other": "Autre boîte (IMAP / SMTP)", "otherSub": "Configuration manuelle du serveur",
  "oauth": { "subtitle": "Autorisation du compte", "addr": "Adresse e-mail", "addrPlaceholder": "adresse@votre-agence.ch", "access": "Accès demandé",
    "scope": { "read": "Lire et envoyer les messages de cette boîte", "file": "Rattacher les échanges à la fiche contact", "labels": "Classer avec les libellés de l'agence" },
    "note": "Validation sur la page de {{provider}} · aucun mot de passe ne transite par l'agence.", "useImap": "Configurer en IMAP", "authorize": "Autoriser", "busy": "Connexion…",
    "err": { "popupBlocked": "La fenêtre a été bloquée par le navigateur. Nous ouvrons l'autorisation dans cet onglet.", "cancelled": "Autorisation annulée.", "timeout": "L'autorisation a expiré. Réessayez.", "denied": "L'accès a été refusé sur la page du fournisseur.", "notConfigured": "Ce fournisseur n'est pas encore configuré côté MEGGA.", "exchange": "La connexion a échoué : {{detail}}", "generic": "La connexion a échoué. Réessayez dans un instant." } },
  "imap": { "subtitle": "Connexion IMAP / SMTP", "email": "Adresse e-mail", "imapHost": "Serveur IMAP", "smtpHost": "Serveur SMTP", "port": "Port", "imapPort": "Port IMAP", "smtpPort": "Port SMTP", "user": "Utilisateur", "password": "Mot de passe", "encryption": "Chiffrement",
    "note": "Le test vérifie IMAP et SMTP avant l'ajout · les identifiants sont chiffrés au repos.", "test": "Tester et connecter", "unavailable": "La connexion IMAP arrive dans une prochaine version.",
    "err": { "invalid": "Adresse, serveurs et mot de passe sont requis.", "starttls": "STARTTLS (port 587) n'est pas disponible depuis nos serveurs. Utilisez SSL/TLS sur le port 465.", "connection": "Connexion refusée : vérifiez l'identifiant, le mot de passe (ou mot de passe d'application) et les serveurs.", "generic": "La connexion a échoué. Réessayez dans un instant." } },
  "done": { "title": "Boîte connectée", "sync": "Synchronisation", "syncValue": "90 derniers jours", "folders": "Dossiers importés", "foldersValue": "Réception, Envoyés", "linking": "Rattachement aux contacts", "linkingValue": "Actif", "another": "Ajouter une autre", "open": "Ouvrir la boîte" }
},
"callback": { "working": "Connexion de la boîte…", "closing": "Vous pouvez fermer cette fenêtre.", "denied": "Autorisation refusée ou incomplète.", "failed": "La connexion a échoué. {{detail}}" }
```

- [ ] **Step 6 : Build, lint, commit**

```bash
npm run build && npm run lint && npm run lint:i18n
git add -A && git commit -m "feat(messagerie): assistant Ajouter une boîte (fournisseurs, OAuth en pop-up, IMAP, connectée) et page de retour"
```

---

### Task 2.10 : Modale « Rapprocher l'adresse »

**Files:**
- Create: `src/components/crm/messagerie/MailLinkContactModal.tsx`
- Modify: `MessagerieApp.tsx`

README §7 transposé : `patient` → contact, `numéro` → adresse ; la recherche cherche nom / adresse / téléphone (RPC `mail_search_contacts`). « Créer la fiche » ouvre la liste des contacts ; la création pré-remplie depuis un mail n'est pas dans ce lot (à ajouter au maître §9 — fait).

- [ ] **Step 1 : Composant**

```tsx
// src/components/crm/messagerie/MailLinkContactModal.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MEIcon } from '@/components/propertyx/MEIcon'
import { useMailContactSearch } from '@/hooks/useMailContactSearch'
import { initialsOf } from '@/lib/mail/format'
import { MailCloseButton, MailModalShell } from './MailModalShell'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

interface Props { ms: MailSurfaces; open: boolean; email: string; name: string | null; busy: boolean; onClose: () => void; onLink: (contactId: string) => void }
export function MailLinkContactModal({ ms, open, email, name, busy, onClose, onLink }: Props) {
  const { t } = useTranslation('messages')
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const hits = useMailContactSearch(q.length >= 2 ? q : (name ?? ''))
  return (
    <MailModalShell ms={ms} open={open} onClose={onClose} width={520} ariaLabel={t('mail.link.title')} veil={0.12} column>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div><h2 style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>{t('mail.link.title')}</h2><div style={{ fontSize: 'var(--crm-text-sm)', color: ms.mut, marginTop: 4 }}>{name ? `${name} · ${email}` : email}</div></div>
        <MailCloseButton ms={ms} onClick={onClose} label={t('mail.actions.close')} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', background: ms.elev, border: `1px solid ${ms.bord}`, borderRadius: PILL, padding: 'var(--crm-space-md) var(--crm-space-2xl)', marginTop: 'var(--crm-space-4xl)' }}>
        <MEIcon name="search" size={14} color={ms.mut} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('mail.link.searchPlaceholder')} aria-label={t('mail.link.search')} autoFocus style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: ms.ink, fontSize: 'var(--crm-text-sm)', fontFamily: 'inherit' }} />
      </label>
      <div style={{ marginTop: 'var(--crm-space-md)', overflowY: 'auto', minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {(hits.data ?? []).map((h) => (
          <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', transition: MAIL_TRANSITION }}
            onMouseEnter={(e) => { e.currentTarget.style.background = ms.hover }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
            <div aria-hidden style={{ width: 30, height: 30, borderRadius: '50%', background: ms.elev, border: `1px solid ${ms.bord}`, display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-xs)', fontWeight: 700 }}>{initialsOf(`${h.first_name} ${h.last_name}`, h.email)}</div>
            <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.first_name} {h.last_name}</div><div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{h.email}{h.phone ? ` · ${h.phone}` : ''}</div></div>
            <button type="button" disabled={busy} onClick={() => onLink(h.id)} style={{ background: 'none', border: 'none', color: ms.accent, fontSize: 'var(--crm-text-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{t('mail.link.cta')}</button>
          </div>
        ))}
        {hits.data?.length === 0 && <div style={{ padding: 'var(--crm-space-2xl) var(--crm-space-lg)', fontSize: 'var(--crm-text-sm)', color: ms.mut }}>{t('mail.link.empty')}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', borderTop: `1px solid ${ms.bord2}`, paddingTop: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-lg)' }}>
        <span style={{ flex: 1, fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{t('mail.link.note')}</span>
        <button type="button" onClick={() => { onClose(); navigate('/dashboard/contacts') }} style={{ border: `1px solid ${ms.bord3}`, borderRadius: PILL, padding: 'var(--crm-space-md) var(--crm-space-3xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 500, background: 'transparent', color: ms.txt3, cursor: 'pointer', fontFamily: 'inherit' }}>{t('mail.link.create')}</button>
      </div>
    </MailModalShell>
  )
}
```
Branchement : `open={state.modal.kind === 'link-contact'}`, `onLink={(contactId) => actions.linkContact.mutate({ threadId, contactId, email }, { onSuccess: () => dispatch({ type: 'modal', modal: { kind: 'none' } }) })}`.

i18n FR : `"link": { "cta": "Rapprocher", "title": "Rapprocher l'adresse", "search": "Recherche", "searchPlaceholder": "Nom, adresse ou téléphone", "empty": "Aucun contact trouvé.", "note": "L'adresse sera mémorisée pour cette fiche.", "create": "Créer la fiche" }`

```bash
npm run build && git add -A && git commit -m "feat(messagerie): modale Rapprocher l'adresse (recherche tokenisée, alias appris)"
```

---

### Task 2.11 : Modales « Aperçu de la pièce » et « Classer dans le dossier »

**Files:**
- Create: `src/components/crm/messagerie/MailAttachmentPreviewModal.tsx`, `MailFileAttachmentModal.tsx`
- Modify: `MessagerieApp.tsx`

README §8-9 transposés. ⚠ Le segment « Accès : Tout le cabinet / Soins uniquement » n'a **aucun** support dans `documents` (pas de colonne d'accès) : il n'est pas rendu — un réglage sans effet serait un mensonge d'interface. Écart consigné.

- [ ] **Step 1 : Aperçu**

```tsx
// src/components/crm/messagerie/MailAttachmentPreviewModal.tsx — README §9 (calque .28, blur 8, carte 600).
import { useTranslation } from 'react-i18next'
import { MEIcon } from '@/components/propertyx/MEIcon'
import { useMailAttachmentBlob } from '@/hooks/useMailAttachmentBlob'
import type { MailAttachmentRow } from '@/hooks/useMailThread'
import { MailCloseButton, MailModalShell } from './MailModalShell'
import { PILL, type MailSurfaces } from './mailTokens'

interface Props { ms: MailSurfaces; att: MailAttachmentRow | null; onClose: () => void; onFile: () => void }
export function MailAttachmentPreviewModal({ ms, att, onClose, onFile }: Props) {
  const { t } = useTranslation('messages')
  const blob = useMailAttachmentBlob(att?.id ?? null)
  const isImage = !!att && att.mime_type.startsWith('image/')
  const isPdf = att?.mime_type === 'application/pdf'
  return (
    <MailModalShell ms={ms} open={!!att} onClose={onClose} width={600} ariaLabel={t('mail.preview.title')} veil={0.28} blur={8} zIndex={305}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-lg)' }}>
        <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att?.filename}</div>
        <MailCloseButton ms={ms} onClick={onClose} label={t('mail.actions.close')} />
      </div>
      <div style={{ marginTop: 'var(--crm-space-2xl)', height: 330, borderRadius: 'var(--crm-radius-xl)', background: ms.elev, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
        {blob.loading && <span style={{ fontSize: 'var(--crm-text-sm)', color: ms.mut }}>{t('mail.preview.loading')}</span>}
        {blob.error && <span style={{ fontSize: 'var(--crm-text-sm)', color: ms.danger }}>{t('mail.preview.error')}</span>}
        {blob.url && isImage && <img src={blob.url} alt={att?.filename ?? ''} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
        {blob.url && isPdf && <iframe src={blob.url} title={att?.filename ?? ''} style={{ width: '100%', height: '100%', border: 'none' }} />}
        {blob.url && !isImage && !isPdf && (
          <a href={blob.url} download={att?.filename} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', color: ms.accent, fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}><MEIcon name="paperclip" size={14} color={ms.accent} /> {t('mail.preview.download')}</a>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-3xl)' }}>
        {att?.document_id && <span style={{ fontSize: 'var(--crm-text-xs)', color: ms.successInk, background: ms.success, borderRadius: PILL, padding: '2px 10px' }}>{t('mail.file.filed')}</span>}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: ms.txt3, fontSize: 'var(--crm-text-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>{t('mail.actions.close')}</button>
        {!att?.document_id && <button type="button" onClick={onFile} style={{ background: ms.accent, color: ms.accentInk, border: 'none', borderRadius: PILL, padding: 'var(--crm-space-md) var(--crm-space-4xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{t('mail.file.cta')}</button>}
      </div>
    </MailModalShell>
  )
}
```

- [ ] **Step 2 : Classer dans le dossier**

```tsx
// src/components/crm/messagerie/MailFileAttachmentModal.tsx — README §8 (carte 560).
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MEIcon } from '@/components/propertyx/MEIcon'
import { useMailContactSearch, type MailContactHit } from '@/hooks/useMailContactSearch'
import type { MailAttachmentRow } from '@/hooks/useMailThread'
import { invokeMail } from '@/lib/mail/invoke'
import { fileSizeLabel, initialsOf } from '@/lib/mail/format'
import { MailCloseButton, MailModalShell } from './MailModalShell'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

const TYPES = ['contrat', 'mandat', 'piece_identite', 'justificatif_domicile', 'financement', 'plan', 'photo', 'autre'] as const
interface Props { ms: MailSurfaces; att: MailAttachmentRow | null; defaultContactId: string | null; onClose: () => void; onFiled: () => void; onPreview: () => void }

export function MailFileAttachmentModal({ ms, att, defaultContactId, onClose, onFiled, onPreview }: Props) {
  const { t } = useTranslation('messages')
  const [contact, setContact] = useState<MailContactHit | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [q, setQ] = useState('')
  const [type, setType] = useState<(typeof TYPES)[number]>('autre')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hits = useMailContactSearch(q)
  useEffect(() => { if (att) { setName(att.filename.replace(/\.[^.]+$/, '')); setType('autre'); setError(null); setContact(null); setQ('') } }, [att])
  const ext = att?.filename.split('.').pop()?.toUpperCase() ?? ''
  const contactId = contact?.id ?? defaultContactId
  const submit = async () => {
    if (!att || !contactId) return
    setBusy(true); setError(null)
    const r = await invokeMail('mail-attachment', { action: 'file', attachment_id: att.id, contact_id: contactId, document_type: type, name })
    setBusy(false)
    if (r.error) { setError(t(r.error === 'unsupported_type' ? 'mail.file.err.unsupported' : 'mail.file.err.generic')); return }
    onFiled()
  }
  const field = { background: ms.elev, border: `1px solid ${ms.bord}`, color: ms.ink, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, borderRadius: PILL, padding: 'var(--crm-space-md) var(--crm-space-2xl)', fontSize: 'var(--crm-text-md)', width: '100%' }
  return (
    <MailModalShell ms={ms} open={!!att} onClose={onClose} width={560} ariaLabel={t('mail.file.title')} veil={0.12} zIndex={306}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div><h2 style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 500, margin: 0 }}>{t('mail.file.title')}</h2><div style={{ fontSize: 'var(--crm-text-sm)', color: ms.mut, marginTop: 4 }}>{t('mail.file.subtitle')}</div></div>
        <MailCloseButton ms={ms} onClick={onClose} label={t('mail.actions.close')} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3xl)', marginTop: 'var(--crm-space-4xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', background: ms.elev, borderRadius: 'var(--crm-radius-4xl)', padding: 'var(--crm-space-lg) var(--crm-space-2xl)' }}>
          <button type="button" onClick={onPreview} aria-label={t('mail.file.zoom')} style={{ width: 76, height: 76, borderRadius: 'var(--crm-radius-lg)', background: ms.card, border: `1px solid ${ms.bord}`, cursor: 'zoom-in', display: 'grid', placeItems: 'center', color: ms.mut }}><MEIcon name={att?.mime_type.startsWith('image/') ? 'image' : 'file-text'} size={28} /></button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att?.filename}</div>
            <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{ext} · {fileSizeLabel(att?.size_bytes ?? 0)}</div>
            <button type="button" onClick={onPreview} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, marginTop: 4, color: ms.accent, fontSize: 'var(--crm-text-xs)', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}><MEIcon name="maximize" size={12} color={ms.accent} /> {t('mail.file.zoom')}</button>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: ms.mut, marginBottom: 'var(--crm-space-sm)' }}>{t('mail.file.contact')}</div>
          <button type="button" onClick={() => setPickerOpen((v) => !v)} aria-expanded={pickerOpen} style={{ ...field, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ flex: 1 }}>{contact ? `${contact.first_name} ${contact.last_name}` : defaultContactId ? t('mail.file.contactCurrent') : t('mail.file.contactPlaceholder')}</span><MEIcon name="chevron-down" size={12} color={ms.mut} />
          </button>
          {pickerOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 310, background: ms.card, border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-4xl)', padding: 'var(--crm-space-md)', maxHeight: 290, overflowY: 'auto', boxShadow: ms.solidShadow }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('mail.link.searchPlaceholder')} aria-label={t('mail.link.search')} autoFocus style={{ ...field, fontSize: 'var(--crm-text-sm)' }} />
              <div style={{ marginTop: 'var(--crm-space-sm)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {(hits.data ?? []).map((h) => (
                  <button key={h.id} type="button" onClick={() => { setContact(h); setPickerOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', width: '100%', textAlign: 'left', padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', background: 'transparent', border: 'none', color: ms.ink, cursor: 'pointer', fontFamily: 'inherit', transition: MAIL_TRANSITION }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = ms.hover }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                    <span aria-hidden style={{ width: 28, height: 28, borderRadius: '50%', background: ms.elev, border: `1px solid ${ms.bord}`, display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-xs)', fontWeight: 700 }}>{initialsOf(`${h.first_name} ${h.last_name}`, h.email)}</span>
                    <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>{h.first_name} {h.last_name}</span><span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{h.email}</span></span>
                  </button>
                ))}
                {q.length >= 2 && hits.data?.length === 0 && <div style={{ padding: 'var(--crm-space-md)', fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{t('mail.link.empty')}</div>}
              </div>
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: ms.mut, marginBottom: 'var(--crm-space-sm)' }}>{t('mail.file.type')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-sm)' }}>
            {TYPES.map((k) => (
              <button key={k} type="button" aria-pressed={type === k} onClick={() => setType(k)} style={{ borderRadius: PILL, padding: 'var(--crm-space-xs) var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', fontWeight: 500, border: `1px solid ${type === k ? ms.accent : ms.bord3}`, background: type === k ? ms.accent : ms.elev, color: type === k ? ms.accentInk : ms.txt3, cursor: 'pointer', fontFamily: 'inherit', transition: MAIL_TRANSITION }}>{t(`mail.file.types.${k}`)}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: ms.mut, marginBottom: 'var(--crm-space-sm)' }}>{t('mail.file.name')}</div>
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label={t('mail.file.name')} style={field} />
        </div>
        {error && <div role="alert" style={{ fontSize: 'var(--crm-text-xs)', color: ms.danger }}>{error}</div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-4xl)' }}>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: ms.txt3, fontSize: 'var(--crm-text-md)', cursor: 'pointer', fontFamily: 'inherit' }}>{t('mail.actions.cancel')}</button>
        <button type="button" disabled={!contactId || busy} onClick={() => void submit()} style={{ background: ms.accent, color: ms.accentInk, border: 'none', borderRadius: PILL, padding: 'var(--crm-space-md) var(--crm-space-4xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, cursor: contactId && !busy ? 'pointer' : 'default', opacity: contactId && !busy ? 1 : 0.5, fontFamily: 'inherit' }}>{busy ? t('mail.file.busy') : t('mail.file.submit')}</button>
      </div>
    </MailModalShell>
  )
}
```
Branchement (les deux modales lisent `att` dans les messages du fil ouvert ; `const queryClient = useQueryClient()` en tête de `MessagerieApp`, import de `@tanstack/react-query`) :
```tsx
const attOf = (id: string) => thread.data?.flatMap((m) => m.mail_attachments).find((a) => a.id === id) ?? null
<MailAttachmentPreviewModal ms={ms} att={state.modal.kind === 'preview' ? attOf(state.modal.attachmentId) : null} onClose={() => dispatch({ type: 'modal', modal: { kind: 'none' } })} onFile={() => dispatch({ type: 'modal', modal: { kind: 'file', attachmentId: (state.modal as { attachmentId: string }).attachmentId } })} />
<MailFileAttachmentModal ms={ms} att={state.modal.kind === 'file' ? attOf(state.modal.attachmentId) : null} defaultContactId={selRow?.contact_id ?? null}
  onClose={() => dispatch({ type: 'modal', modal: { kind: 'none' } })} onPreview={() => dispatch({ type: 'modal', modal: { kind: 'preview', attachmentId: (state.modal as { attachmentId: string }).attachmentId } })}
  onFiled={() => { void queryClient.invalidateQueries({ queryKey: ['mail', 'thread', state.sel] }); dispatch({ type: 'modal', modal: { kind: 'none' } }) }} />
```

i18n FR :
```json
"preview": { "title": "Aperçu de la pièce", "loading": "Chargement…", "error": "La pièce n'a pas pu être chargée.", "download": "Télécharger" },
"file": { "cta": "Classer dans le dossier", "title": "Classer dans le dossier", "subtitle": "La pièce est copiée dans les documents du contact.", "filed": "Classé au dossier", "zoom": "Voir en grand", "contact": "Fiche contact", "contactCurrent": "Contact de ce fil", "contactPlaceholder": "Choisir un contact", "type": "Type de document", "name": "Nom dans le dossier", "submit": "Classer le document", "busy": "Classement…",
  "types": { "contrat": "Contrat", "mandat": "Mandat", "piece_identite": "Pièce d'identité", "justificatif_domicile": "Justificatif de domicile", "financement": "Financement", "plan": "Plan", "photo": "Photo", "autre": "Autre" },
  "err": { "unsupported": "Ce type de fichier n'est pas accepté dans les documents (PDF, JPEG, PNG, WebP, Word).", "generic": "Le classement a échoué. Réessayez." } }
```

```bash
npm run build && npm run lint && npm run lint:i18n
git add -A && git commit -m "feat(messagerie): aperçu de pièce et classement au dossier contact"
```

---

### Task 2.12 : i18n — consolidation FR et les trois autres langues

**Files:**
- Modify: `src/i18n/locales/{fr,de,en,it}/messages.json` (sous-arbre `mail`), `common.json` (`nav.messagerie`, `audit.action.*`), `settings.json` (`integrations.catalogue.messagerie.desc`)

- [ ] **Step 1 : FR — l'arbre complet (remplace les fragments posés tâche par tâche ; aucun tiret cadratin)**

```json
"mail": {
  "empty": { "noAccount": { "title": "Aucune boîte connectée", "body": "Connectez la boîte de l'agence ou la vôtre pour lire et répondre ici." }, "noMessage": "Aucun message ne correspond." },
  "box": { "label": "Boîte", "none": "Aucune boîte", "synced": "synchronisée", "disconnect": "Déconnecter", "disconnectConfirm": "Déconnecter cette boîte ? Ses messages seront retirés du CRM ; les documents classés restent.", "status": { "reauth_required": "Autorisation à renouveler", "error": "Erreur de synchronisation", "disabled": "Désactivée" } },
  "compose": { "cta": "Nouveau message", "title": "Nouveau message", "to": "Destinataire", "toPlaceholder": "À · destinataire", "subject": "Objet", "body": "Message", "attach": "Joindre un document", "fromComputer": "Depuis mon ordinateur", "agencyDocs": "Documents de l'agence", "noAgencyDocs": "Aucun document disponible.", "removeAttachment": "Retirer la pièce" },
  "folders": { "aria": "Dossiers", "in": "Boîte de réception", "arch": "Archivé", "star": "Suivis", "sent": "Envoyés", "draft": "Brouillons" },
  "labels": { "title": "Libellés", "new": "Nouveau libellé", "rename": "Renommer", "recolor": "Changer la couleur", "delete": "Supprimer", "namePlaceholder": "Nom du libellé", "custom": "Couleur personnalisée", "hue": "Teinte", "create": "Créer" },
  "actions": { "cancel": "Annuler", "save": "Enregistrer", "send": "Envoyer", "sending": "Envoi…", "forward": "Transférer", "close": "Fermer" },
  "list": { "search": "Recherche", "searchPlaceholder": "Chercher un expéditeur, un objet ...", "unread": "Non lus", "attachment": "Pièce jointe" },
  "pager": { "range": "{{from}} à {{to}} sur {{total}}", "prev": "Page précédente", "next": "Page suivante" },
  "row": { "star": "Suivre", "unstar": "Ne plus suivre", "noSubject": "(sans objet)" },
  "ctx": { "open": "Ouvrir", "markRead": "Marquer comme lu", "markUnread": "Marquer comme non lu", "star": "Suivre", "unstar": "Ne plus suivre", "archive": "Archiver", "unarchive": "Désarchiver", "delete": "Supprimer" },
  "draft": { "badge": "Brouillon", "noRecipient": "(sans destinataire)" },
  "read": { "back": "Retour à la liste", "to": "à {{box}}", "me": "moi", "reply": "Répondre", "forward": "Transférer", "replyTo": "Réponse à", "replyBody": "Votre réponse", "forwardNote": "Note facultative", "forwardOriginal": "Message d'origine joint", "showImages": "Afficher les images", "bodyTitle": "Corps du message", "truncated": "Message tronqué (trop volumineux) : ouvrez-le dans votre messagerie pour la version complète.", "unlinked": "Adresse non rattachée : {{email}}" },
  "link": { "cta": "Rapprocher", "title": "Rapprocher l'adresse", "search": "Recherche", "searchPlaceholder": "Nom, adresse ou téléphone", "empty": "Aucun contact trouvé.", "note": "L'adresse sera mémorisée pour cette fiche.", "create": "Créer la fiche" },
  "delete": { "title": "Supprimer ce message ?", "legal": "Le message part à la corbeille et quitte la liste. La conservation légale de dix ans s'applique au dossier, pas à la boîte." },
  "add": {
    "cta": "Ajouter une boîte", "title": "Ajouter une boîte", "back": "Retour", "share": "Partager cette boîte avec toute l'agence",
    "waSub": "Coexistence · app + Cloud API sur le même numéro", "imapSub": "Connexion IMAP / SMTP", "other": "Autre boîte (IMAP / SMTP)", "otherSub": "Configuration manuelle du serveur",
    "oauth": { "subtitle": "Autorisation du compte", "addr": "Adresse e-mail", "addrPlaceholder": "adresse@votre-agence.ch", "access": "Accès demandé",
      "scope": { "read": "Lire et envoyer les messages de cette boîte", "file": "Rattacher les échanges à la fiche contact", "labels": "Classer avec les libellés de l'agence" },
      "note": "Validation sur la page de {{provider}} · aucun mot de passe ne transite par l'agence.", "useImap": "Configurer en IMAP", "authorize": "Autoriser", "busy": "Connexion…",
      "err": { "popupBlocked": "La fenêtre a été bloquée par le navigateur. Nous ouvrons l'autorisation dans cet onglet.", "cancelled": "Autorisation annulée.", "timeout": "L'autorisation a expiré. Réessayez.", "denied": "L'accès a été refusé sur la page du fournisseur.", "notConfigured": "Ce fournisseur n'est pas encore configuré côté MEGGA.", "exchange": "La connexion a échoué : {{detail}}", "generic": "La connexion a échoué. Réessayez dans un instant." } },
    "imap": { "subtitle": "Connexion IMAP / SMTP", "email": "Adresse e-mail", "imapHost": "Serveur IMAP", "smtpHost": "Serveur SMTP", "port": "Port", "imapPort": "Port IMAP", "smtpPort": "Port SMTP", "user": "Utilisateur", "password": "Mot de passe", "encryption": "Chiffrement",
      "note": "Le test vérifie IMAP et SMTP avant l'ajout · les identifiants sont chiffrés au repos.", "test": "Tester et connecter", "unavailable": "La connexion IMAP arrive dans une prochaine version.",
      "err": { "invalid": "Adresse, serveurs et mot de passe sont requis.", "starttls": "STARTTLS (port 587) n'est pas disponible depuis nos serveurs. Utilisez SSL/TLS sur le port 465.", "connection": "Connexion refusée : vérifiez l'identifiant, le mot de passe (ou mot de passe d'application) et les serveurs.", "generic": "La connexion a échoué. Réessayez dans un instant." } },
    "done": { "title": "Boîte connectée", "sync": "Synchronisation", "syncValue": "90 derniers jours", "folders": "Dossiers importés", "foldersValue": "Réception, Envoyés", "linking": "Rattachement aux contacts", "linkingValue": "Actif", "another": "Ajouter une autre", "open": "Ouvrir la boîte" }
  },
  "callback": { "working": "Connexion de la boîte…", "closing": "Vous pouvez fermer cette fenêtre.", "denied": "Autorisation refusée ou incomplète.", "failed": "La connexion a échoué. {{detail}}" },
  "preview": { "title": "Aperçu de la pièce", "loading": "Chargement…", "error": "La pièce n'a pas pu être chargée.", "download": "Télécharger" },
  "file": { "cta": "Classer dans le dossier", "title": "Classer dans le dossier", "subtitle": "La pièce est copiée dans les documents du contact.", "filed": "Classé au dossier", "zoom": "Voir en grand", "contact": "Fiche contact", "contactCurrent": "Contact de ce fil", "contactPlaceholder": "Choisir un contact", "type": "Type de document", "name": "Nom dans le dossier", "submit": "Classer le document", "busy": "Classement…",
    "types": { "contrat": "Contrat", "mandat": "Mandat", "piece_identite": "Pièce d'identité", "justificatif_domicile": "Justificatif de domicile", "financement": "Financement", "plan": "Plan", "photo": "Photo", "autre": "Autre" },
    "err": { "unsupported": "Ce type de fichier n'est pas accepté dans les documents (PDF, JPEG, PNG, WebP, Word).", "generic": "Le classement a échoué. Réessayez." } },
  "mobile": { "readOnly": "Composer et répondre se font sur ordinateur pour l'instant." }
}
```
`common.json` (fr) : `nav.messagerie: "Messagerie"` ; `audit.action.email_received: "E-mail reçu"`, `audit.action.email_sent: "E-mail envoyé"`, `audit.action.document_filed_from_email: "Pièce classée depuis un e-mail"`.
`settings.json` (fr) : `integrations.catalogue.messagerie.desc: "Lisez et répondez à vos e-mails depuis le CRM (Google, Microsoft, IMAP)."`

- [ ] **Step 2 : EN**

```json
"mail": {
  "empty": { "noAccount": { "title": "No mailbox connected", "body": "Connect the agency mailbox or your own to read and reply here." }, "noMessage": "No message matches." },
  "box": { "label": "Mailbox", "none": "No mailbox", "synced": "synced", "disconnect": "Disconnect", "disconnectConfirm": "Disconnect this mailbox? Its messages are removed from the CRM; filed documents stay.", "status": { "reauth_required": "Authorization to renew", "error": "Sync error", "disabled": "Disabled" } },
  "compose": { "cta": "New message", "title": "New message", "to": "Recipient", "toPlaceholder": "To · recipient", "subject": "Subject", "body": "Message", "attach": "Attach a document", "fromComputer": "From my computer", "agencyDocs": "Agency documents", "noAgencyDocs": "No document available.", "removeAttachment": "Remove attachment" },
  "folders": { "aria": "Folders", "in": "Inbox", "arch": "Archived", "star": "Starred", "sent": "Sent", "draft": "Drafts" },
  "labels": { "title": "Labels", "new": "New label", "rename": "Rename", "recolor": "Change colour", "delete": "Delete", "namePlaceholder": "Label name", "custom": "Custom colour", "hue": "Hue", "create": "Create" },
  "actions": { "cancel": "Cancel", "save": "Save", "send": "Send", "sending": "Sending…", "forward": "Forward", "close": "Close" },
  "list": { "search": "Search", "searchPlaceholder": "Search a sender, a subject ...", "unread": "Unread", "attachment": "Attachment" },
  "pager": { "range": "{{from}} to {{to}} of {{total}}", "prev": "Previous page", "next": "Next page" },
  "row": { "star": "Star", "unstar": "Unstar", "noSubject": "(no subject)" },
  "ctx": { "open": "Open", "markRead": "Mark as read", "markUnread": "Mark as unread", "star": "Star", "unstar": "Unstar", "archive": "Archive", "unarchive": "Unarchive", "delete": "Delete" },
  "draft": { "badge": "Draft", "noRecipient": "(no recipient)" },
  "read": { "back": "Back to the list", "to": "to {{box}}", "me": "me", "reply": "Reply", "forward": "Forward", "replyTo": "Reply to", "replyBody": "Your reply", "forwardNote": "Optional note", "forwardOriginal": "Original message attached", "showImages": "Show images", "bodyTitle": "Message body", "truncated": "Message truncated (too large): open it in your mail client for the full version.", "unlinked": "Address not linked: {{email}}" },
  "link": { "cta": "Link", "title": "Link the address", "search": "Search", "searchPlaceholder": "Name, address or phone", "empty": "No contact found.", "note": "The address will be remembered for this contact.", "create": "Create the contact" },
  "delete": { "title": "Delete this message?", "legal": "The message goes to the trash and leaves the list. The ten-year legal retention applies to the file, not to the mailbox." },
  "add": {
    "cta": "Add a mailbox", "title": "Add a mailbox", "back": "Back", "share": "Share this mailbox with the whole agency",
    "waSub": "Coexistence · app + Cloud API on the same number", "imapSub": "IMAP / SMTP connection", "other": "Other mailbox (IMAP / SMTP)", "otherSub": "Manual server configuration",
    "oauth": { "subtitle": "Account authorization", "addr": "Email address", "addrPlaceholder": "address@your-agency.ch", "access": "Access requested",
      "scope": { "read": "Read and send messages of this mailbox", "file": "Link conversations to the contact record", "labels": "Classify with the agency labels" },
      "note": "Validation on the {{provider}} page · no password goes through the agency.", "useImap": "Set up with IMAP", "authorize": "Authorize", "busy": "Connecting…",
      "err": { "popupBlocked": "The window was blocked by the browser. We are opening the authorization in this tab.", "cancelled": "Authorization cancelled.", "timeout": "The authorization expired. Try again.", "denied": "Access was refused on the provider page.", "notConfigured": "This provider is not configured on the MEGGA side yet.", "exchange": "The connection failed: {{detail}}", "generic": "The connection failed. Try again in a moment." } },
    "imap": { "subtitle": "IMAP / SMTP connection", "email": "Email address", "imapHost": "IMAP server", "smtpHost": "SMTP server", "port": "Port", "imapPort": "IMAP port", "smtpPort": "SMTP port", "user": "Username", "password": "Password", "encryption": "Encryption",
      "note": "The test checks IMAP and SMTP before adding · credentials are encrypted at rest.", "test": "Test and connect", "unavailable": "IMAP connection is coming in a next version.",
      "err": { "invalid": "Address, servers and password are required.", "starttls": "STARTTLS (port 587) is not available from our servers. Use SSL/TLS on port 465.", "connection": "Connection refused: check the login, the password (or app password) and the servers.", "generic": "The connection failed. Try again in a moment." } },
    "done": { "title": "Mailbox connected", "sync": "Synchronization", "syncValue": "Last 90 days", "folders": "Imported folders", "foldersValue": "Inbox, Sent", "linking": "Contact linking", "linkingValue": "Active", "another": "Add another", "open": "Open the mailbox" }
  },
  "callback": { "working": "Connecting the mailbox…", "closing": "You can close this window.", "denied": "Authorization refused or incomplete.", "failed": "The connection failed. {{detail}}" },
  "preview": { "title": "Attachment preview", "loading": "Loading…", "error": "The attachment could not be loaded.", "download": "Download" },
  "file": { "cta": "File in the record", "title": "File in the record", "subtitle": "The attachment is copied into the contact's documents.", "filed": "Filed in the record", "zoom": "View full size", "contact": "Contact record", "contactCurrent": "Contact of this thread", "contactPlaceholder": "Choose a contact", "type": "Document type", "name": "Name in the record", "submit": "File the document", "busy": "Filing…",
    "types": { "contrat": "Contract", "mandat": "Mandate", "piece_identite": "Identity document", "justificatif_domicile": "Proof of address", "financement": "Financing", "plan": "Plan", "photo": "Photo", "autre": "Other" },
    "err": { "unsupported": "This file type is not accepted in documents (PDF, JPEG, PNG, WebP, Word).", "generic": "Filing failed. Try again." } },
  "mobile": { "readOnly": "Composing and replying are done on desktop for now." }
}
```
`common.json` (en) : `nav.messagerie: "Mail"` ; `audit.action.email_received: "Email received"`, `email_sent: "Email sent"`, `document_filed_from_email: "Attachment filed from an email"`. `settings.json` (en) : `"Read and reply to your emails from the CRM (Google, Microsoft, IMAP)."`

- [ ] **Step 3 : DE**

```json
"mail": {
  "empty": { "noAccount": { "title": "Kein Postfach verbunden", "body": "Verbinden Sie das Postfach der Agentur oder Ihr eigenes, um hier zu lesen und zu antworten." }, "noMessage": "Keine Nachricht entspricht der Suche." },
  "box": { "label": "Postfach", "none": "Kein Postfach", "synced": "synchronisiert", "disconnect": "Trennen", "disconnectConfirm": "Dieses Postfach trennen? Seine Nachrichten werden aus dem CRM entfernt; abgelegte Dokumente bleiben.", "status": { "reauth_required": "Berechtigung erneuern", "error": "Synchronisierungsfehler", "disabled": "Deaktiviert" } },
  "compose": { "cta": "Neue Nachricht", "title": "Neue Nachricht", "to": "Empfänger", "toPlaceholder": "An · Empfänger", "subject": "Betreff", "body": "Nachricht", "attach": "Dokument anhängen", "fromComputer": "Von meinem Computer", "agencyDocs": "Dokumente der Agentur", "noAgencyDocs": "Kein Dokument verfügbar.", "removeAttachment": "Anhang entfernen" },
  "folders": { "aria": "Ordner", "in": "Posteingang", "arch": "Archiviert", "star": "Markiert", "sent": "Gesendet", "draft": "Entwürfe" },
  "labels": { "title": "Labels", "new": "Neues Label", "rename": "Umbenennen", "recolor": "Farbe ändern", "delete": "Löschen", "namePlaceholder": "Name des Labels", "custom": "Eigene Farbe", "hue": "Farbton", "create": "Erstellen" },
  "actions": { "cancel": "Abbrechen", "save": "Speichern", "send": "Senden", "sending": "Wird gesendet…", "forward": "Weiterleiten", "close": "Schliessen" },
  "list": { "search": "Suche", "searchPlaceholder": "Absender, Betreff suchen ...", "unread": "Ungelesen", "attachment": "Anhang" },
  "pager": { "range": "{{from}} bis {{to}} von {{total}}", "prev": "Vorherige Seite", "next": "Nächste Seite" },
  "row": { "star": "Markieren", "unstar": "Markierung entfernen", "noSubject": "(kein Betreff)" },
  "ctx": { "open": "Öffnen", "markRead": "Als gelesen markieren", "markUnread": "Als ungelesen markieren", "star": "Markieren", "unstar": "Markierung entfernen", "archive": "Archivieren", "unarchive": "Aus Archiv holen", "delete": "Löschen" },
  "draft": { "badge": "Entwurf", "noRecipient": "(kein Empfänger)" },
  "read": { "back": "Zurück zur Liste", "to": "an {{box}}", "me": "ich", "reply": "Antworten", "forward": "Weiterleiten", "replyTo": "Antwort an", "replyBody": "Ihre Antwort", "forwardNote": "Optionale Notiz", "forwardOriginal": "Originalnachricht angehängt", "showImages": "Bilder anzeigen", "bodyTitle": "Nachrichtentext", "truncated": "Nachricht gekürzt (zu gross): öffnen Sie sie in Ihrem Mailprogramm für die vollständige Version.", "unlinked": "Adresse nicht zugeordnet: {{email}}" },
  "link": { "cta": "Zuordnen", "title": "Adresse zuordnen", "search": "Suche", "searchPlaceholder": "Name, Adresse oder Telefon", "empty": "Kein Kontakt gefunden.", "note": "Die Adresse wird für diesen Kontakt gespeichert.", "create": "Kontakt anlegen" },
  "delete": { "title": "Diese Nachricht löschen?", "legal": "Die Nachricht wandert in den Papierkorb und verlässt die Liste. Die gesetzliche Aufbewahrung von zehn Jahren gilt für das Dossier, nicht für das Postfach." },
  "add": {
    "cta": "Postfach hinzufügen", "title": "Postfach hinzufügen", "back": "Zurück", "share": "Dieses Postfach mit der ganzen Agentur teilen",
    "waSub": "Koexistenz · App + Cloud API auf derselben Nummer", "imapSub": "IMAP-/SMTP-Verbindung", "other": "Anderes Postfach (IMAP / SMTP)", "otherSub": "Manuelle Serverkonfiguration",
    "oauth": { "subtitle": "Kontoberechtigung", "addr": "E-Mail-Adresse", "addrPlaceholder": "adresse@ihre-agentur.ch", "access": "Angeforderter Zugriff",
      "scope": { "read": "Nachrichten dieses Postfachs lesen und senden", "file": "Gespräche dem Kontakt zuordnen", "labels": "Mit den Labels der Agentur klassieren" },
      "note": "Bestätigung auf der Seite von {{provider}} · kein Passwort läuft über die Agentur.", "useImap": "Mit IMAP einrichten", "authorize": "Autorisieren", "busy": "Verbinden…",
      "err": { "popupBlocked": "Das Fenster wurde vom Browser blockiert. Wir öffnen die Autorisierung in diesem Tab.", "cancelled": "Autorisierung abgebrochen.", "timeout": "Die Autorisierung ist abgelaufen. Versuchen Sie es erneut.", "denied": "Der Zugriff wurde auf der Anbieterseite verweigert.", "notConfigured": "Dieser Anbieter ist bei MEGGA noch nicht konfiguriert.", "exchange": "Die Verbindung ist fehlgeschlagen: {{detail}}", "generic": "Die Verbindung ist fehlgeschlagen. Versuchen Sie es gleich noch einmal." } },
    "imap": { "subtitle": "IMAP-/SMTP-Verbindung", "email": "E-Mail-Adresse", "imapHost": "IMAP-Server", "smtpHost": "SMTP-Server", "port": "Port", "imapPort": "IMAP-Port", "smtpPort": "SMTP-Port", "user": "Benutzername", "password": "Passwort", "encryption": "Verschlüsselung",
      "note": "Der Test prüft IMAP und SMTP vor dem Hinzufügen · die Zugangsdaten werden verschlüsselt gespeichert.", "test": "Testen und verbinden", "unavailable": "Die IMAP-Verbindung kommt in einer nächsten Version.",
      "err": { "invalid": "Adresse, Server und Passwort sind erforderlich.", "starttls": "STARTTLS (Port 587) ist von unseren Servern aus nicht verfügbar. Verwenden Sie SSL/TLS auf Port 465.", "connection": "Verbindung abgelehnt: Prüfen Sie Benutzername, Passwort (oder App-Passwort) und Server.", "generic": "Die Verbindung ist fehlgeschlagen. Versuchen Sie es gleich noch einmal." } },
    "done": { "title": "Postfach verbunden", "sync": "Synchronisierung", "syncValue": "Letzte 90 Tage", "folders": "Importierte Ordner", "foldersValue": "Posteingang, Gesendet", "linking": "Kontaktzuordnung", "linkingValue": "Aktiv", "another": "Weiteres hinzufügen", "open": "Postfach öffnen" }
  },
  "callback": { "working": "Postfach wird verbunden…", "closing": "Sie können dieses Fenster schliessen.", "denied": "Autorisierung verweigert oder unvollständig.", "failed": "Die Verbindung ist fehlgeschlagen. {{detail}}" },
  "preview": { "title": "Vorschau des Anhangs", "loading": "Wird geladen…", "error": "Der Anhang konnte nicht geladen werden.", "download": "Herunterladen" },
  "file": { "cta": "Im Dossier ablegen", "title": "Im Dossier ablegen", "subtitle": "Der Anhang wird in die Dokumente des Kontakts kopiert.", "filed": "Im Dossier abgelegt", "zoom": "Gross anzeigen", "contact": "Kontakt", "contactCurrent": "Kontakt dieses Gesprächs", "contactPlaceholder": "Kontakt wählen", "type": "Dokumenttyp", "name": "Name im Dossier", "submit": "Dokument ablegen", "busy": "Wird abgelegt…",
    "types": { "contrat": "Vertrag", "mandat": "Mandat", "piece_identite": "Ausweisdokument", "justificatif_domicile": "Wohnsitznachweis", "financement": "Finanzierung", "plan": "Plan", "photo": "Foto", "autre": "Anderes" },
    "err": { "unsupported": "Dieser Dateityp wird in den Dokumenten nicht akzeptiert (PDF, JPEG, PNG, WebP, Word).", "generic": "Das Ablegen ist fehlgeschlagen. Versuchen Sie es erneut." } },
  "mobile": { "readOnly": "Verfassen und Antworten sind vorerst am Computer möglich." }
}
```
`common.json` (de) : `nav.messagerie: "Nachrichten"` ; `audit.action.email_received: "E-Mail erhalten"`, `email_sent: "E-Mail gesendet"`, `document_filed_from_email: "Anhang aus einer E-Mail abgelegt"`. `settings.json` (de) : `"Lesen und beantworten Sie Ihre E-Mails aus dem CRM (Google, Microsoft, IMAP)."`

- [ ] **Step 4 : IT**

```json
"mail": {
  "empty": { "noAccount": { "title": "Nessuna casella collegata", "body": "Collega la casella dell'agenzia o la tua per leggere e rispondere qui." }, "noMessage": "Nessun messaggio corrisponde." },
  "box": { "label": "Casella", "none": "Nessuna casella", "synced": "sincronizzata", "disconnect": "Scollega", "disconnectConfirm": "Scollegare questa casella? I suoi messaggi saranno rimossi dal CRM; i documenti archiviati restano.", "status": { "reauth_required": "Autorizzazione da rinnovare", "error": "Errore di sincronizzazione", "disabled": "Disattivata" } },
  "compose": { "cta": "Nuovo messaggio", "title": "Nuovo messaggio", "to": "Destinatario", "toPlaceholder": "A · destinatario", "subject": "Oggetto", "body": "Messaggio", "attach": "Allega un documento", "fromComputer": "Dal mio computer", "agencyDocs": "Documenti dell'agenzia", "noAgencyDocs": "Nessun documento disponibile.", "removeAttachment": "Rimuovi allegato" },
  "folders": { "aria": "Cartelle", "in": "Posta in arrivo", "arch": "Archiviati", "star": "Speciali", "sent": "Inviati", "draft": "Bozze" },
  "labels": { "title": "Etichette", "new": "Nuova etichetta", "rename": "Rinomina", "recolor": "Cambia colore", "delete": "Elimina", "namePlaceholder": "Nome dell'etichetta", "custom": "Colore personalizzato", "hue": "Tonalità", "create": "Crea" },
  "actions": { "cancel": "Annulla", "save": "Salva", "send": "Invia", "sending": "Invio…", "forward": "Inoltra", "close": "Chiudi" },
  "list": { "search": "Ricerca", "searchPlaceholder": "Cerca un mittente, un oggetto ...", "unread": "Non letti", "attachment": "Allegato" },
  "pager": { "range": "{{from}} a {{to}} di {{total}}", "prev": "Pagina precedente", "next": "Pagina successiva" },
  "row": { "star": "Segna", "unstar": "Togli segno", "noSubject": "(senza oggetto)" },
  "ctx": { "open": "Apri", "markRead": "Segna come letto", "markUnread": "Segna come non letto", "star": "Segna", "unstar": "Togli segno", "archive": "Archivia", "unarchive": "Ripristina", "delete": "Elimina" },
  "draft": { "badge": "Bozza", "noRecipient": "(senza destinatario)" },
  "read": { "back": "Torna all'elenco", "to": "a {{box}}", "me": "io", "reply": "Rispondi", "forward": "Inoltra", "replyTo": "Risposta a", "replyBody": "La tua risposta", "forwardNote": "Nota facoltativa", "forwardOriginal": "Messaggio originale allegato", "showImages": "Mostra immagini", "bodyTitle": "Corpo del messaggio", "truncated": "Messaggio troncato (troppo grande): aprilo nel tuo client di posta per la versione completa.", "unlinked": "Indirizzo non associato: {{email}}" },
  "link": { "cta": "Associa", "title": "Associa l'indirizzo", "search": "Ricerca", "searchPlaceholder": "Nome, indirizzo o telefono", "empty": "Nessun contatto trovato.", "note": "L'indirizzo sarà memorizzato per questa scheda.", "create": "Crea la scheda" },
  "delete": { "title": "Eliminare questo messaggio?", "legal": "Il messaggio va nel cestino e lascia l'elenco. La conservazione legale di dieci anni si applica al dossier, non alla casella." },
  "add": {
    "cta": "Aggiungi una casella", "title": "Aggiungi una casella", "back": "Indietro", "share": "Condividi questa casella con tutta l'agenzia",
    "waSub": "Coesistenza · app + Cloud API sullo stesso numero", "imapSub": "Connessione IMAP / SMTP", "other": "Altra casella (IMAP / SMTP)", "otherSub": "Configurazione manuale del server",
    "oauth": { "subtitle": "Autorizzazione dell'account", "addr": "Indirizzo e-mail", "addrPlaceholder": "indirizzo@tua-agenzia.ch", "access": "Accesso richiesto",
      "scope": { "read": "Leggere e inviare i messaggi di questa casella", "file": "Associare le conversazioni alla scheda contatto", "labels": "Classificare con le etichette dell'agenzia" },
      "note": "Conferma sulla pagina di {{provider}} · nessuna password passa dall'agenzia.", "useImap": "Configura con IMAP", "authorize": "Autorizza", "busy": "Connessione…",
      "err": { "popupBlocked": "La finestra è stata bloccata dal browser. Apriamo l'autorizzazione in questa scheda.", "cancelled": "Autorizzazione annullata.", "timeout": "L'autorizzazione è scaduta. Riprova.", "denied": "L'accesso è stato rifiutato sulla pagina del fornitore.", "notConfigured": "Questo fornitore non è ancora configurato lato MEGGA.", "exchange": "La connessione non è riuscita: {{detail}}", "generic": "La connessione non è riuscita. Riprova tra un istante." } },
    "imap": { "subtitle": "Connessione IMAP / SMTP", "email": "Indirizzo e-mail", "imapHost": "Server IMAP", "smtpHost": "Server SMTP", "port": "Porta", "imapPort": "Porta IMAP", "smtpPort": "Porta SMTP", "user": "Utente", "password": "Password", "encryption": "Cifratura",
      "note": "Il test verifica IMAP e SMTP prima dell'aggiunta · le credenziali sono cifrate a riposo.", "test": "Testa e collega", "unavailable": "La connessione IMAP arriverà in una prossima versione.",
      "err": { "invalid": "Indirizzo, server e password sono obbligatori.", "starttls": "STARTTLS (porta 587) non è disponibile dai nostri server. Usa SSL/TLS sulla porta 465.", "connection": "Connessione rifiutata: verifica utente, password (o password per app) e server.", "generic": "La connessione non è riuscita. Riprova tra un istante." } },
    "done": { "title": "Casella collegata", "sync": "Sincronizzazione", "syncValue": "Ultimi 90 giorni", "folders": "Cartelle importate", "foldersValue": "Posta in arrivo, Inviati", "linking": "Associazione ai contatti", "linkingValue": "Attiva", "another": "Aggiungine un'altra", "open": "Apri la casella" }
  },
  "callback": { "working": "Collegamento della casella…", "closing": "Puoi chiudere questa finestra.", "denied": "Autorizzazione rifiutata o incompleta.", "failed": "La connessione non è riuscita. {{detail}}" },
  "preview": { "title": "Anteprima dell'allegato", "loading": "Caricamento…", "error": "Impossibile caricare l'allegato.", "download": "Scarica" },
  "file": { "cta": "Archivia nel dossier", "title": "Archivia nel dossier", "subtitle": "L'allegato viene copiato nei documenti del contatto.", "filed": "Archiviato nel dossier", "zoom": "Vedi a grandezza reale", "contact": "Scheda contatto", "contactCurrent": "Contatto di questa conversazione", "contactPlaceholder": "Scegli un contatto", "type": "Tipo di documento", "name": "Nome nel dossier", "submit": "Archivia il documento", "busy": "Archiviazione…",
    "types": { "contrat": "Contratto", "mandat": "Mandato", "piece_identite": "Documento d'identità", "justificatif_domicile": "Prova di domicilio", "financement": "Finanziamento", "plan": "Planimetria", "photo": "Foto", "autre": "Altro" },
    "err": { "unsupported": "Questo tipo di file non è accettato nei documenti (PDF, JPEG, PNG, WebP, Word).", "generic": "L'archiviazione non è riuscita. Riprova." } },
  "mobile": { "readOnly": "Scrivere e rispondere si fanno da computer per ora." }
}
```
`common.json` (it) : `nav.messagerie: "Messaggi"` ; `audit.action.email_received: "E-mail ricevuta"`, `email_sent: "E-mail inviata"`, `document_filed_from_email: "Allegato archiviato da un'e-mail"`. `settings.json` (it) : `"Leggi e rispondi alle tue e-mail dal CRM (Google, Microsoft, IMAP)."`

- [ ] **Step 5 : Portes et commit**

```bash
npm run lint:i18n && npm run i18n:parity:ci && npm run lint:prose && npm run i18n:coverage:ci
git add src/i18n && git commit -m "i18n(messagerie): sous-arbre mail en FR/EN/DE/IT, nav, actions d'audit"
```
⚠ `i18n:coverage:ci` est un cliquet : si le compte de clés DE/IT non traduites monte, il rougit — ici tout est traduit, il doit rester vert.

---

### Task 2.13 : Banc `/dev/messagerie`, fixtures, gardes de contraste et de grammaire, visuel

**Files:**
- Create: `src/components/crm/messagerie/fixtures.ts`
- Create: `tests/unit/messagerie-contraste.spec.ts`
- Modify: `src/hooks/useMailAccounts.ts`, `useMailLabels.ts`, `useMailThreads.ts`, `useMailThread.ts`, `useMailDrafts.ts` (mode fixtures), `tests/unit/megga-x-grammar.spec.ts` (`ZONES`), `tests/e2e/visual-regression.spec.ts`

- [ ] **Step 1 : Fixtures (données visiblement fausses, README §« Données » : 8 rédigés + générés)**

```ts
// src/components/crm/messagerie/fixtures.ts
// Jeu de données du banc /dev/messagerie. TOUT est faux et se voit faux (@exemple.ch,
// noms de scène) : un banc ne montre jamais une fiche qui pourrait exister.
import { createContext, useContext } from 'react'
import type { MailAccount } from '@/hooks/useMailAccounts'
import type { MailLabel } from '@/hooks/useMailLabels'
import type { MailThreadRow } from '@/hooks/useMailThreads'
import type { MailMessageRow } from '@/hooks/useMailThread'

export type MailFixtureState = 'full' | 'empty' | 'none'
export const MailFixturesContext = createContext<MailFixtureState | null>(null)
export const useMailFixtures = () => useContext(MailFixturesContext)
export function MailFixturesProvider({ state, children }: { state: MailFixtureState; children: React.ReactNode }) {
  return <MailFixturesContext.Provider value={state}>{children}</MailFixturesContext.Provider>
}

const AG = 'fx-agency'
export const FX_ACCOUNTS: MailAccount[] = [
  { id: 'fx-a1', agency_id: AG, owner_id: 'fx-u1', provider: 'gmail', email: 'contact@agence-exemple.ch', display_name: 'Boîte générale', visibility: 'agency', status: 'active', last_sync_at: '2026-09-03T08:00:00Z', last_error: null, created_at: '2026-08-01T00:00:00Z' },
  { id: 'fx-a2', agency_id: AG, owner_id: 'fx-u1', provider: 'outlook', email: 'facturation@agence-exemple.ch', display_name: 'Facturation', visibility: 'agency', status: 'active', last_sync_at: '2026-09-03T08:00:00Z', last_error: null, created_at: '2026-08-01T00:00:00Z' },
  { id: 'fx-a3', agency_id: AG, owner_id: 'fx-u1', provider: 'imap', email: 'j.exemple@agence-exemple.ch', display_name: 'J. Exemple · personnelle', visibility: 'owner', status: 'reauth_required', last_sync_at: null, last_error: 'invalid_grant', created_at: '2026-08-01T00:00:00Z' },
]
export const FX_LABELS: MailLabel[] = [
  { id: 'fx-l1', agency_id: AG, name: 'À traiter', color: '#fe566b', position: 0, is_default: true },
  { id: 'fx-l2', agency_id: AG, name: 'Banques', color: '#8dc1ff', position: 1, is_default: true },
  { id: 'fx-l3', agency_id: AG, name: 'Notaires', color: '#efc42c', position: 2, is_default: true },
  { id: 'fx-l4', agency_id: AG, name: 'Clients', color: '#adecbb', position: 3, is_default: true },
  { id: 'fx-l5', agency_id: AG, name: 'Visites', color: '#424bfb', position: 4, is_default: true },
  { id: 'fx-l6', agency_id: AG, name: 'Fournisseurs', color: '#686868', position: 5, is_default: true },
]
const T = (i: number, over: Partial<MailThreadRow>): MailThreadRow => ({
  id: `fx-t${i}`, account_id: 'fx-a1', subject: `Objet d'exemple ${i}`, snippet: 'Extrait d\'exemple, texte de remplissage sans contenu réel.', from_name: `Expéditeur ${i}`, from_email: `exp${i}@exemple.ch`,
  participants: [{ name: `Expéditeur ${i}`, email: `exp${i}@exemple.ch` }], last_message_at: new Date(Date.UTC(2026, 7, 27 - (i % 60), 8, 29)).toISOString(), has_attachments: i % 4 === 0,
  is_read: i % 3 !== 0, is_starred: i % 7 === 0, is_archived: false, is_trashed: false, label_id: FX_LABELS[i % 6].id, contact_id: i % 2 === 0 ? 'fx-c1' : null, message_count: 1 + (i % 3), total: 48, ...over,
})
export const FX_THREADS: MailThreadRow[] = [
  T(1, { subject: 'Visite de samedi · confirmation', from_name: 'Zoé Exemple', from_email: 'zoe@exemple.ch', is_read: false, label_id: 'fx-l4', last_message_at: '2026-09-03T06:29:00Z' }),
  T(2, { subject: 'Attestation de financement', from_name: 'Banque Exemple SA', from_email: 'credit@banque-exemple.ch', has_attachments: true, label_id: 'fx-l2', last_message_at: '2026-09-02T15:00:00Z' }),
  T(3, { subject: 'Projet d\'acte · rue Fictive 12', from_name: 'Étude Exemple', from_email: 'etude@notaire-exemple.ch', has_attachments: true, label_id: 'fx-l3' }),
  ...Array.from({ length: 45 }, (_, k) => T(k + 4, {})),
]
export const FX_MESSAGES: MailMessageRow[] = [
  { id: 'fx-m1', thread_id: 'fx-t1', direction: 'inbound', from_name: 'Zoé Exemple', from_email: 'zoe@exemple.ch', to: [{ name: null, email: 'contact@agence-exemple.ch' }], cc: [], subject: 'Visite de samedi · confirmation', snippet: 'Bonjour, je confirme la visite de samedi à 10h.', body_text: 'Bonjour,\n\nJe confirme la visite de samedi à 10h. Est-il possible de voir aussi la cave ?\n\nMerci, Zoé', body_html: null, body_truncated: false, sent_at: '2026-09-03T06:29:00Z', is_read: false, has_attachments: false, contact_id: 'fx-c1', mail_attachments: [] },
  { id: 'fx-m2', thread_id: 'fx-t2', direction: 'inbound', from_name: 'Banque Exemple SA', from_email: 'credit@banque-exemple.ch', to: [{ name: null, email: 'contact@agence-exemple.ch' }], cc: [], subject: 'Attestation de financement', snippet: 'Veuillez trouver ci-joint l\'attestation.', body_text: 'Bonjour,\n\nVeuillez trouver ci-joint l\'attestation de financement de votre client.\n\nCordialement', body_html: '<p>Bonjour,</p><p>Veuillez trouver ci-joint l\'attestation de financement de votre client.</p><p>Cordialement</p>', body_truncated: false, sent_at: '2026-09-02T15:00:00Z', is_read: true, has_attachments: true, contact_id: null, mail_attachments: [{ id: 'fx-att1', message_id: 'fx-m2', filename: 'attestation-exemple.pdf', mime_type: 'application/pdf', size_bytes: 184320, is_inline: false, content_id: null, document_id: null }] },
  { id: 'fx-m3', thread_id: 'fx-t2', direction: 'outbound', from_name: 'Boîte générale', from_email: 'contact@agence-exemple.ch', to: [{ name: 'Banque Exemple SA', email: 'credit@banque-exemple.ch' }], cc: [], subject: 'Re: Attestation de financement', snippet: 'Bien reçu, merci.', body_text: 'Bien reçu, merci.', body_html: null, body_truncated: false, sent_at: '2026-09-02T16:10:00Z', is_read: true, has_attachments: false, contact_id: null, mail_attachments: [] },
]
export function fxThreads(state: MailFixtureState, accountId: string | null, folder: string, page: number, perPage: number): { rows: MailThreadRow[]; total: number } {
  if (state !== 'full' || !accountId) return { rows: [], total: 0 }
  const all = FX_THREADS.filter((t) => t.account_id === accountId && (folder === 'in' ? !t.is_archived : folder === 'star' ? t.is_starred : folder === 'arch' ? t.is_archived : folder === 'sent' ? t.message_count > 1 : false))
  return { rows: all.slice(page * perPage, (page + 1) * perPage).map((r) => ({ ...r, total: all.length })), total: all.length }
}
```
(Le fichier est un `.tsx` s'il porte du JSX : nommer `fixtures.tsx`.)

- [ ] **Step 2 : Mode fixtures dans les hooks de lecture**

Dans `useMailAccounts` : `const fx = useMailFixtures()` ; `enabled: !!user && !fx` sur les deux `useQuery` ; retour `list: fx ? (fx === 'none' ? [] : FX_ACCOUNTS) : list.data ?? []`, `unread: fx ? { 'fx-a1': 3 } : …`, et **`isLoading: fx ? false : list.isPending`** — ⛔ une requête `enabled: false` reste `isPending` pour toujours (mémoire `project_react_query_isloading_vs_ispending`) : sans cette ligne le banc affiche un écran vide. Même `isLoading` explicite dans `useMailThreads` (`fx ? false : q.isPending`), `useMailThread`, `useMailLabels`, `useMailDrafts`. Même geste dans `useMailLabels` (`FX_LABELS`), `useMailThreads` (`fxThreads(fx, accountId, f.folder, f.page, MAIL_PER_PAGE)`), `useMailFolderCounts` (`{ inbox_unread: 3, archived: 2, drafts: 1, label_counts: { 'fx-l1': 8, 'fx-l2': 7, 'fx-l3': 6, 'fx-l4': 12, 'fx-l5': 9, 'fx-l6': 6 } }`), `useMailThread` (`FX_MESSAGES.filter(m => m.thread_id === threadId)`), `useMailDrafts` (`[]`). Les mutations restent réelles mais inertes sans compte réel (elles échouent en 404, ce qui est correct sur un banc). `useMailRealtime` : `if (!agencyId || fx) return`.

- [ ] **Step 3 : Garde de contraste**

```ts
// tests/unit/messagerie-contraste.spec.ts
// L'encre posée sur un aplat de DONNÉE (couleur de libellé, accent) doit venir d'encreSur /
// ms.pillInk, jamais d'un blanc en dur — modèle contacts-contraste.spec.ts.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { encreSur } from '@/components/megga-x-crm/tokens'

const FILES = ['MailListRow.tsx', 'MailReader.tsx', 'MailRail.tsx', 'MailContextMenu.tsx', 'MailBoxSelector.tsx', 'MailLabelCreator.tsx', 'MailAddAccountModal.tsx', 'MailAttachmentPreviewModal.tsx']
  .map((f) => `src/components/crm/messagerie/${f}`)

describe('Messagerie — encre sur aplat', () => {
  it('aucun blanc ni noir en dur, aucune police en dur', () => {
    for (const f of FILES) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).not.toMatch(/#fff\b|#ffffff|#000\b|#000000|'white'|'black'/i)
      expect(src, f).not.toMatch(/Poppins|Manrope|Inter Tight/)
    }
  })
  it('la pastille de libellé calcule son encre', () => {
    const row = readFileSync('src/components/crm/messagerie/MailListRow.tsx', 'utf8')
    expect(row).toMatch(/ms\.pillInk\(label\.color\)/)
    const reader = readFileSync('src/components/crm/messagerie/MailReader.tsx', 'utf8')
    expect(reader).toMatch(/ms\.pillInk\(p\.label\.color\)/)
  })
  it('les six couleurs semées portent une encre AA', () => {
    for (const bg of ['#fe566b', '#8dc1ff', '#efc42c', '#adecbb', '#424bfb', '#686868']) {
      expect(typeof encreSur(bg)).toBe('string')
    }
  })
})
```
Puis `tests/unit/megga-x-grammar.spec.ts` : ajouter dans `ZONES` une entrée `src/components/crm/messagerie` calquée sur celle de `crm/biens` (mêmes seuils), et lancer `npx vitest run tests/unit/megga-x-grammar.spec.ts` — si le cliquet rougit sur un poids ou une casse, corriger le composant, pas le seuil.

- [ ] **Step 4 : Régression visuelle**

Ajouter `/dev/messagerie` à la liste des pages de `tests/e2e/visual-regression.spec.ts` (repérer la liste : `grep -n "/dev/" tests/e2e/visual-regression.spec.ts`), générer la référence :
```bash
npm run test:e2e:visual -- --update-snapshots
```
et committer les captures. ⚠ Mémoire `project_visual_regression_gate_too_loose` : régénérer ne redéclenche pas la CI ; pousser un commit.

- [ ] **Step 5 : Toutes les gardes, commit**

```bash
npm run test:unit && npm run build && npm run lint && npm run lint:deadcode
git add -A && git commit -m "test(messagerie): banc /dev/messagerie, fixtures, garde de contraste, zone de grammaire, visuel"
```

---

### Task 2.14 : Réglages › Intégrations, timeline contact, mobile minimal

**Files:**
- Modify: `src/components/crm/settings/IntegrationsSection.tsx`
- Create: `src/components/crm-mobile/messagerie/MobileMessagerieScreen.tsx`

- [ ] **Step 1 : Carte « Messagerie » dans le catalogue des intégrations**

`IntegrationsSection.tsx` : `type ProviderId = 'google' | 'microsoft' | 'skribble' | 'whatsapp' | 'messagerie'` ; dans `CATALOGUE`, après WhatsApp :
```ts
  { id: 'messagerie', category: 'messaging', provider: 'messagerie', name: 'Messagerie', descKey: 'integrations.catalogue.messagerie.desc', logoBg: '#FFFFFF', logo: <MEIcon name="mail" size={22} />, connectable: true, connected: false },
```
Au render (là où Google/Microsoft/WhatsApp surchargent `connected`/`account` depuis les hooks, `:905-950`) : `const mail = useMailAccounts()` puis pour `messagerie` : `connected: mail.list.length > 0`, `account: mail.list.map((a) => a.email).join(', ')`. Dans `handleConnect` (`:958-976`) : `case 'messagerie': navigate('/dashboard/messagerie?add=1'); break` ; `disconnect` pour `messagerie` : `navigate('/dashboard/messagerie')` (la déconnexion se fait boîte par boîte dans le sélecteur — à ajouter au menu du sélecteur : une entrée « Déconnecter » par boîte, protégée par `window.confirm(t('mail.box.disconnectConfirm'))`, qui appelle `accounts.disconnect.mutate(id)` ; libellé `t('mail.box.disconnect')` ; clés déjà posées en T2.12 (`mail.box.disconnect`, `mail.box.disconnectConfirm`) : « Déconnecter cette boîte ? Ses messages seront retirés du CRM ; les documents classés restent. » / "Disconnect this mailbox? Its messages are removed from the CRM; filed documents stay." / „Dieses Postfach trennen? Seine Nachrichten werden aus dem CRM entfernt; abgelegte Dokumente bleiben." / "Scollegare questa casella? I suoi messaggi saranno rimossi dal CRM; i documenti archiviati restano.").

- [ ] **Step 2 : Timeline contact**

Rien à coder : `useContactTimeline` lit `activity_events` par `entity_id` ; `auditActionLabel` traduit par `common:audit.action.<action>` (clés posées en T2.12) ; `timelineCat` (mobile) classe déjà toute action contenant `email`. Vérifier à l'écran sur une fiche contact rattachée : les lignes « E-mail reçu / E-mail envoyé » apparaissent avec l'objet en libellé (`object_label`).

- [ ] **Step 3 : Mobile minimal (D16)**

```tsx
// src/components/crm-mobile/messagerie/MobileMessagerieScreen.tsx
// v1 mobile : lire seulement (liste de la première boîte + lecture). Composer, répondre,
// classer et connecter restent sur ordinateur (maître D16) — et on le DIT.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { crmPalette } from '@/components/crm/tokens'
import { useCrmDark } from '@/lib/crmDark'
import { useMailAccounts } from '@/hooks/useMailAccounts'
import { useMailThreads } from '@/hooks/useMailThreads'
import { useMailThread } from '@/hooks/useMailThread'
import { mailDateLabel } from '@/lib/mail/format'
import { MailBodyFrame } from '@/components/crm/messagerie/MailBodyFrame'
import { mailSurfaces } from '@/components/crm/messagerie/mailTokens'
import { MOBILE_FONT } from '@/components/crm-mobile/shell/tokens'

export default function MobileMessagerieScreen() {
  const { t, i18n } = useTranslation('messages')
  const dark = useCrmDark()
  const sp = crmPalette(dark)
  const ms = mailSurfaces(sp, dark)
  const accounts = useMailAccounts()
  const accountId = accounts.list[0]?.id ?? null
  const [page, setPage] = useState(0)
  const [sel, setSel] = useState<string | null>(null)
  const threads = useMailThreads(accountId, { folder: 'in', labelId: null, q: '', unreadOnly: false, attOnly: false, page })
  const thread = useMailThread(sel)
  const row = threads.rows.find((r) => r.id === sel)
  return (
    <div style={{ minHeight: '100vh', background: sp.pageBg, color: sp.ink, fontFamily: MOBILE_FONT, padding: 'var(--crm-space-2xl)' }}>
      <div style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 600 }}>{t('folders.in')}</div>
      <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut, marginTop: 4 }}>{accounts.list[0]?.email ?? t('mail.empty.noAccount.title')} · {t('mail.mobile.readOnly')}</div>
      {!sel ? (
        <div style={{ marginTop: 'var(--crm-space-2xl)' }}>
          {threads.rows.map((r) => (
            <button key={r.id} type="button" onClick={() => setSel(r.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 'var(--crm-space-lg) 0', borderBottom: `1px solid ${ms.bord2}`, background: 'none', border: 'none', color: sp.ink, fontFamily: 'inherit' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--crm-text-md)', fontWeight: r.is_read ? 500 : 700 }}><span>{r.from_name || r.from_email}</span><span style={{ color: ms.txt3, fontSize: 'var(--crm-text-xs)' }}>{mailDateLabel(r.last_message_at, new Date(), i18n.language.slice(0, 2))}</span></div>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: r.is_read ? 500 : 700 }}>{r.subject || t('mail.row.noSubject')}</div>
              <div style={{ fontSize: 'var(--crm-text-sm)', color: ms.mut, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.snippet}</div>
            </button>
          ))}
          {threads.rows.length === 0 && !threads.isLoading && <div style={{ padding: 'var(--crm-space-7xl) 0', textAlign: 'center', color: ms.mut, fontSize: 'var(--crm-text-sm)' }}>{t('mail.empty.noMessage')}</div>}
          {threads.total > (page + 1) * 12 && <button type="button" onClick={() => setPage(page + 1)} style={{ marginTop: 'var(--crm-space-2xl)', background: 'none', border: `1px solid ${ms.bord3}`, borderRadius: 'var(--crm-radius-pill)', padding: 'var(--crm-space-md) var(--crm-space-3xl)', color: ms.txt3, fontFamily: 'inherit' }}>{t('mail.pager.next')}</button>}
        </div>
      ) : (
        <div style={{ marginTop: 'var(--crm-space-2xl)' }}>
          <button type="button" onClick={() => setSel(null)} style={{ background: 'none', border: 'none', color: ms.txt3, fontFamily: 'inherit', padding: 0, fontSize: 'var(--crm-text-md)' }}>‹ {t('mail.read.back')}</button>
          <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 700, marginTop: 'var(--crm-space-lg)' }}>{row?.subject}</div>
          {(thread.data ?? []).map((m) => (
            <div key={m.id} style={{ marginTop: 'var(--crm-space-2xl)', paddingTop: 'var(--crm-space-lg)', borderTop: `1px solid ${ms.bord2}` }}>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.txt3 }}>{m.direction === 'outbound' ? t('mail.read.me') : (m.from_name || m.from_email)} · {mailDateLabel(m.sent_at, new Date(), i18n.language.slice(0, 2))}</div>
              <MailBodyFrame ms={ms} html={m.body_html} text={m.body_text} truncated={m.body_truncated} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```
⚠ `MOBILE_FONT` : repérer son module (`grep -rn "export const MOBILE_FONT" src/components/crm-mobile`) et corriger l'import. `useCrmDark` : `src/lib/crmDark.ts:100`. Les ancres `‹` et `·` sont de la ponctuation, pas du texte en dur pour `lint:i18n` — vérifier que la porte ne les compte pas ; sinon passer par une clé.

- [ ] **Step 4 : Build, gardes, commit**

```bash
npm run build && npm run lint && npm run lint:i18n && npm run i18n:parity:ci && npm run test:unit
git add -A && git commit -m "feat(messagerie): carte Intégrations, déconnexion par boîte, mobile en lecture"
```

---

### Task 2.15 : Épreuve de bout en bout, PR, cerveau

- [ ] **Step 1 : L'épreuve du maître §7.4, points 1 à 8, DANS L'UI** (une boîte Google de test, puis Outlook). Chaque point est coché avec la preuve (capture ou requête SQL) collée dans la PR. Points UI supplémentaires :
  - la pop-up s'ouvre à 520×680, le consentement Google mentionne « MEGGA », l'écran « non validée » apparaît (scope restreint, attendu au pilote) ; après « Autoriser », la pop-up se ferme seule et l'assistant montre « Boîte connectée » sans que la fenêtre principale ait rechargé ;
  - bloquer les pop-ups dans le navigateur, refaire : l'onglet part sur Google et revient sur `/dashboard/messagerie?account=…` avec la boîte ouverte ;
  - clic droit sur une ligne : le menu s'ouvre au curseur, se ferme au clic hors zone et à Échap ;
  - une image distante dans un mail HTML n'est pas chargée avant « Afficher les images » (onglet Réseau : aucune requête vers le domaine de l'image) ;
  - `npm run test:e2e:visual` vert.
- [ ] **Step 2 : PR** sur `main` depuis `claude/real-estate-crm-messaging-5ef3e3`, corps : les décisions D1-D16 en résumé, les écarts assumés vis-à-vis de la maquette (D6 Infomaniak/Bluewin en IMAP ; segment « Accès » non rendu ; pas de densités ; onglet au lieu d'entrée de sidebar), les chiffres de l'épreuve (délai de première synchro, latence de réception), et la liste des gestes hors dépôt encore ouverts (§6 du maître).
- [ ] **Step 3 : Cerveau et docs** — maître §10 (clés `megga/messagerie-*`, `docs/system-map.md`, `docs/schema.md`, `docs/pages.md`, CLAUDE.md §8, CHANGELOG), puis `npm run ruflo:seed` et `npm run lint:claude-md`.
