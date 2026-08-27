/*
 * La promotion de la feuille de polices, sortie de la page.
 *
 * Elle vivait dans un attribut `onload=` sur le <link>. C'est du JavaScript écrit dans le HTML —
 * exactement ce qu'une politique de sécurité de contenu (CSP) doit interdire, et le seul endroit
 * du site qui obligeait à laisser `script-src 'unsafe-inline'`, c'est-à-dire à laisser passer
 * n'importe quel script glissé dans une page. Pour un attribut de quatre mots, on renonçait à la
 * protection principale.
 *
 * Le comportement, lui, ne change pas : la feuille est PRÉCHARGÉE (elle ne retient pas
 * l'affichage), puis promue en feuille de style dès qu'elle est là. Si le préchargement s'est
 * terminé avant même que ce fichier ne s'exécute, l'événement `load` est déjà passé — d'où le
 * second filet au chargement de la page, qui arrive de toute façon après le premier affichage.
 */
(function () {
  "use strict";
  var lien = document.getElementById("polices");
  if (!lien) return;
  function promouvoir() {
    if (lien.rel !== "stylesheet") lien.rel = "stylesheet";
  }
  lien.addEventListener("load", promouvoir);
  window.addEventListener("load", promouvoir);
})();
