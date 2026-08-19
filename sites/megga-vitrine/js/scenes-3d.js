/* Vitrine MEGGA — les scènes 3D pilotées par le défilement.
 *
 * Deux scènes, un seul moteur. Le hero (« Votre CRM se pilote depuis
 * WhatsApp ») et le tableau de bord (« Tout votre métier sur un seul écran »)
 * sont posés inclinés par la feuille de style ; ce script les redresse à mesure
 * qu'on descend. Dans les deux cas le mouvement DIT quelque chose — la descente
 * pour l'un, l'écran qui se présente pour l'autre — il ne décore pas.
 *
 * ⚠ IL NE TOUCHE PAS À LA MISE EN PAGE. Chaque scène n'écrit qu'un nombre, la
 * variable CSS que la feuille injecte dans `transform`. Les hauteurs restent
 * celles des `aspect-ratio`, rien n'est épinglé en `sticky` : épingler
 * rallongerait la page.
 *
 * ⚠ Il n'écrit jamais `transform` directement : la pose de repos change selon
 * le point de rupture, et une valeur en ligne l'écraserait. Le script déplace
 * le curseur, la feuille garde la géométrie.
 *
 * ⚠ ET LES DEUX SCÈNES NE SE MESURENT PAS PAREIL, parce qu'elles ne racontent
 * pas la même chose. Le hero est en haut de page : sa course part du chargement.
 * Le tableau de bord est au milieu : la sienne part de son entrée dans la
 * fenêtre et s'achève quand il est centré — là où on le regarde vraiment.
 */
(function () {
  var SCENES = [
    { selecteur: '.crm-hero-visual', variable: '--hero-descente', mesure: 'depuisLeHaut' },
    { selecteur: '.dash-3d', variable: '--dash-face', mesure: 'traversee' },
  ];

  /**
   * Du haut de page jusqu'à ce que l'élément soit sorti d'un tiers par le haut :
   * au-delà il quitte le champ, continuer à le redresser ne se verrait pas.
   */
  function depuisLeHaut(rect, y) {
    return y / Math.max(1, rect.top + y + rect.height * 0.35);
  }

  /**
   * De l'instant où le haut de l'élément entre par le bas de la fenêtre
   * jusqu'à celui où son centre atteint le centre de la fenêtre. Une fois
   * redressé, il le reste : le rebasculer en sortie donnerait un balancement
   * que personne n'a demandé.
   */
  function traversee(rect) {
    var vh = window.innerHeight || 1;
    return (vh - rect.top) / Math.max(1, vh / 2 + rect.height / 2);
  }

  var MESURES = { depuisLeHaut: depuisLeHaut, traversee: traversee };
  var vivantes = [];

  SCENES.forEach(function (def) {
    var el = document.querySelector(def.selecteur);
    if (el) vivantes.push({ el: el, variable: def.variable, mesure: MESURES[def.mesure], dernier: -1 });
  });
  if (!vivantes.length) return;

  var demande = 0;

  /**
   * ⚠ LA COURSE SE RECALCULE À CHAQUE IMAGE, elle n'est pas mise en cache.
   * Une version antérieure la mesurait une fois au chargement : le bandeau qui
   * précède le tableau de bord porte des images en `lazy`, qui le décalent de
   * 460px une fois arrivées. La course restait alors celle d'avant, et l'écran
   * se redressait 460px trop tôt jusqu'au premier redimensionnement. Deux
   * `getBoundingClientRect` par image ne coûtent rien ; une mesure périmée, si.
   */
  function peindre() {
    demande = 0;
    var y = window.scrollY;
    vivantes.forEach(function (s) {
      var p = s.mesure(s.el.getBoundingClientRect(), y);
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      p = p * p * (3 - 2 * p); // amorti aux deux bouts : ni départ sec, ni butée
      p = Math.round(p * 1000) / 1000;
      if (p === s.dernier) return;
      s.dernier = p;
      s.el.style.setProperty(s.variable, p);
    });
  }

  // Le drapeau se lève AVANT la demande, jamais avec son retour : un rAF qui
  // rappellerait tout de suite laisserait sinon le drapeau levé pour toujours.
  function planifier() {
    if (demande) return;
    demande = 1;
    requestAnimationFrame(peindre);
  }

  peindre();
  window.addEventListener('scroll', planifier, { passive: true });
  window.addEventListener('resize', planifier);
  // Les images qui arrivent après coup déplacent les scènes : on repeint quand
  // la page a fini de charger, sans quoi la pose de départ resterait celle d'un
  // document plus court.
  window.addEventListener('load', planifier);
})();
