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

import { sessionDeLaRequete, empreinteDuCompte } from "./_session.js";
import {
  vueClient, fusionnerEcritureClient,
  vuePartenaire, fusionnerEcriturePartenaire, partenaireDuCompte,
  fusionnerEcritureEquipe, vueEquipeZone,
} from "./_cloisonnement.js";
import { envoyerAlerteEcrasement } from "./_alerte.js";

const TABLE = "bde_data";

/*
 * LE JETON VAUT-IL ENCORE ?
 * ─────────────────────────────────────────────────────────────────────────────
 * Un jeton signé prouve qu'on s'est connecté — pas qu'on a encore le droit d'entrer. Il valait
 * douze heures quoi qu'il arrive : changer le mot de passe n'y faisait rien, supprimer le compte
 * non plus. Pour un téléphone perdu ou quelqu'un qui part fâché, c'était une demi-journée d'accès
 * complet APRÈS la décision de le lui retirer.
 *
 * On confronte donc l'empreinte que porte le jeton à celle du compte tel qu'il est maintenant.
 * Trois refus possibles, et les trois comptent :
 *
 *   — le compte a disparu : il n'y a plus personne derrière ce jeton ;
 *   — l'empreinte a changé : mot de passe changé, ou sessions révoquées à la main ;
 *   — le jeton n'en porte aucune : il date d'avant cette protection. On le refuse plutôt que de
 *     laisser une porte ouverte à ceux qui étaient déjà connectés — ils se reconnectent une fois.
 */
function jetonPerime(document, session) {
  if (!document || typeof document !== "object") return null;   // rien à comparer : on ne bloque pas
  const liste = session.role === "client" ? document.clientAccounts : document.users;
  const compte = (Array.isArray(liste) ? liste : []).find((c) => c && c.id === session.sub);
  if (!compte) return "Ce compte n’existe plus.";
  if (!session.emp) return "Session ouverte avant la mise à jour de sécurité. Reconnectez-vous.";
  if (session.emp !== empreinteDuCompte(compte)) return "Session révoquée. Reconnectez-vous.";
  return null;
}

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
      /*
       * ON NE SUPPRIME QUE DES SAUVEGARDES.
       *
       * Cette porte acceptait n'importe quelle clé autorisée — y compris `bde-data`, c'est-à-dire
       * le document de l'entreprise. Une seule requête, faite depuis n'importe quelle session
       * d'équipe, effaçait tout : les colis, les clients, la caisse, le journal. Et elle passait
       * à côté du garde-fou de _cloisonnement.js, qui ne protège que les ÉCRITURES — il n'y avait
       * plus de document à protéger.
       *
       * Aucun écran n'en a besoin : la seule suppression que fait l'application est la rotation
       * des vieilles sauvegardes. On la limite donc à ce qu'elle sert réellement.
       */
      if (!clef.startsWith("bde-backup-")) {
        return res.status(403).json({ error: "Seules les sauvegardes peuvent être supprimées." });
      }
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
      /*
       * La lecture d'entête est laissée passer sans contrôle, et c'est délibéré : elle ne rend
       * qu'une date de dernière modification — rien qui appartienne à quiconque — et elle est
       * demandée toutes les vingt secondes par chaque appareil connecté. La faire précéder d'une
       * lecture du document entier coûterait bien plus qu'elle ne protège. Le premier vrai
       * chargement, lui, est contrôlé, et c'est celui qui porte les données.
       */
      if (tete) return res.status(200).json({ updated_at: ligne.updated_at || null });
      if (clef === "bde-data") {
        const perime = jetonPerime(ligne.value, session);
        if (perime) return res.status(401).json({ error: perime, sessionRevoquee: true });
      }
      const valeurLue = estClient ? vueClient(ligne.value, compteId)
        : estPartenaire ? vuePartenaire(ligne.value, partenaireDuCompte(ligne.value, compteId))
          : vueEquipeZone(ligne.value, compteId);
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
      /*
       * L'équipe, elle, reçoit et réécrit le document entier — c'est son travail. On part donc de
       * ce qu'elle envoie, et l'on remet en place ce que son rôle ne l'autorisait pas à changer :
       * les droits des comptes, les réglages, et le journal, qui ne se réécrit pas.
       *
       * Cela vaut pour le document vivant seulement. Une sauvegarde est écrite d'un bloc par la
       * rotation automatique : la passer dans ce tamis n'aurait aucun sens.
       */
      let aEcrire = valeur;
      /*
       * L'alerte à envoyer, s'il y en a une. Elle est repérée ici mais expédiée APRÈS l'écriture :
       * prévenir d'un refus avant d'avoir remis les données en place laisserait une fenêtre où le
       * message dit « vos données sont intactes » alors que rien n'est encore enregistré.
       */
      let alerteAEnvoyer = null;
      if (!cloisonne && clef === "bde-data") {
        const lecture = await fetch(
          `${url}/rest/v1/${TABLE}?key=eq.${encodeURIComponent(clef)}&select=value`,
          { headers: entetes },
        );
        if (!lecture.ok) return res.status(502).json({ error: "Base de données injoignable" });
        const lignesActuelles = await lecture.json();
        const actuel = Array.isArray(lignesActuelles) ? lignesActuelles[0]?.value : null;
        // Première écriture d'une base neuve : il n'y a pas encore de règles à faire respecter.
        if (actuel) {
          /*
           * Le jeton est confronté au compte AVANT la fusion : un jeton révoqué ne doit pas
           * pouvoir écrire, et c'est l'écriture qui fait le plus de dégâts.
           */
          const perime = jetonPerime(actuel, session);
          if (perime) return res.status(401).json({ error: perime, sessionRevoquee: true });
          aEcrire = fusionnerEcritureEquipe(actuel, valeur, compteId, {
            appareil: req.headers["user-agent"] || "",
            adresse: String(req.headers["x-forwarded-for"] || "").split(",")[0].trim(),
          });
          /*
           * Une alerte est nouvelle si son identifiant n'était pas déjà en base. On la reconnaît
           * ainsi plutôt qu'en comparant les longueurs : la page renvoie sa propre copie de la
           * liste, et compter ne dirait rien de fiable.
           */
          const connues = new Set(
            (Array.isArray(actuel.alertesEcrasement) ? actuel.alertesEcrasement : [])
              .map((a) => a && a.id),
          );
          alerteAEnvoyer = (Array.isArray(aEcrire.alertesEcrasement) ? aEcrire.alertesEcrasement : [])
            .find((a) => a && !connues.has(a.id)) || null;
        }
      }
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
        const perime = jetonPerime(actuel, session);
        if (perime) return res.status(401).json({ error: perime, sessionRevoquee: true });
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
      /*
       * Les données sont en place : on peut maintenant prévenir. L'envoi est attendu — quelques
       * centaines de millisecondes — parce qu'une fonction serverless qui rend la main est
       * arrêtée : un envoi lancé sans être attendu ne partirait pas une fois sur deux. Un échec
       * du courriel ne change rien à la réponse : l'enregistrement, lui, a bien eu lieu.
       */
      if (alerteAEnvoyer) {
        const envoi = await envoyerAlerteEcrasement(aEcrire, alerteAEnvoyer);
        if (!envoi.envoye) console.error("Alerte d'écrasement non envoyée :", envoi.raison, envoi.detail || "");
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Méthode non autorisée" });
  } catch (e) {
    console.error("Échec de l'accès aux données", e);
    return res.status(502).json({ error: "Base de données injoignable" });
  }
}
