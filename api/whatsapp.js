/**
 * Fonction serverless Vercel — envoi de messages WhatsApp via Twilio.
 *
 * POURQUOI CE FICHIER
 * -------------------
 * L'Auth Token Twilio est un mot de passe : quiconque l'obtient peut envoyer des messages à vos
 * frais. Il ne doit donc JAMAIS se trouver dans le code envoyé au navigateur. Cette fonction
 * tourne côté serveur (chez Vercel), lit les identifiants depuis les variables d'environnement,
 * et relaie la demande à Twilio. Le navigateur, lui, appelle simplement "/api/whatsapp".
 *
 * MÊME PRINCIPE que api/claude.js pour la clé Anthropic.
 *
 * VARIABLES D'ENVIRONNEMENT À CRÉER SUR VERCEL
 * --------------------------------------------
 *   TWILIO_ACCOUNT_SID    identifiant du compte (commence par AC…) — ce n'est pas un secret
 *   TWILIO_AUTH_TOKEN     mot de passe du compte — À SAISIR UNIQUEMENT DANS VERCEL
 *   TWILIO_WHATSAPP_FROM  numéro expéditeur, au format "whatsapp:+14155238886"
 *
 * Les noms ne commencent PAS par VITE_ : une variable VITE_* serait envoyée au navigateur.
 *
 * BAC À SABLE OU COMPTE PROFESSIONNEL
 * -----------------------------------
 * Le même code fonctionne dans les deux cas — seule la valeur de TWILIO_WHATSAPP_FROM change :
 *   - bac à sable : le numéro partagé de Twilio (whatsapp:+14155238886). Gratuit et immédiat,
 *     mais chaque destinataire doit d'abord envoyer le code d'adhésion à ce numéro. Réservé
 *     aux essais avec votre équipe.
 *   - WhatsApp Business : votre propre numéro validé par Meta. Seule voie durable pour écrire
 *     à de vrais clients.
 *
 * FENÊTRE DE 24 HEURES
 * --------------------
 * WhatsApp n'autorise le texte libre que dans les 24 h suivant le dernier message du client.
 * Au-delà, il faut un modèle validé par Meta. Twilio renvoie alors l'erreur 63016, que cette
 * fonction traduit en message clair pour que l'agent comprenne et relance autrement.
 */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  // Non configuré : on répond 501 pour que l'application retombe proprement sur l'ouverture
  // d'un brouillon WhatsApp, comme avant. Aucune régression tant que Twilio n'est pas prêt.
  if (!sid || !token || !from) {
    return res.status(501).json({
      error: "Twilio n'est pas configuré sur le serveur.",
      configure: false,
    });
  }

  try {
    const { to, message, mediaUrl } = req.body || {};
    if (!to || !message) {
      return res.status(400).json({ error: "Paramètres 'to' et 'message' requis." });
    }

    // Normalisation du destinataire : on accepte "622111111", "+224622111111" ou
    // "whatsapp:+224622111111" et on produit toujours la forme attendue par Twilio.
    const brut = String(to).replace(/^whatsapp:/, "").replace(/[^\d+]/g, "");
    const avecIndicatif = brut.startsWith("+") ? brut : `+${brut}`;
    const destinataire = `whatsapp:${avecIndicatif}`;

    const corps = new URLSearchParams({
      To: destinataire,
      From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
      Body: String(message),
    });
    // Pièce jointe (étiquette, facture...) : Twilio va lui-même récupérer le fichier à cette URL,
    // qui doit donc être publiquement accessible (bucket Supabase Storage public).
    if (mediaUrl) corps.append("MediaUrl", String(mediaUrl));

    const reponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        },
        body: corps.toString(),
      }
    );

    const data = await reponse.json();

    if (!reponse.ok) {
      // Traduction des erreurs Twilio les plus courantes, pour que l'agent sache quoi faire.
      const explications = {
        63016: "Plus de 24 h se sont écoulées depuis le dernier message du client : WhatsApp exige un modèle validé par Meta. Envoyez le message autrement pour cette fois.",
        63015: "Ce numéro n'a pas rejoint le bac à sable WhatsApp. Le client doit d'abord envoyer le code d'adhésion au numéro Twilio.",
        21211: "Numéro de téléphone invalide. Vérifiez l'indicatif du pays.",
        20003: "Identifiants Twilio refusés. Vérifiez TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN dans Vercel.",
        63007: "Le numéro expéditeur n'est pas un numéro WhatsApp valide. Vérifiez TWILIO_WHATSAPP_FROM.",
      };
      const code = data?.code;
      return res.status(reponse.status).json({
        error: explications[code] || data?.message || "Erreur Twilio",
        code: code || null,
      });
    }

    return res.status(200).json({ ok: true, sid: data.sid, statut: data.status });
  } catch (err) {
    console.error("Erreur WhatsApp :", err);
    return res.status(500).json({ error: "Erreur serveur lors de l'envoi WhatsApp." });
  }
}
