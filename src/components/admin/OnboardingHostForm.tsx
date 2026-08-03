/**
 * Formulaire d'ajout ou de modification d'un hôte d'appel d'accueil.
 *
 * Ouvert depuis l'onglet « Hôtes » de `AdminOnboardingCallsPage`. Écrit par la RPC
 * `admin_upsert_onboarding_host`, qui revalide TOUT côté serveur (fuseau réel,
 * format des plages, bornes des durées) : ce formulaire ne fait qu'éviter à l'utilisateur
 * de découvrir le refus après coup.
 *
 * L'hôte est un profil de la plateforme, choisi par son e-mail : `admin_upsert_onboarding_host`
 * attend un `profile_id`, et le registre des utilisateurs est déjà chargé par la console.
 * Demander un uuid à la main serait une invitation à se tromper de personne.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, X } from 'lucide-react'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import { useAdminUsers } from '@/hooks/useAdminUsers'
import { useUpsertOnboardingHost, type AdminOnboardingHost } from '@/hooks/useAdminOnboardingCalls'
import { AdminGhostBtn, AdminIc, AdminSolidBtn } from '@/components/admin/kit/adminKit'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'

interface Slice { dow: number; start: string; end: string }

export interface OnboardingHostFormProps {
  /** Hôte existant à modifier ; absent pour une création. */
  host?: AdminOnboardingHost
  onClose: () => void
}

