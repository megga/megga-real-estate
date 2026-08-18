/* Vitrine MEGGA — la descente sur l'écran du hero.
 *
 * La maquette « Matching — couverture 3D » pose l'écran du CRM DE FACE, basculé
 * en arrière : le regard plonge dessus. Figée, cette pose n'est qu'une image.
 * Ce script la fait vivre : à mesure qu'on descend la page, l'écran se redresse
 * et se rapproche, comme si on descendait vers lui plutôt que de le voir
 * défiler. C'est la seule raison d'être du fichier.
 *
 * ⚠ IL NE TOUCHE PAS À LA MISE EN PAGE. Il n'écrit qu'un nombre, la variable
 * `--hero-descente` (0 → 1) que la feuille de style injecte dans `transform`.
 * La hauteur du hero reste celle de son `aspect-ratio` et la ligne de logos qui
 * suit ne bouge pas — c'est aussi pourquoi rien n'est épinglé en `sticky` :
 * épingler le hero rallongerait la page, ce qu'on ne veut pas.
 *
 * ⚠ Il n'écrit pas non plus `transform` directement : la pose de repos change
 * selon le point de rupture, et une valeur en ligne l'écraserait. Le script
 * déplace le curseur, la feuille garde la géométrie.
 */
(function () {
  var visuel = document.querySelector('.crm-hero-visual');
  if (!visuel) return;

  var course = 1;
  var demande = 0;
  var dernier = -1;

  /**
   * Sur quelle distance de scroll la descente se joue.
   *
   * Du haut de page jusqu'à ce que le visuel soit sorti d'un tiers par le haut :
   * au-delà l'écran quitte le champ, continuer à le redresser ne se verrait pas.
   */
  function mesurer() {
    var boite = visuel.getBoundingClientRect();
    course = Math.max(1, boite.top + window.scrollY + boite.height * 0.35);
  }

  function peindre() {
    demande = 0;
    var p = window.scrollY / course;
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    p = p * p * (3 - 2 * p); // amorti aux deux bouts : ni départ sec, ni butée
    p = Math.round(p * 1000) / 1000;
    if (p === dernier) return;
    dernier = p;
    visuel.style.setProperty('--hero-descente', p);
  }

  // Le drapeau se lève AVANT la demande, jamais avec son retour : un rAF qui
  // rappellerait tout de suite laisserait sinon le drapeau levé pour toujours.
  function planifier() {
    if (demande) return;
    demande = 1;
    requestAnimationFrame(peindre);
  }

  mesurer();
  peindre();
  window.addEventListener('scroll', planifier, { passive: true });
  window.addEventListener('resize', function () { mesurer(); planifier(); });
})();
