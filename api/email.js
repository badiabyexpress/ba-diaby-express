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

/*
 * L'adresse expéditrice doit avoir la forme « Nom <adresse@domaine> », ou être une adresse nue.
 * Resend refuse tout le reste — et son refus ne dit pas ce qui cloche, ce qui laisse chercher
 * longtemps quand la valeur porte des guillemets de trop ou qu'un chevron manque.
 */
function analyserExpediteur(valeur) {
  const brut = String(valeur || "").trim();
  const entreChevrons = /<([^>]+)>\s*$/.exec(brut);
  const adresse = entreChevrons ? entreChevrons[1].trim() : brut;
  const valide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse);
  return { valide, domaine: valide ? adresse.split("@")[1] : null, avecNom: !!entreChevrons };
}

export default async function handler(req, res) {
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
      domaine: expediteur.domaine,
      reponsesVers: !!process.env.EMAIL_REPLY_TO,
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const cle = process.env.RESEND_API_KEY;
  const expediteur = process.env.EMAIL_FROM;
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
