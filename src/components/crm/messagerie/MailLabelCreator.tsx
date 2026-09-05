/**
 * Le créateur de libellé du rail (README §1d) : un nom, six pastilles semées sur
 * les barreaux `MXC_SYSTEM`, et — si l'agent le demande — une teinte libre
 * (roue + six luminosités + hexadécimal).
 *
 * ⚠ La couleur d'un libellé est une DONNÉE saisie, pas un choix de direction :
 * elle sort de l'échelle par conception (D12). Ce qui reste gardé est son
 * ENCRE — la pastille de liste calcule la sienne par `encreSur()`
 * (`ms.pillInk`), jamais un blanc en dur.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MXC_COLOR, MXC_SYSTEM } from '@/components/megga-x-crm/tokens'
import type { MailLabel } from '@/hooks/useMailLabels'
import { hslToHex, MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

const PRESETS = [MXC_SYSTEM.red400, MXC_SYSTEM.blue300, MXC_SYSTEM.yellow400, MXC_SYSTEM.green300, MXC_COLOR.accent, MXC_COLOR.n500]
const LIGHTNESS = [30, 40, 50, 60, 70, 80]
/** Saturation de la teinte libre : au-dessous, les six luminosités se confondent. */
const SAT = 85

interface Props {
  ms: MailSurfaces
  /** libellé en cours de modification, ou `null` pour une création */
  initial?: MailLabel | null
  onCancel: () => void
  onSave: (v: { name: string; color: string }) => void
  busy?: boolean
}

/** Le panneau inline du rail. Il ne s'ouvre jamais en modale : il remplace la ligne. */
export function MailLabelCreator({ ms, initial, onCancel, onSave, busy }: Props) {
  const { t } = useTranslation('messages')
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? PRESETS[0])
  const [custom, setCustom] = useState(false)
  const [hue, setHue] = useState(220)
  const [light, setLight] = useState(50)
  // ⚠ La teinte libre se POSE au geste, elle ne se SYNCHRONISE pas dans un effet
  // — le plan écrivait `useEffect(() => setColor(hslToHex(…)))`, que
  // `react-hooks/set-state-in-effect` refuse, et à raison : un `setState` en
  // effet fait un second rendu pour dire ce que le premier savait déjà.
  const poserTeinte = (h: number, l: number) => { setHue(h); setLight(l); setColor(hslToHex(h, SAT, l)) }
  const hexOk = useMemo(() => /^#[0-9a-fA-F]{6}$/.test(color), [color])
  const field = { background: ms.elev, border: `1px solid ${ms.bord}`, color: ms.ink, fontFamily: 'inherit', outline: 'none' } as const
  const bloque = !name.trim() || !hexOk || busy

  return (
    <div
      style={{
        background: ms.elev, border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-xl)',
        padding: 'var(--crm-space-md) var(--crm-space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)',
      }}
    >
      <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: ms.mut }}>
        {initial ? t('mail.labels.rename') : t('mail.labels.new')}
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        placeholder={t('mail.labels.namePlaceholder')}
        autoFocus
        style={{ ...field, borderRadius: PILL, padding: 'var(--crm-space-sm) var(--crm-space-lg)', fontSize: 'var(--crm-text-sm)' }}
      />

      <div style={{ display: 'flex', gap: 'var(--crm-space-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
        {PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            onClick={() => { setCustom(false); setColor(c) }}
            style={{
              width: 22, height: 22, borderRadius: '50%', background: c,
              border: `2px solid ${color === c && !custom ? ms.ink : 'transparent'}`, cursor: 'pointer', transition: MAIL_TRANSITION,
            }}
          />
        ))}
        <button
          type="button"
          onClick={() => { const on = !custom; setCustom(on); if (on) poserTeinte(hue, light) }}
          aria-pressed={custom}
          title={t('mail.labels.custom')}
          style={{
            width: 22, height: 22, borderRadius: '50%',
            background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
            border: `2px solid ${custom ? ms.ink : 'transparent'}`, cursor: 'pointer',
          }}
        />
      </div>

      {custom && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
          <input
            type="range"
            min={0}
            max={360}
            value={hue}
            onChange={(e) => poserTeinte(Number(e.target.value), light)}
            aria-label={t('mail.labels.hue')}
            style={{
              width: '100%', height: 12, borderRadius: PILL, appearance: 'none',
              background: 'linear-gradient(90deg, hsl(0 85% 50%), hsl(60 85% 50%), hsl(120 85% 50%), hsl(180 85% 50%), hsl(240 85% 50%), hsl(300 85% 50%), hsl(360 85% 50%))',
            }}
          />
          <div style={{ display: 'flex', gap: 'var(--crm-space-sm)' }}>
            {LIGHTNESS.map((l) => (
              <button
                key={l}
                type="button"
                aria-label={`${l}%`}
                onClick={() => poserTeinte(hue, l)}
                style={{
                  flex: 1, height: 18, borderRadius: 'var(--crm-radius-xs)', background: hslToHex(hue, SAT, l),
                  border: `2px solid ${light === l ? ms.ink : 'transparent'}`, cursor: 'pointer',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)' }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: hexOk ? color : ms.bord }} />
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              maxLength={7}
              aria-label={t('mail.labels.hex')}
              style={{ ...field, borderRadius: PILL, padding: 'var(--crm-space-2xs) var(--crm-space-md)', fontSize: 'var(--crm-text-xs)', width: 96 }}
            />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--crm-space-lg)' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{ background: 'none', border: 'none', color: ms.txt3, fontSize: 'var(--crm-text-xs)', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {t('mail.actions.cancel')}
        </button>
        <button
          type="button"
          disabled={bloque}
          onClick={() => onSave({ name: name.trim(), color })}
          style={{
            background: ms.accent, color: ms.accentInk, border: 'none', borderRadius: PILL,
            padding: 'var(--crm-space-sm) var(--crm-space-2xl)', fontSize: 'var(--crm-text-xs)', fontWeight: 500,
            cursor: bloque ? 'default' : 'pointer', opacity: bloque ? 0.5 : 1, fontFamily: 'inherit', transition: MAIL_TRANSITION,
          }}
        >
          {initial ? t('mail.actions.save') : t('mail.labels.create')}
        </button>
      </div>
    </div>
  )
}
