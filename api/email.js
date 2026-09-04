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
 *   EMAIL_FROM       adresse expéditrice, ex. "Ba-Diaby Express <contact@badiabyexpress.com>"
 *   EMAIL_REPLY_TO   facultatif — où atterrissent les réponses des clients
 *
 * Tant que les deux premières sont absentes, la fonction répond 501 et l'application retombe
 * proprement sur l'ouverture d'un brouillon : aucune régression.
 *
 * POURQUOI RESEND
 * ---------------
 * 3 000 e-mails gratuits par mois, une seule clé à configurer, et l'envoi de pièces jointes
 * en base64 — ce qui correspond exactement au format de nos PDF générés dans le navigateur.
 *
 * ADRESSE EXPÉDITRICE
 * -------------------
 * Resend n'accepte d'envoyer que depuis un domaine vérifié — badiabyexpress.com, ici. L'adresse
 * choisie devant le @ n'a pas besoin d'exister comme boîte aux lettres : le domaine vérifié
 * suffit à envoyer. C'est pour les RÉPONSES que cela compte, d'où EMAIL_REPLY_TO.
 *
 * Sans domaine vérifié, Resend refuse avec `validation_error`, et l'application retombe sur le
 * brouillon : rien ne casse, mais rien ne part non plus.
 */

import { refusSaufEquipe } from "./_session.js";
import { analyserExpediteur } from "./_expediteur.js";

/*
 * L'analyse de EMAIL_FROM vit maintenant dans api/_expediteur.js, et pour une raison précise :
 * elle n'était appliquée QUE dans ce fichier. Les cinq autres expéditeurs du serveur — copie hors
 * site, bilan quotidien, alertes d'écrasement, de connexion et de fraude — donnaient la variable
 * brute à Resend, qui les refusait toutes par un 422 « Invalid `from` field ». Les courriels aux
 * clients partaient, aucun courriel automatique ne partait, et rien ne reliait les deux.
 */

export default async function handler(req, res) {
  /*
   * Cette fonction dépense. Elle n'est donc pas ouverte à qui connaît son adresse — voir
   * refusSaufEquipe dans api/_session.js.
   */
  const refus = refusSaufEquipe(req);
  if (refus) return res.status(refus.code).json(refus.corps);

  /*
   * Un état consultable depuis un navigateur — y compris un téléphone.
   *
   * Sans lui, « l'e-mail ne part pas » ne se distingue pas de « le serveur ne voit pas les
   * variables » : les deux se traduisent par un brouillon qui s'ouvre. On ne renvoie rien de
   * secret, seulement de quoi savoir où chercher.
   */
  if (req.method === "GET" && req.query?.etat !== undefined) {
    const expediteur = analyserExpediteur(process.env.EMAIL_FROM);
    return res.status(200).json({
      configure: !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
      cle: !!process.env.RESEND_API_KEY,
      expediteur: !!process.env.EMAIL_FROM,
      expediteurValide: expediteur.valide,
      expediteurAvecNom: expediteur.avecNom,
      // Vrai quand la valeur saisie n'était pas dans les règles et a été remise en forme.
      expediteurRepare: !!expediteur.repare,
      domaine: expediteur.domaine,
      reponsesVers: !!process.env.EMAIL_REPLY_TO,
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const cle = process.env.RESEND_API_KEY;
  // C'est la forme normalisée qui part chez Resend — voir analyserExpediteur.
  const analyse = analyserExpediteur(process.env.EMAIL_FROM);
  const expediteur = analyse.normalise;
  /*
   * Où renvoyer les réponses.
   *
   * L'adresse expéditrice n'a pas besoin d'exister comme boîte aux lettres pour envoyer : un
   * domaine vérifié suffit. Mais un client qui répond écrit bien à cette adresse, et sa réponse
   * se perd si personne ne la relève. C'est le genre de perte qu'on ne remarque jamais — on ne
   * sait pas ce qu'on n'a pas reçu.
   *
   * Cette variable permet donc de faire atterrir les réponses sur une boîte réelle, sans avoir à
   * créer de messagerie sur le domaine. Absente, rien ne change.
   */
  const repondreA = process.env.EMAIL_REPLY_TO;

  if (!cle || !process.env.EMAIL_FROM) {
    return res.status(501).json({
      error: "L'envoi d'e-mails n'est pas configuré sur le serveur.",
      configure: false,
    });
  }

  /*
   * Configuré, mais inutilisable — et c'est un cas différent, qui appelle un geste différent.
   * Le confondre avec « non configuré » enverrait chercher une variable qui existe déjà.
   */
  if (!expediteur) {
    return res.status(500).json({
      error: "L'adresse expéditrice (EMAIL_FROM) n'a pas une forme valide. Attendu : Ba-Diaby Express <contact@badiabyexpress.com>",
    });
  }

  try {
    const { to, sujet, message, piecesJointes } = req.body || {};
    if (!to || !sujet) {
      return res.status(400).json({ error: "Paramètres 'to' et 'sujet' requis." });
    }

    /*
     * On enlève les espaces de bord avant de juger.
     *
     * Une adresse saisie sur un téléphone arrive régulièrement avec un espace en fin — le clavier
     * l'ajoute après l'auto-complétion, et rien ne le montre à l'écran. L'adresse était alors
     * déclarée invalide, l'envoi refusé, et l'agent cherchait une faute de frappe qui n'existe
     * pas. Refuser pour un espace invisible n'aide personne.
     */
    const destinataire = String(to).trim();

    // Vérification sommaire : une adresse manifestement invalide part sinon dans le vide,
    // et Resend la facturerait comme un envoi.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinataire)) {
      return res.status(400).json({ error: `Adresse e-mail invalide : « ${destinataire.slice(0, 60)} »` });
    }

    const corps = {
      from: expediteur,
      to: [destinataire],
      subject: String(sujet),
      html: String(message || ""),
      ...(repondreA ? { reply_to: repondreA } : {}),
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
