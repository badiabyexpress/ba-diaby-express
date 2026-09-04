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

import { refusSaufEquipe } from "./_session.js";

const VERSION_GRAPH = "v21.0";

/**
 * Numéro en chiffres seuls, forme attendue par Meta (« 224621654796 »).
 *
 * Le « 00 » de composition internationale est retiré au même titre que le « + » et les espaces.
 * Meta refuse « 00224… » par « (#131009) Parameter value is not valid » — un message qui ne dit ni
 * quel paramètre ni pourquoi — et « 00 » est précisément la façon dont un numéro international
 * s'écrit en Guinée. Un client dont la fiche porte cette forme ne recevait donc rien, sans que le
 * refus ne soit rattaché à sa cause.
 *
 * Un « 0 » seul n'est jamais retiré : dans un numéro national, il fait partie du numéro.
 */
function numeroMeta(brut) {
  const chiffres = String(brut).replace(/^whatsapp:/, "").replace(/\D/g, "");
  return chiffres.startsWith("00") ? chiffres.slice(2) : chiffres;
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
  /*
   * 132001 recouvre trois situations très différentes, et l'agent doit pouvoir les distinguer :
   * le modèle n'a jamais été déposé, il attend encore l'examen de Meta, ou il existe dans une
   * autre langue que celle demandée. Un modèle « En cours d'examen » est le cas le plus fréquent
   * dans les heures qui suivent un dépôt — et le seul qui se règle en attendant.
   */
  132001: "Ce modèle n'est pas utilisable pour l'instant : soit il attend encore l'examen de Meta "
    + "(les modèles « En cours d'examen » ne peuvent pas servir), soit son nom ou sa langue ne "
    + "correspondent pas à ce qui a été déposé.",
  132000: "Ce qui a été envoyé ne correspond pas au modèle validé : nombre de variables, en-tête ou bouton. "
    + "Le modèle doit être rempli exactement comme il a été déposé.",
  132015: "Ce modèle a été refusé ou mis en pause par Meta. Il faut le corriger et le refaire valider.",
  /*
   * 133010 est le piège de la mise en service : le numéro a été ajouté et vérifié, tout paraît
   * en ordre dans le gestionnaire — mais il n'a jamais été ENREGISTRÉ sur la Cloud API. C'est une
   * étape distincte, facile à sauter, et Meta n'en dit rien de plus qu'« Account not registered ».
   */
  133010: "Le numéro n'est pas encore activé pour l'envoi. Dans Meta > API Setup, appuyez sur "
    + "« Register » (ou Configuration > Numéros de téléphone > Enregistrer) et définissez le code "
    + "à six chiffres. L'ajout et la vérification du numéro ne suffisent pas.",
  133005: "Le code à six chiffres du numéro est refusé. C'est celui défini à l'enregistrement du numéro chez Meta.",
  133006: "Ce numéro doit d'abord être vérifié chez Meta avant de pouvoir envoyer.",
  133016: "Ce numéro a été supprimé puis réenregistré trop souvent. Meta impose d'attendre avant de recommencer.",
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

/*
 * LA FORME D'UN MODÈLE, telle que Meta l'a validée.
 *
 * Un modèle se remplit exactement comme il a été déposé : trois variables si le corps en porte
 * trois, un en-tête « document » seulement s'il en a un, un paramètre de bouton seulement si le
 * bouton en attend un. Toute différence est refusée en bloc (#132000), avec le même message pour
 * les trois causes.
 *
 * C'est le piège de la MODIFICATION. On retouche un modèle chez Meta — on ajoute une ligne, on
 * retire une variable — il repasse en examen, il est réapprouvé, tout paraît normal. Mais le code,
 * lui, envoie toujours l'ancien nombre de variables : les messages échouent en silence, et l'on ne
 * s'en aperçoit qu'en constatant que des clients n'ont rien reçu.
 *
 * On lit donc la forme réelle chez Meta pour pouvoir la comparer à ce que l'application envoie.
 */
function formeDuModele(composants) {
  const liste = Array.isArray(composants) ? composants : [];
  const corps = liste.find((c) => c?.type === "BODY");
  const entete = liste.find((c) => c?.type === "HEADER");
  const boutons = liste.find((c) => c?.type === "BUTTONS");

  // Le nombre de variables est le PLUS GRAND indice rencontré : « {{1}} … {{3}} » en demande trois.
  let variables = 0;
  for (const trouve of String(corps?.text || "").matchAll(/\{\{\s*(\d+)\s*\}\}/g)) {
    variables = Math.max(variables, Number(trouve[1]) || 0);
  }
  const boutonUrl = (boutons?.buttons || []).some(
    (b) => b?.type === "URL" && /\{\{\s*\d+\s*\}\}/.test(String(b?.url || "")),
  );
  return {
    variables,
    entete: entete?.format || null,
    boutonUrl,
  };
}

/**
 * Envoi par Meta Cloud API.
 *
 * `modele` déclenche l'envoi d'un modèle validé plutôt qu'un texte libre — la seule forme
 * acceptée hors des 24 h. Ses variables remplissent {{1}}, {{2}}… dans l'ordre.
 */
async function envoyerParMeta({ meta, destinataire, message, modele, variables, document, boutonUrl, otp, otpBouton }) {
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

  /*
   * LE BOUTON D'UN MODÈLE D'AUTHENTIFICATION — SANS LUI, LE CODE NE PART PAS.
   * ─────────────────────────────────────────────────────────────────────────────
   * Un code de réinitialisation ne peut sortir de la fenêtre de vingt-quatre heures qu'avec un
   * modèle de catégorie « authentification ». Or Meta impose à ces modèles-là d'avoir un bouton —
   * « copier le code » ou remplissage automatique — et EXIGE qu'on le remplisse à l'envoi, avec le
   * code répété. Un modèle validé, la variable d'environnement posée, et l'envoi serait quand même
   * refusé pour « nombre de paramètres incorrect » : le code n'arriverait toujours pas, et rien
   * dans le refus ne dirait qu'il manque un bouton.
   *
   * On ne devine pas le type de bouton : c'est celui que Meta a validé qui compte, et lui seul.
   * WHATSAPP_TEMPLATE_CODE_BOUTON le déclare — « url » (remplissage automatique, le défaut),
   * « copy_code » (bouton copier), ou « aucun » pour un modèle qui n'en porte pas.
   */
  if (otp && otpBouton !== "aucun") {
    composants.push(otpBouton === "copy_code"
      ? { type: "button", sub_type: "copy_code", index: "0", parameters: [{ type: "coupon_code", coupon_code: String(otp) }] }
      : { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: String(otp) }] });
  }

  /*
   * SANS MODÈLE, LE DOCUMENT PARTAIT QUAND MÊME — MAIS NULLE PART.
   *
   * Un message hors modèle se composait en `type: "text"` : les composants préparés au-dessus,
   * en-tête document compris, étaient tout simplement abandonnés. Le client recevait « voici la
   * facture de votre colis » et rien d'autre — un message qui annonce une pièce jointe absente,
   * ce qui est pire que pas de message du tout : il attend, puis il rappelle.
   *
   * Dans la fenêtre de vingt-quatre heures, Meta accepte un message de type `document` avec une
   * légende. C'est un seul message qui porte le texte ET le fichier, exactement ce qu'on voulait
   * envoyer.
   */
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
    : (document && document.lien)
      ? {
        messaging_product: "whatsapp",
        to: destinataire,
        type: "document",
        document: {
          link: document.lien,
          filename: document.nom || "document.pdf",
          /*
           * Meta plafonne la légende à 1024 caractères, et un dépassement fait refuser tout
           * l'envoi. Nos messages sont courts, mais on ne laisse pas le hasard décider.
           */
          ...(message ? { caption: String(message).slice(0, 1024) } : {}),
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
  /*
   * Cette fonction dépense. Elle n'est donc pas ouverte à qui connaît son adresse — voir
   * refusSaufEquipe dans api/_session.js.
   */
  const refus = refusSaufEquipe(req);
  if (refus) return res.status(refus.code).json(refus.corps);

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

  /*
   * Combien de messages peut-on encore envoyer ?
   *
   * La réponse n'est pas chez nous : c'est Meta qui plafonne, et le plafond change tout seul.
   * Un numéro neuf commence à 250 destinataires par jour ; le palier monte à 1 000, 10 000, puis
   * sans limite, à mesure que le compte envoie sans se faire bloquer — et redescend si trop de
   * clients signalent les messages.
   *
   * Compter les envois de notre côté ne dirait rien du plafond restant : un même client prévenu
   * cinq fois dans la journée ne compte qu'une fois chez Meta, et un colis dont le message échoue
   * ne compte pas du tout. On va donc chercher le chiffre à la source.
   *
   * La note de qualité vient avec, et elle vaut d'être regardée : c'est elle qui fait redescendre
   * le palier. Verte, tout va bien ; rouge, le numéro est en sursis.
   */
  if (req.method === "GET" && req.query?.quota !== undefined) {
    if (!metaPret) {
      return res.status(501).json({ error: "Le quota n'est connu que chez Meta.", configure: false });
    }
    try {
      /*
       * Champs volontairement limités à ceux que Graph garantit. Un seul nom inconnu fait échouer
       * la requête entière avec un 400 — on ne diagnostique alors plus rien du tout.
       */
      const champs = "verified_name,display_phone_number,quality_rating,messaging_limit_tier,status,code_verification_status";
      const reponse = await fetch(
        `https://graph.facebook.com/${VERSION_GRAPH}/${meta.numeroId}?fields=${champs}`,
        { headers: { Authorization: `Bearer ${meta.jeton}` } },
      );
      const corps = await reponse.json();
      if (!reponse.ok) {
        const code = corps?.error?.code;
        return res.status(reponse.status).json({
          error: EXPLICATIONS_META[code] || corps?.error?.message || "Meta n'a pas répondu.",
          code: code || null,
        });
      }
      // TIER_1K → 1000. « UNLIMITED » n'a pas de nombre : on le dit en toutes lettres.
      const palier = String(corps.messaging_limit_tier || "");
      const correspondance = { TIER_50: 50, TIER_250: 250, TIER_1K: 1000, TIER_10K: 10000, TIER_100K: 100000 };
      /*
       * `status` dit ce que la page de configuration de Meta n'affiche pas toujours à jour : un
       * numéro fraîchement enregistré y reste « Non enregistré » tant qu'on n'a pas rechargé.
       * Ici, la réponse vient de Meta à l'instant même.
       */
      const statut = corps.status || null;
      return res.status(200).json({
        configure: true,
        numero: corps.display_phone_number || null,
        nom: corps.verified_name || null,
        qualite: corps.quality_rating || null,
        palier: palier || null,
        parJour: correspondance[palier] ?? null,
        illimite: palier === "TIER_UNLIMITED",
        statut,
        // Un numéro « CONNECTED » est enregistré et prêt. Tout le reste demande un geste.
        pret: statut === "CONNECTED",
        verification: corps.code_verification_status || null,
      });
    } catch (e) {
      return res.status(502).json({ error: "Impossible de joindre Meta." });
    }
  }

  /*
   * Activer le numéro, sans quitter l'application.
   *
   * C'est l'étape « Register » de Meta, celle qu'on saute parce que le numéro paraît déjà en
   * ordre — ajouté, vérifié, affiché. Elle se fait normalement depuis la console développeur,
   * dont l'interface change tous les six mois et n'affiche pas toujours le résultat sans
   * recharger. Un appel direct est plus sûr : il répond, ou il dit pourquoi il ne peut pas.
   *
   * Le code à six chiffres est celui de la vérification en deux étapes du numéro. S'il n'en avait
   * pas, celui-ci le devient ; s'il en avait déjà un, c'est lui qu'il faut fournir.
   */
  if (req.method === "POST" && req.query?.enregistrer !== undefined) {
    if (!metaPret) {
      return res.status(501).json({ error: "Meta n'est pas configuré sur le serveur.", configure: false });
    }
    const pin = String(req.body?.pin || "").trim();
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({ error: "Le code doit comporter exactement six chiffres." });
    }
    try {
      const reponse = await fetch(`https://graph.facebook.com/${VERSION_GRAPH}/${meta.numeroId}/register`, {
        method: "POST",
        headers: { Authorization: `Bearer ${meta.jeton}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", pin }),
      });
      const corps = await reponse.json();
      if (!reponse.ok) {
        const code = corps?.error?.code;
        return res.status(reponse.status).json({
          error: EXPLICATIONS_META[code] || corps?.error?.message || "Meta a refusé l'enregistrement.",
          code: code || null,
        });
      }
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(502).json({ error: "Impossible de joindre Meta." });
    }
  }

  /*
   * LE PROFIL DE L'ENTREPRISE — ce que le client voit avant de lire le message.
   *
   * Depuis que le numéro est sur l'API, l'application WhatsApp Business ne l'ouvre plus : la photo
   * de profil, la description, l'adresse ne se changent plus depuis un téléphone. Elles se lisent
   * et s'écrivent ici.
   *
   * `profile_picture_url` est un lien signé qui expire : on le redonne tel quel, l'écran l'affiche
   * et ne le conserve pas.
   */
  if (req.method === "GET" && req.query?.profil !== undefined) {
    if (!metaPret) {
      return res.status(501).json({ error: "Le profil n'existe que chez Meta.", configure: false });
    }
    try {
      const champs = "about,address,description,email,profile_picture_url,websites,vertical";
      const reponse = await fetch(
        `https://graph.facebook.com/${VERSION_GRAPH}/${meta.numeroId}/whatsapp_business_profile?fields=${champs}`,
        { headers: { Authorization: `Bearer ${meta.jeton}` } },
      );
      const corps = await reponse.json();
      if (!reponse.ok) {
        const code = corps?.error?.code;
        return res.status(reponse.status).json({
          error: EXPLICATIONS_META[code] || corps?.error?.message || "Meta n'a pas répondu.",
          code: code || null,
        });
      }
      return res.status(200).json({ profil: corps?.data?.[0] || {} });
    } catch (e) {
      return res.status(502).json({ error: "Impossible de joindre Meta." });
    }
  }

  /*
   * Écrire le profil : les champs textuels d'un côté, la photo de l'autre.
   *
   * LA PHOTO NE S'ENVOIE PAS DIRECTEMENT. Meta veut d'abord qu'on dépose le fichier sur son
   * service de téléversement, qui rend une « poignée » ; c'est cette poignée que l'on pose ensuite
   * sur le profil. Trois appels, dans cet ordre, et il faut l'identifiant de l'application
   * (WHATSAPP_APP_ID) pour le premier — sans lui on le dit, plutôt que d'échouer sur un 400.
   */
  if (req.method === "POST" && req.query?.profil !== undefined) {
    if (!metaPret) {
      return res.status(501).json({ error: "Le profil n'existe que chez Meta.", configure: false });
    }
    const { champs, photo } = req.body || {};
    try {
      const corpsProfil = { messaging_product: "whatsapp" };

      if (photo?.contenu) {
        const appId = process.env.WHATSAPP_APP_ID;
        if (!appId) {
          return res.status(501).json({
            error: "WHATSAPP_APP_ID n'est pas configuré : sans lui, Meta refuse le dépôt de la photo. Ajoutez-le dans les variables d'environnement (identifiant de votre application Meta).",
          });
        }
        const binaire = Buffer.from(String(photo.contenu).replace(/^data:[^,]+,/, ""), "base64");
        const type = photo.type || "image/jpeg";

        // 1. On annonce le fichier, et Meta rend une session de dépôt.
        const session = await fetch(
          `https://graph.facebook.com/${VERSION_GRAPH}/${appId}/uploads`
          + `?file_length=${binaire.length}&file_type=${encodeURIComponent(type)}`,
          { method: "POST", headers: { Authorization: `Bearer ${meta.jeton}` } },
        );
        const sessionCorps = await session.json();
        if (!session.ok || !sessionCorps?.id) {
          return res.status(session.status || 502).json({
            error: sessionCorps?.error?.message || "Meta a refusé d'ouvrir le dépôt de la photo.",
          });
        }

        // 2. On dépose les octets. L'en-tête d'autorisation change de forme ici : OAuth, pas Bearer.
        const depot = await fetch(`https://graph.facebook.com/${VERSION_GRAPH}/${sessionCorps.id}`, {
          method: "POST",
          headers: { Authorization: `OAuth ${meta.jeton}`, file_offset: "0", "Content-Type": type },
          body: binaire,
        });
        const depotCorps = await depot.json();
        if (!depot.ok || !depotCorps?.h) {
          return res.status(depot.status || 502).json({
            error: depotCorps?.error?.message || "Le dépôt de la photo a échoué.",
          });
        }
        corpsProfil.profile_picture_handle = depotCorps.h;
      }

      // Les champs textuels. Un champ absent n'est pas effacé : on n'envoie que ce qui est fourni.
      ["about", "address", "description", "email", "vertical"].forEach((c) => {
        if (champs && champs[c] !== undefined) corpsProfil[c] = String(champs[c]);
      });
      /*
       * LES ADRESSES DE SITE, TELLES QUE META LES VEUT
       *
       * Il exige une adresse complète : « badiabyexpress.com » est refusé, « https://badiabyexpress.com »
       * est accepté. Et son refus s'appelle « (#131000) Something went wrong » — un message qui ne dit
       * rien de la cause et qu'on passerait une soirée à chercher. On complète donc le protocole
       * manquant plutôt que de laisser partir une adresse qu'il rejettera.
       */
      if (champs?.websites !== undefined) {
        corpsProfil.websites = (Array.isArray(champs.websites) ? champs.websites : [champs.websites])
          .map((u) => String(u).trim())
          .filter(Boolean)
          .map((u) => (/^https?:\/\//i.test(u) ? u : `https://${u.replace(/^\/+/, "")}`))
          .slice(0, 2);
      }

      if (Object.keys(corpsProfil).length === 1) {
        return res.status(400).json({ error: "Rien à modifier." });
      }

      // 3. On pose le tout sur le profil.
      const reponse = await fetch(
        `https://graph.facebook.com/${VERSION_GRAPH}/${meta.numeroId}/whatsapp_business_profile`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${meta.jeton}`, "Content-Type": "application/json" },
          body: JSON.stringify(corpsProfil),
        },
      );
      const corps = await reponse.json();
      if (!reponse.ok) {
        const code = corps?.error?.code;
        /*
         * « (#131000) Something went wrong » est le refus fourre-tout de Meta : il tombe dès qu'un
         * paramètre lui déplaît, sans jamais dire lequel. Plutôt que de le relayer tel quel, on
         * nomme les causes qu'on peut constater soi-même — c'est presque toujours l'une d'elles.
         */
        let explication = EXPLICATIONS_META[code] || corps?.error?.error_user_msg || corps?.error?.message;
        if (code === 131000 || /something went wrong/i.test(explication || "")) {
          const soupcons = [];
          if ((corpsProfil.websites || []).some((u) => !/^https?:\/\/[^\s.]+\.[a-z]{2,}/i.test(u))) {
            soupcons.push("l’adresse du site (elle doit ressembler à https://exemple.com)");
          }
          if (corpsProfil.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(corpsProfil.email)) {
            soupcons.push("l’adresse e-mail");
          }
          if ((corpsProfil.about || "").length > 139) soupcons.push("le message d’accueil (139 caractères au plus)");
          if ((corpsProfil.description || "").length > 512) soupcons.push("la description (512 caractères au plus)");
          explication = soupcons.length
            ? `Meta a refusé sans dire pourquoi. Vérifiez ${soupcons.join(", ")}.`
            : "Meta a refusé sans dire pourquoi. Vérifiez que l’adresse du site commence par https:// et que l’e-mail est valide.";
        }
        return res.status(reponse.status).json({ error: explication || "Meta a refusé la modification.", code: code || null });
      }
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(502).json({ error: "Impossible de joindre Meta." });
    }
  }

  /*
   * L'état des modèles, tel que Meta le voit.
   *
   * Un modèle « En cours d'examen » est invisible à l'envoi : il échoue exactement comme un
   * modèle qui n'existerait pas. Sans cette liste, on ne peut pas distinguer « Meta n'a pas fini »
   * de « le nom est faux » — et l'on cherche une erreur là où il n'y a qu'à patienter.
   *
   * Demande l'identifiant du compte professionnel (WHATSAPP_WABA_ID). Sans lui, on le dit
   * plutôt que de faire semblant.
   */
  /*
   * L'ABONNEMENT DE L'APPLICATION AU COMPTE — la case qu'on ne voit nulle part.
   *
   * Déclarer l'adresse du webhook et cocher le champ « messages » se fait au niveau de
   * l'APPLICATION. Encore faut-il que cette application soit abonnée au COMPTE PROFESSIONNEL qui
   * porte le numéro : c'est une seconde opération, invisible dans l'écran des webhooks, et rien
   * n'avertit quand elle manque. Tout paraît alors en ordre — l'adresse est vérifiée, le champ est
   * sur « Abonné » — et Meta n'appelle jamais. Les messages des clients tombent dans le vide.
   *
   * Meta expose la liste ; on la lit plutôt que de la deviner.
   */
  if (req.query?.abonnement !== undefined && (req.method === "GET" || req.method === "POST")) {
    const waba = process.env.WHATSAPP_WABA_ID;
    if (!metaPret) return res.status(501).json({ error: "Meta n'est pas configuré.", configure: false });
    if (!waba) {
      return res.status(501).json({
        error: "Ajoutez WHATSAPP_WABA_ID dans Vercel — c'est l'« ID du compte WhatsApp Business », "
          + "affiché au-dessus de vos numéros dans la console Meta.",
        manquant: "WHATSAPP_WABA_ID",
      });
    }
    try {
      const reponse = await fetch(
        `https://graph.facebook.com/${VERSION_GRAPH}/${encodeURIComponent(waba)}/subscribed_apps`,
        { method: req.method, headers: { Authorization: `Bearer ${meta.jeton}` } },
      );
      const corps = await reponse.json().catch(() => ({}));
      if (!reponse.ok) {
        const code = corps?.error?.code;
        return res.status(reponse.status).json({
          error: EXPLICATIONS_META[code] || corps?.error?.message || "Meta n'a pas répondu.",
          code: code || null,
        });
      }
      // POST ne rend qu'un accusé ; c'est la lecture qui porte la liste.
      if (req.method === "POST") return res.status(200).json({ ok: corps?.success !== false });
      const applications = (corps.data || []).map((a) => ({
        id: a?.whatsapp_business_api_data?.id || null,
        nom: a?.whatsapp_business_api_data?.name || null,
      }));
      return res.status(200).json({ abonne: applications.length > 0, applications });
    } catch (e) {
      return res.status(502).json({ error: "Impossible de joindre Meta." });
    }
  }

  /*
   * LES NUMÉROS DU COMPTE, ET LEQUEL ENVOIE.
   *
   * Changer la ligne qui envoie les messages ne se fait pas dans ce programme : elle est désignée
   * par WHATSAPP_PHONE_ID, une variable de Vercel. Encore faut-il connaître l'identifiant du
   * nouveau numéro — un nombre à quinze chiffres qui n'a rien à voir avec le numéro lui-même, et
   * qu'on va chercher dans la console Meta en s'y perdant.
   *
   * Cette liste le donne. Elle nomme aussi celui qui envoie AUJOURD'HUI : sans cela, on recopie une
   * variable sans savoir si l'on a changé quelque chose, et l'on découvre l'erreur au premier
   * message parti du mauvais numéro — c'est-à-dire devant un client.
   */
  if (req.method === "GET" && req.query?.numeros !== undefined) {
    const waba = process.env.WHATSAPP_WABA_ID;
    if (!metaPret) return res.status(501).json({ error: "Meta n'est pas configuré.", configure: false });
    if (!waba) {
      return res.status(501).json({
        error: "Ajoutez WHATSAPP_WABA_ID dans Vercel — c'est l'« ID du compte WhatsApp Business », "
          + "affiché au-dessus de vos numéros dans la console Meta.",
        manquant: "WHATSAPP_WABA_ID",
      });
    }
    try {
      const champs = "id,display_phone_number,verified_name,quality_rating,status,code_verification_status";
      const reponse = await fetch(
        `https://graph.facebook.com/${VERSION_GRAPH}/${encodeURIComponent(waba)}/phone_numbers?fields=${champs}&limit=50`,
        { headers: { Authorization: `Bearer ${meta.jeton}` } },
      );
      const corps = await reponse.json();
      if (!reponse.ok) {
        const code = corps?.error?.code;
        return res.status(reponse.status).json({
          error: EXPLICATIONS_META[code] || corps?.error?.message || "Meta n'a pas répondu.",
          code: code || null,
        });
      }
      const numeros = (corps.data || []).map((n) => ({
        id: n.id,
        numero: n.display_phone_number || "",
        nom: n.verified_name || "",
        qualite: n.quality_rating || null,
        etat: n.status || null,
        verifie: n.code_verification_status || null,
        /* Celui par lequel les messages partent en ce moment. */
        actif: String(n.id) === String(meta.numeroId),
      }));
      return res.status(200).json({
        numeros,
        /*
         * L'identifiant configuré est rendu tel quel : ce n'est pas un secret — il désigne une
         * ligne, il n'ouvre rien. Le jeton, lui, ne sort jamais d'ici.
         */
        actuel: meta.numeroId || null,
        /* Vrai quand la variable désigne une ligne qui n'est plus sur ce compte. */
        actuelInconnu: !!meta.numeroId && !numeros.some((n) => n.actif),
      });
    } catch (e) {
      return res.status(502).json({ error: "Impossible de joindre Meta." });
    }
  }

  if (req.method === "GET" && req.query?.modeles !== undefined) {
    const waba = process.env.WHATSAPP_WABA_ID;
    if (!metaPret) return res.status(501).json({ error: "Meta n'est pas configuré.", configure: false });
    if (!waba) {
      return res.status(501).json({
        error: "Ajoutez WHATSAPP_WABA_ID dans Vercel — c'est l'« ID du compte WhatsApp Business », "
          + "affiché au-dessus de vos numéros dans la console Meta.",
        manquant: "WHATSAPP_WABA_ID",
      });
    }
    try {
      const reponse = await fetch(
        `https://graph.facebook.com/${VERSION_GRAPH}/${waba}/message_templates?fields=name,status,language,category,components&limit=100`,
        { headers: { Authorization: `Bearer ${meta.jeton}` } },
      );
      const corps = await reponse.json();
      if (!reponse.ok) {
        const code = corps?.error?.code;
        return res.status(reponse.status).json({
          error: EXPLICATIONS_META[code] || corps?.error?.message || "Meta n'a pas répondu.",
          code: code || null,
        });
      }
      const modeles = (corps.data || []).map((m) => ({
        nom: m.name, statut: m.status, langue: m.language, categorie: m.category,
        ...formeDuModele(m.components),
      }));
      return res.status(200).json({
        modeles,
        approuves: modeles.filter((m) => m.statut === "APPROVED").length,
        enAttente: modeles.filter((m) => m.statut === "PENDING" || m.statut === "IN_APPEAL").length,
        refuses: modeles.filter((m) => m.statut === "REJECTED").length,
      });
    } catch (e) {
      return res.status(502).json({ error: "Impossible de joindre Meta." });
    }
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
    const { to, message, mediaUrl, modele, variables, document, boutonUrl, texteLibre, otp } = req.body || {};
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
        /*
         * Le modèle donné par l'appelant l'emporte ; à défaut celui configuré sur le serveur.
         *
         * `texteLibre` coupe court à ce repli, et il n'est pas un détail : le modèle par défaut
         * est celui du SUIVI DE COLIS. Un appelant qui n'en demande aucun — la réinitialisation de
         * mot de passe, par exemple — se voyait envoyer ce modèle-là, sans ses variables. Meta
         * refusait l'envoi, ou pire, le client recevait un message de suivi à la place de son
         * code. « Aucun modèle » doit pouvoir se dire ; sans ce drapeau, c'était impossible.
         */
        modele: texteLibre ? null : (modele || meta.modele || null),
        variables,
        /*
         * Le code à usage unique, quand l'appelant en envoie un : il sert à remplir le bouton
         * qu'un modèle d'authentification porte obligatoirement. Le type de bouton est celui que
         * Meta a validé, déclaré une fois pour toutes côté serveur.
         */
        otp,
        otpBouton: process.env.WHATSAPP_TEMPLATE_CODE_BOUTON || "url",
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
