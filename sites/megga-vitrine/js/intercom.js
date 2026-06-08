/* MEGGA vitrine — Intercom Messenger (anonyme, avant-vente).
 *
 * Widget de support plateforme. Région US (contrainte plan startup Intercom).
 * ⚠️ FLAG nLPD : données de support aux US — à migrer en EU sur un plan supérieur.
 * Frontière : Intercom = prospects/visiteurs SaaS, jamais les clients finaux des agents.
 *
 * INTERCOM_APP_ID = même valeur que VITE_INTERCOM_APP_ID côté CRM.
 * Vide = désactivé (la vitrine ne charge alors aucun script Intercom).
 */
(function () {
  var INTERCOM_APP_ID = 'vjffa4yt'; // App ID Intercom (région US)
  if (!INTERCOM_APP_ID) return;

  window.intercomSettings = {
    app_id: INTERCOM_APP_ID,
    region: 'us',
    api_base: 'https://api-iam.intercom.io',
  };

  // Loader officiel Intercom (boot anonyme).
  (function () {
    var w = window;
    var ic = w.Intercom;
    if (typeof ic === 'function') {
      ic('reattach_activator');
      ic('update', w.intercomSettings);
    } else {
      var d = document;
      var i = function () { i.c(arguments); };
      i.q = [];
      i.c = function (args) { i.q.push(args); };
      w.Intercom = i;
      var l = function () {
        var s = d.createElement('script');
        s.type = 'text/javascript';
        s.async = true;
        s.src = 'https://widget.intercom.io/widget/' + INTERCOM_APP_ID;
        var x = d.getElementsByTagName('script')[0];
        x.parentNode.insertBefore(s, x);
      };
      if (document.readyState === 'complete') {
        l();
      } else if (w.attachEvent) {
        w.attachEvent('onload', l);
      } else {
        w.addEventListener('load', l, false);
      }
    }
  })();
})();
