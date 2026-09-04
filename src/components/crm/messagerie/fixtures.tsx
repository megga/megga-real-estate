/**
 * Données du banc `/dev/messagerie`.
 *
 * ⚠ Squelette de la tâche 2.1 : seul le CONTEXTE d'état existe (le banc bascule
 * entre « boîte pleine », « boîte vide » et « aucune boîte »). Les fixtures
 * elles-mêmes — et le remplacement des hooks par ces fixtures — arrivent en
 * T2.13.
 *
 * ⛔ Rien n'y ressemblera jamais à une vraie fiche : adresses en `@exemple.ch`,
 * noms de scène. Une donnée d'exemple qui a l'air vraie finit citée comme vraie.
 *
 * ⚠ Extension `.tsx` et non `.ts` comme l'annonçait la table du lot : le
 * fournisseur rend du JSX, qu'un `.ts` refuse de compiler.
 */
import { createContext, type ReactNode } from 'react'

export type MailFixtureState = 'full' | 'empty' | 'none'

const MailFixturesContext = createContext<MailFixtureState | null>(null)

/** Enveloppe le banc : les hooks liront cet état en T2.13 au lieu du réseau. */
export function MailFixturesProvider({ state, children }: { state: MailFixtureState; children: ReactNode }) {
  return <MailFixturesContext.Provider value={state}>{children}</MailFixturesContext.Provider>
}
