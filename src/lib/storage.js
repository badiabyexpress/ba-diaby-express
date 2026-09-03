/**
 * Remplace window.storage (spécifique à l'environnement Claude Artifacts) par une
 * implémentation Supabase, pour que TOUS les appareils et utilisateurs qui ouvrent
 * le site partagent réellement les mêmes données, en temps réel.
 *
 * L'API (get/set/delete/list) reste volontairement identique à window.storage pour
 * que le reste de l'application (App.jsx) n'ait presque rien à changer.
 *
 * MODE HORS-LIGNE :
 * Chaque écriture réussie met à jour un cache local (localStorage). Si l'écriture vers
 * Supabase échoue (pas de réseau), la donnée est quand même sauvegardée dans le cache local
 * ET ajoutée à une file d'attente ("outbox"). App.jsx écoute l'événement "online" du
 * navigateur et appelle flushOutbox() dès que la connexion revient, pour rejouer les
 * écritures en attente. Pendant la coupure, get() se rabat automatiquement sur le cache
 * local si Supabase est injoignable, pour que l'agent puisse continuer à travailler.
 *
 * PAR OÙ PASSENT LES DONNÉES :
 * Historiquement, ce fichier parlait directement à Supabase avec la clé publique "anon" —
 * celle qui est embarquée dans le code envoyé à chaque visiteur. La protection tenait alors
 * au seul écran de connexion de l'application : qui extrayait la clé du code lisait et
 * modifiait tout sans jamais voir cet écran.
 *
 * Il existe désormais une seconde voie : api/donnees.js, côté serveur, qui détient seul la clé
 * de service et n'ouvre qu'à un jeton de session délivré après vérification du mot de passe.
 * Quand cette voie répond, la clé publique ne sert plus à rien — ce qui permet de fermer la
 * base et de rendre cette clé inutile à qui l'extrairait. Quand elle ne répond pas (fonction
 * absente ou non configurée), tout repasse par l'accès direct, comme avant : les deux chemins
 * coexistent pour qu'aucun déploiement ne laisse l'application sans accès à ses données.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn("VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être configurées (voir .env.example).");
}

/*
 * Jeton de session délivré par api/login.js après vérification du mot de passe côté serveur.
 *
 * Sans jeton, le client fonctionne comme avant, avec la seule clé publique — c'est le cas tant que
 * la fonction serveur n'est pas configurée. Avec jeton, chaque appel part signé « authenticated »,
 * ce qui permettra aux politiques de la base de n'accorder l'accès qu'aux personnes réellement
 * connectées, au lieu de l'accorder à quiconque détient la clé publiée dans le navigateur.
 */
let jetonAcces = null;

function creerClient() {
  // Le mode vitrine et les tests locaux doivent pouvoir démarrer sans Supabase configuré.
  // Le client sera créé dès que les deux variables existent ; les appels métier retomberont
  // alors sur leur gestion d’erreur/cache habituelle au lieu de faire planter le module au chargement.
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY,
    jetonAcces ? { global: { headers: { Authorization: `Bearer ${jetonAcces}` } } } : undefined);
}

let client = creerClient();

/** Le client courant. Passer par cette fonction : la référence change quand le jeton change. */
export function clientSupabase() {
  return client;
}

/**
 * Installe (ou retire, avec null) le jeton de session. Le client est recréé pour que l'en-tête
 * accompagne aussi bien les lectures et écritures que le canal temps réel.
 */
export function definirJetonAcces(jeton) {
  if (jeton === jetonAcces) return;
  jetonAcces = jeton || null;
  try { client?.removeAllChannels?.(); } catch (e) { /* aucun canal ouvert */ }
  client = creerClient();
}

export function jetonEnPlace() {
  return !!jetonAcces;
}

const TABLE = "bde_data";
const CACHE_PREFIX = "bde-cache:";
const QUEUE_KEY = "bde-outbox";

