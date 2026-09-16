/**
 * Atomes de « Nouveau bien » — un bloc titré, une pastille, un champ, un sélecteur.
 *
 * Même grammaire que les écrans refaits le 16.09.2026 (Mes biens, fiche bien, planifier une
 * visite) : pastilles 36 px, accent sur le choix actif, filet `cardBorder`, jetons
 * `--crm-*` partout. Une seule source pour les quatre étapes, sinon elles dériveraient.
 */
import type { ReactNode } from 'react'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'

/** Un bloc de formulaire : titre, contenu — sans sous-titre, le champ se lit seul. */
export function NbBloc({ titre, droite, children, sp }: {
  titre: string; droite?: ReactNode; children: ReactNode; sp: CrmPalette
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)' }}>
        <h2 style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: sp.ink }}>{titre}</h2>
        {droite}
      </div>
      {children}
    </section>
  )
}

/** Pastille de choix — l'accent porte la sélection. */
export function NbPuce({ on, onClick, children, icon, disabled, title, sp }: {
  on: boolean; onClick: () => void; children: ReactNode; icon?: MEIconName; disabled?: boolean; title?: string; sp: CrmPalette
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} disabled={disabled} title={title} className={on ? undefined : 'nb-puce'} style={{
      display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 38, padding: '0 var(--crm-space-xl)',
      borderRadius: 'var(--crm-radius-pill)', border: on ? `1px solid ${sp.accent}` : `1px solid ${sp.cardBorder}`,
      background: on ? sp.accent : 'transparent', color: on ? sp.accentInk : disabled ? sp.sub : sp.ink,
      fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, whiteSpace: 'nowrap',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    }}>
      {icon && <MEIcon name={icon} size={15} />}
      {children}
    </button>
  )
}

/** Champ libellé ; `suffixe` (m², CHF, %) se lit dans le champ, à droite. */
export function NbChamp({ label, value, onChange, suffixe, prefixe, placeholder, type = 'text', inputMode, step, autoFocus, sp }: {
  label: string; value: string; onChange: (v: string) => void; suffixe?: string; prefixe?: string; placeholder?: string
  type?: string; inputMode?: 'numeric' | 'decimal' | 'text'; step?: number; autoFocus?: boolean; sp: CrmPalette
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xs)', minWidth: 0 }}>
      <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: sp.sub }}>{label}</span>
      <span className="nb-champ" style={{
        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 44, boxSizing: 'border-box',
        padding: '0 var(--crm-space-xl)', borderRadius: 'var(--crm-radius-lg)', border: `1px solid ${sp.cardBorder}`, background: sp.cardBg,
      }}>
        {prefixe && <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.sub }}>{prefixe}</span>}
        <input type={type} inputMode={inputMode} step={step} value={value} placeholder={placeholder} autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)} aria-label={label}
          style={{ flex: 1, minWidth: 0, height: '100%', border: 0, outline: 'none', background: 'transparent', padding: 0, color: sp.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }} />
        {suffixe && <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.sub, whiteSpace: 'nowrap' }}>{suffixe}</span>}
      </span>
    </label>
  )
}

/** Sélecteur à deux ou trois issues, d'un seul tenant. */
export function NbSegment<T extends string>({ options, value, onChange, sp }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; sp: CrmPalette
}) {
  return (
    <div role="radiogroup" style={{ display: 'inline-flex', padding: 'var(--crm-space-2xs)', gap: 'var(--crm-space-2xs)', borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${sp.cardBorder}`, alignSelf: 'flex-start' }}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)} style={{
            height: 36, padding: '0 var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer',
            background: on ? sp.accent : 'transparent', color: on ? sp.accentInk : sp.sub,
            fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600,
          }}>{o.label}</button>
        )
      })}
    </div>
  )
}
