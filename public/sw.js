/*
 * LE SERVICE WORKER — ouvrir l'application sans réseau, sans jamais servir de vieilles données
 * ─────────────────────────────────────────────────────────────────────────────
 * Ce fichier a un pouvoir désagréable : il s'installe sur le téléphone de chaque agent et décide
 * ce que le navigateur reçoit. Mal écrit, il sert une version d'il y a trois semaines sans que
 * personne comprenne pourquoi, et l'on ne peut pas le corriger — puisque c'est lui qui décide de
 * ce qui est téléchargé. C'est pourquoi tout ce qui suit est écrit en négatif : ce qu'il NE FAIT
 * PAS compte davantage que ce qu'il fait.
 *
 * IL NE TOUCHE JAMAIS AUX DONNÉES.
 *
 * Ni /api/, ni Supabase, ni aucune requête qui n'est pas un GET. Un colis enregistré, un paiement
 * encaissé, un transfert créé passent par le réseau et par rien d'autre. Servir une réponse mise
 * en cache à la place d'un enregistrement, ce serait perdre du travail — et cette application a
 * déjà perdu des données deux fois cet été.
 *
 * LA PAGE PASSE PAR LE RÉSEAU D'ABORD.
 *
 * On tente le réseau ; s'il répond, c'est sa réponse qui gagne, et la copie est rafraîchie. C'est
 * ce qui garantit qu'un déploiement est pris en compte à la seconde où il y a du réseau. Le cache
 * n'entre en jeu qu'en cas d'échec — hors ligne, ou une 4G qui ne répond pas — et il sert alors à
 * ouvrir l'application au lieu d'afficher « pas de connexion ».
 *
 * LES FICHIERS DE CODE, EUX, VIENNENT DU CACHE.
 *
 * Vite leur donne un nom qui contient l'empreinte de leur contenu — « index-D3Mz4UNV.js ». Un
 * fichier de ce nom ne changera jamais : le mettre en cache pour toujours est sans risque, et
 * c'est ce qui rend l'ouverture instantanée sur une connexion lente. Une nouvelle version porte un
 * nouveau nom, donc une nouvelle demande.
 */

/*
 * Le numéro de version. Le changer efface les anciens caches à l'activation — c'est la sortie de
 * secours si quelque chose tourne mal ici.
 */
const VERSION = "bde-v1";
const CACHE_PAGES = `${VERSION}-pages`;
const CACHE_FICHIERS = `${VERSION}-fichiers`;

/*
 * Ce qui ne passe JAMAIS par ce fichier. La liste est volontairement large : dans le doute, on
 * laisse passer au réseau. Une requête servie du réseau est au pire lente ; une requête servie
 * d'un cache peut être fausse.
 */
function neJamaisIntercepter(url) {
  return url.pathname.startsWith("/api/")
    || url.hostname.endsWith(".supabase.co")
    || url.hostname.endsWith(".resend.com")
    || url.hostname.endsWith("facebook.com")
    || url.pathname.startsWith("/.well-known/");
}

self.addEventListener("install", (e) => {
  /*
   * On ne précharge rien. Précharger la page ici la figerait à la version du jour de
   * l'installation, et il faudrait attendre une visite pour la rafraîchir. Elle se met en cache
   * toute seule à la première ouverture réussie.
   */
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n)));
    /*
     * On prend la main tout de suite plutôt que d'attendre la fermeture de tous les onglets. Sans
     * cela, une correction urgente attendrait qu'un agent pense à fermer son navigateur — ce qui
     * n'arrive pas.
     */
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const requete = e.request;
  if (requete.method !== "GET") return;

  const url = new URL(requete.url);
  if (neJamaisIntercepter(url)) return;

  /*
   * LA NAVIGATION : le réseau d'abord, le cache en secours.
   *
   * `mode === "navigate"` couvre l'ouverture de l'application et chaque changement d'adresse.
   * C'est une application à page unique : toute adresse rend la même page.
   */
  if (requete.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const reponse = await fetch(requete);
        const cache = await caches.open(CACHE_PAGES);
        cache.put("/", reponse.clone());
        return reponse;
      } catch (erreur) {
        const cache = await caches.open(CACHE_PAGES);
        const gardee = await cache.match("/");
        if (gardee) return gardee;
        throw erreur;
      }
    })());
    return;
  }

  /*
   * LES FICHIERS DE CODE ET LES IMAGES : le cache d'abord.
   *
   * Uniquement ceux dont le nom porte une empreinte de contenu, ou nos propres images. Tout le
   * reste — y compris les polices d'un autre domaine — passe au réseau comme avant : ce n'est pas
   * à ce fichier de décider pour des choses qu'il ne connaît pas.
   */
  const memeOrigine = url.origin === self.location.origin;
  const estFichierDeCode = memeOrigine && url.pathname.startsWith("/assets/");
  const estImageAnous = memeOrigine && /\.(png|jpg|jpeg|svg|webp|ico)$/i.test(url.pathname);
  if (!estFichierDeCode && !estImageAnous) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE_FICHIERS);
    const gardee = await cache.match(requete);
    if (gardee) return gardee;
    const reponse = await fetch(requete);
    /*
     * On ne garde que ce qui a réellement abouti. Mettre une erreur en cache, c'est la servir
     * indéfiniment — et rendre la panne permanente.
     */
    if (reponse && reponse.ok && reponse.status === 200) cache.put(requete, reponse.clone());
    return reponse;
  })());
});

/*
 * LA SORTIE DE SECOURS.
 *
 * Si ce fichier devait un jour servir quelque chose de faux, l'application peut lui demander de se
 * retirer : elle envoie « au-revoir », il se désinscrit et vide tout. Sans ce message, il faudrait
 * demander à chaque agent d'aller vider les données du site dans les réglages de son navigateur.
 */
self.addEventListener("message", (e) => {
  if (e.data !== "au-revoir") return;
  e.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.map((n) => caches.delete(n)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll();
    clients.forEach((c) => c.navigate(c.url));
  })());
});
