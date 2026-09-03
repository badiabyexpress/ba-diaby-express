/**
 * Fonction serverless Vercel — mot de passe et identifiant oubliés, pour un client comme pour un
 * membre de l'équipe (agent, comptable, partenaire).
 *
 * POURQUOI CE FICHIER
 * -------------------
 * Deux raisons, et la seconde est la plus grave.
 *
 * 1. C'est le dernier geste qui écrivait dans la base sans jeton — celui qui a oublié son mot de
 *    passe ne peut pas se connecter pour le changer. Tant qu'il passe par la clé publique, la base
 *    ne peut pas lui être fermée.
 *
 * 2. LE CODE ÉTAIT FABRIQUÉ ET VÉRIFIÉ DANS LE NAVIGATEUR. Il était tiré au sort par la page,
 *    gardé dans son état, envoyé sur WhatsApp, puis comparé à ce que la personne saisissait — le
 *    tout du même côté. N'importe qui pouvait le lire dans les outils de développement et changer
 *    le mot de passe de n'importe quel compte dont il connaissait l'identifiant. L'envoi WhatsApp
 *    donnait l'apparence d'une protection sans en être une.
 *
 * Ici, le code est tiré au sort par le serveur, ne redescend jamais au navigateur, et c'est le
 * serveur qui le compare. La page ne peut plus rien en savoir.
 *
 * OÙ EST RANGÉ LE CODE EN ATTENTE
 * -------------------------------
 * Sous une clé à part, `bde-reinit`, et non sur la fiche du client. Le document principal est
 * servi en entier à toute personne connectée : y déposer un code de réinitialisation reviendrait à
 * le montrer à tous les clients de l'entreprise. api/donnees.js refuse cette clé — elle
 * n'appartient qu'à cette fonction.
 *
 * Le code y est haché, jamais en clair : si la ligne fuitait, elle ne donnerait pas les codes.
 *
 * DEUX VOIES, ET UN IDENTIFIANT QU'ON PEUT AUSSI PERDRE
 * -----------------------------------------------------
 * Le code ne partait que sur WhatsApp. C'était compter sur une seule porte : le client qui a changé
 * de numéro, celui dont le message tombe hors de la fenêtre de vingt-quatre heures, celui qui n'a
 * pas WhatsApp sur son téléphone en France — aucun ne pouvait aller au bout. Le code part désormais
 * sur les DEUX voies dont le compte dispose, WhatsApp et e-mail ; une seule qui arrive suffit.
 *
 * Et surtout : on pouvait retrouver son mot de passe, jamais son IDENTIFIANT. Or il se choisit
 * librement à l'inscription — donc il s'oublie. Sans lui, la réinitialisation elle-même était
 * inaccessible : il fallait appeler l'agence. L'étape « identifiant » referme ce trou, en
 * l'envoyant sur le numéro ou l'adresse déjà inscrits au compte.
 */

import { baseConfiguree, lireCle, ecrireCle, modifierDocument } from "./_base.js";
import { hashPBKDF2, identifiantsMotDePasse, egaliteSure, genererCode, genererSel } from "./_motdepasse.js";
import { jetonInterne, ENTETE_INTERNE } from "./_session.js";
import { passage, adresseDe, refuser } from "./_verrou.js";

export const CLE_REINIT = "bde-reinit";

const MINUTES_VALIDITE = 10;
const ESSAIS_MAX = 5;
const LONGUEUR_MOT_DE_PASSE = 8;

/*
 * Le code ne fait que six chiffres : mille fois moins d'essais qu'un mot de passe. On le hache
 * donc avec le même PBKDF2 que les mots de passe — 150 000 tours — pour que même quelqu'un qui
 * mettrait la main sur la ligne ne puisse pas les parcourir tous à moindre frais.
 */
function empreinteCode(code, sel) {
  return hashPBKDF2(code, sel);
}

/** Affiche 62•••••99 : assez pour se reconnaître, pas assez pour deviner le numéro. */
function masquerNumero(tel) {
  const n = String(tel || "").replace(/\D/g, "");
  if (n.length < 4) return "votre numéro";
  return n.slice(0, 2) + "•".repeat(Math.max(n.length - 4, 3)) + n.slice(-2);
}

