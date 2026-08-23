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

  const clef = String(req.query?.cle || "bde-data");
  const entetes = { apikey: cle, Authorization: `Bearer ${cle}`, "Content-Type": "application/json" };

  try {
    if (req.method === "GET" && req.query?.liste !== undefined) {
      /* Les sauvegardes automatiques ont besoin de connaître les clés existantes pour effacer les
       * plus anciennes. On ne renvoie que les noms — jamais le contenu. */
      const prefixe = String(req.query.liste || "");
      const filtre = prefixe ? `&key=like.${encodeURIComponent(`${prefixe}%`)}` : "";
      const reponse = await fetch(`${url}/rest/v1/${TABLE}?select=key${filtre}`, { headers: entetes });
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
      return res.status(200).json({ value: ligne.value, updated_at: ligne.updated_at || null });
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
      const reponse = await fetch(
        `${url}/rest/v1/${TABLE}?on_conflict=key`,
        {
          method: "POST",
          headers: { ...entetes, Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ key: clef, value: valeur, updated_at: new Date().toISOString() }),
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
