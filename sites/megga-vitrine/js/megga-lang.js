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
   * Où aller quand la page courante n'existe pas dans la langue demandée.
   *
   * Le blog, les pages légales et les carrières ne sont pas traduits. Les
   * langues y étaient d'abord affichées inertes — mais un sélecteur qui refuse
   * de sélectionner est une impasse : on emmène à l'accueil de la langue, en
   * l'annonçant dans le dialogue plutôt qu'en téléportant sans prévenir.
   */
  function accueilDeLaLangue(code) {
    return code === 'fr' ? '/' : '/' + code + '/';
  }

  /**
   * Libellés du dialogue, par langue.
   *
   * Le dialogue est construit en JavaScript : ses propres textes ne passent pas
   * par le générateur, il faut donc les porter ici. Une modale française sur une
   * page allemande signalerait que la traduction s'arrête à la surface.
   */
  var LIBELLES = {
    fr: { titre: 'Choisir la langue', actuelle: 'Langue actuelle', versAccueil: 'Vers l’accueil', fermer: 'Fermer' },
    de: { titre: 'Sprache wählen', actuelle: 'Aktuelle Sprache', versAccueil: 'Zur Startseite', fermer: 'Schliessen' },
    en: { titre: 'Choose language', actuelle: 'Current language', versAccueil: 'To the home page', fermer: 'Close' },
    it: { titre: 'Scegli la lingua', actuelle: 'Lingua attuale', versAccueil: 'Alla pagina iniziale', fermer: 'Chiudi' },
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
      var traduite = courante ? null : urlDansLaLangue(l.code);
      // Pas de traduction de CETTE page → l'accueil de la langue, plutôt qu'une
      // option morte. Le dialogue le dit, on n'y arrive pas par surprise.
      var cible = courante ? null : (traduite || accueilDeLaLangue(l.code));
      var attrs = 'class="megga-lang-option" data-langue="' + l.code + '"'
        + (cible ? ' data-cible="' + cible + '"' : '')
        + ' aria-current="' + (courante ? 'true' : 'false') + '"'
        + (l.disponible || courante ? '' : ' aria-disabled="true"');
      var note = courante ? '<span class="megga-lang-option__note">' + mots.actuelle + '</span>'
        : (traduite ? '' : '<span class="megga-lang-option__note">' + mots.versAccueil + '</span>');
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

  /* ── Suggestion d'après le pays du visiteur ───────────────────────────────
   *
   * Le bord sait d'où vient la requête (`/api/geo`, cf. `_worker.js`). Quand ce
   * pays désigne une autre langue que celle de la page, on le DIT — on ne
   * redirige pas.
   *
   * Pourquoi jamais de redirection automatique : les pages portent 4 alternates
   * `hreflang` chacune, et un robot d'indexation qui arrive des États-Unis
   * recevrait la version anglaise de chaque URL française. Le cluster hreflang
   * s'effondre, et le référencement multilingue avec lui. Une personne derrière
   * un VPN, elle, se retrouverait déplacée sans avoir rien demandé.
   */

  /* Langue proposée puis écartée. Clé distincte de CLE : refuser une suggestion
     n'est pas choisir une langue, et confondre les deux ferait passer un simple
     « non merci » pour une préférence à transporter jusqu'au CRM. */
  var CLE_SUGGESTION = 'megga-lang-suggestion';

  /* La réponse ne change pas d'une page à l'autre : une requête par session
     suffit, et la navigation reste instantanée. */
  var CLE_GEO = 'megga-geo';

  /* Le message est rédigé dans la langue PROPOSÉE : c'est la personne qui ne
     lit pas la page courante qu'on cherche à atteindre. */
  var SUGGESTIONS = {
    fr: { texte: 'Cette page existe en français.', oui: 'Lire en français', non: 'Non merci' },
    de: { texte: 'Diese Seite gibt es auf Deutsch.', oui: 'Auf Deutsch lesen', non: 'Nein, danke' },
    en: { texte: 'This page is available in English.', oui: 'Read in English', non: 'No thanks' },
    it: { texte: 'Questa pagina è disponibile in italiano.', oui: 'Leggi in italiano', non: 'No, grazie' },
  };

  function lireStockage(zone, cle) {
    try { return zone.getItem(cle); } catch (err) { return null; }
  }

  function ecrireStockage(zone, cle, valeur) {
    try { zone.setItem(cle, valeur); } catch (err) { /* navigation privée stricte */ }
  }

  /** Détection du bord, mise en cache pour la session. Rend null si indisponible. */
  function detecterLangue(suite) {
    var cache = lireStockage(sessionStorage, CLE_GEO);
    if (cache) {
      try { return suite(JSON.parse(cache)); } catch (err) { /* cache illisible : on redemande */ }
    }
    if (typeof fetch !== 'function') return suite(null);
    fetch('/api/geo', { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data) ecrireStockage(sessionStorage, CLE_GEO, JSON.stringify(data));
        suite(data);
      })
      .catch(function () { suite(null); });
  }

  /**
   * Affiche la barre, si et seulement si toutes les conditions sont réunies.
   *
   * Elle se tait beaucoup, et c'est le but : une suggestion qui se trompe ou qui
   * enfonce une porte ouverte coûte plus cher que pas de suggestion du tout.
   */
  function proposerLangue(code) {
    // Une langue a déjà été choisie ici : ne plus rien proposer, jamais.
    if (lireStockage(localStorage, CLE)) return;
    if (lireStockage(localStorage, CLE_SUGGESTION)) return;

    detecterLangue(function (geo) {
      if (!geo || !SUGGESTIONS[geo.language]) return;
      // `low` veut dire « on ne sait pas » : le bord n'a ni canton ni pays
      // exploitable. Proposer quand même reviendrait à inventer.
      if (geo.confidence === 'low') return;
      // Déjà dans la bonne langue.
      if (geo.language === code) return;
      // Cette page-ci n'existe pas dans la langue proposée (blog, pages
      // légales, carrières). Emmener vers l'accueil d'une autre langue quand on
      // était en train de lire un article n'est pas une aide.
      var cible = urlDansLaLangue(geo.language);
      if (!cible) return;

      var mots = SUGGESTIONS[geo.language];
      var barre = document.createElement('div');
      barre.className = 'megga-lang-suggest';
      // `aria-live` plutôt qu'un déplacement du focus : la barre arrive après
      // le premier rendu, et voler le focus à quelqu'un en pleine lecture est
      // une agression. On annonce, on n'interrompt pas.
      barre.setAttribute('role', 'region');
      barre.setAttribute('aria-live', 'polite');
      barre.setAttribute('aria-label', mots.texte);
      barre.setAttribute('lang', geo.language);

      var texte = document.createElement('p');
      texte.className = 'megga-lang-suggest__text';
      texte.textContent = mots.texte;

      var actions = document.createElement('div');
      actions.className = 'megga-lang-suggest__actions';

      var oui = document.createElement('button');
      oui.type = 'button';
      oui.className = 'megga-lang-suggest__go';
      oui.textContent = mots.oui;

      var non = document.createElement('button');
      non.type = 'button';
      non.className = 'megga-lang-suggest__no';
      non.textContent = mots.non;

      actions.appendChild(oui);
      actions.appendChild(non);
      barre.appendChild(texte);
      barre.appendChild(actions);
      document.body.appendChild(barre);

      oui.addEventListener('click', function () {
        // Accepter EST un choix de langue : il se range dans CLE, donc il
        // voyage jusqu'au CRM par le `?lang=` que megga-auth.js accroche à
        // toutes les portes. Sans ça, l'agent lirait la vitrine en allemand
        // pour atterrir dans un CRM français.
        ecrireStockage(localStorage, CLE, geo.language);
        var url = new URL(cible, location.href);
        location.href = url.pathname + location.search + location.hash;
      });

      non.addEventListener('click', function () {
        // Le refus est mémorisé : reposer la question à chaque page serait une
        // insistance, pas un service.
        ecrireStockage(localStorage, CLE_SUGGESTION, geo.language);
        barre.parentNode.removeChild(barre);
      });
    });
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

    // Le sélecteur complet reste la sortie de secours : proposer une langue ne
    // dispense pas de pouvoir en choisir une autre.
    proposerLangue(code);
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
