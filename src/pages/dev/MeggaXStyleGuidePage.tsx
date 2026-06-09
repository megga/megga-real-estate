// MEGGA X — page catalogue (rejoue le style guide la vitrine MEGGA dans l'app).
// Palier 1 : Couleurs + Boutons + Badges + Inputs. Tout est rendu dans le scope
// <MeggaX> (tokens + canvas sombre verbatim). Aucune valeur inventée : les
// pastilles affichent les tokens exacts de la source.

import {
  MeggaX,
  MxButton,
  MxBadge,
  MxInput,
  MxIcon,
  MX_ICONS,
  MxLink,
  MxList,
  MxStateMessage,
  MxCheckbox,
  MxRadio,
  MxToggle,
  MxSelect,
  MxAvatar,
} from '@/components/megga-x'
import type { MxIconSet } from '@/components/megga-x'
import { useState } from 'react'

interface Swatch {
  name: string
  varName: string
  hex: string
}

const PRIMARY: Swatch[] = [
  { name: 'Primary 100', varName: '--primary-colors--100', hex: '#424bfb' },
  { name: 'Primary 200', varName: '--primary-colors--200', hex: '#00d95f' },
  { name: 'Primary 300', varName: '--primary-colors--300', hex: '#1abcfe' },
]

const NEUTRALS: Swatch[] = [
  { name: 'Neutral 100', varName: '--neutral-colors--100', hex: '#030303' },
  { name: 'Neutral 200', varName: '--neutral-colors--200', hex: '#050505' },
  { name: 'Neutral 300', varName: '--neutral-colors--300', hex: '#090909' },
  { name: 'Neutral 400', varName: '--neutral-colors--400', hex: '#181818' },
  { name: 'Neutral 500', varName: '--neutral-colors--500', hex: '#686868' },
  { name: 'Neutral 600', varName: '--neutral-colors--600', hex: '#a3a3a3' },
  { name: 'Neutral 700', varName: '--neutral-colors--700', hex: '#cccccc' },
  { name: 'Neutral 800', varName: '--neutral-colors--800', hex: '#ededed' },
  { name: 'Neutral 900', varName: '--neutral-colors--900', hex: '#f9f9f9' },
  { name: 'Neutral 1000', varName: '--neutral-colors--1000', hex: '#ffffff' },
]

const SECONDARY: Swatch[] = [
  { name: 'Secondary 100', varName: '--secondary-colors--100', hex: '#f4f8ff' },
  { name: 'Secondary 200', varName: '--secondary-colors--200', hex: '#e9f1ff' },
  { name: 'Secondary 300', varName: '--secondary-colors--300', hex: '#d5e4ff' },
  { name: 'Secondary 400', varName: '--secondary-colors--400', hex: '#b2cdff' },
  { name: 'Secondary 500', varName: '--secondary-colors--500', hex: '#82aeff' },
  { name: 'Secondary 600', varName: '--secondary-colors--600', hex: '#679cff' },
  { name: 'Secondary 700', varName: '--secondary-colors--700', hex: '#2370ff' },
  { name: 'Secondary 800', varName: '--secondary-colors--800', hex: '#024bd2' },
  { name: 'Secondary 900', varName: '--secondary-colors--900', hex: '#003598' },
  { name: 'Secondary 1000', varName: '--secondary-colors--1000', hex: '#002a79' },
]

const SYSTEM: Swatch[] = [
  { name: 'Red 400', varName: '--system-colors--red-400', hex: '#fe566b' },
  { name: 'Green 400', varName: '--system-colors--green-400', hex: '#74d184' },
  { name: 'Yellow 400', varName: '--system-colors--yellow-400', hex: '#efc42c' },
  { name: 'Blue 400', varName: '--system-colors--blue-400', hex: '#64a7ff' },
]

function SwatchGrid({ items }: { items: Swatch[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 16,
      }}
    >
      {items.map((s) => (
        <div
          key={s.varName}
          style={{
            border: '1px solid var(--neutral-colors--400)',
            borderRadius: 'var(--main-border-radius--br-small)',
            overflow: 'hidden',
            background: 'var(--neutral-colors--200)',
          }}
        >
          <div style={{ height: 120, background: `var(${s.varName})` }} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              padding: '12px 14px',
              fontSize: 14,
            }}
          >
            <span>{s.name}</span>
            <span style={{ color: 'var(--neutral-colors--600)' }}>{s.hex}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 56 }}>
      <h2 style={{ fontSize: 28, fontWeight: 600, margin: '0 0 20px' }}>{title}</h2>
      {children}
    </section>
  )
}

function RadioSection() {
  const [val, setVal] = useState('a')
  return (
    <Section title="Radio">
      <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
        {[
          ['a', 'Option A'],
          ['b', 'Option B'],
          ['c', 'Option C'],
        ].map(([value, label]) => (
          <MxRadio
            key={value}
            name="mx-radio-demo"
            value={value}
            label={label}
            checked={val === value}
            onSelect={setVal}
          />
        ))}
      </div>
    </Section>
  )
}

