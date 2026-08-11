/**
 * Écran de réglages mobile (P9). Le fichier = le composant public
 * `MobileSettingsScreen` (routeur `view` interne + câblage hooks) suivi des
 * atomes de présentation partagés (Header, Card, Field, Segment, Ring…)
 * puis d'une section par vue (Hub, Profil, Agence, Facturation,
 * Préférences).
 */
import { useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { switchLanguage } from '@/i18n'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useAgentProfileSugar } from '@/hooks/useAgentProfileSugar'
import { useAgencySettings, type AgencySettingsData, type AgencyPlan } from '@/hooks/useAgencySettings'
import { useAgencyTargets } from '@/hooks/useAgencyTargets'
import { profileCompletionScore, type ProfileData } from '@/components/crm-sugar/settings/data'
import { formatCHF } from '@/lib/utils'
import SgToast from '../primitives/SgToast'
import { useSgToast } from '../primitives/useSgToast'
import { MOBILE_FONT, type MobileTokens } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'

type View = 'hub' | 'profile' | 'agency' | 'billing' | 'preferences'

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
  legal: 'MEGGA Genève SA', legalFormId: '', tradeName: 'MEGGA Genève',
  businessRegistrationNumber: 'CHE-409.118.221', tva: 'CHE-409.118.221 TVA',
  foundedYear: '2014', postal: '1204', country: 'Suisse', aboutShort: '',
}
const DEMO_PLAN: AgencyPlan = 'pro'
const DEMO_YEARLY = 1200000

const PLAN_KEYS: Record<AgencyPlan, string> = {
  starter: 'subscription.plans.starter.name',
  pro: 'subscription.plans.pro.name',
  entreprise: 'subscription.plans.entreprise.name',
}

/**
 * Réglages mobile (P9) — hub de tuiles → drill-in (router `view` interne), porté
 * du proto `crm-settings-mobile`. Read-first + édits sûrs : Profil, Agence
 * (+ Objectif annuel), Facturation (plan lecture seule),
 * Préférences (thème + langue LIVE). 100 % câblé sur les hooks de réglages
 * (`useAgentProfileSugar`, `useAgencySettings`,
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
  const targets = useAgencyTargets({ enabled: live })

  // Formulaires : base (hook ou démo) + couche d'édits locale (les édits priment,
  // donc un refetch ne clobbe jamais une saisie en cours). On vide les édits au save.
  const baseProfile = demo ? DEMO_PROFILE : prof.profile
  const [profileEdits, setProfileEdits] = useState<Partial<ProfileData>>({})
  const profileForm: ProfileData = { ...baseProfile, ...profileEdits }

  const baseAgency = demo ? DEMO_AGENCY : ag.agency
  const [agencyEdits, setAgencyEdits] = useState<Partial<AgencySettingsData>>({})
  const agencyForm: AgencySettingsData = { ...baseAgency, ...agencyEdits }


  const baseYearly = demo ? DEMO_YEARLY : targets.targets.yearly
  const [yearlyEdit, setYearlyEdit] = useState<string | null>(null)
  const yearlyForm = yearlyEdit ?? (baseYearly > 0 ? String(baseYearly) : '')

  const plan: AgencyPlan | null = demo ? DEMO_PLAN : ag.plan

  // Éditable = démo (no-op visuel) OU backend présent. Saves désactivés sinon.
  const profileEditable = demo || prof.hasBackend
  const agencyEditable = demo || ag.hasBackend

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

  const ctx: SectionCtx = { t, tk, isDark }

  return (
    <div style={{ fontFamily: MOBILE_FONT, color: tk.ink }}>
      <div key={view} style={{ animation: 'stmRise .4s cubic-bezier(.2,.8,.2,1) both' }}>
        {view === 'hub' && (
          <Hub
            ctx={ctx}
            profile={profileForm}
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
        {view === 'billing' && (
          <BillingSection ctx={ctx} plan={plan} onBack={() => setView('hub')} />
        )}
        {view === 'preferences' && (
          <PreferencesSection
            ctx={ctx}
            lang={i18n.language.startsWith('en') ? 'en' : 'fr'}
            // Charge le bundle PUIS bascule — cf. la JSDoc de switchLanguage.
            onLang={(v) => void switchLanguage(v)}
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
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 38, padding: '0 var(--crm-space-2xl) 0 var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${tk.cardBorder}`, cursor: 'pointer', background: tk.card, boxShadow: tk.shadowSm, fontFamily: 'inherit' }}
        >
          <MEIcon name="chevron-left" size={18} color={tk.ink} strokeWidth={2.2} />
          <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 800, color: tk.ink }}>{backLabel}</span>
        </button>
      </header>
      <div style={{ padding: 'var(--crm-space-xs) var(--crm-space-4xl) 0' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--crm-text-6xl)', fontWeight: 800, letterSpacing: -1, color: tk.ink, lineHeight: 1.05 }}>{title}</h1>
      </div>
    </>
  )
}

/** Carte de section (bento arrondi) avec titre optionnel. */
function Card({ tk, title, children, pad = 18 }: { tk: MobileTokens; title?: string; children: ReactNode; pad?: number }) {
  return (
    <div style={{ background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-4xl)', boxShadow: tk.shadowSm, overflow: 'hidden' }}>
      {title ? (
        <div style={{ padding: `${pad}px ${pad}px 0` }}>
          <h2 style={{ margin: 0, fontSize: 'var(--crm-text-xl)', fontWeight: 800, letterSpacing: -0.2, color: tk.ink }}>{title}</h2>
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
      <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: tk.muted, marginBottom: 7 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', height: 46, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-lg)', background: tk.cardSubtle, opacity: disabled ? 0.55 : 1, boxShadow: focus ? `0 0 0 2px ${tk.accent}` : `inset 0 0 0 1px ${tk.hair}`, transition: 'box-shadow .18s ease' }}>
        <input
          type={type}
          inputMode={inputMode}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: tk.ink }}
        />
      </div>
      {hint ? <div style={{ marginTop: 6, fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted }}>{hint}</div> : null}
    </label>
  )
}

