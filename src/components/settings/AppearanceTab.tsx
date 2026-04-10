import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePreferences } from '@/hooks/usePreferences'
import { useTheme } from '@/hooks/useTheme'
import {
  ACCENT_PRESETS,
  generatePresetFromHex,
  type AccentColor,
  type BorderRadiusTheme,
  type DensityLevel,
  type SidebarStyle,
  type FontSizeLevel,
} from '@/lib/accentPresets'

/* ─── Pill Selector ─── */

function PillSelector<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; hint?: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'h-9 px-4 rounded-lg text-sm transition-all duration-200',
            value === opt.value
              ? 'bg-theme-active text-theme-primary font-medium'
              : 'text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/* ─── Section wrapper ─── */

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-theme-border p-6">
      <h3 className="text-sm font-semibold text-theme-primary">{title}</h3>
      <p className="text-xs text-theme-tertiary mt-0.5 mb-5">{hint}</p>
      {children}
    </div>
  )
}


/* ─── Color Picker Popover (gradient canvas) ─── */

function ColorPickerPopover({
  value,
  onChange,
  onClose,
}: {
  value: string
  onChange: (hex: string) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(value)
  const popoverRef = useRef<HTMLDivElement>(null)
  const gradientRef = useRef<HTMLCanvasElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Draw gradient on canvas
  useEffect(() => {
    const canvas = gradientRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width, h = canvas.height

    // Horizontal hue gradient
    const hueGrad = ctx.createLinearGradient(0, 0, w, 0)
    for (let i = 0; i <= 6; i++) {
      hueGrad.addColorStop(i / 6, `hsl(${i * 60}, 70%, 50%)`)
    }
    ctx.fillStyle = hueGrad
    ctx.fillRect(0, 0, w, h)

    // Vertical: white on top, black on bottom
    const whiteGrad = ctx.createLinearGradient(0, 0, 0, h)
    whiteGrad.addColorStop(0, 'rgba(255,255,255,0.8)')
    whiteGrad.addColorStop(0.5, 'rgba(255,255,255,0)')
    ctx.fillStyle = whiteGrad
    ctx.fillRect(0, 0, w, h)

    const blackGrad = ctx.createLinearGradient(0, 0, 0, h)
    blackGrad.addColorStop(0.5, 'rgba(0,0,0,0)')
    blackGrad.addColorStop(1, 'rgba(0,0,0,0.85)')
    ctx.fillStyle = blackGrad
    ctx.fillRect(0, 0, w, h)
  }, [])

  const pickFromCanvas = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = gradientRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = Math.round((e.clientX - rect.left) * (canvas.width / rect.width))
    const y = Math.round((e.clientY - rect.top) * (canvas.height / rect.height))
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const [r, g, b] = ctx.getImageData(x, y, 1, 1).data
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    setDraft(hex)
    onChange(hex)
  }

  const handleHexInput = (hex: string) => {
    setDraft(hex)
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      onChange(hex)
    }
  }

  return (
    <div
      ref={popoverRef}
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 rounded-xl border border-theme-border bg-theme-card p-3 w-[240px] animate-in fade-in-0 zoom-in-95 duration-150"
      style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
    >
      {/* Gradient area */}
      <canvas
        ref={gradientRef}
        width={214}
        height={130}
        onClick={pickFromCanvas}
        className="w-full h-[130px] rounded-lg cursor-crosshair"
      />

      {/* Hex input + preview */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-theme-border">
        <div
          className="w-7 h-7 rounded-lg shrink-0 transition-colors duration-200"
          style={{ backgroundColor: draft }}
        />
        <input
          type="text"
          value={draft}
          onChange={(e) => handleHexInput(e.target.value)}
          placeholder="#6B4C8A"
          maxLength={7}
          className="flex-1 h-8 px-2.5 text-xs font-mono bg-transparent border border-theme-border rounded-lg text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent uppercase"
        />
      </div>
    </div>
  )
}

/* ─── Mini sidebar preview (realistic) ─── */

