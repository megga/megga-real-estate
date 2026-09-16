/**
 * Couleurs FONCTIONNELLES des contacts — elles encodent le type du contact,
 * elles ne décorent pas.
 *
 * Elles ne descendent donc pas sur l'échelle MEGGA X, et c'est délibéré : même
 * arbitrage que les teintes d'étape du pipeline (`CRM_STAGE_HUE`) et que les sept
 * types d'événement du calendrier. Ce qui se vérifie sur elles est leur
 * LISIBILITÉ (`tests/unit/contacts-contraste.spec.ts`), pas leur provenance —
 * confondre les deux est ce qui a laissé passer le blanc figé qu'elles
 * portaient.
 *
 * ⚠ Module séparé, et pas un `export` depuis `ContactsPager.tsx` : un fichier
 * qui exporte des composants ne peut pas exporter aussi des constantes sans
 * casser le rafraîchissement à chaud (`react-refresh/only-export-components`).
 * Même rôle que `galHelpers.ts` pour la galerie de « Mes biens ».
 */

/**
 * Teintes par audience. Partagées avec le point de couleur de la page Santé.
 *
 * ⚠ `seller` et `tenant` FONCÉS le 16.09.2026, à teinte constante (#C45A00 → #BA4C00,
 * #0891B2 → #0E7490). Clairs, ils ne portaient pas le blanc à l'AA (4,37 et 3,68:1) :
 * `encreSur` leur donnait l'encre NOIRE, et « Acheteur » en blanc à côté de « Vendeur » et
 * « Locataire » en noir se lisait comme un défaut (Julien). Foncés, le blanc y rend 5,10
 * et 5,36:1 et l'emporte sur le noir : les trois pastilles portent la même encre.
 */
export const CTP_FN = { buyer: '#1E5BC6', seller: '#BA4C00', tenant: '#0E7490', ok: '#059669' } as const

/**
 * Le violet de MEGGA AI dans Contacts : là où se rejoignent les vagues de l'écran vide,
 * et la fin du dégradé de la pastille MEGGA AI des notes. Nommé une fois pour les deux.
 * Illustration, pas un barreau d'interface — sous l'encre blanche il rend 5,7:1.
 */
export const MEGGA_AI_VIOLET = '#7c3aed'

/**
 * Encre bleue des libellés TEXTE (KYC vérifié, pilule de filtre).
 *
 * Le handoff utilise `CTP_FN.buyer` (#1E5BC6) dans les deux thèmes ; sur fond
 * sombre ce bleu tombe sous le seuil de contraste, d'où le #6F8CFF. C'est un
 * correctif VOLONTAIRE, à conserver — ne pas « réaligner » sur #1E5BC6 en sombre
 * au nom de la fidélité au prototype.
 *
 * Ne s'applique QU'au texte : `CtpTypePill` pose `CTP_FN[audience]` en fond
 * plein et en dérive son encre par `encreSur()`.
 */
export const FN_BUYER_INK = (dark: boolean): string => (dark ? '#6F8CFF' : CTP_FN.buyer)
