/**
 * Écran de réglages mobile (P9). Le fichier = le composant public
 * `MobileSettingsScreen` (routeur `view` interne + câblage hooks) suivi des
 * atomes de présentation partagés (Header, Card, Field, Toggle, Segment, Ring…)
 * puis d'une section par vue (Hub, Profil, Agence, Notifications, Facturation,
 * Préférences).
 */
import { useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useAgentProfileSugar } from '@/hooks/useAgentProfileSugar'
import { useAgencySettings, type AgencySettingsData, type AgencyPlan } from '@/hooks/useAgencySettings'
import { useNotifPreferences, type NotifPreferences } from '@/hooks/useNotifPreferences'
import { useAgencyTargets } from '@/hooks/useAgencyTargets'
import { profileCompletionScore, type ProfileData } from '@/components/crm-sugar/settings/data'
import { formatCHF } from '@/lib/utils'
import SgToast from '../primitives/SgToast'
import { useSgToast } from '../primitives/useSgToast'
import { MOBILE_FONT, type MobileTokens } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'

type View = 'hub' | 'profile' | 'agency' | 'notifications' | 'billing' | 'preferences'

// ─── Démo (harnais /dev/mobile) — gated, aucun fetch ni write Supabase ────────
const DEMO_PROFILE: ProfileData = {
  firstName: 'Gregory', lastName: 'Lyonnet', title: 'Agent principal',
  agency: 'MEGGA Genève', email: 'gregory@megga.ch',
  phone: '+41 22 555 01 02', mobile: '+41 79 412 88 21', rcc: 'RCC-2018-GE-4421',
  languages: [], specialties: [],
  bio: 'Spécialiste du marché genevois depuis 12 ans. Mandats exclusifs.',
  signature: 'Cordialement, Gregory Lyonnet',
  website: '', linkedin: '',
  initials: 'GL', avatarBg: '#0041D9', signatureMode: 'text', signatureHtml: '', avatarUrl: null,
}
const DEMO_AGENCY: AgencySettingsData = {
  name: 'MEGGA Genève', address: 'Rue du Rhône 100', city: 'Genève', canton: 'GE',
  phone: '+41 22 555 01 00', email: 'contact@megga.ch', website: 'megga.ch', logoUrl: '',
  // legalFormId vide en démo : c'est une FK vers legal_forms, aucun uuid stable à coder ici.
  legal: 'MEGGA Genève SA', legalFormId: '', businessRegistrationNumber: 'CHE-409.118.221', tva: 'CHE-409.118.221 TVA',
  foundedYear: '2014', postal: '1204', country: 'Suisse', aboutShort: '',
}
const DEMO_NOTIF: NotifPreferences = { email: true, sms: false, whatsapp: true, inapp: true }
const DEMO_PLAN: AgencyPlan = 'pro'
const DEMO_YEARLY = 1200000

const PLAN_KEYS: Record<AgencyPlan, string> = {
  starter: 'subscription.plans.starter.name',
  pro: 'subscription.plans.pro.name',
  agency: 'subscription.plans.agency.name',
  enterprise: 'subscription.plans.entreprise.name',
}

/**
 * Réglages mobile (P9) — hub de tuiles → drill-in (router `view` interne), porté
 * du proto `crm-settings-mobile`. Read-first + édits sûrs : Profil, Agence
 * (+ Objectif annuel), Notifications, Facturation (plan lecture seule),
 * Préférences (thème + langue LIVE). 100 % câblé sur les hooks de réglages
 * (`useAgentProfileSugar`, `useAgencySettings`, `useNotifPreferences`,
 * `useAgencyTargets`) ; thème/langue via `useTheme` + `i18n` (même canal que le
 * hub Plus). Différés : upload avatar/logo, Sécurité (2FA/sessions), Intégrations
 * OAuth, gestion Stripe — backend non porté ou écriture à effet de bord.
 * `demo` alimente le harnais sans toucher Supabase ni naviguer.
 */
