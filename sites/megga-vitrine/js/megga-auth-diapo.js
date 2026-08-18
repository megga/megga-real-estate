/**
 * Le diaporama du CRM de la moitié gauche de signup.html.
 *
 * Quatre vues de MEGGA s'enchaînent dans une fenêtre de navigateur pendant que
 * l'agent remplit son formulaire : la trajectoire des commissions, la
 * composition du portefeuille, les sources d'acquisition, la boucle de matching.
 * Port de la maquette Claude Design « Auth X — Diapo Concepts », dont les
 * quatre concepts deviennent ici les quatre temps d'un même défilement.
 *
 * ── Pourquoi le contenu est écrit ICI et non dans signup.html ──────────
 *
 * Parce que la vitrine se traduit en relevant les chaînes françaises du HTML
 * (scripts/vitrine-i18n.mjs) : ces quarante libellés seraient entrés dans les
 * trois dictionnaires, à traduire, alors qu'ils ne s'adressent à personne — ils
 * illustrent, comme la capture d'écran qu'ils remplacent. `parcourirTextes`
 * tient les `<script>` pour opaques, donc rien n'en sort. Le bloc est
 * `aria-hidden` pour la même raison : c'est une image, pas un texte à lire.
 *
 * ⚠ Les chiffres viennent de la maquette, VERBATIM. Ils ne sont ni mesurés ni
 * projetés : ils dessinent une capture, et une capture d'écran de démonstration
 * n'a pas d'autre source qu'elle-même. Ne pas les « corriger » avec des données
 * réelles — il n'y a aucun compte à lire depuis une page d'inscription.
 *
 * Les durées, retards et courbes sont ceux de la maquette (framer-motion),
 * retranscrits en animations CSS : chaque retard part d'ici par la variable
 * `--d`, la feuille megga-auth-diapo.css porte les `@keyframes`.
 */
