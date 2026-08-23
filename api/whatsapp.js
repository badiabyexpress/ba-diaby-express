/**
 * Fonction serverless Vercel — envoi de messages WhatsApp.
 *
 * POURQUOI CE FICHIER
 * -------------------
 * Le jeton d'envoi est un mot de passe : quiconque l'obtient peut écrire à vos clients en votre
 * nom, à vos frais. Il ne doit donc JAMAIS se trouver dans le code envoyé au navigateur. Cette
 * fonction tourne côté serveur, lit les identifiants depuis les variables d'environnement, et
 * relaie la demande. Le navigateur, lui, appelle simplement "/api/whatsapp".
 *
 * DEUX FOURNISSEURS, UN SEUL POINT D'ENTRÉE
 * -----------------------------------------
 * WhatsApp ne se vend pas directement : on passe soit par Meta (l'éditeur, en direct), soit par
 * un revendeur comme Twilio. Les deux voies existent ici, et c'est la configuration présente qui
 * décide — rien à basculer à la main.
 *
 *   Meta Cloud API (préféré s'il est configuré)
 *     WHATSAPP_TOKEN        jeton permanent d'un utilisateur système — SECRET
 *     WHATSAPP_PHONE_ID     « ID de numéro de téléphone » (WhatsApp Manager) — pas le numéro
 *     WHATSAPP_TEMPLATE     facultatif : modèle utilisé hors des 24 h (voir plus bas)
 *     WHATSAPP_TEMPLATE_LANG facultatif : sa langue, « fr » par défaut
 *
 *   Twilio (voie d'origine, conservée)
 *     TWILIO_ACCOUNT_SID    identifiant du compte (AC…) — ce n'est pas un secret
 *     TWILIO_AUTH_TOKEN     mot de passe du compte — SECRET
 *     TWILIO_WHATSAPP_FROM  numéro expéditeur, « whatsapp:+224… »
 *
 * Aucun nom ne commence par VITE_ : ce préfixe les enverrait au navigateur.
 *
 * Tant que rien n'est configuré, la fonction répond 501 et l'application ouvre un brouillon
 * WhatsApp que l'agent envoie lui-même. Aucune régression.
 *
 * LA FENÊTRE DE 24 HEURES — LA VRAIE CONTRAINTE
 * ---------------------------------------------
 * WhatsApp n'autorise le texte libre que dans les 24 h suivant le DERNIER message du client.
 * Au-delà, il faut un modèle validé par Meta à l'avance. Or presque toutes nos notifications
 * arrivent hors de cette fenêtre : un client ne nous écrit pas juste avant que son colis parte.
 *
 * Sans modèle configuré, ces envois échouent — c'est WhatsApp qui l'impose, pas ce code. La
 * fonction traduit alors le refus en une phrase qui dit quoi faire, plutôt qu'un code d'erreur.
 */

const VERSION_GRAPH = "v21.0";

/** Numéro en chiffres seuls, forme attendue par Meta (« 224621654796 »). */
function numeroMeta(brut) {
  return String(brut).replace(/^whatsapp:/, "").replace(/\D/g, "");
}

function configuration() {
  const meta = {
    jeton: process.env.WHATSAPP_TOKEN,
    numeroId: process.env.WHATSAPP_PHONE_ID,
    modele: process.env.WHATSAPP_TEMPLATE || null,
    langue: process.env.WHATSAPP_TEMPLATE_LANG || "fr",
  };
  const twilio = {
    sid: process.env.TWILIO_ACCOUNT_SID,
    jeton: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_WHATSAPP_FROM,
  };
  return {
    meta, twilio,
    metaPret: !!(meta.jeton && meta.numeroId),
    twilioPret: !!(twilio.sid && twilio.jeton && twilio.from),
  };
}

/*
 * Ce que Meta répond quand ça ne passe pas, traduit en geste à faire.
 *
 * Les codes bruts ne disent rien à personne, et le message d'origine est en anglais technique.
 * Un agent qui voit « 131047 » referme la fenêtre ; un agent qui lit « il faut un modèle validé »
 * sait qu'il doit envoyer autrement pour cette fois.
 */
