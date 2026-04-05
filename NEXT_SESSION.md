# Instructions pour la prochaine session — Agent Directory

## Contexte

Un annuaire d'agents/agences immobiliers a été conçu pour MEGGA Real Estate. C'est le premier annuaire d'agents immobiliers vérifié en Suisse (aucun concurrent ne fait ça). L'objectif est d'acquérir des agents vers le CRM MEGGA + crédibilité/branding.

## Fichiers de référence

1. **Spec design** : `docs/superpowers/specs/2026-04-05-agent-directory-design.md` — le spec complet validé
2. **Plan d'implémentation** : `docs/superpowers/plans/2026-04-05-agent-directory.md` — 10 tâches détaillées avec code
3. **CLAUDE.md** — règles du projet (design system, conventions, stack)

## Ce qui a été fait

- Brainstorming complet (recherche Zillow, analyse marché suisse, sources de données légales)
- Spec design validé par l'utilisateur
- Plan d'implémentation écrit (10 tâches, ~50 steps)
- **Aucune tâche d'implémentation n'a été commencée**

## Ce qu'il faut faire

Exécuter le plan `docs/superpowers/plans/2026-04-05-agent-directory.md` en utilisant le skill `subagent-driven-development`.

Les 10 tâches dans l'ordre :

1. **Migration SQL** — 3 tables (agent_profiles, agency_profiles, agent_reviews) + RLS + indexes + RPC search_directory
2. **i18n namespace** — `directory` en 4 langues (FR/DE/EN/IT) + enregistrement dans index.ts
3. **Hooks** — useAgentDirectory, useAgentProfile, useAgentReviews (+ useSubmitReview mutation)
4. **Composants cards** — VerifiedBadge, ClaimProfileCTA, AgentCard, AgencyCard
5. **Composants reviews** — ReviewCard, ReviewForm, AgentStatsPanel (avec zone floutée pour non-vérifiés)
6. **AgentSearchBar** — barre recherche + filtres (canton, spécialité, langue, vérifié)
7. **Pages** — AgentDirectoryPage (/agents), AgentProfilePage (/agents/:slug), AgencyProfilePage (/agences/:slug)
8. **Router + Navbar** — 3 routes lazy dans App.tsx + lien "Trouver un agent" dans Navbar.tsx
9. **Seed script** — scripts/seed-directory.mjs (SVIT JSON API + SMK HTML + USPI HTML → ~350-400 agences)
10. **Vérification finale** — tsc + build + visual check

## Commande de lancement

```
Lis le plan dans docs/superpowers/plans/2026-04-05-agent-directory.md et exécute-le tâche par tâche en utilisant le skill subagent-driven-development. Les tâches 1-3 sont indépendantes et peuvent être parallélisées. Les tâches 4-6 dépendent de la tâche 3 (hooks). Les tâches 7-8 dépendent des tâches 4-6 (composants). La tâche 9 est indépendante. La tâche 10 est la dernière.
```

## Notes importantes

- On est dans un **worktree git** : `/Users/megga/Desktop/megga-real-estate/.claude/worktrees/gallant-darwin`
- Branche : `claude/gallant-darwin`
- Le design system est strict : pas de bg-accent plein, pas de shadow, tokens thème uniquement (voir CLAUDE.md section 4)
- Tous les textes UI doivent utiliser `useTranslation('directory')` — pas de strings hardcodées
- Le code complet de chaque composant est dans le plan — les agents n'ont qu'à le copier