export function MobileSettingsScreen({ demo = false }: { demo?: boolean }) {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation(['settings', 'common', 'dashboard'])
  const { tk, isDark } = useMobileTokens()
  const { setTheme } = useTheme()
  const { signOut } = useAuth()
  const live = !demo

  const [view, setView] = useState<View>('hub')
  const { toast, showToast } = useSgToast()

  // Hooks de réglages — gated en démo (pas de fetch ; profileId/agencyId nuls hors auth).
  const prof = useAgentProfileSugar({ enabled: live })
  const ag = useAgencySettings({ enabled: live })
  const notif = useNotifPreferences({ enabled: live })
  const targets = useAgencyTargets({ enabled: live })

  // Formulaires : base (hook ou démo) + couche d'édits locale (les édits priment,
  // donc un refetch ne clobbe jamais une saisie en cours). On vide les édits au save.
  const baseProfile = demo ? DEMO_PROFILE : prof.profile
  const [profileEdits, setProfileEdits] = useState<Partial<ProfileData>>({})
  const profileForm: ProfileData = { ...baseProfile, ...profileEdits }

  const baseAgency = demo ? DEMO_AGENCY : ag.agency
  const [agencyEdits, setAgencyEdits] = useState<Partial<AgencySettingsData>>({})
  const agencyForm: AgencySettingsData = { ...baseAgency, ...agencyEdits }

  const baseNotif = demo ? DEMO_NOTIF : notif.preferences
  const [notifEdits, setNotifEdits] = useState<Partial<NotifPreferences>>({})
  const notifForm: NotifPreferences = { ...baseNotif, ...notifEdits }

  const baseYearly = demo ? DEMO_YEARLY : targets.targets.yearly
  const [yearlyEdit, setYearlyEdit] = useState<string | null>(null)
  const yearlyForm = yearlyEdit ?? (baseYearly > 0 ? String(baseYearly) : '')

  const plan: AgencyPlan | null = demo ? DEMO_PLAN : ag.plan
  const notifCount = Object.values(notifForm).filter(Boolean).length

  // Éditable = démo (no-op visuel) OU backend présent. Saves désactivés sinon.
  const profileEditable = demo || prof.hasBackend
  const agencyEditable = demo || ag.hasBackend
  const notifEditable = demo || notif.hasBackend

  const goMore = () => { if (live) navigate('/dashboard/more') }
  const logout = () => { if (live) void signOut().then(() => navigate('/login')) }

  const saveProfile = () => {
    if (!profileEditable || prof.isSaving) return
    if (!live) { showToast(t('settings:profile.toast.saved')); setView('hub'); return }
    void prof.save(profileForm)
      .then(() => { setProfileEdits({}); showToast(t('settings:profile.toast.saved')); setView('hub') })
      .catch(() => showToast(t('settings:profile.toast.saveError')))
  }

  const saveAgency = () => {
    if (!agencyEditable || ag.isSaving) return
    if (!agencyForm.name.trim()) { showToast(t('settings:agency.toast.saveError')); return }
    if (!live) { showToast(t('settings:agency.toast.saved')); setView('hub'); return }
    void ag.save(agencyForm)
      .then(() => { setAgencyEdits({}); showToast(t('settings:agency.toast.saved')); setView('hub') })
      .catch(() => showToast(t('settings:agency.toast.saveError')))
  }

  const saveYearly = () => {
    if (!agencyEditable || targets.isSaving) return
    const n = Math.max(0, Math.round(Number(yearlyForm.replace(/[^\d]/g, '')) || 0))
    if (!live) { showToast(t('settings:agency.targets.toastSaved')); return }
    void targets.saveYearly(n)
      .then(() => { setYearlyEdit(null); showToast(t('settings:agency.targets.toastSaved')) })
      .catch(() => showToast(t('settings:agency.targets.toastError')))
  }

  const toggleChannel = (k: keyof NotifPreferences) => {
    if (!notifEditable || notif.isSaving) return
    const next: NotifPreferences = { ...notifForm, [k]: !notifForm[k] }
    setNotifEdits((e) => ({ ...e, [k]: next[k] }))
    if (!live) return
    void notif.save(next)
      .then(() => showToast(t('settings:notifications.toast.saved')))
      .catch(() => {
        // Échec d'écriture : on annule l'édit optimiste pour retomber sur la
        // valeur persistée (sinon l'UI + les compteurs dérivés mentent).
        setNotifEdits((e) => { const rest = { ...e }; delete rest[k]; return rest })
        showToast(t('settings:notifications.toast.saveError'))
      })
  }

  const ctx: SectionCtx = { t, tk, isDark }

  return (
    <div style={{ fontFamily: MOBILE_FONT, color: tk.ink }}>
      <div key={view} style={{ animation: 'stmRise .4s cubic-bezier(.2,.8,.2,1) both' }}>
        {view === 'hub' && (
          <Hub
            ctx={ctx}
            profile={profileForm}
            notifCount={notifCount}
            plan={plan}
            onBack={goMore}
            onGo={setView}
            onLogout={logout}
          />
        )}
        {view === 'profile' && (
          <ProfileSection
            ctx={ctx}
            form={profileForm}
            editable={profileEditable}
            isSaving={prof.isSaving}
            signedOut={live && !prof.hasBackend}
            onChange={(p) => setProfileEdits((e) => ({ ...e, ...p }))}
            onSave={saveProfile}
            onBack={() => setView('hub')}
          />
        )}
        {view === 'agency' && (
          <AgencySection
            ctx={ctx}
            form={agencyForm}
            yearly={yearlyForm}
            editable={agencyEditable}
            isSaving={ag.isSaving}
            isSavingTarget={targets.isSaving}
            signedOut={live && !ag.hasBackend}
            onChange={(p) => setAgencyEdits((e) => ({ ...e, ...p }))}
            onYearly={setYearlyEdit}
            onSave={saveAgency}
            onSaveYearly={saveYearly}
            onBack={() => setView('hub')}
          />
        )}
        {view === 'notifications' && (
          <NotificationsSection
            ctx={ctx}
            form={notifForm}
            count={notifCount}
            editable={notifEditable}
            signedOut={live && !notif.hasBackend}
            onToggle={toggleChannel}
            onBack={() => setView('hub')}
          />
        )}
        {view === 'billing' && (
          <BillingSection ctx={ctx} plan={plan} onBack={() => setView('hub')} />
        )}
        {view === 'preferences' && (
          <PreferencesSection
            ctx={ctx}
            lang={i18n.language.startsWith('en') ? 'en' : 'fr'}
            onLang={(v) => void i18n.changeLanguage(v)}
            onTheme={(v) => setTheme(v)}
            onBack={() => setView('hub')}
          />
        )}
      </div>

      <SgToast toast={toast} />
      <style>{'@keyframes stmRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}'}</style>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  Contexte partagé + atomes
// ════════════════════════════════════════════════════════════════════════════
interface SectionCtx {
  t: TFunction
  tk: MobileTokens
  isDark: boolean
}

/** En-tête d'une section détail : bouton-retour pilule + grand titre. */
function Header({ tk, backLabel, onBack, title }: { tk: MobileTokens; backLabel: string; onBack: () => void; title: string }) {
  return (
    <>
      <header style={{ display: 'flex', alignItems: 'center', padding: 'calc(env(safe-area-inset-top) + 14px) 18px 4px' }}>
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px 0 8px', borderRadius: 999, border: `1px solid ${tk.cardBorder}`, cursor: 'pointer', background: tk.card, boxShadow: tk.shadowSm, fontFamily: 'inherit' }}
        >
          <MEIcon name="chevron-left" size={18} color={tk.ink} strokeWidth={2.2} />
          <span style={{ fontSize: 13.5, fontWeight: 800, color: tk.ink }}>{backLabel}</span>
        </button>
      </header>
      <div style={{ padding: '4px 18px 0' }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -1, color: tk.ink, lineHeight: 1.05 }}>{title}</h1>
      </div>
    </>
  )
}

/** Carte de section (bento arrondi) avec titre optionnel. */
function Card({ tk, title, children, pad = 18 }: { tk: MobileTokens; title?: string; children: ReactNode; pad?: number }) {
  return (
    <div style={{ background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 20, boxShadow: tk.shadowSm, overflow: 'hidden' }}>
      {title ? (
        <div style={{ padding: `${pad}px ${pad}px 0` }}>
          <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, color: tk.ink }}>{title}</h2>
        </div>
      ) : null}
      <div style={{ padding: pad }}>{children}</div>
    </div>
  )
}

