/**
 * Banc de la console super-admin — `/dev/admin`, sans session.
 *
 * ── POURQUOI CETTE ROUTE EXISTE ──────────────────────────────────────────────
 * La console vit sous `/dashboard/admin/*`, donc DERRIÈRE DEUX MURS, pas un :
 *   1. `ProtectedRoute` — sans session il fait
 *      `window.location.replace('https://megga.ch/login')`, une redirection
 *      **absolue** vers la production. On est alors déposé sur `app.megga.ch`,
 *      qui sert `main`, en croyant regarder localhost : on relit l'ancienne
 *      version de son propre travail, et ça ne ressemble pas à une erreur.
 *   2. `useSuperAdminGate` — rend `<Navigate to="/dashboard" replace />`.
 * Aucune des 19 pages n'était donc regardable pendant qu'on la repeint.
 *
 * ── LE POINT D'INTERCEPTION DE LA NAVIGATION EST LE ROUTEUR ──────────────────
 * ⛔ Le banc du Pipeline a livré ce défaut : un clic sur une carte appelait
 * `navigate('/dashboard/transactions/…')` et déposait sur `megga.ch`. Il l'a
 * corrigé par un `onNavigate` passé à la page — un point de sortie qu'il faut
 * penser à câbler, surface par surface.
 *
 * Ici c'est un MEMORYROUTER, et c'est plus fort : mesuré, les 44 fichiers du
 * périmètre ne contiennent **aucun `window.location`** — les 19 sites de
 * navigation passent tous par React Router (`useNavigate`, `<Link>`,
 * `<NavLink>`). Un routeur mémoire les capture donc TOUS, y compris les trois
 * `navigate('/dashboard…')` d'`AdminShell`, sans qu'on ait rien à câbler et
 * sans toucher une ligne de production. Une cible hors console tombe sur
 * `SortieNeutralisee`, qui le DIT au lieu de quitter le domaine.
 *
 * ── LE POINT D'INJECTION DES DONNÉES EST `window.fetch` ──────────────────────
 * Les 19 pages ne partagent aucune couture de données : 38 hooks distincts,
 * 42 RPC, 18 tables, 5 edge functions. Leur donner un slot `banc` aurait demandé
 * 19 substitutions dans du code de production. Mais les 38 hooks passent tous
 * par le client `supabase`, dont le `global.fetch` (`authAwareFetch`) appelle le
 * `fetch` **global** au moment de l'appel : une seule interception les couvre.
 * C'est l'économie que le plan demandait de mesurer avant de la supposer.
 *
 * ⛔ Données de DÉMONSTRATION (`adminFixtures.ts`). Rien ne vient de la base,
 * aucun geste n'écrit. Une RPC sans fixture rend vide et est COMPTÉE dans les
 * commandes : un banc qui tronque en silence se lit « tout couvert ».
 *
 * ⚠ ROUTE CONDITIONNÉE AU MODE DEV, contrairement aux bancs `/dev/pipeline` ou
 * `/dev/biens`. Ceux-là montrent l'écran d'un agent ; celui-ci monte le chrome
 * de la PLATEFORME — badge « ADMIN », MRR, registre des agences, journal de
 * sécurité. Servir ça publiquement inviterait la question « est-ce réel ? » et
 * donnerait la carte complète de la surface super-admin à un visiteur. Même
 * arbitrage que `/dev/onboarding`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AdminThemeProvider, useAdminTheme } from '@/components/admin/AdminThemeProvider'
import AdminConsoleRoutes from '@/components/admin/AdminConsoleRoutes'
import { ADMIN_CONSOLE_PATH } from '@/lib/adminEntry'
import { crmSugarPalette } from '@/components/crm-sugar/tokens'
import { SUPABASE_FUNCTIONS_URL } from '@/lib/supabase'
import { RPC, TABLES, type AdminBancEtat } from './adminFixtures'

/* ─── Interception de `window.fetch` ──────────────────────────────────────── */

const BASE = SUPABASE_FUNCTIONS_URL.replace(/\/functions\/v1$/, '')
const REST = `${BASE}/rest/v1/`
const FN = `${BASE}/functions/v1/`

/**
 * État courant, lu par l'intercepteur à CHAQUE appel.
 *
 * ⚠ Une variable de module, pas une clôture : l'intercepteur est installé une
 * fois, et il doit répondre selon l'état choisi APRÈS son installation.
 */
const banc = {
  etat: 'nominal' as AdminBancEtat,
  /** Noms d'appels qu'aucune fixture ne couvre — remontés aux commandes. */
  signaler: (_appel: string) => {},
}

let fetchOrigine: typeof window.fetch | null = null

