/**
 * Fonction serverless Vercel — envoi d'e-mails via Resend.
 *
 * POURQUOI CE FICHIER
 * -------------------
 * Même principe que api/whatsapp.js : la clé d'API est un secret qui ne doit jamais se trouver
 * dans le code envoyé au navigateur. Cette fonction tourne côté serveur, lit la clé depuis les
 * variables d'environnement, et relaie la demande à Resend.
 *
 * VARIABLES D'ENVIRONNEMENT À CRÉER SUR VERCEL
 * --------------------------------------------
 *   RESEND_API_KEY   clé fournie par Resend (commence par re_) — À SAISIR UNIQUEMENT DANS VERCEL
 *   EMAIL_FROM       adresse expéditrice, ex. "Ba-Diaby Express <contact@votredomaine.com>"
 *
 * Tant que ces variables sont absentes, la fonction répond 501 et l'application retombe
 * proprement sur l'ouverture d'un brouillon : aucune régression.
 *
 * POURQUOI RESEND
 * ---------------
 * 3 000 e-mails gratuits par mois, une seule clé à configurer, et l'envoi de pièces jointes
 * en base64 — ce qui correspond exactement au format de nos PDF générés dans le navigateur.
 *
 * ADRESSE EXPÉDITRICE
 * -------------------
 * Resend n'accepte d'envoyer que depuis un domaine vérifié. Sans domaine à vous, utilisez
 * l'adresse de test fournie par Resend : les e-mails ne partiront qu'à votre propre adresse,
 * ce qui suffit pour valider le circuit.
 */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const cle = process.env.RESEND_API_KEY;
  const expediteur = process.env.EMAIL_FROM;

  if (!cle || !expediteur) {
    return res.status(501).json({
      error: "L'envoi d'e-mails n'est pas configuré sur le serveur.",
      configure: false,
    });
  }

  try {
    const { to, sujet, message, piecesJointes } = req.body || {};
    if (!to || !sujet) {
      return res.status(400).json({ error: "Paramètres 'to' et 'sujet' requis." });
    }

    // Vérification sommaire : une adresse manifestement invalide part sinon dans le vide,
    // et Resend la facturerait comme un envoi.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(to))) {
      return res.status(400).json({ error: "Adresse e-mail invalide." });
    }

    const corps = {
      from: expediteur,
      to: [String(to)],
      subject: String(sujet),
      html: String(message || ""),
    };

    /*
     * Pièces jointes : les PDF sont produits dans le navigateur, donc transmis en base64.
     * Resend limite l'ensemble du message à 40 Mo ; nos factures pèsent quelques dizaines de
     * kilo-octets, la marge est large.
     */
    if (Array.isArray(piecesJointes) && piecesJointes.length > 0) {
      corps.attachments = piecesJointes.map((p) => ({
        filename: p.nom || "document.pdf",
        content: p.contenu,
      }));
    }

    const reponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cle}`,
      },
      body: JSON.stringify(corps),
    });

    const data = await reponse.json();

    if (!reponse.ok) {
      // Traduction des refus les plus courants, pour que l'agent sache quoi faire.
      const explications = {
        validation_error: "Adresse expéditrice refusée. Vérifiez EMAIL_FROM et que le domaine est vérifié chez Resend.",
        invalid_api_Key: "Clé d'API refusée. Vérifiez RESEND_API_KEY dans Vercel.",
        rate_limit_exceeded: "Trop d'envois en peu de temps. Réessayez dans un instant.",
      };
      return res.status(reponse.status).json({
        error: explications[data?.name] || data?.message || "L'envoi a échoué.",
        code: data?.name || null,
      });
    }

    return res.status(200).json({ ok: true, id: data.id });
  } catch (err) {
    console.error("Erreur e-mail :", err);
    return res.status(500).json({ error: "Erreur serveur lors de l'envoi de l'e-mail." });
  }
}
