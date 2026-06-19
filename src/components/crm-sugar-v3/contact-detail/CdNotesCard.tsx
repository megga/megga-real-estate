// MEGGA CRM Sugar v3 — Card Notes internes (éditable + persistance réelle)
// La note est éditée puis persistée dans `contacts.notes` via useUpdateContact.
// Monté avec `key={contact.id}` côté page → l'état se réinitialise par contact.

import { useState } from 'react'
import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import { KycBlackPill, KycGhostPill, KycSection } from '../primitives'
import { useUpdateContact } from '@/hooks/useContacts'

interface Props {
  contactId: string
  notes: string | null
}

export function CdNotesCard({ contactId, notes }: Props) {
  const [savedNotes, setSavedNotes] = useState<string | null>(notes)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(notes ?? '')
  const { mutateAsync, isPending } = useUpdateContact()

  const startEdit = () => {
    setDraft(savedNotes ?? '')
    setEditing(true)
  }
  const cancel = () => setEditing(false)
  const save = async () => {
    const value = draft.trim() || null
    await mutateAsync({ id: contactId, notes: value })
    setSavedNotes(value)
    setEditing(false)
  }

  return (
    <KycSection
      title="Notes internes"
      eyebrow="Privé · équipe MEGGA"
      action={
        editing ? null : (
          <KycGhostPill
            size="sm"
            onClick={startEdit}
            icon={<SgIcon name="pencil" size={13} stroke={SugarV3.inkSoft} />}
          >
            Modifier
          </KycGhostPill>
        )
      }
    >
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            placeholder="Note interne — visible par l'équipe MEGGA uniquement."
            style={{
              width: '100%',
              minHeight: 104,
              resize: 'vertical',
              padding: '16px 18px',
              borderRadius: 16,
              background: SugarV3.cardSubtle,
              border: '1px solid rgba(11,12,14,0.10)',
              outline: 'none',
              fontSize: 14,
              color: SugarV3.ink,
              fontWeight: 500,
              lineHeight: 1.6,
              letterSpacing: -0.1,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <KycGhostPill size="sm" onClick={cancel} disabled={isPending}>
              Annuler
            </KycGhostPill>
            <KycBlackPill size="md" onClick={save} disabled={isPending}>
              {isPending ? 'Enregistrement…' : 'Enregistrer'}
            </KycBlackPill>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: '18px 20px',
            borderRadius: 16,
            background: SugarV3.cardSubtle,
            fontSize: 14,
            color: SugarV3.inkSoft,
            fontWeight: 500,
            lineHeight: 1.6,
            letterSpacing: -0.1,
            whiteSpace: 'pre-wrap',
          }}
        >
          {savedNotes || 'Aucune note pour ce contact.'}
        </div>
      )}
    </KycSection>
  )
}