export default function MeggaXStyleGuidePage() {
  return (
    <MeggaX>
      <div style={{ minHeight: '100vh' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', padding: '64px 32px 120px' }}>
          <p
            style={{
              color: 'var(--neutral-colors--600)',
              fontSize: 14,
              margin: 0,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Design System
          </p>
          <h1 style={{ fontSize: 44, fontWeight: 700, margin: '8px 0 4px' }}>MEGGA X</h1>
          <p style={{ color: 'var(--neutral-colors--600)', fontSize: 18, margin: 0 }}>
            Le design system officiel de MEGGA — couleurs, typographie et composants.
          </p>

          <Section title="Couleurs principales">
            <SwatchGrid items={PRIMARY} />
          </Section>
          <Section title="Couleurs neutres">
            <SwatchGrid items={NEUTRALS} />
          </Section>
          <Section title="Couleurs secondaires">
            <SwatchGrid items={SECONDARY} />
          </Section>
          <Section title="Couleurs système">
            <SwatchGrid items={SYSTEM} />
          </Section>

          <Section title="Typographie — Inter Tight">
            {/* la vitrine MEGGA : 3 graisses, Regular (400) / Medium (500) / Semi-bold (600).
                Pas de bold 700 sur les displays (la plus lourde = semi-bold). */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              {['Regular', 'Medium', 'Semi-bold'].map((w) => (
                <span key={w} className="badge" style={{ fontSize: 14 }}>
                  {w}
                </span>
              ))}
            </div>
            <div style={{ display: 'grid', gap: 20 }}>
              {([10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const).map((n) => (
                <div key={n} style={{ display: 'grid', gap: 6 }}>
                  <span style={{ color: 'var(--neutral-colors--600)', fontSize: 12 }}>
                    display-{n}
                  </span>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: 16,
                      alignItems: 'baseline',
                    }}
                  >
                    <span className={`display-${n}`}>Regular</span>
                    <span className={`display-${n} medium`}>Medium</span>
                    <span className={`display-${n} semi-bold`}>Semi-bold</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Boutons">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
              <MxButton variant="primary">Bouton primaire</MxButton>
              <MxButton variant="primary" size="small">
                Primaire small
              </MxButton>
              <MxButton variant="secondary">Bouton secondaire</MxButton>
            </div>
          </Section>

          <Section title="Badges">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
              <MxBadge>Badge</MxBadge>
              <MxBadge asLink>Badge lien</MxBadge>
            </div>
          </Section>

          <Section title="Champs">
            <div style={{ display: 'grid', gap: 16, maxWidth: 420 }}>
              <MxInput placeholder="prenom@votre-agence.ch" />
              <MxInput placeholder="Votre mot de passe" type="password" />
              <MxSelect
                options={[
                  { value: 'fb', label: 'Facebook' },
                  { value: 'x', label: 'X' },
                  { value: 'li', label: 'LinkedIn' },
                  { value: 'other', label: 'Autre…' },
                ]}
              />
            </div>
          </Section>

          <Section title="Liens">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
              <MxLink href="#">Élément de lien</MxLink>
              <MxLink href="#" medium>
                Élément de lien
              </MxLink>
              <MxLink href="#" primary>
                Élément de lien
              </MxLink>
            </div>
          </Section>

          <Section title="Listes">
            <div style={{ display: 'flex', gap: 64, flexWrap: 'wrap' }}>
              <MxList items={['Élément de liste', 'Élément de liste', 'Élément de liste']} />
              <MxList
                ordered
                items={['Élément de liste', 'Élément de liste', 'Élément de liste']}
              />
            </div>
          </Section>

          <Section title="Messages d'état">
            <div style={{ display: 'grid', gap: 16, maxWidth: 480 }}>
              <MxStateMessage variant="success">
                Merci, votre message a bien été envoyé.
              </MxStateMessage>
              <MxStateMessage variant="error">
                Oups, une erreur est survenue lors de l'envoi.
              </MxStateMessage>
            </div>
          </Section>

          <Section title="Checkbox">
            <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
              <MxCheckbox label="Option" defaultChecked />
              <MxCheckbox label="Option" />
              <MxCheckbox label="Petite" small defaultChecked />
            </div>
          </Section>

          <RadioSection />

          <Section title="Toggle">
            <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
              <MxToggle defaultOn />
              <MxToggle defaultOn={false} />
              <MxToggle small defaultOn />
            </div>
          </Section>

          <Section title="Avatars">
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
              {([24, 32, 40, 64, 100] as const).map((s) => (
                <MxAvatar key={s} size={s} src="/megga-x/images/avatar-demo.jpg" alt="Avatar" />
              ))}
            </div>
          </Section>

          {(
            [
              ['rounded', 'Icônes — Line Rounded'],
              ['social', 'Icônes — Réseaux sociaux'],
              ['custom', 'Icônes — Mega Custom'],
            ] as [MxIconSet, string][]
          ).map(([set, title]) => (
            <Section key={set} title={`${title} (${MX_ICONS[set].length})`}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))',
                  gap: 8,
                }}
              >
                {MX_ICONS[set].map((code) => (
                  <div
                    key={code}
                    title={`0x${code.toString(16)}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 56,
                      border: '1px solid var(--neutral-colors--400)',
                      borderRadius: 'var(--main-border-radius--br-2x-extra-small)',
                      background: 'var(--neutral-colors--200)',
                    }}
                  >
                    <MxIcon set={set} code={code} style={{ fontSize: 24 }} />
                  </div>
                ))}
              </div>
            </Section>
          ))}
        </div>
      </div>
    </MeggaX>
  )
}
