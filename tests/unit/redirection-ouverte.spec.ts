/**
 * Redirection ouverte — garde-fou par les PUITS, pas par les noms de paramètre.
 *
 * POURQUOI LES PUITS. Un premier jet de ce garde-fou cherchait `.get('returnTo')`
 * et une douzaine d'autres noms anglais. Il était contournable par construction :
 * guillemets doubles, clé en constante, `Object.fromEntries(searchParams)`,
 * `location.state`… et par TOUS les noms français de ce dépôt (`retour`, `cible`,
 * `suite`). Le côté puits, lui, est petit et FERMÉ : `navigate(`, `<Navigate to>`,
 * `<Link to>`, `location.assign/replace/href`, `window.open`. Chaque puits dont la
 * cible n'est pas ancrée dans le code (littéral, chemin commençant par `/x`,
 * ternaire de littéraux) est inscrit ci-dessous avec la RAISON pour laquelle sa
 * valeur est sûre. Le premier puits dynamique nouveau fait rougir le test, quel
 * que soit le nom de la variable qui l'alimente.
 *
 * Rappel de l'enjeu (src/lib/safeInternalPath.ts) : `navigate()` n'est pas
 * confiné à l'origine — quand pushState jette, @remix-run/router retombe sur
 * `window.location.assign`, qui suit `//hote` et exécute `javascript:`.
 *
 * Filet secondaire : toute lecture d'un paramètre au nom « de retour » (anglais
 * ET français, guillemets simples ET doubles) passe par `safeInternalPath(`, ou
 * figure dans une exemption nommée.
 */
import { describe, it, expect } from 'vitest'
import { scanRoots, readFileSafely, rel, emptyRoots } from './helpers/fs-scan'

// ─── Lecture du source : commentaires blanchis, chaînes préservées ──────────

/** Index du guillemet fermant de la chaîne ouverte en `i` (gabarits `${}` imbriqués compris). */
function finChaine(s: string, i: number): number {
  const q = s[i]
  let j = i + 1
  while (j < s.length) {
    const c = s[j]
    if (c === '\\') { j += 2; continue }
    if (c === q) return j
    if (q === '`' && c === '$' && s[j + 1] === '{') {
      let prof = 1
      j += 2
      while (j < s.length && prof > 0) {
        const d = s[j]
        if (d === "'" || d === '"' || d === '`') { j = finChaine(s, j) + 1; continue }
        if (d === '{') prof++
        else if (d === '}') prof--
        j++
      }
      continue
    }
    j++
  }
  return s.length - 1
}

/** Après quel caractère un `/` ouvre une regex littérale (heuristique usuelle). */
const AVANT_REGEX = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^', ''])

/** Index du `/` fermant d'une regex littérale ouverte en `i`. */
function finRegex(s: string, i: number): number {
  let j = i + 1
  let classe = false
  while (j < s.length && s[j] !== '\n') {
    const c = s[j]
    if (c === '\\') { j += 2; continue }
    if (c === '[') classe = true
    else if (c === ']') classe = false
    else if (c === '/' && !classe) return j
    j++
  }
  return i // pas une regex : on ne saute rien
}

/**
 * Blanchit les commentaires en gardant les positions (sauts de ligne compris),
 * et laisse chaînes, gabarits et regex INTACTS : l'argument d'un puits en a besoin
 * pour être classé, et un `//` dans `https://…` n'est pas un commentaire.
 */
function sansCommentaires(s: string): string {
  let out = ''
  let i = 0
  let precedent = ''
  while (i < s.length) {
    const c = s[i]
    const d = s[i + 1]
    if (c === '/' && d === '/') {
      while (i < s.length && s[i] !== '\n') { out += ' '; i++ }
      continue
    }
    if (c === '/' && d === '*') {
      while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) { out += s[i] === '\n' ? '\n' : ' '; i++ }
      out += '  '
      i += 2
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      const fin = finChaine(s, i)
      out += s.slice(i, fin + 1)
      i = fin + 1
      precedent = c
      continue
    }
    if (c === '/' && (AVANT_REGEX.has(precedent) || /\breturn$/.test(out.trimEnd()))) {
      const fin = finRegex(s, i)
      if (fin > i) {
        out += s.slice(i, fin + 1)
        i = fin + 1
        precedent = '/'
        continue
      }
    }
    out += c
    if (!/\s/.test(c)) precedent = c
    i++
  }
  return out
}

