/**
 * L'assistant « Ajouter une boîte » (README §6), transposé en MEGGA X.
 *
 * Quatre étapes :
 *  · `list`  — Google, Microsoft, ou « Autre boîte (IMAP / SMTP) » ;
 *  · `oauth` — Google et Microsoft, par la pop-up de consentement (maître D1) ;
 *  · `imap`  — toute autre boîte, par mot de passe (lot 3) ;
 *  · `done`  — la boîte connectée.
 *
 * ⚠ PLUS DE TUILE PAR FOURNISSEUR SUISSE (Julien, 14.09.2026 : « Bluewin, Infomaniak, on
 * peut supprimer, juste mettre IMAP »). Ce qu'elles apportaient — les serveurs — vient
 * désormais de l'ADRESSE : `mail-oauth imap_detect` reconnaît le fournisseur par le domaine
 * puis par le MX, et l'étape pré-remplit des champs qui restent modifiables. Un domaine
 * d'agence hébergé chez Infomaniak est ainsi reconnu, ce qu'une tuile ne faisait pas.
 *
 * ⚠ Une adresse Google ou Microsoft saisie en IMAP est RENVOYÉE vers sa connexion OAuth :
 * Microsoft refuse le mot de passe en IMAP, Google ne l'accepte qu'en mot de passe
 * d'application — pour Google, l'IMAP reste donc proposé.
 *
 * ⛔ PLUS DE LIGNE WHATSAPP (Julien, 14.09.2026 : « on ne va pas ajouter une boîte avec
 * WhatsApp, ça n'a pas de sens »). WhatsApp n'est pas une boîte (maître D13) : il s'appaire
 * dans Réglages › Intégrations, et sa ligne ne faisait que renvoyer là-bas.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { adresseValide } from '@/lib/mail/compose'
import { useMailAccounts, type ImapDetection, type ImapForm, type MailAccount } from '@/hooks/useMailAccounts'
import { useMailOAuthPopup } from '@/hooks/useMailOAuthPopup'
import { MailCloseButton, MailModalShell } from './MailModalShell'
import { MailProviderLogo, type MailProviderKey } from './MailProviderLogo'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

type Step = 'list' | 'oauth' | 'imap' | 'done'
type Fournisseur = MailProviderKey
type ViaOAuth = 'gmail' | 'outlook'

/** Largeur de la carte (README §6). */
const LARGEUR = 520
const VOILE = 0.12
/** Diamètre du logo en tête d'étape et de la pastille verte « connectée ». */
const LOGO_ETAPE = 40
/** La pastille de l'œil, logée dans le bord droit du champ « Mot de passe ». */
const OEIL = 28
/** Le temps de finir de taper l'adresse avant d'en chercher les serveurs. */
const ATTENTE_DETECTION = 400

const NOM_OAUTH: Record<ViaOAuth, string> = { gmail: 'Google Workspace', outlook: 'Outlook / Microsoft 365' }
/** Le fournisseur dans une phrase : « Connecter avec Google ». */
const MARQUE: Record<ViaOAuth, string> = { gmail: 'Google', outlook: 'Microsoft' }

/**
 * Les ports que `connect_imap` accepte, et ce qu'ils disent du chiffrement : un CHOIX, pas
 * un champ libre — un port libre finissait en `port_not_allowed`, et le chiffrement se
 * déduit du port (993 et 465 d'emblée, 143 et 587 par STARTTLS).
 */
const PORTS_IMAP: [number, string][] = [[993, '993 · SSL/TLS'], [143, '143 · STARTTLS']]
const PORTS_SMTP: [number, string][] = [[465, '465 · SSL/TLS'], [587, '587 · STARTTLS']]

type Serveurs = Pick<ImapForm, 'imap_host' | 'imap_port' | 'smtp_host' | 'smtp_port'>
const SERVEURS_VIDES: Serveurs = { imap_host: '', imap_port: 993, smtp_host: '', smtp_port: 465 }

/**
 * Motif du serveur → clé i18n. `connection_failed` se lit par son `detail`, qui nomme
 * l'étape en échec ; ce qui n'y figure pas tombe sur `connection`, puis `generic`.
 */
