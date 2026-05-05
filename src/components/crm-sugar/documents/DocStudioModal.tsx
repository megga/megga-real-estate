// MEGGA CRM Sugar v2 — Studio PDF modal (simplifié pour MEGGA agence unique)
// 1:1 port from `crm-documents-sugar-studio.jsx` — sans le sélecteur multi-agence
// (CRM_AGENCIES non porté). On utilise une agence MEGGA hardcodée.

import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { DocIcon, type DocIconName } from './atoms'
import { docFmtPrice, type DocFolder, type DocItem } from './data'

const ACCENTS: { id: string; color?: string; label: string }[] = [
  { id: 'agency', label: 'Couleur agence' },
  { id: 'black', color: '#0B0C0E', label: 'Noir' },
  { id: 'marine', color: '#1E3A5F', label: 'Marine' },
  { id: 'olive', color: '#5C6B3F', label: 'Olive' },
  { id: 'terra', color: '#A0522D', label: 'Terracotta' },
  { id: 'plum', color: '#5A3A52', label: 'Prune' },
  { id: 'slate', color: '#3F4640', label: 'Ardoise' },
]

const PAGE_OPTS = [
  { id: 'cover', label: 'Couverture', on: true, count: 1 },
  { id: 'highlights', label: 'Points forts', on: true, count: 1 },
  { id: 'gallery', label: 'Galerie photos', on: true, count: 4 },
  { id: 'floorplan', label: 'Plans', on: true, count: 2 },
  { id: 'location', label: 'Localisation', on: true, count: 1 },
  { id: 'specs', label: 'Caractéristiques', on: true, count: 2 },
  { id: 'finance', label: 'Données financières', on: false, count: 1 },
  { id: 'agent', label: 'Carte agent', on: true, count: 1 },
  { id: 'contact', label: 'Contact', on: true, count: 1 },
]

const MEGGA_AGENCY = {
  id: 'megga',
  name: 'MEGGA Real Estate',
  short: 'MEGGA',
  primary: '#0041D9',
  agent: { name: 'Gregory Lyonnet', phone: '+41 22 555 01 02' },
  phone: '+41 22 555 01 02',
  web: 'megga.ch',
}

interface SugarTokens {
  bgCanvas: string
  bgPaper: string
  modalBg: string
  cardSubtle: string
  black: string
  blackHover: string
  ink: string
  inkSoft: string
  muted: string
  ghost: string
  shadow: string
  shadowSm: string
  shadowLg: string
  modalShadow: string
  selectInk: string
  overlay: string
}

function sugarTokens(dark: boolean): SugarTokens {
  if (!dark) {
    return {
      bgCanvas:
        'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',
      bgPaper: '#EDEFF3',
      modalBg: '#FFFFFF',
      cardSubtle: '#F7F8FA',
      black: '#0B0C0E',
      blackHover: '#1F2024',
      ink: '#0B0C0E',
      inkSoft: '#3A3D44',
      muted: '#7A8088',
      ghost: '#B5BAC2',
      shadow: '0 12px 40px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)',
      shadowSm: '0 4px 16px rgba(15,23,42,0.04)',
      shadowLg: '0 24px 60px rgba(15,23,42,0.10), 0 4px 16px rgba(15,23,42,0.05)',
      modalShadow: '0 40px 100px rgba(15,23,42,0.20), 0 8px 24px rgba(15,23,42,0.10)',
      selectInk: '#FFFFFF',
      overlay: 'rgba(15,23,42,0.40)',
    }
  }
  return {
    bgCanvas:
      'radial-gradient(ellipse 120% 80% at 50% 100%, #1A1A28 0%, #131320 50%, #0E0E18 100%)',
    bgPaper: '#0E0E18',
    modalBg: '#16161F',
    cardSubtle: '#1E1E2A',
    black: '#ECEDF3',
    blackHover: '#FFFFFF',
    ink: '#ECEDF3',
    inkSoft: '#B5B7C4',
    muted: '#797D90',
    ghost: '#3F4252',
    shadow: '0 12px 40px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.3)',
    shadowSm: '0 4px 16px rgba(0,0,0,.4)',
    shadowLg: '0 24px 60px rgba(0,0,0,.6), 0 4px 16px rgba(0,0,0,.4)',
    modalShadow: '0 40px 100px rgba(0,0,0,.7), 0 8px 24px rgba(0,0,0,.4)',
    selectInk: '#16161F',
    overlay: 'rgba(0,0,4,0.72)',
  }
}

