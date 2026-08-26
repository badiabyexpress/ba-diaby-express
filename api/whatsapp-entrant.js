/**
 * Fonction serverless Vercel — LA RÉCEPTION des messages WhatsApp.
 *
 * POURQUOI CE FICHIER
 * -------------------
 * En inscrivant le numéro sur l'API Cloud, il a quitté l'application WhatsApp Business : plus
 * aucun téléphone ne sonne quand un client écrit. Meta ne garde pas ces messages pour nous —
 * il les POUSSE, une fois, vers une adresse que nous lui donnons. Si personne n'écoute à cette
 * adresse, le message du client est perdu, et le client, lui, croit avoir écrit.
 *
 * C'est cette adresse. Elle fait deux choses, et seulement deux.
 *
 * GET  — la vérification. Meta appelle l'adresse avec un jeton et un défi ; il faut lui rendre
 *        le défi tel quel, sinon il refuse d'enregistrer le webhook. Une fois pour toutes.
 * POST — la réception. Deux choses arrivent par cette porte, et elles n'ont rien à voir :
 *        les MESSAGES qu'un client écrit (rangés sous `messagesWhatsApp`), et les ACCUSÉS de
 *        ce que nous avons nous-mêmes envoyé — parti, remis, lu, échoué (rangés sous
 *        `statutsWhatsApp`, indexés par l'identifiant que Meta a donné au message).
 *
 * POURQUOI LES ACCUSÉS SONT RANGÉS À PART. Ils arrivent souvent AVANT que l'application ait fini
 * d'enregistrer le message qu'elle vient d'envoyer — Meta est plus rapide que notre écriture en
 * base. Les ranger dans la liste des messages supposerait de retrouver une ligne qui n'existe pas
 * encore, et l'accusé serait perdu. Une table à part, indexée par identifiant, n'a pas ce
 * problème : l'écran réunit les deux au moment de l'affichage.
 *
 * CE QU'ELLE NE FAIT PAS
 * ----------------------
 * Elle ne répond pas, elle ne décide rien, elle n'appelle aucun autre service. Un webhook doit
 * rendre la main en quelques secondes, sans quoi Meta le considère en panne et finit par le
 * désactiver — on perdrait alors tous les messages suivants. Répondre est le travail de l'agent,
 * depuis l'application.
 *
 * VARIABLES D'ENVIRONNEMENT
 * -------------------------
 *   WHATSAPP_VERIFY_TOKEN   mot de passe que VOUS choisissez et recopiez chez Meta — SECRET
 *   WHATSAPP_APP_SECRET     facultatif : permet de vérifier la signature de chaque appel
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   déjà en place pour le reste du serveur
 *
 * L'ADRESSE À DÉCLARER CHEZ META
 * ------------------------------
 *   https://votre-domaine/api/whatsapp-entrant?jeton=LE_MEME_QUE_WHATSAPP_VERIFY_TOKEN
 * et, dans le même écran, s'abonner au champ « messages ». Le jeton dans l'adresse sert de
 * preuve à chaque appel : voir jetonUrlValide() plus bas.
 *
 * POURQUOI LA SIGNATURE COMPTE
 * ----------------------------
 * Cette adresse est publique — elle doit l'être, Meta l'appelle depuis ses serveurs. N'importe
 * qui peut donc lui envoyer un faux message et faire apparaître dans votre Centre clients une
 * conversation qui n'a jamais eu lieu. Meta signe chaque appel avec le secret de l'application ;
 * tant que WHATSAPP_APP_SECRET est renseigné, tout appel mal signé est refusé.
 */

import crypto from "node:crypto";
import { baseConfiguree, modifierDocument } from "./_base.js";

/** On ne garde pas l'historique complet : le document principal est relu à chaque écran. */
const MAX_MESSAGES = 300;
/** Autant d'accusés que de messages suivis : au-delà, les plus anciens ne servent plus à rien. */
const MAX_STATUTS = 500;
/** Un message WhatsApp fait au plus 4096 caractères ; au-delà, ce n'est plus un message. */
const MAX_TEXTE = 4096;

/**
 * La signature de Meta, calculée sur le corps BRUT.
 *
 * Il faut donc lire le flux nous-mêmes : dès que Vercel a transformé le corps en objet, les
 * espaces et l'ordre des clés ne sont plus ceux qui ont été signés, et la comparaison échoue
 * pour de mauvaises raisons.
 */