/** Champ libellé ; anneau d'accent au focus, grisé et non éditable si `disabled`. */
function Field({
  tk, label, value, onChange, type = 'text', disabled, hint, placeholder, inputMode,
}: {
  tk: MobileTokens; label: string; value: string; onChange?: (v: string) => void
  type?: string; disabled?: boolean; hint?: string; placeholder?: string; inputMode?: 'text' | 'numeric' | 'tel' | 'email'
}) {
  const [focus, setFocus] = useState(false)
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: tk.muted, marginBottom: 7 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', height: 46, padding: '0 14px', borderRadius: 13, background: tk.cardSubtle, opacity: disabled ? 0.55 : 1, boxShadow: focus ? `0 0 0 2px ${tk.accent}` : `inset 0 0 0 1px ${tk.hair}`, transition: 'box-shadow .18s ease' }}>
        <input
          type={type}
          inputMode={inputMode}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 600, color: tk.ink }}
        />
      </div>
      {hint ? <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 600, color: tk.muted }}>{hint}</div> : null}
    </label>
  )
}

/** Zone de texte multiligne, même habillage que `Field`. */
function Textarea({ tk, value, onChange, placeholder }: { tk: MobileTokens; value: string; onChange?: (v: string) => void; placeholder?: string }) {
  const [focus, setFocus] = useState(false)
  return (
    <div style={{ padding: '11px 14px', borderRadius: 13, background: tk.cardSubtle, boxShadow: focus ? `0 0 0 2px ${tk.accent}` : `inset 0 0 0 1px ${tk.hair}`, transition: 'box-shadow .18s ease' }}>
      <textarea
        value={value}
        rows={5}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{ width: '100%', border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: tk.ink, resize: 'none', lineHeight: 1.5 }}
      />
    </div>
  )
}

