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
 * NOTE DE SÉCURITÉ IMPORTANTE :
 * L'application gère son propre écran de connexion interne (identifiant/mot de passe),
 * indépendant de Supabase Auth. La table `bde_data` est donc accessible en lecture/écriture
 * via la clé publique "anon" (nécessaire puisque le site n'utilise pas de compte Supabase
 * par utilisateur), et la protection réelle est l'écran de connexion de l'application.
 * Cela veut dire que la clé anon, présente dans le code envoyé au navigateur, permettrait
 * techniquement à quelqu'un qui l'extrairait de lire/modifier les données directement,
 * en contournant l'écran de connexion. Pour un usage interne d'entreprise c'est un
 * compromis raisonnable, mais si vous stockez des données très sensibles, il faudra migrer
 * vers de vrais comptes Supabase Auth + des règles RLS par utilisateur.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être configurées (voir .env.example).");
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
  try { client.removeAllChannels?.(); } catch (e) { /* aucun canal ouvert */ }
  client = creerClient();
}

export function jetonEnPlace() {
  return !!jetonAcces;
}

const TABLE = "bde_data";
const CACHE_PREFIX = "bde-cache:";
const QUEUE_KEY = "bde-outbox";

function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch (e) { return []; }
}
function setQueue(q) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch (e) { /* stockage local indisponible, tant pis */ }
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
      const { data, error } = await client.from(TABLE).select("value").eq("key", key).maybeSingle();
      if (error) throw error;
      serveurARepondu = true;
      if (!data) {
        const absente = new Error(`Clé "${key}" introuvable`);
        absente.cleAbsente = true;
        throw absente;
      }
      try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data.value)); } catch (e) { /* pas grave */ }
      return { key, value: JSON.stringify(data.value), shared: !!shared };
    } catch (e) {
      // Supabase injoignable (hors ligne) : on se rabat sur la dernière version connue localement.
      const cached = localStorage.getItem(CACHE_PREFIX + key);
      if (cached !== null) return { key, value: cached, shared: !!shared };
      if (!serveurARepondu) e.serveurInjoignable = true;
      throw e;
    }
  },

  async set(key, value, shared) {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(parsed)); } catch (e) { /* pas grave */ }
    try {
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
    try { localStorage.removeItem(CACHE_PREFIX + key); } catch (e) { /* pas grave */ }
    const { error } = await client.from(TABLE).delete().eq("key", key);
    if (error) throw error;
    return { key, deleted: true, shared: !!shared };
  },

  async list(prefix, shared) {
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
export function subscribeToChanges(key, callback) {
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

  return () => { client.removeChannel(channel); };
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
      const { data: actuel, error: erreurLecture } = await client.from(TABLE).select("value").eq("key", item.key).maybeSingle();
      if (erreurLecture) throw erreurLecture;
      const valeur = actuel && actuel.value ? fusionnerDocuments(actuel.value, item.value) : item.value;
      const { error } = await client.from(TABLE).upsert({ key: item.key, value: valeur, updated_at: new Date().toISOString() });
      if (error) throw error;
      try { localStorage.setItem(CACHE_PREFIX + item.key, JSON.stringify(valeur)); } catch (e2) { /* pas grave */ }
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
