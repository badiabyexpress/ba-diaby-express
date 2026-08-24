/**
 * Fonction serverless Vercel — sert de proxy sécurisé vers l'API Anthropic.
 *
 * Pourquoi ce fichier est nécessaire :
 * Dans l'artefact Claude, les appels à l'API Claude se faisaient directement depuis
 * le navigateur, sans clé, car Claude.ai gérait l'authentification à votre place.
 * Sur un vrai site, ce n'est plus possible : il ne faut JAMAIS mettre une clé API
 * Anthropic dans le code envoyé au navigateur (n'importe qui pourrait la voler et
 * l'utiliser à vos frais). Cette fonction tourne donc côté serveur (chez Vercel),
 * garde la clé secrète dans une variable d'environnement, et relaie la demande.
 *
 * Le frontend (src/App.jsx) appelle "/api/claude" au lieu d'appeler Anthropic
 * directement — un seul endroit à changer, déjà fait dans le code fourni.
 */

import { refusSaufEquipe } from "./_session.js";

export default async function handler(req, res) {
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
