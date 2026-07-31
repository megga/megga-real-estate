# Package handoff — Console MEGGA · Backend admin

> Paquet autonome à donner à Claude Code. **31 juillet 2026 · v3** — spec **vérifiée contre la branche onboarding de Thomas** (`claude/onboarding-kyb-etape-7-2ad668`) : toutes les ressources marquées « existantes » (tables, RPC, migrations) ont été lues dans le repo. Côté repo, lire d'abord `docs/handoff/onboarding-api/HANDOFF_ONBOARDING_API.md` (le relais KYB — 16 invariants qui s'imposent aussi à la console).

## `Console MEGGA.html` — la maquette qui tourne

Ouvrir ce fichier dans un navigateur (connexion requise pour React/fonts CDN) : la console complète — 11 entrées, 10 écrans interactifs, clair/sombre (bouton en bas à gauche), données de démo. Seule la chrome CRM (top nav + rail d'icônes) est simplifiée par un stub — **le shell réel vit dans `MEGGA CRM.html` du projet** ; la console elle-même est la maquette réelle, non modifiée.

## Ordre de lecture

1. `HANDOFF_CONSOLE_ADMIN_CLAUDE_CODE.md` — **la spec (v3)** : principes, accès, couplages onboarding KYB vérifiés (§2, C1-C10), modèle de données (§4.1 existant / §4.2 à créer), contrats écran par écran (§5, dont §5.13 revue KYB), journalisation (§6), seuils (§7), lots (§8), questions (§9), annexe ingénierie (§10), index des RPC (Annexe A.1 existantes / A.2 à créer).
2. `PLAN_CONSOLE_ADMIN_BACKEND.md` — **le plan d'exécution** : 33 étapes, 5 gates G0→G4, dépendances P3-P5, RACI, registre de risques. Cocher au fil de l'eau.
3. `HANDOFF_PRELANCEMENT_ADMIN.md` — digest de la branche audit pré-lancement (`claude/audit-onboarding-crm-224432`) : bloquants S13 / grants SECDEF / billing qui précèdent la console, drift des migrations (**`supabase db push` interdit**), checklist go-live.
4. `refs/HANDOFF_KYC_DIAGNOSTIC.md` — le **gabarit de contrat par geste** à répliquer pour chaque RPC.
5. `refs/AUDIT_ADMIN_CONSOLE.md` — inventaire du socle admin au repo.
6. `refs/HANDOFF_ONBOARDING_CLAUDE_CODE.md` — l'ancien handoff onboarding (contexte historique ; en cas de divergence, la §2 de la spec et le relais KYB du repo priment).
7. `refs/REGLES_PRODUIT_CLAUDE_MD.md` — règles produit du projet (copie du CLAUDE.md racine).

## `front/` — les maquettes = la spec fonctionnelle

Shell : `crm-screen-admin-proto.jsx` (11 entrées / 6 groupes) · kit : `admin-kit.jsx` · jeu de démo calé sur les champs backend : `admin-data.jsx` (à convertir en seed SQL staging — en recalant la grille de plans sur la vraie : Starter 0 / Pro 89 / Entreprise 249) · un fichier par écran. Les champs affichés, seuils et libellés sont **définitifs** — le backend s'y conforme, pas l'inverse. **Fichiers en lecture seule** (règle « Fidélité maquette » en tête de la spec — seules exceptions : étapes 4, 15, 31 du plan + amendements actés §2). Tout écart = amendement validé par le PO avant le code.

## Conditions de départ (ne pas coder avant)

- ✅ Grille de plans : **résolue** (`src/lib/plans.ts`) — reste l'arbitrage sièges `team_members` vs `maxAgents` (PO + Thomas)
- **P5** design de la surface **Revue KYB** acté (le backend existe — 7 RPC en prod)
- Bloquants pré-lancement 0.1→0.4 appliqués par Julien (`HANDOFF_PRELANCEMENT_ADMIN.md`), surtout **S13 `join_agency`**
- (P3 contrat webhook Immobilier.ch — ne bloque que le Lot 3)

## Hors périmètre — fait foi

Satisfaction/NPS · 2FA · « Voir en tant que » · **C2PA (hors MVP)** · **virtual staging IA (version future)** · **export CSV (aucun, nulle part — acté 31 juil.)** · pages Clients finaux / Support / Conformité · changement de plan depuis la console · validation d'annonce en amont · i18n · responsive console.
