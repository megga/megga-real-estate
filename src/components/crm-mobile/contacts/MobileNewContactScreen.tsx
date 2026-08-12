import { useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { useCreateContact } from '@/hooks/useContacts'
import { MOBILE_FONT } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'
import { NEW_TYPES, type NewContactType } from './shared'

// Valeurs alignées sur la contrainte DB `contacts_source_check`
// (onboarding/manual/import/website/referral/whatsapp/whatsapp_ai). On n'expose
// que celles pertinentes à la saisie agent — 'call'/'walk-in' n'existent pas en
// base et déclenchaient un échec d'insert silencieux (CHECK 23514).
const SOURCES = ['manual', 'website', 'referral'] as const

/**
 * Création d'un contact (mobile, /dashboard/contacts/new) — flux d'ÉCRITURE réel
 * via `useCreateContact` (insert `contacts` ; agency_id/user injectés par le hook).
 * v1 : identité (prénom/nom requis) + type + coordonnées + source. Différés
 * (plan §D) : critères de recherche acheteur, photo, date de naissance, langue,
 * détection de doublon. `demo` n'écrit jamais.
 */
export function MobileNewContactScreen({ demo = false }: { demo?: boolean }) {
  const navigate = useNavigate()
  const { t } = useTranslation('contacts')
  const { tk } = useMobileTokens()
  const createContact = useCreateContact()

  const [firstName, setFirst] = useState('')
  const [lastName, setLast] = useState('')
  const [type, setType] = useState<NewContactType>('buyer')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [source, setSource] = useState<(typeof SOURCES)[number]>('manual')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ id: string | null } | null>(null)

  const valid = firstName.trim().length > 0 && lastName.trim().length > 0
  const initials = `${(firstName || ' ')[0]}${(lastName || ' ')[0]}`.toUpperCase().trim() || '—'

  const close = () => navigate('/dashboard/contacts')

  async function submit() {
    if (!valid || createContact.isPending) return
    setError(null)
    if (demo) { setDone({ id: null }); return }
    try {
      const c = await createContact.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        type,
        source,
      })
      setDone({ id: (c as { id?: string }).id ?? null })
    } catch {
      setError(t('mobile.new.error'))
    }
  }

  if (done) {
    return (
      <div style={{ fontFamily: MOBILE_FONT, color: tk.ink, minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 28px' }}>
        <div style={{ width: 64, height: 64, borderRadius: 'var(--crm-radius-pill)', background: tk.accent, display: 'grid', placeItems: 'center' }}>
          <MEIcon name="check" size={30} color={tk.accentInk} strokeWidth={2.4} />
        </div>
        <h1 style={{ margin: '20px 0 0', fontSize: 'var(--crm-text-4xl)', fontWeight: 500, letterSpacing: -0.5, color: tk.ink }}>{t('mobile.new.doneTitle')}</h1>
        <p style={{ margin: '8px 0 0', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.muted, maxWidth: 250, lineHeight: 1.5 }}>{t('mobile.new.doneDesc', { name: `${firstName.trim()} ${lastName.trim()}` })}</p>
        <button type="button" onClick={() => (done.id ? navigate(`/dashboard/contacts/${done.id}`) : close())} style={{ marginTop: 24, height: 48, padding: '0 26px', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, background: tk.accent, color: tk.accentInk }}>
          {done.id ? t('mobile.new.openContact') : t('mobile.title')}
        </button>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: MOBILE_FONT, color: tk.ink, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: 'calc(env(safe-area-inset-top) + 12px) 16px 12px' }}>
        <button type="button" onClick={close} aria-label={t('common:actions.cancel')} style={{ width: 40, height: 40, borderRadius: 'var(--crm-radius-pill)', border: 0, background: tk.card, boxShadow: tk.shadowSm, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          <MEIcon name="close" size={20} color={tk.ink} />
        </button>
        <div style={{ flex: 1 }} />
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: 'var(--crm-space-md) var(--crm-space-4xl) var(--crm-space-7xl)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3xl)' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--crm-text-5xl)', fontWeight: 500, letterSpacing: -0.8, color: tk.ink }}>{t('mobile.new.title')}</h1>

        {/* avatar aperçu */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span style={{ width: 76, height: 76, borderRadius: 'var(--crm-radius-pill)', background: valid ? '#0041D9' : tk.ghost, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-6xl)', fontWeight: 500, letterSpacing: -0.4 }}>{initials}</span>
        </div>

        {/* identité */}
        <SectionLabel tk={tk}>{t('mobile.new.identity')}</SectionLabel>
        <div style={{ display: 'flex', gap: 'var(--crm-space-lg)' }}>
          <input value={firstName} onChange={(e) => setFirst(e.target.value)} placeholder={t('mobile.new.firstName')} aria-label={t('mobile.new.firstName')} style={{ ...field(tk), flex: 1 }} />
          <input value={lastName} onChange={(e) => setLast(e.target.value)} placeholder={t('mobile.new.lastName')} aria-label={t('mobile.new.lastName')} style={{ ...field(tk), flex: 1 }} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--crm-space-sm)', padding: 'var(--crm-space-xs)', borderRadius: 'var(--crm-radius-lg)', background: tk.cardSubtle }}>
          {NEW_TYPES.map((ty) => {
            const on = ty === type
            return (
              <button key={ty} type="button" onClick={() => setType(ty)} style={{ flex: 1, height: 38, borderRadius: 'var(--crm-radius-sm)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, background: on ? tk.accent : 'transparent', color: on ? tk.accentInk : tk.muted }}>
                {t(`mobile.type.${ty}`)}
              </button>
            )
          })}
        </div>

        {/* coordonnées */}
        <SectionLabel tk={tk}>{t('mobile.new.contact')}</SectionLabel>
        <Field tk={tk} icon="phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('mobile.new.phonePlaceholder')} inputMode="tel" aria-label={t('mobile.new.phone')} style={inputBare(tk)} /></Field>
        <Field tk={tk} icon="mail"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('mobile.new.emailPlaceholder')} inputMode="email" aria-label={t('mobile.new.email')} style={inputBare(tk)} /></Field>

        {/* origine */}
        <SectionLabel tk={tk}>{t('mobile.new.origin')}</SectionLabel>
        <select value={source} onChange={(e) => setSource(e.target.value as (typeof SOURCES)[number])} aria-label={t('mobile.new.source')} style={{ ...field(tk), appearance: 'none' }}>
          {SOURCES.map((s) => <option key={s} value={s}>{t(`mobile.new.sources.${s}`)}</option>)}
        </select>

        {error ? <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.danger }}>{error}</div> : null}
      </main>

      <footer style={{ flexShrink: 0, display: 'flex', gap: 'var(--crm-space-lg)', padding: '11px 16px calc(18px + env(safe-area-inset-bottom))', background: tk.canvas }}>
        <button type="button" onClick={close} style={{ height: 50, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, background: tk.cardSubtle, color: tk.inkSoft }}>{t('common:actions.cancel')}</button>
        <button type="button" disabled={!valid || createContact.isPending} onClick={() => void submit()} style={{ flex: 1, height: 50, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: valid ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, background: valid ? tk.accent : tk.cardSubtle, color: valid ? tk.accentInk : tk.muted }}>
          {createContact.isPending ? t('mobile.new.creating') : t('mobile.new.create')}
        </button>
      </footer>
    </div>
  )
}

type Tk = ReturnType<typeof useMobileTokens>['tk']
/** Style d'un champ plein (input/select) : hauteur 46, fond subtil, sans bordure. */
function field(tk: Tk): CSSProperties {
  return { height: 46, padding: '0 var(--crm-space-xl)', borderRadius: 'var(--crm-radius-lg)', border: 0, outline: 'none', background: tk.cardSubtle, fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, letterSpacing: -0.2, color: tk.ink }
}
/** Style d'un input nu (transparent, sans bordure) posé dans un `Field`. */
function inputBare(tk: Tk): CSSProperties {
  return { flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, letterSpacing: -0.2, color: tk.ink }
}
/** Rangée de champ avec icône de tête (téléphone, e-mail) enveloppant un `inputBare`. */
function Field({ tk, icon, children }: { tk: Tk; icon: MEIconName; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', height: 46, padding: '0 var(--crm-space-xl)', borderRadius: 'var(--crm-radius-lg)', background: tk.cardSubtle }}>
      <MEIcon name={icon} size={16} color={tk.muted} strokeWidth={1.8} />
      {children}
    </div>
  )
}
/** Intertitre de section en petites capitales (identité, coordonnées, origine). */
function SectionLabel({ tk, children }: { tk: Tk; children: string }) {
  return <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: tk.muted, margin: '4px 2px -6px' }}>{children}</div>
}