/*
 * UN TIROIR PAR ESPACE, PARCE QU'IL Y A TROIS DOCUMENTS
 *
 * Depuis que le serveur ne rend à un client — ou à un partenaire — que ce qui le concerne (voir
 * api/_cloisonnement.js), le document qu'il garde en cache n'est plus celui de l'entreprise :
 * c'est une vue réduite à ses propres colis. Or le cache et la file d'attente sont rangés dans le
 * stockage du navigateur, qui est le même pour tous les espaces d'un même site.
 *
 * Sur un appareil où deux d'entre eux servent — l'ordinateur de l'agence, où l'on ouvre le portail
 * pour montrer son espace à un client — un agent hors ligne se serait donc rabattu sur la vue du
 * client, et l'aurait rejouée à la reconnexion. Il aurait effacé toute l'entreprise en croyant
 * enregistrer un colis. Chaque espace a donc son propre tiroir.
 *
 * Le rôle est lu dans le jeton sans être vérifié : il ne s'agit pas d'accorder un droit — le
 * serveur s'en charge, et lui seul — mais de choisir un tiroir. Se tromper de tiroir ne donne
 * accès à rien de plus ; c'est le mélange qu'on veut éviter.
 */
let tiroir = "";
function tiroirDuJeton(jeton) {
  if (typeof jeton !== "string" || !jeton.includes(".")) return "";
  try {
    let corps = jeton.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    // base64url ne porte pas son bourrage ; atob l'exige.
    while (corps.length % 4) corps += "=";
    const octets = Uint8Array.from(atob(corps), (c) => c.charCodeAt(0));
    const charge = JSON.parse(new TextDecoder().decode(octets));
    if (charge?.role === "client") return "client:";
    if (charge?.role === "Partenaire") return "partenaire:";
    return "";
  } catch (e) { return ""; }
}
function cleCache(key) { return `${CACHE_PREFIX}${tiroir}${key}`; }

/*
 * ÉCRIRE LE CACHE, OU L'EFFACER — JAMAIS LE LAISSER PÉRIMÉ.
 *
 * Le stockage d'un navigateur est petit, et il se remplit. Quand `setItem` échoue — quota
 * dépassé, mode privé, stockage refusé — l'échec était avalé : « pas grave ». Il l'était.
 * L'ancienne version restait en place, et c'est elle que la lecture suivante servait si le réseau
 * hésitait une seconde. L'application repartait alors sur un document d'il y a des semaines en le
 * croyant frais — puis le réenregistrait par-dessus le vrai. C'est ainsi qu'une page se retrouve
 * à proposer un répertoire vide à chaque geste.
 *
 * Un cache qu'on ne peut pas tenir à jour est donc effacé. Perdre le mode hors-ligne vaut mieux
 * que travailler sur une base périmée sans le savoir.
 */
function ecrireCache(key, valeur) {
  const cle = cleCache(key);
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch (e) {
    try { localStorage.removeItem(cle); } catch (e2) { /* rien à faire de plus */ }
    console.error("Cache local non écrit — il est effacé plutôt que laissé périmé.", e);
    return false;
  }
}

/*
 * LA VERSION QUE LA PAGE A LUE — celle qu'elle renverra en enregistrant.
 *
 * Le serveur s'en sert pour savoir si quelqu'un a écrit entre-temps. Sans elle, il ne peut pas
 * distinguer « je modifie ce que je viens de lire » de « je repose ce que je crois savoir ».
 */
const versionsLues = new Map();
export function versionLue(key) { return versionsLues.get(key) || null; }