interface DocStudioModalProps {
  doc: DocItem
  folder: DocFolder
  dark: boolean
  onClose: () => void
}

export function DocStudioModal({ doc, folder, dark, onClose }: DocStudioModalProps) {
  const s = sugarTokens(dark)
  const agency = MEGGA_AGENCY

  const [mode, setMode] = useState<'named' | 'anonymous'>('named')
  const [send, setSend] = useState<'download' | 'link'>('download')
  const [accent, setAccent] = useState('agency')
  const [format, setFormat] = useState('A4')
  const [lang, setLang] = useState('FR')
  const [showStamp, setShowStamp] = useState(true)
  const [pages, setPages] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PAGE_OPTS.map(p => [p.id, p.on])),
  )

  const accentColor =
    accent === 'agency'
      ? agency.primary
      : (ACCENTS.find(a => a.id === accent)?.color || agency.primary)
  const totalPages = PAGE_OPTS.filter(p => pages[p.id]).reduce(
    (sum, p) => sum + p.count,
    0,
  )

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: s.overlay,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(1240px, 100%)',
          height: 'calc(100vh - 48px)',
          background: dark ? s.bgPaper : '#EDEFF3',
          backgroundImage: dark ? 'none' : s.bgCanvas,
          borderRadius: 28,
          boxShadow: s.modalShadow,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'inherit',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '22px 28px 14px',
            flexShrink: 0,
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: s.black,
                color: s.selectInk,
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 6px 16px rgba(11,12,14,0.18)',
              }}
            >
              <DocIcon name="sparkles" size={18} color={s.selectInk} />
            </div>
            <div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: s.ink,
                  letterSpacing: '-0.4px',
                }}
              >
                Studio PDF
              </div>
              <div style={{ fontSize: 12.5, color: s.muted, marginTop: 2 }}>
                {doc.name} · {folder.title}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 14px 8px 8px',
              borderRadius: 999,
              background: s.modalBg,
              boxShadow: s.shadow,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: agency.primary,
                flexShrink: 0,
              }}
            />
            <div style={{ fontSize: 13, fontWeight: 700, color: s.ink }}>
              {agency.name}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              border: 0,
              background: s.modalBg,
              cursor: 'pointer',
              color: s.muted,
              display: 'grid',
              placeItems: 'center',
              boxShadow: s.shadow,
              transition: 'transform .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'rotate(90deg)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'rotate(0deg)')}
          >
            <DocIcon name="x" size={14} color={s.muted} strokeWidth={2.2} />
          </button>
        </div>

        {/* Body 3 cols */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '320px 1fr 320px',
            gap: 20,
            padding: '4px 22px 18px',
            overflow: 'hidden',
          }}
        >
          {/* COL 1 */}
          <div
            style={{
              background: s.modalBg,
              borderRadius: 22,
              boxShadow: s.shadow,
              padding: '20px 18px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 22,
            }}
          >
            <Section title="Mode agent" s={s}>
              <RadioCard
                active={mode === 'named'}
                onClick={() => setMode('named')}
                icon="user"
                title="Mes coordonnées"
                desc={`${agency.agent.name} · ${agency.name}`}
                s={s}
              />
              <RadioCard
                active={mode === 'anonymous'}
                onClick={() => setMode('anonymous')}
                icon="anonymous"
                title="Anonyme"
                desc={`${agency.name} seule, sans agent`}
                s={s}
              />
            </Section>

            <Section title="Envoi" s={s}>
              <RadioCard
                active={send === 'download'}
                onClick={() => setSend('download')}
                icon="download"
                title="Téléchargement"
                desc="PDF local"
                s={s}
              />
              <RadioCard
                active={send === 'link'}
                onClick={() => setSend('link')}
                icon="link"
                title="Lien partageable"
                desc="URL dédiée à ce dossier"
                s={s}
              />
            </Section>

            <Section title="Stamp agence" s={s}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: s.cardSubtle,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    minWidth: 0,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: s.ink,
                      }}
                    >
                      Afficher le stamp
                    </div>
                    <div style={{ fontSize: 11, color: s.muted, marginTop: 1 }}>
                      Cachet officiel sur le document
                    </div>
                  </div>
                </div>
                <Toggle value={showStamp} onChange={setShowStamp} s={s} />
              </label>
            </Section>
          </div>

          {/* COL 2 — preview */}
          <div
            style={{
              padding: '8px 8px',
              overflowY: 'auto',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                width: 'min(380px, 100%)',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <BrochurePreview
                folder={folder}
                accentColor={accentColor}
                mode={mode}
                lang={lang}
                showStamp={showStamp}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 14px',
                  borderRadius: 999,
                  background: s.modalBg,
                  boxShadow: s.shadowSm,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: s.muted,
                    fontWeight: 600,
                  }}
                >
                  {format} · {lang} · {totalPages} pages
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 10.5,
                    color: s.muted,
                    fontWeight: 600,
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: '#10B981',
                    }}
                  />
                  Aperçu en direct
                </div>
              </div>
            </div>
          </div>

          {/* COL 3 — config */}
          <div
            style={{
              background: s.modalBg,
              borderRadius: 22,
              boxShadow: s.shadow,
              padding: '20px 18px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 22,
            }}
          >
            <Section title="Couleur d'accent" s={s}>
              <button
                onClick={() => setAccent('agency')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '10px 13px',
                  borderRadius: 14,
                  border: 0,
                  background: accent === 'agency' ? s.cardSubtle : 'transparent',
                  boxShadow:
                    accent === 'agency' ? `0 0 0 2px ${s.black} inset` : 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all .18s',
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 7,
                    background: agency.primary,
                    flexShrink: 0,
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08)',
                  }}
                />
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: s.ink,
                    }}
                  >
                    Couleur {agency.short}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: s.muted,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    }}
                  >
                    {agency.primary}
                  </div>
                </div>
                {accent === 'agency' && (
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: s.black,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <DocIcon name="check" size={10} color={s.selectInk} strokeWidth={2.5} />
                  </div>
                )}
              </button>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 1fr)',
                  gap: 7,
                  marginTop: 6,
                }}
              >
                {ACCENTS.filter(a => a.id !== 'agency').map(a => {
                  const active = a.id === accent
                  return (
                    <button
                      key={a.id}
                      onClick={() => setAccent(a.id)}
                      title={a.label}
                      style={{
                        aspectRatio: '1',
                        borderRadius: 10,
                        border: 0,
                        background: a.color,
                        cursor: 'pointer',
                        boxShadow: active
                          ? `0 0 0 2px ${s.black}, 0 0 0 4px ${
                              dark ? s.bgPaper : '#EDEFF3'
                            }, ${s.shadowSm}`
                          : s.shadowSm,
                        transition: 'box-shadow .18s',
                      }}
                    />
                  )
                })}
              </div>
            </Section>

            <Section title="Pages incluses" s={s}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {PAGE_OPTS.map(p => {
                  const on = pages[p.id]
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPages(st => ({ ...st, [p.id]: !st[p.id] }))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 11,
                        padding: '8px 12px',
                        borderRadius: 12,
                        border: 0,
                        background: on ? s.cardSubtle : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                        transition: 'background .15s',
                      }}
                    >
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 6,
                          flexShrink: 0,
                          background: on ? s.black : 'transparent',
                          border: on ? 0 : `1.5px solid ${s.ghost}`,
                          display: 'grid',
                          placeItems: 'center',
                          transition: 'all .15s',
                        }}
                      >
                        {on && (
                          <DocIcon
                            name="check"
                            size={11}
                            color={s.selectInk}
                            strokeWidth={2}
                          />
                        )}
                      </div>
                      <span
                        style={{
                          flex: 1,
                          fontSize: 12.5,
                          color: s.ink,
                          fontWeight: on ? 600 : 500,
                        }}
                      >
                        {p.label}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          color: s.muted,
                          fontWeight: 600,
                        }}
                      >
                        {p.count}p
                      </span>
                    </button>
                  )
                })}
              </div>
            </Section>

            <Section title="Format" s={s}>
              <Pills
                value={format}
                onChange={setFormat}
                s={s}
                options={[
                  { id: 'A4', label: 'A4' },
                  { id: 'US', label: 'US Letter' },
                  { id: 'sq', label: 'Carré' },
                ]}
              />
            </Section>

            <Section title="Langue" s={s}>
              <Pills
                value={lang}
                onChange={setLang}
                s={s}
                options={[
                  { id: 'FR', label: 'Français' },
                  { id: 'DE', label: 'Deutsch' },
                  { id: 'EN', label: 'English' },
                  { id: 'IT', label: 'Italiano' },
                ]}
              />
            </Section>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 28px 22px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 16px 8px 8px',
              borderRadius: 999,
              background: s.modalBg,
              boxShadow: s.shadowSm,
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                background: agency.primary,
                flexShrink: 0,
              }}
            />
            <div style={{ fontSize: 12, color: s.muted }}>
              <b style={{ color: s.ink, fontWeight: 700 }}>{agency.name}</b> ·{' '}
              {totalPages} pages · {format} · {lang}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                height: 44,
                padding: '0 20px',
                borderRadius: 999,
                border: 0,
                background: 'transparent',
                color: s.inkSoft,
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Annuler
            </button>
            <button
              style={{
                height: 44,
                padding: '0 22px',
                borderRadius: 999,
                border: 0,
                background: s.black,
                color: s.selectInk,
                fontFamily: 'inherit',
                fontSize: 13.5,
                fontWeight: 700,
                letterSpacing: '0.1px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 9,
                boxShadow: '0 6px 16px rgba(11,12,14,0.18)',
              }}
            >
              <DocIcon
                name={send === 'download' ? 'download' : 'link'}
                size={14}
                color={s.selectInk}
              />
              {send === 'download' ? 'Télécharger le PDF' : 'Générer le lien'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Section({
  title,
  s,
  children,
}: {
  title: string
  s: SugarTokens
  children: ReactNode
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: '.09em',
          textTransform: 'uppercase',
          color: s.muted,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </div>
  )
}

interface RadioCardProps {
  active: boolean
  onClick: () => void
  icon: DocIconName
  title: string
  desc: string
  s: SugarTokens
}

function RadioCard({ active, onClick, icon, title, desc, s }: RadioCardProps) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 11,
        padding: '11px 13px',
        borderRadius: 14,
        border: 0,
        background: active ? s.cardSubtle : hov ? s.cardSubtle : 'transparent',
        boxShadow: active ? `0 0 0 2px ${s.black} inset` : 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'all .18s',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          flexShrink: 0,
          background: active ? s.black : s.cardSubtle,
          display: 'grid',
          placeItems: 'center',
          transition: 'background .18s',
        }}
      >
        <DocIcon name={icon} size={15} color={active ? s.selectInk : s.ink} />
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: s.ink,
            letterSpacing: '-0.1px',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: s.muted,
            marginTop: 2,
            lineHeight: 1.4,
          }}
        >
          {desc}
        </div>
      </div>
    </button>
  )
}

