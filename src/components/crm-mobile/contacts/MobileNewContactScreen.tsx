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
        <div style={{ width: 64, height: 64, borderRadius: 999, background: tk.accent, display: 'grid', placeItems: 'center' }}>
          <MEIcon name="check" size={30} color={tk.accentInk} strokeWidth={2.4} />
        </div>
        <h1 style={{ margin: '20px 0 0', fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: tk.ink }}>{t('mobile.new.doneTitle')}</h1>
        <p style={{ margin: '8px 0 0', fontSize: 13.5, fontWeight: 600, color: tk.muted, maxWidth: 250, lineHeight: 1.5 }}>{t('mobile.new.doneDesc', { name: `${firstName.trim()} ${lastName.trim()}` })}</p>
        <button type="button" onClick={() => (done.id ? navigate(`/dashboard/contacts/${done.id}`) : close())} style={{ marginTop: 24, height: 48, padding: '0 26px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800, background: tk.accent, color: tk.accentInk }}>
          {done.id ? t('mobile.new.openContact') : t('mobile.title')}
        </button>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: MOBILE_FONT, color: tk.ink, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: 'calc(env(safe-area-inset-top) + 12px) 16px 12px' }}>
        <button type="button" onClick={close} aria-label={t('common:actions.cancel')} style={{ width: 40, height: 40, borderRadius: 999, border: 0, background: tk.card, boxShadow: tk.shadowSm, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          <MEIcon name="close" size={20} color={tk.ink} />
        </button>
        <div style={{ flex: 1 }} />
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: '8px 18px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.8, color: tk.ink }}>{t('mobile.new.title')}</h1>

        {/* avatar aperçu */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span style={{ width: 76, height: 76, borderRadius: 999, background: valid ? '#0041D9' : tk.ghost, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 700, letterSpacing: -0.4 }}>{initials}</span>
        </div>

        {/* identité */}
        <SectionLabel tk={tk}>{t('mobile.new.identity')}</SectionLabel>
        <div style={{ display: 'flex', gap: 10 }}>
          <input value={firstName} onChange={(e) => setFirst(e.target.value)} placeholder={t('mobile.new.firstName')} aria-label={t('mobile.new.firstName')} style={{ ...field(tk), flex: 1 }} />
          <input value={lastName} onChange={(e) => setLast(e.target.value)} placeholder={t('mobile.new.lastName')} aria-label={t('mobile.new.lastName')} style={{ ...field(tk), flex: 1 }} />
        </div>
        <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 12, background: tk.cardSubtle }}>
          {NEW_TYPES.map((ty) => {
            const on = ty === type
            return (
              <button key={ty} type="button" onClick={() => setType(ty)} style={{ flex: 1, height: 38, borderRadius: 9, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: on ? 800 : 700, background: on ? tk.accent : 'transparent', color: on ? tk.accentInk : tk.muted }}>
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

        {error ? <div style={{ fontSize: 13, fontWeight: 700, color: tk.danger }}>{error}</div> : null}
      </main>

      <footer style={{ flexShrink: 0, display: 'flex', gap: 10, padding: '11px 16px calc(18px + env(safe-area-inset-bottom))', background: tk.canvas }}>
        <button type="button" onClick={close} style={{ height: 50, padding: '0 22px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 700, background: tk.cardSubtle, color: tk.inkSoft }}>{t('common:actions.cancel')}</button>
        <button type="button" disabled={!valid || createContact.isPending} onClick={() => void submit()} style={{ flex: 1, height: 50, borderRadius: 999, border: 0, cursor: valid ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800, background: valid ? tk.accent : tk.cardSubtle, color: valid ? tk.accentInk : tk.muted }}>
          {createContact.isPending ? t('mobile.new.creating') : t('mobile.new.create')}
        </button>
      </footer>
    </div>
  )
}

type Tk = ReturnType<typeof useMobileTokens>['tk']
/** Style d'un champ plein (input/select) : hauteur 46, fond subtil, sans bordure. */
function field(tk: Tk): CSSProperties {
  return { height: 46, padding: '0 13px', borderRadius: 12, border: 0, outline: 'none', background: tk.cardSubtle, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, letterSpacing: -0.2, color: tk.ink }
}
/** Style d'un input nu (transparent, sans bordure) posé dans un `Field`. */
function inputBare(tk: Tk): CSSProperties {
  return { flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, letterSpacing: -0.2, color: tk.ink }
}
/** Rangée de champ avec icône de tête (téléphone, e-mail) enveloppant un `inputBare`. */
function Field({ tk, icon, children }: { tk: Tk; icon: MEIconName; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 46, padding: '0 13px', borderRadius: 12, background: tk.cardSubtle }}>
      <MEIcon name={icon} size={16} color={tk.muted} strokeWidth={1.8} />
      {children}
    </div>
  )
}
/** Intertitre de section en petites capitales (identité, coordonnées, origine). */
function SectionLabel({ tk, children }: { tk: Tk; children: string }) {
  return <div style={{ fontSize: 9.5, fontWeight: 800, color: tk.muted, letterSpacing: 0.6, textTransform: 'uppercase', margin: '4px 2px -6px' }}>{children}</div>
}
