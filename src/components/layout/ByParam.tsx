/**
 * Force le remontage d'une feuille dont l'IDENTITÉ vient de l'URL.
 *
 * Sans clé sur `<Routes>` — et il ne faut PAS en remettre, cf. l'en-tête de
 * `App.tsx` — passer de `/dashboard/contacts/a` à `.../b` garde le même élément
 * monté : seuls les params changent, et l'état local de la page (brouillons
 * d'édition, page du pager, message de confirmation, défilement) survit d'une
 * fiche à l'autre. On rétablit ici la sémantique d'avant, mais SEULEMENT sur la
 * feuille — donc sans remonter le shell ni la frontière Suspense, qui sont
 * précisément ce qui rend la transition douce.
 *
 * ⚠ Vit dans son propre fichier depuis que la console super-admin en a besoin
 * elle aussi : elle est montée sous `/dashboard/admin/*` avec son propre
 * `<Routes>`, et sa fiche agence (`agencies/:id`) portait un message de flash et
 * l'ouverture d'une modale de confirmation qui traversaient le changement
 * d'agence. Le laisser privé à `App.tsx` aurait imposé d'importer depuis `App`,
 * donc un cycle d'imports (App → AdminConsoleRoute → AdminConsoleRoutes → App).
 */
import { Fragment } from 'react'
import { useParams } from 'react-router-dom'

/** Enveloppe une feuille de route : elle se remonte dès qu'un param change. */
export default function ByParam({ children }: { children: React.ReactNode }) {
  const params = useParams()
  return <Fragment key={Object.values(params).join('/')}>{children}</Fragment>
}
