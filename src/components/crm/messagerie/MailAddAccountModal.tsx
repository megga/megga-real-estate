/**
 * L'assistant « Ajouter une boîte » (README §6), transposé en MEGGA X.
 *
 * Quatre étapes, et deux seulement mènent quelque part aujourd'hui :
 *  · `list`  — le choix du fournisseur ;
 *  · `oauth` — Google et Microsoft, par la pop-up de consentement (maître D1) ;
 *  · `imap`  — Infomaniak, Bluewin et « autre boîte » (maître D6 : ces deux
 *    fournisseurs suisses n'exposent AUCUN OAuth de messagerie, donc leur ligne
 *    ouvre l'étape IMAP pré-remplie et jamais l'étape d'autorisation) ;
 *  · `done`  — la boîte connectée.
 *
 * ⚠ IMAP est le LOT 3 : `mail-oauth` ne connaît pas encore `connect_imap` et
 * répond `unknown_action`. L'écran le DIT (« arrive dans une prochaine
 * version ») au lieu de griser la ligne — un champ grisé ne se lit pas, il se
 * devine.
 *
 * ⚠ WhatsApp n'est PAS une boîte de cet écran (maître D13) : sa ligne NAVIGUE
 * vers la carte d'appairage des Réglages.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useMailAccounts, type ImapForm, type MailAccount } from '@/hooks/useMailAccounts'
import { useMailOAuthPopup } from '@/hooks/useMailOAuthPopup'
import { MailCloseButton, MailModalShell } from './MailModalShell'
import { MailProviderLogo, type MailProviderKey } from './MailProviderLogo'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

type Step = 'list' | 'oauth' | 'imap' | 'done'
type Fournisseur = Exclude<MailProviderKey, 'wa'>

/** Largeur de la carte (README §6). */
const LARGEUR = 520
const VOILE = 0.12
/** Diamètre du logo en tête d'étape et de la pastille verte « connectée ». */
const LOGO_ETAPE = 40

/**
 * Présélections de l'assistant. Les ports SMTP sont en **465** (TLS implicite)
 * et non 587 : le runtime edge de Supabase bloque 25 et 587, donc STARTTLS y est
 * impossible (maître D5). Proposer 587 par défaut serait promettre un chemin
 * qui n'existe pas.
 */
const PRESET: Record<Fournisseur, { name: string; imap: string; smtp: string; oauth: boolean }> = {
  gmail: { name: 'Google Workspace', imap: 'imap.gmail.com', smtp: 'smtp.gmail.com', oauth: true },
  outlook: { name: 'Outlook / Microsoft 365', imap: 'outlook.office365.com', smtp: 'smtp.office365.com', oauth: true },
  infomaniak: { name: 'Infomaniak Mail', imap: 'mail.infomaniak.com', smtp: 'mail.infomaniak.com', oauth: false },
  bluewin: { name: 'Bluewin (Swisscom)', imap: 'imap.bluewin.ch', smtp: 'smtpauths.bluewin.ch', oauth: false },
  imap: { name: '', imap: '', smtp: '', oauth: false },
}

/** Motif du serveur (ou de la pop-up) → clé i18n. Ce qui n'y figure pas tombe sur `generic`. */
const IMAP_ERRORS: Record<string, string> = {
  invalid_input: 'mail.add.imap.err.invalid',
  starttls_unsupported: 'mail.add.imap.err.starttls',
  connection_failed: 'mail.add.imap.err.connection',
  unknown_action: 'mail.add.imap.unavailable',
}
const OAUTH_ERRORS: Record<string, string> = {
  popup_blocked: 'mail.add.oauth.err.popupBlocked',
  cancelled: 'mail.add.oauth.err.cancelled',
  timeout: 'mail.add.oauth.err.timeout',
  denied: 'mail.add.oauth.err.denied',
  provider_not_configured: 'mail.add.oauth.err.notConfigured',
  exchange_failed: 'mail.add.oauth.err.exchange',
}

interface Props {
  ms: MailSurfaces
  open: boolean
  onClose: () => void
  onOpenAccount: (accountId: string) => void
}