const EXPLICATIONS_META = {
  131047: "Plus de 24 h se sont écoulées depuis le dernier message de ce client : WhatsApp exige alors un modèle validé par Meta. Envoyez le message autrement pour cette fois.",
  131026: "Ce numéro ne peut pas recevoir de message WhatsApp. Vérifiez qu'il est bien sur WhatsApp, avec son indicatif pays.",
  131030: "Ce numéro n'est pas dans la liste des destinataires autorisés. Tant que l'application Meta n'est pas publiée, seuls les numéros de test peuvent être joints.",
  132001: "Le modèle demandé n'existe pas, ou pas dans cette langue. Vérifiez son nom dans le gestionnaire de modèles Meta.",
  132000: "Le nombre de variables envoyées ne correspond pas à celui du modèle validé.",
  132015: "Ce modèle a été refusé ou mis en pause par Meta. Il faut le corriger et le refaire valider.",
  190: "Jeton refusé ou expiré. Regénérez WHATSAPP_TOKEN dans Meta et remettez-le dans Vercel.",
  100: "Paramètre refusé par Meta. Vérifiez WHATSAPP_PHONE_ID — c'est l'« ID de numéro de téléphone », pas le numéro lui-même.",
  368: "Ce compte est temporairement bloqué par Meta pour non-respect des règles de messagerie.",
  80007: "Trop de messages envoyés en peu de temps. Réessayez dans un instant.",
};

/** Les erreurs Twilio les plus courantes, même principe. */
const EXPLICATIONS_TWILIO = {
  63016: "Plus de 24 h se sont écoulées depuis le dernier message du client : WhatsApp exige un modèle validé par Meta. Envoyez le message autrement pour cette fois.",
  63015: "Ce numéro n'a pas rejoint le bac à sable WhatsApp. Le client doit d'abord envoyer le code d'adhésion au numéro Twilio.",
  21211: "Numéro de téléphone invalide. Vérifiez l'indicatif du pays.",
  20003: "Identifiants Twilio refusés. Vérifiez TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN dans Vercel.",
  63007: "Le numéro expéditeur n'est pas un numéro WhatsApp valide. Vérifiez TWILIO_WHATSAPP_FROM.",
};

/**
 * Envoi par Meta Cloud API.
 *
 * `modele` déclenche l'envoi d'un modèle validé plutôt qu'un texte libre — la seule forme
 * acceptée hors des 24 h. Ses variables remplissent {{1}}, {{2}}… dans l'ordre.
 */
async function envoyerParMeta({ meta, destinataire, message, modele, variables, document, boutonUrl }) {
  /*
   * Un modèle se remplit par « composants », dans un ordre que Meta impose : l'en-tête, puis le
   * corps, puis les boutons. Chacun doit correspondre EXACTEMENT à ce qui a été validé — envoyer
   * un paramètre de bouton à un modèle qui n'en a pas est refusé aussi sûrement que l'inverse.
   */
  const composants = [];
  // En-tête « document » : le ticket d'envoi, déjà déposé sur un stockage public.
  if (document && document.lien) {
    composants.push({
      type: "header",
      parameters: [{ type: "document", document: { link: document.lien, filename: document.nom || "document.pdf" } }],
    });
  }
  if (variables && variables.length) {
    composants.push({ type: "body", parameters: variables.map((v) => ({ type: "text", text: String(v) })) });
  }
  /*
   * Bouton d'appel à l'action de type URL, à suffixe variable : le modèle validé porte l'adresse
   * « …/?suivi=1&code={{1}} » et ce paramètre en complète la fin. C'est ce qui met le suivi du
   * colis à un doigt du message, au lieu d'obliger le client à retrouver le site et à recopier
   * neuf caractères.
   */
  if (boutonUrl) {
    composants.push({
      type: "button", sub_type: "url", index: "0",
      parameters: [{ type: "text", text: String(boutonUrl) }],
    });
  }

  const corps = modele
    ? {
      messaging_product: "whatsapp",
      to: destinataire,
      type: "template",
      template: {
        name: modele,
        language: { code: meta.langue },
        ...(composants.length ? { components: composants } : {}),
      },
    }
    : {
      messaging_product: "whatsapp",
      to: destinataire,
      type: "text",
      text: { preview_url: false, body: String(message) },
    };

  const reponse = await fetch(
    `https://graph.facebook.com/${VERSION_GRAPH}/${encodeURIComponent(meta.numeroId)}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${meta.jeton}` },
      body: JSON.stringify(corps),
    },
  );
  const data = await reponse.json().catch(() => ({}));

  if (!reponse.ok) {
    const erreur = data?.error || {};
    const code = erreur.code ?? erreur.error_subcode ?? null;
    return {
      ok: false,
      statut: reponse.status,
      erreur: EXPLICATIONS_META[code] || erreur.error_user_msg || erreur.message || "Erreur Meta",
      code,
    };
  }
  return { ok: true, id: data?.messages?.[0]?.id || null, statut: "envoye" };
}