function SidebarPreview({ style, isSelected, accentHex, onClick }: { style: SidebarStyle; isSelected: boolean; accentHex: string; onClick: () => void }) {
  const isColored = style === 'colored'
  const sidebarBg = isColored ? accentHex : 'rgb(var(--color-bg-sidebar))'
  const textColor = isColored ? 'rgba(255,255,255,0.85)' : 'rgb(var(--color-text-secondary))'
  const activeTextColor = isColored ? '#fff' : accentHex
  const activeBg = isColored ? 'rgba(255,255,255,0.15)' : accentHex + '14'
  const borderColor = isColored ? 'rgba(255,255,255,0.12)' : 'rgb(var(--color-border-subtle))'
  const sectionLabelColor = isColored ? 'rgba(255,255,255,0.4)' : 'rgb(var(--color-text-tertiary))'

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-44 h-28 rounded-xl border-2 cursor-pointer transition-all duration-200 overflow-hidden flex text-left',
        isSelected ? 'border-accent scale-[1.02]' : 'border-theme-border hover:border-theme-active'
      )}
    >
      {/* Sidebar mock */}
      <div
        className="w-14 h-full flex flex-col py-2 px-1.5 shrink-0"
        style={{ backgroundColor: sidebarBg, borderRight: `1px solid ${borderColor}` }}
      >
        {/* Logo placeholder */}
        <div className="w-5 h-1.5 rounded-sm mx-auto mb-2" style={{ backgroundColor: textColor, opacity: 0.5 }} />

        {/* Section label */}
        {style !== 'minimal' && (
          <div className="w-6 h-[3px] rounded-sm ml-0.5 mb-1" style={{ backgroundColor: sectionLabelColor }} />
        )}

        {/* Nav items */}
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-1 h-4 rounded px-1 mb-0.5"
            style={{
              backgroundColor: i === 0 ? activeBg : 'transparent',
            }}
          >
            <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: i === 0 ? activeTextColor : textColor, opacity: i === 0 ? 1 : 0.4 }} />
            <div className="w-5 h-[2px] rounded-sm" style={{ backgroundColor: i === 0 ? activeTextColor : textColor, opacity: i === 0 ? 0.9 : 0.3 }} />
          </div>
        ))}
      </div>

      {/* Content mock */}
      <div className="flex-1 bg-theme-page p-2 flex flex-col gap-1">
        <div className="w-full h-1.5 rounded-sm bg-theme-section" />
        <div className="w-2/3 h-1.5 rounded-sm bg-theme-section" />
        <div className="flex gap-1 mt-0.5">
          <div className="flex-1 h-6 rounded bg-theme-section" />
          <div className="flex-1 h-6 rounded bg-theme-section" />
        </div>
        <div className="flex-1 rounded bg-theme-section mt-0.5" />
      </div>
    </button>
  )
}

/* ─── Radius preview (richer) ─── */

function RadiusPreview({ radius, accentHex }: { radius: BorderRadiusTheme; accentHex: string }) {
  const r = radius === 'sharp' ? '4px' : radius === 'pill' ? '20px' : '12px'
  const rBtn = radius === 'sharp' ? '4px' : radius === 'pill' ? '12px' : '8px'
  const rBadge = radius === 'sharp' ? '3px' : radius === 'pill' ? '10px' : '6px'

  return (
    <div className="flex items-center gap-4 mt-4 p-4 rounded-xl bg-theme-section transition-all duration-300">
      {/* Card mock */}
      <div
        className="w-28 h-20 border border-theme-border bg-theme-card flex flex-col items-start justify-between p-3 transition-all duration-300"
        style={{ borderRadius: r }}
      >
        <div className="w-10 h-1.5 rounded-sm bg-theme-primary/20" />
        <div className="w-16 h-1.5 rounded-sm bg-theme-primary/10" />
        <span
          className="text-xs font-medium px-1.5 py-0.5 text-white transition-all duration-300"
          style={{ borderRadius: rBadge, backgroundColor: accentHex }}
        >
          Actif
        </span>
      </div>

      {/* Button mock */}
      <div className="flex flex-col gap-2">
        <button
          className="h-8 px-4 text-xs font-medium border border-theme-border text-theme-primary transition-all duration-300"
          style={{ borderRadius: rBtn }}
        >
          Action
        </button>
        <input
          className="h-8 w-28 px-2.5 text-xs border border-theme-border bg-theme-input text-theme-secondary placeholder:text-theme-tertiary transition-all duration-300"
          style={{ borderRadius: rBtn }}
          placeholder="Rechercher..."
          readOnly
        />
      </div>
    </div>
  )
}

