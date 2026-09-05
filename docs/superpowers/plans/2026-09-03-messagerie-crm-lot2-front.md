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
⚠ **CE QUE LE BANC REND À CE STADE, mesuré le 04.09.2026** : le chrome, le bento (grille
`296px | 1fr`, rayon 24 px, 1 px de filet, `MXC_CARD_SHADOW` en clair, Inter Tight) et un
panneau droit VIDE — pas même l'état vide. Raison : `/dev/messagerie` n'a pas de session,
la requête des comptes est donc `enabled: false`, et une requête désactivée reste
`pending` **pour toujours** en TanStack v5. Sur la vraie route (sous `ProtectedRoute`) la
requête tourne et l'état vide s'affiche ; c'est bien le banc, et lui seul, que les fixtures
de T2.13 réparent.

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
// ⛔ ALIAS DE TYPE, PAS `interface` (corrigé le 04.09.2026, TS2345) : une `interface` ne
// reçoit pas de signature d'index implicite, donc `MailAddress[]` n'est PAS assignable à
// `Json` — écrire les destinataires d'un brouillon dans `mail_drafts.to` échouait.
export type MailAddress = { name: string | null; email: string }

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
- ⚠ **Déjà livrés en T2.1** : `src/lib/mail/invoke.ts` (step 1) et `src/hooks/useMailAccounts.ts` (step 2) — `MessagerieApp` les importe, donc ils ne pouvaient pas attendre. Les deux blocs de code restent écrits ci-dessous, tels qu'ils ont été posés.
- Create: `src/hooks/useMailLabels.ts`, `src/hooks/useMailThreads.ts`, `src/hooks/useMailThread.ts`, `src/hooks/useMailActions.ts`, `src/hooks/useMailSend.ts`, `src/hooks/useMailDrafts.ts`, `src/hooks/useMailRealtime.ts`, `src/hooks/useMailOAuthPopup.ts`, `src/hooks/useMailAttachmentBlob.ts`

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
        // ⛔ `undefined`, JAMAIS `null` (corrigé le 04.09.2026, TS2322) : les paramètres
        // à défaut de la RPC sont typés `p_label_id?: string`, pas `string | null`.
        p_account_id: accountId, p_folder: f.folder, p_label_id: f.labelId ?? undefined, p_q: f.q || undefined,
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
git add src/lib/mail/invoke.ts src/hooks/useMail*.ts scripts/check-dead-exports.mjs
git commit -m "feat(messagerie): hooks comptes, libellés, fils, gestes optimistes, envoi, brouillons, Realtime, pop-up"
```

⚠ **Trois corrections de typage, toutes mesurées le 04.09.2026** — le lot 1 a régénéré
`database.ts` depuis la production, et c'est LUI qui décide, pas ce plan :
1. `MailAddress` devient un ALIAS (voir T2.2) : sans quoi `mail_drafts.to` refuse le tableau.
2. Les paramètres à défaut d'une RPC sont `?: string`, donc `?? undefined` et jamais `null`.
3. `p_account_id` / `p_thread_id` sont `string`, pas `string | null` : chaque `queryFn`
   gardée par `enabled` porte un `if (!id) throw` — le drapeau `enabled` n'est pas connu du
   typage, et une assertion `!` mentirait là où une garde dit la même chose sans mentir.

⛔ **Et `lint:deadcode` rougit sur les DIX hooks** : rien ne les monte avant T2.4. Même
reprise qu'en T2.2 — une entrée par hook dans `ALLOW_SYMBOLS`, chacune nommant la tâche qui
la consommera et donc la retirera. Les deux exemptions d'`oauthPopup` s'en vont ici, parce
que `useMailOAuthPopup` les lit.

---

### Task 2.4 : Le rail — sélecteur de boîte, « Nouveau message », dossiers, libellés, créateur

**Files:**
- Create: `src/components/crm/messagerie/MailModalShell.tsx`
- Create: `src/components/crm/messagerie/MailBoxSelector.tsx`, `MailRail.tsx`, `MailLabelCreator.tsx`, `MailLabelMenu.tsx`
- Modify: `src/components/crm/messagerie/MessagerieApp.tsx`

Dimensions : README §1 a-d. Rappel de transposition : `--elev`→`ms.elev`, `--hover`→`ms.hover`, `--hover2`→`ms.hover2`, `--bord`→`ms.bord`, `--mut`→`ms.mut`, `--txt3/4`→`ms.txt3`, accent→`ms.accent`/`ms.accentInk`, 10-11 px→`--crm-text-xs`, 12-12.5→`sm`, 13-13.5→`md`, rayons 13-16→`--crm-radius-xl`, 999→`PILL`.

⛔ **SEPT ÉCARTS MESURÉS À LA LIVRAISON (04.09.2026) — les blocs ci-dessous les portent déjà.**
Ils ne sont pas des préférences : chacun faisait rougir une porte que la règle 1 du lot
annonce pourtant, ou une règle de CLAUDE.md §3.

1. **`textTransform: 'uppercase'` + `letterSpacing: '0.08em'` sur les quatre sur-titres
   (« BOÎTE », « LIBELLÉS »…) : RETIRÉS.** `megga-x-grammar.spec.ts` a deux clauses
   dessus — « aucune micro-capitale » (`/textTransform:\s*'uppercase'/`) et « aucun
   interlettrage de micro-capitale » (seuil `0.04em`, donc 0,08 le franchit) — et la zone
   `crm/messagerie` y est inscrite depuis T2.1. C'est aussi la SEULE des sept règles
   visuelles de CLAUDE.md §3 qui soit encore vraie ET gardée. Le sur-titre garde sa
   graisse 600 et son encre `ms.mut` : c'est ce qui le distingue, pas la capitale.
2. **`fontWeight: 700` → `600`** (pastilles de non-lus, expéditeur non lu). Clause
   « aucune graisse au-dessus de 600 » ; la vitrine ne compte qu'un seul 700, sur
   `strong`.
3. **Tout littéral de rayon/espacement passe au jeton.** `gap: 2`, `padding: '2px 7px'`,
   `padding: '2px 8px'`, `marginTop: 2`, `borderRadius: 6`, `top: 'calc(100% + 6px)'`
   étaient des littéraux. La clause « aucune zone ne dépasse son inventaire de rayons et
   d'espacements » n'a AUCUNE entrée pour `src/components/crm/messagerie` — la zone doit
   donc rendre zéro, et une entrée neuve serait une dette inscrite au premier fichier.
   Report par la table du maître §1 : 2→`2xs`, 6/7→`sm`, 6 px de rayon sur une barre de
   12 px = `PILL` (visuellement identique).
4. **`useFocusTrap(ref, open)` n'existe pas.** Signature réelle :
   `useFocusTrap(active, onEscape?)`, et elle **REND** la ref. Le geste du plan aurait
   compilé (une ref est truthy) en piégeant le mauvais nœud. Échap est déjà géré par le
   hook : le second écouteur du plan est retiré.
5. **`import { MEIcon }` → `import MEIcon`** : `MEIcon` est un export PAR DÉFAUT
   (`MEIconName`, lui, est bien nommé).
6. **La commande de vérification des icônes rend des faux « ok ».** Elle greppe
   `MEIcon.tsx` ET `PxIconFont.tsx`, or un nom présent dans le seul `PxIconFontName` ne
   se rend PAS : il faut l'union `MEIconName` **et** une entrée de table. Mesuré :
   `inbox`, `archive`, `paperclip` n'existaient que côté police, `file-text` nulle part.
   Les quatre sont **redessinés en trait** dans `PATHS`, pas délégués à `FONT_FALLBACK` :
   la police d'icônes est PLEINE, et `inbox`/`archive` en aplat entre `star` et `send`
   auraient fait deux blocs au milieu de traits.
7. **`hslToHex` déménage dans `mailTokens.ts`**, et l'effet qui la rappelait disparaît.
   Un fichier de composant qui exporte aussi une fonction déclenche
   `react-refresh/only-export-components`, **erreur** ici (`npm run lint` doit rendre 0) ;
   et `useEffect(() => { if (custom) setColor(hslToHex(…)) })` déclenche
   `react-hooks/set-state-in-effect`. La teinte se POSE au geste (`poserTeinte`), ce qui
   économise un rendu et dit mieux l'intention.

- [ ] **Step 1 : La coquille de modale (réutilisée par les 7 modales)**

```tsx
// src/components/crm/messagerie/MailModalShell.tsx
// Une modale = portail sur document.body + voile assombrissant + carte + piège de focus +
// Escape (modèle WhatsAppConnectModal.tsx:70-101). z-index 300 par défaut (règle 3 du lot).
import { useEffect, type ReactNode } from 'react'
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
  // ⚠ `useFocusTrap(active, onEscape?)` REND la ref, et gère déjà Échap.
  const ref = useFocusTrap(open, onClose)
  useEffect(() => {
    if (!open) return
    const precedent = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = precedent }
  }, [open])
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
(⚠ signature RÉELLE : `useFocusTrap(active, onEscape?)`, qui **rend** la ref — écart n° 4 ci-dessus.)

- [ ] **Step 2 : Sélecteur de boîte**

