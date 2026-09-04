/**
 * Banc de l'écran Messagerie (`/dev/messagerie`) : trois états — boîte pleine,
 * boîte vide, aucune boîte — sans réseau, les hooks étant remplacés par des
 * fixtures via `MailFixturesProvider` (T2.13).
 *
 * ⚠ DEV seulement (ternaire `import.meta.env.DEV` dans `App.tsx`) : un banc livré
 * est une surface que personne ne teste, ouverte à qui connaît l'URL
 * (`dev-bancs-frontiere.spec.ts`).
 */
import { useState } from 'react'
import { MessagerieApp } from '@/components/crm/messagerie/MessagerieApp'
import { MailFixturesProvider, type MailFixtureState } from '@/components/crm/messagerie/fixtures'

export default function MessagerieShowcasePage() {
  const [dark, setDark] = useState(false)
  const [state, setState] = useState<MailFixtureState>('full')
  return (
    <MailFixturesProvider state={state}>
      <div style={{ position: 'fixed', top: 8, right: 8, zIndex: 400, display: 'flex', gap: 'var(--crm-space-sm)' }}>
        {(['full', 'empty', 'none'] as MailFixtureState[]).map((s) => (
          <button key={s} onClick={() => setState(s)} style={{ fontWeight: s === state ? 600 : 400 }}>{s}</button>
        ))}
      </div>
      <MessagerieApp dark={dark} setDark={setDark} />
    </MailFixturesProvider>
  )
}
