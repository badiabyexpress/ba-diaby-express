/**
 * Fonction serverless Vercel — taux de change du jour via ExchangeRate-API.
 *
 * POURQUOI CE FICHIER
 * -------------------
 * Même principe que api/whatsapp.js et api/email.js : la clé d'API est un secret. Une clé posée
 * dans le code du navigateur — ou dans une variable VITE_* — est lisible par n'importe qui ouvre
 * la page, et le quota gratuit (1 500 requêtes par mois) serait épuisé par le premier venu. La
 * clé reste donc ici, côté serveur, et le navigateur ne voit jamais que le résultat.
 *
 * VARIABLE D'ENVIRONNEMENT À CRÉER SUR VERCEL
 * -------------------------------------------
 *   EXCHANGERATE_API_KEY   la clé fournie par exchangerate-api.com
 *
 * Tant qu'elle est absente, la fonction répond 501 et l'application garde ses taux saisis à la
 * main : aucune régression, le bouton dit simplement que ce n'est pas configuré.
 *
 * CE QU'ELLE RENVOIE
 * ------------------
 * L'application exprime tous ses montants dans une base commune, l'euro : `rates.GNF` vaut le
 * nombre de francs guinéens pour un euro, `rates.USD` le nombre de dollars pour un euro. C'est
 * exactement la forme que renvoie ExchangeRate-API quand on l'interroge sur la base EUR, d'où
 * l'appel `/latest/EUR` — aucune conversion à faire de notre côté, donc aucune erreur d'arrondi
 * à introduire.
 *
 * QUOTA
 * -----
 * 1 500 appels par mois sur l'offre gratuite, soit environ 50 par jour. L'application n'appelle
 * qu'à la demande d'un administrateur, et au plus une fois par jour automatiquement : le quota
 * n'est pas un souci tant que personne ne clique en boucle.
 */

import { refusSaufEquipe } from "./_session.js";

/** Les seules devises que l'application manipule — inutile de rapatrier les 160 autres. */
const DEVISES_UTILES = ["EUR", "USD", "CAD", "GNF", "MAD", "XOF", "GBP"];

export default async function handler(req, res) {
  /*
   * Cette fonction dépense. Elle n'est donc pas ouverte à qui connaît son adresse — voir
   * refusSaufEquipe dans api/_session.js.
   */
  const refus = refusSaufEquipe(req);
  if (refus) return res.status(refus.code).json(refus.corps);

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const cle = process.env.EXCHANGERATE_API_KEY;
  if (!cle) {
    return res.status(501).json({
      error: "Les taux automatiques ne sont pas configurés sur le serveur.",
      configure: false,
    });
  }

  try {
    const reponse = await fetch(`https://v6.exchangerate-api.com/v6/${cle}/latest/EUR`);
    const corps = await reponse.json();

    if (!reponse.ok || corps["result"] !== "success") {
      /*
       * On relaie la raison telle que le fournisseur la donne — « invalid-key », « quota-reached »,
       * « inactive-account » — parce que ce sont trois problèmes différents qui appellent trois
       * gestes différents de la part de l'administrateur.
       */
      return res.status(502).json({
        error: "Le fournisseur de taux n'a pas répondu correctement.",
        raison: corps["error-type"] || `HTTP ${reponse.status}`,
      });
    }

    const toutes = corps.conversion_rates || {};
    const taux = {};
    for (const devise of DEVISES_UTILES) {
      const valeur = Number(toutes[devise]);
      // Un taux nul ou absent ferait des divisions par zéro à l'affichage : on préfère l'omettre
      // et laisser l'application garder la valeur qu'elle avait déjà pour cette devise.
      if (valeur > 0) taux[devise] = valeur;
    }
    if (!taux.GNF) {
      return res.status(502).json({ error: "Le franc guinéen est absent de la réponse du fournisseur." });
    }

    return res.status(200).json({
      taux,
      base: "EUR",
      // La date de mise à jour du fournisseur, pas celle de notre appel : c'est elle qui dit
      // depuis quand ces taux valent, et un fournisseur peut servir la même donnée toute la journée.
      miseAJour: corps.time_last_update_utc || null,
    });
  } catch (e) {
    console.error("Échec de la récupération des taux", e);
    return res.status(502).json({ error: "Impossible de joindre le fournisseur de taux." });
  }
}