```tsx
// src/components/crm/messagerie/MailBoxSelector.tsx — README §1a.
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
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
          <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: ms.mut }}>{t('mail.box.label')}</div>
          <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current?.email ?? t('mail.box.none')}</div>
        </div>
        <MEIcon name="chevron-down" size={12} color={ms.mut} />
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 40, marginTop: 'var(--crm-space-2xs)', background: ms.card, border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-xl)', padding: 'var(--crm-space-2xs)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)', boxShadow: ms.shadow }}>
          {accounts.map((a) => (
            <button key={a.id} type="button" role="menuitem" onClick={() => { onSelect(a.id); onClose() }}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-md) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', background: a.id === currentId ? ms.elev : 'transparent', border: 'none', cursor: 'pointer', color: ms.ink, textAlign: 'left', transition: MAIL_TRANSITION }}
              onMouseEnter={(e) => { e.currentTarget.style.background = ms.hover }} onMouseLeave={(e) => { e.currentTarget.style.background = a.id === currentId ? ms.elev : 'transparent' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.email}</div>
                <div style={{ fontSize: 'var(--crm-text-xs)', color: a.status === 'active' ? ms.mut : ms.danger }}>{desc(a)}</div>
              </div>
              {(unread[a.id] ?? 0) > 0 && (
                <span style={{ borderRadius: PILL, padding: 'var(--crm-space-2xs) var(--crm-space-sm)', fontSize: 'var(--crm-text-xs)', fontWeight: 600, background: ms.accent, color: ms.accentInk }}>{unread[a.id]}</span>
              )}
            </button>
          ))}
          <button type="button" role="menuitem" onClick={() => { onAdd(); onClose() }}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', padding: 'var(--crm-space-md) var(--crm-space-lg)', borderTop: `1px solid ${ms.bord2}`, background: 'transparent', border: 'none', borderRadius: 0, cursor: 'pointer', color: ms.txt3, fontSize: 'var(--crm-text-xs)', fontWeight: 500, transition: MAIL_TRANSITION }}
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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MXC_COLOR, MXC_SYSTEM } from '@/components/megga-x-crm/tokens'
import { hslToHex, MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'
import type { MailLabel } from '@/hooks/useMailLabels'

const PRESETS = [MXC_SYSTEM.red400, MXC_SYSTEM.blue300, MXC_SYSTEM.yellow400, MXC_SYSTEM.green300, MXC_COLOR.accent, MXC_COLOR.n500]
const LIGHTNESS = [30, 40, 50, 60, 70, 80]

// ⚠ `hslToHex` vit dans `mailTokens.ts` (écart n° 7) : un fichier de composant qui
// exporte une fonction fait ÉCHOUER `npm run lint` (react-refresh/only-export-components).

interface Props { ms: MailSurfaces; initial?: MailLabel | null; onCancel: () => void; onSave: (v: { name: string; color: string }) => void; busy?: boolean }

export function MailLabelCreator({ ms, initial, onCancel, onSave, busy }: Props) {
  const { t } = useTranslation('messages')
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? PRESETS[0])
  const [custom, setCustom] = useState(false)
  const [hue, setHue] = useState(220)
  const [light, setLight] = useState(50)
  // La teinte se POSE au geste : `setState` dans un effet est refusé (écart n° 7).
  const poserTeinte = (h: number, l: number) => { setHue(h); setLight(l); setColor(hslToHex(h, 85, l)) }
  const hexOk = useMemo(() => /^#[0-9a-fA-F]{6}$/.test(color), [color])
  const field = { background: ms.elev, border: `1px solid ${ms.bord}`, color: ms.ink, fontFamily: 'inherit', outline: 'none' } as const

  return (
    <div style={{ background: ms.elev, border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-xl)', padding: 'var(--crm-space-md) var(--crm-space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)' }}>
      <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: ms.mut }}>{initial ? t('mail.labels.rename') : t('mail.labels.new')}</div>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={t('mail.labels.namePlaceholder')} autoFocus
        style={{ ...field, borderRadius: PILL, padding: 'var(--crm-space-sm) var(--crm-space-lg)', fontSize: 'var(--crm-text-sm)' }} />
      <div style={{ display: 'flex', gap: 'var(--crm-space-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
        {PRESETS.map((c) => (
          <button key={c} type="button" aria-label={c} onClick={() => { setCustom(false); setColor(c) }}
            style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: `2px solid ${color === c && !custom ? ms.ink : 'transparent'}`, cursor: 'pointer', transition: MAIL_TRANSITION }} />
        ))}
        <button type="button" onClick={() => { const on = !custom; setCustom(on); if (on) poserTeinte(hue, light) }} aria-pressed={custom} title={t('mail.labels.custom')}
          style={{ width: 22, height: 22, borderRadius: '50%', background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)', border: `2px solid ${custom ? ms.ink : 'transparent'}`, cursor: 'pointer' }} />
      </div>
      {custom && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
          <input type="range" min={0} max={360} value={hue} onChange={(e) => poserTeinte(Number(e.target.value), light)} aria-label={t('mail.labels.hue')}
            style={{ width: '100%', height: 12, borderRadius: PILL, appearance: 'none', background: 'linear-gradient(90deg, hsl(0 85% 50%), hsl(60 85% 50%), hsl(120 85% 50%), hsl(180 85% 50%), hsl(240 85% 50%), hsl(300 85% 50%), hsl(360 85% 50%))' }} />
          <div style={{ display: 'flex', gap: 'var(--crm-space-sm)' }}>
            {LIGHTNESS.map((l) => (
              <button key={l} type="button" aria-label={`${l}%`} onClick={() => poserTeinte(hue, l)}
                style={{ flex: 1, height: 18, borderRadius: 'var(--crm-radius-xs)', background: hslToHex(hue, 85, l), border: `2px solid ${light === l ? ms.ink : 'transparent'}`, cursor: 'pointer' }} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)' }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: hexOk ? color : ms.bord }} />
            <input value={color} onChange={(e) => setColor(e.target.value)} maxLength={7} aria-label={t('mail.labels.hex')}
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
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
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
                <span style={{ marginLeft: 'auto', borderRadius: PILL, padding: 'var(--crm-space-2xs) var(--crm-space-sm)', fontSize: 'var(--crm-text-xs)', fontWeight: 600, background: ms.accent, color: ms.accentInk }}>{p.counts.inbox_unread}</span>
              )}
              {f.key === 'arch' && counter(p.counts.archived)}
              {f.key === 'draft' && counter(p.counts.drafts)}
            </button>
          )
        })}
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 var(--crm-space-sm) 0 var(--crm-space-lg)' }}>
          <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: ms.mut }}>{t('mail.labels.title')}</span>
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
"labels": { "title": "Libellés", "new": "Nouveau libellé", "rename": "Renommer", "recolor": "Changer la couleur", "delete": "Supprimer", "namePlaceholder": "Nom du libellé", "custom": "Couleur personnalisée", "hue": "Teinte", "hex": "Code hexadécimal", "create": "Créer" },
"actions": { "cancel": "Annuler", "save": "Enregistrer" }
```

⚠ **Les quatre langues, pas seulement le FR.** `i18n:parity:ci` exige chaque clé FR en
DE/EN/IT, et `i18n:coverage:ci` refuse une valeur allemande IDENTIQUE à l'anglaise : `"Labels"`
recopié en DE l'a fait rougir (`de/messages : 0 → 1`). Le DE dit **« Kategorien »** — le terme
d'Outlook allemand pour ce classement.

- [ ] **Step 8 : Build, lint, commit**

```bash
npm run build && npm run lint && npm run lint:i18n && npm run lint:deadcode \
  && npm run i18n:parity:ci && npm run i18n:coverage:ci
git add -A
git commit -m "feat(messagerie): le rail — boîtes, dossiers, libellés"
```

⚠ **`lint:deadcode` fait partie de cette étape** : la tâche RETIRE trois exemptions de
`scripts/check-dead-exports.mjs` (`useMailLabels`, `useMailRealtime`, `useMailFolderCounts`,
désormais lus par `MessagerieApp`) et en AJOUTE deux, nommées, pour `MailModalShell` et
`MailCloseButton` — la coquille précède ses sept modales, sa première consommatrice est T2.7.

---

### Task 2.5 : La liste — barre d'outils, lignes, pagination, menu contextuel

**Files:**
- Create: `src/components/crm/messagerie/MailList.tsx`, `MailListRow.tsx`, `MailPager.tsx`, `MailContextMenu.tsx`
- Modify: `src/components/crm/messagerie/MessagerieApp.tsx`

Dimensions : README §2. Grille de ligne `26px 185px minmax(0,1fr) 16px 58px`, `gap:10px`, `padding:11px 12px`, `border-bottom:1px solid --bord2`, étoile 15 px (`ms.star` active, `ms.dim` inactive), expéditeur 700/500, pastille de libellé `3px 10px / 10px / 600`, extrait `— …` en `ms.mut`, trombone 13 px, date `ms.txt3` à droite.

⛔ **CINQ ÉCARTS MESURÉS À LA LIVRAISON (04.09.2026), en plus des sept de la 2.4** — mêmes
portes, mêmes raisons ; les blocs ci-dessous les portent déjà.

1. **`fontWeight: 700` de l'expéditeur non lu → `600`**, et la pastille de libellé perd son
   `padding: '3px 10px'` littéral au profit de `var(--crm-space-2xs) var(--crm-space-sm)`.
   La GRILLE, elle, reste au pixel : `gridTemplateColumns` n'est pas une propriété
   d'espacement — l'échelle règle rayons, marges et écarts, pas la mise en page d'un
   tableau.
2. **Le sur-titre « LIBELLÉS » du menu contextuel perd micro-capitale et interlettrage**
   (clauses `megga-x-grammar`, cf. écart n° 1 de la 2.4).
3. **`import { MEIcon }` → `import MEIcon`** : export par défaut.
4. ✅ **Le tiret demi-cadratin de `pager.range` est bien refusé** — la réserve écrite au
   step 6 était juste. `scripts/check-prose-typography.mjs:45-46` teste l'em PUIS l'en, et
   `locales/` est son seul périmètre. Les quatre langues écrivent donc une préposition :
   « à » · « to » · « bis » · « a ».