/**
 * EFFACER LA COPIE LOCALE DES DONNÉES — à la déconnexion volontaire, et là seulement.
 *
 * Le cache est ce qui permet d'ouvrir l'application sans réseau. Pour un agent, il contient le
 * document de travail : les clients, leurs téléphones, leurs adresses, les colis, les factures. Il
 * restait sur l'appareil après la déconnexion — si bien qu'un ordinateur d'agence partagé, ou un
 * téléphone rendu, gardait le fichier clients à disposition du suivant.
 *
 * Le coût est nul. Pour se reconnecter il faut du réseau, et avec du réseau le cache se
 * reconstitue à la première lecture : il n'y a rien à perdre entre les deux.
 *
 * CE QUI N'EST PAS EFFACÉ : LA FILE D'ATTENTE.
 *
 * `bde-outbox` porte le travail enregistré hors ligne et pas encore parti — des colis, des
 * encaissements. L'effacer serait perdre du travail, c'est-à-dire l'exact contraire du but
 * poursuivi ici. On ne touche qu'aux clés de cache, jamais à elle.
 *
 * ET SEULEMENT SUR UNE DÉCONNEXION VOULUE.
 *
 * Une expiration automatique n'appelle pas cette fonction : elle survient souvent en pleine
 * tournée, et un agent qui reprend son téléphone doit retrouver de quoi travailler. La menace que
 * l'on ferme ici est celle de l'appareil qu'on remet à quelqu'un — et cela passe toujours par le
 * bouton.
 */
export function oublierCacheLocal() {
  let effacees = 0;
  try {
    const aEffacer = [];
    for (let i = 0; i < localStorage.length; i++) {
      const cle = localStorage.key(i);
      if (cle && cle.startsWith(CACHE_PREFIX)) aEffacer.push(cle);
    }
    /* On collecte avant de supprimer : retirer une clé pendant qu'on parcourt en saute une. */
    aEffacer.forEach((cle) => { localStorage.removeItem(cle); effacees++; });
  } catch (e) { /* stockage indisponible : il n'y a alors rien qui traîne */ }
  /*
   * Les numéros de version vont avec le cache. Les garder ferait annoncer au serveur « je modifie
   * la version 12 » alors qu'on n'a plus rien lu du tout.
   */
  versionsLues.clear();
  return effacees;
}
function cleFile() { return `${QUEUE_KEY}${tiroir ? `:${tiroir.replace(/:$/, "")}` : ""}`; }

/* ------------------------------------------------------------------------------------------
 * LA VOIE SERVEUR
 *
 * Le jeton ci-dessus s'adresse à Supabase ; celui-ci s'adresse à nos propres fonctions. Quand il
 * est là et que api/donnees.js est configuré, lectures et écritures passent par le serveur, qui
 * détient seul la clé de service. La clé publique embarquée dans la page ne sert alors plus à
 * rien — et c'est ce qui permet de fermer la base au public sans que l'application s'arrête.
 *
 * Tant que ce n'est pas le cas — fonction absente, non configurée, ou personne de connecté — tout
 * repasse par l'accès direct, exactement comme avant. Aucune bascule à faire à la main : le code
 * marche des deux côtés, ce qui autorise à déployer d'abord et à fermer la base ensuite.
 * ---------------------------------------------------------------------------------------- */

let jetonSession = null;
/** null = pas encore su, true/false = réponse du serveur. Remis à zéro à chaque changement de jeton. */
let voieServeurDisponible = null;

export function definirJetonSession(jeton) {
  if (jeton === jetonSession) return;
  jetonSession = jeton || null;
  voieServeurDisponible = null;
  // Le tiroir suit le jeton : changer d'espace change de cache, sans jamais mélanger les deux.
  tiroir = tiroirDuJeton(jetonSession);
}

/*
 * Le jeton courant, pour les fonctions serveur qui ne passent pas par ce fichier.
 *
 * WhatsApp, e-mail, l'assistant et les taux de change dépensent de l'argent ou du quota à chaque
 * appel : ils doivent savoir qui les appelle, et ce jeton est ce qui le leur dit. Il ne s'agit pas
 * de contourner l'API ci-dessous — c'est simplement que ces appels-là ne lisent ni n'écrivent la
 * base, et n'ont donc rien à faire dans storage.
 */
export function jetonSessionCourant() {
  return jetonSession;
}