/* ─── Density / Font size live preview ─── */

function TextPreview({ label, size }: { label: string; size: string }) {
  return (
    <div className="mt-4 p-4 rounded-xl bg-theme-section">
      <p className="text-theme-primary font-medium transition-all duration-200" style={{ fontSize: size }}>
        {label}
      </p>
      <p className="text-theme-secondary mt-1 transition-all duration-200" style={{ fontSize: `calc(${size} - 1px)` }}>
        Voici un apercu du texte avec cette taille. Les menus, labels et descriptions s'adapteront.
      </p>
    </div>
  )
}

/* ─── Main Component ─── */

export default function AppearanceTab() {
  const { t } = useTranslation('settings')
  const { theme } = useTheme()
  const { preferences, updatePreference, updatePreferences, resetPreferences } = usePreferences()
  const [customColorDraft, setCustomColorDraft] = useState(preferences.customAccentHex || '#6B4C8A')
  const [showPicker, setShowPicker] = useState(false)

  const accentColors = Object.entries(ACCENT_PRESETS) as [Exclude<AccentColor, 'custom'>, typeof ACCENT_PRESETS[Exclude<AccentColor, 'custom'>]][]

  // Resolve current display hex
  const resolveCurrentHex = () => {
    if (preferences.accentColor === 'custom' && preferences.customAccentHex) {
      const preset = generatePresetFromHex(preferences.customAccentHex)
      return theme === 'dark' ? preset.hexDark : preset.hex
    }
    const key = preferences.accentColor as Exclude<AccentColor, 'custom'>
    const preset = ACCENT_PRESETS[key]
    return preset ? (theme === 'dark' ? preset.hexDark : preset.hex) : '#3461D1'
  }
  const currentAccentHex = resolveCurrentHex()

  const fontSizeMap: Record<FontSizeLevel, string> = { small: '13px', medium: '14px', large: '15px' }

  return (
    <div className="space-y-5">

      {/* ── Accent Color ── */}
      <Section title={t('appearance.accentColor')} hint={t('appearance.accentColorHint')}>
        <div className="flex items-start gap-4 flex-wrap">
          {accentColors.map(([key, preset]) => {
            const isSelected = preferences.accentColor === key
            const displayColor = theme === 'dark' ? preset.hexDark : preset.hex
            return (
              <div key={key} className="flex flex-col items-center gap-1.5">
                <button
                  onClick={() => updatePreference('accentColor', key)}
                  className={cn(
                    'w-10 h-10 rounded-full transition-all duration-200 flex items-center justify-center',
                    isSelected ? 'ring-2 ring-offset-2 ring-offset-theme-page scale-110' : 'hover:scale-105'
                  )}
                  style={{
                    backgroundColor: displayColor,
                    ...(isSelected ? { boxShadow: `0 0 0 2px rgb(var(--color-bg-page)), 0 0 0 4px ${displayColor}` } : {}),
                  }}
                >
                  {isSelected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                </button>
                <span className={cn(
                  'text-xs transition-colors duration-200',
                  isSelected ? 'text-theme-primary font-medium' : 'text-theme-tertiary'
                )}>
                  {preset.label}
                </span>
              </div>
            )
          })}

          {/* Custom color toggle + popover */}
          <div className="relative flex flex-col items-center gap-1.5">
            <button
              onClick={() => {
                if (preferences.accentColor !== 'custom') {
                  updatePreferences({ accentColor: 'custom', customAccentHex: customColorDraft })
                }
                setShowPicker(!showPicker)
              }}
              className={cn(
                'w-10 h-10 rounded-full transition-all duration-200 flex items-center justify-center border-2 border-dashed',
                preferences.accentColor === 'custom'
                  ? 'scale-110'
                  : 'border-theme-border hover:border-theme-active hover:scale-105'
              )}
              style={preferences.accentColor === 'custom' && preferences.customAccentHex ? {
                backgroundColor: preferences.customAccentHex,
                borderStyle: 'solid',
                borderColor: preferences.customAccentHex,
                boxShadow: `0 0 0 2px rgb(var(--color-bg-page)), 0 0 0 4px ${preferences.customAccentHex}`,
              } : {}}
            >
              {preferences.accentColor === 'custom' ? (
                <Check className="w-4 h-4 text-white" strokeWidth={3} />
              ) : (
                <Plus className="w-4 h-4 text-theme-tertiary" />
              )}
            </button>
            <span className={cn(
              'text-xs transition-colors duration-200',
              preferences.accentColor === 'custom' ? 'text-theme-primary font-medium' : 'text-theme-tertiary'
            )}>
              Custom
            </span>

            {/* Color picker popover */}
            {showPicker && (
              <ColorPickerPopover
                value={customColorDraft}
                onChange={(hex) => {
                  setCustomColorDraft(hex)
                  updatePreferences({ accentColor: 'custom', customAccentHex: hex })
                }}
                onClose={() => setShowPicker(false)}
              />
            )}
          </div>
        </div>

      </Section>

      {/* ── Border Radius ── */}
      <Section title={t('appearance.borderRadius')} hint={t('appearance.borderRadiusHint')}>
        <PillSelector<BorderRadiusTheme>
          options={[
            { value: 'sharp', label: t('appearance.sharp') },
            { value: 'default', label: t('appearance.default') },
            { value: 'pill', label: t('appearance.pill') },
          ]}
          value={preferences.borderRadius}
          onChange={(v) => updatePreference('borderRadius', v)}
        />
        <RadiusPreview radius={preferences.borderRadius} accentHex={currentAccentHex} />
      </Section>

      {/* ── Density + Font Size (combined) ── */}
      <Section title={t('appearance.density')} hint={t('appearance.densityHint')}>
        <PillSelector<DensityLevel>
          options={[
            { value: 'compact', label: t('appearance.compact') },
            { value: 'comfortable', label: t('appearance.comfortable') },
            { value: 'spacious', label: t('appearance.spacious') },
          ]}
          value={preferences.density}
          onChange={(v) => updatePreference('density', v)}
        />

        <div className="mt-6 pt-5 border-t border-theme-border">
          <h4 className="text-sm font-semibold text-theme-primary">{t('appearance.fontSize')}</h4>
          <p className="text-xs text-theme-tertiary mt-0.5 mb-4">{t('appearance.fontSizeHint')}</p>
          <PillSelector<FontSizeLevel>
            options={[
              { value: 'small', label: t('appearance.fontSmall') },
              { value: 'medium', label: t('appearance.fontMedium') },
              { value: 'large', label: t('appearance.fontLarge') },
            ]}
            value={preferences.fontSize}
            onChange={(v) => updatePreference('fontSize', v)}
          />
        </div>

        {/* Combined preview */}
        <TextPreview
          label={`${t('appearance.' + preferences.density)} · ${t('appearance.font' + preferences.fontSize.charAt(0).toUpperCase() + preferences.fontSize.slice(1))}`}
          size={fontSizeMap[preferences.fontSize]}
        />
      </Section>

      {/* ── Sidebar Style ── */}
      <Section title={t('appearance.sidebarStyle')} hint={t('appearance.sidebarStyleHint')}>
        <div className="flex items-start gap-4">
          {([
            { value: 'default' as SidebarStyle, label: t('appearance.sidebarDefault') },
            { value: 'colored' as SidebarStyle, label: t('appearance.sidebarColored'), hint: t('appearance.sidebarColoredHint') },
            { value: 'minimal' as SidebarStyle, label: t('appearance.sidebarMinimal') },
          ]).map((opt) => (
            <div key={opt.value} className="flex flex-col items-center gap-2">
              <SidebarPreview
                style={opt.value}
                isSelected={preferences.sidebarStyle === opt.value}
                accentHex={currentAccentHex}
                onClick={() => updatePreference('sidebarStyle', opt.value)}
              />
              <span className={cn(
                'text-xs transition-colors duration-200',
                preferences.sidebarStyle === opt.value
                  ? 'text-theme-primary font-medium'
                  : 'text-theme-tertiary'
              )}>
                {opt.label}
              </span>
              {opt.hint && (
                <span className="text-xs text-theme-tertiary -mt-1">{opt.hint}</span>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* ── Reset ── */}
      <div className="flex justify-center pt-2 pb-4">
        <button
          onClick={resetPreferences}
          className="text-xs text-theme-tertiary hover:text-theme-primary transition-colors underline underline-offset-2"
        >
          {t('appearance.reset')}
        </button>
      </div>
    </div>
  )
}