/** Envoi par Twilio — la voie d'origine, inchangée. */
async function envoyerParTwilio({ twilio, avecIndicatif, message, mediaUrl }) {
  const corps = new URLSearchParams({
    To: `whatsapp:${avecIndicatif}`,
    From: twilio.from.startsWith("whatsapp:") ? twilio.from : `whatsapp:${twilio.from}`,
    Body: String(message),
  });
  // Pièce jointe : Twilio récupère lui-même le fichier à cette URL, qui doit être publique.
  if (mediaUrl) corps.append("MediaUrl", String(mediaUrl));

  const reponse = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilio.sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${twilio.sid}:${twilio.jeton}`).toString("base64"),
      },
      body: corps.toString(),
    },
  );
  const data = await reponse.json().catch(() => ({}));

  if (!reponse.ok) {
    const code = data?.code;
    return {
      ok: false,
      statut: reponse.status,
      erreur: EXPLICATIONS_TWILIO[code] || data?.message || "Erreur Twilio",
      code: code || null,
    };
  }
  return { ok: true, id: data.sid, statut: data.status };
}

export default async function handler(req, res) {
  const { meta, twilio, metaPret, twilioPret } = configuration();

  /*
   * L'état, consultable depuis un navigateur — y compris un téléphone.
   *
   * « Le message ne part pas » a trop de causes possibles pour se diagnostiquer à l'aveugle :
   * variable absente, jeton périmé, modèle manquant. On ne renvoie rien de secret, seulement de
   * quoi savoir où chercher.
   */
  if (req.method === "GET" && req.query?.etat !== undefined) {
    return res.status(200).json({
      configure: metaPret || twilioPret,
      fournisseur: metaPret ? "meta" : twilioPret ? "twilio" : null,
      meta: { jeton: !!meta.jeton, numeroId: !!meta.numeroId, modele: meta.modele || null, langue: meta.langue },
      twilio: { sid: !!twilio.sid, jeton: !!twilio.jeton, expediteur: !!twilio.from },
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  if (!metaPret && !twilioPret) {
    return res.status(501).json({
      error: "L'envoi WhatsApp n'est pas configuré sur le serveur.",
      configure: false,
    });
  }

  try {
    const { to, message, mediaUrl, modele, variables, document, boutonUrl } = req.body || {};
    if (!to || !message) {
      return res.status(400).json({ error: "Paramètres 'to' et 'message' requis." });
    }

    // On accepte « 622111111 », « +224622111111 » ou « whatsapp:+224622111111 ».
    const chiffres = numeroMeta(to);
    if (chiffres.length < 8) {
      return res.status(400).json({ error: "Numéro de téléphone invalide. Vérifiez l'indicatif du pays." });
    }

    const resultat = metaPret
      ? await envoyerParMeta({
        meta,
        destinataire: chiffres,
        message,
        // Le modèle donné par l'appelant l'emporte ; à défaut celui configuré sur le serveur.
        modele: modele || meta.modele || null,
        variables,
        // Le ticket d'envoi vient de la même URL publique que la pièce jointe Twilio : un seul
        // fichier déposé, servi par les deux voies.
        document: document || (mediaUrl ? { lien: mediaUrl, nom: "ticket.pdf" } : null),
        boutonUrl,
      })
      : await envoyerParTwilio({ twilio, avecIndicatif: `+${chiffres}`, message, mediaUrl });

    if (!resultat.ok) {
      return res.status(resultat.statut || 502).json({ error: resultat.erreur, code: resultat.code });
    }
    return res.status(200).json({ ok: true, sid: resultat.id, statut: resultat.statut });
  } catch (err) {
    console.error("Erreur WhatsApp :", err);
    return res.status(500).json({ error: "Erreur serveur lors de l'envoi WhatsApp." });
  }
}