const IMAP_ERRORS: Record<string, string> = {
  invalid_input: 'mail.add.imap.err.invalid',
  port_not_allowed: 'mail.add.imap.err.port',
  host_not_allowed: 'mail.add.imap.err.host',
  already_connected: 'mail.add.imap.err.already',
  owned_by_colleague: 'mail.add.imap.err.colleague',
  too_many_attempts: 'mail.add.imap.err.tooMany',
  imap_auth: 'mail.add.imap.err.imapAuth',
  imap_unreachable: 'mail.add.imap.err.imapUnreachable',
  imap_starttls: 'mail.add.imap.err.imapStarttls',
  imap_certificate: 'mail.add.imap.err.imapCertificate',
  smtp_auth: 'mail.add.imap.err.smtpAuth',
  smtp_unreachable: 'mail.add.imap.err.smtpUnreachable',
  smtp_starttls: 'mail.add.imap.err.smtpStarttls',
  smtp_certificate: 'mail.add.imap.err.smtpCertificate',
}
const OAUTH_ERRORS: Record<string, string> = {
  popup_blocked: 'mail.add.oauth.err.popupBlocked',
  cancelled: 'mail.add.oauth.err.cancelled',
  timeout: 'mail.add.oauth.err.timeout',
  denied: 'mail.add.oauth.err.denied',
  provider_not_configured: 'mail.add.oauth.err.notConfigured',
  exchange_failed: 'mail.add.oauth.err.exchange',
}

type Detection = { etat: 'repos' } | { etat: 'recherche' } | { etat: 'faite'; resultat: ImapDetection }

interface Props {
  ms: MailSurfaces
  open: boolean
  onClose: () => void
  onOpenAccount: (accountId: string) => void
}