/** Interrupteur on/off (`role="switch"`). */
function Toggle({ tk, on, onChange, disabled }: { tk: MobileTokens; on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      style={{ width: 46, height: 28, borderRadius: 999, border: 0, position: 'relative', cursor: disabled ? 'default' : 'pointer', flexShrink: 0, opacity: disabled ? 0.5 : 1, background: on ? tk.accent : tk.ghost, transition: 'background .2s' }}
    >
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: 999, background: on ? tk.accentInk : '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', transition: 'left .2s cubic-bezier(.2,.8,.2,1)' }} />
    </button>
  )
}

/** Sélecteur segmenté générique (une seule option active). */
function Segment<T extends string>({ tk, options, value, onChange }: { tk: MobileTokens; options: { id: T; label: string; icon?: MEIconName }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 999, background: tk.cardSubtle }}>
      {options.map((o) => {
        const on = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: o.icon ? '0 13px 0 11px' : '0 15px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, letterSpacing: -0.1, whiteSpace: 'nowrap', background: on ? tk.accent : 'transparent', color: on ? tk.accentInk : tk.muted, boxShadow: on ? tk.shadowSm : 'none', transition: 'background .18s, color .18s' }}
          >
            {o.icon ? <MEIcon name={o.icon} size={15} color={on ? tk.accentInk : tk.muted} strokeWidth={2} /> : null}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Anneau de progression SVG (valeur 0–100, bornée). */
function Ring({ tk, value, size }: { tk: MobileTokens; value: number; size: number }) {
  const sw = 4
  const r = (size - sw) / 2
  const c = 2 * Math.PI * r
  const frac = Math.max(0, Math.min(1, value / 100))
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke={tk.hair} strokeWidth={sw} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={tk.accent} strokeWidth={sw} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  )
}

/** Pastille ronde d'initiales sur fond accent. */
function Avatar({ tk, initials, size }: { tk: MobileTokens; initials: string; size: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 999, display: 'grid', placeItems: 'center', background: tk.accent, color: tk.accentInk, fontSize: size * 0.36, fontWeight: 800, flexShrink: 0 }}>
      {initials}
    </span>
  )
}

/** Bouton d'enregistrement pleine largeur (accent). */
function SaveButton({ tk, t, label, onClick, disabled }: { tk: MobileTokens; t: TFunction; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ height: 50, width: '100%', borderRadius: 999, border: 0, cursor: disabled ? 'default' : 'pointer', background: tk.accent, color: tk.accentInk, fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, opacity: disabled ? 0.45 : 1, boxShadow: tk.shadowSm }}
    >
      {label || t('settings:profile.save')}
    </button>
  )
}

/** Bandeau d'info affiché quand le backend est absent (édits désactivés). */
function SignedOutBanner({ tk, t }: { tk: MobileTokens; t: TFunction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '13px 15px', borderRadius: 16, background: tk.riskBg }}>
      <MEIcon name="info" size={15} color={tk.riskFg} strokeWidth={1.9} />
      <div style={{ fontSize: 12.5, fontWeight: 600, color: tk.riskFg, lineHeight: 1.5 }}>{t('dashboard:mobile.settings.signedOut')}</div>
    </div>
  )
}

