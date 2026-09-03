import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

/*
 * LA PROPOSITION D'INSTALLATION SE RATTRAPE ICI, ET NULLE PART AILLEURS.
 * ─────────────────────────────────────────────────────────────────────────────
 * Chrome n'envoie « beforeinstallprompt » qu'UNE FOIS, au chargement de la page — donc avant que
 * l'agent se connecte. Le bouton « Installer l'application », lui, vit dans le menu, qui n'existe
 * qu'APRÈS la connexion. Quand il se mettait à écouter, la proposition était passée depuis
 * longtemps et perdue : le bouton ne s'affichait jamais, sur aucun téléphone.
 *
 * C'est pourquoi l'écoute est posée ici, dans le tout premier fichier exécuté, avant même que React
 * ne s'installe. On retient la proposition dans `window`, et le menu vient la chercher au moment où
 * il apparaît.
 *
 * Elle ne peut pas être posée plus tôt encore — dans une balise <script> de la page — parce que la
 * politique de sécurité du site interdit le code écrit à même le HTML.
 */
window.__bdeInvitationInstallation = null;
window.addEventListener("beforeinstallprompt", (e) => {
  /*
   * Retenir la barre de Chrome plutôt que la laisser s'ouvrir d'elle-même, souvent au milieu d'une
   * saisie de colis avec le client en face.
   */
  e.preventDefault();
  window.__bdeInvitationInstallation = e;
  window.dispatchEvent(new Event("bde-installable"));
});
window.addEventListener("appinstalled", () => {
  window.__bdeInvitationInstallation = null;
  window.dispatchEvent(new Event("bde-installee"));
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/*
 * L'INSTALLATION SUR LE TÉLÉPHONE — et la porte de sortie qui va avec.
 * ─────────────────────────────────────────────────────────────────────────────
 * Le service worker permet à l'application de s'ouvrir sans réseau, et c'est le préalable à un
 * fichier APK : un APK ne fait qu'emballer une application web installable.
 *
 * Il s'installe sur le téléphone de chaque agent et décide ce que le navigateur reçoit. C'est un
 * pouvoir dont on ne se défait pas facilement : mal réglé, il sert une version d'il y a trois
 * semaines, et l'on ne peut pas la corriger puisque c'est lui qui décide de ce qui se télécharge.
 *
 * D'où deux précautions.
 *
 * LA PREMIÈRE : il n'est enregistré qu'en production. En développement, Vite sert les fichiers
 * autrement et un cache s'y met en travers ; on passerait la journée à se demander pourquoi une
 * correction ne s'affiche pas.
 *
 * LA SECONDE : `?sansCache=1` le désinstalle et vide tout. Si un jour l'application reste bloquée
 * sur une vieille version, cette adresse suffit à la débloquer — sans avoir à demander à chaque
 * agent d'aller vider les données du site dans les réglages de son navigateur, ce qui, en pratique,
 * ne se fait pas.
 */
if ("serviceWorker" in navigator) {
  const parametres = new URLSearchParams(window.location.search);

  if (parametres.has("sansCache")) {
    navigator.serviceWorker.getRegistrations().then(async (enregistrements) => {
      await Promise.all(enregistrements.map((r) => r.unregister()));
      if (window.caches) {
        const noms = await caches.keys();
        await Promise.all(noms.map((n) => caches.delete(n)));
      }
      console.info("Service worker retiré et caches vidés.");
    }).catch(() => {});
  } else if (import.meta.env.PROD) {
    /*
     * Après le chargement, jamais pendant : l'enregistrement demande du réseau, et le disputer au
     * premier affichage ralentirait justement l'ouverture qu'on cherche à accélérer.
     */
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((e) => {
        /* Un échec ici ne casse rien : l'application marche comme avant, sans le hors-ligne. */
        console.info("Service worker non enregistré :", e?.message || e);
      });
    });
  }
}