/** Affiche ma••••@gmail.com : le domaine reste lisible, le nom de boîte non. */
function masquerEmail(adresse) {
  const brut = String(adresse || "").trim();
  const arobase = brut.lastIndexOf("@");
  if (arobase < 1) return "";
  const debut = brut.slice(0, arobase);
  const domaine = brut.slice(arobase);
  return debut.slice(0, 2) + "•".repeat(Math.max(debut.length - 2, 3)) + domaine;
}

/** Ne garde que les chiffres : « +224 620 11 12 22 » et « 224620111222 » sont le même numéro. */
function chiffres(valeur) {
  return String(valeur || "").replace(/\D/g, "");
}

/*
 * Un ralentisseur par adresse — et un second, par compte visé.
 *
 * Cette fonction est ouverte à qui connaît son adresse : c'est sa nature même, celui qui a perdu
 * son mot de passe n'a pas de session à présenter. Mais chacun de ses appels FAIT DÉPENSER —
 * un message facturé par Meta, un courriel qui engage la réputation du domaine. Sans compteur,
 * une boucle de quelques lignes vidait le quota de l'entreprise et faisait sonner le téléphone
 * d'un client toute la nuit.
 *
 * IL Y AVAIT BIEN UN COMPTEUR, MAIS IL ÉTAIT EN MÉMOIRE.
 *
 * Une fonction serverless ne tourne pas sur une machine : il s'en allume autant qu'il en faut, et
 * chacune démarre avec sa propre mémoire vide. Le plafond de dix par heure valait donc PAR
 * INSTANCE — et il suffisait d'appeler assez vite pour en faire naître d'autres, chacune offrant
 * dix appels neufs. Le compteur ralentissait un client maladroit ; il n'arrêtait pas ce contre
 * quoi il était écrit. Le verrou de `_verrou.js`, lui, compte dans la base : il est le même pour
 * toutes les instances.
 *
 * ET UN SECOND COMPTEUR, PAR COMPTE.
 *
 * Le premier protège l'entreprise ; il ne protège pas le client. Quelqu'un qui dispose de
 * plusieurs adresses passait dessous et faisait sonner le téléphone d'une personne précise toute
 * la nuit — chaque message étant, de surcroît, facturé. Trois codes par heure et par compte
 * suffisent largement à qui a vraiment perdu son mot de passe.
 */
const DEMANDES_PAR_ADRESSE = 10;
const DEMANDES_PAR_COMPTE = 3;
const FENETRE_DEMANDES_MS = 60 * 60 * 1000;

async function lireDemandes() {
  const { valeur } = await lireCle(CLE_REINIT);
  return valeur && typeof valeur === "object" ? valeur : {};
}

/** Écrit les demandes en cours, débarrassées de celles qui ont expiré. */
async function ecrireDemandes(demandes) {
  const maintenant = Date.now();
  const vivantes = {};
  for (const [id, d] of Object.entries(demandes)) {
    if (d && d.expireA > maintenant) vivantes[id] = d;
  }
  await ecrireCle(CLE_REINIT, vivantes);
}

/*
 * L'envoi WhatsApp réutilise api/whatsapp.js plutôt que d'en refaire une copie : le jour où
 * l'entreprise passera de Twilio à Meta, il n'y aura qu'un fichier à changer.
 *
 * Cet appel-là n'a aucune session à présenter, et pour cause : la personne qui demande n'est pas
 * connectée, c'est justement son mot de passe qu'elle a perdu. Il porte donc le laissez-passer des
 * appels de serveur à serveur, qui ne quitte jamais le déploiement — sans quoi fermer
 * api/whatsapp.js aux inconnus fermerait du même coup la réinitialisation.
 */
