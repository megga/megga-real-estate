// MEGGA Marketplace — Property X "📨 Inputs" styleguide section.
// Source : Figma node 11723:27991 — code Figma EXACT.
//
// Page UI Kit Inputs : shell partagé + 7 sections :
//   - Input Text (2 variants : dark+button / light)
//   - Select
//   - Text Area (avec pencil icon)
//   - Checkboxes (4 standalone + 4 avec labels)
//   - Radio Buttons (idem)
//   - Toggle Button (idem)
//   - Upload (2 variants : filled / outline)
//
// Réutilise PxInput, PxSelect, PxTextArea, PxCheckbox, PxRadio, PxToggle, PxUploadCard.

import { useState } from 'react'
import {
  PX,
  PxInput,
  PxSelect,
  PxTextArea,
  PxCheckbox,
  PxRadio,
  PxToggle,
  PxButton,
  PxFigmaIcon,
  PxUploadCard,
} from '..'
import PxStyleguideShell, { PxStyleguideSectionTitle } from './PxStyleguideShell'

// ─── Showcase frame (cadre pointillé) ──────────────────────────────────
function Showcase({
  children,
  width,
  flex,
  nodeId,
}: {
  children: React.ReactNode
  width?: number | string
  flex?: 'row' | 'col'
  nodeId?: string
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
        flexDirection: flex === 'col' ? 'column' : 'row',
        flexWrap: 'wrap',
        gap: 24,
        alignItems: 'center',
        justifyContent: 'flex-start',
        width: width ?? '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', gap: 24 }}>
      <PxStyleguideSectionTitle title={title} />
      {children}
    </div>
  )
}

