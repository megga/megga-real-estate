# 🔒 Audit pré-lancement public — MEGGA Real Estate

Dossier de référence de l'audit de **sécurité / performance / robustesse / bugs** mené avant l'ouverture publique
du SaaS. Destiné à Julien et à son assistant Claude Code : tout est ici pour continuer la remédiation.

## Par où commencer

1. **[STATUS.md](STATUS.md)** — 👈 **commence ici**. Tableau de bord vivant : quel finding est corrigé (PR mergée),
   en cours, ou à faire ; les corrections apportées à l'audit ; comment continuer.
2. **[PRE_LAUNCH_AUDIT.md](PRE_LAUNCH_AUDIT.md)** — le **rapport de findings** complet (sécurité, perf, qualité, bugs),
   avec sévérité, emplacement `fichier:ligne`, et statut de vérification (✅ confirmé live / 📄 source).
3. **[PRE_LAUNCH_ADMIN_PLAN.md](PRE_LAUNCH_ADMIN_PLAN.md)** — le travail **restant côté Julien** (migrations Supabase,
   grants/policies RLS, CI, secrets, Cloudflare) — ce qui exige des tokens admin.
4. **[PRE_LAUNCH_REMEDIATION.md](PRE_LAUNCH_REMEDIATION.md)** — vue d'ensemble des correctifs, organisée par causes racines.
5. **[patches/](patches/)** — un fichier par correctif : **before/after exact** (edge functions / frontend) ou
   **migration SQL proposée**, avec section de test. Voir [patches/README.md](patches/README.md) pour l'index.

## Résumé exécutif

- **12 PRs de remédiation** poussées (10 mergées, 2 ouvertes au 2026-07-03) — voir [STATUS.md](STATUS.md).
  Tous les findings sécurité **P0 et ÉLEVÉ indépendants du code sont corrigés** (relais email, JWT forgeable ×2,
  SSRF ×3, auth des fonctions IA, injection audit pipeline, scrub Sentry, memo Kanban, fuite blob, deps).
- **Risque résiduel principal = les migrations** (surtout **`S13 join_agency`**, brèche multi-tenant ÉLEVÉ) →
  côté Julien, voir l'ADMIN_PLAN. À faire avec précaution vu le **drift de bookkeeping** (pas de `db push` aveugle).
- **Points positifs confirmés** : RLS sur toutes les tables applicatives, buckets KYC/documents privés, config Auth
  solide (MFA/HIBP/password 12+), escalade `profiles.role` verrouillée, aucun secret dans git.

## Règles de travail appliquées (à conserver)

- **Golden rule** : les PRs de remédiation ne changent **ni le visuel ni l'UX** (géré séparément).
- **Vérification systématique** : chaque cible re-vérifiée réellement (`grep` sous-chemins, `deno check`,
  `npm run build`) avant action — l'audit brut contenait des imprécisions (voir §Corrections de STATUS.md).
- **Migrations = ressort admin**, appliquées délibérément (jamais `supabase db push` sur cette base).

## Note de confidentialité
Ce dossier décrit des vulnérabilités, dont **certaines non encore corrigées** (migrations en attente). À traiter en
**need-to-know** au sein de l'équipe tant que l'ADMIN_PLAN n'est pas exécuté.