async function appelInterne(req, chemin, corps) {
  const hote = req.headers["x-forwarded-host"] || req.headers.host;
  const protocole = req.headers["x-forwarded-proto"] || "https";
  if (!hote) return false;
  const laissezPasser = jetonInterne();
  try {
    const reponse = await fetch(`${protocole}://${hote}${chemin}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(laissezPasser ? { [ENTETE_INTERNE]: laissezPasser } : {}),
      },
      body: JSON.stringify(corps),
    });
    if (!reponse.ok) {
      const detail = await reponse.json().catch(() => ({}));
      console.error(`Envoi refusé par ${chemin}`, reponse.status, detail?.error || "");
    }
    return reponse.ok;
  } catch (e) {
    console.error(`Envoi impossible par ${chemin}`, e);
    return false;
  }
}

/*
 * WhatsApp — et une précision qui décide de tout : `texteLibre`.
 *
 * api/whatsapp.js retombe, quand l'appelant ne demande aucun modèle, sur celui configuré par
 * défaut sur le serveur — le modèle de SUIVI DE COLIS. Un code de réinitialisation partait donc
 * sous les habits d'une notification de colis, sans ses variables : refusé par Meta, ou reçu par
 * le client sans le code qu'il attendait. Ce drapeau dit « aucun modèle, du texte », et le message
 * part tel qu'il est écrit ici.
 *
 * Le texte libre n'est accepté par Meta que dans les vingt-quatre heures suivant le dernier message
 * du client. C'est la limite de cette voie, et la raison pour laquelle l'e-mail existe à côté :
 * WHATSAPP_TEMPLATE_CODE, quand un modèle d'authentification est validé, la lève entièrement.
 */
async function envoyerCodeWhatsApp(req, telephone, code) {
  const modele = process.env.WHATSAPP_TEMPLATE_CODE || null;
  return appelInterne(req, "/api/whatsapp", {
    to: telephone,
    message: `Ba-Diaby Express — votre code de réinitialisation est ${code}. Il expire dans ${MINUTES_VALIDITE} minutes. Si vous n’avez rien demandé, ignorez ce message.`,
    ...(modele ? { modele, variables: [String(code)] } : { texteLibre: true }),
  });
}

/*
 * E-mail — la seconde voie, et souvent la seule qui reste.
 *
 * Elle ne dépend ni de la fenêtre de vingt-quatre heures, ni du fait que le client ait gardé le
 * numéro qu'il avait à l'inscription. Sans RESEND_API_KEY, api/email.js répond 501 et l'on retombe
 * simplement sur WhatsApp : rien ne casse.
 */
async function envoyerCodeEmail(req, adresse, code) {
  return appelInterne(req, "/api/email", {
    to: adresse,
    sujet: "Ba-Diaby Express — votre code de réinitialisation",
    message: `<p>Bonjour,</p><p>Votre code de réinitialisation est <b style="font-size:20px;letter-spacing:3px">${code}</b>.</p>`
      + `<p>Il expire dans ${MINUTES_VALIDITE} minutes.</p>`
      + `<p style="color:#666;font-size:13px">Si vous n’avez rien demandé, ignorez ce message : votre mot de passe reste inchangé.</p>`,
  });
}

/*
 * L'identifiant perdu.
 *
 * On l'envoie en clair au titulaire — c'est le but — mais jamais à celui qui pose la question :
 * la réponse à l'écran ne le contient pas. Le savoir ne donne d'ailleurs aucun accès : il faut
 * ensuite le code de réinitialisation, qui part sur le même numéro ou la même adresse.
 */
async function envoyerIdentifiantWhatsApp(req, telephone, identifiants) {
  const modele = process.env.WHATSAPP_TEMPLATE_CODE || null;
  const liste = identifiants.join(", ");
  return appelInterne(req, "/api/whatsapp", {
    to: telephone,
    message: `Ba-Diaby Express — votre identifiant de connexion est ${liste}. Si vous n’avez rien demandé, ignorez ce message.`,
    ...(modele ? { modele, variables: [liste] } : { texteLibre: true }),
  });
}

async function envoyerIdentifiantEmail(req, adresse, identifiants) {
  return appelInterne(req, "/api/email", {
    to: adresse,
    sujet: "Ba-Diaby Express — votre identifiant de connexion",
    message: `<p>Bonjour,</p><p>Votre identifiant de connexion est <b>${identifiants.join("</b>, <b>")}</b>.</p>`
      + `<p>Vous pouvez maintenant vous connecter, ou demander un code si vous avez aussi oublié votre mot de passe.</p>`
      + `<p style="color:#666;font-size:13px">Si vous n’avez rien demandé, ignorez ce message.</p>`,
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  if (!baseConfiguree()) {
    return res.status(501).json({ error: "Réinitialisation côté serveur non configurée" });
  }

  const { etape, identifiant, code, motdepasse, contact, espace } = req.body || {};
  const cherche = String(identifiant || "").trim().toLowerCase();

  /*
   * Deux populations, deux listes — et la même sortie de secours pour les deux.
   *
   * Elle n'existait que pour les clients. Un agent ou un partenaire qui perdait son mot de passe
   * devait attendre qu'un administrateur lui en fabrique un, le lui dicte au téléphone, et donc
   * le connaisse. Un partenaire, lui, n'a personne au-dessus : son compte est le seul de son
   * entreprise. Le voilà autonome.
   *
   * L'espace est respecté strictement, comme à la connexion : un compte client ne doit jamais
   * ouvrir une session d'employé parce qu'il porte le même identifiant qu'un agent, ni l'inverse.
   */
  const equipe = espace === "equipe";
  const listeDe = (document) => (equipe ? document?.users : document?.clientAccounts) || [];
  const CHAMP = equipe ? "users" : "clientAccounts";

  if (etape === "demande" || etape === "identifiant") {
    const parAdresse = await passage({
      nature: "reinit-demande", cle: adresseDe(req),
      max: DEMANDES_PAR_ADRESSE, fenetreMs: FENETRE_DEMANDES_MS,
    });
    if (parAdresse.bloque) {
      return refuser(res, parAdresse.dansSecondes,
        "Trop de demandes depuis cet appareil. Réessayez dans une heure.");
    }

    /*
     * LE SECOND COMPTEUR PORTE SUR L'IDENTIFIANT DEMANDÉ, PAS SUR LE COMPTE TROUVÉ.
     *
     * La différence n'est pas un détail. Compter sur le compte obligerait à le chercher d'abord, et
     * à ne refuser que s'il existe : le refus lui-même apprendrait alors quels identifiants sont
     * valides — exactement ce que la réponse neutre plus bas s'applique à ne pas dire. Compté sur
     * ce qui est TAPÉ, le plafond se comporte pareil pour un compte réel et pour un nom inventé.
     */
    if (cherche) {
      const parCompte = await passage({
        nature: "reinit-compte", cle: `${equipe ? "equipe" : "client"}|${cherche}`,
        max: DEMANDES_PAR_COMPTE, fenetreMs: FENETRE_DEMANDES_MS,
      });
      if (parCompte.bloque) {
        return refuser(res, parCompte.dansSecondes,
          "Un code a déjà été demandé plusieurs fois pour ce compte. Attendez une heure, ou contactez l’agence.");
      }
    }
  }

  try {
    if (etape === "demande") {
      const { valeur: document } = await lireCle("bde-data");
      const compte = listeDe(document)
        .find((c) => String(c.identifiant || "").toLowerCase() === cherche);

      /*
       * Réponse identique que le compte existe ou non, qu'il ait un numéro ou pas, et que l'envoi
       * réussisse ou échoue.
       *
       * Dire « ce compte n'existe pas » permettrait de découvrir quels identifiants sont valides,
       * et donc de savoir qui est client de l'entreprise. Un 502 sur l'échec d'envoi le disait tout
       * autant, en creux : il ne pouvait tomber que sur un compte réel. C'est pourquoi l'écran
       * suivant indique désormais quoi faire quand rien n'arrive — l'information manquante est
       * rendue au client sans être donnée à l'inconnu.
       */
      const reponseNeutre = {
        envoye: true,
        masque: compte?.telephone ? masquerNumero(compte.telephone) : "votre numéro",
        masqueEmail: compte?.email ? masquerEmail(compte.email) : "",
        minutes: MINUTES_VALIDITE,
      };
      if (!compte || (!compte.telephone && !compte.email)) return res.status(200).json(reponseNeutre);

      /*
       * Le code part sur TOUTES les voies inscrites au compte, et une seule qui arrive suffit.
       * C'est le même code des deux côtés : le client saisit celui qu'il a reçu, peu importe par où.
       */
      const genere = genererCode();
      const voies = await Promise.all([
        compte.telephone ? envoyerCodeWhatsApp(req, compte.telephone, genere) : Promise.resolve(false),
        compte.email ? envoyerCodeEmail(req, compte.email, genere) : Promise.resolve(false),
      ]);
      if (!voies.some(Boolean)) {
        /*
         * Aucune voie n'a abouti. On ne montre PAS le code à l'écran — ce serait annuler la
         * protection pour la commodité, et c'est exactement l'erreur que cette fonction corrige.
         * On n'ouvre pas non plus de demande : il n'y a pas de code à valider.
         */
        console.error("Aucune voie n’a pu porter le code de réinitialisation", { compte: compte.id });
        return res.status(200).json(reponseNeutre);
      }

      const sel = genererSel();
      const demandes = await lireDemandes();
      demandes[compte.id] = {
        sel,
        empreinte: empreinteCode(genere, sel),
        expireA: Date.now() + MINUTES_VALIDITE * 60000,
        essais: 0,
      };
      await ecrireDemandes(demandes);
      return res.status(200).json(reponseNeutre);
    }

    /*
     * L'identifiant oublié.
     *
     * On cherche sur le numéro OU l'adresse e-mail — les deux seules choses qu'un client retient
     * toujours. Un même numéro peut porter plusieurs comptes (un client inscrit deux fois au
     * comptoir) : on les envoie tous, plutôt que d'en désigner un au hasard.
     */
    if (etape === "identifiant") {
      const saisi = String(contact || "").trim();
      const numero = chiffres(saisi);
      const courriel = saisi.toLowerCase();
      const parEmail = saisi.includes("@");

      const reponseNeutre = { envoye: true, parEmail };
      if (!saisi || (!parEmail && numero.length < 8)) return res.status(200).json(reponseNeutre);

      const { valeur: document } = await lireCle("bde-data");
      /*
       * Sur le numéro, on compare les derniers chiffres significatifs : « 620111222 » saisi de
       * mémoire doit retrouver « +224620111222 » enregistré au comptoir. Huit chiffres suffisent à
       * ne pas confondre deux clients, et évitent d'exiger l'indicatif.
       */
      const correspond = (c) => (parEmail
        ? String(c.email || "").trim().toLowerCase() === courriel
        : chiffres(c.telephone).endsWith(numero.slice(-8)));
      const comptes = listeDe(document).filter((c) => c.identifiant && correspond(c));
      if (comptes.length === 0) return res.status(200).json(reponseNeutre);

      const identifiants = [...new Set(comptes.map((c) => c.identifiant))];
      if (parEmail) await envoyerIdentifiantEmail(req, comptes[0].email, identifiants);
      else await envoyerIdentifiantWhatsApp(req, comptes[0].telephone, identifiants);
      return res.status(200).json(reponseNeutre);
    }

    if (etape === "valider") {
      if (!motdepasse || String(motdepasse).length < LONGUEUR_MOT_DE_PASSE) {
        return res.status(400).json({ error: `Choisissez un mot de passe d’au moins ${LONGUEUR_MOT_DE_PASSE} caractères.` });
      }
      const { valeur: document } = await lireCle("bde-data");
      const compte = listeDe(document)
        .find((c) => String(c.identifiant || "").toLowerCase() === cherche);
      const demandes = await lireDemandes();
      const demande = compte ? demandes[compte.id] : null;

      if (!demande || demande.expireA < Date.now()) {
        return res.status(400).json({ error: "Ce code a expiré. Recommencez la demande.", recommencer: true });
      }
      if (demande.essais >= ESSAIS_MAX) {
        return res.status(429).json({ error: "Trop d’essais. Recommencez la demande.", recommencer: true });
      }

      const propose = String(code || "").trim();
      if (!egaliteSure(empreinteCode(propose, demande.sel), demande.empreinte)) {
        demande.essais += 1;
        await ecrireDemandes(demandes);
        return res.status(400).json({ error: "Code incorrect." });
      }

      await modifierDocument((doc) => ({
        document: {
          ...doc,
          [CHAMP]: (doc[CHAMP] || []).map((c) => (
            c.id === compte.id ? { ...c, ...identifiantsMotDePasse(String(motdepasse)), motdepasse: undefined } : c
          )),
        },
      }));

      // Le code a servi : il ne doit pas pouvoir resservir.
      delete demandes[compte.id];
      await ecrireDemandes(demandes);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Étape inconnue." });
  } catch (e) {
    console.error("Échec de la réinitialisation", e);
    return res.status(502).json({ error: "Réinitialisation impossible pour le moment." });
  }
}