/** Corps JSON, avec les en-têtes que `supabase-js` sait lire. */
function json(corps: unknown, nombre: number): Response {
  return new Response(corps === undefined ? 'null' : JSON.stringify(corps), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-range': `0-${Math.max(0, nombre - 1)}/${nombre}`,
    },
  })
}

/** Échec côté serveur, dans la forme que PostgREST rend — pour l'état « Échec ». */
function echec(): Response {
  return new Response(
    JSON.stringify({ code: 'PGRST000', message: 'banc : échec simulé', details: null, hint: null }),
    { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } },
  )
}

/** Colonnes non lisibles telles quelles (`select` n'est pas appliqué : inutile ici). */
const PARAMS_HORS_FILTRE = new Set(['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'])

/** Valeur PostgREST : `"…"` quoté, `null`, sinon la chaîne brute. */
function valeur(v: string): unknown {
  const s = v.replace(/^"(.*)"$/, '$1')
  if (s === 'null') return null
  return s
}

/**
 * Applique les filtres et le tri de la requête aux lignes de la fixture.
 *
 * ⛔ SANS ÇA LE BANC MENT PAR EXCÈS. Le journal d'erreurs du Monitoring
 * interroge `activity_events` avec `action=eq.edge_function_error` ; en rendant
 * les huit événements quel que soit le filtre, il affichait des créations
 * d'agence dans une liste d'erreurs. Une fixture qui ignore le prédicat produit
 * un écran cohérent en apparence et faux en substance — la variante (e) des
 * pièges de sonde.
 *
 * Sous-ensemble volontaire : `eq`, `neq`, `gt(e)`, `lt(e)`, `in`, `is`, plus
 * `order` et `limit`. Un opérateur inconnu laisse passer la ligne plutôt que de
 * la retirer : mieux vaut un écran trop plein qu'un vide qu'on lirait comme un
 * bogue de la page.
 */
function filtrer(lignes: unknown[], requete: string): unknown[] {
  const p = new URLSearchParams(requete)
  let out = lignes as Record<string, unknown>[]

  for (const [col, expr] of p.entries()) {
    if (PARAMS_HORS_FILTRE.has(col)) continue
    const sep = expr.indexOf('.')
    if (sep < 0) continue
    const op = expr.slice(0, sep)
    const brut = expr.slice(sep + 1)
    out = out.filter((l) => {
      const v = l[col]
      switch (op) {
        case 'eq': return String(v) === String(valeur(brut))
        case 'neq': return String(v) !== String(valeur(brut))
        case 'gt': return String(v) > brut
        case 'gte': return String(v) >= brut
        case 'lt': return String(v) < brut
        case 'lte': return String(v) <= brut
        case 'is': return brut === 'null' ? v == null : v != null
        case 'in': return brut.replace(/^\(|\)$/g, '').split(',')
          .map((x) => String(valeur(x))).includes(String(v))
        default: return true
      }
    })
  }

  const ordre = p.get('order')
  if (ordre) {
    const [col, sens] = ordre.split('.')
    const desc = sens === 'desc'
    out = [...out].sort((a, b) => {
      const x = String(a[col!] ?? ''), y = String(b[col!] ?? '')
      return (x < y ? -1 : x > y ? 1 : 0) * (desc ? -1 : 1)
    })
  }

  const limite = Number(p.get('limit'))
  return Number.isFinite(limite) && limite > 0 ? out.slice(0, limite) : out
}

/** Arguments d'une RPC, lus dans le corps POST. `{}` si le corps n'est pas du JSON. */
function lireArguments(init?: RequestInit): Record<string, unknown> {
  if (typeof init?.body !== 'string') return {}
  try {
    const v: unknown = JSON.parse(init.body)
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  } catch { return {} }
}

/**
 * Réponse du banc pour une URL Supabase, ou `null` si l'appel ne le concerne pas
 * (l'appel part alors au vrai `fetch` — c'est le cas de `/auth/v1`).
 */