/** L'assistant complet, monté à l'ouverture et démonté à la fermeture. */
export function MailAddAccountModal({ ms, open, onClose, onOpenAccount }: Props) {
  const { t } = useTranslation('messages')
  const navigate = useNavigate()
  const { connect, cancel } = useMailOAuthPopup()
  const { connectImap } = useMailAccounts()
  const [step, setStep] = useState<Step>('list')
  const [prov, setProv] = useState<Fournisseur>('gmail')
  const [addr, setAddr] = useState('')
  const [shared, setShared] = useState(false)
  const [form, setForm] = useState<ImapForm>({
    email: '', imap_host: '', imap_port: 993, smtp_host: '', smtp_port: 465,
    user: '', password: '', encryption: 'ssl', visibility: 'owner',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<MailAccount | null>(null)
  /*
   * ⚠ AUCUN EFFET DE REMISE À ZÉRO ICI, et ce n'est pas un oubli : `MessagerieApp`
   * MONTE et DÉMONTE l'assistant avec la modale (même patron que le composeur),
   * donc rouvrir « Ajouter une boîte » repart déjà du choix du fournisseur. Un
   * `useEffect` qui rejouerait cinq `setState` sur `open` ferait un rendu de plus
   * pour arriver à l'état que le montage donne gratuitement — c'est exactement ce
   * que `react-hooks/set-state-in-effect` signale.
   */

  const nomDe = (p: Fournisseur) => (p === 'imap' ? t('mail.add.other') : PRESET[p].name)

  const pick = (p: MailProviderKey) => {
    if (p === 'wa') { onClose(); navigate('/dashboard/settings?tab=integrations'); return }
    setProv(p); setError(null)
    const pr = PRESET[p]
    setForm((f) => ({ ...f, imap_host: pr.imap, smtp_host: pr.smtp, imap_port: 993, smtp_port: 465, encryption: 'ssl' }))
    setStep(pr.oauth ? 'oauth' : 'imap')
  }

  const authorize = async () => {
    setBusy(true); setError(null)
    const r = await connect(prov === 'outlook' ? 'outlook' : 'gmail', {
      loginHint: addr.trim() || undefined,
      visibility: shared ? 'agency' : 'owner',
    })
    setBusy(false)
    if (r.ok) { setDone(r.account); setStep('done'); return }
    setError(t(OAUTH_ERRORS[r.error] ?? 'mail.add.oauth.err.generic', { detail: r.detail ?? '' }))
  }

  const testImap = async () => {
    setBusy(true); setError(null)
    const email = form.email.trim().toLowerCase()
    const r = await connectImap({ ...form, email, user: form.user.trim() || email, visibility: shared ? 'agency' : 'owner' })
    setBusy(false)
    if (!r.error && r.data) { setDone(r.data.account); setStep('done'); return }
    setError(t(IMAP_ERRORS[r.error ?? ''] ?? 'mail.add.imap.err.generic'))
  }

  const champ = {
    background: ms.elev, border: `1px solid ${ms.bord}`, color: ms.ink, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box' as const, borderRadius: PILL,
    padding: 'var(--crm-space-lg) var(--crm-space-3xl)', fontSize: 'var(--crm-text-sm)', width: '100%',
  }
  const ghost = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${ms.bord3}`, borderRadius: PILL, padding: 'var(--crm-space-md) var(--crm-space-3xl)',
        fontSize: 'var(--crm-text-sm)', fontWeight: 500, background: 'transparent', color: ms.txt3,
        cursor: 'pointer', fontFamily: 'inherit', transition: MAIL_TRANSITION,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = ms.ink; e.currentTarget.style.color = ms.ink }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = ms.bord3; e.currentTarget.style.color = ms.txt3 }}
    >
      {label}
    </button>
  )
  // L'affordance PRIMAIRE porte l'accent (CLAUDE.md §3, décision du 10 août 2026).
  const primary = (label: string, onClick: () => void, disabled = false) => (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      style={{
        background: ms.accent, color: ms.accentInk, border: 'none', borderRadius: PILL,
        padding: 'var(--crm-space-md) var(--crm-space-4xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 600,
        cursor: disabled || busy ? 'default' : 'pointer', opacity: disabled || busy ? 0.6 : 1,
        fontFamily: 'inherit', transition: MAIL_TRANSITION,
      }}
    >
      {label}
    </button>
  )
  // Décochée par défaut (maître D14) : une boîte est personnelle tant que
  // l'agent n'a pas dit le contraire.
  const partage = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginTop: 'var(--crm-space-lg)', fontSize: 'var(--crm-text-sm)', cursor: 'pointer' }}>
      <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
      {t('mail.add.share')}
    </label>
  )
  const enTete = (p: Fournisseur, sousTitre: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-4xl)' }}>
      <MailProviderLogo ms={ms} provider={p} size={LOGO_ETAPE} />
      <div>
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{nomDe(p)}</div>
        <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{sousTitre}</div>
      </div>
    </div>
  )
  const erreur = error && (
    <div role="alert" style={{ fontSize: 'var(--crm-text-xs)', color: ms.danger, marginTop: 'var(--crm-space-md)' }}>{error}</div>
  )
  const ligneFournisseur = (p: MailProviderKey, name: string, sub: string | null, big = false) => (
    <button
      key={p}
      type="button"
      onClick={() => pick(p)}
      style={{
        display: 'flex', alignItems: 'center', gap: big ? 'var(--crm-space-3xl)' : 'var(--crm-space-lg)',
        padding: big ? 'var(--crm-space-2xl)' : 'var(--crm-space-lg) var(--crm-space-2xl)',
        border: `1px solid ${ms.bord}`, borderRadius: big ? 'var(--crm-radius-4xl)' : 'var(--crm-radius-xl)',
        background: 'transparent', color: ms.ink, cursor: 'pointer', textAlign: 'left', width: '100%',
        fontFamily: 'inherit', transition: MAIL_TRANSITION,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = ms.dim; e.currentTarget.style.background = ms.hover }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = ms.bord; e.currentTarget.style.background = 'transparent' }}
    >
      <MailProviderLogo ms={ms} provider={p} size={big ? LOGO_ETAPE : undefined} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: big ? 'var(--crm-text-lg)' : 'var(--crm-text-md)', fontWeight: 600 }}>{name}</span>
        {sub && <span style={{ display: 'block', fontSize: 'var(--crm-text-sm)', color: ms.mut, marginTop: 'var(--crm-space-2xs)' }}>{sub}</span>}
      </span>
      <MEIcon name="chevron-right" size={13} color={ms.mut} />
    </button>
  )

  const fermer = () => { cancel(); onClose() }

  return (
    <MailModalShell ms={ms} open={open} onClose={fermer} width={LARGEUR} ariaLabel={t('mail.add.title')} veil={VOILE}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 500, margin: 0 }}>{t('mail.add.title')}</h2>
        <MailCloseButton ms={ms} onClick={fermer} label={t('mail.actions.close')} />
      </div>

      {step === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)', marginTop: 'var(--crm-space-2xl)' }}>
          {ligneFournisseur('wa', 'WhatsApp Business', t('mail.add.waSub'), true)}
          {ligneFournisseur('gmail', PRESET.gmail.name, null)}
          {ligneFournisseur('outlook', PRESET.outlook.name, null)}
          {ligneFournisseur('infomaniak', PRESET.infomaniak.name, t('mail.add.imapSub'))}
          {ligneFournisseur('bluewin', PRESET.bluewin.name, t('mail.add.imapSub'))}
          {ligneFournisseur('imap', t('mail.add.other'), t('mail.add.otherSub'))}
        </div>
      )}

      {step === 'oauth' && (
        <div>
          {enTete(prov, t('mail.add.oauth.subtitle'))}
          <input
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            placeholder={t('mail.add.oauth.addrPlaceholder')}
            aria-label={t('mail.add.oauth.addr')}
            type="email"
            autoComplete="email"
            style={{ ...champ, marginTop: 'var(--crm-space-2xl)' }}
          />
          {/* Dire ce que l'agent accorde AVANT de l'envoyer chez le fournisseur :
              l'écran de consentement, lui, parle la langue de Google. */}
          <div style={{ marginTop: 'var(--crm-space-lg)', border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-4xl)', padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)' }}>
            <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: ms.mut }}>{t('mail.add.oauth.access')}</div>
            {(['read', 'file', 'labels'] as const).map((k) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', fontSize: 'var(--crm-text-sm)' }}>
                <MEIcon name="check" size={13} color={ms.accent} />
                {t(`mail.add.oauth.scope.${k}`)}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut, lineHeight: 1.6, marginTop: 'var(--crm-space-lg)' }}>
            {t('mail.add.oauth.note', { provider: nomDe(prov) })}
          </div>
          {partage}
          {erreur}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-3xl)' }}>
            <button
              type="button"
              onClick={() => { setForm((f) => ({ ...f, email: addr, user: addr })); setStep('imap') }}
              style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', color: ms.txt3, fontSize: 'var(--crm-text-xs)', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
            >
              {t('mail.add.oauth.useImap')}
            </button>
            {ghost(t('mail.add.back'), () => { cancel(); setStep('list') })}
            {primary(busy ? t('mail.add.oauth.busy') : t('mail.add.oauth.authorize'), () => void authorize())}
          </div>
        </div>
      )}

      {step === 'imap' && (
        <div>
          {enTete(prov, t('mail.add.imap.subtitle'))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-md)', marginTop: 'var(--crm-space-2xl)' }}>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={t('mail.add.imap.email')} aria-label={t('mail.add.imap.email')} type="email" style={{ ...champ, gridColumn: 'span 2' }} />
            <input value={form.imap_host} onChange={(e) => setForm({ ...form, imap_host: e.target.value })} placeholder={t('mail.add.imap.imapHost')} aria-label={t('mail.add.imap.imapHost')} style={champ} />
            <input value={form.imap_port} onChange={(e) => setForm({ ...form, imap_port: Number(e.target.value) || 0 })} placeholder={t('mail.add.imap.port')} aria-label={t('mail.add.imap.imapPort')} inputMode="numeric" style={champ} />
            <input value={form.smtp_host} onChange={(e) => setForm({ ...form, smtp_host: e.target.value })} placeholder={t('mail.add.imap.smtpHost')} aria-label={t('mail.add.imap.smtpHost')} style={champ} />
            <input value={form.smtp_port} onChange={(e) => setForm({ ...form, smtp_port: Number(e.target.value) || 0 })} placeholder={t('mail.add.imap.port')} aria-label={t('mail.add.imap.smtpPort')} inputMode="numeric" style={champ} />
            <input value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} placeholder={t('mail.add.imap.user')} aria-label={t('mail.add.imap.user')} autoComplete="username" style={champ} />
            <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={t('mail.add.imap.password')} aria-label={t('mail.add.imap.password')} type="password" autoComplete="current-password" style={champ} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginTop: 'var(--crm-space-lg)' }}>
            <span style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{t('mail.add.imap.encryption')}</span>
            {(['ssl', 'starttls'] as const).map((enc) => (
              <button
                key={enc}
                type="button"
                aria-pressed={form.encryption === enc}
                onClick={() => setForm({ ...form, encryption: enc, smtp_port: enc === 'ssl' ? 465 : 587 })}
                style={{
                  borderRadius: PILL, padding: 'var(--crm-space-xs) var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', fontWeight: 500,
                  border: `1px solid ${form.encryption === enc ? ms.accent : ms.bord3}`,
                  background: form.encryption === enc ? ms.accent : ms.elev,
                  color: form.encryption === enc ? ms.accentInk : ms.txt3,
                  cursor: 'pointer', fontFamily: 'inherit', transition: MAIL_TRANSITION,
                }}
              >
                {enc === 'ssl' ? 'SSL / TLS' : 'STARTTLS'}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut, lineHeight: 1.6, marginTop: 'var(--crm-space-lg)' }}>{t('mail.add.imap.note')}</div>
          {partage}
          {erreur}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-3xl)' }}>
            {ghost(t('mail.add.back'), () => setStep('list'))}
            {primary(busy ? t('mail.add.oauth.busy') : t('mail.add.imap.test'), () => void testImap(), !form.email.includes('@') || !form.password)}
          </div>
        </div>
      )}

      {step === 'done' && done && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-4xl)' }}>
            <div style={{ width: LOGO_ETAPE, height: LOGO_ETAPE, borderRadius: '50%', background: ms.success, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <MEIcon name="check" size={18} color={ms.successInk} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{t('mail.add.done.title')}</div>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{done.email}</div>
            </div>
          </div>
          {/* « Dossiers importés » ne cite PAS les brouillons : ils sont locaux et
              ne sont jamais synchronisés depuis le fournisseur (maître D7). */}
          <div style={{ marginTop: 'var(--crm-space-2xl)', border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-4xl)', padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', fontSize: 'var(--crm-text-sm)' }}>
            {([['sync', 'syncValue'], ['folders', 'foldersValue'], ['linking', 'linkingValue']] as const).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
                <span style={{ color: ms.mut }}>{t(`mail.add.done.${k}`)}</span>
                <span style={{ marginLeft: 'auto' }}>{t(`mail.add.done.${v}`)}</span>
              </div>
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