/** Coque commune des sections détail : en-tête retour + zone scrollable (padding bas pour la tab bar). */
function Section({ tk, t, title, onBack, children }: { tk: MobileTokens; t: TFunction; title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div>
      <Header tk={tk} backLabel={t('settings:title')} onBack={onBack} title={title} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 18px 28px' }}>{children}</div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  HUB
// ════════════════════════════════════════════════════════════════════════════
interface Tile {
  id: View
  icon: MEIconName
  labelKey: string
  status?: string
}

/** Vue « hub » : hero compte (→ Profil) + grille de tuiles + déconnexion. */
function Hub({
  ctx, profile, notifCount, plan, onBack, onGo, onLogout,
}: {
  ctx: SectionCtx; profile: ProfileData; notifCount: number; plan: AgencyPlan | null
  onBack: () => void; onGo: (v: View) => void; onLogout: () => void
}) {
  const { t, tk } = ctx
  const pct = profileCompletionScore(profile)
  const fullName = `${profile.firstName} ${profile.lastName}`.trim() || t('dashboard:mobile.settings.unnamed')
  const initials = profile.initials && profile.initials !== '?' ? profile.initials : (`${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`.toUpperCase() || '?')

  const channelsLabel = `${notifCount} ${t('dashboard:mobile.settings.channelWord', { count: notifCount })}`
  const tiles: Tile[] = [
    { id: 'agency', icon: 'building', labelKey: 'settings:nav.sections.agency.label' },
    { id: 'notifications', icon: 'bell', labelKey: 'settings:nav.sections.notifications.label', status: channelsLabel },
    { id: 'billing', icon: 'credit-card', labelKey: 'settings:nav.sections.billing.label', status: plan ? t(PLAN_KEYS[plan]) : undefined },
    { id: 'preferences', icon: 'globe', labelKey: 'settings:nav.sections.preferences.label' },
  ]

  return (
    <div>
      <Header tk={tk} backLabel={t('common:nav.more')} onBack={onBack} title={t('settings:title')} />
      <div style={{ padding: '16px 18px 28px' }}>
        {/* Hero compte → Profil */}
        <button
          type="button"
          onClick={() => onGo('profile')}
          style={{ width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${tk.cardBorder}`, display: 'flex', alignItems: 'center', gap: 15, padding: '16px 18px', borderRadius: 22, background: tk.card, boxShadow: tk.shadow }}
        >
          <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
            <div style={{ position: 'absolute', inset: 0 }}><Ring tk={tk} value={pct} size={64} /></div>
            <Avatar tk={tk} initials={initials} size={50} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.4, color: tk.ink, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName}</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: tk.muted, marginTop: 3 }}>{t('dashboard:mobile.settings.completion', { pct })}</div>
          </div>
          <MEIcon name="chevron-right" size={20} color={tk.ghost} strokeWidth={2} />
        </button>

        {/* Grille de tuiles */}
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {tiles.map((tl) => (
            <button
              key={tl.id}
              type="button"
              onClick={() => onGo(tl.id)}
              style={{ textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${tk.cardBorder}`, display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 16px 15px', borderRadius: 18, minHeight: 118, background: tk.card, boxShadow: tk.shadowSm }}
            >
              <span style={{ display: 'grid', placeItems: 'center', width: 30, height: 30 }}>
                <MEIcon name={tl.icon} size={24} color={tk.ink} strokeWidth={1.85} />
              </span>
              <div style={{ marginTop: 'auto' }}>
                <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3, color: tk.ink, lineHeight: 1.15 }}>{t(tl.labelKey)}</div>
                {tl.status ? <div style={{ fontSize: 11.5, fontWeight: 700, color: tk.muted, marginTop: 3 }}>{tl.status}</div> : null}
              </div>
            </button>
          ))}
        </div>

        {/* Déconnexion */}
        <button
          type="button"
          onClick={onLogout}
          style={{ width: '100%', marginTop: 16, height: 50, borderRadius: 999, border: `1px solid ${tk.cardBorder}`, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, color: tk.muted, background: tk.card, boxShadow: tk.shadowSm, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}
        >
          <MEIcon name="logout" size={18} color={tk.muted} strokeWidth={1.9} />
          {t('common:nav.logout')}
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  PROFIL
// ════════════════════════════════════════════════════════════════════════════
/** Section Profil : identité, contacts, présentation publique (e-mail en lecture seule). */
function ProfileSection({
  ctx, form, editable, isSaving, signedOut, onChange, onSave, onBack,
}: {
  ctx: SectionCtx; form: ProfileData; editable: boolean; isSaving: boolean; signedOut: boolean
  onChange: (p: Partial<ProfileData>) => void; onSave: () => void; onBack: () => void
}) {
  const { t, tk } = ctx
  const pct = profileCompletionScore(form)
  const initials = form.initials && form.initials !== '?' ? form.initials : (`${form.firstName[0] ?? ''}${form.lastName[0] ?? ''}`.toUpperCase() || '?')
  const fullName = `${form.firstName} ${form.lastName}`.trim() || t('dashboard:mobile.settings.unnamed')
  return (
    <Section tk={tk} t={t} title={t('settings:profile.title')} onBack={onBack}>
      {signedOut ? <SignedOutBanner tk={tk} t={t} /> : null}

      <Card tk={tk} pad={20}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar tk={tk} initials={initials} size={68} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.5, color: tk.ink, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: tk.muted, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[form.title, form.agency].filter(Boolean).join(' · ')}</div>
          </div>
          <Ring tk={tk} value={pct} size={56} />
        </div>
      </Card>

      <Card tk={tk} title={t('settings:profile.identityTitle')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field tk={tk} label={t('settings:profile.firstName')} value={form.firstName} disabled={!editable} onChange={(v) => onChange({ firstName: v })} />
          <Field tk={tk} label={t('settings:profile.lastName')} value={form.lastName} disabled={!editable} onChange={(v) => onChange({ lastName: v })} />
          <Field tk={tk} label={t('settings:profile.function')} value={form.title} disabled={!editable} onChange={(v) => onChange({ title: v })} />
          <Field tk={tk} label={t('settings:profile.rcc')} value={form.rcc} disabled={!editable} onChange={(v) => onChange({ rcc: v })} />
        </div>
      </Card>

      <Card tk={tk} title={t('settings:profile.contactTitle')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field tk={tk} label={t('settings:profile.emailPro')} value={form.email} type="email" disabled hint={t('settings:profile.emailHint')} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field tk={tk} label={t('settings:profile.mobile')} value={form.mobile} type="tel" inputMode="tel" disabled={!editable} onChange={(v) => onChange({ mobile: v })} />
            <Field tk={tk} label={t('settings:profile.landline')} value={form.phone} type="tel" inputMode="tel" disabled={!editable} onChange={(v) => onChange({ phone: v })} />
          </div>
        </div>
      </Card>

      <Card tk={tk} title={t('settings:profile.publicPresentationTitle')}>
        <Textarea tk={tk} value={form.bio} placeholder={t('settings:profile.bioPlaceholder')} onChange={editable ? (v) => onChange({ bio: v }) : undefined} />
      </Card>

      <SaveButton tk={tk} t={t} label={t('settings:profile.save')} onClick={onSave} disabled={!editable || isSaving} />
    </Section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  AGENCE (+ Objectif annuel)
// ════════════════════════════════════════════════════════════════════════════
/** Section Agence : identité légale, contact public + objectif annuel (RPC audité, save séparé). */
function AgencySection({
  ctx, form, yearly, editable, isSaving, isSavingTarget, signedOut,
  onChange, onYearly, onSave, onSaveYearly, onBack,
}: {
  ctx: SectionCtx; form: AgencySettingsData; yearly: string
  editable: boolean; isSaving: boolean; isSavingTarget: boolean; signedOut: boolean
  onChange: (p: Partial<AgencySettingsData>) => void; onYearly: (v: string) => void
  onSave: () => void; onSaveYearly: () => void; onBack: () => void
}) {
  const { t, tk } = ctx
  // Répartition calculée EN DIRECT depuis la valeur saisie (parité desktop),
  // pas depuis les cibles serveur — sinon la preview reste figée pendant la saisie.
  const yearlyNum = Math.max(0, Math.round(Number(yearly.replace(/[^\d]/g, '')) || 0))
  const split = t('settings:agency.targets.split', { monthly: formatCHF(Math.round(yearlyNum / 12)), quarterly: formatCHF(Math.round(yearlyNum / 4)) })
  return (
    <Section tk={tk} t={t} title={t('settings:agency.myAgency')} onBack={onBack}>
      {signedOut ? <SignedOutBanner tk={tk} t={t} /> : null}

      {/* Identité (logo lecture seule + nom) */}
      <Card tk={tk} pad={20}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: tk.cardSubtle, display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {form.logoUrl ? <img src={form.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <MEIcon name="building" size={28} color={tk.ink} strokeWidth={1.7} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.4, color: tk.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.name || t('settings:agency.nameUndefined')}</div>
            {[form.city, form.canton].filter(Boolean).length ? <div style={{ fontSize: 12.5, fontWeight: 600, color: tk.muted, marginTop: 3 }}>{[form.city, form.canton].filter(Boolean).join(' · ')}</div> : null}
          </div>
        </div>
      </Card>

      <Card tk={tk} title={t('settings:agency.legalIdentityTitle')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field tk={tk} label={t('settings:agency.legalName')} value={form.legal} disabled={!editable} onChange={(v) => onChange({ legal: v })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field tk={tk} label={t('settings:agency.businessRegistrationNumber')} value={form.businessRegistrationNumber} disabled={!editable} onChange={(v) => onChange({ businessRegistrationNumber: v })} />
            <Field tk={tk} label={t('settings:agency.foundedYear')} value={form.foundedYear} inputMode="numeric" disabled={!editable} onChange={(v) => onChange({ foundedYear: v })} />
          </div>
          <Field tk={tk} label={t('settings:agency.vat')} value={form.tva} disabled={!editable} onChange={(v) => onChange({ tva: v })} />
        </div>
      </Card>

      <Card tk={tk} title={t('settings:agency.publicContactTitle')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field tk={tk} label={t('settings:agency.phone')} value={form.phone} type="tel" inputMode="tel" disabled={!editable} onChange={(v) => onChange({ phone: v })} />
          <Field tk={tk} label={t('settings:agency.email')} value={form.email} type="email" inputMode="email" disabled={!editable} onChange={(v) => onChange({ email: v })} />
          <Field tk={tk} label={t('settings:agency.website')} value={form.website} disabled={!editable} onChange={(v) => onChange({ website: v })} />
        </div>
      </Card>

      <SaveButton tk={tk} t={t} label={t('settings:agency.save')} onClick={onSave} disabled={!editable || isSaving} />

      {/* Objectif annuel (RPC audité) */}
      <Card tk={tk} title={t('settings:agency.targets.title')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field tk={tk} label={t('settings:agency.targets.yearlyLabel')} value={yearly} inputMode="numeric" disabled={!editable} placeholder="0" onChange={onYearly} />
          <div style={{ fontSize: 11.5, fontWeight: 600, color: tk.muted, lineHeight: 1.5 }}>
            {yearlyNum > 0 ? split : t('settings:agency.targets.empty')}
          </div>
          <SaveButton tk={tk} t={t} label={t('settings:agency.targets.save')} onClick={onSaveYearly} disabled={!editable || isSavingTarget} />
        </div>
      </Card>
    </Section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ════════════════════════════════════════════════════════════════════════════
/** Section Notifications : bascule par canal (email/SMS/WhatsApp/in-app). */
function NotificationsSection({
  ctx, form, count, editable, signedOut, onToggle, onBack,
}: {
  ctx: SectionCtx; form: NotifPreferences; count: number; editable: boolean; signedOut: boolean
  onToggle: (k: keyof NotifPreferences) => void; onBack: () => void
}) {
  const { t, tk } = ctx
  const channels: { id: keyof NotifPreferences; icon: MEIconName }[] = [
    { id: 'email', icon: 'mail' },
    { id: 'sms', icon: 'message' },
    { id: 'whatsapp', icon: 'phone' },
    { id: 'inapp', icon: 'bell' },
  ]
  return (
    <Section tk={tk} t={t} title={t('settings:notifications.title')} onBack={onBack}>
      {signedOut ? <SignedOutBanner tk={tk} t={t} /> : null}

      <Card tk={tk}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, background: tk.accent, display: 'grid', placeItems: 'center' }}>
            <MEIcon name="bell" size={22} color={tk.accentInk} strokeWidth={1.8} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.4, color: tk.ink, lineHeight: 1.1 }}>{t('settings:notifications.title')}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: tk.muted, marginTop: 3 }}>{`${count} ${t('dashboard:mobile.settings.channelWord', { count })}`}</div>
          </div>
        </div>
      </Card>

      <Card tk={tk} pad={0}>
        <div style={{ padding: '6px 2px 2px' }}>
          {channels.map((c, i) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 16px', boxShadow: i === channels.length - 1 ? 'none' : `inset 0 -1px 0 ${tk.hair}` }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: 'grid', placeItems: 'center', background: tk.cardSubtle }}>
                <MEIcon name={c.icon} size={19} color={tk.ink} strokeWidth={1.9} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, letterSpacing: -0.2, color: tk.ink }}>{t(`settings:notifications.channels.${c.id}.label`)}</span>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: tk.muted, marginTop: 2 }}>{t(`settings:notifications.channels.${c.id}.desc`)}</span>
              </span>
              <Toggle tk={tk} on={form[c.id]} disabled={!editable} onChange={() => onToggle(c.id)} />
            </div>
          ))}
        </div>
      </Card>
    </Section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  FACTURATION (plan lecture seule — gestion sur le bureau)
// ════════════════════════════════════════════════════════════════════════════
/** Section Facturation : plan courant en lecture seule (gestion sur le desktop). */
function BillingSection({ ctx, plan, onBack }: { ctx: SectionCtx; plan: AgencyPlan | null; onBack: () => void }) {
  const { t, tk } = ctx
  return (
    <Section tk={tk} t={t} title={t('settings:nav.sections.billing.label')} onBack={onBack}>
      <Card tk={tk} pad={20}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, background: tk.cardSubtle, display: 'grid', placeItems: 'center' }}>
            <MEIcon name="credit-card" size={22} color={tk.ink} strokeWidth={1.8} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: tk.muted, letterSpacing: 0.2 }}>{t('settings:subscription.currentPlan')}</div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.4, color: tk.ink, marginTop: 2 }}>{plan ? t(PLAN_KEYS[plan]) : t('dashboard:mobile.settings.noPlan')}</div>
          </div>
        </div>
      </Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '13px 15px', borderRadius: 16, background: tk.cardSubtle }}>
        <MEIcon name="info" size={15} color={tk.muted} strokeWidth={1.9} />
        <div style={{ fontSize: 12.5, fontWeight: 600, color: tk.muted, lineHeight: 1.5 }}>{t('dashboard:mobile.settings.billingDesktop')}</div>
      </div>
    </Section>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  PRÉFÉRENCES (thème + langue LIVE)