function repondre(url: string, init?: RequestInit): Response | null {
  const objetSeul = String(
    (init?.headers as Record<string, string> | undefined)?.Accept ??
    (init?.headers as Record<string, string> | undefined)?.accept ?? '',
  ).includes('vnd.pgrst.object')

  if (url.startsWith(FN)) {
    if (banc.etat === 'erreur') return echec()
    return json({ ok: true, banc: true }, 1)
  }

  if (!url.startsWith(REST)) return null
  if (banc.etat === 'erreur') return echec()

  const [chemin = '', requete = ''] = url.slice(REST.length).split('?')

  if (chemin.startsWith('rpc/')) {
    const nom = chemin.slice(4)
    const brut = Object.prototype.hasOwnProperty.call(RPC, nom) ? RPC[nom] : undefined
    if (brut === undefined) banc.signaler(`rpc/${nom}`)
    // Une fixture peut être une FONCTION des arguments : la fiche agence doit
    // rendre l'agence demandée, sinon l'en-tête contredit la ligne cliquée.
    const fixture = typeof brut === 'function'
      ? (brut as (a: Record<string, unknown>) => unknown)(lireArguments(init))
      : brut
    const valeur = banc.etat === 'vide'
      ? (Array.isArray(fixture) ? [] : null)
      : (fixture ?? (objetSeul ? null : []))
    const n = Array.isArray(valeur) ? valeur.length : 1
    return json(objetSeul && Array.isArray(valeur) ? (valeur[0] ?? null) : valeur, n)
  }

  const lignes = Object.prototype.hasOwnProperty.call(TABLES, chemin) ? TABLES[chemin]! : undefined
  if (lignes === undefined) banc.signaler(chemin)
  const sortie = banc.etat === 'vide' ? [] : filtrer(lignes ?? [], requete)
  return json(objetSeul ? (sortie[0] ?? null) : sortie, sortie.length)
}

/**
 * Installe l'intercepteur. Idempotent : `useState(initialiseur)` est
 * ré-exécuté par StrictMode, et une seconde enveloppe autour de la première
 * ferait de l'origine sauvegardée… l'intercepteur lui-même.
 */
function installer() {
  if (fetchOrigine) return
  fetchOrigine = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const reponse = repondre(url, init)
    if (reponse) return reponse
    return fetchOrigine!(input, init)
  }
}

function desinstaller() {
  if (!fetchOrigine) return
  window.fetch = fetchOrigine
  fetchOrigine = null
}

/* ─── Chrome du banc ──────────────────────────────────────────────────────── */

const ETATS: { id: AdminBancEtat; label: string; titre: string }[] = [
  { id: 'nominal', label: 'Nominal', titre: '5 agences, 5 comptes, journal à 8 lignes, 1 cron en échec' },
  { id: 'vide', label: 'Vide', titre: 'Chaque source rend zéro ligne — les 19 états vides (AdminEmpty)' },
  { id: 'erreur', label: 'Échec', titre: 'Chaque source rend 500 — les 19 branches d’erreur (AdminError)' },
]

/**
 * Commandes repliables, en bas à droite.
 *
 * ⛔ Un banc qui CACHE une surface ne la vérifie pas : posées à demeure, elles
 * recouvrent le pied des tableaux les plus longs. Elles se replient.
 */
function Commandes({ etat, setEtat, sansFixture }: {
  etat: AdminBancEtat
  setEtat: (e: AdminBancEtat) => void
  sansFixture: string[]
}) {
  const { dark } = useAdminTheme()
  const [replie, setReplie] = useState(false)
  const sp = crmSugarPalette(dark)

  const pilule = (actif: boolean) => ({
    border: 0, cursor: 'pointer', fontFamily: 'inherit',
    padding: 'var(--crm-space-xs) var(--crm-space-lg)',
    borderRadius: 'var(--crm-radius-pill)',
    fontSize: 'var(--crm-text-sm)', fontWeight: 600,
    background: actif ? sp.accent : 'transparent',
    color: actif ? sp.accentInk : sp.sub,
    whiteSpace: 'nowrap' as const,
  })
  const groupe = {
    display: 'inline-flex', gap: 'var(--crm-space-2xs)',
    background: sp.solidBg, borderRadius: 'var(--crm-radius-pill)',
    padding: 'var(--crm-space-2xs)', border: `1px solid ${sp.cardBorder}`,
  }

  return (
    <div style={{
      position: 'fixed', bottom: 14, right: 14, zIndex: 9500,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
      gap: 'var(--crm-space-2xs)',
    }}>
      {!replie && (
        <>
          <div style={groupe}>
            {ETATS.map((e) => (
              <button key={e.id} type="button" title={e.titre}
                onClick={() => setEtat(e.id)} aria-pressed={etat === e.id}
                style={pilule(etat === e.id)}>{e.label}</button>
            ))}
          </div>
          {sansFixture.length > 0 && (
            // ⚠ Un banc qui borne sa couverture doit le DIRE : une troncature
            // silencieuse se lit « tout couvert ».
            <div
              title={sansFixture.join('\n')}
              style={{
                ...groupe, padding: 'var(--crm-space-2xs) var(--crm-space-lg)',
                fontSize: 'var(--crm-text-xs)', color: sp.sub, maxWidth: 320,
              }}>
              {sansFixture.length} appel{sansFixture.length > 1 ? 's' : ''} sans fixture → vide
            </div>
          )}
        </>
      )}
      <button
        type="button"
        onClick={() => setReplie((v) => !v)}
        aria-expanded={!replie}
        title={replie ? 'Déplier les commandes du banc' : 'Replier — dégage le coin bas-droit'}
        style={{
          border: 0, cursor: 'pointer', fontFamily: 'inherit',
          padding: 'var(--crm-space-2xs) var(--crm-space-lg)',
          borderRadius: 'var(--crm-radius-pill)', background: sp.accent, color: sp.accentInk,
          fontSize: 'var(--crm-text-xs)', fontWeight: 600,
        }}>
        {replie ? 'Aperçu ▸' : 'Aperçu · données de démonstration'}
      </button>
    </div>
  )
}