/*
 * Prévenir l'application que son jeton n'est plus accepté.
 *
 * Sans cela, une session expirée ressemblerait à une panne de réseau : l'application basculerait
 * en mode local et y resterait, avec des données figées et des enregistrements qui s'accumulent
 * sans jamais partir. Un refus du serveur n'est pas une coupure — c'est une session à rouvrir, et
 * il faut le dire à celui qui travaille.
 */
let rappelSessionExpiree = null;
export function surSessionExpiree(rappel) { rappelSessionExpiree = rappel; }

async function appelServeur(chemin, options = {}) {
  if (!jetonSession) return { indisponible: true };
  if (voieServeurDisponible === false) return { indisponible: true };
  let reponse;
  try {
    reponse = await fetch(`/api/donnees${chemin}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jetonSession}`, ...(options.headers || {}) },
    });
  } catch (e) {
    /*
     * Réseau coupé : ce n'est PAS « la voie serveur n'existe pas ». La retenir comme indisponible
     * ferait repartir l'application sur l'accès direct pour le reste de la session, alors qu'il
     * sera tout aussi coupé — et, une fois la base fermée, définitivement muet.
     */
    return { indisponible: true, reseau: true };
  }
  /*
   * 501 : fonction en ligne mais pas configurée. 404 sans corps JSON : fonction pas déployée.
   * Les deux se retiennent — inutile de retenter à chaque lecture.
   */
  if (reponse.status === 501) { voieServeurDisponible = false; return { indisponible: true }; }
  let corps = null;
  try { corps = await reponse.json(); } catch (e) { corps = null; }
  if (reponse.status === 404 && !corps) { voieServeurDisponible = false; return { indisponible: true }; }
  if (reponse.status === 401) {
    // Session expirée : le jeton ne vaut plus rien, autant l'oublier tout de suite.
    jetonSession = null;
    voieServeurDisponible = null;
    try { rappelSessionExpiree?.(); } catch (e) { /* l'appelant se débrouillera */ }
    return { indisponible: true, sessionExpiree: true };
  }
  voieServeurDisponible = true;
  return { reponse, corps, ok: reponse.ok };
}

function getQueue() {
  try { return JSON.parse(localStorage.getItem(cleFile()) || "[]"); } catch (e) { return []; }
}
function setQueue(q) {
  try { localStorage.setItem(cleFile(), JSON.stringify(q)); } catch (e) { /* stockage local indisponible, tant pis */ }
}

