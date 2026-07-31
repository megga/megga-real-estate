/* Vitrine MEGGA — sélecteur de langue.
 *
 * Le pied de page porte une pastille ; elle ouvre un dialogue qui liste les
 * quatre langues du produit (FR/DE/EN/IT, les mêmes que le CRM). Choisir une
 * langue emmène sur la version correspondante de LA PAGE COURANTE, pas sur
 * l'accueil : on ne perd pas sa lecture en changeant de langue.
 *
 * STRUCTURE DES URLS : le français vit à la racine (`/pricing`), les autres
 * langues sous un préfixe ET un slug traduit (`/de/preise`, `/it/prezzi`).
 *
 * ⚠ LA PAGE FAIT FOI, PAS UNE RÈGLE DE CALCUL. Ce script lisait autrefois le
 * chemin courant et y collait un préfixe de langue. Il produisait donc des URLs
 * pour des pages qui n'existent pas : depuis le blog, les pages légales, les
 * carrières ou un article, « Deutsch » envoyait sur un 404 — 57 cibles mortes.
 * Désormais il lit les `<link rel="alternate" hreflang>` que le build a posés
 * dans le head : une langue sans alternate sur CETTE page n'est simplement pas
 * proposée. Les deux ne peuvent plus diverger, puisqu'il n'y a qu'une source.
 *
 * Le palier 1 ne traduit ni le blog ni les pages légales : sur ces pages, seul
 * le français est proposé, et c'est voulu.
 */
(function () {
  var LANGUES = [
    { code: 'fr', nom: 'Français', disponible: true },
    { code: 'de', nom: 'Deutsch', disponible: true },
    { code: 'en', nom: 'English', disponible: true },
    { code: 'it', nom: 'Italiano', disponible: true },
  ];

  // Même clé que le CRM (`src/i18n/index.ts`). ⚠ localStorage est cloisonné par
  // origine : megga.ch ne peut PAS écrire celui de app.megga.ch. La préférence
  // posée ici ne vaut donc que pour la vitrine ; la porter jusqu'au CRM
  // demanderait de la passer dans l'URL, comme la session.
  var CLE = 'megga-language';

  function $(sel, racine) { return (racine || document).querySelector(sel); }

  /** Langue de la page : `<html lang>`, posé par le build. */
  function langueCourante() {
    var declaree = (document.documentElement.getAttribute('lang') || 'fr').slice(0, 2).toLowerCase();
    for (var i = 0; i < LANGUES.length; i++) if (LANGUES[i].code === declaree) return declaree;
    return 'fr';
  }

  /**
   * URL de la page courante dans une autre langue, ou null si elle n'existe pas.
   *
   * Lue dans les alternates du head : c'est le build qui sait quelles pages sont
   * traduites, et lui seul. Deviner ici rouvrirait la porte aux liens morts.
   */
  function urlDansLaLangue(code) {
    var lien = $('link[rel="alternate"][hreflang="' + code + '"]');
    return lien ? lien.getAttribute('href') : null;
  }

  /**
   * Libellés du dialogue, par langue.
   *
   * Le dialogue est construit en JavaScript : ses propres textes ne passent pas
   * par le générateur, il faut donc les porter ici. Une modale française sur une
   * page allemande signalerait que la traduction s'arrête à la surface.
   */
  var LIBELLES = {
    fr: { titre: 'Choisir la langue', actuelle: 'Langue actuelle', indisponible: 'Indisponible ici', fermer: 'Fermer' },
    de: { titre: 'Sprache wählen', actuelle: 'Aktuelle Sprache', indisponible: 'Hier nicht verfügbar', fermer: 'Schliessen' },
    en: { titre: 'Choose language', actuelle: 'Current language', indisponible: 'Not available here', fermer: 'Close' },
    it: { titre: 'Scegli la lingua', actuelle: 'Lingua attuale', indisponible: 'Non disponibile qui', fermer: 'Chiudi' },
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
      // Atteignable = le build a posé un alternate pour cette langue sur cette
      // page. Sur le blog ou une page légale, il n'y en a qu'un : le français.
      var cible = courante ? null : urlDansLaLangue(l.code);
      var atteignable = courante || (l.disponible && !!cible);
      var attrs = 'class="megga-lang-option" data-langue="' + l.code + '"'
        + (cible ? ' data-cible="' + cible + '"' : '')
        + ' aria-current="' + (courante ? 'true' : 'false') + '"'
        + (atteignable ? '' : ' aria-disabled="true"');
      var note = courante ? '<span class="megga-lang-option__note">' + mots.actuelle + '</span>'
        : (atteignable ? '' : '<span class="megga-lang-option__note">' + mots.indisponible + '</span>');
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
        var cible = el.getAttribute('data-cible');
        try { localStorage.setItem(CLE, choix); } catch (err) { /* navigation privée */ }
        if (choix === code || !cible) return fermer();
        // Les alternates sont absolus (https://megga.ch/…) parce que Google les
        // veut ainsi. On ne garde que le chemin : sinon, depuis une préversion ou
        // un domaine de test, changer de langue sauterait vers la production.
        // L'ancre suit — changer de langue au milieu d'une page doit ramener au
        // même endroit, pas en haut.
        var url = new URL(cible, location.href);
        location.href = url.pathname + location.search + location.hash;
      });
    });
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
