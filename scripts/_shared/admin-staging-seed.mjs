/**
 * Jeu de données synthétique de la console super-admin — étape 15, spec §10.8.
 *
 * PUR ET DÉTERMINISTE : aucun accès réseau, aucun `Date.now()`, aucun `Math.random()`.
 * « Versionné » ne veut rien dire si deux exécutions produisent deux jeux différents — on ne
 * pourrait ni rejouer une démo, ni comparer deux mesures de performance. D'où un générateur
 * qui rend toujours la même chose, et un test unitaire qui l'éprouve sans base de données.
 *
 * ⚠ nLPD : ce fichier ne contient AUCUNE donnée de production, ni copie, ni dérivé. Les
 * agences, les personnes et les adresses sont inventées ; le domaine `.invalid` est réservé
 * par la RFC 2606 et n'est routable nulle part, donc aucun de ces comptes ne peut recevoir
 * de courrier par accident.
 *
 * ⚠ TROIS plans, pas quatre. §10.8 recale le seed sur la vraie grille C2
 * (`src/lib/plans.ts` : starter 0 · pro 89/71 · entreprise 249/199). La maquette en montre
 * quatre — « Agency » à 2 340 CHF — qui sont des prix de démonstration que §5.7 proscrit.
 */

/** Grille C2. `entreprise` en français : c'est ce que porte le CHECK de `subscriptions`. */
export const PLANS = ['starter', 'pro', 'entreprise']

/** Domaine non routable (RFC 2606). Distinct de `@megga-test.local`, qui est allowlisté super-admin. */
export const DOMAINE = 'megga-staging.invalid'

/**
 * PRNG déterministe (mulberry32). Sert uniquement à répartir des volumes, jamais à choisir
 * une donnée porteuse de sens : les agences et les personnes sont écrites en toutes lettres.
 */
