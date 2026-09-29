/**
 * Banc du studio Labs (`/dev/labs`) : quatre états — studio garni, studio vide,
 * erreur de lecture, plan Starter (studio fermé) — servis par `labs/fixtures.ts` au lieu du réseau, et les gestes
 * (dossier, image, vidéo qui aboutit en six secondes) appliqués en mémoire.
 *
 * ⚠ DEV seulement (ternaire `import.meta.env.DEV` dans `App.tsx`) : un banc livré est
 * une surface que personne ne teste, ouverte à qui connaît l'URL
 * (`dev-bancs-frontiere.spec.ts`).
 */
import { useState } from 'react'
import { LabsApp } from '@/components/crm/labs/LabsApp'
import { LabsFixturesContext, type LabsFixtureState } from '@/components/crm/labs/fixtures'

const ETATS: LabsFixtureState[] = ['full', 'empty', 'error', 'starter']

export default function LabsShowcasePage() {
  const [dark, setDark] = useState(false)
  const [state, setState] = useState<LabsFixtureState>('full')
  return (
    <LabsFixturesContext.Provider value={state}>
      <div
        data-labs-fixture-state={state}
        style={{ position: 'fixed', top: 8, right: 8, zIndex: 400, display: 'flex', gap: 'var(--crm-space-sm)' }}
      >
        {ETATS.map((s) => (
          <button key={s} type="button" onClick={() => setState(s)} style={{ fontWeight: s === state ? 600 : 400 }}>{s}</button>
        ))}
        <button type="button" onClick={() => setDark((d) => !d)}>{dark ? 'light' : 'dark'}</button>
      </div>
      <LabsApp key={state} dark={dark} setDark={setDark} />
    </LabsFixturesContext.Provider>
  )
}
