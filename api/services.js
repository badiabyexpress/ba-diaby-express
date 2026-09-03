/**
 * DEUX SERVICES SORTANTS, UNE SEULE FONCTION.
 *
 * POURQUOI CETTE FUSION
 * ---------------------
 * Vercel, sur l'offre Hobby, publie au maximum DOUZE fonctions serverless par déploiement. Le
 * module de transfert d'argent en a ajouté une treizième, et le déploiement entier a échoué —
 * en dix-sept secondes, avant même la compilation. Ce n'est pas une erreur de code : c'est un
 * plafond, et il ne prévient pas.
 *
 * Fallait-il fusionner celles-ci plutôt que d'autres ? Oui, et pas au hasard : les taux du jour
 * et l'assistant sont les deux plus petites, les deux moins appelées, et surtout les deux qui
 * font la même chose — un appel sortant facturé chez un tiers, derrière la même vérification
 * `refusSaufEquipe`. Les réunir ne mélange pas deux métiers, cela en range un.
 *
 * LES ADRESSES N'ONT PAS CHANGÉ
 * -----------------------------
 * L'application appelle désormais « /api/services?service=… », mais vercel.json réécrit aussi
 * « /api/taux » et « /api/claude » vers ici. Un onglet resté ouvert depuis hier, une page mise
 * en cache, une intégration extérieure : rien ne casse le jour du déploiement.
 *
 * LE PROCHAIN AJOUT
 * -----------------
 * Nous sommes de nouveau à douze sur douze. La prochaine fonction demandera soit une fusion de
 * plus, soit le passage au plan supérieur. Ce n'est pas une dette cachée : c'est écrit ici.
 */

import { refusSaufEquipe } from "./_session.js";

/** Les seules devises que l'application manipule — inutile de rapatrier les 160 autres. */
const DEVISES_UTILES = ["EUR", "USD", "CAD", "GNF", "MAD", "XOF", "GBP"];

async function servirTaux(req, res) {
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

async function servirAssistant(req, res) {
  /*
   * Cette fonction dépense. Elle n'est donc pas ouverte à qui connaît son adresse — voir
   * refusSaufEquipe dans api/_session.js.
   */
  const refus = refusSaufEquipe(req);
  if (refus) return res.status(refus.code).json(refus.corps);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY n'est pas configurée sur le serveur (voir .env.example)." });
  }

  try {
    const { prompt, model, max_tokens } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Paramètre 'prompt' manquant." });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-5-20250929",
        max_tokens: max_tokens || 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || "Erreur API Anthropic" });
    }

    const text = (data.content || []).map((b) => b.text || "").join("\n");
    return res.status(200).json({ text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur serveur lors de l'appel à Claude." });
  }
}

export default async function handler(req, res) {
  /*
   * Le service demandé se lit dans la requête. Une adresse sans service nommé ne tombe pas dans
   * un cas par défaut — elle est refusée : sur une fonction qui dépense, « je ne sais pas ce que
   * vous voulez » ne doit jamais devenir « je fais quelque chose ».
   */
  const demande = String(req.query?.service || "").toLowerCase();
  if (demande === "taux") return servirTaux(req, res);
  if (demande === "claude" || demande === "assistant") return servirAssistant(req, res);
  return res.status(400).json({ error: "Service inconnu. Précisez ?service=taux ou ?service=claude." });
}