function Toggle({
  value,
  onChange,
  s,
}: {
  value: boolean
  onChange: (v: boolean) => void
  s: SugarTokens
}) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 40,
        height: 24,
        borderRadius: 999,
        flexShrink: 0,
        background: value ? s.black : s.ghost,
        position: 'relative',
        cursor: 'pointer',
        transition: 'background .18s ease',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 3,
          left: value ? 19 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,.25)',
          transition: 'left .18s ease',
        }}
      />
    </div>
  )
}

interface PillsProps {
  value: string
  onChange: (v: string) => void
  options: { id: string; label: string }[]
  s: SugarTokens
}

function Pills({ value, onChange, options, s }: PillsProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(o => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              border: 0,
              background: active ? s.black : s.cardSubtle,
              color: active ? s.selectInk : s.ink,
              fontSize: 12,
              fontWeight: active ? 700 : 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'all .18s',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

interface BrochurePreviewProps {
  folder: DocFolder
  accentColor: string
  mode: 'named' | 'anonymous'
  lang: string
  showStamp: boolean
}

function BrochurePreview({
  folder,
  accentColor,
  mode,
  lang,
  showStamp,
}: BrochurePreviewProps) {
  const labels: Record<string, { title: string; price: string; surface: string }> = {
    FR: { title: 'Présentation', price: 'Prix indicatif', surface: 'Surface' },
    DE: { title: 'Präsentation', price: 'Richtpreis', surface: 'Fläche' },
    EN: { title: 'Property Presentation', price: 'Guide price', surface: 'Area' },
    IT: { title: 'Presentazione', price: 'Prezzo indicativo', surface: 'Superficie' },
  }
  const L = labels[lang] || labels.FR

  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: '1 / 1.414',
        background: '#FFFFFF',
        borderRadius: 8,
        boxShadow: '0 24px 60px -12px rgba(0,0,0,.32), 0 4px 10px rgba(0,0,0,.10)',
        overflow: 'hidden',
        color: '#0B0C0E',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '0 0 auto 0',
          height: 4,
          background: accentColor,
        }}
      />
      <div
        style={{
          height: '48%',
          width: '100%',
          background: '#EEF1F5',
          position: 'relative',
        }}
      >
        {mode !== 'anonymous' && (
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              width: 32,
              height: 32,
              borderRadius: 6,
              background: accentColor,
            }}
          />
        )}
      </div>

      <div
        style={{
          padding: '14px 16px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          height: '52%',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 6.5,
              letterSpacing: '.22em',
              color: accentColor,
              textTransform: 'uppercase',
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            {L.title}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.15,
              color: '#0B0C0E',
            }}
          >
            {folder.title}
          </div>
          <div style={{ fontSize: 8.5, color: '#7A8079', marginTop: 3 }}>
            {folder.address}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 14,
            paddingTop: 6,
            borderTop: `1px solid ${accentColor}33`,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 6,
                letterSpacing: '.16em',
                color: '#7A8079',
                textTransform: 'uppercase',
              }}
            >
              {L.price}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#0B0C0E',
                marginTop: 2,
              }}
            >
              {docFmtPrice(folder.price)}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 6,
                letterSpacing: '.16em',
                color: '#7A8079',
                textTransform: 'uppercase',
              }}
            >
              {L.surface}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#0B0C0E',
                marginTop: 2,
              }}
            >
              {folder.surface} m²
            </div>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 2.5,
                borderRadius: 1.5,
                background: '#7A807930',
                width: i % 3 === 0 ? '85%' : i % 3 === 1 ? '65%' : '78%',
              }}
            />
          ))}
        </div>

        {showStamp && (
          <div
            style={{
              marginTop: 'auto',
              paddingTop: 7,
              borderTop: `1px solid ${accentColor}33`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 7.5,
                  fontWeight: 700,
                  color: '#0B0C0E',
                }}
              >
                {mode === 'named' ? MEGGA_AGENCY.agent.name : MEGGA_AGENCY.name}
              </div>
              <div style={{ fontSize: 6, color: '#7A8079' }}>
                {MEGGA_AGENCY.phone}
              </div>
            </div>
            <div
              style={{
                fontSize: 6,
                color: '#7A8079',
                letterSpacing: '.08em',
                textAlign: 'right',
              }}
            >
              {MEGGA_AGENCY.web}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