/** Premier argument de l'appel dont la parenthèse ouvrante est en `ouvrante`. */
function premierArgument(s: string, ouvrante: number): string {
  let prof = 0
  for (let i = ouvrante + 1; i < s.length; i++) {
    const c = s[i]
    if (c === "'" || c === '"' || c === '`') { i = finChaine(s, i); continue }
    if (c === '(' || c === '[' || c === '{') prof++
    else if (c === ')' || c === ']' || c === '}') {
      if (prof === 0) return s.slice(ouvrante + 1, i).trim()
      prof--
    } else if (c === ',' && prof === 0) return s.slice(ouvrante + 1, i).trim()
  }
  return s.slice(ouvrante + 1).trim()
}

/** Le contenu de l'accolade JSX ouverte en `ouvrante` (`to={…}`). */
function contenuAccolade(s: string, ouvrante: number): string {
  let prof = 0
  for (let i = ouvrante; i < s.length; i++) {
    const c = s[i]
    if (c === "'" || c === '"' || c === '`') { i = finChaine(s, i); continue }
    if (c === '{') prof++
    else if (c === '}') { prof--; if (prof === 0) return s.slice(ouvrante + 1, i).trim() }
  }
  return s.slice(ouvrante + 1).trim()
}

/** Découpe un ternaire de premier niveau `a ? b : c`, ou null. */
function ternaire(a: string): [string, string] | null {
  let prof = 0
  let q = -1
  let imbrique = 0
  for (let i = 0; i < a.length; i++) {
    const c = a[i]
    if (c === "'" || c === '"' || c === '`') { i = finChaine(a, i); continue }
    if (c === '(' || c === '[' || c === '{') prof++
    else if (c === ')' || c === ']' || c === '}') prof--
    else if (prof === 0 && c === '?' && a[i + 1] !== '.' && a[i + 1] !== '?' && a[i - 1] !== '?') {
      if (q < 0) q = i
      else imbrique++
    } else if (prof === 0 && c === ':' && q >= 0) {
      if (imbrique === 0) return [a.slice(q + 1, i).trim(), a.slice(i + 1).trim()]
      imbrique--
    }
  }
  return null
}

/**
 * Vrai si la cible est ANCRÉE dans le code : ce que le navigateur en fera ne
 * dépend d'aucune donnée. Le critère porte sur le DÉBUT de la valeur, parce que
 * c'est lui qui décide de l'origine : `/x…` (x ni `/` ni `\`) reste sur place quoi
 * qu'il suive ; `mailto:` et `tel:` fixent leur schéma ; `https://hôte/` son hôte.
 */
