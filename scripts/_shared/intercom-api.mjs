/**
 * Client HTTP Intercom — partagé par les scripts qui lisent ou écrivent le corpus.
 *
 * Extrait de `scripts/intercom-content.mjs` le 17 août 2026, quand la génération
 * de `megga.ch/aide` en est devenue un second lecteur. Le duplicat aurait porté
 * l'authentification, la version d'API et surtout la PAGINATION — le curseur
 * Intercom (`pages.next.starting_after`) est exactement le genre de détail qu'une
 * copie oublie, et l'oubli ne se voit qu'au-delà de 150 articles.
 *
 * ⚠ Aucun effet de bord au chargement : c'est l'APPELANT qui décide de ce que
 * vaut un jeton absent. `intercom-content.mjs` sort en erreur (il n'a rien à
 * faire sans jeton) ; `vitrine-aide.mjs` distingue la CI du poste local.
 */

export const BASE_PAR_DEFAUT = process.env.INTERCOM_API_BASE || 'https://api.intercom.io';
export const VERSION_PAR_DEFAUT = process.env.INTERCOM_API_VERSION || '2.11';

/** Message d'aide unique — les deux appelants l'affichent, chacun à sa façon. */
export const AIDE_JETON_MANQUANT =
  'INTERCOM_ACCESS_TOKEN manquant.\n' +
  '  GitHub : Settings → Secrets and variables → Actions → New repository secret\n' +
  '           name = INTERCOM_ACCESS_TOKEN (scope Intercom : Read content data).\n' +
  '  Local  : ajoute INTERCOM_ACCESS_TOKEN=... dans .env.local (gitignoré).';

/**
 * Construit un client lié à un jeton.
 * @throws si le jeton est absent — l'appelant choisit quoi en faire.
 */
export function creerClientIntercom({
  token = process.env.INTERCOM_ACCESS_TOKEN,
  base = BASE_PAR_DEFAUT,
  version = VERSION_PAR_DEFAUT,
} = {}) {
  if (!token) throw new Error(AIDE_JETON_MANQUANT);

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Intercom-Version': version,
  };

  async function api(path, init = {}) {
    const res = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
    const text = await res.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok) {
      const detail = typeof body === 'string' ? body : JSON.stringify(body);
      throw new Error(`HTTP ${res.status} ${res.statusText} on ${path} — ${detail}`);
    }
    return body;
  }

  /** Liste paginée (curseur Intercom : `pages.next.starting_after`). */
  async function listAll(path) {
    const out = [];
    let startingAfter = null;
    do {
      const sep = path.includes('?') ? '&' : '?';
      const url = `${path}${sep}per_page=150${startingAfter ? `&starting_after=${encodeURIComponent(startingAfter)}` : ''}`;
      const body = await api(url);
      if (Array.isArray(body?.data)) out.push(...body.data);
      startingAfter = body?.pages?.next?.starting_after ?? null;
    } while (startingAfter);
    return out;
  }

  return { api, listAll, base, version };
}