export const storage = {
  async get(key, shared) {
    /*
     * « La clé n'existe pas » et « je n'ai pas pu demander » sont deux réponses différentes, et
     * les confondre coûte cher : croire la base vide alors qu'elle est seulement injoignable
     * conduit à la remplacer par une base neuve. L'erreur porte donc la distinction, et
     * l'appelant décide — semer une base de départ, oui ; l'écrire par-dessus des données qu'on
     * n'a pas réussi à lire, jamais.
     */
    let serveurARepondu = false;
    try {
      const parServeur = await appelServeur(`?cle=${encodeURIComponent(key)}`);
      if (!parServeur.indisponible) {
        if (parServeur.corps?.cleAbsente) {
          serveurARepondu = true;
          const absente = new Error(`Clé "${key}" introuvable`);
          absente.cleAbsente = true;
          throw absente;
        }
        if (!parServeur.ok) throw new Error(parServeur.corps?.error || "Lecture impossible");
        serveurARepondu = true;
        const valeur = parServeur.corps?.value;
        versionsLues.set(key, parServeur.corps?.updated_at || null);
        ecrireCache(key, valeur);
        return { key, value: JSON.stringify(valeur), shared: !!shared };
      }

      const { data, error } = await client.from(TABLE).select("value").eq("key", key).maybeSingle();
      if (error) throw error;
      serveurARepondu = true;
      if (!data) {
        const absente = new Error(`Clé "${key}" introuvable`);
        absente.cleAbsente = true;
        throw absente;
      }
      ecrireCache(key, data.value);
      return { key, value: JSON.stringify(data.value), shared: !!shared };
    } catch (e) {
      /*
       * Supabase injoignable (hors ligne) : on se rabat sur la dernière version connue localement.
       *
       * ET ON LE DIT. Ce repli revenait comme une lecture ordinaire : l'application refermait son
       * mode hors-ligne, affichait ce vieux document comme la vérité du jour, et le réenregistrait
       * au premier geste. `ducache` permet à l'appelant de continuer à travailler tout en sachant
       * qu'il ne tient pas la version du serveur.
       */
      const cached = localStorage.getItem(cleCache(key));
      if (cached !== null) return { key, value: cached, shared: !!shared, ducache: true };
      if (!serveurARepondu) e.serveurInjoignable = true;
      throw e;
    }
  },

  async set(key, value, shared) {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    ecrireCache(key, parsed);
    try {
      const parServeur = await appelServeur(`?cle=${encodeURIComponent(key)}`, {
        /*
         * `baseVersion` : l'horodatage de la version sur laquelle cette page a travaillé. Le
         * serveur écrit sous condition — si la ligne a bougé depuis, il refait sa fusion sur la
         * version fraîche plutôt que de laisser cette page reposer la sienne par-dessus.
         */
        method: "PUT", body: JSON.stringify({ value: parsed, baseVersion: versionsLues.get(key) || null }),
      });
      if (!parServeur.indisponible) {
        if (!parServeur.ok) throw new Error(parServeur.corps?.error || "Enregistrement impossible");
        /*
         * Le document vient de changer : la version que nous avions n'est plus la bonne. On
         * l'oublie plutôt que d'annoncer au prochain enregistrement une version dépassée — le
         * serveur la relira de toute façon, et une version fausse ferait crier au conflit à tort.
         */
        versionsLues.delete(key);
        return { key, value, shared: !!shared };
      }
      const { error } = await client.from(TABLE).upsert({ key, value: parsed, updated_at: new Date().toISOString() });
      if (error) throw error;
      return { key, value, shared: !!shared };
    } catch (e) {
      /*
       * L'écriture a échoué : la donnée reste dans le cache local et rejoint la file d'attente,
       * qui sera rejouée automatiquement.
       *
       * On retourne `queued: true` plutôt que de lever une erreur : l'application ne doit pas
       * interrompre le travail de l'agent pour une coupure passagère. En revanche l'appelant
       * DOIT vérifier ce drapeau — sans quoi il croirait le travail enregistré alors qu'il ne
       * l'est pas encore, ce qui est exactement le cas dangereux pour un encaissement.
       */
      const q = getQueue();
      q.push({ key, value: parsed, ts: Date.now() });
      setQueue(q);
      return { key, value, shared: !!shared, queued: true };
    }
  },

  async delete(key, shared) {
    try { localStorage.removeItem(cleCache(key)); } catch (e) { /* pas grave */ }
    const parServeur = await appelServeur(`?cle=${encodeURIComponent(key)}`, { method: "DELETE" });
    if (!parServeur.indisponible) {
      if (!parServeur.ok) throw new Error(parServeur.corps?.error || "Suppression impossible");
      return { key, deleted: true, shared: !!shared };
    }
    const { error } = await client.from(TABLE).delete().eq("key", key);
    if (error) throw error;
    return { key, deleted: true, shared: !!shared };
  },

  async list(prefix, shared) {
    const parServeur = await appelServeur(`?liste=${encodeURIComponent(prefix || "")}`);
    if (!parServeur.indisponible) {
      if (!parServeur.ok) throw new Error(parServeur.corps?.error || "Lecture impossible");
      return { keys: parServeur.corps?.keys || [], prefix, shared: !!shared };
    }
    let query = client.from(TABLE).select("key");
    if (prefix) query = query.like("key", `${prefix}%`);
    const { data, error } = await query;
    if (error) throw error;
    return { keys: (data || []).map((r) => r.key), prefix, shared: !!shared };
  },
};