/**
 * Ce que le banc rend quand la console vise une cible hors d'elle-même.
 *
 * C'est la SEULE sortie possible : le routeur mémoire n'a que deux routes. Elle
 * le dit et propose le retour, au lieu d'éjecter en production.
 */
function SortieNeutralisee() {
  const navigate = useNavigate()
  const { dark } = useAdminTheme()
  const sp = crmSugarPalette(dark)
  return (
    <div style={{
      height: '100vh', display: 'grid', placeItems: 'center',
      background: sp.pageBg, color: sp.ink, textAlign: 'center', padding: 24,
    }}>
      <div style={{ maxWidth: 460, display: 'grid', gap: 'var(--crm-space-lg)' }}>
        <p style={{ margin: 0, fontSize: 'var(--crm-text-3xl)', fontWeight: 600 }}>
          Sortie neutralisée
        </p>
        <p style={{ margin: 0, fontSize: 'var(--crm-text-lg)', color: sp.sub, lineHeight: 1.5 }}>
          La console a visé une cible hors d’elle-même. En production ce lien mène
          au CRM ; ici il ne quitte pas le banc.
        </p>
        <div>
          <button type="button" onClick={() => navigate(ADMIN_CONSOLE_PATH)} style={{
            border: 0, cursor: 'pointer', fontFamily: 'inherit',
            padding: 'var(--crm-space-lg) var(--crm-space-2xl)',
            borderRadius: 'var(--crm-radius-pill)',
            background: sp.accent, color: sp.accentInk,
            fontSize: 'var(--crm-text-lg)', fontWeight: 600,
          }}>Revenir à la console</button>
        </div>
      </div>
    </div>
  )
}

/** Corps du banc — sous le provider de thème, donc `useAdminTheme` y est légal. */
function Banc({ etat, setEtat, sansFixture }: {
  etat: AdminBancEtat
  setEtat: (e: AdminBancEtat) => void
  sansFixture: string[]
}) {
  return (
    <>
      <Routes>
        <Route path={`${ADMIN_CONSOLE_PATH}/*`} element={<AdminConsoleRoutes />} />
        <Route path="*" element={<SortieNeutralisee />} />
      </Routes>
      <Commandes etat={etat} setEtat={setEtat} sansFixture={sansFixture} />
    </>
  )
}

export default function AdminShowcasePage() {
  const [etat, setEtatLocal] = useState<AdminBancEtat>('nominal')
  const [sansFixture, setSansFixture] = useState<string[]>([])
  const vus = useRef(new Set<string>())
  const qc = useQueryClient()

  // ⚠ Installé PENDANT le rendu du banc, donc AVANT que la console monte et
  // lance ses requêtes. Un effet arriverait après le premier `queryFn`.
  useState(() => {
    banc.signaler = (appel) => {
      if (vus.current.has(appel)) return
      vus.current.add(appel)
      setSansFixture([...vus.current].sort())
    }
    installer()
    return true
  })
  // ⛔ ET IL FAUT RÉINSTALLER ICI, sinon le banc part en production sans le
  // savoir. StrictMode monte, DÉMONTE, remonte : le nettoyage désinstallait
  // l'intercepteur, et l'initialiseur de `useState` ne rejoue PAS au remontage
  // (l'état survit). Mesuré à l'écran — les 42 RPC partaient vers la vraie base,
  // qui répondait 401, et la Vue d'ensemble restait sur son squelette.
  useEffect(() => {
    installer()
    return desinstaller
  }, [])

  const setEtat = useCallback((e: AdminBancEtat) => {
    banc.etat = e
    setEtatLocal(e)
    // Les requêtes actives repartent avec la nouvelle réponse ; on ne remonte
    // pas l'arbre, sinon changer d'état ramènerait à l'accueil de la console.
    void qc.resetQueries()
  }, [qc])

  const entrees = useMemo(() => [ADMIN_CONSOLE_PATH], [])

  return (
    <MemoryRouter initialEntries={entrees}>
      <AdminThemeProvider>
        <Banc etat={etat} setEtat={setEtat} sansFixture={sansFixture} />
      </AdminThemeProvider>
    </MemoryRouter>
  )
}