5. ⛔ **LE DÉBOUNCE NE PEUT PAS VIVRE DANS `MailList`.** Le plan l'y plaçait ; mesuré,
   c'est un défaut : `select-account` **reconstruit** l'état (`initialMailState`), donc
   `state.q` retombe à vide en changeant de boîte — un état local dans la liste, lui,
   garderait la saisie et la repousserait au parent 250 ms plus tard. La recherche de
   l'ancienne boîte reviendrait toute seule, sans qu'on l'ait retapée. Le miroir débouncé
   vit dans `MessagerieApp`, où il suit toujours la source ; le champ lit `state.q`
   directement, donc la frappe reste instantanée.


- [ ] **Step 1 : Pager (porté d'`AdminPager`, `sp` en prop)**

```tsx
// src/components/crm/messagerie/MailPager.tsx — « 1–12 sur 48 » + chevrons (README §2).
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
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
import MEIcon from '@/components/propertyx/MEIcon'
import type { MailThreadRow } from '@/hooks/useMailThreads'
import type { MailLabel } from '@/hooks/useMailLabels'
import { displayAddress, mailDateLabel } from '@/lib/mail/format'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

interface Props { ms: MailSurfaces; row: MailThreadRow; label: MailLabel | null; lang: string; onOpen: () => void; onStar: () => void; onContext: (e: React.MouseEvent) => void }

export function MailListRow({ ms, row, label, lang, onOpen, onStar, onContext }: Props) {
  const { t } = useTranslation('messages')
  // 600 et non 700 : la grammaire MEGGA X y plafonne, et 500/600 suffit à lire « non lu ».
  const weight = row.is_read ? 500 : 600
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
        {label && <span style={{ borderRadius: PILL, padding: 'var(--crm-space-2xs) var(--crm-space-sm)', fontSize: 'var(--crm-text-xs)', fontWeight: 600, background: label.color, color: ms.pillInk(label.color), flexShrink: 0 }}>{label.name}</span>}
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
        <div style={{ padding: 'var(--crm-space-2xs) var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: ms.mut }}>{t('mail.labels.title')}</div>
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
import MEIcon from '@/components/propertyx/MEIcon'
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
          p.drafts.length === 0 ? <MailListEmpty ms={ms} text={t('mail.empty.noMessage')} /> : p.drafts.map((d) => (
            <div key={d.id} role="row" tabIndex={0} onClick={() => p.onOpenDraft(d.id)} onKeyDown={(e) => { if (e.key === 'Enter') p.onOpenDraft(d.id) }}
              style={{ display: 'grid', gridTemplateColumns: '26px 185px minmax(0,1fr) 16px 58px', gap: 'var(--crm-space-md)', alignItems: 'center', padding: 'var(--crm-space-md) var(--crm-space-lg)', fontSize: 'var(--crm-text-sm)', borderBottom: `1px solid ${ms.bord2}`, cursor: 'pointer', color: ms.ink }}>
              <span />
              <span style={{ fontWeight: 500, color: ms.txt3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.to.map((a) => a.email).join(', ') || t('mail.draft.noRecipient')}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><span style={{ fontWeight: 500 }}>{d.subject || t('mail.row.noSubject')}</span> <span style={{ color: ms.mut }}>— {(d.body_text ?? '').slice(0, 120)}</span></span>
              <span />
              <span style={{ fontSize: 'var(--crm-text-xs)', color: ms.txt3, textAlign: 'right' }}>{t('mail.draft.badge')}</span>
            </div>
          ))
        ) : p.isLoading ? null : p.rows.length === 0 ? <MailListEmpty ms={ms} text={t('mail.empty.noMessage')} /> : (
          p.rows.map((r) => <MailListRow key={r.id} ms={ms} row={r} label={labelOf(r.label_id)} lang={p.lang} onOpen={() => p.onOpen(r.id)} onStar={() => p.onStar(r)} onContext={(e) => p.onContext(e, r)} />)
        )}
      </div>
    </>
  )
}

// ⚠ `MailListEmpty` et non `Empty` : un nom aussi générique dans un dossier de
// quinze composants se fait réimporter par erreur depuis le voisin.
function MailListEmpty({ ms, text }: { ms: MailSurfaces; text: string }) {
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
La recherche est débouncée à 250 ms **dans `MessagerieApp`**, pas dans `MailList` (écart n° 5 ci-dessus) : un miroir `useState` + `setTimeout` sur `state.q`, dont `useMailThreads` lit la valeur retardée. Le champ, lui, lit `state.q` sans délai.

- [ ] **Step 6 : Clés i18n FR**

```json
"list": { "search": "Recherche", "searchPlaceholder": "Chercher un expéditeur, un objet ...", "unread": "Non lus", "attachment": "Pièce jointe" },
"pager": { "range": "{{from}} à {{to}} sur {{total}}", "prev": "Page précédente", "next": "Page suivante" },
"row": { "star": "Suivre", "unstar": "Ne plus suivre", "noSubject": "(sans objet)" },
"ctx": { "open": "Ouvrir", "markRead": "Marquer comme lu", "markUnread": "Marquer comme non lu", "star": "Suivre", "unstar": "Ne plus suivre", "archive": "Archiver", "unarchive": "Désarchiver", "delete": "Supprimer" },
"draft": { "badge": "Brouillon", "noRecipient": "(sans destinataire)" }
```
✅ Réserve VÉRIFIÉE (04.09.2026) : `scripts/check-prose-typography.mjs:45-46` refuse l'em **et** le demi-cadratin dans `locales/`. La clé écrit donc « à » (et « to » · « bis » · « a » dans les trois autres langues). ⚠ Les quatre langues sont livrées ICI et non repoussées en T2.12 : `i18n:parity:ci` exige chaque clé FR en DE/EN/IT, et `i18n:coverage:ci` refuse une valeur allemande identique à l'anglaise.

- [ ] **Step 7 : Build, lint, commit**

```bash
npm run build && npm run lint && npm run lint:i18n && npm run lint:prose \\
  && npm run lint:deadcode && npm run i18n:parity:ci && npm run i18n:coverage:ci
git add -A
git commit -m "feat(messagerie): la liste — barre d'outils, lignes, pagination, menu contextuel"
```

---

### Task 2.6 : La lecture — bandeau, corps assaini, pièces, réponses, composeurs, barre d'actions

**Files:**
- Create: `src/components/crm/messagerie/MailReader.tsx`, `MailBodyFrame.tsx`, `MailReplyComposer.tsx`, `MailForwardComposer.tsx`
- Create: `src/hooks/useMailContactSearch.ts`
- Modify: `src/components/crm/messagerie/MessagerieApp.tsx`

Dimensions : README §3.

⛔ **SEPT ÉCARTS MESURÉS À L'ÉCRITURE (05.09.2026)** — les blocs ci-dessous sont corrigés, la
liste dit pourquoi. Trois d'entre eux auraient fait rougir une porte, deux ne se voient qu'à
l'exécution.

1. **`import { MEIcon }` → `import MEIcon`.** `src/components/propertyx/MEIcon.tsx` n'a qu'un
   export DÉFAUT (`export default function MEIcon`) ; l'import nommé ne compile pas. T2.5 avait
   déjà écrit la forme correcte.
2. **`<MEIcon name="x" …>` (T2.7) → `name="close"`.** `'x'` n'est pas un membre de `MEIconName`.
   ⚠ Un nom inconnu ne casse pas le rendu — `MEIcon` rend `null` — mais TS refuse le littéral.
3. **`fontWeight: 700` (titre du fil, titre de la modale) → `600`.** `megga-x-grammar` a une
   clause « aucune graisse au-dessus de 600 », et son motif lit l'EXPRESSION entière.
4. **`<b style={{ color: ms.ink }}>` → `<span style={{ …, fontWeight: 600 }}>`.** Une clause
   dédiée interdit `<strong>`/`<b>` dans les zones portées : le preflight Tailwind leur donne
   `bolder`, qui vaut **700** sur un parent à 500 — une graisse que la source ne déclare pas.
5. **`padding: '3px 10px'` (pastille de libellé) → `var(--crm-space-2xs) var(--crm-space-sm)`.**
   La zone `crm/messagerie` n'a AUCUNE entrée dans `B4_ASSUME` : le cliquet refuse le premier
   littéral de rayon ou d'espacement, pas le centième. Même valeur que `MailListRow`.
6. **`buildBodySrcdoc(…, { font: 'var(--crm-font)' })` → la police RÉSOLUE côté hôte.** ⛔ Une
   variable CSS ne franchit pas la frontière d'un document : dans la `srcdoc`, `--crm-font`
   n'existe pas, la déclaration `font-family` entière est écartée, et le corps du mail sort en
   **sérif du navigateur** au milieu d'un écran sans serif. Panne muette, invisible à la
   relecture. `MailBodyFrame` lit donc
   `getComputedStyle(document.documentElement).getPropertyValue('--crm-font')`. ⚠ La police
   elle-même ne suit pas (chaque document a son jeu de polices, et la CSP y interdit
   `font-src`) : le rendu tombe sur `system-ui`, le repli déclaré par `buildBodySrcdoc`.
7. **Le repli du fil ouvert : `useRef` → un état ajusté PENDANT le rendu.** `react-hooks/refs`
   est une ERREUR dans ce dépôt, et lire `.current` au rendu en lève quatre (mesuré). ⚠ Et pas
   un effet non plus : `react-hooks/set-state-in-effect` le signale, et l'effet ferait un rendu
   de plus, donc un clignotement. Le repli n'est servi que si son identifiant correspond encore.

- [ ] **Step 1 : Corps HTML dans une iframe sandbox**

```tsx
// src/components/crm/messagerie/MailBodyFrame.tsx — D9 : DOMPurify + sandbox + CSP.
// `allow-same-origin` (sans `allow-scripts`) sert UNIQUEMENT à mesurer la hauteur ;
// la CSP interdit script, connexion et image distante par défaut.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildBodySrcdoc, sanitizeMailHtml } from '@/lib/mail/sanitize'
import { PILL, type MailSurfaces } from './mailTokens'

interface Props { ms: MailSurfaces; html: string | null; text: string | null; truncated: boolean }

/** Écart n° 6 : une variable CSS ne franchit pas la frontière d'un document. */
function policeHote(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--crm-font').trim()
  return v || 'system-ui'
}

export function MailBodyFrame({ ms, html, text, truncated }: Props) {
  const { t } = useTranslation('messages')
  const [remote, setRemote] = useState(false)
  const [height, setHeight] = useState(120)
  const ref = useRef<HTMLIFrameElement>(null)
  const hasRemote = useMemo(() => !!html && /<img[^>]+src=["']?https?:/i.test(html), [html])
  const doc = useMemo(() => (html ? buildBodySrcdoc(sanitizeMailHtml(html, { remoteImages: remote }), { ink: ms.txt2, font: policeHote(), remoteImages: remote }  // écart n° 6) : null), [html, remote, ms.txt2])
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
        <button type="button" onClick={() => setRemote(true)} style={{ marginTop: 'var(--crm-space-lg)', background: ms.elev, border: `1px solid ${ms.bord}`, borderRadius: PILL, padding: 'var(--crm-space-xs) var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', color: ms.txt3, cursor: 'pointer', fontFamily: 'inherit' }}>
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
      <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.txt3, marginBottom: 'var(--crm-space-md)' }}>{t('mail.read.replyTo')} <span style={{ color: ms.ink, fontWeight: 600 }}>{toName}</span>  {/* écart n° 4 */}</div>
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
import MEIcon from '@/components/propertyx/MEIcon'  // écart n° 1 : export DÉFAUT
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
        <h1 style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, margin: 0 }}>  {/* écart n° 3 */}{p.thread.subject || t('mail.row.noSubject')}</h1>
        {p.label && <span style={{ borderRadius: PILL, padding: 'var(--crm-space-2xs) var(--crm-space-sm)', fontSize: 'var(--crm-text-xs)', fontWeight: 600, background: p.label.color, color: ms.pillInk(p.label.color) }}>  {/* écart n° 5 */}{p.label.name}</span>}
      </div>
      {!p.thread.contact_id && inboundLast.from_email && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginTop: 'var(--crm-space-lg)', padding: 'var(--crm-space-md) var(--crm-space-2xl)', border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-lg)', fontSize: 'var(--crm-text-xs)', color: ms.txt3 }}>
          {t('mail.read.unlinked', { email: inboundLast.from_email })}
          <button type="button" onClick={() => p.onLinkContact(inboundLast.from_email ?? '', inboundLast.from_name)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: ms.accent, fontWeight: 600, fontSize: 'var(--crm-text-xs)', cursor: 'pointer', fontFamily: 'inherit' }}>{t('mail.link.cta')}</button>
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
⚠ Si le fil ouvert sort de la page courante (filtre, page suivante), `selRow` devient null : garder la dernière ligne ouverte et l'utiliser en repli — sinon la lecture disparaît sous l'utilisateur au premier `invalidate`. ⛔ **Pas dans un `useRef`** (écart n° 7 ci-dessus) : `react-hooks/refs` est une ERREUR ici. Un `useState` ajusté PENDANT le rendu, et servi seulement si son identifiant correspond encore :
```tsx
const filTrouve = threads.rows.find((r) => r.id === state.sel) ?? null
const [filMemo, setFilMemo] = useState<MailThreadRow | null>(null)
if (filTrouve && filTrouve !== filMemo) setFilMemo(filTrouve)
const filOuvert = filTrouve ?? (filMemo?.id === state.sel ? filMemo : null)
```

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

⛔ **SIX ÉCARTS MESURÉS À L'ÉCRITURE (05.09.2026)**, en plus des écarts n° 1 à 3 de la T2.6
(import par défaut de `MEIcon`, `name="close"` au lieu de `name="x"`, graisse plafonnée à 600) :

1. **Le sur-titre « DOCUMENTS DE L'AGENCE » perd sa micro-capitale et son interlettrage.**
   `textTransform: 'uppercase'` et `letterSpacing: '0.08em'` sont refusés par deux clauses de
   `megga-x-grammar` — la micro-capitale était la marque de fabrique de Sugar, et un tracking
   positif sur de la casse normale disloque le mot. La casse normale sépare aussi bien.
2. **La modale est MONTÉE à l'ouverture, démontée à la fermeture** — plus de prop `open`, plus
   d'effet d'amorçage. Un `setState` synchrone dans un effet est signalé par
   `react-hooks/set-state-in-effect` et coûte un rendu ; surtout, l'état de saisie doit repartir
   de zéro à chaque ouverture, et un `useState` d'initialisation le garantit sans dépendance à
   oublier.
3. **`(a.source as { doc: AgencyDocument }).doc.id` → un `flatMap` conditionnel.** `filter` ne
   rétrécit pas l'union, et le cast qui compensait affirmait une forme que rien ne vérifie.
4. **`key={label + sub}` dans le popover → la clé du document.** Deux documents de même nom et
   de même taille se seraient partagé une clé.
5. **La ligne « Depuis mon ordinateur » est écrite en JSX**, hors de l'aide commune :
   `react-hooks/refs` est une ERREUR ici et refuse `fileRef.current` dans une flèche passée en
   ARGUMENT (il ne peut pas prouver qu'elle ne sera pas appelée pendant le rendu). Un
   `useCallback` ne suffit pas — mesuré ; dans un gestionnaire JSX, la règle le sait.
6. **`state.modal.draftId` est SORTI de l'union avant le `find`** : le rétrécissement de
   `state.modal` ne survit pas à l'entrée dans un callback (TS2339, mesuré).

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
import { useEffect, useRef, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'  // écart n° 1 de T2.6 : export DÉFAUT
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
  // écart n° 4 : la clé est celle du DOCUMENT, pas « nom + taille ».
  const styleLigne: CSSProperties = { display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', width: '100%', textAlign: 'left', padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', background: 'transparent', border: 'none', color: ms.ink, fontSize: 'var(--crm-text-sm)', cursor: 'pointer', fontFamily: 'inherit', transition: MAIL_TRANSITION }
  const survol = {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = ms.hover },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'transparent' },
  }
  const ligneDoc = (d: AgencyDocument) => (
    <button key={d.id} type="button" onClick={() => onToggleDoc(d)} style={styleLigne} {...survol}>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
      <span style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{fileSizeLabel(d.size_bytes)}</span>
      {chosenDocIds.has(d.id) && <MEIcon name="check" size={13} color={ms.accent} />}
    </button>
  )
  return (
    <div ref={ref} style={{ position: 'absolute', bottom: 'calc(100% + 10px)', left: 0, width: 340, background: ms.card, border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-4xl)', padding: 'var(--crm-space-sm)', zIndex: 310, boxShadow: ms.solidShadow }}>
      <input ref={fileRef} type="file" multiple hidden onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); onClose() }} />
      {/* écart n° 5 : en JSX, jamais en argument d'une aide */}
      <button type="button" onClick={() => fileRef.current?.click()} style={styleLigne} {...survol}>
        <span style={{ flex: 1, minWidth: 0 }}>{t('mail.compose.fromComputer')}</span>
      </button>
      <div style={{ padding: 'var(--crm-space-md) var(--crm-space-lg) var(--crm-space-2xs)', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: ms.mut }}>{t('mail.compose.agencyDocs')}</div>  {/* écart n° 1 */}
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {(docs.data ?? []).map(ligneDoc)}
        {docs.data?.length === 0 && <div style={{ padding: 'var(--crm-space-md) var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{t('mail.compose.noAgencyDocs')}</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3 : La modale**

```tsx
// src/components/crm/messagerie/MailComposeModal.tsx — README §4.
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'  // écart n° 1 de T2.6 : export DÉFAUT
import { blobToBase64, documentToBase64, type AgencyDocument } from '@/hooks/useAgencyDocuments'
import { parseRecipients, useMailContactSearch } from '@/hooks/useMailContactSearch'
import type { MailDraft } from '@/hooks/useMailDrafts'
import type { MailSendInput } from '@/hooks/useMailSend'
import { fileSizeLabel } from '@/lib/mail/format'
import { MailAttachPopover } from './MailAttachPopover'
import { MailCloseButton, MailModalShell } from './MailModalShell'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

interface Pending { key: string; name: string; size: number; mimeType: string; source: { kind: 'file'; file: File } | { kind: 'doc'; doc: AgencyDocument } }
// écart n° 2 : plus de prop `open` — le composant est monté à l'ouverture.
interface Props { ms: MailSurfaces; draft: MailDraft | null; sending: boolean; error: string | null
  onClose: (draft: { to: string; subject: string; body: string } | null) => void; onSend: (input: MailSendInput) => void }

export function MailComposeModal({ ms, draft, sending, error, onClose, onSend }: Props) {
  const { t } = useTranslation('messages')
  const [to, setTo] = useState(() => (draft?.to ?? []).map((a) => (a.name ? `${a.name} <${a.email}>` : a.email)).join(', '))
  const [subject, setSubject] = useState(() => draft?.subject ?? '')
  const [body, setBody] = useState(() => draft?.body_text ?? '')
  const [atts, setAtts] = useState<Pending[]>([])
  const [popover, setPopover] = useState(false)
  const [suggest, setSuggest] = useState(false)
  const lastTerm = to.split(/[,;]/).pop()?.trim() ?? ''
  const hits = useMailContactSearch(suggest ? lastTerm : '')
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
    <MailModalShell ms={ms} open onClose={close} width={600} ariaLabel={t('mail.compose.title')} veil={0.12}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, margin: 0 }}>{t('mail.compose.title')}</h2>  {/* écart n° 3 de T2.6 */}
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
                <button type="button" aria-label={t('mail.compose.removeAttachment')} onClick={() => setAtts((l) => l.filter((x) => x.key !== a.key))} style={{ background: 'none', border: 'none', color: ms.txt3, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><MEIcon name="close" size={12} /></button>  {/* écart n° 2 de T2.6 */}
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
          {/* écart n° 3 : `flatMap` conditionnel, qui se narrow tout seul */}
          <MailAttachPopover ms={ms} chosenDocIds={new Set(atts.flatMap((a) => (a.source.kind === 'doc' ? [a.source.doc.id] : [])))}
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
// écart n° 6 : l'identifiant SORT de l'union avant le `find` (TS2339 sinon).
const idBrouillon = state.modal.kind === 'compose' ? state.modal.draftId ?? null : null
const composeDraft = idBrouillon ? drafts.drafts.find((d) => d.id === idBrouillon) ?? null : null
{state.modal.kind === 'compose' && <MailComposeModal ms={ms} draft={composeDraft} sending={send.isPending} error={send.error?.message ?? null}
  onClose={(content) => {
    if (content) drafts.save.mutate({ id: composeDraft?.id, kind: 'new', to: parseRecipients(content.to), subject: content.subject, body_text: content.body })
    dispatch({ type: 'modal', modal: { kind: 'none' } })
  }}
  onSend={(input) => send.mutate(input, { onSuccess: () => { dispatch({ type: 'modal', modal: { kind: 'none' } }); dispatch({ type: 'folder', folder: 'sent' }) } })} />}
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
Branchement — ⛔ **avec le repli sur le fil ouvert, sans quoi la modale ne s'ouvre PAS depuis
le lecteur** (mesuré le 05.09.2026) : `onDelete` du lecteur passe l'identifiant de `filOuvert`,
qui peut déjà avoir quitté la page courante (c'est tout l'objet du repli de la T2.6). Un `find`
seul rendrait `null`, donc `open={!!row}` faux — un bouton « Supprimer » sans effet et sans
message. ⚠ Et l'identifiant SORT de l'union avant le `find`, même motif qu'en T2.7 (TS2339) :

```tsx
const idSuppression = state.modal.kind === 'delete' ? state.modal.threadId : null
const filASupprimer = idSuppression
  ? threads.rows.find((r) => r.id === idSuppression) ?? (filOuvert?.id === idSuppression ? filOuvert : null)
  : null
```

`onConfirm` → `actions.act.mutate({ action: 'trash', threadId }, { onSuccess: () => { dispatch({ type: 'modal', modal: { kind: 'none' } }); dispatch({ type: 'back' }) } })` ; `busy` = `actions.act.isPending`.

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

⛔ **SIX ÉCARTS MESURÉS À L'ÉCRITURE (05.09.2026)**, en plus de ceux déjà relevés aux T2.6 et
T2.7 (import par défaut de `MEIcon`, graisse plafonnée à 600, montage/démontage plutôt que
prop `open`) :

1. **L'encart « ACCÈS DEMANDÉ » perd sa micro-capitale ET son interlettrage.**
   `textTransform: 'uppercase'` et `letterSpacing: '0.1em'` sont refusés par deux clauses de
   `megga-x-grammar` — même écart, même raison qu'au n° 1 de la T2.7. `letterSpacing: '0.04em'`
   du monogramme tombe LUI AUSSI : le seuil de la clause est `>= 0.04em`, pas `> 0.04em`.
2. **`fontWeight: 700` → `600` (monogramme, `@` de la ligne IMAP) et `500` (titre de la
   modale).** La clause `fontWeight:[^,}\n]*\b[789]00\b` lit l'expression entière.
3. **`marginTop: 2` → `var(--crm-space-2xs)` (4 px).** ⚠ Ce n'est pas un détail de goût :
   `src/components/crm/messagerie` est une ZONE du cliquet B4 **sans entrée `B4_ASSUME`**, donc
   son inventaire de rayons et d'espacements doit valoir ZÉRO — et le compte inclut les valeurs
   qui sont SUR l'échelle mais non tokenisées, pas seulement celles qui en sortent. Le plus
   petit barreau d'espacement est 4 px : 2 px n'est pas exprimable, et ne doit pas l'être.
4. **`color: 'var(--color-text-primary)'` de la page de retour est INOPÉRANT.** Mesuré dans
   `globals.css:152` : le jeton vaut `28 28 28` — un TRIPLET RVB destiné à `rgb(var(…))`, que
   Tailwind enveloppe. Écrit tel quel, la déclaration est écartée sans erreur et le texte prend
   la couleur héritée. La page prend les classes `bg-theme-page text-theme-primary`.
   ⚠ `src/pages/agent` est une zone du cliquet B4 *et* du cliquet de couleur, tous deux SANS
   CRÉDIT : la page ne peut ajouter ni un littéral d'espacement, ni un hexadécimal.
5. **`MEIcon` ne connaît ni `maximize` ni `image`** (mesuré sur l'union `MEIconName`) : ce sont
   `zoom-in` et `gallery`. La liste d'icônes à vérifier, plus haut dans ce lot, nommait déjà
   `maximize` comme « à ajouter » ; l'ajouter à l'union coûterait un chemin SVG de plus pour
   un glyphe que le dépôt a déjà.
6. **PAS DE STEPPER, et c'est une décision.** Les quatre étapes ne forment pas une séquence
   linéaire (liste → OAuth **ou** IMAP → connectée) et la maquette n'en montre aucun. En
   inventer un contredirait « Fidélité : haute » du maître §1, et la règle des steppers de
   CLAUDE.md §3 borne le CHOIX entre trois idiomes existants — elle n'en impose pas un.

⚠ **`connect_imap` N'EXISTE PAS dans `mail-oauth` (lot 1)** : l'edge répond `unknown_action`.
Ce n'est pas une panne à corriger ici — IMAP est le lot 3 — c'est l'état que
`IMAP_ERRORS.unknown_action` rend en clair (« arrive dans une prochaine version »).

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
  if (provider === 'imap') return <div style={{ ...circle, background: ms.elev, border: `1px solid ${ms.bord}`, fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{'@'}</div>
  const png = PNG[provider]!
  return (
    <div style={{ ...circle, background: ms.elev, border: `1px solid ${ms.bord}`, fontSize: 'var(--crm-text-xs)', fontWeight: 600 }}>
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
        {sub && <span style={{ display: 'block', fontSize: 'var(--crm-text-sm)', color: ms.mut, marginTop: 'var(--crm-space-2xs)' }}>{sub}</span>}
      </span>
      <MEIcon name="chevron-right" size={13} color={ms.mut} />
    </button>
  )

  return (
    <MailModalShell ms={ms} open={open} onClose={() => { cancel(); onClose() }} width={520} ariaLabel={t('mail.add.title')} veil={0.12}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 500, margin: 0 }}>{t('mail.add.title')}</h2>
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
            <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: ms.mut }}>{t('mail.add.oauth.access')}</div>
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
    <div className="min-h-screen grid place-items-center bg-theme-page text-theme-primary" style={{ fontFamily: 'var(--crm-font)', fontSize: 'var(--crm-text-md)' }}>{msg}</div>
  )
}
```
⚠ `useMailAccounts()` appelle `useQuery` : la page est sous `ProtectedRoute`, donc `QueryClientProvider` et la session existent. ⛔ Le jeton `--color-text-primary` a été vérifié dans `globals.css` (ligne 152) : il vaut `28 28 28`, un TRIPLET RVB — `color: var(--color-text-primary)` est donc écarté en silence. C'est `text-theme-primary` en classe, comme le disait le repli.

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

⛔ **QUATRE ÉCARTS MESURÉS À L'ÉCRITURE (05.09.2026)**, tous de la même famille que ceux des
tâches précédentes :

1. **`import { MEIcon }` → `import MEIcon`** : c'est un export PAR DÉFAUT.
2. **`fontWeight: 700` de la pastille d'initiales → `600`** (clause de graisse de
   `megga-x-grammar`).
3. **`gap: 2` et `marginTop: 4` → `var(--crm-space-2xs)`.** La zone
   `src/components/crm/messagerie` n'a AUCUNE entrée `B4_ASSUME` : son inventaire de rayons et
   d'espacements doit valoir zéro, et le compte inclut les valeurs SUR l'échelle mais non
   tokenisées. Le plus petit barreau vaut 4 px ; `gap: 2` n'est pas exprimable.
4. **La modale est MONTÉE avec sa cible, démontée à la fermeture.** `state.modal` porte
   `threadId`, `email` et `name` : les lire au montage évite d'avoir à remettre la recherche à
   zéro par un effet, et la saisie repart du nom de l'expéditeur à chaque ouverture.

- [ ] **Step 1 : Composant**

```tsx
// src/components/crm/messagerie/MailLinkContactModal.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
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
        <div><h2 style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>{t('mail.link.title')}</h2><div style={{ fontSize: 'var(--crm-text-sm)', color: ms.mut, marginTop: 'var(--crm-space-2xs)' }}>{name ? `${name} · ${email}` : email}</div></div>
        <MailCloseButton ms={ms} onClick={onClose} label={t('mail.actions.close')} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', background: ms.elev, border: `1px solid ${ms.bord}`, borderRadius: PILL, padding: 'var(--crm-space-md) var(--crm-space-2xl)', marginTop: 'var(--crm-space-4xl)' }}>
        <MEIcon name="search" size={14} color={ms.mut} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('mail.link.searchPlaceholder')} aria-label={t('mail.link.search')} autoFocus style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: ms.ink, fontSize: 'var(--crm-text-sm)', fontFamily: 'inherit' }} />
      </label>
      <div style={{ marginTop: 'var(--crm-space-md)', overflowY: 'auto', minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
        {(hits.data ?? []).map((h) => (
          <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', transition: MAIL_TRANSITION }}
            onMouseEnter={(e) => { e.currentTarget.style.background = ms.hover }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
            <div aria-hidden style={{ width: 30, height: 30, borderRadius: '50%', background: ms.elev, border: `1px solid ${ms.bord}`, display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-xs)', fontWeight: 600 }}>{initialsOf(`${h.first_name} ${h.last_name}`, h.email)}</div>
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

⛔ **CINQ ÉCARTS MESURÉS À L'ÉCRITURE (05.09.2026)** :

1. **⛔ L'APERÇU DÉCIDAIT « c'est une image » SUR LA DÉCLARATION DE L'EXPÉDITEUR.**
   `att.mime_type` vient du courrier reçu ; `mail-attachment` (GET), lui, ne sert l'essence
   d'origine que pour six types sûrs (`INLINE_SAFE_MIME` : PDF, PNG, JPEG, WebP, GIF, texte) et
   rend `application/octet-stream` + `attachment` pour tout le reste — un SVG est un document
   scriptable, pas une image. Un `image/svg+xml` ou un `image/heic` passait donc
   `mime_type.startsWith('image/')` et posait un `<img>` sur des octets que le serveur refuse
   d'afficher : une image cassée servie en **200**, exactement le mensonge que le repli du logo
   évite en T2.9. `useMailAttachmentBlob` rend désormais aussi `type` — le `Content-Type` de la
   RÉPONSE, donc la décision du serveur — et l'aperçu tranche là-dessus.
2. **`textTransform: 'uppercase'` + `letterSpacing: '0.08em'` sur les trois sur-titres**
   (« FICHE CONTACT », « TYPE DE DOCUMENT », « NOM DANS LE DOSSIER`) : refusés par deux clauses
   de `megga-x-grammar`, comme au n° 1 de la T2.7. Casse normale.
3. **`fontWeight: 700` → `600`** (pastille d'initiales du sélecteur de contact).
4. **`gap: 4` et `marginTop: 4` → `var(--crm-space-2xs)`** : la zone n'a aucune entrée
   `B4_ASSUME`, donc son inventaire d'espacements doit valoir zéro — même les valeurs SUR
   l'échelle mais non tokenisées y comptent.
5. **`MEIcon` ne connaît ni `image` ni `maximize`** : ce sont `gallery` et `zoom-in`.

⚠ **DEUX MOTIFS D'ERREUR MANQUAIENT à la table du plan**, et ils sont tous deux atteignables :
`too_large` (413, plafond de **20 Mio** pour le classement, distinct des 25 Mio de la lecture)
et `contact_not_found` (404, contact hors de l'agence de l'appelant). Sans eux, deux refus
parfaitement explicables tombaient sur « Le classement a échoué. Réessayez. »

⚠ **L'ALLOWLIST DES SIX ESSENCES N'EST PAS RECOPIÉE côté client**, et c'est délibéré : elle vit
dans la migration du bucket, l'edge la lit, l'écran rend son verdict. La dupliquer la ferait
diverger en silence, et l'écran finirait par refuser ce que le serveur accepte.

⚠ **La modale de classement est MONTÉE avec sa pièce** (`state.modal.kind === 'file' && piece`),
ce qui retire l'`useEffect` d'amorçage du plan : `react-hooks/set-state-in-effect` le signale,
et un `useState` d'initialisation donne le même résultat sans rendu supplémentaire. L'APERÇU,
lui, reste monté avec `att` à `null` — `useMailAttachmentBlob` est un hook, il doit être appelé
à chaque rendu.

- [ ] **Step 1 : Aperçu**

```tsx
// src/components/crm/messagerie/MailAttachmentPreviewModal.tsx — README §9 (calque .28, blur 8, carte 600).
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useMailAttachmentBlob } from '@/hooks/useMailAttachmentBlob'
import type { MailAttachmentRow } from '@/hooks/useMailThread'
import { MailCloseButton, MailModalShell } from './MailModalShell'
import { PILL, type MailSurfaces } from './mailTokens'

interface Props { ms: MailSurfaces; att: MailAttachmentRow | null; onClose: () => void; onFile: () => void }
export function MailAttachmentPreviewModal({ ms, att, onClose, onFile }: Props) {
  const { t } = useTranslation('messages')
  const blob = useMailAttachmentBlob(att?.id ?? null)
  // ⛔ L'essence SERVIE, jamais celle que l'expéditeur déclarait — cf. écart n° 1.
  const servi = blob.type ?? ''
  const isImage = servi.startsWith('image/')
  const isPdf = servi === 'application/pdf'
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
import MEIcon from '@/components/propertyx/MEIcon'
import { useMailContactSearch, type MailContactHit } from '@/hooks/useMailContactSearch'
import type { MailAttachmentRow } from '@/hooks/useMailThread'
import { invokeMail } from '@/lib/mail/invoke'
import { fileSizeLabel, initialsOf } from '@/lib/mail/format'
import { MailCloseButton, MailModalShell } from './MailModalShell'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

const TYPES = ['contrat', 'mandat', 'piece_identite', 'justificatif_domicile', 'financement', 'plan', 'photo', 'autre'] as const
/** Motif du serveur → clé i18n. `too_large` (20 Mio) et `contact_not_found` sont atteignables. */
const ERREURS: Record<string, string> = { unsupported_type: 'mail.file.err.unsupported', too_large: 'mail.file.err.tooLarge', contact_not_found: 'mail.file.err.contact' }
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
    if (r.error) { setError(t(ERREURS[r.error] ?? 'mail.file.err.generic')); return }
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
          <button type="button" onClick={onPreview} aria-label={t('mail.file.zoom')} style={{ width: 76, height: 76, borderRadius: 'var(--crm-radius-lg)', background: ms.card, border: `1px solid ${ms.bord}`, cursor: 'zoom-in', display: 'grid', placeItems: 'center', color: ms.mut }}><MEIcon name={att?.mime_type.startsWith('image/') ? 'gallery' : 'file-text'} size={28} /></button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att?.filename}</div>
            <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{ext} · {fileSizeLabel(att?.size_bytes ?? 0)}</div>
            <button type="button" onClick={onPreview} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', background: 'none', border: 'none', padding: 0, marginTop: 'var(--crm-space-2xs)', color: ms.accent, fontSize: 'var(--crm-text-xs)', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}><MEIcon name="zoom-in" size={12} color={ms.accent} /> {t('mail.file.zoom')}</button>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: ms.mut, marginBottom: 'var(--crm-space-sm)' }}>{t('mail.file.contact')}</div>
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
                    <span aria-hidden style={{ width: 28, height: 28, borderRadius: '50%', background: ms.elev, border: `1px solid ${ms.bord}`, display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-xs)', fontWeight: 600 }}>{initialsOf(`${h.first_name} ${h.last_name}`, h.email)}</span>
                    <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>{h.first_name} {h.last_name}</span><span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{h.email}</span></span>
                  </button>
                ))}
                {q.length >= 2 && hits.data?.length === 0 && <div style={{ padding: 'var(--crm-space-md)', fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{t('mail.link.empty')}</div>}
              </div>
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: ms.mut, marginBottom: 'var(--crm-space-sm)' }}>{t('mail.file.type')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-sm)' }}>
            {TYPES.map((k) => (
              <button key={k} type="button" aria-pressed={type === k} onClick={() => setType(k)} style={{ borderRadius: PILL, padding: 'var(--crm-space-xs) var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', fontWeight: 500, border: `1px solid ${type === k ? ms.accent : ms.bord3}`, background: type === k ? ms.accent : ms.elev, color: type === k ? ms.accentInk : ms.txt3, cursor: 'pointer', fontFamily: 'inherit', transition: MAIL_TRANSITION }}>{t(`mail.file.types.${k}`)}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: ms.mut, marginBottom: 'var(--crm-space-sm)' }}>{t('mail.file.name')}</div>
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
  "err": { "unsupported": "Ce type de fichier n'est pas accepté dans les documents (PDF, JPEG, PNG, WebP, Word).", "tooLarge": "La pièce dépasse 20 Mo : elle ne peut pas être classée au dossier.", "contact": "Ce contact n'appartient pas à votre agence.", "generic": "Le classement a échoué. Réessayez." } }
```

```bash
npm run build && npm run lint && npm run lint:i18n
git add -A && git commit -m "feat(messagerie): aperçu de pièce et classement au dossier contact"
```

---

### Task 2.12 : i18n — consolidation FR et les trois autres langues

**Files:**
- Modify: `src/i18n/locales/{fr,de,en,it}/messages.json` (`mail.mobile`), `common.json` (`audit.action.*`), `settings.json` (`integrations.catalogue.messagerie.desc`)

> ⛔ **LES QUATRE ARBRES JSON QUI TENAIENT ICI ONT ÉTÉ RETIRÉS LE 05.09.2026 : ILS
> ÉTAIENT PÉRIMÉS AVANT D'ÊTRE LUS.** Ils avaient été écrits le 03.09, quand cette
> tâche devait POSER le sous-arbre `mail`. Les tâches 2.1 à 2.11 l'ont posé au fur
> et à mesure, clé par clé, avec l'écran qui la consomme — et mieux : là où le plan
> transposait le français mot à mot, l'implémentation a traduit.
>
> Mesuré le 05.09.2026 (`mail.*` : plan 168 clés, dépôt 170, dans les quatre
> langues) :
>
> - **1 clé manquait au dépôt** — `mail.mobile.readOnly`, que seul l'écran mobile
>   de T2.14 consomme. C'est la seule chose que cette tâche avait encore à poser.
> - **3 clés manquaient au PLAN**, et elles ont un lecteur : `mail.labels.hex`
>   (`MailLabelCreator.tsx:128`), `mail.file.err.tooLarge` et `mail.file.err.contact`
>   (`MailFileAttachmentModal.tsx:33-34`). Appliquer le bloc « tel quel » les
>   aurait SUPPRIMÉES — trois libellés d'erreur remplacés par leur clé brute à
>   l'écran, sans qu'aucune porte ne rougisse (`lint:i18n` cherche du français en
>   dur, pas une clé absente).
> - **35 valeurs EN, 38 DE, 32 IT différaient**, et dans presque tous les cas
>   c'est le DÉPÔT qui a raison. Le cas d'école est `mail.labels.title` en
>   allemand : le plan écrit `"Labels"`, recopié de l'anglais — exactement ce que
>   le cliquet `i18n:coverage:ci` compte comme « non traduit ». Le dépôt dit
>   « Kategorien ». Revenir au plan aurait fait rougir la porte que cette tâche
>   doit garder verte.
> - L'anglais du dépôt est en orthographe britannique (`Authorisation`,
>   `Synchronisation`), celui du plan en américaine. **Ni l'une ni l'autre n'est la
>   convention de la maison** : mesuré sur `src/i18n/locales/en/`, 34 formes
>   britanniques contre 34 américaines. Aucune porte ne tranche, donc on ne churne
>   pas 20 valeurs pour un goût — `mail.*` reste cohérent avec lui-même.
>
> Ce qui reste de la tâche est donc ce qui suit, et deux corrections mesurées.

- [x] **Step 1 : la clé que l'écran mobile de T2.14 attend**

`mail.mobile.readOnly`, dans les quatre langues :

| | |
|---|---|
| fr | Composer et répondre se font sur ordinateur pour l'instant. |
| en | Composing and replying are done on desktop for now. |
| de | Verfassen und Antworten sind vorerst am Computer möglich. |
| it | Scrivere e rispondere si fanno dal computer, per ora. |

- [x] **Step 2 : les trois actions d'audit (`common.json`), que la timeline contact affiche**

`auditActionLabel()` lit `common:audit.action.<action>` et retombe sur un
`humanize()` de l'identifiant quand la clé manque : sans ces trois-là, la fiche
contact affichait « Email received » au lieu de « E-mail reçu ». Les identifiants
viennent du lot 1, pas d'une intention : `_shared/mail/ingest.ts:167` écrit
`email_received` / `email_sent`, `mail-attachment/index.ts:158`
`document_filed_from_email`.

| clé | fr | en | de | it |
|---|---|---|---|---|
| `email_received` | E-mail reçu | Email received | E-Mail erhalten | E-mail ricevuta |
| `email_sent` | E-mail envoyé | Email sent | E-Mail gesendet | E-mail inviata |
| `document_filed_from_email` | Pièce classée depuis un e-mail | Attachment filed from an email | Anhang aus einer E-Mail abgelegt | Allegato archiviato da un'e-mail |

⚠ L'objet `audit.action` est trié alphabétiquement : les trois clés s'insèrent à
leur rang, pas à la fin.

- [x] **Step 3 : la description de la carte d'intégration (`settings.json`)**

`integrations.catalogue.messagerie.desc`, consommée par la carte de T2.14 :
fr « Lisez et répondez à vos e-mails depuis le CRM (Google, Microsoft, IMAP). » ·
en "Read and reply to your emails from the CRM (Google, Microsoft, IMAP)." ·
de „Lesen und beantworten Sie Ihre E-Mails aus dem CRM (Google, Microsoft, IMAP)." ·
it "Leggi e rispondi alle tue e-mail dal CRM (Google, Microsoft, IMAP)."

- [x] **Step 4 : deux corrections de valeur, mesurées**

- `it` `mail.ctx.unarchive` : « Togli dall archivio » → « Togli dall'archivio ».
  Apostrophe manquante, pas un choix de traduction.
- `de` `mail.add.oauth.busy` : « Verbindung… » → « Wird verbunden… ». Les trois
  autres libellés d'attente du même fichier suivent le patron `Wird …`
  (`actions.sending`, `preview.loading`, `callback.working`) ; « Verbindung… » est
  un nom, pas un état.

`common:nav.messagerie` était déjà posée en T2.1 dans les quatre langues
(fr « Messagerie », en "Mail", de „Nachrichten", it "Messaggi").

- [x] **Step 5 : Portes et commit**

```bash
npm run lint:i18n && npm run i18n:parity:ci && npm run lint:prose && npm run i18n:coverage:ci
git add src/i18n docs/superpowers && git commit -m "feat(messagerie): i18n — le français consolidé et les trois autres langues"
```
⚠ `i18n:coverage:ci` est un cliquet : si le compte de clés DE/IT non traduites
monte, il rougit. Vérifié le 05.09.2026 — aucune des douze valeurs ajoutées n'y
apparaît, et le total IT de `messages` reste à 1/252.

---

### Task 2.13 : Banc `/dev/messagerie`, fixtures, gardes de contraste et de grammaire, visuel

**Files:**
- Modify: `src/components/crm/messagerie/fixtures.ts` (renommé depuis `.tsx`), `mailTokens.ts`, dix composants
- Modify: `src/hooks/useMail{Accounts,Labels,Threads,Thread,Drafts,Realtime}.ts` (mode fixtures)
- Create: `tests/unit/messagerie-contraste.spec.ts`
- Modify: `tests/e2e/visual-regression.spec.ts`, `scripts/_shared/visual-baseline-empreinte.mjs`, `tests/unit/visual-baseline-fraicheur.spec.ts`

- [x] **Step 1 : Fixtures** — `src/components/crm/messagerie/fixtures.ts`

Trois écarts au bloc du plan, chacun mesuré :

1. ⛔ **CHAQUE FIL A SES MESSAGES.** Le plan en rédigeait trois pour 48 fils.
   Mesuré à l'écran : `MailReader` fait `if (!first) return null` — juste en
   production, où le cache d'un fil peut arriver vide le temps d'une synchro —
   donc **44 clics sur 48 ouvraient un panneau BLANC**. Un humain en aurait
   conclu que la lecture est cassée. Les messages sont désormais DÉRIVÉS des
   fils (`messagesDe`) : même correspondant, même objet, même date, exactement
   `message_count` messages alternés entrant/sortant.
2. ⚠ **LES DATES SONT RELATIVES**, pas les littéraux `2026-09-03T…` du plan.
   `mailDateLabel` compare au jour civil suisse : une date fixe affiche
   « 08:29 » le jour de son écriture, « Hier » le lendemain, puis « 03.09 »,
   puis « 03.09.26 » — l'écran change tout seul, et la capture de régression
   avec lui. C'est le motif exact pour lequel `/dashboard` a été retiré du jeu de
   captures. La capture est rendue déterministe par une horloge figée côté
   Playwright (Step 4), pas par des dates mortes.
3. ⚠ **« Envoyés » se lit sur les MESSAGES**, pas sur `message_count > 1` comme
   l'écrivait le plan : la RPC filtre sur `last_outbound_at is not null`, et un
   fil de deux messages entrants n'a jamais rien envoyé. Le banc rejoue le vrai
   prédicat. Six fils sont archivés pour la même raison — sinon le dossier
   « Archivé » serait vide, et un dossier vide ne se distingue pas d'un dossier
   cassé.

Le fichier est un `.ts` (`git mv` depuis `.tsx`) : le fournisseur JSX a laissé la
place au `Provider` du contexte, monté par la page de banc —
`react-refresh/only-export-components` est une ERREUR ici et refuse un `.tsx` qui
exporte à la fois un composant et huit constantes.

- [x] **Step 2 : Mode fixtures dans les hooks de lecture**

⛔ **PAS par `isLoading: fx ? false : q.isPending` comme le plan le prescrivait.**
Ce montage rend un couple (`isLoading: false`, `data: undefined`) qui n'existe
dans aucun chemin réel : l'écran serait passé du blanc au vide sans qu'on sache
lequel il montre. Les fixtures répondent **DANS la `queryFn`**, et l'état entre
dans la clé de requête :

```ts
const fx = useMailFixtures()
useQuery({
  queryKey: ['mail', 'accounts', fx],
  enabled: !!user || !!fx,
  queryFn: async () => { if (fx) return fx === 'none' ? [] : FX_ACCOUNTS; /* … */ },
})
```

La requête RÉSOUT, donc le banc emprunte le chemin de la production — cache,
`staleTime`, `placeholderData` compris — et le piège `isPending`-pour-toujours ne
se pose plus. Même geste dans `useMailLabels`, `useMailThreads`,
`useMailFolderCounts`, `useMailThread`, `useMailDrafts` ; `useMailRealtime` sort
tôt (`if (!agencyId || fx) return`) : avec `VITE_DEV_BYPASS_AUTH` il y a une
session, donc un `agency_id`, et le canal se serait ouvert pour rien.

- [x] **Step 3 : Garde de contraste — et les TROIS DÉFAUTS qu'elle a trouvés**

⛔ La clause du plan `expect(typeof encreSur(bg)).toBe('string')` est VRAIE pour
toute entrée : elle n'aurait jamais rougi. Et la liste de huit fichiers nommés
laissait seize des vingt-quatre hors garde. La spec balaye donc le DOSSIER, et
mesure vraiment. Ce qu'elle a trouvé en naissant :

| jeton en ENCRE | thème | mesuré | sites |
|---|---|---|---|
| `accent` `#424bfb` | sombre | **3,44:1** | 9 (dont « Rapprocher ») |
| `danger` `#fe566b` | clair | **3,11:1** | 7, tous `role="alert"` |
| `success` `#adecbb` | clair | **1,35:1** | la coche « déjà classée » |

Forme n° 37 de `megga/gardes-vacuites` : un jeton qui sert d'APLAT **et**
d'ENCRE, mesuré d'un seul côté. Les couples aplat+`encreSur` passaient tous.
Réparé par `accentText` / `dangerText` / `successText` dans `mailTokens.ts`.

⛔ **Les deux encres du thème clair sont IMPORTÉES de `MLK_STATUT`, pas écrites.**
Deux raisons, toutes deux mesurées : aucun des **96 barreaux** de MEGGA X ne
porte du texte rouge ou vert sur blanc (meilleur rouge 4,09:1, meilleur vert
1,89:1 — la vitrine est mono-thème sombre) ; et deux littéraux neufs font rougir
`couleur-barreaux`, dont l'inventaire de `src/components/crm` « ne peut que
RÉTRÉCIR » (540 > 538). `MLK_STATUT` est la famille que le dépôt s'est déjà
donnée pour ce rôle, mesurée en août, et **déjà consommée hors de sa zone** par
`crm-identity`.

⚠ La zone de grammaire (`megga-x-grammar.spec.ts` `ZONES`) était déjà posée en
T2.1, vide de dette. 33/33 vert, rien à faire ici.

**Chaque clause a été éprouvée par mutation** (mutation appliquée → spec rouge →
mutation annulée) : encre de pastille en blanc dur, chacun des trois `*Text`
ramené à son aplat, réintroduction de `ms.accent` / `ms.danger` en encre,
`aria-pressed` retiré de l'étoile, blanc en dur dans la zone, `encreSur` ne
rendant plus un extrême, couleur de libellé en `rgb()`. Huit sur huit rougissent.

- [ ] **Step 4 : Régression visuelle — CODE FAIT, RÉFÉRENCE À GÉNÉRER EN CI**

`/dev/messagerie` entre dans `PAGES_TO_SNAPSHOT` sous le nom `dev-messagerie`,
avec une **horloge figée** (`page.clock.setFixedTime('2026-09-03T08:29:00Z')`) —
`setFixedTime` et non `install()`, qui prendrait aussi la main sur le débounce de
recherche. Sans elle la colonne de dates dériverait toute seule.

⛔ **ET LE TÉMOIN DE BALAYAGE ÉTAIT UN BOGUE LATENT.**
`visual-baseline-fraicheur.spec.ts` exigeait `PipelinePage.tsx` et
`crm/pipeline/StageColumn` de **chaque** entrée de `ECRANS`, dans la même boucle.
Juste tant qu'il n'y avait qu'un écran ; le second l'a fait rougir sur-le-champ.
Les témoins sont désormais PAR ÉCRAN (`TEMOINS`, à côté de l'inventaire), avec
une clause de réciprocité — un écran sans témoin vide la garde du côté qu'on ne
regarde pas.

⛔ **CE QUI RESTE, ET QUI NE PEUT PAS SE FAIRE SUR CETTE MACHINE.** La référence
et son empreinte s'écrivent ENSEMBLE, par
`playwright test --config=playwright.visual.config.ts --update-snapshots=all`,
sur `ubuntu-latest` — c'est ce que fait `visual-baselines.yml`. Générée en local
sur macOS, la capture s'appellerait `dev-messagerie-chromium-darwin.png` et le
rendu de police ne serait pas celui de la CI : une référence fausse, commitée
comme vraie. Et l'empreinte ne se recopie pas à la main — la séparer de sa
capture est exactement le faux-vert que cette garde existe pour empêcher.

**Action requise, une seule :** commenter `/regenerate-visual-baselines` sur la
PR. Jusque-là, DEUX clauses de `visual-baseline-fraicheur.spec.ts` sont ROUGES —
« aucune capture n'est orpheline » et « la référence décrit encore l'écran » — et
le job `test:e2e:visual` l'est aussi. C'est le signal prévu par la garde, pas une
régression : son message d'échec nomme la commande.

- [x] **Step 5 : Toutes les gardes, commit**

```bash
npm run test:unit && npm run build && npm run lint && npm run lint:deadcode
git add -A && git commit -m "test(messagerie): banc, fixtures, gardes de contraste et de grammaire"
```

---

### Task 2.14 : Réglages › Intégrations, timeline contact, mobile minimal

**Files:**
- Modify: `src/components/crm/settings/IntegrationsSection.tsx`, `src/components/crm/messagerie/{MailBoxSelector,MailRail,MessagerieApp,MailBodyFrame}.tsx`, `src/components/crm/messagerie/mailState.ts`, `src/hooks/useContactTimeline.ts`, `src/pages/dev/MobileShowcasePage.tsx`
- Create: `src/components/crm-mobile/messagerie/MobileMessagerieScreen.tsx` (le squelette de T2.1 rendait `null`), `tests/unit/messagerie-timeline.spec.ts`

- [x] **Step 1 : Carte « Messagerie » dans le catalogue des intégrations**

`ProviderId` gagne `'messagerie'`, la carte suit WhatsApp, `connected` et
`account` sont surchargés au render depuis `useMailAccounts` — **toutes** les
adresses, pas un compte : la boîte de l'agence et celle de l'agent coexistent
(D14). `handleConnect` renvoie sur `/dashboard/messagerie?add=1` (l'assistant
existe déjà et lit ce paramètre depuis T2.9) ; « déconnecter » renvoie sur
l'écran, sans agir.

⚠ Glyphe neutre (`MEIcon name="mail"`), pas un logo de marque : une seule carte
couvre TROIS fournisseurs, et ce que l'agent connecte ici est SA BOÎTE. Les
logos de marque restent rendus par `MailProviderLogo`, qui réutilise déjà
`GoogleG` et `MsLogo` de `settings/brandLogos` — aucun logo n'est redessiné.

⚠ Et ce n'est PAS la carte Google/Microsoft voisine : celle-là porte le
CALENDRIER (jetons en clair, OAuth GoTrue). La messagerie a ses propres jetons,
en Vault, derrière `mail-oauth`. Les fondre laisserait croire qu'un agenda
connecté donne accès au courrier.

**Déconnexion boîte par boîte**, dans le sélecteur du rail. ⚠ La ligne devient
une RANGÉE de deux boutons et non un bouton dans un bouton : `<button>` imbriqué
est du balisage invalide. La confirmation passe par `window.confirm` — exception
assumée : le geste part d'un POPOVER qui se ferme au premier clic dehors, donc
une modale portée aurait dû survivre à la fermeture de son déclencheur, pour
trois lignes. Précédent : `ImportLeadPage:153`. ⚠ Déconnecter la boîte COURANTE
remet la sélection à `null` (l'action du reducer accepte `null` depuis ici) :
sans ça l'écran gardait un `accountId` disparu.

- [x] **Step 2 : Timeline contact — « rien à coder » n'était pas « rien à garder »**

Le câblage est bien complet : le lot 1 écrit `entity_id = contact_id`, le hook
filtre là-dessus, `auditActionLabel` traduit, `timelineCat` classe. Mais la
chaîne tient sur TROIS pièces dans trois endroits, et **aucune ne rougissait**
quand une autre bougeait : le repli `humanize()` affiche « Email received » au
lieu de « E-mail reçu » sans rien signaler. Un repli qui « marche » est ce qui
rend une régression invisible.

`tests/unit/messagerie-timeline.spec.ts` relie les trois : les identifiants sont
LUS dans `supabase/functions/**` et non recopiés, les quatre langues doivent les
porter, et le repli est éprouvé pour que les clauses ne soient pas vraies par
construction. ⚠ La clause « ne vaut pas son propre repli » est désactivée en
ANGLAIS, et c'est structurel : les identifiants SONT de l'anglais en snake_case,
donc « Email received » est à la fois le repli et la bonne traduction. En anglais
il reste le contrôle de présence.

⛔ Le commentaire de `useContactTimeline` annonçait « OR metadata contains
contact_id » — jamais implémenté. Corrigé : un commentaire qui décrit une requête
plus large que la vraie fait chercher la panne du côté de l'écriture. Le contrat
(« si et seulement si `entity_id` ») est désormais gardé.

- [x] **Step 3 : Mobile minimal (D16)**

Trois écarts au bloc du plan :

1. ⚠ `MOBILE_FONT` vit dans `src/components/crm-mobile/tokens.ts`, pas
   `shell/tokens`.
2. ⚠ **Aucun littéral** de rayon, d'espacement ni de taille — le bloc du plan en
   portait (`marginTop: 4`). `crm-mobile` est sous le cliquet de grammaire, dont
   les DEUX compteurs ne peuvent que descendre.
3. ⚠ `MailBodyFrame` reçoit une police. Sans elle le corps du mail rendait en
   **Inter Tight sur mobile** : `policeHote()` lit `--crm-font`, la police de
   l'agent au bureau. Aucune garde ne l'aurait vu — `polices-domaines` balaye les
   SOURCES, et cette police-là est résolue à l'exécution.

⚠ Les COULEURS viennent de `mailSurfaces` et non de `MT_LIGHT`/`MT_DARK` : la
messagerie rend le même corps assaini dans la même iframe des deux côtés, et
`MailBodyFrame` est typé sur `MailSurfaces`. Deux palettes sur un écran auraient
coûté plus que l'écart au reste du mobile.

✅ **L'écran mobile est monté dans `/dev/mobile`**, sous le même fournisseur de
fixtures que le banc de bureau — sinon il n'était visible nulle part sans base de
données, exactement le trou que T2.13 vient de fermer côté bureau. ⚠ Son
séparateur est TOKENISÉ : recopier le littéral des voisins aurait fait monter le
`total` de `src/pages/dev` (34 → 35).

- [x] **Step 4 : Build, gardes, commit**

```bash
npm run build && npm run lint && npm run lint:i18n && npm run i18n:parity:ci && npm run test:unit
git add -A && git commit -m "feat(messagerie): réglages, timeline contact, écran mobile minimal"
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