/**
 * S'abonne aux changements en temps réel d'une clé donnée (ex: "bde-data").
 * callback(newValueString) est appelé à chaque fois qu'un AUTRE appareil/onglet modifie la donnée,
 * pour que l'application puisse rafraîchir son état sans que l'utilisateur ait à recharger la page.
 * Retourne une fonction "unsubscribe" à appeler au démontage du composant.
 */
/*
 * Intervalle de vérification quand la base est fermée au public.
 *
 * Vingt secondes : assez court pour qu'un agent voie arriver le colis que son collègue vient
 * d'enregistrer sans se poser de question, assez long pour ne pas vider la batterie d'un
 * téléphone laissé ouvert toute la journée sur le tableau de bord.
 */
const SECONDES_VERIFICATION = 20;

/*
 * Le remplacement de l'abonnement temps réel, une fois la base fermée.
 *
 * Le canal temps réel de Supabase parle à la clé publique. Fermer la base le coupe : c'est le
 * prix de la fermeture, et il faut le payer sans perdre ce qu'il apportait — l'écran d'un agent
 * qui se met à jour quand un collègue enregistre un colis, sans recharger la page.
 *
 * On demande donc au serveur la seule date de dernière modification, et on ne redescend le
 * document que lorsqu'elle a changé. Un appel qui ne rapporte qu'un horodatage coûte à peu près
 * rien ; c'est le document entier, toutes les vingt secondes, qui aurait été déraisonnable.
 */
function suivreParInterrogation(key, callback) {
  let arrete = false;
  let derniere = null;
  let minuteur = null;

  async function verifier() {
    if (arrete) return;
    const tete = await appelServeur(`?cle=${encodeURIComponent(key)}&tete=1`);
    if (arrete) return;
    if (tete.indisponible) { programmer(); return; }
    const marque = tete.corps?.updated_at || null;
    if (marque && derniere && marque !== derniere) {
      const complet = await appelServeur(`?cle=${encodeURIComponent(key)}`);
      if (arrete) return;
      if (!complet.indisponible && complet.ok && complet.corps?.value !== undefined) {
        /* Le document redescendu devient la version de référence de cette page. */
        versionsLues.set(key, complet.corps?.updated_at || marque);
        ecrireCache(key, complet.corps.value);
        callback(JSON.stringify(complet.corps.value));
      }
    }
    if (marque) derniere = marque;
    programmer();
  }
  function programmer() {
    if (arrete) return;
    minuteur = setTimeout(verifier, SECONDES_VERIFICATION * 1000);
  }

  verifier();
  return () => { arrete = true; if (minuteur) clearTimeout(minuteur); };
}

export function subscribeToChanges(key, callback) {
  // Aucun abonnement n’est possible en prévisualisation locale sans Supabase ; l’interface publique
  // reste fonctionnelle et les appels de données afficheront leur état de configuration.
  if (!client && !jetonSession) return () => {};
  /*
   * Le choix se fait à l'usage, pas sur une configuration : au premier appel on ne sait pas
   * encore si la voie serveur répond. On interroge, et on branche l'un ou l'autre selon la
   * réponse — ce qui évite d'avoir à déclarer quelque part dans quel mode on tourne.
   */
  if (jetonSession && voieServeurDisponible !== false) {
    let arreterSuivi = null;
    let annule = false;
    appelServeur(`?cle=${encodeURIComponent(key)}&tete=1`).then((tete) => {
      if (annule) return;
      if (tete.indisponible && !tete.reseau) { arreterSuivi = abonnementTempsReel(key, callback); return; }
      arreterSuivi = suivreParInterrogation(key, callback);
    });
    return () => { annule = true; if (arreterSuivi) arreterSuivi(); };
  }
  return abonnementTempsReel(key, callback);
}