async function corpsBrut(req) {
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);
  const morceaux = [];
  for await (const bloc of req) morceaux.push(bloc);
  return Buffer.concat(morceaux).toString("utf8");
}

function signatureValide(brut, entete) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return false;
  if (!entete || !entete.startsWith("sha256=")) return false;
  const attendue = "sha256=" + crypto.createHmac("sha256", secret).update(brut, "utf8").digest("hex");
  const a = Buffer.from(attendue);
  const b = Buffer.from(entete);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Le jeton porté par l'adresse elle-même.
 *
 * La signature de Meta se calcule sur le corps BRUT, octet pour octet. Or l'hébergeur transforme
 * souvent ce corps en objet avant de nous le confier : le reconstruire ne redonne pas exactement
 * les mêmes octets, et la signature échoue alors pour une mauvaise raison. On ajoute donc au bout
 * de l'adresse déclarée chez Meta un jeton que lui seul connaît — il le renvoie à chaque appel,
 * et c'est une preuve qui ne dépend d'aucune reconstitution.
 *
 * Les deux preuves sont acceptées : la signature quand elle est vérifiable, le jeton sinon.
 */
function jetonUrlValide(req) {
  const attendu = process.env.WHATSAPP_VERIFY_TOKEN;
  const recu = req.query?.jeton;
  if (!attendu || !recu) return false;
  const a = Buffer.from(String(attendu));
  const b = Buffer.from(String(recu));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Le texte d'un message, quelle que soit sa forme. Un vocal n'a pas de texte : on le nomme. */
function texteDuMessage(m) {
  if (m?.text?.body) return String(m.text.body).slice(0, MAX_TEXTE);
  if (m?.button?.text) return String(m.button.text).slice(0, MAX_TEXTE);
  if (m?.interactive?.button_reply?.title) return String(m.interactive.button_reply.title).slice(0, MAX_TEXTE);
  if (m?.interactive?.list_reply?.title) return String(m.interactive.list_reply.title).slice(0, MAX_TEXTE);
  const nature = { image: "une photo", audio: "un message vocal", video: "une vidéo",
    document: "un document", sticker: "un autocollant", location: "sa position",
    contacts: "un contact" }[m?.type];
  return nature ? `[${nature}]` : "[message non textuel]";
}

/*
 * Les accusés de réception : ce qu'il est advenu de CE QUE NOUS AVONS ENVOYÉ.
 *
 * Meta les nomme en anglais — sent, delivered, read, failed. On les traduit ici une fois pour
 * toutes, plutôt que dans chaque écran. « failed » porte une erreur, et c'est la seule qui
 * intéresse vraiment : elle dit pourquoi un client n'a rien reçu.
 */
const ETATS_META = { sent: "envoye", delivered: "delivre", read: "lu", failed: "echec" };

function statutsDeLaNotification(corps) {
  const sortie = [];
  (corps?.entry || []).forEach((entree) => {
    (entree?.changes || []).forEach((changement) => {
      (changement?.value?.statuses || []).forEach((s) => {
        if (!s?.id || !s?.status) return;
        const erreur = Array.isArray(s.errors) && s.errors[0]
          ? String(s.errors[0].title || s.errors[0].message || s.errors[0].code || "").slice(0, 200)
          : null;
        sortie.push({
          wamid: s.id,
          statut: ETATS_META[s.status] || String(s.status),
          date: s.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : new Date().toISOString(),
          ...(erreur ? { erreur } : {}),
        });
      });
    });
  });
  return sortie;
}

/**
 * Les messages contenus dans une notification Meta : ce qu'un client a écrit.
 *
 * Une même notification peut en porter plusieurs, et porte aussi les accusés traités ci-dessus —
 * on ne retient ici que les messages entrants.
 */
function messagesDeLaNotification(corps) {
  const sortie = [];
  (corps?.entry || []).forEach((entree) => {
    (entree?.changes || []).forEach((changement) => {
      const valeur = changement?.value || {};
      const contacts = valeur.contacts || [];
      (valeur.messages || []).forEach((m) => {
        if (!m?.from || !m?.id) return;
        const contact = contacts.find((c) => c?.wa_id === m.from);
        sortie.push({
          id: `wa-${m.id}`,
          de: `+${String(m.from).replace(/\D/g, "")}`,
          nom: (contact?.profile?.name || "").slice(0, 80),
          texte: texteDuMessage(m),
          type: m.type || "text",
          // L'horodatage de Meta est en secondes ; le reste de l'application parle en ISO.
          date: m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString(),
          numeroRecepteur: valeur?.metadata?.display_phone_number || null,
          lu: false,
        });
      });
    });
  });
  return sortie;
}

/**
 * Le numéro que Meta déclare servir dans cette notification.
 *
 * Il vaut une confirmation : si les appels arrivent mais portent un autre numéro, on écoute la
 * ligne d'un autre compte, et aucun message de nos clients n'arrivera jamais ici.
 */
function numeroDeLaNotification(corps) {
  for (const entree of corps?.entry || []) {
    for (const changement of entree?.changes || []) {
      const n = changement?.value?.metadata?.display_phone_number;
      if (n) return String(n).slice(0, 30);
    }
  }
  return null;
}

/*
 * LES APPELS QUE NOUS REFUSONS — l'autre moitié du diagnostic.
 *
 * Un webhook silencieux a deux causes opposées, et elles se ressemblent trait pour trait :
 * Meta n'appelle pas (l'application n'est pas abonnée au compte du numéro), ou Meta appelle et
 * nous le renvoyons (l'adresse déclarée chez lui a perdu son « ?jeton= », et aucune signature ne
 * peut le remplacer sans WHATSAPP_APP_SECRET). Dans les deux cas le Centre clients reste vide.
 *
 * Sans cette note, les deux étaient indistinguables et l'on cherchait au mauvais endroit — alors
 * que le second se répare en recollant le jeton au bout de l'adresse.
 *
 * DEUX PRÉCAUTIONS, parce que cette adresse est publique et qu'écrire coûte.
 *   — On ne note que ce qui a la FORME d'une notification Meta ; le reste est du bruit d'internet.
 *   — Une note au plus toutes les cinq minutes par instance : sans ce frein, n'importe qui
 *     pourrait provoquer une écriture en base à volonté.
 */
const INTERVALLE_NOTE_REFUS = 5 * 60 * 1000;
let dernierRefusNote = 0;

async function noterRefus(brut) {
  let forme = null;
  try { forme = JSON.parse(brut || "{}"); } catch (e) { return; }
  if (forme?.object !== "whatsapp_business_account" || !Array.isArray(forme.entry)) return;
  const maintenant = Date.now();
  if (maintenant - dernierRefusNote < INTERVALLE_NOTE_REFUS) return;
  dernierRefusNote = maintenant;
  if (!baseConfiguree()) return;
  try {
    await modifierDocument((document) => ({
      document: {
        ...document,
        receptionWhatsApp: {
          ...(document.receptionWhatsApp || {}),
          refuses: (Number(document.receptionWhatsApp?.refuses) || 0) + 1,
          dernierRefus: new Date().toISOString(),
        },
      },
    }));
  } catch (e) {
    console.error("whatsapp-entrant : refus non noté", e);
  }
}

export default async function handler(req, res) {
  /*
   * LA VÉRIFICATION. Meta appelle une seule fois, au moment où l'on enregistre l'adresse dans
   * le tableau de bord : il envoie un jeton et un défi, et attend le défi en clair. Un jeton qui
   * ne correspond pas doit être refusé — sans quoi n'importe qui pourrait détourner l'adresse.
   */
  if (req.method === "GET") {
    const attendu = process.env.WHATSAPP_VERIFY_TOKEN;
    if (!attendu) {
      return res.status(501).json({ error: "WHATSAPP_VERIFY_TOKEN n'est pas configuré sur le serveur." });
    }
    const mode = req.query?.["hub.mode"];
    const jeton = req.query?.["hub.verify_token"];
    const defi = req.query?.["hub.challenge"];
    if (mode === "subscribe" && jeton === attendu) {
      res.setHeader("Content-Type", "text/plain");
      return res.status(200).send(String(defi ?? ""));
    }
    return res.status(403).json({ error: "Jeton de vérification refusé." });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  /*
   * À partir d'ici, on répond 200 quoi qu'il arrive.
   *
   * Meta réessaie un message qu'il croit non livré, puis désactive le webhook s'il échoue trop
   * souvent — et l'on perdrait alors TOUS les messages suivants, pas seulement celui-ci. Une
   * base momentanément indisponible ne doit pas coûter la réception entière. On accuse donc
   * réception, et l'on trace ce qui n'a pas pu être rangé.
   */
  try {
    if (!process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(501).json({ error: "WHATSAPP_VERIFY_TOKEN n'est pas configuré sur le serveur." });
    }
    const brut = await corpsBrut(req);
    if (!jetonUrlValide(req) && !signatureValide(brut, req.headers["x-hub-signature-256"])) {
      /*
       * Un appel qui ne porte ni le jeton de l'adresse ni la signature de Meta n'est pas Meta —
       * mais il peut aussi être Meta appelant une adresse à qui l'on a oublié de recoller son
       * jeton. On refuse dans les deux cas, et l'on garde la trace : c'est elle qui distingue
       * « Meta n'appelle pas » de « Meta appelle et nous le renvoyons ».
       */
      await noterRefus(brut);
      return res.status(401).json({ error: "Appel non authentifié." });
    }
    if (!baseConfiguree()) {
      console.error("whatsapp-entrant : base non configurée, message reçu mais non rangé.");
      return res.status(200).json({ recu: true });
    }
    let corps;
    try { corps = JSON.parse(brut || "{}"); }
    catch (e) { return res.status(200).json({ recu: true }); }

    const messages = messagesDeLaNotification(corps);
    const statuts = statutsDeLaNotification(corps);
    const numeroServi = numeroDeLaNotification(corps);

    await modifierDocument((document) => {
      const existants = Array.isArray(document.messagesWhatsApp) ? document.messagesWhatsApp : [];
      /*
       * Meta renvoie un message qu'il n'a pas vu acquitté : sans cette garde, un incident réseau
       * de son côté ferait apparaître la même phrase deux fois dans la conversation.
       */
      const connus = new Set(existants.map((m) => m.id));
      const nouveaux = messages.filter((m) => !connus.has(m.id));

      /*
       * Les accusés ne s'accumulent pas : un même message passe par « parti », « remis », « lu ».
       * On garde le dernier état connu de chacun, jamais l'historique de ses états.
       */
      const anciensStatuts = document.statutsWhatsApp && typeof document.statutsWhatsApp === "object"
        ? document.statutsWhatsApp : {};
      const majStatuts = { ...anciensStatuts };
      statuts.forEach((s) => {
        const precedent = majStatuts[s.wamid];
        // Un accusé en retard ne doit pas faire reculer l'état : « lu » ne redevient pas « parti ».
        const rang = { envoye: 1, delivre: 2, lu: 3, echec: 4 };
        if (precedent && (rang[precedent.statut] || 0) > (rang[s.statut] || 0)) return;
        majStatuts[s.wamid] = { statut: s.statut, date: s.date, ...(s.erreur ? { erreur: s.erreur } : {}) };
      });
      const clefs = Object.keys(majStatuts);
      const tailles = clefs.length > MAX_STATUTS
        ? Object.fromEntries(clefs
            .sort((a, b) => new Date(majStatuts[b].date || 0) - new Date(majStatuts[a].date || 0))
            .slice(0, MAX_STATUTS).map((k) => [k, majStatuts[k]]))
        : majStatuts;

      /*
       * La trace de l'appel lui-même — et c'est elle qui manquait le plus.
       *
       * Devant un Centre clients vide, rien ne permettait de distinguer « aucun client n'a encore
       * écrit » de « Meta n'appelle pas cette adresse ». Les deux se ressemblent trait pour trait,
       * et la seconde veut dire que les messages des clients se perdent depuis des jours. On ne
       * pouvait trancher qu'en allant lire les journaux de l'hébergeur.
       *
       * On note donc chaque appel authentifié, y compris ceux qui ne portent rien à ranger : le
       * bouton « Tester » du tableau de bord Meta en envoie un, et il suffit alors à prouver que
       * la plomberie tient. Le numéro servi vient avec : si les appels arrivent mais portent une
       * autre ligne, c'est un autre compte qu'on écoute.
       */
      const reception = {
        dernierAppel: new Date().toISOString(),
        appels: (Number(document.receptionWhatsApp?.appels) || 0) + 1,
        dernierContenu: messages.length ? "message" : (statuts.length ? "accuse" : "vide"),
        ...(numeroServi ? { numero: numeroServi } : {}),
      };
      return {
        document: {
          ...document,
          receptionWhatsApp: reception,
          ...(nouveaux.length ? { messagesWhatsApp: [...nouveaux, ...existants].slice(0, MAX_MESSAGES) } : {}),
          ...(statuts.length ? { statutsWhatsApp: tailles } : {}),
        },
        retour: nouveaux.length + statuts.length,
      };
    });
    return res.status(200).json({ recu: true });
  } catch (e) {
    console.error("whatsapp-entrant : réception impossible", e);
    return res.status(200).json({ recu: true });
  }
}
