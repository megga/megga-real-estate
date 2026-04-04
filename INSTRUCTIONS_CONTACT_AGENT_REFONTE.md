# Instructions — Refonte design section Contact Agent

> Ouvre ce fichier dans une nouvelle session Claude Code et dis : "Implémente les instructions de INSTRUCTIONS_CONTACT_AGENT_REFONTE.md"
> Tous les fichiers sont dans le repo megga-real-estate, branche main.

---

## Contexte

Un audit visuel a révélé des incohérences design dans la section "contact agent" répartie sur 4 composants. Le design system MEGGA interdit : bg-accent plein sur les boutons, shadow-xl, couleurs hardcodées, et rounded-full (sauf avatars). Voir CLAUDE.md section 4 pour les règles complètes.

Score conformité actuel : 63%. Objectif : 90%+.

---

## 1. ContactAgentModal.tsx

**Fichier :** `src/components/listing/ContactAgentModal.tsx`

### 1.1 Shadow trop forte
- Ligne 83 : remplacer `shadow-xl` par `shadow-sm`
- Le backdrop-blur de l'overlay fait déjà le travail, shadow-xl est redondant

### 1.2 Avatar trop petit
- Ligne 116 : remplacer `h-10 w-10` par `h-11 w-11` (standardiser avec ListingSidebar)

### 1.3 Pattern téléphone — aligner avec la sidebar
- Lignes 133-141 : le lien "Appeler" utilise juste `text-accent` inline
- Remplacer par le même pattern que ListingSidebar : icône dans une box `h-7 w-7 rounded-lg bg-gray-50 group-hover:bg-accent/10` avec l'icône Phone dedans
- Ça unifie l'UX entre le modal et la sidebar

### 1.4 Accessibilité bouton close
- Ligne 88 : ajouter `aria-label="Fermer"` sur le bouton X

### 1.5 Bouton Envoyer — violation design system
- Lignes 224-242 : le bouton utilise `bg-accent text-white` (INTERDIT par le design system)
- Remplacer par style ghost : `border border-gray-200 text-gray-900 font-medium hover:border-accent hover:text-accent transition-colors`
- Garder le disabled state identique (`disabled:opacity-50 disabled:cursor-not-allowed`)
- L'icône Send et le spinner restent, juste changer les couleurs (spinner border → `border-gray-300 border-t-gray-900`)

---

## 2. ListingSidebar.tsx

**Fichier :** `src/components/listing/ListingSidebar.tsx`

### 2.1 Bouton primaire "Contacter l'agent" — violation bg-accent
- Lignes 46-52 : utilise `bg-accent text-white`
- Remplacer par : `border border-gray-200 text-gray-900 font-semibold hover:border-accent hover:text-accent transition-colors`
- Garder la hauteur h-12 et l'icône Mail

### 2.2 Bouton secondaire "Planifier une visite" — hover feedback faible
- Lignes 55-61 : ajouter `hover:bg-gray-50` en plus du `hover:border-accent hover:text-accent`

### 2.3 Bouton calculateur — pas assez visible comme cliquable
- Lignes 83-89 : ajouter `border border-gray-100 rounded-lg` pour matérialiser le bouton
- Changer la hauteur de h-10 à h-11 pour l'aligner visuellement

---

## 3. ListingPreviewPanel.tsx

**Fichier :** `src/components/listing/ListingPreviewPanel.tsx`

### 3.1 Agency card #1 (overview, rechercher "Contacter →" première occurrence)
- Avatar : remplacer `w-8 h-8` par `w-10 h-10`
- Ajouter une icône ChevronRight ou flèche → à droite (ml-auto) pour indiquer que c'est cliquable
- Le texte secondaire doit afficher "Contacter →" en `text-accent text-xs font-medium`