function prng(graine) {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Les quatorze agences. La répartition n'est pas décorative — chaque ligne existe pour
 * qu'un état de l'écran soit atteignable :
 *
 *   · `sub: null`            → agence sans abonnement (le cas le plus fréquent en production)
 *   · `trialing` / `past_due` → les deux files du poste de triage (§5.7)
 *   · `status: 'suspended'`   → MRR à zéro MALGRÉ un abonnement actif (la règle §4.3)
 *   · `canceled`             → un abonnement qui ne compte plus
 *   · `ancienneteJours > 30` → seule condition sous laquelle une agence peut être `dormant`
 *     (créer une agence émet un `activity_events`, et la table refuse l'UPDATE : une agence
 *     de moins de 30 jours a forcément une activité récente)
 */
const AGENCES = [
  { slug: 'regie-lacustre',    nom: 'Régie Lacustre',            ville: 'Genève',    canton: 'GE', plan: 'entreprise', statut: 'active',    sub: 'active',   periode: 'yearly',  anciennete: 500, sieges: 8 },
  { slug: 'alpes-rives',       nom: 'Alpes & Rives Immobilier',  ville: 'Vevey',     canton: 'VD', plan: 'pro',        statut: 'active',    sub: 'active',   periode: 'monthly', anciennete: 420, sieges: 5 },
  { slug: 'bosson-filles',     nom: 'Bosson & Filles',           ville: 'Nyon',      canton: 'VD', plan: 'pro',        statut: 'active',    sub: 'active',   periode: 'monthly', anciennete: 310, sieges: 4 },
  { slug: 'cantonale-habitat', nom: 'Cantonale Habitat',         ville: 'Fribourg',  canton: 'FR', plan: 'pro',        statut: 'active',    sub: 'active',   periode: 'yearly',  anciennete: 200, sieges: 6 },
  { slug: 'rive-droite',       nom: 'Rive Droite Estates',       ville: 'Genève',    canton: 'GE', plan: 'entreprise', statut: 'active',    sub: 'active',   periode: 'monthly', anciennete: 160, sieges: 6 },
  { slug: 'vallee-verte',      nom: 'Vallée Verte Immobilier',   ville: 'Sion',      canton: 'VS', plan: 'starter',    statut: 'suspended', sub: 'past_due', periode: 'monthly', anciennete: 90,  sieges: 2 },
  { slug: 'grangier-immo',     nom: 'Grangier Immobilier',       ville: 'Morges',    canton: 'VD', plan: 'pro',        statut: 'active',    sub: 'trialing', periode: 'monthly', anciennete: 12,  sieges: 3 },
  { slug: 'lemanic-property',  nom: 'Lémanic Property',          ville: 'Lausanne',  canton: 'VD', plan: 'entreprise', statut: 'active',    sub: 'active',   periode: 'monthly', anciennete: 260, sieges: 5 },
  { slug: 'aare-wohnen',       nom: 'Aare Wohnen',               ville: 'Berne',     canton: 'BE', plan: 'starter',    statut: 'active',    sub: null,       periode: null,      anciennete: 45,  sieges: 1 },
  { slug: 'jura-habitat',      nom: 'Jura Habitat',              ville: 'Delémont',  canton: 'JU', plan: 'starter',    statut: 'active',    sub: null,       periode: null,      anciennete: 130, sieges: 2 },
  { slug: 'montreux-riviera',  nom: 'Montreux Riviera Immobilier', ville: 'Montreux', canton: 'VD', plan: 'pro',       statut: 'active',    sub: 'active',   periode: 'monthly', anciennete: 350, sieges: 4 },
  { slug: 'helvetia-prime',    nom: 'Helvetia Prime SA',         ville: 'Zurich',    canton: 'ZH', plan: 'entreprise', statut: 'active',    sub: 'active',   periode: 'yearly',  anciennete: 560, sieges: 6 },
  { slug: 'neuchatel-lac',     nom: 'Neuchâtel & Lac',           ville: 'Neuchâtel', canton: 'NE', plan: 'pro',        statut: 'active',    sub: 'canceled', periode: 'monthly', anciennete: 175, sieges: 3 },
  { slug: 'valais-alpes',      nom: 'Valais Alpes Immo',         ville: 'Sierre',    canton: 'VS', plan: 'starter',    statut: 'suspended', sub: null,       periode: null,      anciennete: 60,  sieges: 1 },
]

/** Prénoms et noms romands/alémaniques, inventés en tant que personnes. */
const PRENOMS = ['Nadia', 'Luc', 'Claire', 'Jean-Marc', 'Aline', 'Marc', 'Vera', 'Chloé',
                 'Sandra', 'Daniel', 'Camille', 'Peter', 'Béatrice', 'Olivier', 'Naïma',
                 'Grégoire', 'Séverine', 'Damien', 'Laetitia', 'Bruno', 'Marie', 'Fabio',
                 'Pascal', 'Sarah', 'Nicolas', 'Emilie', 'Yves', 'Nathalie', 'Andreas',
                 'Simon', 'Nadine', 'Lukas', 'Corinne', 'Reto', 'Fabienne', 'Jana']
const NOMS = ['Overney', 'Bosson', 'Praz', 'Wyss', 'Dubois', 'Ilic', 'Meunier', 'Kunz',
              'Frei', 'Perret', 'Aebi', 'Cornaz', 'Reymond', 'Benali', 'Aubert', 'Jaquet',
              'Rochat', 'Morand', 'Salamin', 'Chappuis', 'Storelli', 'Guillet', 'Baeriswyl',
              'Riedo', 'Progin', 'Deillon', 'Bulliard', 'Zollinger', 'Brunner', 'Steiger',
              'Egger', 'Baumgartner', 'Bachmann', 'Wenger', 'Widmer', 'Odermatt']

/** Le premier siège d'une agence est son administrateur ; ensuite manager, puis agents. */
function roleDuSiege(index) {
  if (index === 0) return 'admin'
  if (index === 1) return 'manager'
  return index % 5 === 0 ? 'assistant' : 'agent'
}

/**
 * Rend le jeu complet. Toujours identique : appelé deux fois, il produit deux objets égaux.
 * @returns {{agences: Array<object>, comptes: Array<object>, meta: object}}
 */
export function genererSeed() {
  const rand = prng(20260801)
  const comptes = []

  for (const a of AGENCES) {
    for (let i = 0; i < a.sieges; i++) {
      const prenom = PRENOMS[(comptes.length * 7 + i) % PRENOMS.length]
      const nom = NOMS[(comptes.length * 5 + i) % NOMS.length]
      comptes.push({
        agence: a.slug,
        role: roleDuSiege(i),
        prenom,
        nom,
        nomComplet: `${prenom} ${nom}`,
        // L'adresse porte le rang du siège : deux personnes homonymes restent distinctes,
        // et l'unicité ne dépend pas du tirage des prénoms.
        email: `${a.slug}-${i + 1}@${DOMAINE}`,
        // « Jamais connecté » (§5.4) : un siège par agence de plus de trois personnes.
        jamaisConnecte: a.sieges > 3 && i === a.sieges - 1,
        // Inactif au-delà du seuil de 30 jours de la maquette (usxFlag).
        inactifDepuisJours: i === 2 ? 47 : 0,
      })
    }
  }

  const agences = AGENCES.map((a) => ({
    ...a,
    // Volume d'activité, borné et reproductible. Sert au journal et au Live, pas au MRR.
    evenements: 20 + Math.floor(rand() * 60),
  }))

  return {
    agences,
    comptes,
    meta: {
      version: 1,
      // Pas de date de génération : elle changerait à chaque exécution et ferait mentir
      // le mot « versionné ». La date de dépôt est celle du commit.
      plans: PLANS,
      domaine: DOMAINE,
      totalAgences: agences.length,
      totalComptes: comptes.length,
    },
  }
}
