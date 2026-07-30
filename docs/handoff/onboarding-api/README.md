# Relais onboarding client (KYB agences) vers l'équipe API

| Fichier | Contenu |
|---|---|
| [HANDOFF_ONBOARDING_API.md](HANDOFF_ONBOARDING_API.md) | le document de relais : état vérifié en production, contrat d'API, 16 invariants, dette ouverte, feuille de route en 5 lots, étapes de passation |

**Le point à connaître avant tout le reste :** en production, aucun dossier d'agence ne peut
aujourd'hui s'auto-valider, dans aucun pays. Le véto de personne `pep_sanctions_screening` n'a
aucune source, aucun chemin d'écriture et aucune RPC de résolution, et un véto sans ligne
échoue. La documentation antérieure affirme le contraire pour la France : cette affirmation a
été mesurée dans une fixture qui pose ce véto à la main. Voir §9 A.

**Documents liés**

- [../../agency-kyb-verification.md](../../agency-kyb-verification.md) : décisions de conception du schéma et de la vérification
- [../../superpowers/specs/2026-07-26-onboarding-kyb-design.md](../../superpowers/specs/2026-07-26-onboarding-kyb-design.md) : conception du parcours utilisateur
- [../../agency-kyb-handoff.md](../../agency-kyb-handoff.md) : journal de chantier des étapes 0 à 6 (partiellement périmé, voir §11 du relais)
- [../../superpowers/plans/2026-07-30-onboarding-kyb-etape-7-remediation.md](../../superpowers/plans/2026-07-30-onboarding-kyb-etape-7-remediation.md) : le plan d'exécution de l'étape suivante
