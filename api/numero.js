/**
 * Fonction serverless Vercel — vérifier un numéro de téléphone par un code WhatsApp.
 *
 * POURQUOI CE FICHIER
 * -------------------
 * Le numéro d'un client n'est pas un champ de plus sur sa fiche : c'est là que partent son ticket,
 * l'annonce de l'arrivée de son colis, et le code qui lui rendrait son mot de passe. Il se saisissait
 * pourtant comme une adresse — on tapait ce qu'on voulait, et l'application le croyait.
 *
 * Deux dégâts, tous les deux silencieux :
 *
 *   — UNE FAUTE DE FRAPPE. Un chiffre de travers, et le client cesse d'être prévenu sans que
 *     personne ne l'apprenne. Il croit que l'entreprise l'oublie ; l'entreprise croit l'avoir
 *     prévenu. On ne s'en aperçoit qu'au comptoir, des semaines plus tard.
 *   — LE NUMÉRO D'UN AUTRE. Rien n'empêchait d'inscrire celui du voisin, qui recevrait alors les
 *     références de colis et les montants dus de quelqu'un d'autre.
 *
 * Un code envoyé sur le numéro PROPOSÉ règle les deux d'un coup : seul celui qui a ce téléphone en
 * main peut aller au bout. Le numéro ne s'écrit donc plus depuis le navigateur — il a été retiré
 * des champs que le portail peut modifier (voir CHAMPS_COMPTE_MODIFIABLES dans
 * api/_cloisonnement.js) — et c'est cette fonction, ici, qui le pose une fois la preuve faite.
 *
 * CE QUI DIFFÈRE DE api/motdepasse.js
 * -----------------------------------
 * Là-bas, la personne n'est pas connectée : c'est justement son mot de passe qu'elle a perdu, et
 * la porte doit rester ouverte à tous. Ici elle l'est, et cela change tout : on exige sa session,
 * on ne touche qu'au compte qu'elle désigne, et jamais à celui d'un autre.
 *
 * OÙ EST RANGÉ LE CODE EN ATTENTE
 * -------------------------------
 * Sous une clé à part, `bde-verif-numero`, jamais sur la fiche du client : le document principal
 * est servi à toute personne connectée, y compris aux autres clients. api/donnees.js n'ouvre que
 * `bde-data` et ses sauvegardes, cette clé lui est donc déjà fermée.
 *
 * Le code y est haché, et la demande retient LE NUMÉRO auquel il a été envoyé : sans cela, un code
 * reçu pour un numéro servirait à en faire valider un autre — et toute la preuve tomberait.
 */

import { baseConfiguree, lireCle, ecrireCle, modifierDocument } from "./_base.js";
import { hashPBKDF2, egaliteSure, genererCode, genererSel } from "./_motdepasse.js";
import { sessionDeLaRequete, jetonInterne, ENTETE_INTERNE } from "./_session.js";

export const CLE_VERIF = "bde-verif-numero";

const MINUTES_VALIDITE = 10;
const ESSAIS_MAX = 5;

/** Ne garde que les chiffres : « +224 611 00 20 91 » et « 224611002091 » sont le même numéro. */
function chiffres(valeur) {
  return String(valeur || "").replace(/\D/g, "");
}

/** Affiche 22••••••91 : assez pour se reconnaître, pas assez pour deviner le numéro. */
function masquerNumero(tel) {
  const n = chiffres(tel);
  if (n.length < 4) return "ce numéro";
  return n.slice(0, 2) + "•".repeat(Math.max(n.length - 4, 3)) + n.slice(-2);
}

async function lireDemandes() {
  const { valeur } = await lireCle(CLE_VERIF);
  return valeur && typeof valeur === "object" ? valeur : {};
}