/** L'assistant complet, monté à l'ouverture et démonté à la fermeture. */
export function MailAddAccountModal({ ms, open, onClose, onOpenAccount }: Props) {
  const { t } = useTranslation('messages')
  const { connect, cancel } = useMailOAuthPopup()
  const { detectImap, connectImap } = useMailAccounts()
  const [step, setStep] = useState<Step>('list')
  const [prov, setProv] = useState<Fournisseur>('gmail')
  const [addr, setAddr] = useState('')
  const [shared, setShared] = useState(false)
  const [form, setForm] = useState<ImapForm>({ email: '', ...SERVEURS_VIDES, user: '', password: '', visibility: 'owner' })
  const [detection, setDetection] = useState<Detection>({ etat: 'repos' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<MailAccount | null>(null)
  /** L'agent a tapé un serveur ou changé un port : la détection ne les écrase plus. */
  const [serveursSaisis, setServeursSaisis] = useState(false)
  /** Le mot de passe en clair, le temps que l'agent le relise. */
  const [voirMdp, setVoirMdp] = useState(false)
  /*
   * ⚠ AUCUN EFFET DE REMISE À ZÉRO ICI, et ce n'est pas un oubli : `MessagerieApp`
   * MONTE et DÉMONTE l'assistant avec la modale (même patron que le composeur),
   * donc rouvrir « Ajouter une boîte » repart déjà du choix du fournisseur. Un
   * `useEffect` qui rejouerait cinq `setState` sur `open` ferait un rendu de plus
   * pour arriver à l'état que le montage donne gratuitement — c'est exactement ce
   * que `react-hooks/set-state-in-effect` signale.
   */

  /*
   * Les serveurs de l'adresse, une fois la frappe posée. Le nettoyage de l'effet est la
   * garde : une réponse arrivée pour une adresse déjà retapée est jetée, jamais appliquée.
   */
  useEffect(() => {
    const email = form.email.trim().toLowerCase()
    if (!adresseValide(email)) return
    let perimee = false
    const minuterie = window.setTimeout(() => {
      void detectImap(email).then((r) => {
        if (perimee) return
        const resultat: ImapDetection = r.data ?? { oauth: null, preset: null }
        setDetection({ etat: 'faite', resultat })
        const p = resultat.preset
        const serveurs: Serveurs = p ? { imap_host: p.imapHost, imap_port: p.imapPort, smtp_host: p.smtpHost, smtp_port: p.smtpPort } : SERVEURS_VIDES
        // Une adresse corrigée vers un fournisseur inconnu vide AUSSI les serveurs devinés
        // pour l'ancienne : des serveurs Bluewin sous une adresse d'agence seraient un piège.
        // Ceux que l'agent a tapés ne bougent pas — sauf s'il les a effacés.
        setForm((f) => (serveursSaisis && (f.imap_host.trim() || f.smtp_host.trim()) ? f : { ...f, ...serveurs }))
      })
    }, ATTENTE_DETECTION)
    return () => { perimee = true; window.clearTimeout(minuterie) }
  }, [form.email, serveursSaisis, detectImap])

  const nomDe = (p: Fournisseur) => (p === 'imap' ? t('mail.add.other') : NOM_OAUTH[p])

  /**
   * L'adresse change : « Recherche des serveurs… » tout de suite, la requête après la frappe.
   * L'échec du test précédent s'efface — il parlait d'une autre boîte.
   */
  const saisirAdresse = (valeur: string) => {
    setForm((f) => ({ ...f, email: valeur }))
    setDetection(adresseValide(valeur.trim().toLowerCase()) ? { etat: 'recherche' } : { etat: 'repos' })
    setError(null)
  }
  const saisirServeurs = (champs: Partial<Serveurs>) => {
    setForm((f) => ({ ...f, ...champs }))
    setServeursSaisis(true)
  }

  const pick = (p: Fournisseur) => {
    setProv(p); setError(null)
    setStep(p === 'imap' ? 'imap' : 'oauth')
  }

  /** De l'étape IMAP vers la connexion du fournisseur reconnu, l'adresse reportée. */
  const versOAuth = (p: ViaOAuth) => {
    setAddr(form.email.trim()); setProv(p); setError(null); setStep('oauth')
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
    const cle = r.error === 'connection_failed' ? IMAP_ERRORS[r.detail ?? ''] ?? 'mail.add.imap.err.connection' : IMAP_ERRORS[r.error ?? '']
    const fournisseur = r.detail === 'gmail' || r.detail === 'outlook' ? MARQUE[r.detail] : r.detail ?? ''
    setError(t(cle ?? 'mail.add.imap.err.generic', { provider: fournisseur }))
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
  /** Un lien discret dans une phrase (« Configurer en IMAP », « Connecter avec Google »). */
  const lien = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      style={{ background: 'none', border: 'none', color: ms.txt3, fontSize: 'var(--crm-text-xs)', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
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
  const enTete = (p: Fournisseur, sousTitre?: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-4xl)' }}>
      <MailProviderLogo ms={ms} provider={p} size={LOGO_ETAPE} />
      <div>
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{nomDe(p)}</div>
        {sousTitre && <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{sousTitre}</div>}
      </div>
    </div>
  )
  const erreur = error && (
    <div role="alert" style={{ fontSize: 'var(--crm-text-xs)', color: ms.dangerText, marginTop: 'var(--crm-space-md)' }}>{error}</div>
  )
  // Un nom par ligne, sans sous-titre (Julien, 14.09.2026) : le logo et le nom suffisent.
  const ligneFournisseur = (p: Fournisseur, name: string) => (
    <button
      key={p}
      type="button"
      onClick={() => pick(p)}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)',
        padding: 'var(--crm-space-lg) var(--crm-space-2xl)',
        border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-xl)',
        background: 'transparent', color: ms.ink, cursor: 'pointer', textAlign: 'left', width: '100%',
        fontFamily: 'inherit', transition: MAIL_TRANSITION,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = ms.dim; e.currentTarget.style.background = ms.hover }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = ms.bord; e.currentTarget.style.background = 'transparent' }}
    >
      <MailProviderLogo ms={ms} provider={p} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{name}</span>
      <MEIcon name="chevron-right" size={13} color={ms.mut} />
    </button>
  )
  const choixPort = (valeur: number, ports: [number, string][], label: string, onChange: (p: number) => void) => (
    <div style={{ position: 'relative' }}>
      <select
        value={valeur}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        style={{ ...champ, appearance: 'none', paddingRight: 'var(--crm-space-6xl)', cursor: 'pointer' }}
      >
        {ports.map(([p, libelle]) => <option key={p} value={p}>{libelle}</option>)}
      </select>
      <span aria-hidden style={{ position: 'absolute', right: 'var(--crm-space-2xl)', top: '50%', transform: 'translateY(-50%)', display: 'flex', pointerEvents: 'none' }}>
        <MEIcon name="chevron-down" size={12} color={ms.mut} />
      </span>
    </div>
  )
  /** Ce que la détection a trouvé, sous l'adresse. */
  const indice = () => {
    const ligne = (contenu: ReactNode) => (
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--crm-space-sm)', marginTop: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-xs)', color: ms.mut, lineHeight: 1.6 }}>
        {contenu}
      </div>
    )
    if (detection.etat === 'recherche') return ligne(t('mail.add.imap.detect.searching'))
    if (detection.etat !== 'faite') return null
    const { oauth, preset } = detection.resultat
    // Venu de Google, l'agent a déjà écarté la connexion Google : on ne la lui repropose pas.
    if (oauth && oauth !== prov) {
      return ligne(<>
        <span>{t(oauth === 'gmail' ? 'mail.add.imap.detect.google' : 'mail.add.imap.detect.microsoft')}</span>
        {lien(t('mail.add.imap.detect.useOauth', { provider: MARQUE[oauth] }), () => versOAuth(oauth))}
      </>)
    }
    if (preset) {
      return ligne(<>
        <MEIcon name="check" size={12} color={ms.successText} />
        <span>{t('mail.add.imap.detect.found', { provider: preset.nom })}</span>
        {preset.motDePasseApplication && <span>{t('mail.add.imap.detect.appPassword')}</span>}
        {/* GMX, WEB.DE, mail.com, Zoho : IMAP coupé par défaut — sans l'activer, le test
            échouerait en « mot de passe refusé », et l'agent chercherait au mauvais endroit. */}
        {preset.activerImap && <span>{t('mail.add.imap.detect.enableImap', { provider: preset.nom })}</span>}
      </>)
    }
    return ligne(t('mail.add.imap.detect.none'))
  }

  const fermer = () => { cancel(); onClose() }
  /** « Ajouter une autre » : l'assistant repart vierge, sans l'adresse ni le mot de passe de la précédente. */
  const recommencer = () => {
    setForm({ email: '', ...SERVEURS_VIDES, user: '', password: '', visibility: 'owner' })
    setServeursSaisis(false)
    setVoirMdp(false)
    setDetection({ etat: 'repos' }); setAddr(''); setDone(null); setError(null); setStep('list')
  }
  const imapPret = adresseValide(form.email.trim().toLowerCase()) && !!form.password && !!form.imap_host.trim() && !!form.smtp_host.trim()

  return (
    <MailModalShell ms={ms} open={open} onClose={fermer} width={LARGEUR} ariaLabel={t('mail.add.title')} veil={VOILE}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 500, margin: 0 }}>{t('mail.add.title')}</h2>
        <MailCloseButton ms={ms} onClick={fermer} label={t('mail.actions.close')} />
      </div>

      {step === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)', marginTop: 'var(--crm-space-2xl)' }}>
          {ligneFournisseur('gmail', NOM_OAUTH.gmail)}
          {ligneFournisseur('outlook', NOM_OAUTH.outlook)}
          {ligneFournisseur('imap', t('mail.add.other'))}
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
                <MEIcon name="check" size={13} color={ms.accentText} />
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
            {/* Microsoft n'accepte plus de mot de passe en IMAP : proposer ce chemin à une
                boîte Outlook, c'était promettre un échec. Google, lui, l'accepte en mot de
                passe d'application. */}
            <span style={{ flex: 1 }}>
              {prov === 'gmail' && lien(t('mail.add.oauth.useImap'), () => { saisirAdresse(addr); setError(null); setStep('imap') })}
            </span>
            {ghost(t('mail.add.back'), () => { cancel(); setStep('list') })}
            {primary(busy ? t('mail.add.oauth.busy') : t('mail.add.oauth.authorize'), () => void authorize())}
          </div>
        </div>
      )}

      {step === 'imap' && (
        <div>
          {/* Ni sous-titre ni note (Julien, 14.09.2026) : « Autre boîte (IMAP / SMTP) »
              dit déjà le mode, et le bouton « Tester et connecter » ce que fait le test. */}
          {enTete(prov)}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', marginTop: 'var(--crm-space-2xl)' }}>
            <div>
              <input value={form.email} onChange={(e) => saisirAdresse(e.target.value)} placeholder={t('mail.add.imap.email')} aria-label={t('mail.add.imap.email')} type="email" autoComplete="off" style={champ} />
              {/* La région existe AVANT son contenu : un lecteur d'écran n'annonce pas une
                  région vivante née avec le texte qu'elle porte. */}
              <div aria-live="polite">{indice()}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 'var(--crm-space-md)' }}>
              <input value={form.imap_host} onChange={(e) => saisirServeurs({ imap_host: e.target.value })} placeholder={t('mail.add.imap.imapHost')} aria-label={t('mail.add.imap.imapHost')} autoComplete="off" spellCheck={false} style={champ} />
              {choixPort(form.imap_port, PORTS_IMAP, t('mail.add.imap.imapPort'), (p) => saisirServeurs({ imap_port: p }))}
              <input value={form.smtp_host} onChange={(e) => saisirServeurs({ smtp_host: e.target.value })} placeholder={t('mail.add.imap.smtpHost')} aria-label={t('mail.add.imap.smtpHost')} autoComplete="off" spellCheck={false} style={champ} />
              {choixPort(form.smtp_port, PORTS_SMTP, t('mail.add.imap.smtpPort'), (p) => saisirServeurs({ smtp_port: p }))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-md)' }}>
              {/* ⚠ Ni `username` ni `current-password` : le navigateur proposerait d'y
                  ranger — ou d'y remplir — les identifiants du CRM lui-même. */}
              {/* Vide, l'identifiant EST l'adresse (`connect_imap`) : on le montre au lieu de le taire. */}
              <input value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} placeholder={form.email.trim() || t('mail.add.imap.user')} aria-label={t('mail.add.imap.user')} autoComplete="off" spellCheck={false} style={champ} />
              <div style={{ position: 'relative' }}>
                {/* ⛔ Ni correcteur ni majuscule automatique : affiché en clair, le mot de
                    passe devient un texte comme un autre, et la correction « améliorée »
                    de Chrome envoie ce qu'on tape aux serveurs de Google. */}
                <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={t('mail.add.imap.password')} aria-label={t('mail.add.imap.password')} type={voirMdp ? 'text' : 'password'} autoComplete="off" spellCheck={false} autoCapitalize="off" autoCorrect="off" style={{ ...champ, paddingRight: 'var(--crm-space-6xl)' }} />
                <button
                  type="button"
                  onClick={() => setVoirMdp((v) => !v)}
                  // Le curseur reste dans le champ : on relit sans perdre sa place.
                  onMouseDown={(e) => e.preventDefault()}
                  aria-label={t(voirMdp ? 'mail.add.imap.hidePassword' : 'mail.add.imap.showPassword')}
                  aria-pressed={voirMdp}
                  title={t(voirMdp ? 'mail.add.imap.hidePassword' : 'mail.add.imap.showPassword')}
                  style={{
                    position: 'absolute', right: 'var(--crm-space-md)', top: '50%', transform: 'translateY(-50%)',
                    width: OEIL, height: OEIL, borderRadius: '50%', border: 'none', background: 'transparent',
                    display: 'grid', placeItems: 'center', cursor: 'pointer', color: voirMdp ? ms.ink : ms.mut,
                    padding: 0, transition: MAIL_TRANSITION,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = ms.ink; e.currentTarget.style.background = ms.hover }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = voirMdp ? ms.ink : ms.mut; e.currentTarget.style.background = 'transparent' }}
                >
                  <MEIcon name={voirMdp ? 'eye-off' : 'eye'} size={15} />
                </button>
              </div>
            </div>
          </div>
          {partage}
          {erreur}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-3xl)' }}>
            {ghost(t('mail.add.back'), () => { setError(null); setStep('list') })}
            {primary(busy ? t('mail.add.imap.testing') : t('mail.add.imap.test'), () => void testImap(), !imapPret)}
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
            {ghost(t('mail.add.done.another'), recommencer)}
            {primary(t('mail.add.done.open'), () => { onOpenAccount(done.id); onClose() })}
          </div>
        </div>
      )}
    </MailModalShell>
  )
}