function cibleAncree(brut: string): boolean {
  let a = brut.trim()
  while (a.startsWith('(') && a.endsWith(')')) a = a.slice(1, -1).trim()
  if (/^-?\d+$/.test(a)) return true // navigate(-1)
  const t = ternaire(a)
  if (t) return cibleAncree(t[0]) && cibleAncree(t[1])
  if (/^'([^'\\]|\\.)*'$/.test(a) || /^"([^"\\]|\\.)*"$/.test(a)) return true // littéral entier
  const q = a[0]
  if (q !== "'" && q !== '"' && q !== '`') return false
  const debut = a.slice(1)
  if (/^\/[^/\\$`'"]/.test(debut)) return true
  if (/^(mailto|tel):/.test(debut)) return true
  if (/^https:\/\/[a-z0-9.-]+\//i.test(debut)) return true
  // Préfixe constant de la console (`/dashboard/admin`), et lui seul.
  if (q === '`' && debut.startsWith('${ADMIN_CONSOLE_PATH}')) return true
  return false
}

type Genre = 'navigate' | 'Navigate' | 'Link' | 'NavLink' | 'location.assign' | 'location.replace' | 'location.href' | 'window.open'

interface Puits { fichier: string; genre: Genre; cible: string }

/** Les puits non ancrés d'un fichier (source déjà dé-commentée). */
function puitsDynamiques(fichier: string, code: string): Puits[] {
  const trouves: Puits[] = []
  const norm = (x: string) => x.replace(/\s+/g, ' ')
  for (const m of code.matchAll(/\bnavigate\s*\(/g)) {
    const cible = premierArgument(code, m.index + m[0].length - 1)
    if (!cibleAncree(cible)) trouves.push({ fichier, genre: 'navigate', cible: norm(cible) })
  }
  for (const m of code.matchAll(/<(Navigate|Link|NavLink)\b[^>]*?\bto=\{/g)) {
    const cible = contenuAccolade(code, m.index + m[0].length - 1)
    if (!cibleAncree(cible)) trouves.push({ fichier, genre: m[1] as Genre, cible: norm(cible) })
  }
  for (const m of code.matchAll(/\blocation\s*\.\s*(assign|replace)\s*\(/g)) {
    const cible = premierArgument(code, m.index + m[0].length - 1)
    if (!cibleAncree(cible)) trouves.push({ fichier, genre: `location.${m[1]}` as Genre, cible: norm(cible) })
  }
  for (const m of code.matchAll(/\bwindow\s*\.\s*open\s*\(/g)) {
    const cible = premierArgument(code, m.index + m[0].length - 1)
    if (!cibleAncree(cible)) trouves.push({ fichier, genre: 'window.open', cible: norm(cible) })
  }
  for (const m of code.matchAll(/\blocation\s*\.\s*href\s*=(?!=)\s*/g)) {
    // L'expression affectée court jusqu'au `;`, à l'accolade ou au saut de ligne.
    const reste = code.slice(m.index + m[0].length)
    const cible = reste.slice(0, reste.search(/[;}\n]/) === -1 ? undefined : reste.search(/[;}\n]/)).trim()
    if (!cibleAncree(cible)) trouves.push({ fichier, genre: 'location.href', cible: norm(cible) })
  }
  return trouves
}

// ─── La table fermée ─────────────────────────────────────────────────────────

interface Inscrit extends Puits { fois?: number; pourquoi: string }

const TABLE: Inscrit[] = [
  { fichier: 'src/App.tsx', genre: 'location.replace', cible: 'HELP_CENTER_URL', pourquoi: 'constante de module (centre d\'aide public)' },
  { fichier: 'src/App.tsx', genre: 'location.replace', cible: 'VITRINE_LOGIN_URL', pourquoi: 'constante de module (connexion de la vitrine)' },
  { fichier: 'src/App.tsx', genre: 'location.replace', cible: 'VITRINE_URL', fois: 2, pourquoi: 'constante de module (la vitrine)' },
  { fichier: 'src/components/admin/AdminSearchDialog.tsx', genre: 'navigate', cible: 'result.href', pourquoi: 'href bâti par useAdminSearch : ADMIN_CONSOLE_PATH + identifiant de base' },
  { fichier: 'src/components/admin/AdminShell.tsx', genre: 'Link', cible: 'ADMIN_CONSOLE_PATH', pourquoi: 'constante de module' },
  { fichier: 'src/components/admin/AdminShell.tsx', genre: 'navigate', cible: 'retourCrm', fois: 2, pourquoi: 'retourAuCrm : onglet actif filtré par crmTabsEligible (préfixe /dashboard), sinon /dashboard' },
  { fichier: 'src/components/crm-dossiers/kyc-pager/KycDocViewer.tsx', genre: 'window.open', cible: 'data.signedUrl', pourquoi: 'URL signée rendue par Supabase Storage, jamais lue dans l\'URL de la page' },
  { fichier: 'src/components/crm-identity/IdentityShell.tsx', genre: 'location.href', cible: 'started.url', pourquoi: 'session Stripe Identity rendue par l\'edge kyb-identity-verify' },
  { fichier: 'src/components/crm-mobile/deal/MobileDealDetailScreen.tsx', genre: 'navigate', cible: 'offreRoute(\'nouvelle\')', pourquoi: 'offreRoute bâtit /dashboard/transactions/<id>/offre/<genre>' },
  { fichier: 'src/components/crm-mobile/deal/MobileDealDetailScreen.tsx', genre: 'navigate', cible: 'offreRoute(current ? \'contre\' : \'nouvelle\')', pourquoi: 'offreRoute bâtit /dashboard/transactions/<id>/offre/<genre>' },
  { fichier: 'src/components/crm-mobile/kyc/MobileKycDetailScreen.tsx', genre: 'window.open', cible: 'data.signedUrl', pourquoi: 'URL signée rendue par Supabase Storage, jamais lue dans l\'URL de la page' },
  { fichier: 'src/components/crm-mobile/more/MobileMoreScreen.tsx', genre: 'navigate', cible: 'd.route', pourquoi: 'table statique de routes /dashboard/…' },
  { fichier: 'src/components/crm-mobile/shell/MobileTabBar.tsx', genre: 'navigate', cible: 'tab.route', pourquoi: 'MOBILE_TABS, table statique' },
  { fichier: 'src/components/crm/CrmSidebar.tsx', genre: 'navigate', cible: 'consoleAReprendre()', pourquoi: 'relu du sessionStorage mais filtré par estPageConsole (préfixe de la console)' },
  { fichier: 'src/components/crm/CrmSidebar.tsx', genre: 'navigate', cible: 'route', pourquoi: 'crmSidebarRouteOf : table statique de la barre latérale' },
  { fichier: 'src/components/crm/profile/CrmCompteBouton.tsx', genre: 'navigate', cible: 'route', pourquoi: 'crmSidebarRouteOf(\'settings\') : table statique de la barre latérale, clé constante ; le `?tab=` ajouté vient de deux constantes d\'appel' },
  { fichier: 'src/components/crm/profile/CrmProfileDropdown.tsx', genre: 'navigate', cible: 'consoleAReprendre()', pourquoi: 'relu du sessionStorage mais filtré par estPageConsole (préfixe de la console)' },
  { fichier: 'src/components/crm/search/CrmSearch.tsx', genre: 'navigate', cible: 'href', pourquoi: 'hrefDe : /dashboard/<genre>/<id>, ou consoleAReprendre()' },
  { fichier: 'src/components/layout/AgentLayout.tsx', genre: 'Navigate', cible: 'IDENTITY_GATE_ROUTE', pourquoi: 'constante de module' },
  { fichier: 'src/components/layout/ErrorBoundary.tsx', genre: 'location.replace', cible: 'cacheBustedReloadUrl(window.location.href, Date.now())', fois: 2, pourquoi: 'recharge l\'URL COURANTE avec un paramètre anti-cache : même origine par construction' },
  { fichier: 'src/components/layout/KycLabGuard.tsx', genre: 'navigate', cible: 'IDENTITY_GATE_ROUTE', pourquoi: 'constante de module' },
  { fichier: 'src/components/layout/OnboardingCallBanner.tsx', genre: 'navigate', cible: 'ONBOARDING_CALL_ROUTE', pourquoi: 'constante de module' },
  { fichier: 'src/components/layout/StaleBundleDetector.tsx', genre: 'location.replace', cible: 'url.toString()', pourquoi: 'new URL(window.location.href) plus un paramètre : même origine' },
  { fichier: 'src/components/matching-atelier/AtlSendSheet.tsx', genre: 'window.open', cible: 'buildWaMeUrl(b.phone ?? \'\', t(\'sendSheet.waMessage\', { firstName: b.first, url }))', pourquoi: 'buildWaMeUrl fixe l\'hôte https://wa.me/' },
  { fichier: 'src/components/matching-atelier/AtlSendSheet.tsx', genre: 'window.open', cible: 'url', pourquoi: 'lien de réception créé par le CRM (mutation serveur), jamais lu dans l\'URL' },
  { fichier: 'src/components/matching-recherche/MrhExtDetail.tsx', genre: 'window.open', cible: '/^https?:/i.test(u) ? u : \'https://\' + u', pourquoi: 'lien d\'annonce externe, schéma forcé en http(s) par le test qui l\'encadre' },
  { fichier: 'src/components/matching-recherche/MrhSendSheet.tsx', genre: 'window.open', cible: 'buildWaMeUrl(result.phone ?? \'\', t(\'sendSheet.waMessage\', { firstName: first, url: result.url }))', pourquoi: 'buildWaMeUrl fixe l\'hôte https://wa.me/' },
  { fichier: 'src/hooks/useCrmTabs.ts', genre: 'navigate', cible: 'cible', fois: 2, pourquoi: 'chemin d\'onglet de l\'agent lui-même (RLS own-only), préfixe /dashboard par crmTabsEligible' },
  { fichier: 'src/hooks/useCrmTabs.ts', genre: 'navigate', cible: 'href', fois: 2, pourquoi: 'chemin d\'onglet de l\'agent lui-même (RLS own-only), préfixe /dashboard par crmTabsEligible' },
  { fichier: 'src/hooks/useMailOAuthPopup.ts', genre: 'location.assign', cible: 'url', pourquoi: 'URL d\'autorisation Google/Microsoft rendue par l\'edge mail-oauth' },
  { fichier: 'src/hooks/useSubscription.ts', genre: 'location.href', cible: 'url', fois: 2, pourquoi: 'URL Stripe (Checkout, portail) rendue par l\'edge' },
  { fichier: 'src/hooks/useCredits.ts', genre: 'location.href', cible: 'r.url', pourquoi: 'URL Stripe Checkout (pack de crédits) rendue par l\'edge credits-checkout' },
  { fichier: 'src/lib/adminEntry.ts', genre: 'window.open', cible: 'url', pourquoi: 'chemin relatif /dashboard?impersonate=<id encodé>' },
  { fichier: 'src/lib/help-articles.ts', genre: 'window.open', cible: 'HELP_CENTER_URL', pourquoi: 'constante de module' },
  { fichier: 'src/lib/mail/oauthPopup.ts', genre: 'window.open', cible: 'url', pourquoi: 'URL d\'autorisation rendue par l\'edge mail-oauth (appelant : useMailOAuthPopup)' },
  { fichier: 'src/pages/admin/AdminDashboardPage.tsx', genre: 'navigate', cible: 'sectionPath(\'agencies\')', pourquoi: 'SECTION_PATH, table fermée lue par clé propre' },
  { fichier: 'src/pages/admin/AdminDashboardPage.tsx', genre: 'navigate', cible: 'sectionPath(\'live\')', pourquoi: 'SECTION_PATH, table fermée lue par clé propre' },
  { fichier: 'src/pages/admin/AdminDashboardPage.tsx', genre: 'navigate', cible: 'sectionPath(\'monitoring\')', pourquoi: 'SECTION_PATH, table fermée lue par clé propre' },
  { fichier: 'src/pages/admin/AdminDashboardPage.tsx', genre: 'navigate', cible: 'sectionPath(\'plans\')', pourquoi: 'SECTION_PATH, table fermée lue par clé propre' },
  { fichier: 'src/pages/admin/AdminDashboardPage.tsx', genre: 'navigate', cible: 'sectionPath(s.go)', pourquoi: 'jeton serveur, traduit par SECTION_PATH (clé propre, repli sur la console)' },
  { fichier: 'src/pages/agent/DealDetailPage.tsx', genre: 'navigate', cible: 'vers', pourquoi: 'go() ne reçoit que des gabarits /dashboard/… de la page' },
  { fichier: 'src/pages/agent/ImportLeadPage.tsx', genre: 'navigate', cible: 'returnTo', fois: 2, pourquoi: 'returnTo = safeInternalPath(…, { prefix: \'/dashboard\' })' },
  { fichier: 'src/pages/agent/KycPage.tsx', genre: 'navigate', cible: 'location.pathname', pourquoi: 'le chemin COURANT (nettoyage du state de navigation)' },
  { fichier: 'src/pages/agent/NewTabPage.tsx', genre: 'navigate', cible: 's.route', pourquoi: 'groupes de suggestions statiques' },
  { fichier: 'src/pages/agent/PipelinePage.tsx', genre: 'navigate', cible: 'vers', pourquoi: 'go() ne reçoit que des gabarits /dashboard/… de la page' },
  { fichier: 'src/pages/dev/AdminShowcasePage.tsx', genre: 'navigate', cible: 'ADMIN_CONSOLE_PATH', pourquoi: 'constante de module (banc)' },
  { fichier: 'src/pages/dev/CrmShowcasePage.tsx', genre: 'navigate', cible: 's.chemin', pourquoi: 'table statique du banc' },
  { fichier: 'src/pages/dev/PublicShowcasePage.tsx', genre: 'Link', cible: 's.chemin', pourquoi: 'table statique du banc' },
  { fichier: 'src/pages/public/AuthCallbackPage.tsx', genre: 'navigate', cible: 'path', pourquoi: 'settle(path) : destinations fixes, getRedirectPath(rôle) ou calendarReturnPath (table fermée)' },
]

// ─── Le balayage ─────────────────────────────────────────────────────────────

const scan = scanRoots([{ root: 'src', keep: (n) => /\.(ts|tsx)$/.test(n) && !n.endsWith('.d.ts') }])
const sources = new Map<string, string>()
for (const abs of scan.files) {
  const lu = readFileSafely(abs)
  if (lu.status === 'ok') sources.set(rel(abs), sansCommentaires(lu.value))
}

const cle = (p: Puits) => `${p.fichier} · ${p.genre} · ${p.cible}`

describe('redirection ouverte — les puits de navigation', () => {
  it('le balayage a lu l’arbre (contrôles positifs)', () => {
    expect(emptyRoots(scan)).toEqual([])
    expect(scan.unreadable).toEqual([])
    expect(sources.size).toBeGreaterThan(500)
    expect(sources.has('src/pages/agent/ImportLeadPage.tsx')).toBe(true)
  })

  it('le classeur distingue une cible ancrée d’une cible dynamique (contrôle du matcher)', () => {
    const synth = (code: string) => puitsDynamiques('synth.tsx', sansCommentaires(code)).map((p) => p.cible)
    expect(synth('navigate(foo)')).toEqual(['foo'])
    expect(synth('navigate(`${x}/a`)')).toEqual(['`${x}/a`'])
    expect(synth("navigate('/' + x)")).toEqual(["'/' + x"])
    expect(synth('navigate(`//${h}`)')).toEqual(['`//${h}`'])
    expect(synth('<Link to={cible}>')).toEqual(['cible'])
    expect(synth('window.location.href = url;')).toEqual(['url'])
    expect(synth('window.open(u, "_blank")')).toEqual(['u'])
    // Ancrées : rien à inscrire.
    expect(synth("navigate('/dashboard'); navigate(-1); navigate(`/dashboard/contacts/${id}`)")).toEqual([])
    expect(synth("navigate(ok ? `/dashboard/x/${id}` : '/dashboard/x')")).toEqual([])
    expect(synth('window.location.href = `mailto:${email}`')).toEqual([])
    // Un puits en commentaire ne compte pas ; un `//` de gabarit ne coupe pas la ligne.
    expect(synth('// navigate(foo)\n/* navigate(bar) */')).toEqual([])
    expect(synth('const u = `https://x.test/a`; navigate(dyn)')).toEqual(['dyn'])
  })

  it('tout useNavigate() est lié au nom `navigate` (sinon le balayage serait incomplet)', () => {
    const liaisons: string[] = []
    const autres: string[] = []
    for (const [f, code] of sources) {
      for (const m of code.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*useNavigate\s*\(/g)) {
        liaisons.push(f)
        if (m[1] !== 'navigate') autres.push(`${f} → ${m[1]}`)
      }
      // Déstructuration ou alias : `const { … } = useNavigate` n'a pas de sens, mais
      // `const go = useNavigate` sans appel rendrait le balayage aveugle.
      for (const m of code.matchAll(/=\s*useNavigate\s*(?!\()/g)) autres.push(`${f} → alias à l'index ${m.index}`)
    }
    expect(liaisons.length).toBeGreaterThan(50)
    expect(autres).toEqual([])
  })

  it('chaque puits dynamique est inscrit, et chaque inscription existe encore', () => {
    const trouves = [...sources].flatMap(([f, code]) => puitsDynamiques(f, code)).map(cle).sort()
    const attendus = TABLE.flatMap((e) => Array.from({ length: e.fois ?? 1 }, () => cle(e))).sort()
    const manquants = trouves.filter((k, i, arr) => arr.indexOf(k) === i)
      .filter((k) => trouves.filter((x) => x === k).length > attendus.filter((x) => x === k).length)
    const perimes = attendus.filter((k, i, arr) => arr.indexOf(k) === i)
      .filter((k) => attendus.filter((x) => x === k).length > trouves.filter((x) => x === k).length)
    expect({ manquants, perimes }).toEqual({ manquants: [], perimes: [] })
  })

  it('ImportLeadPage tire returnTo de safeInternalPath, avec le préfixe du CRM', () => {
    const code = sources.get('src/pages/agent/ImportLeadPage.tsx') ?? ''
    expect(code).toMatch(/const returnTo\s*=\s*safeInternalPath\(searchParams\.get\('returnTo'\),\s*'\/dashboard\/pipeline',\s*\{ prefix: '\/dashboard' \}\)/)
  })
})

// ─── Filet secondaire : les lectures de paramètres « de retour » ─────────────

/** Radicaux anglais ET français d'un paramètre qui désigne une destination. */
const NOM_DE_RETOUR = /^(return|redirect|next|from|back|goto|dest|continue|url|target|retour|suite|cible|redirection|depuis|origine|destination)/i

/** Fichiers qui lisent un tel paramètre sans le passer à safeInternalPath, et pourquoi. */
const EXEMPTIONS: Record<string, string> = {
  'src/lib/calendarOauth.ts': 'from → table fermée RETURN_PATHS, lue par clé PROPRE (retourConnu)',
}

describe('redirection ouverte — lectures de paramètres de retour', () => {
  const lectures: { fichier: string; nom: string; filtree: boolean }[] = []
  for (const [f, code] of sources) {
    for (const m of code.matchAll(/\.get\(\s*(['"])([A-Za-z_]+)\1\s*\)/g)) {
      if (!NOM_DE_RETOUR.test(m[2])) continue
      const avant = code.slice(Math.max(0, m.index - 80), m.index)
      lectures.push({ fichier: f, nom: m[2], filtree: /safeInternalPath\(\s*[\w.]*$/.test(avant) })
    }
  }

  it('le motif trouve des lectures, dont celle d’ImportLeadPage (contrôle positif)', () => {
    expect(lectures.some((l) => l.fichier === 'src/pages/agent/ImportLeadPage.tsx' && l.nom === 'returnTo' && l.filtree)).toBe(true)
  })

  it('toute lecture passe par safeInternalPath ou figure dans une exemption nommée', () => {
    const fautives = lectures.filter((l) => !l.filtree && !(l.fichier in EXEMPTIONS)).map((l) => `${l.fichier} · ${l.nom}`)
    expect(fautives).toEqual([])
  })

  it('chaque exemption vise un fichier qui lit encore un tel paramètre (pas d’exemption périmée)', () => {
    for (const f of Object.keys(EXEMPTIONS)) {
      expect(lectures.some((l) => l.fichier === f), f).toBe(true)
    }
  })
})