/** Écrit les demandes en cours, débarrassées de celles qui ont expiré. */
async function ecrireDemandes(demandes) {
  const maintenant = Date.now();
  const vivantes = {};
  for (const [id, d] of Object.entries(demandes)) {
    if (d && d.expireA > maintenant) vivantes[id] = d;
  }
  await ecrireCle(CLE_VERIF, vivantes);
}

/*
 * Le code part sur le numéro PROPOSÉ, pas sur l'ancien : c'est tout l'objet de la manœuvre.
 *
 * `texteLibre` coupe le repli sur le modèle configuré par défaut — celui du suivi de colis — qui
 * arriverait sans ses variables et sans le code. Hors des vingt-quatre heures suivant le dernier
 * message du client, Meta refuse alors l'envoi : c'est la limite de cette voie, et la raison pour
 * laquelle WHATSAPP_TEMPLATE_CODE existe.
 */
async function envoyerCode(req, telephone, code) {
  const hote = req.headers["x-forwarded-host"] || req.headers.host;
  const protocole = req.headers["x-forwarded-proto"] || "https";
  if (!hote) return false;
  const laissezPasser = jetonInterne();
  const modele = process.env.WHATSAPP_TEMPLATE_CODE || null;
  try {
    const reponse = await fetch(`${protocole}://${hote}/api/whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(laissezPasser ? { [ENTETE_INTERNE]: laissezPasser } : {}),
      },
      body: JSON.stringify({
        to: telephone,
        message: `Ba-Diaby Express — votre code de confirmation est ${code}. Il expire dans ${MINUTES_VALIDITE} minutes. Si vous n’avez rien demandé, ignorez ce message.`,
        ...(modele ? { modele, variables: [String(code)] } : { texteLibre: true }),
      }),
    });
    if (!reponse.ok) {
      const detail = await reponse.json().catch(() => ({}));
      console.error("Code de confirmation refusé par api/whatsapp", reponse.status, detail?.error || "");
      return false;
    }
    return true;
  } catch (e) {
    console.error("Code de confirmation impossible à envoyer", e);
    return false;
  }
}

/*
 * Un ralentisseur par compte. Chaque demande fait partir un message facturé par Meta ; sans
 * compteur, une boucle de quelques lignes viderait le quota de l'entreprise et ferait sonner le
 * téléphone de quelqu'un toute la nuit.
 */
const demandesParCompte = new Map();
function tropDeDemandes(id) {
  const maintenant = Date.now();
  const e = demandesParCompte.get(id);
  if (!e || maintenant - e.debut > 60 * 60 * 1000) {
    demandesParCompte.set(id, { debut: maintenant, n: 1 });
    return false;
  }
  e.n += 1;
  return e.n > 10;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  if (!baseConfiguree()) {
    return res.status(501).json({ error: "Vérification du numéro non configurée sur le serveur." });
  }

  /*
   * La session décide de QUI l'on parle — jamais le corps de la requête.
   *
   * Accepter un identifiant de compte envoyé par le navigateur laisserait n'importe quel client
   * connecté changer le numéro d'un autre, et détourner ainsi ses notifications.
   */
  const session = sessionDeLaRequete(req);
  if (!session) return res.status(401).json({ error: "Session absente ou expirée." });
  if (session.role !== "client") {
    return res.status(403).json({ error: "Cette vérification n’est ouverte qu’aux comptes clients." });
  }
  /* Le jeton nomme le compte sous `sub`, comme partout ailleurs — voir api/_session.js. */
  const compteId = session.sub || null;
  if (!compteId) return res.status(401).json({ error: "Session incomplète." });

  const { etape, telephone, code } = req.body || {};

  /*
   * Le ralentisseur ne compte QUE les demandes d'envoi — celles qui font partir un message facturé.
   *
   * L'appliquer aussi aux validations serait doublement fautif : la saisie du code est déjà bornée
   * par ESSAIS_MAX, et un client qui se trompe deux fois de chiffre se verrait répondre « Trop de
   * demandes, réessayez dans une heure » — un refus qui parle d'autre chose que ce qu'il vient de
   * faire, et qui l'enfermerait dehors pour une faute de frappe.
   */
  if (etape === "demande" && tropDeDemandes(compteId)) {
    return res.status(429).json({ error: "Trop de demandes de code. Réessayez dans une heure." });
  }
  const numero = chiffres(telephone);
  if (numero.length < 8) {
    return res.status(400).json({ error: "Numéro invalide. Vérifiez l’indicatif du pays." });
  }
  const avecIndicatif = `+${numero}`;

  try {
    if (etape === "demande") {
      const genere = genererCode();
      const envoye = await envoyerCode(req, avecIndicatif, genere);
      if (!envoye) {
        /*
         * On ne montre PAS le code à l'écran quand l'envoi échoue : ce serait annuler la preuve
         * pour la commodité. Et l'on n'ouvre aucune demande — il n'y a rien à valider.
         *
         * Ici, contrairement à la réinitialisation, dire que l'envoi a échoué ne révèle rien :
         * le numéro vient d'être saisi par la personne elle-même, elle sait déjà qu'il existe.
         */
        return res.status(502).json({
          error: "Nous ne parvenons pas à envoyer le code sur ce numéro. Vérifiez qu’il est bien sur WhatsApp, avec son indicatif.",
        });
      }

      const sel = genererSel();
      const demandes = await lireDemandes();
      demandes[compteId] = {
        sel,
        empreinte: hashPBKDF2(genere, sel),
        // Le numéro visé fait partie de la demande : un code reçu pour l'un ne vaut pas pour l'autre.
        numero,
        expireA: Date.now() + MINUTES_VALIDITE * 60000,
        essais: 0,
      };
      await ecrireDemandes(demandes);
      return res.status(200).json({ envoye: true, masque: masquerNumero(numero), minutes: MINUTES_VALIDITE });
    }

    if (etape === "valider") {
      const demandes = await lireDemandes();
      const demande = demandes[compteId];
      if (!demande || demande.expireA < Date.now()) {
        return res.status(400).json({ error: "Ce code a expiré. Recommencez.", recommencer: true });
      }
      if (demande.essais >= ESSAIS_MAX) {
        return res.status(429).json({ error: "Trop d’essais. Recommencez.", recommencer: true });
      }
      // Le code a été envoyé sur un numéro précis : il ne vaut que pour celui-là.
      if (demande.numero !== numero) {
        return res.status(400).json({ error: "Ce code a été envoyé sur un autre numéro. Recommencez.", recommencer: true });
      }

      const propose = String(code || "").trim();
      if (!egaliteSure(hashPBKDF2(propose, demande.sel), demande.empreinte)) {
        demande.essais += 1;
        await ecrireDemandes(demandes);
        return res.status(400).json({ error: "Code incorrect." });
      }

      /*
       * C'est ici, et nulle part ailleurs, que le numéro d'un client s'inscrit sur sa fiche.
       * Le champ a été retiré de ce que le portail peut écrire : sans cette preuve, il ne bouge pas.
       */
      let trouve = false;
      await modifierDocument((doc) => {
        const comptes = (doc.clientAccounts || []).map((c) => {
          if (c.id !== compteId) return c;
          trouve = true;
          return { ...c, telephone: avecIndicatif, telephoneVerifieLe: new Date().toISOString() };
        });
        if (!trouve) return null;
        return { document: { ...doc, clientAccounts: comptes } };
      });
      if (!trouve) return res.status(404).json({ error: "Compte introuvable." });

      // Le code a servi : il ne doit pas resservir.
      delete demandes[compteId];
      await ecrireDemandes(demandes);
      return res.status(200).json({ ok: true, telephone: avecIndicatif });
    }

    return res.status(400).json({ error: "Étape inconnue." });
  } catch (e) {
    console.error("Échec de la vérification du numéro", e);
    return res.status(502).json({ error: "Vérification impossible pour le moment." });
  }
}
