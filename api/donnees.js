/**
 * Fonction serverless Vercel — la base, vue par une personne connectée.
 *
 * POURQUOI CE FICHIER
 * -------------------
 * C'est la dernière porte à fermer. Les lots précédents ont retiré la base aux visiteurs :
 * la vitrine et le suivi passent par api/public.js, qui ne donne que ce qui est affiché. Mais
 * l'application elle-même, une fois connectée, lisait et écrivait encore la base directement,
 * avec la clé publique embarquée dans le code envoyé au navigateur. Tant que c'est le cas, la
 * base doit rester ouverte à cette clé — et quiconque l'extrait du code obtient tout, sans
 * jamais voir l'écran de connexion.
 *
 * Ici, c'est le serveur qui lit et écrit, avec la clé de service qui ne quitte jamais le
 * serveur. Le navigateur présente le jeton de session délivré par api/login.js. La clé publique
 * ne sert donc plus à rien, et la base peut être fermée : elle ne répondra plus qu'à la clé de
 * service, c'est-à-dire à ce fichier.
 *
 * VARIABLES D'ENVIRONNEMENT
 * -------------------------
 *   SUPABASE_URL                 adresse du projet (à défaut VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY    clé de service — SECRET, jamais préfixée par VITE_
 *
 * Tant que la clé de service est absente, la fonction répond 501 et l'application retombe sur
 * son accès direct, comme avant : elle peut être mise en ligne sans rien casser, et c'est la
 * configuration des variables qui l'active.
 *
 * L'ORDRE DES OPÉRATIONS COMPTE
 * -----------------------------
 * Cette fonction doit être en ligne ET configurée AVANT de resserrer les politiques de la base.
 * Dans l'autre sens, l'application perdrait l'accès à ses données le temps du déploiement.
 * GET ?etat=1 sert précisément à vérifier que tout est en place avant de fermer.
 */

import { sessionDeLaRequete } from "./_session.js";
import {
  vueClient, fusionnerEcritureClient,
  vuePartenaire, fusionnerEcriturePartenaire, partenaireDuCompte,
} from "./_cloisonnement.js";

const TABLE = "bde_data";

