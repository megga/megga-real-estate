// MEGGA Marketplace — Property X "👥 Avatars" styleguide section.
// Source : Figma node 11723:24553 — code Figma EXACT.
//
// Page UI Kit Avatars : shell partagé + 2 sections :
//   - Avatar Circle : 6 tailles (32/40/48/80/120/160px) avec photo John Carter
//   - Avatar Photos (replace) : 6 photos 200×200 (John, Sophie, Matt, Samantha, Will, Dylan)
//
// Photos téléchargées depuis Figma dans /public/images/avatars/.
// Note : will-green.png est blanc côté Figma source (asset défaillant — fidèle au design).

import { PX } from '..'
import PxStyleguideShell, { PxStyleguideSectionTitle } from './PxStyleguideShell'

const PHOTOS = [
  { key: 'john-carter',    name: 'John Carter' },
  { key: 'sophie-moore',   name: 'Sophie Moore' },
  { key: 'matt-cannon',    name: 'Matt Cannon' },
  { key: 'samantha-doyle', name: 'Samantha Doyle' },
  { key: 'will-green',     name: 'Will Green' },
  { key: 'dylan-smith',    name: 'Dylan Smith' },
] as const

const CIRCLE_SIZES = [32, 40, 48, 80, 120, 160] as const

// ─── Photo cropping wrapper (Figma utilise un crop avec inset/translateX) ─
// Original 960×1200 → on positionne pour cropper le bas (inset right-top-left)
// Pour les cercles, on fait un object-cover dans un container rond.

function AvatarCircle({ size, photoKey }: { size: number; photoKey: string }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: PX.radius.pill,
        background: PX.neutral300,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <img
        src={`/images/avatars/${photoKey}.png`}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center top',
          display: 'block',
        }}
      />
    </div>
  )
}

function AvatarSquare({ photoKey, name }: { photoKey: string; name: string }) {
  return (
    <div
      style={{
        width: 200,
        height: 200,
        background: PX.neutral300,
        overflow: 'hidden',
        flexShrink: 0,
      }}
      title={name}
    >
      <img
        src={`/images/avatars/${photoKey}.png`}
        alt={name}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center top',
          display: 'block',
        }}
      />
    </div>
  )
}

// ─── Showcase frame (cadre pointillé) ──────────────────────────────────
function Showcase({
  children,
  layout,
  nodeId,
}: {
  children: React.ReactNode
  layout: 'circles' | 'photos'
  nodeId: string
}) {
  return (
    <div
      data-node-id={nodeId}
      style={{
        background: PX.neutral100,
        border: `1.5px dashed ${PX.neutral500}`,
        borderRadius: PX.radius.large,
        boxShadow: PX.shadow.regular,
        padding: 48,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        // Cercles : space-between pour montrer la progression de tailles
        // Photos : gap fixe 24px
        justifyContent: layout === 'circles' ? 'space-between' : 'flex-start',
        rowGap: 24,
        columnGap: layout === 'circles' ? 0 : 24,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: '100%',
        gap: 40,
      }}
    >
      <PxStyleguideSectionTitle title={title} />
      {children}
    </div>
  )
}

export default function PxAvatarsStyleGuide() {
  return (
    <PxStyleguideShell selected="avatars" title="Avatars" iconName="avatars-regular">
      {/* ─── Avatar Circle (6 tailles, photo John Carter) ─── */}
      <Section title="Avatar Circle">
        <Showcase layout="circles" nodeId="11723:26229">
          {CIRCLE_SIZES.map(size => (
            <AvatarCircle key={size} size={size} photoKey="john-carter" />
          ))}
        </Showcase>
      </Section>

      {/* ─── Avatar Photos (replace) — 6 photos 200×200 ─── */}
      <Section title="Avatar Photos (replace)">
        <Showcase layout="photos" nodeId="11723:26227">
          {PHOTOS.map(p => (
            <AvatarSquare key={p.key} photoKey={p.key} name={p.name} />
          ))}
        </Showcase>
      </Section>
    </PxStyleguideShell>
  )
}
