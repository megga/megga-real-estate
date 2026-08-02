// MEGGA CRM — Section « Disponibilités » façon Focus (grammaire profil/agence).
// Rendue dans le bento droit des Réglages quand active === 'availability'.
//
// C'est LE seul endroit qui ouvre l'auto-réservation client : `is_open` vaut
// false par défaut en base, et tant qu'il n'est pas basculé ici, la page
// publique répond « votre conseiller n'a pas ouvert la réservation en ligne ».
//
// ENREGISTREMENT EXPLICITE, pas à la volée. La grille hebdomadaire est validée
// par un trigger (plages ordonnées, disjointes, fin > début) : une écriture par
// frappe produirait des refus permanents pendant la saisie. L'agent compose, puis
// enregistre, et le message du trigger s'affiche tel quel s'il refuse — c'est le
// seul retour qu'il aura sur une grille incohérente.

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/ui/Toast'
import {
  useAgentBookingSettings,
  type AgentBookingSettings,
  type WeeklyHours,
} from '@/hooks/useAgentBookingSettings'
import { PfIc, PfChip, PfSwitch, type FocusSectionProps, type PfColors } from './pfKit'
import { pfColors, PF_KEYFRAMES } from './pfKitCore'

const ISO_DAYS = ['1', '2', '3', '4', '5', '6', '7'] as const

const SLOT_CHOICES = [15, 30, 45, 60] as const
const BUFFER_CHOICES = [0, 10, 15, 30] as const
const NOTICE_CHOICES = [2, 12, 24, 48] as const
const HORIZON_CHOICES = [7, 14, 30, 60] as const

/** Grille par défaut proposée quand l'agent ouvre un jour vide. */
const DEFAULT_RANGE: [string, string] = ['09:00', '12:00']

/**
 * Message lisible d'une erreur d'écriture Supabase.
 *
 * ⚠ `e instanceof Error` NE SUFFIT PAS : PostgrestError est un objet nu
 * ({ message, details, hint, code }), pas une instance d'Error. Le tester ainsi
 * jetait silencieusement le message du trigger — « weekly_hours[1] : fin
 * (08:00:00) <= debut (09:00:00) », qui désigne le jour à corriger — pour le
 * remplacer par un « Enregistrement impossible » qui n'aide personne. Constaté
 * en enregistrant une grille inversée dans le navigateur.
 */
function writeErrorMessage(e: unknown): string | null {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message: unknown }).message
    if (typeof m === 'string' && m.trim()) return m
  }
  return null
}

function Field({ c, label, hint, children }: {
  c: PfColors; label: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: c.sub, letterSpacing: 0.1 }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11, fontWeight: 500, color: c.sub, lineHeight: 1.4 }}>{hint}</span>}
    </div>
  )
}

function Segmented<T extends number | string>({ c, value, options, format, onChange }: {
  c: PfColors; value: T; options: readonly T[]; format: (v: T) => string; onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map((o) => {
        const on = o === value
        return (
          <button
            key={String(o)}
            type="button"
            onClick={() => onChange(o)}
            style={{
              padding: '7px 12px', borderRadius: 10, cursor: 'pointer', border: 'none',
              fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, letterSpacing: -0.1,
              background: on ? c.ink : c.cardSub,
              color: on ? c.card : c.sub,
            }}
          >
            {format(o)}
          </button>
        )
      })}
    </div>
  )
}