// ─── Composant principal ────────────────────────────────────────────────
export default function PxInputsStyleGuide() {
  // États pour rendre les composants interactifs/visibles dans les 2 états
  const [text1, setText1] = useState('')
  const [text2, setText2] = useState('')
  const [textarea, setTextarea] = useState('')
  const [select, setSelect] = useState('')

  // Checkboxes
  const [cbSmChecked, setCbSmChecked] = useState(true)
  const [cbSmUnchecked, setCbSmUnchecked] = useState(false)
  const [cbLgChecked, setCbLgChecked] = useState(true)
  const [cbLgUnchecked, setCbLgUnchecked] = useState(false)

  // Radios
  const [rdSmChecked, setRdSmChecked] = useState(true)
  const [rdSmUnchecked, setRdSmUnchecked] = useState(false)
  const [rdLgChecked, setRdLgChecked] = useState(true)
  const [rdLgUnchecked, setRdLgUnchecked] = useState(false)

  // Toggles
  const [tgSmChecked, setTgSmChecked] = useState(true)
  const [tgSmUnchecked, setTgSmUnchecked] = useState(false)
  const [tgLgChecked, setTgLgChecked] = useState(true)
  const [tgLgUnchecked, setTgLgUnchecked] = useState(false)

  return (
    <PxStyleguideShell selected="inputs" title="Inputs" iconName="inputs-regular">
      {/* ─── Input Text — 2 variants ─── */}
      <Section title="Input Text">
        <Showcase>
          {/* Dark variant + bouton Default à droite */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <PxInput
              variant="dark"
              value={text1}
              onChange={e => setText1(e.target.value)}
              placeholder="Placeholder"
              rightSlot={
                <PxButton variant="invert" size="sm">Default</PxButton>
              }
            />
          </div>
          {/* Light variant */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <PxInput
              variant="light"
              value={text2}
              onChange={e => setText2(e.target.value)}
              placeholder="Placeholder"
            />
          </div>
        </Showcase>
      </Section>

      {/* ─── Select ─── */}
      <Section title="Select">
        <Showcase>
          <div style={{ width: 360 }}>
            <PxSelect value={select} onChange={e => setSelect(e.target.value)}>
              <option value="">Placeholder</option>
              <option value="1">Option 1</option>
              <option value="2">Option 2</option>
            </PxSelect>
          </div>
        </Showcase>
      </Section>

      {/* ─── Text Area ─── */}
      <Section title="Text Area">
        <Showcase>
          <div style={{ flex: 1, minWidth: 320 }}>
            <PxTextArea
              value={textarea}
              onChange={e => setTextarea(e.target.value)}
              placeholder="Placeholder"
              leftIcon={<PxFigmaIcon name="form-edit" size={16} color={PX.neutral500} />}
              rows={4}
            />
          </div>
        </Showcase>
      </Section>

      {/* ─── Checkboxes + Radio + Toggle — 3 colonnes ─── */}
      <div style={{ display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <PxStyleguideSectionTitle title="Checkboxes" />
          <Showcase flex="col">
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <PxCheckbox size="sm" checked={cbSmChecked} onChange={setCbSmChecked} />
              <PxCheckbox size="sm" checked={cbSmUnchecked} onChange={setCbSmUnchecked} />
              <PxCheckbox size="lg" checked={cbLgChecked} onChange={setCbLgChecked} />
              <PxCheckbox size="lg" checked={cbLgUnchecked} onChange={setCbLgUnchecked} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <PxCheckbox size="sm" checked={true} onChange={() => {}} label="Placeholder" />
              <PxCheckbox size="sm" checked={true} onChange={() => {}} label="Placeholder" />
              <PxCheckbox size="lg" checked={false} onChange={() => {}} label="Placeholder" />
              <PxCheckbox size="lg" checked={false} onChange={() => {}} label="Placeholder" />
            </div>
          </Showcase>
        </div>

        <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <PxStyleguideSectionTitle title="Radio Buttons" />
          <Showcase flex="col">
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <PxRadio size="sm" checked={rdSmChecked} onChange={() => setRdSmChecked(true)} name="rd-1" />
              <PxRadio size="sm" checked={rdSmUnchecked} onChange={() => setRdSmUnchecked(true)} name="rd-2" />
              <PxRadio size="lg" checked={rdLgChecked} onChange={() => setRdLgChecked(true)} name="rd-3" />
              <PxRadio size="lg" checked={rdLgUnchecked} onChange={() => setRdLgUnchecked(true)} name="rd-4" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <PxRadio size="sm" checked={true} onChange={() => {}} name="rdl-1" label="Placeholder" />
              <PxRadio size="sm" checked={true} onChange={() => {}} name="rdl-2" label="Placeholder" />
              <PxRadio size="lg" checked={false} onChange={() => {}} name="rdl-3" label="Placeholder" />
              <PxRadio size="lg" checked={false} onChange={() => {}} name="rdl-4" label="Placeholder" />
            </div>
          </Showcase>
        </div>

        <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <PxStyleguideSectionTitle title="Toggle Button" />
          <Showcase flex="col">
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <PxToggle size="sm" checked={tgSmChecked} onChange={setTgSmChecked} />
              <PxToggle size="sm" checked={tgSmUnchecked} onChange={setTgSmUnchecked} />
              <PxToggle size="lg" checked={tgLgChecked} onChange={setTgLgChecked} />
              <PxToggle size="lg" checked={tgLgUnchecked} onChange={setTgLgUnchecked} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <PxToggle size="sm" checked={true} onChange={() => {}} label="Placeholder" />
              <PxToggle size="sm" checked={true} onChange={() => {}} label="Placeholder" />
              <PxToggle size="lg" checked={false} onChange={() => {}} label="Placeholder" />
              <PxToggle size="lg" checked={false} onChange={() => {}} label="Placeholder" />
            </div>
          </Showcase>
        </div>
      </div>

      {/* ─── Upload — 2 variants ─── */}
      <Section title="Upload">
        <Showcase>
          <div style={{ flex: 1, minWidth: 280 }}>
            <PxUploadCard
              variant="filled"
              title="Select a file to upload"
              hint="Or drag and drop it here"
              buttonLabel="Upload file"
            />
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <PxUploadCard
              variant="outline"
              title="Select a file to upload"
              hint="Or drag and drop it here"
              buttonLabel="Upload file"
            />
          </div>
        </Showcase>
      </Section>
    </PxStyleguideShell>
  )
}
