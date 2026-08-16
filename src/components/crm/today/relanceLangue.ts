// Langue et en-tête d'un brouillon de relance — deux fonctions pures.
//
// Elles vivaient dans `RelanceSession.tsx`. Les exporter de là cassait
// `react-refresh/only-export-components` (un fichier qui exporte des composants ne doit
// exporter QUE des composants) ; les sortir ici règle la règle ET le couplage, puisque
// aucune des deux n'a besoin du composant.
//
// Ce sont les deux points où la langue décide de quelque chose d'observable par le client :
// l'une choisit dans quelle langue on lui écrit, l'autre décide de ce qui atterrit dans
// l'objet d'un e-mail réellement envoyé. Les deux échouaient en silence avant le 16.08.2026.

/** Les quatre langues du produit (CLAUDE.md §6). */
export type Langue = 'fr' | 'de' | 'en' | 'it'

/**
 * Ramène une langue déclarée aux quatre du produit.
 *
 * ⚠ Une TABLE, jamais un ternaire : `l === 'en' ? 'en' : 'fr'` avalerait `de` et `it` en
 * silence — un client germanophone recevrait du français sans que rien ne le signale. C'est
 * le défaut que ce chantier ferme ailleurs, il n'a pas à renaître ici.
 */
export function langueClient(l: string | null | undefined): Langue {
  return l === 'de' || l === 'en' || l === 'it' ? l : 'fr'
}

/**
 * Sépare la ligne d'objet du corps d'un brouillon rédigé par le copilote.
 *
 * ⛔ LE MOTIF NE CONNAISSAIT QUE LE FRANÇAIS (`/^objet…/i`). Depuis que le brouillon se
 * rédige dans la langue du CLIENT, un brouillon allemand commence par « Betreff: » : la
 * ligne n'était pas reconnue, l'objet retombait sur le repli ET la ligne « Betreff: … »
 * partait collée en tête du corps envoyé au client.
 *
 * `nomFallback` sert quand aucune ligne d'objet n'est trouvée ; l'appelant y passe la clé
 * i18n déjà traduite, la fonction restant pure.
 */
export function parseDraft(
  text: string,
  lead: { name: string },
  t: (key: string, params?: Record<string, unknown>) => string,
): { subject: string; body: string } {
  const trimmed = (text || '').trim()
  const nl = trimmed.indexOf('\n')
  const firstLine = (nl === -1 ? trimmed : trimmed.slice(0, nl)).trim()
  const m = firstLine.match(/^(?:objet|betreff|subject|oggetto)\s*:?\s*(.+)$/i)
  if (m) {
    return { subject: m[1].trim(), body: trimmed.slice(nl + 1).replace(/^\s+/, '') }
  }
  return {
    subject: t('today.relance.draft.fallbackSubject', { name: lead.name.split(' ')[0] }),
    body: trimmed,
  }
}