(function () {
  'use strict';

  var MONTAGE = '.megga-diapo';
  var DUREE_VUE = 7000;   // séjour d'une vue — la plus longue animation finit à 2,1 s
  var DUREE_SORTIE = 250; // fondu sortant, `exit` de la maquette

  var SVG = 'http://www.w3.org/2000/svg';
  var LARGEUR_DESSIN = 1440; // la scène de la maquette, dont l'échelle 1 est l'origine
  var LARGEUR_CARTE = 440;   // la colonne de droite de `.dp-view` — la part qui informe
  var GOUTTIERE = 20;        // ce qu'on laisse au bord de l'écran à côté de la carte
  var BASCULE = 991;         // la largeur où le gabarit sort la capture de l'absolu

  /** Crée un élément : classes, attributs, style, enfants. */
  function h(tag, opts, enfants) {
    var el = document.createElement(tag);
    appliquer(el, opts, enfants);
    return el;
  }

  function s(tag, opts, enfants) {
    var el = document.createElementNS(SVG, tag);
    appliquer(el, opts, enfants);
    return el;
  }

  function appliquer(el, opts, enfants) {
    opts = opts || {};
    for (var cle in opts) {
      if (!Object.prototype.hasOwnProperty.call(opts, cle)) continue;
      var v = opts[cle];
      if (v === null || v === undefined) continue;
      if (cle === 'class') el.setAttribute('class', v);
      else if (cle === 'text') el.textContent = v;
      else if (cle === 'vars') for (var nom in v) el.style.setProperty(nom, v[nom]);
      else el.setAttribute(cle, v);
    }
    (enfants || []).forEach(function (enfant) {
      if (enfant) el.appendChild(enfant);
    });
  }

  /** L'entrée par le bas de la maquette : `rise(d)`, 0,6 s, retard `d`. */
  function monte(el, d) {
    el.classList.add('dp-rise');
    el.style.setProperty('--d', d + 's');
    return el;
  }

  // ── Les briques de la maquette ──────────────────────────────────────

  function Crm(onglet, vue, bas) {
    return h('div', { class: 'dp-crm' }, [
      h('div', { class: 'dp-chrome' }, [h('div', { class: 'dp-urlbar', text: 'crm.megga.ch' })]),
      h('div', { class: 'dp-tabs' }, ['Dashboard', 'Pipeline', 'Matching'].map(function (t) {
        return h('div', { class: 'dp-tab' + (t === onglet ? ' is-on' : ''), text: t });
      })),
      h('div', { class: 'dp-view' }, vue),
      bas,
    ]);
  }

  function Hero(o) {
    var barre = h('i', { vars: { '--dp-pace': o.pace } });
    return h('div', {}, [
      monte(h('div', { class: 'dp-eyebrow' }, [h('i', {}), document.createTextNode(o.eyebrow)]), 0.25),
      monte(h('div', { class: 'dp-big dp-num', text: o.big }), 0.32),
      monte(h('div', { class: 'dp-sub dp-num', text: o.sub }), 0.4),
      monte(h('div', {}, [
        h('div', { class: 'dp-pace' }, [barre]),
        h('div', { class: 'dp-legend' }, [
          h('span', { text: o.paceLeft }),
          h('span', { class: 'dp-num', text: o.paceRight }),
        ]),
      ]), 0.48),
      monte(h('div', { class: 'dp-chips' }, [
        h('span', { class: 'dp-chip is-primary', text: o.chips[0] }),
        h('span', { class: 'dp-chip is-ghost', text: o.chips[1] }),
      ]), 0.56),
    ]);
  }

  function Card(titre, periode, corps, d) {
    return monte(h('div', { class: 'dp-card' }, [
      h('div', { class: 'dp-card-head' }, [
        h('span', { class: 'dp-card-title', text: titre }),
        h('span', { class: 'dp-period dp-num', text: periode }),
      ]),
      corps,
    ]), d);
  }

  function Kpi(valeur, libelle, d, trace, chaud) {
    var enfants = [h('b', { class: 'dp-num', text: valeur }), h('span', { text: libelle })];
    if (trace) {
      enfants.push(s('svg', {
        class: 'dp-spark', width: '100%', height: '26',
        viewBox: '0 0 160 26', preserveAspectRatio: 'none',
      }, [
        s('path', {
          class: 'dp-draw', d: trace, fill: 'none', pathLength: '1',
          stroke: chaud ? 'var(--primary-colors--100)' : 'var(--neutral-colors--500)',
          'stroke-width': '2',
          vars: { '--d': (d + 0.5) + 's', '--dur': '1.1s' },
        }),
      ]));
    }
    return monte(h('div', { class: 'dp-kpi' }, enfants), d);
  }

  function Row(initiales, nom, droite, d) {
    return monte(h('div', { class: 'dp-rowline' }, [
      h('span', { class: 'dp-avatar', text: initiales }),
      document.createTextNode(nom),
      h('em', { class: 'dp-num', text: droite }),
    ]), d);
  }

  function Bas(kpis, lignes) {
    return h('div', { class: 'dp-lower' }, [
      h('div', { class: 'dp-kpis' }, kpis),
      monte(h('div', { class: 'dp-rowcard' }, lignes), 0.86),
    ]);
  }

  // ── Les quatre vues ─────────────────────────────────────────────────

  /** Trajectoire des commissions : le réalisé, puis la projection en pointillé. */
  function vueTrajectoire() {
    var degrade = s('defs', {}, [
      s('linearGradient', { id: 'dp-cone', x1: '0', y1: '0', x2: '0', y2: '1' }, [
        s('stop', { offset: '0', 'stop-color': '#424bfb', 'stop-opacity': '.22' }),
        s('stop', { offset: '1', 'stop-color': '#424bfb', 'stop-opacity': '0' }),
      ]),
    ]);
    var graphe = s('svg', { width: '100%', height: '196', viewBox: '0 0 400 196', preserveAspectRatio: 'none' }, [
      degrade,
      s('path', {
        class: 'dp-fade',
        d: 'M14 164 C90 152 160 130 240 102 L400 34 L400 96 L240 126 C160 148 90 160 14 164 Z',
        fill: 'url(#dp-cone)', vars: { '--d': '1.3s', '--dur': '.8s' },
      }),
      s('path', {
        class: 'dp-draw', d: 'M14 164 C90 152 160 130 240 102', fill: 'none', pathLength: '1',
        stroke: 'var(--primary-colors--100)', 'stroke-width': '3', 'stroke-linecap': 'round',
        vars: { '--d': '.7s', '--dur': '1.2s' },
      }),
      s('path', {
        class: 'dp-fade', d: 'M240 102 L400 64', fill: 'none',
        stroke: 'var(--primary-colors--100)', 'stroke-width': '2',
        'stroke-dasharray': '2 7', 'stroke-linecap': 'round',
        vars: { '--d': '1.7s', '--dur': '.6s' },
      }),
      s('circle', { class: 'dp-scale', cx: '240', cy: '102', r: '5', fill: 'var(--primary-colors--100)', vars: { '--d': '1.6s' } }),
      s('circle', {
        class: 'dp-scale', cx: '240', cy: '102', r: '11', fill: 'none',
        stroke: 'var(--primary-colors--100)', 'stroke-opacity': '.35', 'stroke-width': '2',
        vars: { '--d': '1.7s' },
      }),
    ]);
    var legende = h('div', { style: 'display:flex;gap:18px;margin-top:8px' }, [
      h('span', { class: 'dp-mini' }, [
        h('i', { class: 'dp-leg-dot', style: 'background:var(--primary-colors--100)' }),
        document.createTextNode('Réalisé'),
      ]),
      h('span', { class: 'dp-mini' }, [
        h('i', { class: 'dp-leg-dot', style: 'background:var(--neutral-colors--500)' }),
        document.createTextNode('Projection'),
      ]),
    ]);
    return Crm('Dashboard', [
      Hero({
        eyebrow: 'Commissions 2026', big: "CHF 1'840'000",
        sub: "Objectif CHF 2'400'000 reste CHF 560'000",
        pace: '64%', paceLeft: 'Réalisé', paceRight: '64 %',
        chips: ['Année', 'Trimestre'],
      }),
      Card('Trajectoire', '2026', h('div', {}, [graphe, legende]), 0.45),
    ], Bas([
      Kpi('12', 'Deals en cours', 0.7, 'M0 20 L25 16 L50 18 L75 10 L100 13 L125 6 L160 9', true),
      Kpi('38 j', 'Cycle moyen', 0.78, 'M0 8 L25 12 L50 10 L75 16 L100 14 L125 19 L160 17'),
    ], [
      Row('SL', 'Sophie Laurent', 'Visite confirmée', 0.94),
      Row('MB', 'Marc Berthoud', "Offre CHF 985'000", 1.02),
    ]));
  }

  /** Composition du portefeuille, en treemap. */
  function vuePortefeuille() {
    var tuiles = [
      { c: 'is-hot', v: "CHF 1'140'000", l: 'Appartements 62 %', d: 0.8 },
      { c: '', v: "CHF 460'000", l: 'Villas 25 %', d: 0.95 },
      { c: '', v: "CHF 240'000", l: 'Terrains 13 %', d: 1.1 },
    ];
    var treemap = h('div', { class: 'dp-tm' }, tuiles.map(function (t) {
      return h('div', { class: t.c, vars: { '--d': t.d + 's' } }, [
        h('b', { class: 'dp-num', text: t.v }),
        h('span', { text: t.l }),
      ]);
    }));
    return Crm('Dashboard', [
      Hero({
        eyebrow: 'Portefeuille', big: '24 mandats',
        sub: "CHF 68'400'000 de valeur en diffusion",
        pace: '78%', paceLeft: 'Diffusés sur Immobilier.ch', paceRight: '19 / 24',
        chips: ['Par type', 'Par canton'],
      }),
      Card('Composition des ventes', '2026', treemap, 0.45),
    ], Bas([
      Kpi('7', 'Nouveaux mandats 90 j', 0.7),
      Kpi("CHF 2'850'000", 'Prix médian', 0.78),
    ], [
      Row('GE', 'Genève', '11 mandats', 0.94),
      Row('VD', 'Vaud', '9 mandats', 1.02),
      Row('VS', 'Valais', '4 mandats', 1.1),
    ]));
  }

  /** D'où viennent les contacts, en colonnes. */
  function vueAcquisition() {
    var colonnes = [
      { n: '612', hauteur: 150, l: 'Immobilier.ch', chaud: true },
      { n: '431', hauteur: 106, l: 'Matching' },
      { n: '203', hauteur: 50, l: 'Recommandation' },
      { n: '88', hauteur: 22, l: 'Direct' },
    ];
    var graphe = h('div', { class: 'dp-cols' }, colonnes.map(function (c, i) {
      return h('div', { class: 'dp-col' + (c.chaud ? ' is-hot' : '') }, [
        monte(h('b', { class: 'dp-num', text: c.n }), 1 + i * 0.12),
        h('span', {
          class: 'dp-bar',
          style: 'height:' + c.hauteur + 'px',
          vars: { '--d': (0.8 + i * 0.12) + 's' },
        }),
        h('span', { text: c.l }),
      ]);
    }));
    return Crm('Dashboard', [
      Hero({
        eyebrow: 'Acquisition', big: "1'246 contacts",
        sub: "Le portail reste le premier canal d'entrée",
        pace: '49%', paceLeft: 'Part Immobilier.ch', paceRight: '49 %',
        chips: ['12 mois', '90 jours'],
      }),
      Card('Sources', '2025 – 2026', graphe, 0.45),
    ], Bas([
      Kpi('31 %', 'Contacts qualifiés', 0.7, 'M0 18 L30 15 L60 17 L90 11 L120 12 L160 6', true),
      Kpi('4,2 j', 'Premier rendez-vous', 0.78, 'M0 10 L30 13 L60 11 L90 16 L120 15 L160 19'),
    ], [
      Row('CL', 'Claire Fontanet', 'Immobilier.ch il y a 8 min', 0.94),
      Row('JP', 'Jean-Marc Perrin', 'Matching il y a 26 min', 1.02),
    ]));
  }

  function coeur(d) {
    return h('span', { class: 'dp-heart', vars: { '--d': d + 's' } }, [
      s('svg', { width: '15', height: '15', viewBox: '0 0 24 24', fill: '#fff' }, [
        s('path', { d: 'M12 21s-7.5-4.9-9.7-9C.8 8.7 2.4 5 6 5c2.2 0 3.4 1.2 6 3.8C14.6 6.2 15.8 5 18 5c3.6 0 5.2 3.7 3.7 7-2.2 4.1-9.7 9-9.7 9z' }),
      ]),
    ]);
  }

  /** Ce que l'acheteur a fait de la sélection qu'on lui a envoyée. */
  function vueMatching() {
    var lignes = [
      { b: "Rue du Lac 14, Vevey CHF 1'250'000", s: 'Il y a 2 min', aime: true },
      { b: "Ch. des Vignes 3, Lutry CHF 1'480'000", s: 'Il y a 14 min', aime: true },
      { b: "Av. de Cour 22, Lausanne CHF 990'000", s: 'Consulté', pct: '92 %' },
    ];
    var flux = h('div', { class: 'dp-feed' }, lignes.map(function (r, i) {
      return h('div', { class: 'dp-frow', vars: { '--d': (0.8 + i * 0.18) + 's' } }, [
        h('span', { class: 'dp-thumb' }),
        h('div', {}, [h('b', { class: 'dp-num', text: r.b }), h('span', { text: r.s })]),
        r.aime ? coeur(1.15 + i * 0.18) : h('span', { class: 'dp-pct dp-num', text: r.pct }),
      ]);
    }));
    return Crm('Matching', [
      Hero({
        eyebrow: 'Sélection envoyée', big: 'Sophie Laurent',
        sub: '6 biens transmis 3 réactions',
        pace: '50%', paceLeft: 'Consultés', paceRight: '3 / 6',
        chips: ['Voir la fiche', 'Renvoyer'],
      }),
      Card('Réactions', 'En direct', flux, 0.45),
    ], Bas([
      Kpi('87 %', "Taux d'ouverture", 0.7),
      Kpi('14', 'Sélections actives', 0.78),
    ], [
      Row('MB', 'Marc Berthoud', '2 likes 5 biens', 0.94),
      Row('AF', 'Anna Fischer', 'Ouvert hier', 1.02),
    ]));
  }

  var VUES = [vueTrajectoire, vuePortefeuille, vueAcquisition, vueMatching];

  // ── Mise à l'échelle ────────────────────────────────────────────────

  /**
   * Accorde la fenêtre à la largeur de l'écran. DEUX régimes, parce que la
   * fenêtre n'a pas le même travail à faire de part et d'autre de 991 px.
   *
   * **Au-dessus** : la règle de la maquette, `min(1, largeur / 1440)`. Elle garde
   * CONSTANTE la part de fenêtre visible (63 %) — la fenêtre déborde par la
   * gauche, donc à taille fixe un écran plus étroit n'en montrerait pas moins
   * grand, il en montrerait moins, et le bloc de titre ferré à droite finirait
   * hors champ.
   *
   * **En dessous** : la fenêtre passe sous le formulaire, et ce n'est plus la
   * scène qu'il faut accorder mais la CARTE — la colonne de 440 px qui porte le
   * graphique, seule partie encore lisible à cette taille. On ne réduit donc que
   * ce qu'il faut pour qu'elle tienne dans l'écran, gouttière comprise, et pas un
   * cran de plus : de 992 à ~500 px elle tient déjà, et la fenêtre reste à sa
   * taille de dessin. La première version appliquait la règle du bureau partout
   * et rendait 0,42 sur un téléphone — un texte de 12 px tombait à 5, soit une
   * tache grise à la place d'un tableau de bord.
   *
   * `--dp-h` est la hauteur NATURELLE du dessin, relevée à chaque vue (elles ne
   * font pas toutes la même). Une boîte réduite par `transform` continue
   * d'occuper sa place d'avant dans le flux : la feuille s'en sert pour reprendre
   * le vide sous la fenêtre, sans toucher au masque, qui reste proportionnel à la
   * boîte non réduite.
   */
  function accorder(hote) {
    var l = window.innerWidth;
    var k = l > BASCULE
      ? Math.min(1, l / LARGEUR_DESSIN)
      : Math.min(1, (l - 2 * GOUTTIERE) / LARGEUR_CARTE);
    hote.style.setProperty('--dp-scale', Math.max(0, k).toFixed(4));
    if (hote.firstChild && hote.firstChild.offsetHeight) {
      hote.style.setProperty('--dp-h', hote.firstChild.offsetHeight + 'px');
    }
  }

  // ── Le défilement ───────────────────────────────────────────────────

  function demarrer() {
    var hote = document.querySelector(MONTAGE);
    if (!hote) return;

    var i = 0;
    var minuteur = null;

    function peindre() {
      var vue = h('div', { class: 'megga-diapo__slide' }, [VUES[i]()]);
      hote.textContent = '';
      hote.appendChild(vue);
      accorder(hote);
    }

    var reduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    peindre();
    window.addEventListener('resize', function () { accorder(hote); });
    // Une seule vue, immobile : un visuel qui se remplace tout seul est
    // précisément ce que ce réglage système demande d'éviter.
    if (reduit && reduit.matches) return;

    function suivante() {
      hote.classList.add('megga-diapo--sortie');
      window.setTimeout(function () {
        i = (i + 1) % VUES.length;
        hote.classList.remove('megga-diapo--sortie');
        peindre();
      }, DUREE_SORTIE);
    }

    function relancer() {
      arreter();
      minuteur = window.setInterval(suivante, DUREE_VUE);
    }

    function arreter() {
      if (minuteur) { window.clearInterval(minuteur); minuteur = null; }
    }

    // Onglet caché : rien à montrer, et un `setInterval` qui continue réveille
    // le processeur d'une machine dont personne ne regarde l'écran. Le test à
    // l'amorçage compte autant que l'écouteur : un onglet ouvert en arrière-plan
    // (⌘-clic, restauration de session) ne reçoit AUCUN `visibilitychange` — il
    // naît caché — et la rotation y aurait tourné sans jamais être vue.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) arreter(); else relancer();
    });

    if (!document.hidden) relancer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
}());
