# Design System — Patterns détaillés

> Extrait de CLAUDE.md §4. Les règles de base (direction, thème, tokens) sont dans CLAUDE.md.

> ⛔ **CE DOCUMENT DÉCRIT LE PASSÉ. Il est conservé comme ARCHIVE, pas comme
> référence** (bandeau réécrit le 16 août 2026).
>
> Son avertissement précédent datait du 9 août et annonçait Sugar comme « la
> direction alternative, toujours entièrement résolvable et **choisissable par
> l'agent** (Réglages › Apparence › Direction) ». Les trois affirmations sont
> fausses depuis le 10 août 2026 ([PR #1194](https://github.com/megga/megga-real-estate/pull/1194)) :
> **Sugar est SUPPRIMÉE**, le réglage n'existe plus, et il n'y a plus de direction
> à choisir. Un bandeau périmé sur un document d'archive est pire que pas de
> bandeau : il donne au lecteur la confiance qu'il est à jour.
>
> ⚠ **Et il ne se contredit pas seulement avec CLAUDE.md — il se contredit avec le
> COMPILATEUR.** Ce texte prescrit `useDarkTone()` et `crmStep('s3', …)` ; les deux
> symboles ont été supprimés de `src/`, avec `crmDarkTone`, `CRM_DARK_TONES` et le
> choix de teinte. Le code qu'il enseigne ne compile pas.
>
> **Ce qui reste vrai et utile ici**, et la seule raison de ne pas supprimer le
> fichier : ⛔ ne pas écrire de littéral de rayon, d'espacement ni de taille de
> texte — ce sont des variables CSS (`--crm-radius-*`, `--crm-space-*`,
> `--crm-text-*`, cf. `src/styles/globals.css`). Cette règle-là a survécu à la
> direction qui l'a introduite.
>
> **La référence vivante est CLAUDE.md §3**, et elle seule.

## Sugar Pure — Pipeline v2 (handoff juillet 2026)

Grammaire visuelle des surfaces refondues (Pipeline kanban/liste/timeline, modale
« Nouveau deal », fiche deal V4 « Atelier scindé »). Elle PRIME sur les règles
« bento à bordure sans ombre » ci-dessous pour ces écrans :

- **Séparation par ombre douce**, aucune bordure décorative 1px. Beaucoup d'air.
- **Accent UI unique = noir** `#0B0C0E` (clair) / encre `#ECEDF3` (sombre) —
  `sp.accent` / `sp.accentInk` de `crmSugarPalette`. Aucune couleur vive en accent.
- **Teinte sombre par défaut = « Graphite »** — échelle de surfaces OPAQUES
  `#12161C` → `#21242F` en 5 paliers (`CRM_GRAPHITE`, `CRM_TOKENS.graphite`).
  Noir pur `#000000` reste offert. La teinte était **vivante** : `useDarkTone()`
  côté React (`crmDarkTone()` hors React), choisie dans Réglages › Préférences ›
  Apparence. Un littéral local passait par `crmStep('s3', '<valeur historique>')`,
  ⛔ **— TROIS SYMBOLES SUPPRIMÉS DE `src/` LE 10 AOÛT 2026, comme le choix de
  teinte lui-même. Ce paragraphe est de l'histoire ; l'écrire aujourd'hui ne
  compile pas.** L'échelle sombre vivante est celle de MEGGA X (CLAUDE.md §3), et
  ce qui subsiste de Graphite est gardé par
  [graphite-scale.spec.ts](../tests/unit/graphite-scale.spec.ts) : **un seul champ
  a encore un lecteur**.
  et une palette montée une fois doit exposer des **getters**, sinon elle fige sa
  valeur au chargement. Barème et règles : `CLAUDE.md` §Échelle sombre.
- **Teintes d'étape** : balayage continu `SG_STAGE_HUE` (indigo `#5B6BE6` →
  orange `#E8892A`, `lost` rose `#C2607E` hors funnel). Dérivations `sgMix`
  FIGÉES : fond de colonne clair `sgMix(hue,#FFF,.81)` / sombre
  `sgMix(hue,#141517,.85)` ; compteur teinté `.45→#0B0C0E` / `.35→#FFF` ;
  pilule à texte blanc `sgStagePillBg` = clair `sgMix(hue,#0B0C0E,.32)`,
  sombre teinte pure. Les pastilles 8-9 px et les barres restent en teinte pure.
- **Pilules de statut/type** : TOUJOURS fond opaque plein + texte blanc (jamais
  fond teinté clair + texte coloré, jamais de dot dans la pilule).
- **Rayons** : 999 pilule · 28 modal/bento panel · 26 cadre écran · 24 carte
  fiche · 22 carte/état vide · 20 colonne kanban · 18 carte kanban · 16 inline ·
  14 sous-carte/option · 12 input.
- **Aucune animation au survol** (pas de transform/box-shadow animés) ; au plus
  un changement de fond instantané. Surfaces sombres flottantes opaques gris
  neutre (`#17181A`, sous-surfaces `#1E1F21`, hairline `rgba(255,255,255,.07)`).
- **Typo** : Inter Tight, `font-variant-numeric: tabular-nums` sur les nombres.
- Source de vérité pixel : handoff `design_handoff_pipeline_refonte_v2`
  (README.md + crm-screen-pipeline-sugar.jsx et co).

### 4.2b Composants patterns

**Bento (container standard) :**
```tsx
<div className="rounded-xl border border-theme-border p-5">
```

**Bouton ghost (action standard) :**
```tsx
<button className="h-9 px-3.5 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">
```

**Input transparent :**
```tsx
<input className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
```

**Badge texte (pas de fond) :**
```tsx
<span className="text-xs font-medium text-red-500">Élevé</span>
```

**Dot indicateur :**
```tsx
<span className="w-2 h-2 rounded-full bg-red-500" />
```

**Actions au hover :**
```tsx
<div className="opacity-0 group-hover:opacity-100 transition-opacity">
  <button>Action</button>
</div>
```

**Modal (TOUJOURS via createPortal) :**
```tsx
{open && createPortal(
  <div className="fixed inset-0 z-[100] flex items-center justify-center">
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
    <div className="relative bg-theme-card rounded-xl border border-theme-border p-6 max-w-lg w-full mx-4">
      {/* contenu */}
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="text-sm text-theme-secondary hover:text-theme-primary">Annuler</button>
        <button className="h-9 px-4 text-sm font-medium border border-theme-border rounded-lg hover:border-theme-active">Confirmer</button>
      </div>
    </div>
  </div>,
  document.body
)}
```

**Stepper monochrome :**
```tsx
<div className="flex items-center gap-8">
  {steps.map((step, i) => (
    <button key={i} className={cn(
      "text-sm pb-2 border-b-2 transition-colors",
      i === current ? "text-theme-primary border-theme-primary font-semibold" :
      i < current ? "text-theme-secondary border-theme-primary" :
      "text-theme-muted border-transparent"
    )}>
      {i + 1}. {step}
    </button>
  ))}
</div>
```

**Pill sélectionné (type, durée, récurrence) :**
```tsx
<button className={cn(
  "h-9 px-4 rounded-lg text-sm transition-colors",
  selected ? "bg-theme-active text-theme-primary font-medium" : "text-theme-secondary hover:text-theme-primary"
)}>
```

### 4.3 Typographie

```
Font :          "DM Sans", sans-serif
                Import : https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap

Alternativement pour les titres de listings / prix :
Font display :  "Plus Jakarta Sans", sans-serif

Tailles :
- Hero titre :     text-4xl (36px) md:text-5xl (48px) — font-bold
- Page titre :     text-2xl (24px) md:text-3xl (30px) — font-semibold
- Section titre :  text-xl (20px) — font-semibold
- Card titre :     text-lg (18px) — font-semibold
- Body :           text-base (16px) — font-normal
- Small :          text-sm (14px) — font-normal
- Caption :        text-xs (12px) — font-normal text-gray-500
- Prix listing :   text-xl (20px) md:text-2xl (24px) — font-bold
```

### 4.4 Spacing & Layout

```
Page padding :     px-4 md:px-6 lg:px-8
Max width :        max-w-7xl mx-auto (1280px)
Section gap :      py-12 md:py-16
Card gap :         gap-4 md:gap-6
Card padding :     p-0 (photo plein bord) — infos en p-4
Input height :     h-11 (44px) md:h-12 (48px)
Button height :    h-10 (40px) — CTA principal h-11
Navbar height :    h-16 (64px)
Sidebar width :    w-64 (256px)
```

### 4.5 Composants clés

#### Navbar (public)
- Logo MEGGA noir à gauche
- Navigation centrée : Acheter, Louer, Vendre, Estimations, Services
- Lien actif : texte bleu accent + underline 2px
- Droite : bouton "Publier une annonce" (accent, rounded-full) + "Se connecter" (outline)
- Background blanc, shadow-navbar, sticky top-0

#### Barre de recherche IA (hero)
- Container : photo immobilière floue en arrière-plan, overlay léger
- Titre : "Trouvez votre bien idéal" en blanc, text-4xl font-bold
- Tabs : Acheter / Louer / Vendre / Estimer — style pill, sélectionné = bg-primary text-white
- Barre de recherche : bg-white rounded-xl shadow-lg, inputs inline (type, pièces, budget, localisation)
- Bouton recherche : bg-accent rounded-full, icône Search
- En dessous ou en overlay : zone de texte libre "Décrivez ce que vous cherchez..." pour la recherche IA conversationnelle

#### Listing Card
- Photo en haut, aspect-[4/3], rounded-card overflow-hidden
- Bouton favoris (cœur) en haut à droite de la photo, bg-white/80 backdrop-blur rounded-full
- Dots de navigation photos en bas de la photo
- Sous la photo : prix en font-bold text-xl, badge "Hot price" si applicable (bg-danger text-white text-xs px-2 py-0.5 rounded-badge)
- Adresse en text-secondary
- Infos : pièces · chambres · surface — text-sm text-tertiary, séparées par "·"
- Hover : shadow-card-hover, transition-shadow duration-200

#### Sidebar Agent (dashboard)
- Position fixe à gauche, bg-theme-sidebar, border-r border-theme-border
- Logo : GG centré quand replié (`w-7 h-7 mx-auto`), logo complet quand déplié
- Navigation verticale : icônes Lucide + labels (labels en opacity animée au pliage/dépliage)
- Sections : **PRINCIPAL** (Aujourd'hui, Dashboard), **CRM** (Contacts, Pipeline, Matching), **BIENS** (Mes biens, Créer un bien), **COMMUNICATION** (Messages, Calendrier), **CONFORMITÉ** (KYC, Documents, Automatisation)
- Item actif : bg-theme-active text-theme-primary font-medium
- Item hover : bg-theme-hover
- Profil agent en bas avec avatar + nom + rôle
- **Dot notification UNIQUEMENT sur Messages** (pas sur Pipeline, Matching, etc.)
- **Bouton déplier** : en bas de la sidebar, pas à côté du logo
- **Transition pliage** : `transition-[width] duration-200 ease-out`, labels en `opacity` avec `delay-75`
- **Tooltips** quand replié : nom de la page au hover de chaque icône

#### Action Board ("Quoi faire aujourd'hui")
- **C'est la page d'accueil de l'agent** — la première chose qu'il voit en se connectant
- En-tête : "Bonjour [Prénom], voici votre journée" + date
- Sections empilées par priorité :
  1. **Urgences** (bg-danger/5 border-l-4 border-danger) : deals à risque, docs manquants, relances en retard
  2. **Relances du jour** (bg-warning/5 border-l-4 border-warning) : clients à rappeler, feedbacks à demander
  3. **Matchs trouvés** (bg-accent/5 border-l-4 border-accent) : nouveaux biens compatibles avec des recherches clients
  4. **Visites à confirmer** : agenda du jour
  5. **Suggestions IA** (bg-success/5 border-l-4 border-success) : next-best-actions proposées par l'IA
- Chaque ActionCard : icône, titre, description courte, bouton d'action rapide ("Appeler", "Envoyer", "Voir le dossier")
- Compteur global en haut : "X actions recommandées aujourd'hui"

#### Contact Detail (fiche enrichie)
- En-tête : nom complet, avatar, type (badge texte), score (dot coloré), tel/email en actions rapides
- **Résumé IA** en haut : texte simple, label "estimation IA" en `text-theme-muted text-[10px]` sans fond
- **Next Best Action** : encadré vert, suggestion IA ("Proposer le 3 pièces rue du Rhône — 92% compatible")
- Tabs : Infos · Timeline · Biens envoyés · Matching · Documents · Offres
- **Timeline unifiée** : tous les événements sur une seule timeline chronologique — appels, emails, messages internes, visites, biens envoyés, notes, tâches, documents, offres, relances
- **Buyer/Seller Intelligence** : barres monochromes `bg-theme-primary`, titres en minuscule, pas d'icônes devant les labels, valeurs en texte simple (pas de badges colorés)
- Section critères de recherche : type, zone, budget (annoncé + estimé IA), pièces, surface, features
- Tags et notes libres

#### Matching Panel
- Page dédiée MatchingPage + intégré dans ContactDetailPage onglet Matching
- Cards en grid avec photos edge-to-edge (pas de padding autour de la photo)
- Chaque MatchCard : photo bien, adresse, prix, raisons du match en `text-theme-secondary` séparées par " · " (Budget · Zone · Type)
- **Modal aperçu** : clic sur une card → modal plein écran avec carrousel photos, caractéristiques, description, score de compatibilité détaillé (Budget 30/30, Zone 25/25, etc.)
- **Barres de score monochromes** (`bg-theme-primary`), pas de pourcentage affiché sur la card
- Actions : "Envoyer →" au hover de la card → ouvre SendMatchDialog (Email ou Messagerie, PAS WhatsApp)
- Tri : par score (défaut), par prix, par date
- Filtre : base interne uniquement (Phase 1) | + portails externes (Phase 2)
- **Scrollbar cachée** sur le modal aperçu

#### Pipeline Kanban
- **14 colonnes** : Nouveau lead → À qualifier → Recherche active → Visite planifiée → Visite effectuée → Intérêt confirmé → Offre → Négociation → Réservé → Financement → Notaire → Signé | Perdu | À relancer
- **Layout immersif full-height** : colonnes occupent tout l'espace vertical, header/KPIs/filtres fixes
- **Scrollbar horizontale cachée** (`.scrollbar-hide`)
- Cards de deal : avatar contact, nom contact, adresse bien, prix, date mise à jour en relatif
- Drag & drop via dnd-kit
- **Dialogue confirmation si drop sur "Perdu"** (raison obligatoire)
- **Barre KPIs en haut** : total deals actifs, valeur totale pipeline, deals à risque, taux de conversion
- **Filtres** : recherche texte, filtre par agent, filtre par étape
- Dot coloré par colonne (pas de couleur header)
- Colonnes "Perdu" et "À relancer" visuellement distinctes (opacité réduite)

#### KYC Dossier
- En-tête : nom client, type (PP/PM), niveau de risque (dot coloré + texte), statut global
- Checklist dynamique : items cochables
- **Vérification Compliance** : lignes simples avec dot vert/rouge, pas de cards colorées. "Aucune correspondance" en `text-theme-secondary` (pas en vert)
- Section documents : upload zone, liste docs avec statut, badges expiration
- Journal d'audit : timeline d'événements
- Barre de progression : % complétude
- **Human-in-the-loop** : bouton "Valider le dossier" → modal minimaliste (pas d'icône ShieldCheck, pas de bouton vert, style ghost)
- **Score de risque** : barres monochromes, facteurs détaillés, label "estimation IA"

#### Portail Vendeur
- Vue simplifiée, pas de sidebar
- Dashboard : état du mandat, visites (compteur), offres, messages
- **Dashboard de confiance** : activité récente, dynamique du bien, qualité des retours
- **Analyse positionnement** : prix au m², biens comparables, risque de stagnation, suggestion de prix
- Timeline des activités récentes
- Accès documents
- Ton rassurant : "Votre bien est entre de bonnes mains"

#### Copilot Panel (MEGGA AI)
- Accessible depuis n'importe quel écran agent (bouton flottant en bas à droite, icône Sparkles style ghost)
- Input texte : commandes en langage naturel
- Exemples : "résume-moi ce client", "rédige une relance", "quels biens envoyer à M. Dupont", "prépare un mandat", "quelles sont les prochaines actions"
- L'IA est TOUJOURS connectée au contexte réel du CRM (client actif, deal actif, page courante)
- Réponses affichées dans un panel slide-in depuis le bas avec actions cliquables

#### Messagerie
- **Layout compact** : liste threads à gauche (1/3), thread ouvert à droite (2/3)
- **Compose** : zone de rédaction en bas avec bouton pièce jointe (icône Paperclip)
- **Timestamps groupés par jour** : "Aujourd'hui", "Hier", "20 mars 2026"
- **Statut de lecture** : double check vert pour lu, check gris pour envoyé
- **Épingler/Archiver** : actions au hover sur chaque thread
- **Canaux** : Email et Messagerie interne uniquement (PAS de WhatsApp — trop complexe à installer)
- **Recherche** : barre de recherche dans la liste des threads

#### Settings (8 onglets)
- **Profil** : avatar avec modal crop (zoom, rotation, reset), nom, email (non modifiable), téléphone, rôle, langue (pills FR/DE/EN/IT), bio
- **Apparence** : couleur d'accent, densité, coins, style sidebar, taille texte
- **Agence** : infos agence, branding
- **Équipe** : liste membres, invitation (modal createPortal), rôles
- **Notifications** : toggles email/push par type, toggles en gris moyen en dark mode (pas blanc)
- **Sécurité** : mot de passe (connecté Supabase), 2FA (bientôt disponible), Google OAuth link/unlink avec feedback, sessions (bientôt disponible), journal de sécurité (connecté activity_events)
- **Abonnement** : toggle mensuel/annuel (-20%), 3 plans (Starter gratuit, Pro CHF 89, Agency CHF 249), prix barré en annuel, CTA "Besoin d'un plan sur mesure ?"
- **Applications** : style Stripe Marketplace — 12 apps en grille 4 colonnes avec logos SVG officiels, filtres par catégorie (Tous, Connectés, Calendrier, Email, CRM, Outils). Apps : Email/Resend (connecté), Google Calendar (connectable avec sync), Outlook Calendar, HubSpot, Pipedrive, Import/Export CSV, PostHog, Google Drive, OneDrive