/** Zone de texte multiligne, même habillage que `Field`. */
function Textarea({ tk, value, onChange, placeholder }: { tk: MobileTokens; value: string; onChange?: (v: string) => void; placeholder?: string }) {
  const [focus, setFocus] = useState(false)
  return (
    <div style={{ padding: 'var(--crm-space-lg) var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-lg)', background: tk.cardSubtle, boxShadow: focus ? `0 0 0 2px ${tk.accent}` : `inset 0 0 0 1px ${tk.hair}`, transition: 'box-shadow .18s ease' }}>
      <textarea
        value={value}
        rows={5}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{ width: '100%', border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: tk.ink, resize: 'none', lineHeight: 1.5 }}
      />
    </div>
  )
}

/** Sélecteur segmenté générique (une seule option active). */
function Segment<T extends string>({ tk, options, value, onChange }: { tk: MobileTokens; options: { id: T; label: string; icon?: MEIconName }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'inline-flex', gap: 'var(--crm-space-xs)', padding: 'var(--crm-space-xs)', borderRadius: 'var(--crm-radius-pill)', background: tk.cardSubtle }}>
      {options.map((o) => {
        const on = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 34, padding: o.icon ? '0 13px 0 11px' : '0 15px', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 800, letterSpacing: -0.1, whiteSpace: 'nowrap', background: on ? tk.accent : 'transparent', color: on ? tk.accentInk : tk.muted, boxShadow: on ? tk.shadowSm : 'none', transition: 'background .18s, color .18s' }}
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
    <span style={{ width: size, height: size, borderRadius: 'var(--crm-radius-pill)', display: 'grid', placeItems: 'center', background: tk.accent, color: tk.accentInk, fontSize: size * 0.36, fontWeight: 800, flexShrink: 0 }}>
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
      style={{ height: 50, width: '100%', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: disabled ? 'default' : 'pointer', background: tk.accent, color: tk.accentInk, fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 800, letterSpacing: -0.2, opacity: disabled ? 0.45 : 1, boxShadow: tk.shadowSm }}
    >
      {label || t('settings:profile.save')}
    </button>
  )
}

/** Bandeau d'info affiché quand le backend est absent (édits désactivés). */
function SignedOutBanner({ tk, t }: { tk: MobileTokens; t: TFunction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-xl) var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-2xl)', background: tk.riskBg }}>
      <MEIcon name="info" size={15} color={tk.riskFg} strokeWidth={1.9} />
      <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.riskFg, lineHeight: 1.5 }}>{t('dashboard:mobile.settings.signedOut')}</div>
    </div>
  )
}

