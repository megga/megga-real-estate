// MEGGA Marketplace — Property X "📱 Icon font" styleguide section.
// Source : Figma node 11723:20206 — code Figma EXACT.
//
// Page UI Kit Icon Font : shell partagé + 4 showcases avec chaque icône en SVG
// individuel téléchargé depuis Figma :
//   - Line Icons Rounded   (230 icônes, node 11723:20375)
//   - Line Icons Squared   (230 icônes, node 11723:22666)
//   - Filled Icons         (161 icônes, node 11723:22667)
//   - Social Media Icon    (34 icônes,  node 11723:23222)
//
// Total : 655 SVGs individuels dans /public/icons/figma/icon-fonts/<style>/<name>.svg
// Chacune a fill/stroke = currentColor pour pouvoir être recoloriée.

import { PX } from '..'
import PxStyleguideShell, { PxStyleguideSectionTitle } from './PxStyleguideShell'
import { LINE_ROUNDED_ICONS, LINE_SQUARED_ICONS, FILLED_ICONS, SOCIAL_ICONS } from './iconFontsNames'

// ─── Single icon cell (20×20) ─────────────────────────────────────────
function IconCell({ src, name }: { src: string; name: string }) {
  return (
    <span
      title={name}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 20,
        height: 20,
        color: PX.neutral700,
        flexShrink: 0,
      }}
    >
      <img
        src={src}
        alt={name}
        style={{ width: 20, height: 20, objectFit: 'contain', display: 'block' }}
      />
    </span>
  )
}

// ─── Section showcase (cadre pointillé + grille flex-wrap d'icônes) ────
function IconsShowcase({
  folder,
  names,
  nodeId,
}: {
  folder: string
  names: ReadonlyArray<string>
  nodeId: string
}) {
  return (
    <div
      data-node-id={nodeId}
      style={{
        background: PX.neutral300,
        border: `1.5px dashed ${PX.neutral500}`,
        borderRadius: PX.radius.large,
        boxShadow: PX.shadow.regular,
        padding: 48,                          // numbers/spacings/xxx-large
        display: 'flex',
        flexWrap: 'wrap',
        gap: 24,                              // numbers/spacings/x-large
        alignItems: 'center',
        width: '100%',
        maxWidth: 1054,
        boxSizing: 'border-box',
      }}
    >
      {names.map(name => (
        <IconCell key={name} src={`/icons/figma/icon-fonts/${folder}/${name}.svg`} name={name} />
      ))}
    </div>
  )
}

// ─── Section wrapper (titre + showcase) ───────────────────────────────
function Section({
  title,
  folder,
  names,
  nodeId,
}: {
  title: string
  folder: string
  names: ReadonlyArray<string>
  nodeId: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: '100%',
        gap: 24,
      }}
    >
      <PxStyleguideSectionTitle title={title} />
      <IconsShowcase folder={folder} names={names} nodeId={nodeId} />
    </div>
  )
}

export default function PxIconFontsStyleGuide() {
  return (
    <PxStyleguideShell selected="iconfonts" title="Icon Font" iconName="iconfonts">
      <Section
        title="Line Icons Rounded"
        folder="line-rounded"
        names={LINE_ROUNDED_ICONS}
        nodeId="11723:20375"
      />
      <Section
        title="Line Icons Squared"
        folder="line-squared"
        names={LINE_SQUARED_ICONS}
        nodeId="11723:22666"
      />
      <Section
        title="Filled Icons"
        folder="filled"
        names={FILLED_ICONS}
        nodeId="11723:22667"
      />
      <Section
        title="Social Media Icon"
        folder="social"
        names={SOCIAL_ICONS}
        nodeId="11723:23222"
      />
    </PxStyleguideShell>
  )
}
