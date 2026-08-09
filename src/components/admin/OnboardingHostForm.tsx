/**
 * Formulaire d'ajout ou de modification d'un hôte d'appel d'accueil.
 *
 * Ouvert depuis l'onglet « Hôtes » de `AdminOnboardingCallsPage`. Écrit par la RPC
 * `admin_upsert_onboarding_host`, qui revalide TOUT côté serveur (fuseau réel,
 * format des plages, bornes des durées) : ce formulaire ne fait qu'éviter à l'utilisateur
 * de découvrir le refus après coup.
 *
 * DEUX VOIES POUR L'AGENDA, et le choix est structurant :
 *   - « Agenda MEGGA » : une boîte Google Workspace du domaine, que le backend incarne
 *     par délégation. Rien à connecter, rien à renouveler, et l'agenda survit au départ
 *     de la personne qui l'a posé. C'est la voie par défaut.
 *   - « Agenda d'un membre » : le compte CRM d'un membre qui a connecté son propre
 *     agenda depuis l'écran agent. Conservée pour un hôte qui préfère son agenda
 *     personnel, mais la disponibilité de toute la plateforme dépend alors de son jeton.
 *
 * Le bouton « Tester » n'est pas décoratif : trois des quatre pièces du montage Workspace
 * vivent chez Google — la délégation, sa portée, l'activation de l'API — et aucune
 * lecture locale ne peut les voir. Sans aller-retour réel, la première manifestation
 * d'une pièce manquante serait « aucun créneau » chez une agence.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Plus, Trash2, X, XCircle } from 'lucide-react'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import { useAdminUsers } from '@/hooks/useAdminUsers'
import {
  useProbeWorkspaceCalendar,
  useUpsertOnboardingHost,
  useWorkspaceCalendarStatus,
  type AdminOnboardingHost,
} from '@/hooks/useAdminOnboardingCalls'
import { AdminGhostBtn, AdminIc, AdminSegmentBtn, AdminSolidBtn } from '@/components/admin/kit/adminKit'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'

interface Slice { dow: number; start: string; end: string }

/** Quelle identité d'agenda l'écran est en train de renseigner. */
type CalendarMode = 'workspace' | 'profile'

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
  const { data: workspace } = useWorkspaceCalendarStatus()
  const probe = useProbeWorkspaceCalendar()

  // Un hôte existant garde sa voie : en changer déplacerait ses rendez-vous à venir
  // d'un agenda à l'autre, et les événements déjà posés resteraient dans l'ancien.
  const [mode, setMode] = useState<CalendarMode>(
    host ? (host.calendar_email ? 'workspace' : 'profile') : 'workspace',
  )
  const [mailbox, setMailbox] = useState(host?.calendar_email ?? '')
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
    if (mode === 'workspace') {
      // Forme minimale seulement. La vérification qui compte est le bouton « Tester » :
      // une adresse bien formée mais absente du domaine ne se distingue pas d'ici.
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mailbox.trim())) {
        setError(t('onboardingCalls.hosts.form.errors.badMailbox'))
        return
      }
    } else if (!profileId) {
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
        hostId: host?.id,
        profileId: mode === 'profile' ? profileId : null,
        calendarEmail: mode === 'workspace' ? mailbox.trim().toLowerCase() : null,
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

      <div style={{ marginBottom: 14 }}>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: sp.sub, marginBottom: 6 }}>
          {t('onboardingCalls.hosts.form.calendarSource')}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <AdminSegmentBtn on={mode === 'workspace'} onClick={() => setMode('workspace')} disabled={!!host}>
            {t('onboardingCalls.hosts.form.modeWorkspace')}
          </AdminSegmentBtn>
          <AdminSegmentBtn on={mode === 'profile'} onClick={() => setMode('profile')} disabled={!!host}>
            {t('onboardingCalls.hosts.form.modeProfile')}
          </AdminSegmentBtn>
        </div>
        <p style={{ margin: '7px 0 0', fontSize: 12, color: sp.soft, lineHeight: 1.5 }}>
          {t(mode === 'workspace'
            ? 'onboardingCalls.hosts.form.modeWorkspaceHint'
            : 'onboardingCalls.hosts.form.modeProfileHint')}
        </p>
      </div>

      {mode === 'workspace' && workspace && !workspace.configured && (
        <p role="alert" style={{ marginBottom: 12, fontSize: 12.5, color: '#f59e0b', lineHeight: 1.5 }}>
          {t('onboardingCalls.hosts.form.workspaceMissingSecret')}
        </p>
      )}

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
        {mode === 'workspace'
          ? field(t('onboardingCalls.hosts.form.mailbox'), (
              <input
                type="email"
                value={mailbox}
                disabled={!!host}
                onChange={(e) => { setMailbox(e.target.value); probe.reset() }}
                placeholder="rendez-vous@megga.ch"
                style={{ ...inputStyle, opacity: host ? 0.6 : 1 }}
              />
            ))
          : field(t('onboardingCalls.hosts.form.email'), (
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

      {mode === 'workspace' && (
        <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <AdminGhostBtn
            onClick={() => probe.mutate(mailbox.trim())}
            disabled={!mailbox.trim() || probe.isPending}
          >
            {t(probe.isPending ? 'onboardingCalls.hosts.form.probing' : 'onboardingCalls.hosts.form.probe')}
          </AdminGhostBtn>

          {probe.data?.ok && (
            <span style={{ fontSize: 12.5, color: '#22c55e', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <AdminIc icon={CheckCircle2} size={13} color="#22c55e" />
              {t('onboardingCalls.hosts.form.probeOk', {
                tz: probe.data.calendar_timezone ?? timezone,
              })}
            </span>
          )}

          {probe.data && !probe.data.ok && (
            <span style={{ fontSize: 12.5, color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <AdminIc icon={XCircle} size={13} color="#ef4444" />
              {/* Chaque motif désigne UNE case à corriger, et laquelle. Recracher le
                  texte de Google — « unauthorized_client » — laisserait chercher. */}
              {t(`onboardingCalls.hosts.form.probeErrors.${probe.data.reason ?? 'google_error'}`, {
                defaultValue: t('onboardingCalls.hosts.form.probeErrors.google_error'),
              })}
            </span>
          )}
        </div>
      )}

      {/* L'adresse à autoriser dans la console Workspace. Affichée ici, au moment où on
          en a besoin, plutôt qu'à retrouver dans Google Cloud. */}
      {mode === 'workspace' && workspace?.client_email && (
        <p style={{ marginTop: 8, fontSize: 11.5, color: sp.soft, lineHeight: 1.6, wordBreak: 'break-all' }}>
          {t('onboardingCalls.hosts.form.delegationHint', {
            client: workspace.client_email,
            scope: workspace.scope ?? '',
          })}
        </p>
      )}

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
        {/* `mode === 'profile'` : sans cette garde, un e-mail saisi puis abandonné en
            basculant vers l'agenda MEGGA laissait « aucun compte ne porte cet e-mail »
            à côté du bouton — un reproche sur un champ que l'écran n'affiche plus. */}
        {mode === 'profile' && !host && !resolvedProfile && email.trim() && (
          <span style={{ fontSize: 12, color: sp.soft }}>
            <AdminIc icon={X} size={13} color={sp.soft} /> {t('onboardingCalls.hosts.form.errors.unknownEmail')}
          </span>
        )}
      </div>
    </div>
  )
}
