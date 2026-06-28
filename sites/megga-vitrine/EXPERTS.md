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
| RB | **Reto Brunner** | Expert produit | Zurich · ex-courtier | Produit / Méthode | Automatisation, intégrations, productivité |
| NK | **Nadine Keller** | Analyste marché | Bâle · ex-régie | Actualité | Marché alémanique, lecture nationale |

## Attribution des articles publiés
- `blog-posts/lba-2026-courtier-romand.html` → **Sandra Monney**
- `blog-posts/ia-agence-immobiliere-realite.html` → **Inès Grandjean**
- `blog-posts/crm-tout-en-un-vs-outils-eparpilles.html` → **Nicolas Favre**
- `blog-posts/whatsapp-clients-immobilier.html` → **Nicolas Favre**
- `blog-posts/decrocher-plus-de-mandats.html` → **Nicolas Favre**
- `blog-posts/estimer-prix-bien-immobilier.html` → **Damien Perret**
- `blog-posts/taux-hypothecaires-acheter-attendre.html` → **Laurent Genoud**
- `blog-posts/automatiser-taches-agence-immobiliere.html` → **Reto Brunner**
- `blog-posts/fin-valeur-locative-proprietaires.html` → **Aline Cretton**
- `blog-posts/vendre-son-bien-etapes-pieges.html` → **Aline Cretton**
- `blog-posts/relancer-sans-harceler.html` → **Aline Cretton**
- `blog-posts/photos-immobilieres-annonce-vendre.html` → **Inès Grandjean**
- `blog-posts/marche-romand-alemanique.html` → **Nadine Keller** (1ʳᵉ byline)

## Page À propos
La section « L'équipe derrière MEGGA » de `about.html` affiche ces 8 experts (mêmes noms/rôles que les bylines). Avatars = placeholders CodeAI à swapper. **Une seule photo par expert**, à réutiliser sur la carte À propos ET sur la byline blog du même expert.

## Avatars (2ᵉ temps, photos fournies par le client)
Chaque expert a un **placeholder photo CodeAI**, le MÊME fichier sur la carte À propos et sur sa byline blog. Remplacer ce fichier (même nom) met à jour les deux d'un coup.

| Expert | Fichier placeholder (`images/…`) |
|---|---|
| Sandra Monney | `670f1e4e…_kathie-corl-avatar…jpg` |
| Inès Grandjean | `670f39bc…_sophie-moore-avatar…jpg` |
| Nicolas Favre | `670f39cc…_john-carter-avatar…jpg` |
| Reto Brunner | `…_matt-cannon-avatar…jpg` |
| Aline Cretton | `…_lilly-woods-avatar…jpg` |
| Laurent Genoud | `…_andy-smith-avatar…jpg` |
| Nadine Keller | `…_sandy-huston-avatar…jpg` |
| Damien Perret | `…_patrick-meyer-avatar…jpg` |

Swap : soit déposer la vraie photo (carrée, ≥ 256 px) avec le **même nom de fichier** (zéro code), soit me la donner avec un nouveau nom et je recâble les `src` (carte À propos + byline).

## Règle d'écriture
Choisir l'auteur selon le pilier de l'article. Un même expert peut signer plusieurs articles de son domaine. Ne pas faire signer un sujet hors de son expertise (ex. Sandra ne signe pas un article marché).
