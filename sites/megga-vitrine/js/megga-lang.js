/* Vitrine MEGGA — sélecteur de langue.
 *
 * Le pied de page porte une pastille ; elle ouvre un dialogue qui liste les
 * quatre langues du produit (FR/DE/EN/IT, les mêmes que le CRM). Choisir une
 * langue emmène sur la version correspondante de LA PAGE COURANTE, pas sur
 * l'accueil : on ne perd pas sa lecture en changeant de langue.
 *
 * STRUCTURE DES URLS : le français vit à la racine (`/pricing.html`), les autres
 * langues sous un préfixe (`/de/pricing.html`). C'est la forme qui se prête au
 * mieux à un site statique — un dossier par langue, aucune règle de serveur à
 * écrire, et un `hreflang` évident le jour où les pages traduites existent.
 *
 * ⚠ ÉTAT AU 31 JUIL. 2026 : FR et DE existent ; EN et IT sont listés mais
 * inertes (`disponible: false`) — servir un lien vers une page absente vaudrait
 * moins que l'annoncer. Le jour où `/en/` est peuplé, passer son drapeau à
 * `true` suffit. ⚠ Le palier 1 ne traduit PAS le blog ni les pages légales :
 * les liens vers ces pages restent en français, c'est voulu.
 */
(function () {
  var LANGUES = [
    { code: 'fr', nom: 'Français', disponible: true },
    { code: 'de', nom: 'Deutsch', disponible: true },
    { code: 'en', nom: 'English', disponible: true },
    { code: 'it', nom: 'Italiano', disponible: false },
  ];

  // Même clé que le CRM (`src/i18n/index.ts`). ⚠ localStorage est cloisonné par
  // origine : megga.ch ne peut PAS écrire celui de app.megga.ch. La préférence
  // posée ici ne vaut donc que pour la vitrine ; la porter jusqu'au CRM
  // demanderait de la passer dans l'URL, comme la session.
  var CLE = 'megga-language';
  var PREFIXES = LANGUES.filter(function (l) { return l.code !== 'fr'; })
    .map(function (l) { return '/' + l.code; });

  function $(sel, racine) { return (racine || document).querySelector(sel); }

  /** Langue de la page courante : le CHEMIN fait foi, le stockage n'est qu'un repli. */
  function langueCourante() {
    var segment = location.pathname.split('/')[1];
    for (var i = 0; i < LANGUES.length; i++) {
      if (LANGUES[i].code !== 'fr' && LANGUES[i].code === segment) return LANGUES[i].code;
    }
    return 'fr';
  }

  /** Chemin sans son préfixe de langue (`/de/pricing.html` → `/pricing.html`). */
  function cheminNeutre(chemin) {
    for (var i = 0; i < PREFIXES.length; i++) {
      var p = PREFIXES[i];
      if (chemin === p) return '/';
      if (chemin.indexOf(p + '/') === 0) return chemin.slice(p.length);
    }
    return chemin;
  }

  /** Même page, autre langue. */
  function cheminLocalise(chemin, code) {
    var neutre = cheminNeutre(chemin);
    return code === 'fr' ? neutre : '/' + code + (neutre === '/' ? '/' : neutre);
  }

  /**
   * Libellés du dialogue, par langue.
   *
   * Le dialogue est construit en JavaScript : ses propres textes ne passent pas
   * par le générateur, il faut donc les porter ici. Une modale française sur une
   * page allemande signalerait que la traduction s'arrête à la surface.
   */
  var LIBELLES = {
    fr: { titre: 'Choisir la langue', actuelle: 'Langue actuelle', bientot: 'Bientôt', fermer: 'Fermer' },
    de: { titre: 'Sprache wählen', actuelle: 'Aktuelle Sprache', bientot: 'Demnächst', fermer: 'Schliessen' },
    en: { titre: 'Choose language', actuelle: 'Current language', bientot: 'Soon', fermer: 'Close' },
    it: { titre: 'Scegli la lingua', actuelle: 'Lingua attuale', bientot: 'Presto', fermer: 'Chiudi' },
  };

  function icone(nom) {
    if (nom === 'globe') {
      return '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">'
        + '<circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" stroke-width="1.3"/>'
        + '<path d="M1.6 8h12.8M8 1.6c1.7 1.8 2.6 4 2.6 6.4S9.7 12.6 8 14.4C6.3 12.6 5.4 10.4 5.4 8S6.3 3.4 8 1.6z"'
        + ' fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
    }
    return '<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false">'
      + '<path d="M1.5 1.5 12.5 12.5M12.5 1.5 1.5 12.5" fill="none" stroke="currentColor"'
      + ' stroke-width="1.6" stroke-linecap="round"/></svg>';
  }

  function construireDialogue(code) {
    var mots = LIBELLES[code] || LIBELLES.fr;
    var modal = document.createElement('div');
    modal.className = 'megga-lang-modal';
    modal.id = 'megga-lang-modal';
    modal.hidden = true;

    var options = LANGUES.map(function (l) {
      var courante = l.code === code;
      var attrs = 'class="megga-lang-option" data-langue="' + l.code + '"'
        + ' aria-current="' + (courante ? 'true' : 'false') + '"'
        + (l.disponible ? '' : ' aria-disabled="true"');
      var note = courante ? '<span class="megga-lang-option__note">' + mots.actuelle + '</span>'
        : (l.disponible ? '' : '<span class="megga-lang-option__note">' + mots.bientot + '</span>');
      return '<li><button type="button" ' + attrs + '><span>' + l.nom + '</span>' + note + '</button></li>';
    }).join('');

    modal.innerHTML =
      '<div class="megga-lang-modal__backdrop" data-megga-lang-close></div>'
      + '<div class="megga-lang-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="megga-lang-titre">'
      + '<button class="megga-lang-modal__close" type="button" aria-label="' + mots.fermer + '" data-megga-lang-close>'
      + icone('croix') + '</button>'
      + '<h2 class="megga-lang-modal__title" id="megga-lang-titre">' + mots.titre + '</h2>'
      + '<ul class="megga-lang-list">' + options + '</ul>'
      + '</div>';
    return modal;
  }

  function init() {
    var zone = $('.footer-bottom .megga-lang-zone') || $('.footer-bottom');
    if (!zone) return;
    var bouton = $('.megga-lang-button');
    if (!bouton) return;

    var code = langueCourante();
    document.documentElement.setAttribute('lang', code);
    // Le bouton nomme la langue courante dans SA propre langue (endonyme) :
    // « Deutsch » sur une page allemande, jamais « Allemand » ni « Französisch ».
    var etiquette = bouton.querySelector('span');
    var actuelle = LANGUES.filter(function (l) { return l.code === code; })[0];
    if (etiquette && actuelle) etiquette.textContent = actuelle.nom;

    var modal = construireDialogue(code);
    document.body.appendChild(modal);

    var focusAvant = null;

    function ouvrir() {
      focusAvant = document.activeElement;
      modal.hidden = false;
      document.body.classList.add('megga-lang-open');
      var premier = modal.querySelector('.megga-lang-option:not([aria-disabled="true"])');
      if (premier) premier.focus();
    }

    function fermer() {
      modal.hidden = true;
      document.body.classList.remove('megga-lang-open');
      if (focusAvant && focusAvant.focus) focusAvant.focus();
    }

    bouton.addEventListener('click', ouvrir);

    Array.prototype.forEach.call(modal.querySelectorAll('[data-megga-lang-close]'), function (el) {
      el.addEventListener('click', fermer);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) fermer();
    });

    Array.prototype.forEach.call(modal.querySelectorAll('.megga-lang-option'), function (el) {
      el.addEventListener('click', function () {
        if (el.getAttribute('aria-disabled') === 'true') return;
        var choix = el.getAttribute('data-langue');
        try { localStorage.setItem(CLE, choix); } catch (err) { /* navigation privée */ }
        if (choix === code) return fermer();
        location.href = cheminLocalise(location.pathname, choix) + location.search;
      });
    });
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