/** Fuseaux proposés : ceux qui couvrent le marché suisse et ses voisins immédiats. */
const TIMEZONES = ['Europe/Zurich', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/London', 'UTC']

export default function OnboardingHostForm({ host, onClose }: OnboardingHostFormProps) {
  const { t } = useTranslation('admin')
  const { sp, surf } = useAdminSugar()
  const upsert = useUpsertOnboardingHost()
  const { users } = useAdminUsers()

  const [email, setEmail] = useState(host?.profile_email ?? '')
  const [displayName, setDisplayName] = useState(host?.display_name ?? '')
  const [timezone, setTimezone] = useState(host?.timezone ?? 'Europe/Zurich')
  const [slices, setSlices] = useState<Slice[]>(
    host?.weekly_hours?.length
      ? host.weekly_hours
      : [1, 2, 3, 4, 5].map((dow) => ({ dow, start: '09:00', end: '12:00' })),
  )
  const [duration, setDuration] = useState(host?.duration_minutes ?? 30)
  const [slot, setSlot] = useState(host?.slot_minutes ?? 30)
  const [buffer, setBuffer] = useState(host?.buffer_after_minutes ?? 15)
  const [notice, setNotice] = useState(host?.min_notice_hours ?? 4)
  const [horizon, setHorizon] = useState(host?.horizon_days ?? 30)
  const [maxPerDay, setMaxPerDay] = useState<string>(host?.max_per_day?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)

  const dayNames = t('onboardingCalls.hosts.dayNames', { returnObjects: true }) as string[]

  const resolvedProfile = useMemo(() => {
    const needle = email.trim().toLowerCase()
    if (!needle) return null
    return users.find((u) => (u.email ?? '').toLowerCase() === needle) ?? null
  }, [email, users])

  const profileId = host?.profile_id ?? resolvedProfile?.id ?? null

  const submit = () => {
    setError(null)
    if (!profileId) {
      setError(t('onboardingCalls.hosts.form.errors.unknownEmail'))
      return
    }
    if (!displayName.trim()) {
      setError(t('onboardingCalls.hosts.form.errors.nameRequired'))
      return
    }
    // Le serveur refuse aussi ces cas ; le dire ici évite un aller-retour muet.
    const bad = slices.find((s) => !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(s.start)
      || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(s.end)
      || s.start >= s.end)
    if (bad) {
      setError(t('onboardingCalls.hosts.form.errors.badSlice'))
      return
    }

    upsert.mutate(
      {
        profileId,
        displayName: displayName.trim(),
        timezone,
        weeklyHours: slices,
        slotMinutes: slot,
        durationMinutes: duration,
        bufferAfterMinutes: buffer,
        minNoticeHours: notice,
        horizonDays: horizon,
        maxPerDay: maxPerDay.trim() ? Number(maxPerDay) : null,
      },
      {
        onSuccess: onClose,
        onError: (e) => setError(e instanceof Error ? e.message : t('onboardingCalls.hosts.form.errors.generic')),
      },
    )
  }

  const field = (label: string, node: React.ReactNode) => (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: sp.sub, marginBottom: 5 }}>{label}</span>
      {node}
    </label>
  )

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 36, borderRadius: 10, padding: '0 10px',
    background: sp.cardSubBg, color: sp.ink, border: `1px solid ${sp.cardBorder}`,
    fontSize: 13, outline: 'none',
  }

  return (
    <div style={{
      marginTop: 16, padding: 16, borderRadius: ADMIN_RADII.card,
      background: sp.cardSubBg, border: surf.hairline,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: sp.ink }}>
          {t(host ? 'onboardingCalls.hosts.form.editTitle' : 'onboardingCalls.hosts.form.addTitle')}
        </span>
        <AdminGhostBtn onClick={onClose} icon={X} label={t('onboardingCalls.hosts.form.close')}>
          {t('onboardingCalls.hosts.form.close')}
        </AdminGhostBtn>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
        {field(t('onboardingCalls.hosts.form.email'), (
          <input
            type="email"
            value={email}
            disabled={!!host}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prenom@megga.ch"
            style={{ ...inputStyle, opacity: host ? 0.6 : 1 }}
          />
        ))}
        {field(t('onboardingCalls.hosts.form.displayName'), (
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} />
        ))}
        {field(t('onboardingCalls.hosts.form.timezone'), (
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)} style={inputStyle}>
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: sp.sub, marginBottom: 6 }}>
          {t('onboardingCalls.hosts.form.weekly')}
        </span>
        <div style={{ display: 'grid', gap: 6 }}>
          {slices.map((slice, i) => (
            <div key={`${slice.dow}-${i}`} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <select
                value={slice.dow}
                onChange={(e) => setSlices((s) => s.map((x, j) => j === i ? { ...x, dow: Number(e.target.value) } : x))}
                style={{ ...inputStyle, width: 120 }}
              >
                {dayNames.map((name, idx) => <option key={name} value={idx + 1}>{name}</option>)}
              </select>
              <input
                type="time"
                value={slice.start}
                onChange={(e) => setSlices((s) => s.map((x, j) => j === i ? { ...x, start: e.target.value } : x))}
                style={{ ...inputStyle, width: 110 }}
              />
              <input
                type="time"
                value={slice.end}
                onChange={(e) => setSlices((s) => s.map((x, j) => j === i ? { ...x, end: e.target.value } : x))}
                style={{ ...inputStyle, width: 110 }}
              />
              <AdminGhostBtn
                onClick={() => setSlices((s) => s.filter((_, j) => j !== i))}
                icon={Trash2}
                label={t('onboardingCalls.hosts.form.removeSlice')}
                title={t('onboardingCalls.hosts.form.removeSlice')}
              >
                {''}
              </AdminGhostBtn>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <AdminGhostBtn
            onClick={() => setSlices((s) => [...s, { dow: 1, start: '09:00', end: '12:00' }])}
            icon={Plus}
          >
            {t('onboardingCalls.hosts.form.addSlice')}
          </AdminGhostBtn>
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
        {field(t('onboardingCalls.hosts.form.duration'), (
          <input type="number" min={5} max={480} value={duration} onChange={(e) => setDuration(Number(e.target.value))} style={inputStyle} />
        ))}
        {field(t('onboardingCalls.hosts.form.slot'), (
          <input type="number" min={5} max={240} value={slot} onChange={(e) => setSlot(Number(e.target.value))} style={inputStyle} />
        ))}
        {field(t('onboardingCalls.hosts.form.buffer'), (
          <input type="number" min={0} max={240} value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} style={inputStyle} />
        ))}
        {field(t('onboardingCalls.hosts.form.notice'), (
          <input type="number" min={0} max={720} value={notice} onChange={(e) => setNotice(Number(e.target.value))} style={inputStyle} />
        ))}
        {field(t('onboardingCalls.hosts.form.horizon'), (
          <input type="number" min={1} max={365} value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} style={inputStyle} />
        ))}
        {field(t('onboardingCalls.hosts.form.maxPerDay'), (
          <input
            type="number" min={1} value={maxPerDay}
            placeholder={t('onboardingCalls.hosts.form.noLimit')}
            onChange={(e) => setMaxPerDay(e.target.value)}
            style={inputStyle}
          />
        ))}
      </div>

      {error && (
        <p role="alert" style={{ marginTop: 12, fontSize: 12.5, color: '#ef4444' }}>{error}</p>
      )}

      <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
        <AdminSolidBtn onClick={submit} disabled={upsert.isPending}>
          {t('onboardingCalls.hosts.form.save')}
        </AdminSolidBtn>
        {!host && !resolvedProfile && email.trim() && (
          <span style={{ fontSize: 12, color: sp.soft }}>
            <AdminIc icon={X} size={13} color={sp.soft} /> {t('onboardingCalls.hosts.form.errors.unknownEmail')}
          </span>
        )}
      </div>
    </div>
  )
}