function configuration() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    cle: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export default async function handler(req, res) {
  const { url, cle } = configuration();

  /*
   * L'état de configuration se consulte sans jeton : c'est une question sur le serveur, pas sur
   * les données. Elle ne révèle rien — seulement si la voie serveur est utilisable, ce que le
   * navigateur découvrirait de toute façon au premier appel.
   */
  if (req.method === "GET" && req.query?.etat !== undefined) {
    return res.status(200).json({ configure: !!(url && cle) });
  }

  if (!url || !cle) {
    return res.status(501).json({
      error: "Accès serveur aux données non configuré",
      manquantes: [!url && "SUPABASE_URL", !cle && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean),
    });
  }

  const session = sessionDeLaRequete(req);
  if (!session) return res.status(401).json({ error: "Session absente ou expirée." });

  /*
   * Seules les clés de l'application sont accessibles ici : le document vivant et ses sauvegardes.
   *
   * Sans cette limite, toute personne connectée — y compris un client, et n'importe qui peut
   * créer un compte client — pourrait demander n'importe quelle clé de la table, dont
   * `bde-reinit`, où dorment les codes de réinitialisation en attente. Ce serait leur donner de
   * quoi prendre le contrôle des comptes des autres.
   */
  const clef = String(req.query?.cle || "bde-data");
  if (clef !== "bde-data" && !clef.startsWith("bde-backup-")) {
    return res.status(403).json({ error: "Clé non accessible." });
  }

  /*
   * DEUX COMPTES QUI NE SONT PAS DE LA MAISON
   *
   * Le client, d'abord : n'importe qui peut en créer un depuis la page d'accueil — c'est fait
   * pour. Le partenaire ensuite, qui est une entreprise tierce. Tous deux présentent un jeton
   * valide, exactement comme un agent : sans la distinction qui suit, ils obtenaient le document
   * entier, avec les colis de tous les clients, le répertoire, la caisse et les empreintes de
   * mots de passe des employés.
   *
   * Trois portes se ferment ici, avant même de toucher à la base :
   *
   *   — les sauvegardes. Ce sont des copies complètes du document : les laisser lire rendrait
   *     inutile tout le tri fait plus bas. C'est le contournement le plus évident, et le seul qui
   *     n'aurait laissé aucune trace ;
   *   — la liste des clés, qui apprend quelles sauvegardes existent ;
   *   — la suppression, qui n'a aucun usage légitime depuis ces espaces, et dont le seul emploi
   *     possible serait d'effacer le document de l'entreprise.
   *
   * Le tri du contenu, lui, se fait dans api/_cloisonnement.js — en lecture comme en écriture.
   */
  const estClient = session.role === "client";
  const estPartenaire = session.role === "Partenaire";
  const cloisonne = estClient || estPartenaire;
  const compteId = session.sub || null;
  if (cloisonne) {
    if (clef !== "bde-data") return res.status(403).json({ error: "Clé non accessible." });
    if (req.method === "DELETE") return res.status(403).json({ error: "Suppression non autorisée." });
    if (req.method === "GET" && req.query?.liste !== undefined) {
      return res.status(403).json({ error: "Liste non accessible." });
    }
  }

  const entetes = { apikey: cle, Authorization: `Bearer ${cle}`, "Content-Type": "application/json" };

  try {
    if (req.method === "GET" && req.query?.liste !== undefined) {
      /* Les sauvegardes automatiques ont besoin de connaître les clés existantes pour effacer les
       * plus anciennes. On ne renvoie que les noms — jamais le contenu. */
      const prefixe = String(req.query.liste || "");
      // Même raison que ci-dessus : une liste sans préfixe révélerait les clés réservées.
      if (!prefixe.startsWith("bde-backup-")) {
        return res.status(403).json({ error: "Liste non accessible." });
      }
      const reponse = await fetch(
        `${url}/rest/v1/${TABLE}?select=key&key=like.${encodeURIComponent(`${prefixe}%`)}`,
        { headers: entetes },
      );
      if (!reponse.ok) return res.status(502).json({ error: "Base de données injoignable" });
      const lignes = await reponse.json();
      return res.status(200).json({ keys: (Array.isArray(lignes) ? lignes : []).map((r) => r.key) });
    }

    if (req.method === "DELETE") {
      const reponse = await fetch(
        `${url}/rest/v1/${TABLE}?key=eq.${encodeURIComponent(clef)}`,
        { method: "DELETE", headers: { ...entetes, Prefer: "return=minimal" } },
      );
      if (!reponse.ok) return res.status(502).json({ error: "Suppression impossible" });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "GET") {
      /*
       * `tete` ne rapporte que la date de dernière modification. C'est ce qui remplace l'abonnement
       * temps réel : une base fermée ne diffuse plus ses changements à la clé publique, et faire
       * redescendre le document entier toutes les vingt secondes pour constater qu'il n'a pas
       * bougé coûterait cher à tout le monde — au forfait comme aux téléphones des agents.
       */
      const tete = req.query?.tete !== undefined;
      const champs = tete ? "updated_at" : "value,updated_at";
      const reponse = await fetch(
        `${url}/rest/v1/${TABLE}?key=eq.${encodeURIComponent(clef)}&select=${champs}`,
        { headers: entetes },
      );
      if (!reponse.ok) {
        console.error("Lecture impossible", reponse.status);
        return res.status(502).json({ error: "Base de données injoignable" });
      }
      const lignes = await reponse.json();
      const ligne = Array.isArray(lignes) ? lignes[0] : null;
      if (!ligne) return res.status(404).json({ error: "Donnée absente", cleAbsente: true });
      if (tete) return res.status(200).json({ updated_at: ligne.updated_at || null });
      const valeurLue = estClient ? vueClient(ligne.value, compteId)
        : estPartenaire ? vuePartenaire(ligne.value, partenaireDuCompte(ligne.value, compteId))
          : ligne.value;
      return res.status(200).json({ value: valeurLue, updated_at: ligne.updated_at || null });
    }

    if (req.method === "PUT" || req.method === "POST") {
      const corps = req.body || {};
      const valeur = typeof corps.value === "string" ? JSON.parse(corps.value) : corps.value;
      /*
       * Une écriture sans contenu effacerait tout. Le cas n'a aucun usage légitime, et c'est
       * exactement la forme que prend l'accident : un état vide envoyé au démarrage par une
       * application qui n'a pas réussi à lire.
       */
      if (valeur === undefined || valeur === null) {
        return res.status(400).json({ error: "Contenu absent — écriture refusée." });
      }

      /*
       * Un compte cloisonné n'écrit jamais le document : il propose des modifications, et le
       * serveur ne retient que celles qui portent sur ce qui est à lui.
       *
       * On relit donc la version en base juste avant, et l'on repose dessus les seuls fragments
       * autorisés. Le portail, lui, ne change pas d'un iota : il envoie toujours le document
       * entier tel qu'il le connaît — c'est-à-dire la vue réduite qu'on lui a donnée. Sans cette
       * relecture, cette vue réduite écraserait la vraie, et l'entreprise perdrait tout ce qu'elle
       * avait justement caché. C'est le point le plus dangereux de la manœuvre.
       */
      let aEcrire = valeur;
      if (cloisonne) {
        const lecture = await fetch(
          `${url}/rest/v1/${TABLE}?key=eq.${encodeURIComponent(clef)}&select=value`,
          { headers: entetes },
        );
        if (!lecture.ok) return res.status(502).json({ error: "Base de données injoignable" });
        const lignesActuelles = await lecture.json();
        const actuel = Array.isArray(lignesActuelles) ? lignesActuelles[0]?.value : null;
        /*
         * Pas de document en base : il n'y a rien sur quoi reposer une modification, et écrire
         * une vue réduite à la place du document de l'entreprise serait le pire des accidents.
         * On refuse plutôt que de deviner.
         */
        if (!actuel) return res.status(409).json({ error: "Données introuvables — écriture refusée." });
        aEcrire = estClient
          ? fusionnerEcritureClient(actuel, valeur, compteId)
          : fusionnerEcriturePartenaire(actuel, valeur, partenaireDuCompte(actuel, compteId), compteId);
      }

      const reponse = await fetch(
        `${url}/rest/v1/${TABLE}?on_conflict=key`,
        {
          method: "POST",
          headers: { ...entetes, Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ key: clef, value: aEcrire, updated_at: new Date().toISOString() }),
        },
      );
      if (!reponse.ok) {
        const detail = await reponse.text().catch(() => "");
        console.error("Écriture impossible", reponse.status, detail);
        return res.status(502).json({ error: "Enregistrement impossible" });
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Méthode non autorisée" });
  } catch (e) {
    console.error("Échec de l'accès aux données", e);
    return res.status(502).json({ error: "Base de données injoignable" });
  }
}
