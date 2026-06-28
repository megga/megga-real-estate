# Experts MEGGA — casting des signatures (blog + page À propos)

Personas **fictifs réalistes** présentés comme les experts de MEGGA (anciens du métier qui bâtissent et conseillent depuis l'intérieur). Source de vérité unique : à réutiliser pour les bylines du blog **et** l'équipe de la page À propos. Jamais de vraie personne usurpée, jamais de fausse citation d'entreprise réelle.

Byline type : **« {Nom} · {Rôle} chez MEGGA »**.

| Initiales | Nom | Rôle chez MEGGA | Région / parcours | Pilier | Sujets |
|---|---|---|---|---|---|
| SM | **Sandra Monney** | Responsable conformité | Fribourg · ex-MLRO en régie | Conformité | LBA, KYC, LPD |
| IG | **Inès Grandjean** | Responsable produit | Genève · ex-directrice d'agence | Produit / Méthode | IA, CRM, organisation d'agence |
| NF | **Nicolas Favre** | Expert métier & adoption | Vaud · ex-courtier (14 ans) | Méthode | Vendre plus vite, mandats, pipeline |
| LG | **Laurent Genoud** | Analyste marché | Valais · terrain lémanique et valaisan | Actualité | Prix, taux, marché romand |
| DP | **Damien Perret** | Expert estimation | Neuchâtel · ex-courtier-estimateur | Méthode | Estimation, « combien vaut mon bien » |
| AC | **Aline Cretton** | Customer success & formation | Vaud (Vevey) · ex-conseillère vente | Actualité / client | Valeur locative, fiscalité, accompagnement vendeur |
| RB | **Reto Brunner** | Expert produit & automatisation | Zurich · ex-courtier | Produit / Méthode | Automatisation, intégrations, productivité |
| NK | **Nadine Keller** | Analyste marché | Bâle · ex-régie | Actualité | Marché alémanique, lecture nationale |

## Attribution des articles publiés
- `blog-posts/lba-2026-courtier-romand.html` → **Sandra Monney**
- `blog-posts/ia-agence-immobiliere-realite.html` → **Inès Grandjean**

## Page À propos
La section « L'équipe derrière MEGGA » de `about.html` affiche ces 8 experts (mêmes noms/rôles que les bylines). Avatars = placeholders CodeAI à swapper. **Une seule photo par expert**, à réutiliser sur la carte À propos ET sur la byline blog du même expert.

## Avatars (2ᵉ temps, photos fournies par le client)
Aujourd'hui l'avatar est un **rond avec initiales** (`.author-avatar`). Quand les photos arrivent :
1. Déposer `images/expert-{prenom-nom}.jpg` (carré, ≥ 256 px).
2. Dans l'en-tête de l'article, remplacer `<div class="author-avatar">XX</div>` par
   `<img class="author-avatar" src="/images/expert-{prenom-nom}.jpg" alt="{Nom}"/>`
   (la classe gère déjà `object-fit:cover` et le rond).

## Règle d'écriture
Choisir l'auteur selon le pilier de l'article. Un même expert peut signer plusieurs articles de son domaine. Ne pas faire signer un sujet hors de son expertise (ex. Sandra ne signe pas un article marché).