export function AvailabilityFocusSection({ sp, surf, dark }: FocusSectionProps) {
  const { t, i18n } = useTranslation('settings')
  const c: PfColors = pfColors(sp, surf, dark)
  const toast = useToast()
  const { settings, timeOff, isLoading, isSaving, hasBackend, save, addTimeOff, removeTimeOff } =
    useAgentBookingSettings()

  const [draft, setDraft] = useState<AgentBookingSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [offStart, setOffStart] = useState('')
  const [offEnd, setOffEnd] = useState('')
  const [offReason, setOffReason] = useState('')

  const current = draft ?? settings
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(settings)

  const patch = (p: Partial<AgentBookingSettings>) => setDraft({ ...current, ...p })

  const setDayRanges = (day: string, ranges: [string, string][]) => {
    const next: WeeklyHours = { ...current.weekly_hours }
    if (ranges.length === 0) delete next[day]
    else next[day] = ranges
    patch({ weekly_hours: next })
  }

  const openDays = useMemo(
    () => ISO_DAYS.filter((d) => (current.weekly_hours[d]?.length ?? 0) > 0).length,
    [current.weekly_hours],
  )

  const onSave = async () => {
    setError(null)
    try {
      await save(current)
      setDraft(null)
      toast.success(t('focus.common.saved'))
    } catch (e) {
      // Message du trigger affiché tel quel : « weekly_hours[2] : plages non
      // ordonnees ou chevauchantes » dit précisément quel jour corriger, là où
      // un « erreur d'enregistrement » laisserait l'agent chercher.
      setError(writeErrorMessage(e) ?? t('focus.toast.saveError'))
    }
  }

  const onAddTimeOff = async () => {
    if (!offStart || !offEnd) return
    // Bornes de journée entière : une absence saisie au jour doit couvrir le jour.
    const from = new Date(`${offStart}T00:00:00`).toISOString()
    const to = new Date(`${offEnd}T23:59:59`).toISOString()
    if (new Date(to) <= new Date(from)) { setError(t('focus.availability.timeoff_bad_range')); return }
    try {
      await addTimeOff({ starts_at: from, ends_at: to, reason: offReason.trim() || null })
      setOffStart(''); setOffEnd(''); setOffReason('')
      toast.success(t('focus.common.saved'))
    } catch { toast.error(t('focus.toast.saveError')) }
  }

  // Étiquette locale suisse suivant la langue active — pas un 'fr-CH' figé, qui
  // servirait du format romand à un agent alémanique. Même correspondance que
  // MlkScreens.formatDateShort. Le fuseau est celui des disponibilités : une
  // absence saisie au jour doit se relire au même jour.
  const localeTag =
    i18n.language?.startsWith('de') ? 'de-CH' :
    i18n.language?.startsWith('it') ? 'it-CH' :
    i18n.language?.startsWith('en') ? 'en-GB' : 'fr-CH'
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(localeTag, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: current.timezone })
      .format(new Date(iso))

  const inputStyle: React.CSSProperties = {
    background: c.cardSub, border: c.hair, borderRadius: 10, padding: '8px 10px',
    fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: c.ink, minWidth: 0,
  }

  if (isLoading) {
    return <div style={{ padding: 24, fontSize: 13, color: c.sub }}>{t('focus.availability.loading')}</div>
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        ${PF_KEYFRAMES}
        .avx-row:hover { background: ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)'}; }
      `}</style>

      {/* ── Interrupteur maître ────────────────────────────────────────────── */}
      <div style={{ borderRadius: 22, boxShadow: c.shadow }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: c.cardSub, borderRadius: '22px 22px 0 0', border: c.hair, borderBottom: `1px solid ${c.hairSoft}`, padding: '8px 20px' }}>
          <PfIc name="info" size={14} stroke={c.sub} sw={1.8} />
          <span style={{ fontSize: 12, fontWeight: 600, color: c.sub, letterSpacing: -0.1 }}>{t('focus.availability.banner')}</span>
        </div>
        <div style={{ background: c.card, borderRadius: '0 0 22px 22px', border: c.hair, borderTop: 0, padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <PfChip name="clock" c={c} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2, color: c.ink }}>{t('focus.availability.open_label')}</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: c.sub, marginTop: 2 }}>
                {current.is_open
                  ? t('focus.availability.open_on', { days: openDays })
                  : t('focus.availability.open_off')}
              </div>
            </div>
            <PfSwitch c={c} on={current.is_open} onClick={() => patch({ is_open: !current.is_open })} />
          </div>
        </div>
      </div>

      {/* ── Grille hebdomadaire ────────────────────────────────────────────── */}
      <div style={{ background: c.card, borderRadius: 22, border: c.hair, boxShadow: c.shadow, padding: '16px 20px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: c.blue }} />
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.2, color: c.ink, flex: 1 }}>{t('focus.availability.week_group')}</span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: c.sub }}>{current.timezone}</span>
        </div>

        {ISO_DAYS.map((day) => {
          const ranges = current.weekly_hours[day] ?? []
          const on = ranges.length > 0
          return (
            <div key={day} className="avx-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 8px', borderRadius: 12 }}>
              <div style={{ width: 96, flexShrink: 0, paddingTop: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: on ? c.ink : c.sub }}>{t(`focus.availability.days.${day}`)}</span>
              </div>

              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ranges.length === 0 ? (
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: c.sub, paddingTop: 7 }}>{t('focus.availability.closed')}</span>
                ) : ranges.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="time" value={r[0]} style={{ ...inputStyle, width: 108 }}
                      onChange={(e) => setDayRanges(day, ranges.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))}
                    />
                    <span style={{ fontSize: 12, color: c.sub }}>→</span>
                    <input
                      type="time" value={r[1]} style={{ ...inputStyle, width: 108 }}
                      onChange={(e) => setDayRanges(day, ranges.map((x, j) => (j === i ? [x[0], e.target.value] : x)))}
                    />
                    <button
                      type="button"
                      onClick={() => setDayRanges(day, ranges.filter((_, j) => j !== i))}
                      title={t('focus.availability.remove_range')}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center' }}
                    >
                      <PfIc name="x" size={14} stroke={c.sub} />
                    </button>
                  </div>
                ))}
                {on && (
                  <button
                    type="button"
                    onClick={() => setDayRanges(day, [...ranges, DEFAULT_RANGE])}
                    style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, color: c.blue }}
                  >
                    + {t('focus.availability.add_range')}
                  </button>
                )}
              </div>

              <div style={{ paddingTop: 4 }}>
                <PfSwitch c={c} on={on} onClick={() => setDayRanges(day, on ? [] : [DEFAULT_RANGE])} />
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Réglages du créneau ────────────────────────────────────────────── */}
      <div style={{ background: c.card, borderRadius: 22, border: c.hair, boxShadow: c.shadow, padding: '16px 20px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: c.blue }} />
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.2, color: c.ink }}>{t('focus.availability.slot_group')}</span>
        </div>

        <Field c={c} label={t('focus.availability.slot_minutes')} hint={t('focus.availability.slot_minutes_hint')}>
          <Segmented c={c} value={current.slot_minutes} options={SLOT_CHOICES}
            format={(v) => t('focus.availability.minutes', { n: v })}
            onChange={(v) => patch({ slot_minutes: v })} />
        </Field>

        <Field c={c} label={t('focus.availability.buffer_minutes')} hint={t('focus.availability.buffer_minutes_hint')}>
          <Segmented c={c} value={current.buffer_minutes} options={BUFFER_CHOICES}
            format={(v) => (v === 0 ? t('focus.availability.none') : t('focus.availability.minutes', { n: v }))}
            onChange={(v) => patch({ buffer_minutes: v })} />
        </Field>

        <Field c={c} label={t('focus.availability.min_notice')} hint={t('focus.availability.min_notice_hint')}>
          <Segmented c={c} value={current.min_notice_hours} options={NOTICE_CHOICES}
            format={(v) => t('focus.availability.hours', { n: v })}
            onChange={(v) => patch({ min_notice_hours: v })} />
        </Field>

        <Field c={c} label={t('focus.availability.max_advance')} hint={t('focus.availability.max_advance_hint')}>
          <Segmented c={c} value={current.max_advance_days} options={HORIZON_CHOICES}
            format={(v) => t('focus.availability.days_n', { n: v })}
            onChange={(v) => patch({ max_advance_days: v })} />
        </Field>

        <Field c={c} label={t('focus.availability.mode')}>
          <Segmented c={c} value={current.default_mode} options={['sur_place', 'video'] as const}
            format={(v) => t(`focus.availability.mode_${v}`)}
            onChange={(v) => patch({ default_mode: v })} />
        </Field>

        <Field c={c} label={t('focus.availability.location')} hint={t('focus.availability.location_hint')}>
          <input
            type="text" value={current.location_label ?? ''} style={inputStyle}
            placeholder={t('focus.availability.location_placeholder')}
            onChange={(e) => patch({ location_label: e.target.value || null })}
          />
        </Field>
      </div>

      {/* ── Absences ───────────────────────────────────────────────────────── */}
      <div style={{ background: c.card, borderRadius: 22, border: c.hair, boxShadow: c.shadow, padding: '16px 20px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: c.blue }} />
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.2, color: c.ink, flex: 1 }}>{t('focus.availability.timeoff_group')}</span>
        </div>

        {timeOff.length === 0 ? (
          <div style={{ fontSize: 12.5, fontWeight: 500, color: c.sub, marginBottom: 12 }}>{t('focus.availability.timeoff_empty')}</div>
        ) : timeOff.map((o) => (
          <div key={o.id} className="avx-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 8px', borderRadius: 12 }}>
            <PfIc name="clock" size={15} stroke={c.sub} />
            <span style={{ fontSize: 13, fontWeight: 700, color: c.ink }}>{fmtDate(o.starts_at)} → {fmtDate(o.ends_at)}</span>
            {o.reason && <span style={{ fontSize: 12, fontWeight: 500, color: c.sub, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.reason}</span>}
            <button
              type="button" onClick={() => removeTimeOff(o.id)} title={t('focus.availability.timeoff_remove')}
              style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}
            >
              <PfIc name="trash" size={14} stroke={c.sub} />
            </button>
          </div>
        ))}

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <Field c={c} label={t('focus.availability.timeoff_from')}>
            <input type="date" value={offStart} onChange={(e) => setOffStart(e.target.value)} style={{ ...inputStyle, width: 150 }} />
          </Field>
          <Field c={c} label={t('focus.availability.timeoff_to')}>
            <input type="date" value={offEnd} onChange={(e) => setOffEnd(e.target.value)} style={{ ...inputStyle, width: 150 }} />
          </Field>
          <Field c={c} label={t('focus.availability.timeoff_reason')}>
            <input type="text" value={offReason} onChange={(e) => setOffReason(e.target.value)} style={{ ...inputStyle, width: 190 }} placeholder={t('focus.availability.timeoff_reason_placeholder')} />
          </Field>
          <button
            type="button" onClick={onAddTimeOff} disabled={!offStart || !offEnd || isSaving}
            style={{
              height: 36, padding: '0 16px', borderRadius: 10, border: 'none',
              cursor: !offStart || !offEnd ? 'default' : 'pointer', fontFamily: 'inherit',
              fontSize: 12.5, fontWeight: 700,
              background: !offStart || !offEnd ? c.cardSub : c.ink,
              color: !offStart || !offEnd ? c.sub : c.card,
            }}
          >
            {t('focus.availability.timeoff_add')}
          </button>
        </div>
      </div>

      {/* ── Barre d'enregistrement ─────────────────────────────────────────── */}
      {error && (
        <div style={{ padding: '11px 16px', borderRadius: 12, background: dark ? 'rgba(239,68,68,0.12)' : '#FEF2F2', fontSize: 12.5, fontWeight: 600, color: dark ? '#FCA5A5' : '#B42318', lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: c.sub, flex: 1 }}>
          {dirty ? t('focus.availability.unsaved') : ''}
        </span>
        <button
          type="button" onClick={onSave} disabled={!dirty || isSaving || !hasBackend}
          style={{
            height: 40, padding: '0 22px', borderRadius: 999, border: 'none',
            cursor: dirty && !isSaving ? 'pointer' : 'default', fontFamily: 'inherit',
            fontSize: 13, fontWeight: 700, letterSpacing: -0.1,
            background: dirty ? c.ink : c.cardSub,
            color: dirty ? c.card : c.sub,
          }}
        >
          {isSaving ? t('focus.availability.saving') : t('focus.availability.save')}
        </button>
      </div>
    </div>
  )
}