/** Coque commune des sections détail : en-tête retour + zone scrollable (padding bas pour la tab bar). */
function Section({ tk, t, title, onBack, children }: { tk: MobileTokens; t: TFunction; title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div>
      <Header tk={tk} backLabel={t('settings:title')} onBack={onBack} title={title} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)', padding: '18px 18px 28px' }}>{children}</div>
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
  ctx, profile, plan, onBack, onGo, onLogout,
}: {
  ctx: SectionCtx; profile: ProfileData; plan: AgencyPlan | null
  onBack: () => void; onGo: (v: View) => void; onLogout: () => void
}) {
  const { t, tk } = ctx
  const pct = profileCompletionScore(profile)
  const fullName = `${profile.firstName} ${profile.lastName}`.trim() || t('dashboard:mobile.settings.unnamed')
  const initials = profile.initials && profile.initials !== '?' ? profile.initials : (`${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`.toUpperCase() || '?')

  const tiles: Tile[] = [
    { id: 'agency', icon: 'building', labelKey: 'settings:nav.sections.agency.label' },
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
          style={{ width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${tk.cardBorder}`, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)', padding: 'var(--crm-space-3xl) var(--crm-space-4xl)', borderRadius: 'var(--crm-radius-5xl)', background: tk.card, boxShadow: tk.shadow }}
        >
          <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
            <div style={{ position: 'absolute', inset: 0 }}><Ring tk={tk} value={pct} size={64} /></div>
            <Avatar tk={tk} initials={initials} size={50} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 800, letterSpacing: -0.4, color: tk.ink, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName}</div>
            <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 700, color: tk.muted, marginTop: 3 }}>{t('dashboard:mobile.settings.completion', { pct })}</div>
          </div>
          <MEIcon name="chevron-right" size={20} color={tk.ghost} strokeWidth={2} />
        </button>

        {/* Grille de tuiles */}
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-xl)' }}>
          {tiles.map((tl) => (
            <button
              key={tl.id}
              type="button"
              onClick={() => onGo(tl.id)}
              style={{ textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${tk.cardBorder}`, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)', padding: 'var(--crm-space-3xl) var(--crm-space-3xl) var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-3xl)', minHeight: 118, background: tk.card, boxShadow: tk.shadowSm }}
            >
              <span style={{ display: 'grid', placeItems: 'center', width: 30, height: 30 }}>
                <MEIcon name={tl.icon} size={24} color={tk.ink} strokeWidth={1.85} />
              </span>
              <div style={{ marginTop: 'auto' }}>
                <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 800, letterSpacing: -0.3, color: tk.ink, lineHeight: 1.15 }}>{t(tl.labelKey)}</div>
                {tl.status ? <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 700, color: tk.muted, marginTop: 3 }}>{tl.status}</div> : null}
              </div>
            </button>
          ))}
        </div>

        {/* Déconnexion */}
        <button
          type="button"
          onClick={onLogout}
          style={{ width: '100%', marginTop: 16, height: 50, borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${tk.cardBorder}`, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 800, letterSpacing: -0.2, color: tk.muted, background: tk.card, boxShadow: tk.shadowSm, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-md)' }}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3xl)' }}>
          <Avatar tk={tk} initials={initials} size={68} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 800, letterSpacing: -0.5, color: tk.ink, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName}</div>
            <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.muted, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[form.title, form.agency].filter(Boolean).join(' · ')}</div>
          </div>
          <Ring tk={tk} value={pct} size={56} />
        </div>
      </Card>

      <Card tk={tk} title={t('settings:profile.identityTitle')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-xl)' }}>
          <Field tk={tk} label={t('settings:profile.firstName')} value={form.firstName} disabled={!editable} onChange={(v) => onChange({ firstName: v })} />
          <Field tk={tk} label={t('settings:profile.lastName')} value={form.lastName} disabled={!editable} onChange={(v) => onChange({ lastName: v })} />
          <Field tk={tk} label={t('settings:profile.function')} value={form.title} disabled={!editable} onChange={(v) => onChange({ title: v })} />
          <Field tk={tk} label={t('settings:profile.rcc')} value={form.rcc} disabled={!editable} onChange={(v) => onChange({ rcc: v })} />
        </div>
      </Card>

      <Card tk={tk} title={t('settings:profile.contactTitle')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)' }}>
          <Field tk={tk} label={t('settings:profile.emailPro')} value={form.email} type="email" disabled hint={t('settings:profile.emailHint')} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-xl)' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3xl)' }}>
          <div style={{ width: 64, height: 64, borderRadius: 'var(--crm-radius-3xl)', background: tk.cardSubtle, display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {form.logoUrl ? <img src={form.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <MEIcon name="building" size={28} color={tk.ink} strokeWidth={1.7} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 800, letterSpacing: -0.4, color: tk.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.name || t('settings:agency.nameUndefined')}</div>
            {[form.city, form.canton].filter(Boolean).length ? <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.muted, marginTop: 3 }}>{[form.city, form.canton].filter(Boolean).join(' · ')}</div> : null}
          </div>
        </div>
      </Card>

      <Card tk={tk} title={t('settings:agency.legalIdentityTitle')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)' }}>
          <Field tk={tk} label={t('settings:agency.legalName')} value={form.legal} disabled={!editable} onChange={(v) => onChange({ legal: v })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-xl)' }}>
            <Field tk={tk} label={t('settings:agency.businessRegistrationNumber')} value={form.businessRegistrationNumber} disabled={!editable} onChange={(v) => onChange({ businessRegistrationNumber: v })} />
            <Field tk={tk} label={t('settings:agency.foundedYear')} value={form.foundedYear} inputMode="numeric" disabled={!editable} onChange={(v) => onChange({ foundedYear: v })} />
          </div>
          <Field tk={tk} label={t('settings:agency.vat')} value={form.tva} disabled={!editable} onChange={(v) => onChange({ tva: v })} />
        </div>
      </Card>

      <Card tk={tk} title={t('settings:agency.publicContactTitle')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)' }}>
          <Field tk={tk} label={t('settings:agency.phone')} value={form.phone} type="tel" inputMode="tel" disabled={!editable} onChange={(v) => onChange({ phone: v })} />
          <Field tk={tk} label={t('settings:agency.email')} value={form.email} type="email" inputMode="email" disabled={!editable} onChange={(v) => onChange({ email: v })} />
          <Field tk={tk} label={t('settings:agency.website')} value={form.website} disabled={!editable} onChange={(v) => onChange({ website: v })} />
        </div>
      </Card>

      <SaveButton tk={tk} t={t} label={t('settings:agency.save')} onClick={onSave} disabled={!editable || isSaving} />

      {/* Objectif annuel (RPC audité) */}
      <Card tk={tk} title={t('settings:agency.targets.title')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)' }}>
          <Field tk={tk} label={t('settings:agency.targets.yearlyLabel')} value={yearly} inputMode="numeric" disabled={!editable} placeholder="0" onChange={onYearly} />
          <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted, lineHeight: 1.5 }}>
            {yearlyNum > 0 ? split : t('settings:agency.targets.empty')}
          </div>
          <SaveButton tk={tk} t={t} label={t('settings:agency.targets.save')} onClick={onSaveYearly} disabled={!editable || isSavingTarget} />
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)' }}>
          <span style={{ width: 46, height: 46, borderRadius: 'var(--crm-radius-xl)', flexShrink: 0, background: tk.cardSubtle, display: 'grid', placeItems: 'center' }}>
            <MEIcon name="credit-card" size={22} color={tk.ink} strokeWidth={1.8} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 700, color: tk.muted, letterSpacing: 0.2 }}>{t('settings:subscription.currentPlan')}</div>
            <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 800, letterSpacing: -0.4, color: tk.ink, marginTop: 2 }}>{plan ? t(PLAN_KEYS[plan]) : t('dashboard:mobile.settings.noPlan')}</div>
          </div>
        </div>
      </Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-xl) var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-2xl)', background: tk.cardSubtle }}>
        <MEIcon name="info" size={15} color={tk.muted} strokeWidth={1.9} />
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.muted, lineHeight: 1.5 }}>{t('dashboard:mobile.settings.billingDesktop')}</div>
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
  const row: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-xl)' }
  return (
    <Section tk={tk} t={t} title={t('settings:nav.sections.preferences.label')} onBack={onBack}>
      <Card tk={tk} title={t('settings:preferences.region.title')}>
        <div style={row}>
          <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 700, color: tk.ink }}>{t('settings:preferences.region.language')}</span>
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
          <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 700, color: tk.ink }}>{t('settings:preferences.appearance.theme')}</span>
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
