/**
 * Banc de l'écran Messagerie (`/dev/messagerie`) : trois états — boîte pleine,
 * boîte vide, aucune boîte — servis par `fixtures.ts` au lieu du réseau.
 *
 * ⛔ AVANT T2.13, CE BANC NE MONTRAIT RIEN. Sans session, `useMailAccounts` est
 * `enabled: !!user`, une requête désactivée reste `isPending` pour toujours en
 * TanStack v5, et `MessagerieApp` rend `null` tant que `accounts.isLoading`. Les
 * trois boutons basculaient un contexte que personne ne lisait. C'est réparé :
 * les cinq hooks de lecture répondent depuis les fixtures.
 *
 * ⚠ DEV seulement (ternaire `import.meta.env.DEV` dans `App.tsx`) : un banc livré
 * est une surface que personne ne teste, ouverte à qui connaît l'URL
 * (`dev-bancs-frontiere.spec.ts`).
 *
 * ⚠ Le sélecteur porte `data-mail-fixture-state` : c'est par lui que la capture
 * de régression visuelle sait quel état elle photographie, et non par sa
 * position dans une rangée de boutons.
 */
import { useState } from 'react'
import { MessagerieApp } from '@/components/crm/messagerie/MessagerieApp'
import { MailFixturesContext, type MailFixtureState } from '@/components/crm/messagerie/fixtures'

const ETATS: MailFixtureState[] = ['full', 'empty', 'none']

export default function MessagerieShowcasePage() {
  const [dark, setDark] = useState(false)
  const [state, setState] = useState<MailFixtureState>('full')
  return (
    <MailFixturesContext.Provider value={state}>
      <div
        data-mail-fixture-state={state}
        style={{ position: 'fixed', top: 8, right: 8, zIndex: 400, display: 'flex', gap: 'var(--crm-space-sm)' }}
      >
        {ETATS.map((s) => (
          <button key={s} type="button" onClick={() => setState(s)} style={{ fontWeight: s === state ? 600 : 400 }}>{s}</button>
        ))}
      </div>
      {/* La clé remonte l'écran à chaque bascule : `MessagerieApp` garde la boîte
          courante dans son reducer, et « aucune boîte » aurait laissé la
          sélection de l'état précédent pointer sur un compte disparu. */}
      <MessagerieApp key={state} dark={dark} setDark={setDark} />
    </MailFixturesContext.Provider>
  )
}