function abonnementTempsReel(key, callback) {
  if (!client) return () => {};
  const channel = client
    .channel(`bde_data_changes_${key}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE, filter: `key=eq.${key}` },
      (payload) => {
        if (payload.new && payload.new.value !== undefined) {
          callback(JSON.stringify(payload.new.value));
        }
      }
    )
    .subscribe();

  return () => { client?.removeChannel?.(channel); };
}

/*
 * Fusionne la version du serveur et celle qui attend dans la file.
 *
 * Toutes les données de l'application tiennent dans un seul document. Rejouer bêtement celui qu'un
 * agent a modifié hors ligne écraserait donc tout ce que ses collègues ont enregistré pendant sa
 * coupure — leurs colis, leurs encaissements, disparus sans un mot. C'est le même accident que
 * celui qu'on vient de corriger, à l'envers.
 *
 * On réunit donc les deux versions liste par liste, par identité : ce qui n'existe que chez l'un
 * est conservé, ce qui existe des deux côtés prend la version de l'agent qui revient — c'est lui
 * qui a travaillé dessus en dernier à sa connaissance. Aucune ligne ne disparaît. Une fusion
 * parfaite serait impossible sans horodater chaque champ ; celle-ci garantit au moins qu'on ne
 * perd rien, ce qui est le seul point qui compte.
 */
const CLES_IDENTITE = ["id", "tracking", "numero", "cle", "key"];
function identiteDe(element) {
  if (!element || typeof element !== "object" || Array.isArray(element)) return null;
  const cle = CLES_IDENTITE.find((k) => typeof element[k] === "string" || typeof element[k] === "number");
  return cle ? `${cle}:${element[cle]}` : null;
}
function listeIdentifiable(valeur) {
  return Array.isArray(valeur) && valeur.length > 0 && valeur.every((x) => identiteDe(x) !== null);
}
export function fusionnerDocuments(serveur, local) {
  if (!serveur || typeof serveur !== "object" || Array.isArray(serveur)) return local;
  if (!local || typeof local !== "object" || Array.isArray(local)) return local;
  const sortie = { ...serveur, ...local };
  Object.keys(sortie).forEach((cle) => {
    const cotéServeur = serveur[cle];
    const cotéLocal = local[cle];
    /*
     * UNE LISTE VIDE NE REMPLACE JAMAIS UNE LISTE PLEINE.
     *
     * `{ ...serveur, ...local }` donnait raison au local sur toute la ligne — y compris quand le
     * local était un tableau vide. Une écriture mise en file par une page qui n'avait pas encore
     * chargé les comptes clients rejouait donc « zéro compte » par-dessus les huit du serveur, et
     * la fusion ne s'y opposait pas : elle ne regarde que les listes identifiables, et une liste
     * vide n'en est pas une.
     */
    if (Array.isArray(cotéLocal) && cotéLocal.length === 0 && Array.isArray(cotéServeur) && cotéServeur.length > 0) {
      sortie[cle] = cotéServeur;
      return;
    }
    if (!listeIdentifiable(cotéServeur) || !listeIdentifiable(cotéLocal)) return;
    const parIdentite = new Map();
    cotéServeur.forEach((x) => parIdentite.set(identiteDe(x), x));
    cotéLocal.forEach((x) => parIdentite.set(identiteDe(x), x));
    /*
     * L'ordre suit la version locale — c'est celle que l'agent a sous les yeux — et ce que le
     * serveur avait en plus vient ensuite, sans quoi ces lignes se retrouveraient reléguées.
     */
    const vues = new Set();
    const fusion = [];
    cotéLocal.forEach((x) => { const i = identiteDe(x); if (!vues.has(i)) { vues.add(i); fusion.push(parIdentite.get(i)); } });
    cotéServeur.forEach((x) => { const i = identiteDe(x); if (!vues.has(i)) { vues.add(i); fusion.push(parIdentite.get(i)); } });
    sortie[cle] = fusion;
  });
  return sortie;
}

/**
 * Rejoue toutes les écritures mises en file d'attente pendant une coupure réseau.
 * Ne garde que la DERNIÈRE écriture par clé (inutile de rejouer des versions intermédiaires
 * dépassées). Appelée automatiquement par App.jsx dès que l'événement "online" se déclenche.
 */
export async function flushOutbox() {
  const q = getQueue();
  if (q.length === 0) return { flushed: 0 };
  const latestByKey = {};
  q.forEach((item) => { latestByKey[item.key] = item; });
  let flushed = 0;
  const stillFailed = [];
  for (const key of Object.keys(latestByKey)) {
    const item = latestByKey[key];
    try {
      /*
       * On relit d'abord ce que le serveur porte : si des collègues ont travaillé pendant la
       * coupure, leur travail est là, et l'écraser serait le perdre. Si la relecture échoue, on
       * ne pousse rien — mieux vaut retenter plus tard que remplacer à l'aveugle.
       */
      let surLeServeur = null;
      const lecture = await appelServeur(`?cle=${encodeURIComponent(item.key)}`);
      if (!lecture.indisponible) {
        if (!lecture.ok && !lecture.corps?.cleAbsente) throw new Error("Relecture impossible");
        surLeServeur = lecture.corps?.value ?? null;
      } else {
        const { data: actuel, error: erreurLecture } = await client.from(TABLE).select("value").eq("key", item.key).maybeSingle();
        if (erreurLecture) throw erreurLecture;
        surLeServeur = actuel?.value ?? null;
      }
      const valeur = surLeServeur ? fusionnerDocuments(surLeServeur, item.value) : item.value;
      const ecriture = await appelServeur(`?cle=${encodeURIComponent(item.key)}`, {
        method: "PUT", body: JSON.stringify({ value: valeur }),
      });
      if (!ecriture.indisponible) {
        if (!ecriture.ok) throw new Error("Enregistrement impossible");
      } else {
        const { error } = await client.from(TABLE).upsert({ key: item.key, value: valeur, updated_at: new Date().toISOString() });
        if (error) throw error;
      }
      ecrireCache(item.key, valeur);
      flushed++;
    } catch (e) {
      stillFailed.push(item); // toujours hors ligne ou erreur ponctuelle : on retente au prochain retour de connexion
    }
  }
  setQueue(stillFailed);
  return { flushed, remaining: stillFailed.length };
}

/** Nombre d'écritures en attente de synchronisation — utilisé pour afficher le badge dans l'interface. */
export function pendingSyncCount() {
  return getQueue().length;
}

/**
 * Relire le document SUR LE SERVEUR, sans jamais se rabattre sur le cache.
 *
 * POURQUOI CETTE FONCTION EXISTE
 * ------------------------------
 * `storage.get` fait exactement l'inverse, et c'est voulu : quand le réseau tombe, mieux vaut la
 * dernière version connue qu'un écran vide. Mais pour VÉRIFIER qu'une écriture est bien arrivée,
 * ce repli est un piège — `storage.set` écrit le cache AVANT d'appeler le serveur, si bien qu'une
 * relecture qui accepte le cache retrouverait toujours ce qu'on vient de saisir, même si le
 * serveur n'en a jamais entendu parler. Elle confirmerait un enregistrement qui n'a pas eu lieu.
 *
 * Celle-ci ne répond donc que ce que le serveur a dit, et annonce franchement son échec.
 *
 * Retourne { valeur } si le serveur a répondu, { injoignable: true } sinon. Ne lève pas : ne pas
 * pouvoir vérifier n'est pas une erreur de l'agent, et son colis est peut-être bien enregistré.
 */
export async function relireDuServeur(key = "bde-data") {
  const parServeur = await appelServeur(`?cle=${encodeURIComponent(key)}`);
  if (parServeur.indisponible) return { injoignable: true };
  if (parServeur.corps?.cleAbsente) return { valeur: null };
  if (!parServeur.ok) return { injoignable: true };
  versionsLues.set(key, parServeur.corps?.updated_at || null);
  return { valeur: parServeur.corps?.value ?? null };
}