### 3.2 Agency card #2 (sidebar desktop, rechercher "Contacter →" deuxième occurrence)
- Remplacer `border-transparent` par `border border-gray-100` (comme card #1, pour la cohérence)
- Vérifier que le hover est identique à card #1 : `hover:border-gray-200 hover:bg-gray-100`

### 3.3 CTA primaire "Planifier une visite" (rechercher "Planifier une visite" dans le sidebar desktop)
- Remplacer `bg-accent hover:bg-accent/90 text-white font-semibold` par :
  `border border-gray-200 text-gray-900 font-semibold hover:border-accent hover:text-accent`
- Retirer `shadow-sm` si présent

### 3.4 CTA secondaire "Contacter l'agent" (juste en dessous)
- Ajouter `hover:bg-gray-50` pour un feedback visuel au hover
- Vérifier que la hauteur est h-11 (pas h-12, pour marquer la hiérarchie vs le primaire)

---

## 4. ListingMobileBar.tsx

**Fichier :** `src/components/listing/ListingMobileBar.tsx`

### 4.1 Bouton contact — radius incohérent
- Chercher `rounded-full` sur le bouton contact
- Remplacer par `rounded-lg` (convention du reste de l'app)

### 4.2 Ajouter un mini agent preview (optionnel mais recommandé)
- Au-dessus des boutons CTA de la barre fixe, ajouter une ligne avec :
  - Avatar agent `w-6 h-6 rounded-full` (photo ou User icon fallback)
  - Nom de l'agent en `text-xs font-medium text-gray-900 truncate`
  - Séparé du reste par un `border-t border-gray-100 pt-2 mb-2`
- Nécessite d'ajouter `agent` dans les props du composant (actuellement il ne reçoit pas l'agent)
- Props à ajouter : `agent?: { name: string; photo: string }`

---

## 5. Nouveau composant AgentCard.tsx

**Fichier à créer :** `src/components/listing/AgentCard.tsx`

### Objectif
Remplacer les 4 implémentations différentes de l'agent card par un seul composant réutilisable.

### Props
```tsx
interface AgentCardProps {
  agent: {
    name: string
    agency: string
    phone: string
    email: string
    photo: string
  }
  variant?: 'default' | 'compact'
  onClick?: () => void
  className?: string
}
```

### Variant "default" (ListingSidebar + ContactAgentModal)
- Avatar `h-11 w-11 rounded-full` — photo réelle ou User icon dans `bg-accent/10`
- Nom en `text-sm font-semibold text-gray-900 truncate`
- Agence en `text-xs text-gray-500 truncate`
- Si phone : lien tel avec icon-box `h-7 w-7 rounded-lg bg-gray-50 group-hover:bg-accent/10`
- Si email : lien mailto avec icon-box (même pattern)

### Variant "compact" (ListingPreviewPanel cards)
- Avatar `h-10 w-10 rounded-full` — initiales de l'agence ou photo
- Nom en `text-xs font-semibold text-gray-900 truncate`
- Texte secondaire "Contacter →" en `text-xs text-accent font-medium` aligné à droite (ml-auto)
- Container : `rounded-lg bg-gray-50 border border-gray-100 hover:border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer p-3`

### Intégration
Après création, remplacer les implémentations manuelles dans :
1. `ContactAgentModal.tsx` — section agent card (lignes 114-142) → `<AgentCard variant="default" agent={agent} />`
2. `ListingSidebar.tsx` — section agent card (lignes 93-139) → `<AgentCard variant="default" agent={listing.agent} />`
3. `ListingPreviewPanel.tsx` — card #1 → `<AgentCard variant="compact" agent={...} onClick={...} />`
4. `ListingPreviewPanel.tsx` — card #2 → `<AgentCard variant="compact" agent={...} onClick={...} />`

---

## Checklist de validation

Après implémentation, vérifier :

- [ ] Aucun `bg-accent text-white` sur les boutons d'action (3 occurrences à corriger)
- [ ] Aucun `shadow-xl` (1 occurrence à corriger)
- [ ] Tous les avatars agent sont 11×11 (default) ou 10×10 (compact)
- [ ] Aucun `rounded-full` sur les boutons (sauf avatars)
- [ ] Tous les boutons ont un hover feedback visible
- [ ] `aria-label="Fermer"` sur le bouton X du modal
- [ ] Le composant AgentCard est utilisé aux 4 endroits
- [ ] `npm run build` passe sans erreur
- [ ] Tester visuellement : ouvrir `/acheter`, cliquer un bien, vérifier le modal contact
- [ ] Tester visuellement : ouvrir `/listing/market-1`, vérifier la sidebar agent
- [ ] Tester sur mobile (viewport 375px) : vérifier la barre fixe du bas
