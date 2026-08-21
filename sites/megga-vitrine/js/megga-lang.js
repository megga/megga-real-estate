/* Vitrine MEGGA — sélecteur de langue.
 *
 * Le pied de page porte un bouton discret ; il ouvre un petit menu ancré juste
 * au-dessus, qui liste les quatre langues du produit (FR/DE/EN/IT, les mêmes
 * que le CRM). Ni fond flouté, ni titre, ni croix : choisir entre quatre
 * langues ne justifie pas de couvrir le site. Choisir une
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
   * Libellés du menu, par langue.
   *
   * Le menu est construit en JavaScript : ses propres textes ne passent pas par
   * le générateur, il faut donc les porter ici. Un menu français sur une page
   * allemande signalerait que la traduction s'arrête à la surface.
   */
  var LIBELLES = {
    fr: { titre: 'Choisir la langue', versAccueil: 'Vers l’accueil' },
    de: { titre: 'Sprache wählen', versAccueil: 'Zur Startseite' },
    en: { titre: 'Choose language', versAccueil: 'To the home page' },
    it: { titre: 'Scegli la lingua', versAccueil: 'Alla pagina iniziale' },
  };

  /**
   * Le menu de langues, construit une fois et posé sur le `body`.
   *
   * ⚠ POSÉ SUR LE `body`, ET C'EST STRUCTUREL, pas une commodité. Le pied de
   * page porte des animations Webflow IX2 qui lui écrivent un `transform` : un
   * élément `position: fixed` à l'intérieur se positionne alors par rapport à
   * cet ancêtre transformé, pas par rapport à la fenêtre. Rangé sur le `body`,
   * il n'a plus d'ancêtre transformé et le calcul redevient celui qu'on croit.
   *
   * Ce n'est plus un dialogue : ni fond flouté, ni titre, ni croix, ni page
   * verrouillée derrière. Choisir entre quatre langues ne justifie pas de
   * couvrir le site. Ce qui reste : les quatre noms, la courante en pleine
   * encre, et — seulement quand c'est vrai — la mention que la page n'existe
   * pas dans cette langue et qu'on arrivera sur son accueil.
   */
  function construireMenu(code) {
    var mots = LIBELLES[code] || LIBELLES.fr;
    var menu = document.createElement('div');
    menu.className = 'megga-lang-pop';
    menu.id = 'megga-lang-pop';
    menu.hidden = true;

    var options = LANGUES.map(function (l) {
      var courante = l.code === code;
      // Atteignable = le build a posé un alternate pour cette langue sur cette
      // page. Sur le blog ou une page légale, il n'y en a qu'un : le français.
      var traduite = courante ? null : urlDansLaLangue(l.code);
      // Pas de traduction de CETTE page → l'accueil de la langue, plutôt qu'une
      // option morte. Le menu le dit, on n'y arrive pas par surprise.
      var cible = courante ? null : (traduite || accueilDeLaLangue(l.code));
      var attrs = 'class="megga-lang-option" role="menuitem" data-langue="' + l.code + '"'
        + (cible ? ' data-cible="' + cible + '"' : '')
        + ' aria-current="' + (courante ? 'true' : 'false') + '"'
        + (l.disponible || courante ? '' : ' aria-disabled="true"');
      // Aucune mention affichée. « Langue actuelle » ne renseignait personne — le
      // bouton du pied de page nomme déjà la langue courante et l'encre pleine la
      // redit ici. « Vers l'accueil », lui, dit quelque chose de VRAI : sur le
      // blog ou les pages légales, la page n'existe pas dans l'autre langue et
      // l'on atterrit sur son accueil. Retiré de l'affichage (décision Julien),
      // il survit en `title` : rien à l'écran, mais la personne qui survole ou
      // qui écoute la page l'apprend avant de cliquer, pas après.
      var titre = (courante || traduite) ? '' : ' title="' + mots.versAccueil + '"'
        + ' aria-label="' + l.nom + ' — ' + mots.versAccueil + '"';
      return '<li role="none"><button type="button" ' + attrs + titre + '><span>' + l.nom + '</span></button></li>';
    }).join('');

    menu.innerHTML = '<ul class="megga-lang-list" role="menu" aria-label="' + mots.titre + '">' + options + '</ul>';
    return menu;
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

    var mots = LIBELLES[code] || LIBELLES.fr;
    var menu = construireMenu(code);
    document.body.appendChild(menu);

    // Le HTML des 34 pages annonce encore un dialogue ; il ouvre désormais un
    // menu. On corrige ici, là où le comportement est écrit, plutôt que de
    // repasser sur 34 fichiers pour trois attributs.
    bouton.setAttribute('aria-haspopup', 'true');
    bouton.setAttribute('aria-controls', 'megga-lang-pop');
    bouton.setAttribute('aria-expanded', 'false');
    // Lu seul, « Français » ne dit pas ce que fait le bouton.
    if (actuelle) bouton.setAttribute('aria-label', mots.titre + ' : ' + actuelle.nom);

    var focusAvant = null;

    /**
     * Pose le menu au-dessus du bouton, ou dessous s'il n'y a pas la place.
     *
     * Le bouton vit dans le pied de page, donc « au-dessus » est le cas normal ;
     * le repli existe pour les fenêtres courtes, où le pied de page arrive haut.
     */
    function placer() {
      var b = bouton.getBoundingClientRect();
      var m = menu.getBoundingClientRect();
      var marge = 8;
      var haut = b.top - m.height - marge;
      menu.style.top = (haut >= marge ? haut : b.bottom + marge) + 'px';
      menu.style.left = Math.max(marge, Math.min(b.left, window.innerWidth - m.width - marge)) + 'px';
    }

    function ouvrir() {
      focusAvant = document.activeElement;
      menu.hidden = false;
      placer();
      bouton.setAttribute('aria-expanded', 'true');
      var premier = menu.querySelector('.megga-lang-option[aria-current="true"]')
        || menu.querySelector('.megga-lang-option:not([aria-disabled="true"])');
      if (premier) premier.focus();
    }

    function fermer(rendreLeFocus) {
      if (menu.hidden) return;
      menu.hidden = true;
      bouton.setAttribute('aria-expanded', 'false');
      if (rendreLeFocus !== false && focusAvant && focusAvant.focus) focusAvant.focus();
    }

    bouton.addEventListener('click', function () {
      if (menu.hidden) ouvrir(); else fermer();
    });

    // Plus de fond qui couvre la page : c'est le document qui ferme. Un clic
    // ailleurs ne rend PAS le focus au bouton — le curseur est déjà parti, le
    // lui reprendre serait un saut non demandé.
    document.addEventListener('click', function (e) {
      if (menu.hidden) return;
      if (menu.contains(e.target) || bouton.contains(e.target)) return;
      fermer(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) fermer();
    });

    // Quitter le menu au clavier le referme, sinon il resterait ouvert derrière
    // le reste de la navigation.
    menu.addEventListener('focusout', function (e) {
      if (menu.hidden) return;
      var vers = e.relatedTarget;
      if (vers && (menu.contains(vers) || vers === bouton)) return;
      fermer(false);
    });

    // Le menu est en `fixed` : il ne suit pas la page. Tant qu'il est ouvert on
    // le replace, plutôt que de le fermer au moindre défilement.
    window.addEventListener('scroll', function () { if (!menu.hidden) placer(); }, { passive: true });
    window.addEventListener('resize', function () { if (!menu.hidden) placer(); });

    Array.prototype.forEach.call(menu.querySelectorAll('.megga-lang-option'), function (el) {
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