// ════════════════════════════════════════════════════════════════════════════
/** Section Préférences : langue + thème, appliqués en direct (LIVE). */
function PreferencesSection({
  ctx, lang, onLang, onTheme, onBack,
}: {
  ctx: SectionCtx; lang: 'fr' | 'en'; onLang: (v: 'fr' | 'en') => void; onTheme: (v: 'light' | 'dark') => void; onBack: () => void
}) {
  const { t, tk, isDark } = ctx
  const row: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }
  return (
    <Section tk={tk} t={t} title={t('settings:nav.sections.preferences.label')} onBack={onBack}>
      <Card tk={tk} title={t('settings:preferences.region.title')}>
        <div style={row}>
          <span style={{ fontSize: 14, fontWeight: 700, color: tk.ink }}>{t('settings:preferences.region.language')}</span>
          <Segment
            tk={tk}
            value={lang}
            onChange={onLang}
            options={[{ id: 'fr', label: 'FR' }, { id: 'en', label: 'EN' }]}
          />
        </div>
      </Card>

      <Card tk={tk} title={t('settings:preferences.appearance.title')}>
        <div style={row}>
          <span style={{ fontSize: 14, fontWeight: 700, color: tk.ink }}>{t('settings:preferences.appearance.theme')}</span>
          <Segment
            tk={tk}
            value={isDark ? 'dark' : 'light'}
            onChange={onTheme}
            options={[
              { id: 'light', label: t('settings:preferences.appearance.themes.light.label'), icon: 'sun' },
              { id: 'dark', label: t('settings:preferences.appearance.themes.dark.label'), icon: 'moon' },
            ]}
          />
        </div>
      </Card>
    </Section>
  )
}
